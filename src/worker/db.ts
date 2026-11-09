import type { MiddlewareHandler } from 'hono'

import type { AnalysisInfo, BuildInfo, CanvasInfo, Conversation, Message, Project, ProofCheck, ProofInfo, ResearchClaim, ResearchInfo, Source, TeamInfo } from '../shared/types'
import type { AppContext } from './env'

// Schema lives with the Worker: D1 has no migration tool on Freebuff Sites, so
// tables are created on the first request of each isolate. Add new statements
// at the end; never edit existing ones in place once deployed.
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    owner_sub TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    owner_sub TEXT NOT NULL,
    title TEXT NOT NULL,
    model TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS conversations_owner ON conversations(owner_sub, updated_at DESC)`,
  `CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    owner_sub TEXT NOT NULL,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    model TEXT,
    interrupted INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS messages_conversation ON messages(owner_sub, conversation_id, created_at)`,
  // The daily usage count: replies generated per owner per day.
  `CREATE INDEX IF NOT EXISTS messages_owner_role_created ON messages(owner_sub, role, created_at)`,
  // Reasoning is optional and kept separate so old message rows need no migration.
  `CREATE TABLE IF NOT EXISTS message_reasoning (
    message_id TEXT PRIMARY KEY,
    owner_sub TEXT NOT NULL,
    content TEXT NOT NULL,
    duration_ms INTEGER,
    created_at INTEGER NOT NULL
  )`,
  // Search results are optional and kept separate for the same reason.
  `CREATE TABLE IF NOT EXISTS message_sources (
    message_id TEXT PRIMARY KEY,
    owner_sub TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS message_feedback (
    message_id TEXT PRIMARY KEY,
    owner_sub TEXT NOT NULL,
    rating TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS user_settings (
    owner_sub TEXT PRIMARY KEY,
    instructions TEXT NOT NULL DEFAULT '',
    updated_at INTEGER NOT NULL
  )`,
  // One live share per conversation. The token is the only thing the public
  // route accepts; the raw conversation id never appears in a share URL.
  `CREATE TABLE IF NOT EXISTS conversation_shares (
    token TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL UNIQUE,
    owner_sub TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS conversation_shares_owner ON conversation_shares(owner_sub, conversation_id)`,
  // Older turns are folded into a rolling summary once they fall outside the
  // verbatim context window. covered_through is the timestamp of the newest
  // message already folded in, so each update only processes new old turns.
  `CREATE TABLE IF NOT EXISTS conversation_summaries (
    conversation_id TEXT PRIMARY KEY,
    owner_sub TEXT NOT NULL,
    summary TEXT NOT NULL,
    covered_through INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS conversation_summaries_owner ON conversation_summaries(owner_sub)`,
  // Pinning is a library preference, not a property of the artifact, so a pin
  // never rewrites the reply or its generated content.
  `CREATE TABLE IF NOT EXISTS pinned_artifacts (
    message_id TEXT PRIMARY KEY,
    owner_sub TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS pinned_artifacts_owner ON pinned_artifacts(owner_sub, created_at DESC)`,
  // Per-project instructions are kept apart from the project row so an edit
  // never touches its id, name or membership.
  `CREATE TABLE IF NOT EXISTS project_settings (
    project_id TEXT PRIMARY KEY,
    owner_sub TEXT NOT NULL,
    instructions TEXT NOT NULL DEFAULT '',
    updated_at INTEGER NOT NULL
  )`,
  // Projects group conversations without changing the conversation rows. The
  // join table keeps one chat in at most one project and survives schema
  // creation on existing deployments.
  `CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    owner_sub TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS projects_owner ON projects(owner_sub, updated_at DESC)`,
  `CREATE TABLE IF NOT EXISTS project_conversations (
    conversation_id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    owner_sub TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS project_conversations_project ON project_conversations(owner_sub, project_id)`,
  // Provider health outlives an isolate: the last known result drives the model
  // picker on a fresh load, and next_probe_at is the persisted backoff so a
  // failing provider is not hammered after a restart.
  `CREATE TABLE IF NOT EXISTS provider_health (
    owner_sub TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'unknown',
    last_success_at INTEGER,
    last_failure_at INTEGER,
    last_error TEXT,
    last_error_code TEXT,
    latency_ms INTEGER,
    consecutive_failures INTEGER NOT NULL DEFAULT 0,
    last_checked_at INTEGER,
    next_probe_at INTEGER,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (owner_sub, provider_id)
  )`,
  // The team's check is optional, like reasoning and sources, so existing
  // messages need no column migration.
  `CREATE TABLE IF NOT EXISTS message_team (
    message_id TEXT PRIMARY KEY,
    owner_sub TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  // Proof keeps the user-visible check list and, while code is being checked
  // in the browser, the pending run job. Like reasoning and sources it is
  // optional, so existing message rows need no migration.
  `CREATE TABLE IF NOT EXISTS message_proof (
    message_id TEXT PRIMARY KEY,
    owner_sub TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  // One row per finished proof, for measured routing later. No message text.
  `CREATE TABLE IF NOT EXISTS proof_runs (
    id TEXT PRIMARY KEY,
    owner_sub TEXT NOT NULL,
    kind TEXT NOT NULL,
    outcome TEXT NOT NULL,
    models TEXT NOT NULL,
    checks TEXT NOT NULL,
    mutants_killed INTEGER NOT NULL DEFAULT 0,
    mutants_total INTEGER NOT NULL DEFAULT 0,
    attempts INTEGER NOT NULL DEFAULT 1,
    latency_ms INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS proof_runs_owner ON proof_runs(owner_sub, created_at DESC)`,
  // Verified artifacts and check recipes. Per owner: retrieving another
  // person's answer would leak their conversation.
  `CREATE TABLE IF NOT EXISTS proof_library (
    id TEXT PRIMARY KEY,
    owner_sub TEXT NOT NULL,
    signature TEXT NOT NULL,
    kind TEXT NOT NULL,
    content TEXT NOT NULL,
    successes INTEGER NOT NULL DEFAULT 1,
    failures INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS proof_library_owner ON proof_library(owner_sub, kind, updated_at DESC)`,
  // Attachment bytes live beside their message. Images are served from a
  // separate owner-checked route, so conversation reads stay small.
  `CREATE TABLE IF NOT EXISTS message_attachments (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL,
    conversation_id TEXT NOT NULL,
    owner_sub TEXT NOT NULL,
    name TEXT NOT NULL,
    mime TEXT NOT NULL,
    size INTEGER NOT NULL,
    kind TEXT NOT NULL,
    data TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS message_attachments_message ON message_attachments(owner_sub, message_id, position)`,
  `CREATE INDEX IF NOT EXISTS message_attachments_conversation ON message_attachments(owner_sub, conversation_id)`,
  // Research keeps the citations, claims and source order beside the reply.
  `CREATE TABLE IF NOT EXISTS message_research (
    message_id TEXT PRIMARY KEY,
    owner_sub TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS message_research_owner_created ON message_research(owner_sub, created_at DESC)`,
  // One row per finished research run, for limits and measurement. No question
  // or report text is stored here.
  `CREATE TABLE IF NOT EXISTS research_runs (
    id TEXT PRIMARY KEY,
    owner_sub TEXT NOT NULL,
    outcome TEXT NOT NULL,
    sources INTEGER NOT NULL DEFAULT 0,
    supported INTEGER NOT NULL DEFAULT 0,
    single_source INTEGER NOT NULL DEFAULT 0,
    unsupported INTEGER NOT NULL DEFAULT 0,
    latency_ms INTEGER NOT NULL DEFAULT 0,
    models TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS research_runs_owner ON research_runs(owner_sub, created_at DESC)`,
  // Analyze keeps the code and browser-run output beside the reply. The job
  // lives here only while the sandbox is running; the result replaces it.
  `CREATE TABLE IF NOT EXISTS message_analysis (
    message_id TEXT PRIMARY KEY,
    owner_sub TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS message_analysis_owner_created ON message_analysis(owner_sub, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS message_build (
    message_id TEXT PRIMARY KEY,
    owner_sub TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS message_build_owner_created ON message_build(owner_sub, created_at DESC)`,
  // Canvas keeps a generated deck or quiz beside the reply.
  `CREATE TABLE IF NOT EXISTS message_canvas (
    message_id TEXT PRIMARY KEY,
    owner_sub TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS message_canvas_owner_created ON message_canvas(owner_sub, created_at DESC)`,
  // A live-site build gets a public capability token so its sandboxed iframe
  // can load without exposing the signed-in app's cookies to the proxy.
  `CREATE TABLE IF NOT EXISTS build_embeds (
    token TEXT PRIMARY KEY,
    message_id TEXT NOT NULL,
    owner_sub TEXT NOT NULL,
    url TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS build_embeds_owner ON build_embeds(owner_sub, created_at DESC)`,
  // Smart Review keeps one schedule row per saved flashcard. The card text
  // stays in message_canvas; this table only maps a stable message/card index
  // to its next due date. No model call is involved in scheduling.
  `CREATE TABLE IF NOT EXISTS canvas_reviews (
    owner_sub TEXT NOT NULL,
    message_id TEXT NOT NULL,
    card_index INTEGER NOT NULL,
    due_at INTEGER NOT NULL,
    interval_days REAL NOT NULL DEFAULT 0,
    ease REAL NOT NULL DEFAULT 2.5,
    repetitions INTEGER NOT NULL DEFAULT 0,
    lapses INTEGER NOT NULL DEFAULT 0,
    last_rating TEXT,
    last_reviewed_at INTEGER,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (owner_sub, message_id, card_index)
  )`,
  `CREATE INDEX IF NOT EXISTS canvas_reviews_owner_due ON canvas_reviews(owner_sub, due_at)`,
]

let ready: Promise<void> | undefined

export function ensureSchema(db: D1Database): Promise<void> {
  ready ??= db.batch(SCHEMA.map((sql) => db.prepare(sql))).then(
    () => undefined,
    (error) => {
      ready = undefined
      throw error
    },
  )
  return ready
}

export const requireDb: MiddlewareHandler<AppContext> = async (c, next) => {
  const db = c.env.DB
  if (!db) {
    return c.json({ error: 'database_missing', message: 'No database is attached yet. Add D1 storage named DB and redeploy.' }, 503)
  }
  await ensureSchema(db)
  c.set('db', db)
  await next()
}

export const id = () => crypto.randomUUID()
export const now = () => Date.now()

type Row = Record<string, unknown>

export function mapConversation(r: Row): Conversation {
  return {
    id: r.id as string,
    title: r.title as string,
    model: r.model as string,
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
    projectId: typeof r.project_id === 'string' ? r.project_id : null,
  }
}

export function mapProject(r: Row): Project {
  return {
    id: r.id as string,
    name: r.name as string,
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
    conversationCount: Number(r.conversation_count ?? 0),
  }
}

function parseSources(value: unknown): Source[] | undefined {
  if (typeof value !== 'string' || !value) return undefined
  try {
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed)) return undefined
    const sources = parsed.flatMap((item) => {
      if (!item || typeof item !== 'object') return []
      const { title, url, snippet, publishedAt } = item as { title?: unknown; url?: unknown; snippet?: unknown; publishedAt?: unknown }
      if (typeof title !== 'string' || typeof url !== 'string') return []
      return [{
        title,
        url,
        ...(typeof snippet === 'string' ? { snippet } : {}),
        ...(typeof publishedAt === 'number' && Number.isFinite(publishedAt) ? { publishedAt } : {}),
      }]
    })
    return sources.length ? sources.slice(0, 8) : undefined
  } catch {
    return undefined
  }
}

function parseTeam(value: unknown): TeamInfo | undefined {
  if (typeof value !== 'string' || !value) return undefined
  try {
    const parsed = JSON.parse(value) as {
      models?: unknown
      drafts?: unknown
      reviewed?: unknown
      drafters?: unknown
      referee?: unknown
      verifier?: unknown
      verified?: unknown
      repaired?: unknown
      confidence?: unknown
    }
    if (!Array.isArray(parsed.models)) return undefined
    const models = parsed.models
      .filter((model): model is string => typeof model === 'string' && Boolean(model.trim()))
      .map((model) => model.trim())
      .slice(0, 6)
    if (!models.length) return undefined
    const cleanLabel = (label: unknown) => (typeof label === 'string' && label.trim() ? label.trim().slice(0, 80) : undefined)
    const drafters = Array.isArray(parsed.drafters)
      ? parsed.drafters.filter((label): label is string => typeof label === 'string' && Boolean(label.trim())).map((label) => label.trim().slice(0, 80)).slice(0, 3)
      : []
    const referee = cleanLabel(parsed.referee)
    const verifier = cleanLabel(parsed.verifier)
    const confidence = parsed.confidence === 'high' || parsed.confidence === 'medium' || parsed.confidence === 'low' ? parsed.confidence : 'low'
    const drafts = typeof parsed.drafts === 'number' && Number.isFinite(parsed.drafts) ? Math.min(4, Math.max(1, Math.floor(parsed.drafts))) : models.length
    return {
      models,
      drafts,
      reviewed: parsed.reviewed === true,
      confidence,
      ...(drafters.length ? { drafters } : {}),
      ...(referee ? { referee } : {}),
      ...(verifier ? { verifier } : {}),
      ...(parsed.verified === true ? { verified: true } : {}),
      ...(parsed.repaired === true ? { repaired: true } : {}),
    }
  } catch {
    return undefined
  }
}

function parseProof(value: unknown): ProofInfo | undefined {
  if (typeof value !== 'string' || !value) return undefined
  try {
    const parsed = JSON.parse(value) as { info?: Record<string, unknown> }
    const info = parsed?.info
    if (!info || typeof info !== 'object') return undefined
    const status = info.status
    const kind = info.kind
    if (status !== 'checking' && status !== 'verified' && status !== 'warning' && status !== 'failed' && status !== 'unverified') return undefined
    if (kind !== 'code' && kind !== 'math' && kind !== 'research' && kind !== 'structured' && kind !== 'general') return undefined
    const checks: ProofCheck[] = Array.isArray(info.checks)
      ? info.checks.map((check) => {
          if (!check || typeof check !== 'object') return null
          const row = check as Record<string, unknown>
          if (typeof row.id !== 'string' || typeof row.label !== 'string') return null
          const state: ProofCheck['status'] | null =
            row.status === 'pass' || row.status === 'fail' || row.status === 'unknown' ? row.status : null
          if (!state) return null
          return {
            id: row.id.slice(0, 80),
            label: row.label.slice(0, 160),
            status: state,
            critical: row.critical === true,
            ...(typeof row.detail === 'string' && row.detail ? { detail: row.detail.slice(0, 300) } : {}),
          }
        }).filter((check): check is ProofCheck => check !== null).slice(0, 12)
      : []
    const models = Array.isArray(info.models)
      ? info.models.filter((model): model is string => typeof model === 'string' && Boolean(model.trim())).map((model) => model.trim().slice(0, 80)).slice(0, 6)
      : []
    const rawMutants = (info.mutants ?? null) as { total?: unknown; killed?: unknown } | null
    const mutants = rawMutants && typeof rawMutants.total === 'number' && typeof rawMutants.killed === 'number'
      ? { total: Math.max(0, Math.min(8, Math.floor(rawMutants.total))), killed: Math.max(0, Math.min(8, Math.floor(rawMutants.killed))) }
      : null
    const asOf = Number.isFinite(Number(info.asOf)) ? Number(info.asOf) : Date.now()
    // A tab that closed before the browser runner reported leaves the record
    // checking. It must visibly decay; it never becomes a pass.
    const stale = status === 'checking' && Date.now() - asOf > 15 * 60_000
    return {
      status: stale ? 'unverified' : status,
      kind,
      checks,
      attempts: Math.max(1, Math.min(4, Math.floor(Number(info.attempts) || 1))),
      candidates: Math.max(1, Math.min(4, Math.floor(Number(info.candidates) || 1))),
      mutants,
      models,
      asOf,
      ...(stale
        ? { reason: 'the code check did not finish' }
        : typeof info.reason === 'string' && info.reason
          ? { reason: info.reason.slice(0, 160) }
          : {}),
    }
  } catch {
    return undefined
  }
}

function parseResearch(value: unknown): ResearchInfo | undefined {
  if (typeof value !== 'string' || !value) return undefined
  try {
    const parsed = JSON.parse(value) as { info?: Record<string, unknown> }
    const info = parsed?.info
    if (!info || typeof info !== 'object') return undefined
    const status = info.status
    if (status !== 'checking' && status !== 'verified' && status !== 'warning' && status !== 'failed' && status !== 'unverified') return undefined
    const question = typeof info.question === 'string' ? info.question.trim().slice(0, 2_000) : ''
    if (!question) return undefined
    const queries = Array.isArray(info.queries)
      ? info.queries.filter((query): query is string => typeof query === 'string' && Boolean(query.trim())).map((query) => query.trim().slice(0, 160)).slice(0, 6)
      : []
    const sourceOrder = Array.isArray(info.sourceOrder)
      ? info.sourceOrder.filter((url): url is string => typeof url === 'string' && /^https?:\/\//i.test(url)).slice(0, 8)
      : []
    const claims: ResearchClaim[] = Array.isArray(info.claims)
      ? info.claims.flatMap((claim) => {
          if (!claim || typeof claim !== 'object') return []
          const row = claim as Record<string, unknown>
          if (typeof row.id !== 'string' || typeof row.text !== 'string') return []
          const claimStatus: ResearchClaim['status'] | null =
            row.status === 'supported' || row.status === 'single-source' || row.status === 'unsupported' ? row.status : null
          if (!claimStatus) return []
          const sourceUrls = Array.isArray(row.sourceUrls)
            ? row.sourceUrls.filter((url): url is string => typeof url === 'string' && /^https?:\/\//i.test(url)).slice(0, 5)
            : []
          return [{ id: row.id.slice(0, 40), text: row.text.trim().slice(0, 500), sourceUrls, status: claimStatus }]
        }).slice(0, 8)
      : []
    const counts = info.counts && typeof info.counts === 'object' ? (info.counts as Record<string, unknown>) : {}
    const models = Array.isArray(info.models)
      ? info.models.filter((model): model is string => typeof model === 'string' && Boolean(model.trim())).map((model) => model.trim().slice(0, 80)).slice(0, 4)
      : []
    const asOf = Number.isFinite(Number(info.asOf)) ? Number(info.asOf) : Date.now()
    return {
      status,
      question,
      queries,
      sourceOrder,
      claims,
      counts: {
        sources: Math.max(0, Math.min(12, Math.floor(Number(counts.sources) || sourceOrder.length))),
        supported: claims.filter((claim) => claim.status === 'supported').length,
        singleSource: claims.filter((claim) => claim.status === 'single-source').length,
        unsupported: claims.filter((claim) => claim.status === 'unsupported').length,
        conflicts: Math.max(0, Math.min(12, Math.floor(Number(counts.conflicts) || 0))),
      },
      models,
      asOf,
      ...(typeof info.reason === 'string' && info.reason ? { reason: info.reason.slice(0, 200) } : {}),
    }
  } catch {
    return undefined
  }
}

export function parseAnalysis(value: unknown): AnalysisInfo | undefined {
  if (typeof value !== 'string' || !value) return undefined
  try {
    const parsed = JSON.parse(value) as { info?: Record<string, unknown> }
    const info = parsed?.info
    if (!info || typeof info !== 'object') return undefined
    const status = info.status
    if (status !== 'checking' && status !== 'verified' && status !== 'warning' && status !== 'failed' && status !== 'unverified') return undefined
    const question = typeof info.question === 'string' ? info.question.trim().slice(0, 2_000) : ''
    const datasetId = typeof info.datasetId === 'string' ? info.datasetId.slice(0, 80) : ''
    const fileName = typeof info.fileName === 'string' ? info.fileName.trim().slice(0, 180) : ''
    const code = typeof info.code === 'string' ? info.code.slice(0, 8_000) : ''
    if (!question || !datasetId || !fileName || !code.trim()) return undefined
    const columns = Array.isArray(info.columns)
      ? info.columns.filter((column): column is string => typeof column === 'string' && Boolean(column.trim())).map((column) => column.trim().slice(0, 120)).slice(0, 60)
      : []
    const models = Array.isArray(info.models)
      ? info.models.filter((model): model is string => typeof model === 'string' && Boolean(model.trim())).map((model) => model.trim().slice(0, 80)).slice(0, 4)
      : []
    const stdout = typeof info.stdout === 'string' ? info.stdout.slice(0, 12_000) : undefined
    const chart = typeof info.chart === 'string' && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(info.chart) && info.chart.length <= 200_000 ? info.chart : undefined
    const error = typeof info.error === 'string' && info.error ? info.error.slice(0, 500) : undefined
    const asOf = Number.isFinite(Number(info.asOf)) ? Number(info.asOf) : Date.now()
    // A closed tab leaves the run checking. It must decay rather than ever
    // looking like a successful execution.
    const stale = status === 'checking' && Date.now() - asOf > 10 * 60_000
    return {
      status: stale ? 'unverified' : status,
      question,
      datasetId,
      fileName,
      code,
      ...(stdout ? { stdout } : {}),
      ...(chart ? { chart } : {}),
      ...(error ? { error } : {}),
      rows: Math.max(0, Math.min(100_000_000, Math.floor(Number(info.rows) || 0))),
      columns,
      models,
      asOf,
      ...(stale
        ? { reason: 'the Python run did not finish' }
        : typeof info.reason === 'string' && info.reason
          ? { reason: info.reason.slice(0, 200) }
          : {}),
    }
  } catch {
    return undefined
  }
}

export function parseCanvas(value: unknown): CanvasInfo | undefined {
  if (typeof value !== 'string' || !value) return undefined
  try {
    const parsed = JSON.parse(value) as { info?: Record<string, unknown> }
    const info = parsed?.info
    if (!info || typeof info !== 'object') return undefined
    if (info.status !== 'ready' && info.status !== 'warning') return undefined
    if (info.kind !== 'flashcards' && info.kind !== 'quiz') return undefined
    const title = typeof info.title === 'string' ? info.title.replace(/\s+/g, ' ').trim().slice(0, 120) : ''
    if (!title) return undefined
    const cards = Array.isArray(info.cards)
      ? info.cards.flatMap((card) => {
          if (!card || typeof card !== 'object') return []
          const row = card as Record<string, unknown>
          const front = typeof row.front === 'string' ? row.front.trim().slice(0, 240) : ''
          const back = typeof row.back === 'string' ? row.back.trim().slice(0, 500) : ''
          return front && back ? [{ front, back }] : []
        }).slice(0, 24)
      : []
    const questions = Array.isArray(info.questions)
      ? info.questions.flatMap((question) => {
          if (!question || typeof question !== 'object') return []
          const row = question as Record<string, unknown>
          const text = typeof row.question === 'string' ? row.question.trim().slice(0, 400) : ''
          const choices = Array.isArray(row.choices)
            ? row.choices.filter((choice): choice is string => typeof choice === 'string' && Boolean(choice.trim())).map((choice) => choice.trim().slice(0, 200)).slice(0, 4)
            : []
          const answer = Number(row.answer)
          if (!text || choices.length < 2 || !Number.isInteger(answer) || answer < 0 || answer >= choices.length) return []
          const explanation = typeof row.explanation === 'string' ? row.explanation.trim().slice(0, 400) : ''
          return [{ question: text, choices, answer, ...(explanation ? { explanation } : {}) }]
        }).slice(0, 10)
      : []
    if (info.kind === 'flashcards' ? !cards.length : !questions.length) return undefined
    const models = Array.isArray(info.models)
      ? info.models.filter((model): model is string => typeof model === 'string' && Boolean(model.trim())).map((model) => model.trim().slice(0, 80)).slice(0, 4)
      : []
    return {
      status: info.status,
      kind: info.kind,
      title,
      ...(cards.length ? { cards } : {}),
      ...(questions.length ? { questions } : {}),
      models,
      asOf: Number.isFinite(Number(info.asOf)) ? Number(info.asOf) : Date.now(),
      ...(typeof info.reason === 'string' && info.reason ? { reason: info.reason.slice(0, 200) } : {}),
    }
  } catch {
    return undefined
  }
}

export function parseBuild(value: unknown): BuildInfo | undefined {
  if (typeof value !== 'string' || !value) return undefined
  try {
    const parsed = JSON.parse(value) as { info?: Record<string, unknown> }
    const info = parsed?.info
    if (!info || typeof info !== 'object') return undefined
    if (info.status !== 'ready' && info.status !== 'warning') return undefined
    const html = typeof info.html === 'string' ? info.html.slice(0, 80_000) : ''
    const title = typeof info.title === 'string' && info.title.trim() ? info.title.trim().slice(0, 120) : 'Built page'
    if (!html.trim()) return undefined
    const kind = info.kind === 'embed' ? 'embed' : 'page'
    let sourceUrl: string | undefined
    if (typeof info.sourceUrl === 'string') {
      try {
        const url = new URL(info.sourceUrl)
        if (url.protocol === 'http:' || url.protocol === 'https:') sourceUrl = url.href
      } catch {
        /* not a usable source URL */
      }
    }
    const proxyUrl =
      typeof info.proxyUrl === 'string' && /^\/api\/web-proxy\/[a-f0-9]{48}$/.test(info.proxyUrl)
        ? info.proxyUrl
        : undefined
    if (kind === 'embed' && (!sourceUrl || !proxyUrl)) return undefined
    const pages = (kind === 'page' && Array.isArray(info.pages) ? info.pages : [])
      .flatMap((item) => {
        if (!item || typeof item !== 'object') return []
        const entry = item as { name?: unknown; html?: unknown }
        if (typeof entry.html !== 'string' || !entry.html.trim()) return []
        const name = typeof entry.name === 'string' && entry.name.trim() ? entry.name.trim().slice(0, 60) : 'page.html'
        return [{ name, html: entry.html.slice(0, 60_000) }]
      })
      .slice(0, 4)
    const models = Array.isArray(info.models)
      ? info.models.filter((model): model is string => typeof model === 'string' && Boolean(model.trim())).map((model) => model.trim().slice(0, 80)).slice(0, 4)
      : []
    return {
      status: info.status,
      kind,
      title,
      html,
      ...(sourceUrl ? { sourceUrl } : {}),
      ...(proxyUrl ? { proxyUrl } : {}),
      ...(pages.length > 1 ? { pages } : {}),
      models,
      asOf: Number.isFinite(Number(info.asOf)) ? Number(info.asOf) : Date.now(),
      ...(typeof info.reason === 'string' && info.reason ? { reason: info.reason.slice(0, 200) } : {}),
    }
  } catch {
    return undefined
  }
}

export function mapMessage(r: Row): Message {
  return {
    id: r.id as string,
    conversationId: r.conversation_id as string,
    role: r.role as Message['role'],
    content: r.content as string,
    model: (r.model as string | null) ?? null,
    interrupted: Boolean(r.interrupted),
    createdAt: Number(r.created_at),
    reasoning: typeof r.reasoning === 'string' && r.reasoning ? r.reasoning : undefined,
    reasoningMs: typeof r.reasoning_ms === 'number' ? r.reasoning_ms : undefined,
    sources: parseSources(r.sources),
    team: parseTeam(r.team),
    proof: parseProof(r.proof),
    research: parseResearch(r.research),
    analysis: parseAnalysis(r.analysis),
    build: parseBuild(r.build),
    canvas: parseCanvas(r.canvas),
    feedback: r.feedback === 'up' ? 'up' : r.feedback === 'down' ? 'down' : undefined,
  }
}

/** Midnight UTC that started the current day, and the next one. */
export function utcDay(at = now()): { start: number; end: number } {
  const start = new Date(at)
  start.setUTCHours(0, 0, 0, 0)
  return { start: start.getTime(), end: start.getTime() + 86_400_000 }
}

/**
 * Replies generated today, including ones still streaming and ones the user
 * stopped: each one spent API credits. Regenerating counts; a request the API
 * refused does not.
 */
export async function repliesToday(db: D1Database, owner: string): Promise<number> {
  const { start } = utcDay()
  const row = await db
    .prepare(`SELECT COUNT(*) AS n FROM messages WHERE owner_sub = ? AND role = 'assistant' AND created_at >= ?`)
    .bind(owner, start)
    .first<{ n: number }>()
  return Number(row?.n ?? 0)
}

/** Completed research reports today, used for the separate 3/day cap. */
export async function researchToday(db: D1Database, owner: string): Promise<number> {
  const { start } = utcDay()
  const row = await db
    .prepare(`SELECT COUNT(*) AS n FROM message_research WHERE owner_sub = ? AND created_at >= ?`)
    .bind(owner, start)
    .first<{ n: number }>()
  return Number(row?.n ?? 0)
}

/** Analyses today, used for the separate small cap. */
export async function analysisToday(db: D1Database, owner: string): Promise<number> {
  const { start } = utcDay()
  const row = await db
    .prepare(`SELECT COUNT(*) AS n FROM message_analysis WHERE owner_sub = ? AND created_at >= ?`)
    .bind(owner, start)
    .first<{ n: number }>()
  return Number(row?.n ?? 0)
}

/** Built pages today, used for the separate small cap. */
export async function buildToday(db: D1Database, owner: string): Promise<number> {
  const { start } = utcDay()
  const row = await db
    .prepare(`SELECT COUNT(*) AS n FROM message_build WHERE owner_sub = ? AND created_at >= ?`)
    .bind(owner, start)
    .first<{ n: number }>()
  return Number(row?.n ?? 0)
}

/**
 * Every free-mode counter for today in one statement. The D1 session used by
 * workerd rejects several statements in a request, so this is deliberately a
 * single query with sub-selects rather than four round trips.
 */
export async function usageToday(
  db: D1Database,
  owner: string,
): Promise<{ replies: number; research: number; analyze: number; build: number }> {
  const { start } = utcDay()
  const row = await db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM messages WHERE owner_sub = ? AND role = 'assistant' AND created_at >= ?) AS replies,
         (SELECT COUNT(*) FROM message_research WHERE owner_sub = ? AND created_at >= ?) AS research,
         (SELECT COUNT(*) FROM message_analysis WHERE owner_sub = ? AND created_at >= ?) AS analyze,
         (SELECT COUNT(*) FROM message_build WHERE owner_sub = ? AND created_at >= ?) AS build`,
    )
    .bind(owner, start, owner, start, owner, start, owner, start)
    .first<{ replies: number; research: number; analyze: number; build: number }>()
  return {
    replies: Number(row?.replies ?? 0),
    research: Number(row?.research ?? 0),
    analyze: Number(row?.analyze ?? 0),
    build: Number(row?.build ?? 0),
  }
}

/** A conversation title from its first message: the first line, cut at a word. */
export function titleFrom(content: string): string {
  const line = content.trim().split(/\r?\n/)[0]?.replace(/\s+/g, ' ').trim() ?? ''
  if (line.length <= 48) return line || 'New chat'
  const cut = line.slice(0, 48)
  const space = cut.lastIndexOf(' ')
  return `${(space > 24 ? cut.slice(0, space) : cut).replace(/[\s,.;:!?-]+$/, '')}…`
}
