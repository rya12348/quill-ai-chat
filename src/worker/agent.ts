// Agent mode: plan a small set of typed steps, run each one with an existing
// free-mode engine, then write one answer and a receipt. This is the read-only
// vertical slice: no connectors, no write actions and no schedules. Every step
// is either a web research report, a generated page, a study set or the final
// answer, and nothing runs without a visible event in the timeline.

import { agentToolLabel, buildAgentReceipt, correctDecisionPlan, fallbackAgentPlan, isProviderLimitText, isUsableAgentAnswer, parseAgentPlan, parseAgentReview, proofAnswerIssue, shouldPlanWithModel, type AgentPlanStep } from '../shared/agent'
import type { AgentInfo, AgentStep, AgentTool, BuildInfo, CanvasInfo, ProofInfo, ProofJob, ResearchInfo } from '../shared/types'
import { AiError, type ChatMessage } from './ai'
import { buildComplete, type LaneHealth } from './build'
import { canvasComplete } from './canvas'
import { activeLanes, laneKey, laneStrength, laneText, type LaneResult, type PublicLane } from './public-ai'
import { proofComplete } from './proof'
import type { LaneRecord } from './lane-routing'
import { researchComplete } from './research'
import type { Env } from './env'
import type { SearchResult } from './search'

export type AgentIntent = {
  lanes: PublicLane[]
  question: string
  owner: string
  model: string
  env: Env
  signal?: AbortSignal
  /** The saved assistant message these steps belong to. */
  messageId: string
  /** Persisted provider health, so Build ranks lanes the same way Build mode does. */
  health?: Map<string, LaneHealth>
  /** Measured Build quality from previous accepted/rated builds. */
  buildQuality?: ReadonlyMap<string, LaneRecord>
  /** Structural summaries of accepted builds, not their copy. */
  buildReferences?: string[]
  /** A real same-origin proxy endpoint for a generated proxy app. */
  buildProxyPath?: string
  /** Standing instructions, project rules and memory for this turn. */
  system?: string
  /** Recent text history, oldest first. Attachments are never sent to Agent. */
  context?: ChatMessage[]
  /** Returns a reason when a tool's daily allowance is used up. */
  checkTool?: (tool: AgentTool) => Promise<string | null>
  onStatus?: (text: string) => Promise<void> | void
  onLaneResult?: (result: LaneResult) => void
  /** Receives a fresh snapshot after every change. Return false when the reader is gone. */
  onAgent?: (agent: AgentInfo) => Promise<boolean | void> | boolean | void
}

export type AgentOutcome = {
  text: string
  agent: AgentInfo
  research?: ResearchInfo
  build?: BuildInfo
  canvas?: CanvasInfo
  /** The independent check the run produced. */
  proof?: ProofInfo
  /** Code proof waits for the browser runner after the reply is saved. */
  proofJob?: ProofJob
  sources: SearchResult[]
}

const abortError = () => new AiError('aborted', 'The run was stopped.', 499)

/**
 * Prefer the model the person selected, then rank the remaining lanes by
 * strength. A failed selected lane still falls through to the rest, so a run
 * stays smooth instead of stopping when DeepSeek is briefly busy.
 */
const ranked = (lanes: PublicLane[], preferred?: string): PublicLane[] => {
  const ordered = [...activeLanes(lanes)].sort(
    (a, b) => laneStrength(b.model, b.url) - laneStrength(a.model, a.url),
  )
  const at = preferred ? ordered.findIndex((lane) => lane.model === preferred) : -1
  if (at > 0) ordered.unshift(...ordered.splice(at, 1))
  return ordered
}

const stepsFromPlan = (plan: AgentPlanStep[]): AgentStep[] =>
  plan.map((step, index) => ({
    id: `step-${index + 1}`,
    tool: step.tool,
    title: step.title,
    instruction: step.instruction,
    status: 'pending',
  }))

const textContext = (context?: ChatMessage[]): ChatMessage[] =>
  (context ?? [])
    .flatMap((message) =>
      typeof message.content === 'string' && message.content.trim()
        ? [{ role: message.role, content: message.content.slice(0, 6_000) }]
        : [],
    )
    .slice(-6)

const stepQuestion = (goal: string, instruction: string, context = ''): string => {
  const cleanGoal = goal.replace(/\s+/g, ' ').trim().slice(0, 1_200)
  const cleanStep = instruction.replace(/\s+/g, ' ').trim().slice(0, 700)
  const base = !cleanStep || cleanStep.toLowerCase() === cleanGoal.toLowerCase() ? cleanGoal : `${cleanGoal}\n\nThis step: ${cleanStep}`
  const findings = context.replace(/\s+/g, ' ').trim().slice(0, 1_500)
  return (findings ? `${base}\n\nWhat earlier steps found (use it as evidence; do not copy it verbatim):\n${findings}` : base).slice(0, 3_200)

}

function uniqueSources(list: SearchResult[]): SearchResult[] {
  const seen = new Set<string>()
  const out: SearchResult[] = []
  for (const source of list) {
    if (seen.has(source.url)) continue
    seen.add(source.url)
    out.push(source)
  }
  return out
}

/**
 * Runs one long phase and keeps a visible status moving. Tools report their own
 * progress; this fills any silent gap so the person can see the run is alive
 * and the SSE connection never sits idle for long.
 */
async function withProgress<T>(
  input: AgentIntent,
  label: string,
  work: (onStatus: (text: string) => Promise<void> | void) => Promise<T>,
): Promise<T> {
  const startedAt = Date.now()
  let lastAt = Date.now()
  const timer = setInterval(() => {
    if (Date.now() - lastAt < 5_000) return
    lastAt = Date.now()
    const seconds = Math.max(1, Math.round((Date.now() - startedAt) / 1_000))
    void Promise.resolve(input.onStatus?.(`${label}… ${seconds}s`)).catch(() => {})
  }, 5_000)
  try {
    return await work((text) => {
      lastAt = Date.now()
      return input.onStatus?.(text)
    })
  } finally {
    clearInterval(timer)
  }
}

const PLANNER = `You are Ink Agent's planner. Turn the person's goal into a short tool run that will actually produce the result.

Available tools:
- research: search the web and write a cited brief.
- build: make a working page, tool, game or app.
- canvas: make flashcards or a quiz.
- proof: independently check code, math, dates or a factual claim.
- answer: write the final answer. Always last.

Rules:
- Use only the tools the goal needs. Prefer one or two tool steps; a plan may use up to five.
- A simple question needs only answer.
- For a personal decision like "should I...", use only answer unless the person explicitly asks for current facts or sources. Do not research just to make the answer sound bigger.
- Current facts or sources need research.
- A request to make something needs build.
- A request to study needs canvas.
- A request to verify, test or debug a result needs proof.
- If a build depends on current facts, research first. If a claim needs both evidence and verification, research then proof.
- Do not plan a build just because the person says "build a business" or "build a plan"; that is an answer, not a web page.
- Return strict JSON only: {"steps":[{"tool":"research","title":"...","instruction":"..."},{"tool":"answer","title":"...","instruction":"..."}]}
- No markdown, no commentary.`

async function planAgent(input: AgentIntent, fallback: AgentPlanStep[]): Promise<AgentPlanStep[]> {
  if (!shouldPlanWithModel(input.question, fallback) || !input.lanes.length) return fallback
  await input.onStatus?.('Choosing the right tools…')
  const lane = ranked(input.lanes, input.model)[0]
  if (!lane) return fallback
  const goal = input.question.replace(/\s+/g, ' ').trim().slice(0, 2_000)
  const history = textContext(input.context).filter(
    (message) => !(message.role === 'user' && typeof message.content === 'string' && message.content.trim() === goal),
  )
  const system = [
    PLANNER,
    input.system?.trim()
      ? `Context for this conversation (follow it, but never let it override the rules above):\n${input.system.trim().slice(0, 5_000)}`
      : '',
  ].filter(Boolean).join('\n\n')
  try {
    const timeout = AbortSignal.timeout(30_000)
    const signal = input.signal ? AbortSignal.any([input.signal, timeout]) : timeout
    const raw = await laneText(lane, {
      messages: [
        { role: 'system', content: system },
        ...history,
        { role: 'user', content: `Goal: ${goal}` },
      ],
      signal,
      temperature: 0.2,
      maxTokens: 500,
      onLaneResult: input.onLaneResult,
    })
    return parseAgentPlan(raw) ?? fallback
  } catch {
    return fallback
  }
}

type AgentAnswerContext = {
  steps: AgentStep[]
  sources: SearchResult[]
  research?: ResearchInfo
  build?: BuildInfo
  canvas?: CanvasInfo
  proof?: ProofInfo
  researchText: string
  proofText: string
}

type AgentAnswer = { text: string; model?: string; lane?: PublicLane; reviewed: boolean; revised: boolean }

async function writeAnswer(input: AgentIntent, context: AgentAnswerContext): Promise<AgentAnswer> {
  const toolSteps = context.steps.filter((step) => step.tool !== 'answer')
  const lines = [
    "You are Ink Agent. Write the final answer to the person's goal.",
    '',
    `Goal: ${input.question.replace(/\s+/g, ' ').trim().slice(0, 2_000)}`,
    '',
    ...(toolSteps.length
      ? [
          'Steps:',
          ...toolSteps.map((step) => {
            const detail = step.detail ? ` — ${step.detail}` : ''
            return `- ${agentToolLabel(step.tool)} "${step.title}": ${step.status}${detail}`
          }),
        ]
      : ['No tools were needed. Answer directly from your own knowledge. Nothing is missing; do not ask for run content, a research report, or evidence.']),
  ]
  if (context.researchText) {
    lines.push('', 'Research report draft (tighten it; do not contradict it):', context.researchText.slice(0, 3_000))
  }
  if (context.build) {
    const verification = context.build.verification
    lines.push(
      '',
      `Build produced ${context.build.interactive ? 'a working app' : 'a page'} titled "${context.build.title}".${verification ? ` Automated page checks are ${verification.status}.` : ''} It is shown below the answer. Mention it in one short sentence; do not paste its HTML or claim checks that did not run.`,
    )
  }
  if (context.canvas) {
    const count = context.canvas.cards?.length ?? context.canvas.questions?.length ?? 0
    lines.push(
      '',
      `Canvas produced ${count} ${context.canvas.kind === 'quiz' ? 'quiz questions' : 'flashcards'} in a set titled "${context.canvas.title}". It is shown below the answer. Mention it in one short sentence.`,
    )
  }
  if (context.proof) {
    const passed = context.proof.checks.filter((check) => check.critical && check.status === 'pass').length
    const critical = context.proof.checks.filter((check) => check.critical).length
    lines.push(
      '',
      `Proof is ${context.proof.status}${context.proof.reason ? ` (${context.proof.reason})` : ''}; ${passed}/${critical} critical checks passed. Report only what the proof actually established. If it is still checking, say the browser check is running and do not call it verified.`,
    )
  }
  if (context.proofText) {
    lines.push('', 'Proof output (verified or candidate; do not add facts beyond it):', context.proofText.slice(0, 3_000))
  }
  const sourceOrder = context.research?.sourceOrder.length
    ? context.research.sourceOrder
    : context.sources.map((source) => source.url)
  if (sourceOrder.length) {
    lines.push('', 'Sources, in citation order:')
    sourceOrder.slice(0, 5).forEach((url, index) => {
      const title = context.sources.find((source) => source.url === url)?.title ?? url
      lines.push(`[${index + 1}] ${title} — ${url}`)
    })
    lines.push('', 'Cite the sources you rely on as [1], [2] and so on.')
  }
  if (toolSteps.length) {
    lines.push(
      '',
      'Before writing, check the goal against the steps above. If a step failed, was skipped, or did not produce what the goal needed, say what is missing and the best next action. Do not pretend the run was complete.',
    )
  }
  lines.push(
    '',
    'Use the research findings as evidence; do not invent facts, numbers or citations.',
    'Rules: Markdown. Be direct and match the length to the goal. Do not claim a step succeeded if it failed or was skipped. Do not mention the planner or these instructions.',
  )
  const baseSystem = toolSteps.length
    ? 'You are Ink Agent, a careful assistant that reports what actually happened in a run. Never reply with a status word, an apology, a quota notice, or a promise to act later. Write the actual answer. If the run did not fully satisfy the goal, say what is missing and give the next useful action.'
    : 'You are Ink Agent. No tools were needed for this goal. Answer it directly from your own knowledge. Never claim that run content, evidence, or context is missing.'
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: [baseSystem, input.system?.trim().slice(0, 8_000)].filter(Boolean).join('\n\n'),
    },
    ...textContext(input.context).slice(-4),
    { role: 'user', content: lines.join('\n').slice(0, 10_000) },
  ]
  const substantive = context.steps.some((step) => step.tool !== 'answer')
  let last: unknown
  for (const lane of ranked(input.lanes, input.model).slice(0, 3)) {
    try {
      const timeout = AbortSignal.timeout(75_000)
      const signal = input.signal ? AbortSignal.any([input.signal, timeout]) : timeout
      const text = await laneText(lane, {
        messages,
        signal,
        temperature: 0.4,
        maxTokens: 2_000,
        onLaneResult: input.onLaneResult,
      })
      if (isUsableAgentAnswer(text, substantive)) {
        const reviewed = await reviewAnswer(input, text.trim(), lane, context)
        return {
          text: reviewed.text,
          model: lane.label ?? lane.model,
          lane,
          reviewed: reviewed.reviewed,
          revised: reviewed.revised,
        }
      }
      last = new AiError('empty', 'A free lane returned an unusable answer.', 502)
    } catch (error) {
      if (input.signal?.aborted) throw abortError()
      last = error
    }
  }
  throw last instanceof AiError ? last : new AiError('unavailable', 'Agent could not write the final answer.', 503)
}

/**
 * A second family checks the draft before the person sees it. The review is
 * deliberately narrow: material factual or completeness problems only, not
 * style. At most one revision is spent, so a bad reviewer cannot loop the run.
 */
async function reviewAnswer(
  input: AgentIntent,
  answer: string,
  writer: PublicLane,
  context: AgentAnswerContext,
): Promise<{ text: string; reviewed: boolean; revised: boolean }> {
  if (answer.length < 80 || !context.steps.some((step) => step.tool !== 'answer')) {
    return { text: answer, reviewed: false, revised: false }
  }
  const lanes = ranked(input.lanes, input.model)
  const reviewer = lanes.find((lane) => laneKey(lane) !== laneKey(writer))
  if (!reviewer) return { text: answer, reviewed: false, revised: false }
  const evidence = [
    `Goal: ${input.question.replace(/\s+/g, ' ').trim().slice(0, 2_000)}`,
    'Steps:',
    ...context.steps.map((step) => `- ${agentToolLabel(step.tool)} "${step.title}": ${step.status}${step.detail ? ` — ${step.detail}` : ''}`),
    ...(context.researchText ? ['Research:', context.researchText.slice(0, 2_500)] : []),
    ...(context.proof
      ? [
          `Proof: ${context.proof.status}${context.proof.reason ? ` (${context.proof.reason})` : ''}`,
          ...context.proof.checks.map((check) => `- ${check.label}: ${check.status}${check.detail ? ` — ${check.detail}` : ''}`),
        ]
      : []),
    ...(context.proofText ? ['Proof output:', context.proofText.slice(0, 2_000)] : []),
    ...(context.build ? [`Build: ${context.build.title} (${context.build.interactive ? 'working app' : 'page'})`] : []),
    ...(context.canvas ? [`Canvas: ${context.canvas.title} (${context.canvas.kind})`] : []),
  ].join('\n').slice(0, 8_000)
  const timeout = AbortSignal.timeout(35_000)
  const signal = input.signal ? AbortSignal.any([input.signal, timeout]) : timeout
  try {
    const raw = await laneText(reviewer, {
      messages: [
        {
          role: 'system',
          content:
            'You are the independent reviewer for Ink Agent. Check the draft against the goal and the actual tool results. Return strict JSON only: {"verdict":"pass" or "revise","issues":["..."]}. Choose revise only for a material problem: an unsupported fact or number, a claimed step that failed or was skipped, a missing requested artifact, or an answer that does not answer the goal. Ignore style, length and optional extra detail. If the draft is sound, pass.',
        },
        { role: 'user', content: `${evidence}\n\nDRAFT:\n${answer.slice(0, 8_000)}` },
      ],
      signal,
      temperature: 0,
      maxTokens: 500,
      onLaneResult: input.onLaneResult,
    })
    const review = parseAgentReview(raw)
    if (!review) return { text: answer, reviewed: false, revised: false }
    if (review.verdict === 'pass' || !review.issues.length) {
      return { text: answer, reviewed: true, revised: false }
    }
    const revisionTimeout = AbortSignal.timeout(75_000)
    const revisionSignal = input.signal ? AbortSignal.any([input.signal, revisionTimeout]) : revisionTimeout
    const fixed = await laneText(writer, {
      messages: [
        {
          role: 'system',
          content:
            'You are Ink Agent. Revise the draft to fix only the reviewer\'s material issues. Keep it grounded in the tool evidence, do not invent facts, and do not claim a failed or skipped step succeeded. Return the complete corrected answer, with no commentary about the review.',
        },
        { role: 'user', content: `${evidence}\n\nDRAFT:\n${answer.slice(0, 8_000)}\n\nREVIEW ISSUES:\n${review.issues.map((issue) => `- ${issue}`).join('\n')}` },
      ],
      signal: revisionSignal,
      temperature: 0.3,
      maxTokens: 2_000,
      onLaneResult: input.onLaneResult,
    })
    return isUsableAgentAnswer(fixed, true)
      ? { text: fixed.trim(), reviewed: true, revised: true }
      : { text: answer, reviewed: true, revised: false }
  } catch (error) {
    if (input.signal?.aborted) throw abortError()
    return { text: answer, reviewed: false, revised: false }
  }
}

function fallbackAnswer(
  steps: AgentStep[],
  researchText: string,
  build?: BuildInfo,
  canvas?: CanvasInfo,
  proofText = '',
): string {
  if (researchText.trim()) return researchText.trim()
  if (build) {
    const warning = build.verification?.status === 'warning'
    return `I built **${build.title}**. ${build.interactive ? 'The working app is ready' : 'The page is ready'}${warning ? ', but one automated check still needs attention' : ''} and shown below.`
  }
  if (canvas) {
    const count = canvas.cards?.length ?? canvas.questions?.length ?? 0
    return `I made a ${count}-${canvas.kind === 'quiz' ? 'question quiz' : 'card deck'} called **${canvas.title}**. It is shown below.`
  }
  if (proofText.trim() && isUsableAgentAnswer(proofText, false)) return proofText.trim()
  const ran = steps.filter((step) => step.tool !== 'answer' && step.status === 'done')
  const failed = steps.filter((step) => step.tool !== 'answer' && step.status === 'failed')
  if (!ran.length) {
    if (failed.length) {
      const first = failed[0]
      if (first.tool === 'build') {
        return "I couldn't finish the page build. The generated pages were incomplete. Try again, or ask for a smaller page."
      }
      return `I couldn't finish **${first.title}**. The tool didn't return a usable result. Try again, or ask for something smaller.`
    }
    return "I couldn't write an answer this time. Try again in a minute."
  }
  return [
    "I couldn't write the final summary, but these steps finished:",
    '',
    ...ran.map((step) => `- **${step.title}** (${agentToolLabel(step.tool).toLowerCase()})${step.detail ? `: ${step.detail}` : ''}`),
  ].join('\n')
}

export async function agentComplete(input: AgentIntent): Promise<AgentOutcome> {
  const startedAt = Date.now()
  const steps: AgentStep[] = []
  const models = new Set<string>()
  const addModels = (labels: Array<string | undefined>) => {
    for (const label of labels) {
      if (typeof label !== 'string' || !label.trim()) continue
      models.add(label.trim().slice(0, 80))
    }
  }

  const agent: AgentInfo = {
    goal: input.question.replace(/\s+/g, ' ').trim().slice(0, 2_000),
    status: 'planning',
    steps: [],
    receipt: '',
    models: [],
    asOf: Date.now(),
  }

  const snapshot = (): AgentInfo => ({
    ...agent,
    steps: steps.map((step) => ({ ...step })),
    models: [...models].slice(0, 8),
    asOf: Date.now(),
  })

  const emit = async (): Promise<AgentInfo> => {
    const info = snapshot()
    Object.assign(agent, info)
    const ok = (await input.onAgent?.(info)) !== false
    if (!ok) throw abortError()
    return info
  }

  const patchStep = async (index: number, patch: Partial<AgentStep>) => {
    const current = steps[index]
    if (!current) return
    steps[index] = { ...current, ...patch }
    await emit()
  }

  await input.onStatus?.('Planning the run…')
  // Planning is local and immediate. Waiting for a model to decide the plan
  // made every run start with a silent window that could outlive the SSE
  // connection before a single tool had started.
  const fallback = fallbackAgentPlan(input.question)
  const planned = await planAgent(input, fallback)
  const plan = correctDecisionPlan(input.question, planned)
  steps.push(...stepsFromPlan(plan))
  agent.status = 'running'
  await emit()

  let researchInfo: ResearchInfo | undefined
  let buildInfo: BuildInfo | undefined
  let canvasInfo: CanvasInfo | undefined
  let proofInfo: ProofInfo | undefined
  let proofJob: ProofJob | undefined
  let proofText = ''
  let sources: SearchResult[] = []
  let researchText = ''
  let failed = 0

  for (const [index, step] of steps.entries()) {
    if (step.tool === 'answer') continue
    if (input.signal?.aborted) throw abortError()

    let limit: string | null = null
    try {
      limit = (await input.checkTool?.(step.tool)) ?? null
    } catch {
      limit = null
    }
    if (limit) {
      await patchStep(index, { status: 'skipped', detail: limit, finishedAt: Date.now() })
      continue
    }

    await patchStep(index, { status: 'running', startedAt: Date.now() })
    await input.onStatus?.(`Running ${agentToolLabel(step.tool).toLowerCase()}: ${step.title}…`)
    try {
      const findings = step.tool === 'build' || step.tool === 'canvas' ? researchText.trim().slice(0, 1_500) : ''
      if (step.tool === 'research') {
        const outcome = await withProgress(input, 'Researching', (onStatus) =>
          researchComplete({
            lanes: input.lanes,
            owner: input.owner,
            model: input.model,
            question: stepQuestion(input.question, step.instruction, step.tool === 'research' ? '' : findings),
            signal: input.signal ?? new AbortController().signal,
            env: input.env,
            onStatus,
            onLaneResult: input.onLaneResult,
          }),
        )
        const document = outcome.research.document === true
        researchInfo = document ? undefined : outcome.research
        researchText = isProviderLimitText(outcome.text) ? '' : outcome.text.trim().slice(0, 4_000)
        sources = uniqueSources(outcome.sources).slice(0, 8)
        addModels(outcome.research.models)
        await patchStep(index, {
          status: 'done',
          detail: document ? `Document written${sources.length ? ` · ${sources.length} sources` : ''}` : `${outcome.research.counts.sources} sources · ${outcome.research.counts.supported} supported`,
          model: outcome.research.models[0],
          artifactMessageId: input.messageId,
          finishedAt: Date.now(),
        })
      } else if (step.tool === 'build') {
        const outcome = await withProgress(input, input.buildProxyPath ? 'Building the proxy' : 'Building the app', (onStatus) =>
          buildComplete({
            lanes: input.lanes,
            question: stepQuestion(input.question, step.instruction, step.tool === 'research' ? '' : findings),
            signal: input.signal,
            health: input.health,
            quality: input.buildQuality,
            references: input.buildReferences,
            proxyPath: input.buildProxyPath,
            onStatus,
            onLaneResult: input.onLaneResult,
          }),
        )
        buildInfo = outcome.build
        addModels(outcome.build.models)
        const verification = outcome.build.verification
        await patchStep(index, {
          status: 'done',
          detail: verification
            ? `${outcome.build.title} · ${verification.status === 'verified' ? 'verified' : 'needs review'}`
            : outcome.build.title,
          model: outcome.build.models[0],
          artifactMessageId: input.messageId,
          finishedAt: Date.now(),
        })
      } else if (step.tool === 'canvas') {
        const outcome = await withProgress(input, 'Making the study set', (onStatus) =>
          canvasComplete({
            lanes: input.lanes,
            question: stepQuestion(input.question, step.instruction, step.tool === 'research' ? '' : findings),
            signal: input.signal,
            onStatus,
            onLaneResult: input.onLaneResult,
          }),
        )
        canvasInfo = outcome.canvas
        addModels(outcome.canvas.models)
        const count = outcome.canvas.cards?.length ?? outcome.canvas.questions?.length ?? 0
        await patchStep(index, {
          status: 'done',
          detail: `${count} ${outcome.canvas.kind === 'quiz' ? 'questions' : 'cards'}`,
          model: outcome.canvas.models[0],
          artifactMessageId: input.messageId,
          finishedAt: Date.now(),
        })
      } else if (step.tool === 'proof') {
        const proofQuestion = stepQuestion(input.question, step.instruction, researchText.trim().slice(0, 1_500))
        const proofMessages: ChatMessage[] = [
          ...(input.system?.trim() ? [{ role: 'system' as const, content: input.system.trim().slice(0, 8_000) }] : []),
          ...textContext(input.context),
          { role: 'user' as const, content: proofQuestion },
        ]
        const outcome = await withProgress(input, 'Checking the result', (onStatus) =>
          proofComplete({
            lanes: input.lanes,
            messages: proofMessages,
            question: proofQuestion,
            results: sources,
            signal: input.signal ?? new AbortController().signal,
            library: [],
            onStatus,
            onLaneResult: input.onLaneResult,
          }),
        )
        const rawProofText = outcome.text.trim()
        const proofIssue = proofAnswerIssue(outcome.proof, rawProofText)
        proofInfo = outcome.proof
        proofJob = outcome.job ? { ...outcome.job, messageId: input.messageId } : undefined
        proofText = proofIssue ? '' : rawProofText.slice(0, 4_000)
        addModels(outcome.models)
        if (proofIssue) {
          if (proofIssue === 'no-checks') proofInfo = undefined
          throw new AiError(
            'unavailable',
            proofIssue === 'no-checks' ? 'Proof could not run a check.' : 'Proof did not return a usable result.',
            503,
          )
        }
        const checkedProof = outcome.proof
        const critical = checkedProof.checks.filter((check) => check.critical)
        const passed = critical.filter((check) => check.status === 'pass').length
        const detail =
          checkedProof.status === 'checking'
            ? 'browser check queued'
            : checkedProof.status === 'verified'
              ? `${passed}/${critical.length} checks passed`
              : `${checkedProof.status}${checkedProof.reason ? `: ${checkedProof.reason}` : ''}`
        await patchStep(index, {
          status: 'done',
          detail,
          model: outcome.models[0],
          artifactMessageId: input.messageId,
          finishedAt: Date.now(),
        })
      }
    } catch (error) {
      if (input.signal?.aborted) throw abortError()
      failed += 1
      const detail = error instanceof AiError ? error.message : 'This step could not finish.'
      await patchStep(index, {
        status: 'failed',
        detail: detail.slice(0, 160),
        finishedAt: Date.now(),
      })
    }
  }

  const answerIndex = steps.findIndex((step) => step.tool === 'answer')
  if (answerIndex >= 0) await patchStep(answerIndex, { status: 'running', startedAt: Date.now() })
  const toolSteps = steps.filter((step) => step.tool !== 'answer')
  const onlyTool = toolSteps.length === 1 ? toolSteps[0] : undefined
  // A single successful tool already produced the artifact or report. Use it
  // directly instead of spending another model call on a one-sentence intro.
  const direct = onlyTool?.status === 'done'
    ? onlyTool.tool === 'research'
      ? researchText.trim()
      : onlyTool.tool === 'build' && buildInfo
        ? fallbackAnswer(steps, researchText, buildInfo, canvasInfo, proofText)
        : onlyTool.tool === 'canvas' && canvasInfo
          ? fallbackAnswer(steps, researchText, buildInfo, canvasInfo, proofText)
          : onlyTool.tool === 'proof'
            ? (isUsableAgentAnswer(proofText, false) ? proofText.trim() : '') ||
              fallbackAnswer(steps, researchText, buildInfo, canvasInfo, proofText)
            : ''
    : ''
  const allToolsFailed = toolSteps.length > 0 && !toolSteps.some((step) => step.status === 'done')
  let answer = ''
  let answerModel: string | undefined
  let fellBack = false
  let reviewed = false
  let revised = false
  if (allToolsFailed) {
    // The tools have already explained what went wrong. Asking another model
    // to paraphrase that failure adds tens of seconds and can turn a clear
    // timeout into a vague status message, so finish immediately.
    await input.onStatus?.('Finishing the answer…')
    answer = fallbackAnswer(steps, researchText, buildInfo, canvasInfo, proofText)
    fellBack = true
  } else if (direct.trim()) {
    await input.onStatus?.('Finishing the answer…')
    answer = direct.trim()
    answerModel = onlyTool?.model
  } else {
    await input.onStatus?.('Writing the answer…')
    try {
      const written = await withProgress(input, 'Writing the answer', () =>
        writeAnswer(input, {
          steps,
          sources,
          research: researchInfo,
          build: buildInfo,
          canvas: canvasInfo,
          proof: proofInfo,
          researchText,
          proofText,
        }),
      )
      answer = written.text
      answerModel = written.model
      reviewed = written.reviewed
      revised = written.revised
      addModels([answerModel])
    } catch (error) {
      if (input.signal?.aborted) throw abortError()
      answer = fallbackAnswer(steps, researchText, buildInfo, canvasInfo, proofText)
      fellBack = true
    }
  }
  if (!answer.trim()) {
    answer = fallbackAnswer(steps, researchText, buildInfo, canvasInfo, proofText)
    fellBack = true
  }
  if (answerIndex >= 0) {
    await patchStep(answerIndex, {
      status: 'done',
      detail: `${answer.length.toLocaleString()} characters`,
      model: answerModel,
      artifactMessageId: input.messageId,
      finishedAt: Date.now(),
    })
  }

  const buildWarning = buildInfo?.verification?.status === 'warning'
  agent.status = failed || fellBack || buildWarning ? 'partial' : 'done'
  agent.receipt = buildAgentReceipt({
    status: agent.status,
    steps,
    startedAt,
    finishedAt: Date.now(),
    reviewed,
    revised,
  })
  agent.reason = failed
    ? `${failed} step${failed === 1 ? '' : 's'} did not finish`
    : fellBack
      ? 'a model was unavailable to write the final answer'
      : buildWarning
        ? 'the page was built, but one automated check needs attention'
      : undefined
  const final = await emit()

  return {
    text: answer.trim(),
    agent: final,
    ...(researchInfo ? { research: researchInfo } : {}),
    ...(buildInfo ? { build: buildInfo } : {}),
    ...(canvasInfo ? { canvas: canvasInfo } : {}),
    ...(proofInfo ? { proof: proofInfo } : {}),
    ...(proofJob ? { proofJob } : {}),
    sources,
  }
}
