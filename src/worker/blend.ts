// Test-time compute for free models: a mixture-of-agents pass. Several models
// answer independently with different lenses, the strongest available model
// plans and writes the final answer, and a second strong model checks the
// finished answer before the user sees it. This is how free models get closer
// to frontier quality without a frontier bill: spend more calls per hard
// question, not more money per call. Easy questions skip the extra passes.
//
// None of this turns a small model into a frontier one on every task. It does
// remove many single-model slips: the best lane is no longer passed over for a
// weaker fallback, and the answer is checked after synthesis instead of only
// before it.

import { MAX_OUTPUT_TOKENS } from '../shared/config'
import type { TeamInfo } from '../shared/types'
import { textFromContent, type ChatMessage, type StreamPiece } from './ai'
import { activeLanes, laneKey, laneStrength, laneText, publicComplete, type LaneResult, type PublicLane } from './public-ai'

type Status = (text: string) => Promise<unknown> | unknown
type BlendInput = {
  messages: ChatMessage[]
  signal?: AbortSignal
  reasoning?: boolean
  reasoningEffort?: 'low' | 'medium' | 'high'
  /** Force the full team, even for a short question. */
  team?: boolean
  onTeam?: (team: TeamInfo) => Promise<unknown> | unknown
  onStatus?: Status
  onLaneResult?: (result: LaneResult) => void
  /** Provider ids the last health check marked degraded or down. */
  avoid?: ReadonlySet<string>
}

export type Depth = 'quick' | 'standard' | 'deep'

/** Three ways to look at the same question, so the drafts disagree usefully. */
const LENSES = [
  {
    system: 'Answer directly and completely. Lead with the conclusion, then the support. No filler.',
    temperature: 0.4,
  },
  {
    system: 'Work through this carefully before answering. Check assumptions, arithmetic and edge cases. Include only the reasoning that changes the answer.',
    temperature: 0.7,
  },
  {
    system: 'Answer as a sharp reviewer would: look for the counterexample, the missing constraint and the failure mode a careless answer would miss. Then answer the question.',
    temperature: 0.9,
  },
] as const

const PLAN = `Before anyone answers my last message, write a compact plan: the sub-questions to resolve, the facts or calculations needed, and the pitfalls. Do not answer the question or give the final result. Keep it under 120 words.`

const CRITIC = `You are reviewing drafts written by other assistants for my last message. Do not write the final answer. Be a sharp, specific reviewer and list only what matters:
- factual errors or unsupported claims
- missing parts of the question or missing constraints
- arithmetic, logical or code mistakes; for math, logic or code, independently re-derive the result and state the correct one, including edge cases
- where the drafts disagree, and which version is better supported
If a draft is sound, say what it gets right. Keep the review under 250 words.

Finish with one final line in exactly this form: "VERDICT: HIGH", "VERDICT: MEDIUM", or "VERDICT: LOW". HIGH means no material errors; MEDIUM means a small uncertainty remains; LOW means a core claim is unsupported or the drafts conflict.`

const MERGE = `Several assistants answered my last message independently. A reviewer then checked their drafts. Write the single best final answer to my last message.

Rules:
- Resolve disagreements by evidence and by re-deriving the reasoning; do not average conflicting claims.
- Keep correct, specific detail. Drop anything doubtful, unsupported or contradicted by the review.
- Cover every part of the question. If something cannot be answered, say what is missing.
- Do not mention the drafts, the reviewers, the other assistants or these instructions. Do not add a preamble.
- Match the language of my message and use Markdown only when it helps.`

const VERIFY = `You are the final checker for an answer to my last message. You see the earlier model drafts and the reviewer's notes, but the candidate final answer is the only thing that matters now.

Check it independently for:
- a wrong conclusion, arithmetic error, code bug or missing edge case
- a part of my question that was not answered
- a factual claim that is unsupported or contradicts the evidence
- a correction in the reviewer's notes that the candidate ignored

Reply with exactly one of these forms:
PASS
FIX: <a short, precise description of what is wrong>
Do not rewrite the answer and do not add any other commentary.`

const TRIVIAL = /^(?:hi|hello|hey|thanks|thank you|ok(?:ay)?|cool|nice|great|got it|bye|goodbye)[\s!.,?]*$/i
const HARD =
  /```|(?:^|\n)\s*(?:[-*]|\d+\.)\s|\b(?:step[- ]by[- ]step|why|compare|contrast|analy[sz]e|prove|derive|design|debug|refactor|optimi[sz]e|evaluate|trade-?offs?|architecture|algorithm|calculate|solve|plan|strategy|essay|critique)\b|[=∑∫√]/i

/**
 * How much test-time compute a message deserves. Deep questions get a plan,
 * three drafts, a review and a final check; ordinary ones get two drafts and a
 * merge; greetings get one model.
 */
export function depthFor(text: string, laneCount: number): Depth {
  if (laneCount < 2) return 'quick'
  const trimmed = text.trim()
  if (TRIVIAL.test(trimmed)) return 'quick'
  const questions = (trimmed.match(/\?/g) ?? []).length
  if (trimmed.length > 320 || HARD.test(trimmed) || questions > 1) return 'deep'
  return 'standard'
}

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max)}…` : text)
const hostOf = (lane: PublicLane) => new URL(lane.url).host

/** Adds a lens and, for deep questions, the plan to the system message. */
function withLens(messages: ChatMessage[], lens: string, plan?: string): ChatMessage[] {
  const guide = [
    lens,
    plan ? `A stronger assistant proposed this plan. Follow it where it helps, but correct it if you find a problem:\n${clip(plan, 1_200)}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')
  const [first, ...rest] = messages
  if (first?.role === 'system') return [{ ...first, content: `${textFromContent(first.content)}\n\n${guide}` }, ...rest]
  return [{ role: 'system', content: guide }, ...messages]
}

/** Prefers a different provider for each draft; fills from the same host only when needed. */
function pickDrafters(lanes: PublicLane[], count: number): PublicLane[] {
  const active = activeLanes(lanes)
  const picked: PublicLane[] = []
  const hosts = new Set<string>()
  for (const lane of active) {
    const host = hostOf(lane)
    if (hosts.has(host)) continue
    hosts.add(host)
    picked.push(lane)
    if (picked.length >= count) return picked
  }
  for (const lane of active) {
    if (picked.includes(lane)) continue
    picked.push(lane)
    if (picked.length >= count) break
  }
  return picked
}

type TeamPlan = { referee: PublicLane; critic?: PublicLane; drafters: PublicLane[] }

/**
 * Reserves the strongest lane for planning, synthesis and repair. For a deep
 * pass it also reserves a second strong lane for an independent review, then
 * drafts with the next best distinct providers. This is the fix for the old
 * behaviour that let `GPT-OSS 20B` referee stronger drafts simply because it
 * was the next unused lane in the list.
 */
function chooseTeam(lanes: PublicLane[], count: number, withCritic: boolean, avoid?: ReadonlySet<string>): TeamPlan | undefined {
  const all = activeLanes(lanes)
  const knownGood = avoid ? all.filter((lane) => !avoid.has(laneKey(lane))) : all
  // If every lane is degraded, trying the strongest one is still better than
  // refusing to answer; otherwise the team starts from known-working lanes.
  const active = [...(knownGood.length ? knownGood : all)].sort((a, b) => laneStrength(b.model, b.url) - laneStrength(a.model, a.url))
  const referee = active[0]
  if (!referee) return undefined
  const others = active.filter((lane) => laneKey(lane) !== laneKey(referee))
  // A different host reviews the referee's work where possible. Using the same
  // host is still better than no independent check, but it is the fallback.
  const critic = withCritic ? (others.find((lane) => hostOf(lane) !== hostOf(referee)) ?? others[0]) : undefined
  const pool = active.filter((lane) => laneKey(lane) !== laneKey(referee) && (!critic || laneKey(lane) !== laneKey(critic)))
  const drafters = pickDrafters(pool, count)
  // With only two usable lanes the second one has to draft as well as review;
  // there is no third lane to reserve.
  if (!drafters.length && critic) drafters.push(critic)
  return { referee, critic, drafters }
}

/** Small pieces, so a buffered answer still streams rather than appearing at once. */
async function* chunks(text: string, signal?: AbortSignal, pause = 12): AsyncGenerator<StreamPiece> {
  const words = text.match(/\s+|\S+/g) ?? []
  for (let i = 0; i < words.length; i += 3) {
    if (signal?.aborted) return
    yield { type: 'text', text: words.slice(i, i + 3).join('') }
    if (pause > 0) await new Promise((resolve) => setTimeout(resolve, pause))
  }
}

type Draft = { lane: PublicLane; text: string }

async function draftAll(drafters: PublicLane[], input: BlendInput, plan: string): Promise<Draft[]> {
  const settled = await Promise.allSettled(
    drafters.map((lane, index) => {
      const lens = LENSES[index % LENSES.length]!
      return laneText(lane, {
        messages: withLens(input.messages, lens.system, plan),
        signal: input.signal,
        reasoning: input.reasoning,
        reasoningEffort: input.reasoningEffort,
        temperature: lens.temperature,
        onLaneResult: input.onLaneResult,
      })
    }),
  )
  return settled.flatMap((result, index) => (result.status === 'fulfilled' ? [{ lane: drafters[index]!, text: result.value }] : []))
}

/** The strongest lane frames the problem before the drafters start. */
async function planFor(lane: PublicLane | undefined, input: BlendInput): Promise<string> {
  if (!lane) return ''
  try {
    return await laneText(lane, {
      messages: [...input.messages, { role: 'user', content: PLAN }],
      signal: input.signal,
      maxTokens: 500,
      temperature: 0.3,
      onLaneResult: input.onLaneResult,
    })
  } catch {
    // The plan is an enhancement; the drafts still work without it.
    return ''
  }
}

/** Tries the independent reviewer first, then the referee as a last resort. */
async function critiqueDrafts(candidates: (PublicLane | undefined)[], drafts: Draft[], input: BlendInput): Promise<string> {
  const seen = new Set<string>()
  for (const lane of candidates) {
    if (!lane || seen.has(laneKey(lane))) continue
    seen.add(laneKey(lane))
    const prompt: ChatMessage[] = [
      ...input.messages,
      {
        role: 'user',
        content: `${CRITIC}\n\n${drafts.map((draft, index) => `### Draft ${index + 1} (${draft.lane.label})\n${clip(draft.text, 4_000)}`).join('\n\n')}\n\nList the problems now.`,
      },
    ]
    try {
      const review = await laneText(lane, { messages: prompt, signal: input.signal, maxTokens: 700, temperature: 0.2, onLaneResult: input.onLaneResult })
      if (review.trim()) return review
    } catch {
      // Try the next reviewer; the final merge can still proceed without one.
    }
  }
  return ''
}

function parseVerdict(text: string): { review: string; confidence: TeamInfo['confidence'] } {
  const match = text.match(/(?:^|\n)\s*\*{0,2}VERDICT\*{0,2}\s*:\s*\*{0,2}(HIGH|MEDIUM|LOW)\*{0,2}\s*$/im)
  if (!match) return { review: text.trim(), confidence: 'medium' }
  return {
    review: text.replace(match[0], '').replace(/\n{3,}/g, '\n\n').trim(),
    confidence: match[1]!.toLowerCase() as TeamInfo['confidence'],
  }
}

type Verification = { checked: boolean; issues: string }

/** Checks the already-written answer, not just the drafts. */
async function verifyFinal(
  lane: PublicLane | undefined,
  candidate: string,
  drafts: Draft[],
  review: string,
  input: BlendInput,
): Promise<Verification> {
  if (!lane || !candidate.trim()) return { checked: false, issues: '' }
  const prompt: ChatMessage[] = [
    ...input.messages,
    {
      role: 'user',
      content: [
        VERIFY,
        '',
        '### Candidate final answer',
        clip(candidate, 7_000),
        '',
        '### Earlier drafts',
        drafts.map((draft, index) => `Draft ${index + 1} (${draft.lane.label}):\n${clip(draft.text, 2_500)}`).join('\n\n'),
        review ? `\n### Reviewer's notes\n${clip(review, 2_500)}` : '',
      ].join('\n'),
    },
  ]
  try {
    const verdict = await laneText(lane, { messages: prompt, signal: input.signal, maxTokens: 500, temperature: 0, onLaneResult: input.onLaneResult })
    // Only an explicit verdict is actionable. Some models prepend a long
    // analysis or echo the checker instructions; treating that prose as a FIX
    // report used to send the referee a bogus repair request and contaminate
    // the final answer with the verifier's meta-reasoning.
    const fix = verdict.match(/(?:^|\n)\s*FIX\s*[:\-]?\s*([^\n]+(?:\n(?!\s*(?:PASS|FIX)\b).+)*)/i)
    if (fix?.[1]?.trim()) return { checked: true, issues: fix[1].trim().slice(0, 1_200) }
    if (/(?:^|\n)\s*PASS\b/i.test(verdict)) return { checked: true, issues: '' }
    return { checked: false, issues: '' }
  } catch {
    // Verification is an enhancement; a failed check must not throw away a
    // complete answer.
    return { checked: false, issues: '' }
  }
}

/** The referee repairs the answer after the independent check finds a problem. */
async function reviseFinal(referee: PublicLane, candidate: string, issues: string, input: BlendInput): Promise<string> {
  const prompt: ChatMessage[] = [
    ...input.messages,
    {
      role: 'user',
      content: [
        'An independent checker found a problem with the candidate answer below. Rewrite the complete final answer, fixing the problem and preserving everything that was already correct.',
        '',
        `Checker's finding:\n${clip(issues, 2_000)}`,
        '',
        `Candidate answer:\n${clip(candidate, 7_000)}`,
        '',
        'Return only the corrected final answer. Do not describe your reasoning, the checker, the drafts or this instruction.',
      ].join('\n'),
    },
  ]
  try {
    return await laneText(referee, {
      messages: prompt,
      signal: input.signal,
      reasoning: input.reasoning,
      reasoningEffort: input.reasoningEffort,
      maxTokens: MAX_OUTPUT_TOKENS,
      temperature: 0.2,
      onLaneResult: input.onLaneResult,
    })
  } catch {
    return ''
  }
}

export async function* blendComplete(lanes: PublicLane[], input: BlendInput): AsyncGenerator<StreamPiece> {
  const question = textFromContent([...input.messages].reverse().find((message) => message.role === 'user')?.content ?? '')
  const teamMode = input.team === true && !TRIVIAL.test(question.trim())
  const depth = teamMode ? 'deep' : depthFor(question, activeLanes(lanes).length)

  if (depth === 'quick') {
    yield* publicComplete(lanes, input)
    return
  }

  const selection = chooseTeam(lanes, depth === 'deep' ? 3 : 2, depth === 'deep', input.avoid)
  if (!selection || !selection.drafters.length) {
    yield* publicComplete(lanes, input)
    return
  }
  const { referee, critic } = selection
  const drafters = selection.drafters

  let plan = ''
  if (depth === 'deep') {
    await input.onStatus?.(teamMode ? 'The strongest free lane is planning the approach…' : 'Planning the approach…')
    plan = await planFor(referee, input)
    if (input.signal?.aborted) return
  }

  await input.onStatus?.(teamMode ? `${drafters.length} free models are drafting independently…` : `${drafters.length} free models are drafting…`)
  const drafts = await draftAll(drafters, input, plan)
  if (input.signal?.aborted) return

  if (!drafts.length) {
    // Every drafter failed: one model answering beats an error.
    await input.onStatus?.('A free model is answering…')
    yield* publicComplete(lanes, input)
    return
  }

  let review = ''
  let confidence: TeamInfo['confidence'] = 'low'
  if (depth === 'deep') {
    await input.onStatus?.(teamMode ? 'The independent reviewer is checking the drafts…' : 'Checking the drafts for errors and gaps…')
    review = await critiqueDrafts([critic, referee], drafts, input)
    if (input.signal?.aborted) return
    if (review) {
      const checked = parseVerdict(review)
      review = checked.review
      confidence = checked.confidence
    }
  }

  const verifier = critic && laneKey(critic) !== laneKey(referee) ? critic : undefined
  const teamModels = [...new Set([...drafts.map((draft) => draft.lane.label), ...(referee ? [referee.label] : []), ...(verifier ? [verifier.label] : [])])]
  if (teamMode) {
    await input.onTeam?.({
      models: teamModels,
      drafts: drafts.length,
      reviewed: Boolean(review),
      drafters: drafts.map((draft) => draft.lane.label),
      referee: referee.label,
      verifier: verifier?.label,
      verified: false,
      repaired: false,
      confidence: review ? confidence : 'low',
    })
  }

  await input.onStatus?.(
    review
      ? teamMode
        ? 'The strongest lane is writing the checked answer…'
        : 'Writing the final answer from the best parts…'
      : teamMode
        ? 'The strongest lane is merging the drafts…'
        : 'Merging the drafts into one answer…',
  )
  const prompt: ChatMessage[] = [
    ...input.messages,
    {
      role: 'user',
      content: [
        MERGE,
        '',
        drafts.map((draft, index) => `### Draft ${index + 1} (${draft.lane.label})\n${clip(draft.text, 6_000)}`).join('\n\n'),
        review ? `\n### Reviewer's notes\n${clip(review, 3_000)}` : '',
        '',
        'Write the final answer to my last message now.',
      ].join('\n'),
    },
  ]

  // Deep passes buffer the final answer so a second strong lane can check it.
  // A failed check never discards an answer; it only leaves the answer as-is.
  let finalText = ''
  let verified = false
  let repairedFinal = false
  if (depth === 'deep' && verifier) {
    try {
      finalText = await laneText(referee, {
        messages: prompt,
        signal: input.signal,
        reasoning: input.reasoning,
        reasoningEffort: input.reasoningEffort,
        maxTokens: MAX_OUTPUT_TOKENS,
        temperature: 0.25,
        onLaneResult: input.onLaneResult,
      })
    } catch {
      finalText = ''
    }
    if (input.signal?.aborted) return

    if (finalText.trim()) {
      await input.onStatus?.('A second strong lane is checking the final answer…')
      const check = await verifyFinal(verifier, finalText, drafts, review, input)
      if (input.signal?.aborted) return
      if (check.checked && check.issues) {
        await input.onStatus?.('The check found an issue; the referee is repairing it…')
        const repairText = await reviseFinal(referee, finalText, check.issues, input)
        if (input.signal?.aborted) return
        if (repairText.trim()) {
          finalText = repairText
          repairedFinal = true
        }
      }
      verified = check.checked
    }
  }

  if (finalText.trim()) {
    if (teamMode && verified) {
      await input.onTeam?.({
        models: teamModels,
        drafts: drafts.length,
        reviewed: Boolean(review),
        drafters: drafts.map((draft) => draft.lane.label),
        referee: referee.label,
        verifier: verifier?.label,
        verified: true,
        repaired: repairedFinal,
        confidence: review ? confidence : 'medium',
      })
    }
    console.log('blend', {
      depth,
      team: teamMode,
      planned: Boolean(plan),
      drafts: drafts.map((draft) => draft.lane.model),
      referee: referee.model,
      critic: critic?.model,
      verifier: verifier?.model,
      reviewed: Boolean(review),
      verified,
      confidence: teamMode ? confidence : undefined,
    })
    yield* chunks(finalText, input.signal, 4)
    return
  }

  // The buffered merger is down: stream the merge through the fallback chain.
  const mergeLanes = [referee, ...lanes.filter((lane) => laneKey(lane) !== laneKey(referee))]
  console.log('blend', {
    depth,
    team: teamMode,
    planned: Boolean(plan),
    drafts: drafts.map((draft) => draft.lane.model),
    referee: referee.model,
    critic: critic?.model,
    verifier: verifier?.model,
    reviewed: Boolean(review),
    verified: false,
    confidence: teamMode ? confidence : undefined,
  })

  let yielded = false
  try {
    for await (const piece of publicComplete(mergeLanes, { messages: prompt, signal: input.signal, reasoning: input.reasoning, reasoningEffort: input.reasoningEffort, onLaneResult: input.onLaneResult })) {
      if (piece.type === 'text') yielded = true
      yield piece
    }
  } catch (error) {
    if (yielded) throw error
    // The merger is down: the longest draft is the best answer available.
    const best = [...drafts].sort((a, b) => b.text.length - a.text.length)[0]!
    yield* chunks(best.text, input.signal)
  }
}
