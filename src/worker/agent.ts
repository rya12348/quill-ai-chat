// Agent mode: plan a small set of typed steps, run each one with an existing
// free-mode engine, then write one answer and a receipt. This is the read-only
// vertical slice: no connectors, no write actions and no schedules. Every step
// is either a web research report, a generated page, a study set or the final
// answer, and nothing runs without a visible event in the timeline.

import { agentToolLabel, buildAgentReceipt, fallbackAgentPlan, isProviderLimitText, isUsableAgentAnswer, type AgentPlanStep } from '../shared/agent'
import type { AgentInfo, AgentStep, AgentTool, BuildInfo, CanvasInfo, ResearchInfo } from '../shared/types'
import { AiError, type ChatMessage } from './ai'
import { buildComplete, type LaneHealth } from './build'
import { canvasComplete } from './canvas'
import { activeLanes, laneStrength, laneText, type LaneResult, type PublicLane } from './public-ai'
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
  sources: SearchResult[]
}

const abortError = () => new AiError('aborted', 'The run was stopped.', 499)

/** Strongest lanes first; the plan and the answer use the best available. */
const ranked = (lanes: PublicLane[]): PublicLane[] =>
  [...activeLanes(lanes)].sort((a, b) => laneStrength(b.model, b.url) - laneStrength(a.model, a.url))

const stepsFromPlan = (plan: AgentPlanStep[]): AgentStep[] =>
  plan.map((step, index) => ({
    id: `step-${index + 1}`,
    tool: step.tool,
    title: step.title,
    instruction: step.instruction,
    status: 'pending',
  }))

const stepQuestion = (goal: string, instruction: string): string => {
  const cleanGoal = goal.replace(/\s+/g, ' ').trim().slice(0, 1_200)
  const cleanStep = instruction.replace(/\s+/g, ' ').trim().slice(0, 700)
  if (!cleanStep || cleanStep.toLowerCase() === cleanGoal.toLowerCase()) return cleanGoal
  return `${cleanGoal}\n\nThis step: ${cleanStep}`.slice(0, 2_000)
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

async function writeAnswer(
  input: AgentIntent,
  context: {
    steps: AgentStep[]
    sources: SearchResult[]
    research?: ResearchInfo
    build?: BuildInfo
    canvas?: CanvasInfo
    researchText: string
  },
): Promise<{ text: string; model?: string }> {
  const lines = [
    "You are Quill Agent. Write the final answer to the person's goal using the run below.",
    '',
    `Goal: ${input.question.replace(/\s+/g, ' ').trim().slice(0, 2_000)}`,
    '',
    'Steps:',
    ...context.steps.map((step) => {
      const detail = step.detail ? ` — ${step.detail}` : ''
      return `- ${agentToolLabel(step.tool)} "${step.title}": ${step.status}${detail}`
    }),
  ]
  if (context.researchText) {
    lines.push('', 'Research report draft (tighten it; do not contradict it):', context.researchText.slice(0, 3_000))
  }
  if (context.build) {
    lines.push(
      '',
      `Build produced a page titled "${context.build.title}". It is shown below the answer. Mention it in one short sentence; do not paste its HTML.`,
    )
  }
  if (context.canvas) {
    const count = context.canvas.cards?.length ?? context.canvas.questions?.length ?? 0
    lines.push(
      '',
      `Canvas produced ${count} ${context.canvas.kind === 'quiz' ? 'quiz questions' : 'flashcards'} in a set titled "${context.canvas.title}". It is shown below the answer. Mention it in one short sentence.`,
    )
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
  lines.push(
    '',
    'Rules: Markdown. Be direct and match the length to the goal. Do not claim a step succeeded if it failed or was skipped. Do not mention the planner or these instructions.',
  )
  const messages: ChatMessage[] = [
    { role: 'system', content: 'You are Quill Agent, a careful assistant that reports what actually happened in a run. Never reply with a status word, an apology, a quota notice, or a promise to act later. Write the actual answer.' },
    { role: 'user', content: lines.join('\n').slice(0, 10_000) },
  ]
  const substantive = context.steps.some((step) => step.tool !== 'answer')
  let last: unknown
  for (const lane of ranked(input.lanes).slice(0, 3)) {
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
        return { text: text.trim(), model: lane.label ?? lane.model }
      }
      last = new AiError('empty', 'A free lane returned an unusable answer.', 502)
    } catch (error) {
      if (input.signal?.aborted) throw abortError()
      last = error
    }
  }
  throw last instanceof AiError ? last : new AiError('unavailable', 'Agent could not write the final answer.', 503)
}

function fallbackAnswer(
  steps: AgentStep[],
  researchText: string,
  build?: BuildInfo,
  canvas?: CanvasInfo,
): string {
  if (researchText.trim()) return researchText.trim()
  if (build) return `I built **${build.title}**. The page is ready and shown below.`
  if (canvas) {
    const count = canvas.cards?.length ?? canvas.questions?.length ?? 0
    return `I made a ${count}-${canvas.kind === 'quiz' ? 'question quiz' : 'card deck'} called **${canvas.title}**. It is shown below.`
  }
  const ran = steps.filter((step) => step.tool !== 'answer' && step.status === 'done')
  if (!ran.length) {
    return 'The run finished, but no free model was available to write the answer. Try again in a minute.'
  }
  return [
    'The run finished, but no free model was available to write the final answer. Here is what the steps produced:',
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
    models: [...models].slice(0, 6),
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
  steps.push(...stepsFromPlan(fallbackAgentPlan(input.question)))
  agent.status = 'running'
  await emit()

  let researchInfo: ResearchInfo | undefined
  let buildInfo: BuildInfo | undefined
  let canvasInfo: CanvasInfo | undefined
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
      if (step.tool === 'research') {
        const outcome = await withProgress(input, 'Researching', (onStatus) =>
          researchComplete({
            lanes: input.lanes,
            owner: input.owner,
            model: input.model,
            question: stepQuestion(input.question, step.instruction),
            signal: input.signal ?? new AbortController().signal,
            env: input.env,
            onStatus,
            onLaneResult: input.onLaneResult,
          }),
        )
        researchInfo = outcome.research
        researchText = isProviderLimitText(outcome.text) ? '' : outcome.text.trim().slice(0, 4_000)
        sources = uniqueSources(outcome.sources).slice(0, 8)
        addModels(outcome.research.models)
        await patchStep(index, {
          status: 'done',
          detail: `${outcome.research.counts.sources} sources · ${outcome.research.counts.supported} supported`,
          model: outcome.research.models[0],
          artifactMessageId: input.messageId,
          finishedAt: Date.now(),
        })
      } else if (step.tool === 'build') {
        const outcome = await withProgress(input, 'Building the page', (onStatus) =>
          buildComplete({
            lanes: input.lanes,
            question: stepQuestion(input.question, step.instruction),
            signal: input.signal,
            health: input.health,
            onStatus,
            onLaneResult: input.onLaneResult,
          }),
        )
        buildInfo = outcome.build
        addModels(outcome.build.models)
        await patchStep(index, {
          status: 'done',
          detail: outcome.build.title,
          model: outcome.build.models[0],
          artifactMessageId: input.messageId,
          finishedAt: Date.now(),
        })
      } else if (step.tool === 'canvas') {
        const outcome = await withProgress(input, 'Making the study set', (onStatus) =>
          canvasComplete({
            lanes: input.lanes,
            question: stepQuestion(input.question, step.instruction),
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
        ? fallbackAnswer(steps, researchText, buildInfo, canvasInfo)
        : onlyTool.tool === 'canvas' && canvasInfo
          ? fallbackAnswer(steps, researchText, buildInfo, canvasInfo)
          : ''
    : ''
  let answer = ''
  let answerModel: string | undefined
  let fellBack = false
  if (direct.trim()) {
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
          researchText,
        }),
      )
      answer = written.text
      answerModel = written.model
      addModels([answerModel])
    } catch (error) {
      if (input.signal?.aborted) throw abortError()
      answer = fallbackAnswer(steps, researchText, buildInfo, canvasInfo)
      fellBack = true
    }
  }
  if (!answer.trim()) {
    answer = fallbackAnswer(steps, researchText, buildInfo, canvasInfo)
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

  agent.status = failed || fellBack ? 'partial' : 'done'
  agent.receipt = buildAgentReceipt({
    status: agent.status,
    steps,
    startedAt,
    finishedAt: Date.now(),
  })
  agent.reason = failed
    ? `${failed} step${failed === 1 ? '' : 's'} did not finish`
    : fellBack
      ? 'a free model was unavailable to write the final answer'
      : undefined
  const final = await emit()

  return {
    text: answer.trim(),
    agent: final,
    ...(researchInfo ? { research: researchInfo } : {}),
    ...(buildInfo ? { build: buildInfo } : {}),
    ...(canvasInfo ? { canvas: canvasInfo } : {}),
    sources,
  }
}
