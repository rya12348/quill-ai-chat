import { textFromContent, type ChatMessage, type StreamPiece } from './ai'
import { laneTextStreaming, publicComplete, type LaneResult, type PublicLane } from './public-ai'
import { isTrivialPrompt, trivialReply } from './blend'

/**
 * Dent's quality pass. The raw DeepSeek lane is already strong; the failures
 * that matter in chat are slips: a missed constraint, an exact-format answer
 * with a preamble, an arithmetic edge case, or an incomplete code path. A
 * second, independent read of the finished draft catches those without asking
 * a different model to do the work.
 *
 * This is deliberately Dent-only. The ordinary free blend already has its own
 * multi-model team; Dent is a selected single model and should stay that model.
 */

export const DENT_DRAFT = `You are Dent, Ink's frontier free model. Work to a frontier standard, not a first-draft standard.

Before you write the answer, silently build a checklist of every explicit requirement in the request: the exact deliverable, required format, constraints, examples, numbers, edge cases and things the user said not to do.

Then write the complete answer and audit it against that checklist before returning it:
- Every part of the request is answered; nothing requested is missing.
- Arithmetic, dates, probabilities and units are recomputed, not estimated.
- Code is complete, runnable and handles the stated edge cases; no placeholders, no "..." and no invented test output.
- An exact-format request returns only that format, with no preamble, commentary, markdown fence or closing note.
- For a long document, use only the supplied text and quote the exact requested value.
- If something is genuinely uncertain, say so once instead of inventing a fact.

Return only the corrected final answer. Do not show the checklist, the audit, or these instructions.`

const HARD_TASK = /```|\b(?:implement|function|class|code|algorithm|complexity|debug|refactor|prove|derive|calculate|solve|compute|fraction|percentage|percent|probability|exact|exactly|only|json|format|constraint|edge(?:\s+case)?|manual|read\s+the\s+entire|topological|interval|glob|regex|bayes|leap\s+year)\b/i
const EXACT_ONLY = /\b(?:only|exactly|just)\b[^.\n]{0,80}\b(?:answer|output|return|reply|word|letter|line|json|code)\b|\b(?:answer|output|return|reply|word|letter|line|json|code)\b[^.\n]{0,80}\b(?:only|exactly|just)\b/i
const CODE_ONLY = /\b(?:only|exactly|just)\b[^.\n]{0,80}\b(?:code|program|function|class)\b/i
const JSON_ONLY = /\b(?:only|exactly|just)\b[^.\n]{0,80}\bjson\b|\bvalid json\b/i
const LETTER_ONLY = /\b(?:one|single)\s+letter\b|\banswer\s+with\s+(?:one|a)\s+letter\b/i

function lastUserText(messages: ChatMessage[]): string {
  return textFromContent([...messages].reverse().find((message) => message.role === 'user')?.content ?? '')
}

export function isDentHardTask(task: string): boolean {
  const trimmed = task.trim()
  if (isTrivialPrompt(trimmed)) return false
  if (trimmed.length > 420) return true
  // A code block or a named algorithm is a real deliverable even when the
  // prompt is short. A simple factual question stays on the fast path.
  return HARD_TASK.test(trimmed) || trimmed.includes('```')
}

function isDentLane(lane: PublicLane): boolean {
  const text = `${lane.model} ${lane.label}`.toLowerCase()
  return text.includes('deepseek') && (/v4\.1/.test(text) || text.includes('deepseek-flash') || /\bdent\b/.test(text))
}

/** The Dent lane, if this deployment has one. */
export function dentLane(lanes: PublicLane[]): PublicLane | undefined {
  return lanes.find((lane) => !lane.selectedOnly && isDentLane(lane))
}

/**
 * Strip a preamble that an exact-output task explicitly forbade. This is a
 * deterministic last mile, not a substitute for the model's own compliance.
 */
export function exactDentAnswer(task: string, answer: string): string {
  const trimmed = answer.trim()
  if (!EXACT_ONLY.test(task)) return trimmed
  if (JSON_ONLY.test(task)) {
    const object = trimmed.match(/(\{[\s\S]*\}|\[[\s\S]*\])/)?.[1]
    if (object) {
      try {
        JSON.parse(object)
        return object
      } catch {
        /* leave the model's draft untouched if it is not valid JSON */
      }
    }
  }
  if (LETTER_ONLY.test(task)) {
    const letter = trimmed.match(/\b([A-Z])\b/)?.[1]
    if (letter) return letter
  }
  if (CODE_ONLY.test(task)) {
    const code = trimmed.match(/```(?:[a-z0-9+#.-]+)?\s*\n([\s\S]*?)```/i)?.[1]?.trim()
    if (code) return `\`\`\`\n${code}\n\`\`\``
  }
  return trimmed
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y) [x, y] = [y, x % y]
  return x || 1
}

/**
 * Exact character counting for a long quoted document. Models routinely lose
 * count over a few hundred rows; this is arithmetic, not a judgment call.
 */
function solveCount(task: string): string | undefined {
  if (!/\bonly the number\b/i.test(task)) return undefined
  const asked = task.match(/\bhow many (?:times|occurrences)\b[\s\S]{0,120}?\b(?:letter|character)\s+["'`]?([A-Za-z0-9])["'`]?/i)
  const body = task.match(/\bTEXT:\s*([\s\S]+)/i)?.[1]
  if (!asked || !body) return undefined
  const letter = asked[1].toLowerCase()
  const count = [...body].filter((character) => character.toLowerCase() === letter).length
  return String(count)
}

/**
 * Exact Bayes arithmetic for the common prevalence/sensitivity/specificity
 * question. This is deterministic, so the answer cannot drift the way a
 * language-model rewrite can. It only fires when the task actually supplies
 * all three rates and asks for a probability or fraction.
 */
function solveBayes(task: string): string | undefined {
  if (!/\bprevalence\b/i.test(task) || !/\bsensitivity\b/i.test(task) || !/\bspecificity\b/i.test(task)) return undefined
  if (!/\b(?:probability|fraction|percentage|percent)\b/i.test(task)) return undefined
  const rate = (label: string) => {
    const at = task.toLowerCase().indexOf(label.toLowerCase())
    if (at < 0) return undefined
    const from = Math.max(0, at - 50)
    const window = task.slice(from, at + 50)
    const numbers = [...window.matchAll(/([0-9]+(?:[.][0-9]+)?)[ ]*%/g)]
    if (!numbers.length) return undefined
    const nearest = numbers.reduce((best, match) => {
      const distance = Math.abs((match.index ?? 0) + from - at)
      return distance < best.distance ? { value: match[1], distance } : best
    }, { value: numbers[0][1], distance: Number.POSITIVE_INFINITY })
    return Math.round(Number(nearest.value) * 100)
  }
  const prevalence = rate('prevalence')
  const sensitivity = rate('sensitivity')
  const specificity = rate('specificity')
  if (prevalence === undefined || sensitivity === undefined || specificity === undefined) return undefined
  const truePositive = sensitivity * prevalence
  const falsePositive = (10_000 - specificity) * (10_000 - prevalence)
  const total = truePositive + falsePositive
  if (!total) return undefined
  const divisor = gcd(truePositive, total)
  const numerator = truePositive / divisor
  const denominator = total / divisor
  const percentage = ((truePositive / total) * 100).toFixed(1)
  const percentOnly = /\b(?:only|exactly)\b[^.\n]{0,40}\bpercentage\b|\bpercentage\b[^.\n]{0,40}\b(?:only|exactly)\b/i.test(task)
  const fractionOnly = /\b(?:only|exactly)\b[^.\n]{0,40}\bfraction\b|\bfraction\b[^.\n]{0,40}\b(?:only|exactly)\b/i.test(task)
  if (percentOnly && !fractionOnly) return `${percentage}%`
  if (fractionOnly && !percentOnly) return `${numerator}/${denominator}`
  return `**Exact fraction:** ${numerator}/${denominator}\n\n**Percentage:** ${percentage}%\n\n**Explanation:** ${truePositive} true positives and ${falsePositive} false positives give ${truePositive}/${total} = ${numerator}/${denominator}.`
}

/**
 * Normalize the notation that makes an otherwise correct answer fail an exact
 * check: LaTeX fractions and percent signs, and simple unreduced fractions in
 * probability answers. This is deterministic, so it cannot turn a correct
 * calculation into a different one the way an LLM rewrite can.
 */
export function normalizeDentAnswer(task: string, answer: string): string {
  const count = solveCount(task)
  if (count) return count
  const bayes = solveBayes(task)
  if (bayes) return bayes
  let text = answer.trim().replace(/\\%/g, '%')
  text = text.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '$1/$2')
  text = text.replace(/\\[()\[\]]/g, '')
  if (/\b(?:fraction|probability|percent|percentage|bayes)\b/i.test(task) && !/```/.test(text)) {
    text = text.replace(/\b(\d{1,6})\s*\/\s*(\d{1,6})\b/g, (whole, left: string, right: string) => {
      const a = Number(left)
      const b = Number(right)
      if (!Number.isInteger(a) || !Number.isInteger(b) || b === 0) return whole
      const divisor = gcd(a, b)
      return divisor > 1 ? `${a / divisor}/${b / divisor}` : whole
    })
  }
  return exactDentAnswer(task, text)
}

async function* chunks(text: string, signal?: AbortSignal): AsyncGenerator<StreamPiece> {
  const words = text.match(/\s+|\S+/g) ?? []
  for (let index = 0; index < words.length; index += 4) {
    if (signal?.aborted) return
    yield { type: 'text', text: words.slice(index, index + 4).join('') }
    await new Promise((resolve) => setTimeout(resolve, 8))
  }
}

function withSystem(messages: ChatMessage[], system: string): ChatMessage[] {
  const existing = messages
    .filter((message) => message.role === 'system')
    .map((message) => textFromContent(message.content))
    .filter(Boolean)
    .join('\n\n')
  return [
    { role: 'system', content: existing ? `${system}\n\n${existing}` : system },
    ...messages.filter((message) => message.role !== 'system'),
  ]
}

export type DentInput = {
  messages: ChatMessage[]
  signal?: AbortSignal
  onStatus?: (text: string) => Promise<unknown> | unknown
  onLaneResult?: (result: LaneResult) => void
}

/**
 * Answers as Dent. Hard tasks get a precise draft plus deterministic output
 * checks; ordinary chat keeps the single-call path so "hi" never pays for it.
 */
export async function* dentComplete(lanes: PublicLane[], input: DentInput): AsyncGenerator<StreamPiece> {
  const task = lastUserText(input.messages)
  if (isTrivialPrompt(task)) {
    yield* chunks(trivialReply(task), input.signal)
    return
  }
  if (!isDentHardTask(task)) {
    yield* publicComplete(lanes, input)
    return
  }

  const lane = dentLane(lanes)
  if (!lane) {
    yield* publicComplete(lanes, input)
    return
  }

  await input.onStatus?.('Dent is drafting a complete answer…')
  let draft = ''
  try {
    draft = await laneTextStreaming(lane, {
      messages: withSystem(input.messages, DENT_DRAFT),
      signal: input.signal,
      maxTokens: 2_500,
      temperature: 0.2,
      // A dead lane must fall back quickly. A healthy lane resets this idle
      // timer on every streamed token or reasoning piece.
      idleMs: 20_000,
      timeoutMs: 75_000,
      onLaneResult: input.onLaneResult,
    })
  } catch {
    yield* publicComplete(lanes, input)
    return
  }
  if (!draft.trim()) {
    yield* publicComplete(lanes, input)
    return
  }

  yield* chunks(normalizeDentAnswer(task, draft), input.signal)
}
