// Pure Agent helpers shared by the Worker and the tests. The planner's reply
// is untrusted model output, so it is parsed into a small, bounded plan here;
// the run's user-facing receipt is built here too.

import { AGENT_MAX_STEPS, AGENT_MAX_TOOL_STEPS } from './config'
import type { AgentInfo, AgentStep, AgentTool } from './types'

export type AgentPlanStep = Pick<AgentStep, 'tool' | 'title' | 'instruction'>

const DEFAULT_TITLES: Record<AgentTool, string> = {
  research: 'Research the web',
  build: 'Build the artifact',
  canvas: 'Make a study set',
  answer: 'Write the answer',
}

const TOOL_LABELS: Record<AgentTool, string> = {
  research: 'Research',
  build: 'Build',
  canvas: 'Study',
  answer: 'Answer',
}

export function agentToolLabel(tool: AgentTool): string {
  return TOOL_LABELS[tool]
}

const clean = (value: unknown, max: number) =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : ''

// A lane can answer HTTP 200 with its quota notice in the content. That is not
// an answer: the Agent skips that lane and tries the next one. Kept narrow so
// a real answer about quotas is not mistaken for one.
const PROVIDER_LIMIT =
  /(?:prevent abuse of free resources|free quota after recharging|console\.aihubmix\.com\/topup|accounts that have not been recharged|exceeded your current quota|check your plan and billing|(?:daily|free|monthly) quota (?:has been |was )?(?:exceeded|exhausted))/i

export function isProviderLimitText(text: string): boolean {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length < 800 && PROVIDER_LIMIT.test(clean)
}

function jsonBody(raw: string): Record<string, unknown> | undefined {
  const fenced = /```(?:json)?[ \t]*\n([\s\S]*?)```/i.exec(raw)?.[1]
  const text = (fenced ?? raw).trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return undefined
  try {
    const parsed = JSON.parse(text.slice(start, end + 1)) as unknown
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : undefined
  } catch {
    return undefined
  }
}

/** One tool step per kind, then exactly one answer step, within the cap. */
export function normalizeAgentPlan(plan: AgentPlanStep[]): AgentPlanStep[] {
  const tools: AgentPlanStep[] = []
  const seen = new Set<AgentTool>()
  for (const step of plan) {
    if (step.tool === 'answer' || seen.has(step.tool)) continue
    seen.add(step.tool)
    tools.push(step)
    if (tools.length >= AGENT_MAX_TOOL_STEPS) break
  }
  const answer = plan.find((step) => step.tool === 'answer')
  const steps = [
    ...tools,
    {
      tool: 'answer' as const,
      title: answer?.title || DEFAULT_TITLES.answer,
      instruction: answer?.instruction || 'Write the final answer to the goal using what the steps found.',
    },
  ]
  return steps.slice(0, AGENT_MAX_STEPS)
}

/** Parses a planner reply into a bounded plan, or undefined so a fallback runs. */
export function parseAgentPlan(raw: string): AgentPlanStep[] | undefined {
  const body = jsonBody(raw)
  if (!body) return undefined
  const rows = Array.isArray(body.steps) ? body.steps : Array.isArray(body.plan) ? body.plan : []
  const planned: AgentPlanStep[] = []
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const item = row as Record<string, unknown>
    const tool = item.tool
    if (tool !== 'research' && tool !== 'build' && tool !== 'canvas' && tool !== 'answer') continue
    const instruction = clean(item.instruction ?? item.task ?? item.prompt, 700)
    const title = clean(item.title ?? item.label, 80) || DEFAULT_TITLES[tool]
    if (tool !== 'answer' && !instruction) continue
    planned.push({ tool, title, instruction })
  }
  return planned.length ? normalizeAgentPlan(planned) : undefined
}

/**
 * The deterministic plan for a run. Clear requests route straight to the right
 * tool, so Agent never waits on a model just to decide what to do. Anything
 * else goes straight to the answer.
 */
export function fallbackAgentPlan(question: string): AgentPlanStep[] {
  const text = question.replace(/\s+/g, ' ').trim()
  const lower = text.toLowerCase()
  const wantsCanvas = /\b(flashcards?|quiz|practice questions|study set|memorize|memorise|revise)\b/.test(lower)
  const wantsBuild = /\b(build|make|create|design|code|develop|generate)\b[\s\S]{0,60}\b(page|site|website|web page|web app|game|tool|app|form|dashboard|landing page|html|calculator|tracker|proxy|server|api|endpoint|script|extension|clone)\b/.test(lower)
  const wantsResearch = /\b(research|sources?|citations?|latest|current|news|price|pricing|market|release date|who won|what happened|compare|according to)\b/.test(lower)
  // Research is only added before an artifact when the request asks for facts
  // that need looking up. "A bakery page with prices" should go straight to
  // Build; "the latest AI news page" should research first.
  const explicitResearch = /\b(research|sources?|citations?|latest|current|news|release date|who won|what happened|according to)\b/.test(lower)
  const artifact: AgentPlanStep | undefined = wantsCanvas
    ? { tool: 'canvas', title: 'Make a study set', instruction: text }
    : wantsBuild
      ? { tool: 'build', title: 'Build the page or tool', instruction: text }
      : undefined
  const steps: AgentPlanStep[] = []
  if (artifact) {
    if (explicitResearch) steps.push({ tool: 'research', title: 'Research the web', instruction: text })
    steps.push(artifact)
  } else if (wantsResearch) {
    steps.push({ tool: 'research', title: 'Research the web', instruction: text })
  }
  steps.push({
    tool: 'answer',
    title: 'Write the answer',
    instruction: 'Write the final answer to the goal using what the steps found.',
  })
  return steps
}

/** The artifact a request clearly asks to make, if any. */
export function artifactPlanStep(question: string): AgentPlanStep | undefined {
  return fallbackAgentPlan(question).find((step) => step.tool === 'build' || step.tool === 'canvas')
}

/**
 * A plan may answer a clear artifact request directly. If it did, put the
 * matching tool step back in front of the answer: "make a proxy" should build
 * something, not just describe one.
 */
export function ensureArtifactPlan(question: string, plan: AgentPlanStep[]): AgentPlanStep[] {
  const artifact = artifactPlanStep(question)
  if (!artifact) return plan
  // A direct "make me X" does not need a web report first. Research takes a
  // long time and can exhaust the lanes the build itself needs, so keep it only
  // when the request explicitly asks for sources or current information.
  const asksResearch = /\b(research|sources?|cite|citations?|latest|current|news|market|pricing|price|who won|what happened)\b/i.test(question)
  let tools = plan.filter((step) => step.tool !== 'answer')
  if (!asksResearch) tools = tools.filter((step) => step.tool !== 'research')
  if (!tools.some((step) => step.tool === artifact.tool)) tools = [artifact, ...tools]
  const answer = plan.find((step) => step.tool === 'answer')
  return normalizeAgentPlan([...tools, ...(answer ? [answer] : [])])
}

// A lane can answer with a status word, an apology, or a refusal instead of
// the answer. Those are not usable replies, especially when real tools ran.
const UNUSABLE_ANSWER =
  /^(?:sorry|i can'?t|i cannot|i'?m unable(?: to)?|i am unable(?: to)?|unable to|no|nope|running|please wait|one moment|thinking)[.!…]*$/i

export function isUsableAgentAnswer(text: string, substantive = false): boolean {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean) return false
  if (isProviderLimitText(clean)) return false
  if (UNUSABLE_ANSWER.test(clean)) return false
  // A run that used a real tool must explain what it produced, not return a stub.
  if (substantive && clean.length < 40) return false
  return true
}

/** A short, user-safe summary of what the run actually did. */
export function buildAgentReceipt(input: {
  status: AgentInfo['status']
  steps: AgentStep[]
  startedAt: number
  finishedAt: number
}): string {
  const tools = input.steps.filter((step) => step.tool !== 'answer')
  const done = tools.filter((step) => step.status === 'done')
  const failed = tools.filter((step) => step.status === 'failed')
  const skipped = tools.filter((step) => step.status === 'skipped')
  const head =
    input.status === 'partial' ? 'Run partly complete' : input.status === 'failed' ? 'Run failed' : 'Run complete'
  const parts: string[] = []
  if (tools.length) {
    parts.push(`${done.length}/${tools.length} tools ran`)
    for (const step of done) {
      if (step.detail) parts.push(`${agentToolLabel(step.tool)}: ${step.detail}`)
    }
    if (failed.length) parts.push(`${failed.length} failed`)
    if (skipped.length) parts.push(`${skipped.length} skipped`)
  } else {
    parts.push('Answered directly')
  }
  const seconds = Math.max(0, Math.round((input.finishedAt - input.startedAt) / 1000))
  parts.push(`${seconds}s`)
  return `${head} · ${parts.join(' · ')}`.slice(0, 400)
}
