import type { BuildInfo } from '../../shared/types'

export type BuffyBuildReceipt = {
  status: 'verified' | 'warning'
  title: string
  pages: string[]
  models: string[]
  checks: { id: string; label: string; status: 'pass' | 'warn' | 'fail' }[]
  asOf: number
}

export type BuffyBrief = {
  goal: string
  notes: string[]
  files: string[]
  checks: string[]
  /** A plan imported from another conversation, kept when the source chat is not here. */
  plan?: string
  /** The most recent build handed back from Buffy Code. */
  build?: BuffyBuildReceipt
}

type BriefHandoffMessage = { role: 'user' | 'assistant'; content: string }
type BriefSourceMessage = BriefHandoffMessage & { attachments?: { name: string }[]; files?: { name: string }[] }

export type BriefReadiness = { ready: boolean; missing: string[]; plan: string }

export type BriefSnapshot = { id: string; at: number; brief: BuffyBrief }

const MAX_HANDOFF_CHARS = 12_000
const MAX_PLAN_CHARS = 6_000
const MAX_RECEIPT_CHECKS = 12
const MAX_BRIEF_HISTORY = 6

/**
 * The latest assistant reply is the plan Buffy Code should build from. Keep it
 * separate from pinned notes so pinning a decision never replaces the plan.
 */
export function latestBriefPlan(messages: readonly BriefHandoffMessage[]): string {
  return [...messages]
    .reverse()
    .find((message) => message.role === 'assistant' && message.content.trim())
    ?.content.trim()
    .slice(0, MAX_PLAN_CHARS) ?? ''
}

/**
 * Seed a blank brief goal from the first real user request in an existing
 * conversation. A non-empty saved goal is the person's edit and wins.
 */
export function seedBriefGoal(brief: BuffyBrief, messages: readonly BriefHandoffMessage[]): BuffyBrief {
  if (brief.goal.trim()) return brief
  const firstRequest = messages.find((message) => message.role === 'user' && message.content.trim())
  return firstRequest ? { ...brief, goal: firstRequest.content.trim().slice(0, 800) } : brief
}

/** What still stands between this brief and a useful build. */
export function briefReadiness(brief: BuffyBrief, messages: readonly BriefHandoffMessage[]): BriefReadiness {
  // A live conversation is newer than a plan imported from Chat. The imported
  // plan is the fallback for a brief that has no messages here.
  const plan = latestBriefPlan(messages) || brief.plan?.trim() || ''
  const missing: string[] = []
  if (!brief.goal.trim()) missing.push('Add a goal.')
  if (!plan) missing.push('Get a plan from Buffy.')
  if (!brief.checks.length) missing.push('Add at least one acceptance check.')
  return { ready: missing.length === 0, missing, plan }
}

/** Build the prompt passed from the Buffy brief to the Buffy Code workspace. */
export function briefHandoff(brief: BuffyBrief, messages: readonly BriefHandoffMessage[]): string {
  const plan = latestBriefPlan(messages) || brief.plan?.trim() || ''
  const notes = brief.notes.map((note) => note.trim()).filter(Boolean)
  const checks = brief.checks.map((check) => check.trim()).filter(Boolean)
  const files = brief.files.map((file) => file.trim()).filter(Boolean)
  const sections = [
    ['Build this from the Buffy brief.', `Goal: ${brief.goal.trim() || 'Use the plan below.'}`].join('\n'),
    plan ? `Plan:\n${plan}` : '',
    notes.length ? `Pinned decisions:\n${notes.map((note) => `- ${note}`).join('\n')}` : '',
    checks.length ? `Acceptance checks:\n${checks.map((check) => `- ${check}`).join('\n')}` : '',
    files.length ? `Context files: ${files.join(', ')}` : '',
  ].filter(Boolean)
  // The plan comes before notes and files so the final length cap can never
  // remove it on a brief with many pinned decisions.
  return sections.join('\n\n').slice(0, MAX_HANDOFF_CHARS)
}

/** Turn a finished Buffy Code build into the small receipt the brief keeps. */
export function receiptFromBuild(build: BuildInfo): BuffyBuildReceipt {
  const verification = build.verification
  const pages = build.pages?.length ? build.pages.map((page) => page.name) : ['index.html']
  return {
    status: verification?.status ?? (build.status === 'ready' ? 'verified' : 'warning'),
    title: build.title.trim().slice(0, 120) || 'Buffy build',
    pages: pages.slice(0, 12),
    models: build.models.slice(0, 6),
    checks: (verification?.checks ?? []).slice(0, MAX_RECEIPT_CHECKS).map((check) => ({
      id: check.id,
      label: check.label,
      status: check.status,
    })),
    asOf: verification?.asOf ?? build.asOf ?? Date.now(),
  }
}

/** Validate a receipt before it is stored in the brief or read from a route. */
export function readBuildReceipt(value: unknown): BuffyBuildReceipt | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Partial<BuffyBuildReceipt>
  if (raw.status !== 'verified' && raw.status !== 'warning') return null
  if (typeof raw.title !== 'string') return null
  const checks = Array.isArray(raw.checks)
    ? raw.checks
        .filter((check): check is { id: string; label: string; status: 'pass' | 'warn' | 'fail' } =>
          Boolean(check) &&
          typeof check === 'object' &&
          typeof (check as { id?: unknown }).id === 'string' &&
          typeof (check as { label?: unknown }).label === 'string' &&
          ((check as { status?: unknown }).status === 'pass' ||
            (check as { status?: unknown }).status === 'warn' ||
            (check as { status?: unknown }).status === 'fail'),
        )
        .slice(0, MAX_RECEIPT_CHECKS)
    : []
  return {
    status: raw.status,
    title: raw.title.trim().slice(0, 120) || 'Buffy build',
    pages: Array.isArray(raw.pages) ? raw.pages.filter((page): page is string => typeof page === 'string').slice(0, 12) : [],
    models: Array.isArray(raw.models) ? raw.models.filter((model): model is string => typeof model === 'string').slice(0, 6) : [],
    checks,
    asOf: typeof raw.asOf === 'number' && Number.isFinite(raw.asOf) ? raw.asOf : Date.now(),
  }
}

/** Read a saved or imported brief without trusting local storage or route state. */
export function readBriefDraft(value: unknown): BuffyBrief | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Partial<BuffyBrief>
  const strings = (items: unknown): string[] =>
    Array.isArray(items) ? items.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())) : []
  const receipt = readBuildReceipt(raw.build)
  return {
    goal: typeof raw.goal === 'string' ? raw.goal.slice(0, 800) : '',
    notes: strings(raw.notes).slice(0, 8),
    files: strings(raw.files).slice(0, 12),
    checks: strings(raw.checks).slice(0, 8),
    ...(typeof raw.plan === 'string' && raw.plan.trim() ? { plan: raw.plan.trim().slice(0, MAX_PLAN_CHARS) } : {}),
    ...(receipt ? { build: receipt } : {}),
  }
}

/** Read locally saved brief snapshots without trusting their stored shape. */
export function readBriefHistory(value: unknown): BriefSnapshot[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item): BriefSnapshot | null => {
      if (!item || typeof item !== 'object') return null
      const raw = item as { id?: unknown; at?: unknown; brief?: unknown }
      const brief = readBriefDraft(raw.brief)
      if (!brief || (!brief.goal.trim() && !brief.plan && !brief.checks.length)) return null
      return {
        id: typeof raw.id === 'string' ? raw.id.slice(0, 80) : `brief-${Math.random().toString(36).slice(2, 10)}`,
        at: typeof raw.at === 'number' && Number.isFinite(raw.at) ? raw.at : Date.now(),
        brief,
      }
    })
    .filter((item): item is BriefSnapshot => item !== null)
    .slice(0, MAX_BRIEF_HISTORY)
}

/** Keep the newest copy of a brief, without duplicating an unchanged one. */
export function rememberBrief(history: readonly BriefSnapshot[], brief: BuffyBrief): BriefSnapshot[] {
  const serialized = JSON.stringify(brief)
  const existing = history.find((item) => JSON.stringify(item.brief) === serialized)
  const next: BriefSnapshot = {
    id: existing?.id ?? `brief-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: Date.now(),
    brief,
  }
  return [next, ...history.filter((item) => item.id !== next.id)].slice(0, MAX_BRIEF_HISTORY)
}

/** Carry failed checks into the next build without losing the original brief. */
export function receiptHandoff(brief: BuffyBrief, receipt: BuffyBuildReceipt, messages: readonly BriefHandoffMessage[]): string {
  const failed = receipt.checks.filter((check) => check.status !== 'pass')
  if (!failed.length) {
    return `${briefHandoff(brief, messages)}\n\nPrevious build passed its page checks. Keep that working behavior.`.slice(
      0,
      MAX_HANDOFF_CHARS,
    )
  }
  const fixes = [
    `Previous build: ${receipt.title} (${receipt.status}).`,
    'Fix the checks that did not pass without regressing the decisions above.',
    `Failed checks:\n${failed.map((check) => `- ${check.label}`).join('\n')}`,
  ].join('\n')
  return `${briefHandoff(brief, messages)}\n\n${fixes}`.slice(0, MAX_HANDOFF_CHARS)
}

/**
 * Import the durable parts of an ordinary Chat conversation. The source
 * transcript stays in Chat; Buffy gets a goal, the latest plan and its files.
 */
export function briefFromConversation(messages: readonly BriefSourceMessage[]): BuffyBrief {
  const goal = messages.find((message) => message.role === 'user' && message.content.trim())?.content.trim() ?? ''
  const plan = latestBriefPlan(messages)
  const files = [
    ...new Set(
      messages
        .flatMap((message) => [
          ...(message.attachments?.map((file) => file.name) ?? []),
          ...(message.files?.map((file) => file.name) ?? []),
        ])
        .filter(Boolean),
    ),
  ].slice(0, 12)
  return {
    goal: goal.slice(0, 800),
    notes: [],
    files,
    checks: [],
    ...(plan ? { plan } : {}),
  }
}
