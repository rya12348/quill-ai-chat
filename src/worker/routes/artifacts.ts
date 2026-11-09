import { Hono } from 'hono'

import { analysisMarkdown, artifactSlug, canvasMarkdown, researchMarkdown } from '../../shared/artifacts'
import { DEFAULT_MODEL } from '../../shared/config'
import type { AnalysisInfo, ArtifactKind, ArtifactStatus, ArtifactSummary, CanvasCard, CanvasQuestion, Source } from '../../shared/types'
import { privateJson } from '../auth'
import { id, now } from '../db'
import type { AppContext } from '../env'

export const artifacts = new Hono<AppContext>()

type ArtifactRow = {
  message_id: string
  conversation_id: string
  conversation_title: string
  project_id: string | null
  kind: string
  created_at: number
  title: string | null
  status: string | null
  variant: string | null
  question: string | null
  item_count: number | null
  row_count: number | null
  claim_count: number | null
  unsupported_count: number | null
  pinned: number | null
}

// The only tables a duplicate may copy into. Never interpolate a request value
// into a table name; this list is the whole allowlist.
const ARTIFACT_TABLES = ['message_build', 'message_canvas', 'message_research', 'message_analysis'] as const
type ArtifactTable = (typeof ARTIFACT_TABLES)[number]

function text(value: unknown, max = 180): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : ''
}

function statusFor(kind: ArtifactKind, value: unknown): ArtifactStatus {
  if (kind === 'analysis' || kind === 'research') {
    return value === 'checking' || value === 'verified' || value === 'warning' || value === 'failed' || value === 'unverified'
      ? value
      : 'unverified'
  }
  return value === 'warning' ? 'warning' : 'ready'
}

function summary(row: ArtifactRow): ArtifactSummary | undefined {
  if (row.kind !== 'build' && row.kind !== 'analysis' && row.kind !== 'canvas' && row.kind !== 'research') return undefined
  const kind = row.kind
  const title = text(row.title, 140) || text(row.conversation_title, 120)
  if (!title) return undefined
  const createdAt = Number(row.created_at)
  if (!Number.isFinite(createdAt)) return undefined
  let detail: string
  if (kind === 'build') {
    detail = row.variant === 'embed' ? 'Live site preview' : 'Generated page'
  } else if (kind === 'analysis') {
    const rows = Number(row.row_count)
    detail =
      [text(row.question, 120), Number.isFinite(rows) && rows > 0 ? `${Math.floor(rows).toLocaleString()} rows` : ''].filter(Boolean).join(' · ') ||
      'Spreadsheet analysis'
  } else if (kind === 'canvas') {
    const count = Number(row.item_count)
    const noun = row.variant === 'quiz' ? 'question' : 'card'
    detail = Number.isFinite(count) && count > 0 ? `${Math.floor(count)}-${noun} ${row.variant === 'quiz' ? 'quiz' : 'deck'}` : 'Study set'
  } else {
    const claims = Number(row.claim_count)
    const unsupported = Number(row.unsupported_count)
    detail =
      [
        Number.isFinite(claims) && claims > 0 ? `${Math.floor(claims)} claim${claims === 1 ? '' : 's'} checked` : 'Research report',
        Number.isFinite(unsupported) && unsupported > 0 ? `${Math.floor(unsupported)} unsupported` : '',
      ]
        .filter(Boolean)
        .join(' · ') || 'Research report'
  }
  return {
    messageId: String(row.message_id),
    conversationId: String(row.conversation_id),
    conversationTitle: text(row.conversation_title, 120) || 'Untitled chat',
    kind,
    title,
    detail,
    status: statusFor(kind, row.status),
    createdAt,
    pinned: Number(row.pinned) === 1,
    projectId: typeof row.project_id === 'string' ? row.project_id : null,
  }
}

/**
 * Generated work already lives beside its assistant message. This endpoint is
 * only an index over those rows: it never copies HTML or datasets, and it is
 * scoped to the signed-in owner in every branch of the union.
 */
artifacts.get('/', async (c) => {
  const owner = c.get('user').sub
  const rows = await c
    .get('db')
    .prepare(
      `SELECT u.*, (SELECT 1 FROM pinned_artifacts p WHERE p.message_id = u.message_id AND p.owner_sub = ?) AS pinned
       FROM (
         SELECT m.id AS message_id, m.conversation_id, c.title AS conversation_title, pc.project_id,
                'build' AS kind, mb.created_at AS created_at,
                json_extract(mb.content, '$.info.title') AS title,
                json_extract(mb.content, '$.info.status') AS status,
                json_extract(mb.content, '$.info.kind') AS variant,
                NULL AS question, NULL AS item_count, NULL AS row_count,
                NULL AS claim_count, NULL AS unsupported_count
         FROM message_build mb
         JOIN messages m ON m.id = mb.message_id AND m.owner_sub = mb.owner_sub
         JOIN conversations c ON c.id = m.conversation_id AND c.owner_sub = m.owner_sub
         LEFT JOIN project_conversations pc ON pc.conversation_id = m.conversation_id AND pc.owner_sub = m.owner_sub
         WHERE mb.owner_sub = ?
         UNION ALL
         SELECT m.id, m.conversation_id, c.title, pc.project_id,
                'analysis', ma.created_at,
                json_extract(ma.content, '$.info.fileName'),
                json_extract(ma.content, '$.info.status'),
                NULL,
                json_extract(ma.content, '$.info.question'),
                NULL,
                json_extract(ma.content, '$.info.rows'),
                NULL, NULL
         FROM message_analysis ma
         JOIN messages m ON m.id = ma.message_id AND m.owner_sub = ma.owner_sub
         JOIN conversations c ON c.id = m.conversation_id AND c.owner_sub = m.owner_sub
         LEFT JOIN project_conversations pc ON pc.conversation_id = m.conversation_id AND pc.owner_sub = m.owner_sub
         WHERE ma.owner_sub = ?
         UNION ALL
         SELECT m.id, m.conversation_id, c.title, pc.project_id,
                'canvas', mc.created_at,
                json_extract(mc.content, '$.info.title'),
                json_extract(mc.content, '$.info.status'),
                json_extract(mc.content, '$.info.kind'),
                NULL,
                CASE WHEN json_extract(mc.content, '$.info.kind') = 'quiz'
                  THEN json_array_length(json_extract(mc.content, '$.info.questions'))
                  ELSE json_array_length(json_extract(mc.content, '$.info.cards'))
                END,
                NULL, NULL, NULL
         FROM message_canvas mc
         JOIN messages m ON m.id = mc.message_id AND m.owner_sub = mc.owner_sub
         JOIN conversations c ON c.id = m.conversation_id AND c.owner_sub = m.owner_sub
         LEFT JOIN project_conversations pc ON pc.conversation_id = m.conversation_id AND pc.owner_sub = m.owner_sub
         WHERE mc.owner_sub = ?
         UNION ALL
         SELECT m.id, m.conversation_id, c.title, pc.project_id,
                'research', mr.created_at,
                json_extract(mr.content, '$.info.question'),
                json_extract(mr.content, '$.info.status'),
                NULL,
                json_extract(mr.content, '$.info.question'),
                NULL, NULL,
                json_array_length(json_extract(mr.content, '$.info.claims')),
                json_extract(mr.content, '$.info.counts.unsupported')
         FROM message_research mr
         JOIN messages m ON m.id = mr.message_id AND m.owner_sub = mr.owner_sub
         JOIN conversations c ON c.id = m.conversation_id AND c.owner_sub = m.owner_sub
         LEFT JOIN project_conversations pc ON pc.conversation_id = m.conversation_id AND pc.owner_sub = m.owner_sub
         WHERE mr.owner_sub = ?
       ) u
       WHERE u.title IS NOT NULL AND u.title != ''
       ORDER BY pinned DESC, u.created_at DESC
       LIMIT 80`,
    )
    .bind(owner, owner, owner, owner, owner)
    .all<ArtifactRow>()
  const items = (rows.results ?? []).flatMap((row) => {
    const item = summary(row)
    return item ? [item] : []
  })
  return privateJson(c, { items })
})

type StoredArtifact = { table: ArtifactTable; content: string; info: Record<string, unknown> }

async function artifactRecord(db: D1Database, owner: string, messageId: string): Promise<StoredArtifact | undefined> {
  for (const table of ARTIFACT_TABLES) {
    const row = await db
      .prepare(`SELECT content FROM ${table} WHERE message_id = ? AND owner_sub = ?`)
      .bind(messageId, owner)
      .first<{ content: string }>()
    if (!row) continue
    let info: Record<string, unknown> = {}
    try {
      const parsed = JSON.parse(row.content) as { info?: Record<string, unknown> }
      info = parsed?.info && typeof parsed.info === 'object' ? parsed.info : {}
    } catch {
      info = {}
    }
    return { table, content: row.content, info }
  }
  return undefined
}

async function ownsArtifact(db: D1Database, owner: string, messageId: string): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT 1 AS ok FROM message_build WHERE message_id = ? AND owner_sub = ?
       UNION ALL SELECT 1 FROM message_canvas WHERE message_id = ? AND owner_sub = ?
       UNION ALL SELECT 1 FROM message_research WHERE message_id = ? AND owner_sub = ?
       UNION ALL SELECT 1 FROM message_analysis WHERE message_id = ? AND owner_sub = ?`,
    )
    .bind(messageId, owner, messageId, owner, messageId, owner, messageId, owner)
    .first()
  return Boolean(row)
}

/** The artifact as a file: page HTML, study set, analysis write-up or report. */
artifacts.get('/:messageId/download', async (c) => {
  const db = c.get('db')
  const owner = c.get('user').sub
  const messageId = c.req.param('messageId')
  const message = await db
    .prepare(
      `SELECT m.content, c.title AS conversation_title FROM messages m
       JOIN conversations c ON c.id = m.conversation_id AND c.owner_sub = m.owner_sub
       WHERE m.owner_sub = ? AND m.id = ? AND m.role = 'assistant'`,
    )
    .bind(owner, messageId)
    .first<{ content: string; conversation_title: string }>()
  if (!message) return c.json({ error: 'not_found', message: 'This artifact is no longer here.' }, 404)
  const found = await artifactRecord(db, owner, messageId)
  if (!found) return c.json({ error: 'not_found', message: 'This reply has no downloadable artifact.' }, 404)

  const base = artifactSlug(text(found.info.title, 80) || text(found.info.question, 80) || message.conversation_title)
  let filename: string
  let mime: string
  let body: string
  if (found.table === 'message_build') {
    body = typeof found.info.html === 'string' ? found.info.html : ''
    if (!body.trim()) return c.json({ error: 'not_found', message: 'This page was not stored.' }, 404)
    filename = `${base}.html`
    mime = 'text/html'
  } else if (found.table === 'message_canvas') {
    const cards = Array.isArray(found.info.cards) ? (found.info.cards as CanvasCard[]) : []
    const questions = Array.isArray(found.info.questions) ? (found.info.questions as CanvasQuestion[]) : []
    body = canvasMarkdown({ title: text(found.info.title) || 'Study set', kind: found.info.kind === 'quiz' ? 'quiz' : 'flashcards', cards, questions })
    filename = `${base}.md`
    mime = 'text/markdown'
  } else if (found.table === 'message_research') {
    const sources = await db
      .prepare(`SELECT content FROM message_sources WHERE message_id = ? AND owner_sub = ?`)
      .bind(messageId, owner)
      .first<{ content: string }>()
    let parsed: Source[] = []
    try {
      const value = sources ? (JSON.parse(sources.content) as unknown) : []
      if (Array.isArray(value)) parsed = value as Source[]
    } catch {
      parsed = []
    }
    body = researchMarkdown(text(found.info.question) || 'Research report', message.content, parsed)
    filename = `${base}.md`
    mime = 'text/markdown'
  } else {
    const info = found.info
    const analysis: AnalysisInfo = {
      status: 'verified',
      question: text(info.question, 300),
      datasetId: '',
      fileName: text(info.fileName, 120),
      code: typeof info.code === 'string' ? info.code : '',
      ...(typeof info.stdout === 'string' ? { stdout: info.stdout } : {}),
      ...(typeof info.error === 'string' ? { error: info.error } : {}),
      rows: Number(info.rows) || 0,
      columns: Array.isArray(info.columns) ? info.columns.filter((column): column is string => typeof column === 'string') : [],
      models: [],
      asOf: Date.now(),
    }
    body = analysisMarkdown(analysis)
    filename = `${base}.md`
    mime = 'text/markdown'
  }
  return c.body(body, 200, {
    'content-type': `${mime}; charset=utf-8`,
    'content-disposition': `attachment; filename="${filename}"`,
    'cache-control': 'private, no-store',
    'x-content-type-options': 'nosniff',
  })
})

artifacts.post('/:messageId/pin', async (c) => {
  const db = c.get('db')
  const owner = c.get('user').sub
  const messageId = c.req.param('messageId')
  if (!(await ownsArtifact(db, owner, messageId))) {
    return c.json({ error: 'not_found', message: 'This artifact is no longer here.' }, 404)
  }
  await db
    .prepare(`INSERT OR IGNORE INTO pinned_artifacts (message_id, owner_sub, created_at) VALUES (?, ?, ?)`)
    .bind(messageId, owner, now())
    .run()
  return privateJson(c, { pinned: true })
})

artifacts.delete('/:messageId/pin', async (c) => {
  await c
    .get('db')
    .prepare(`DELETE FROM pinned_artifacts WHERE message_id = ? AND owner_sub = ?`)
    .bind(c.req.param('messageId'), c.get('user').sub)
    .run()
  return privateJson(c, { pinned: false })
})

/**
 * Duplicate copies one artifact into its own chat, so a remix starts from the
 * same page, deck, report or analysis instead of regenerating it.
 */
artifacts.post('/:messageId/duplicate', async (c) => {
  const db = c.get('db')
  const owner = c.get('user').sub
  const messageId = c.req.param('messageId')
  const message = await db
    .prepare(
      `SELECT m.content, m.model, m.interrupted, c.title FROM messages m
       JOIN conversations c ON c.id = m.conversation_id AND c.owner_sub = m.owner_sub
       WHERE m.owner_sub = ? AND m.id = ? AND m.role = 'assistant'`,
    )
    .bind(owner, messageId)
    .first<{ content: string; model: string | null; interrupted: number; title: string }>()
  if (!message) return c.json({ error: 'not_found', message: 'This artifact is no longer here.' }, 404)
  const found = await artifactRecord(db, owner, messageId)
  if (!found) return c.json({ error: 'not_found', message: 'Only library artifacts can be duplicated.' }, 404)

  const at = now()
  const conversationId = id()
  const copyId = id()
  const title = `${text(message.title, 70) || 'Artifact'} (copy)`
  await db.batch([
    db
      .prepare(`INSERT INTO conversations (id, owner_sub, title, model, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(conversationId, owner, title, message.model || DEFAULT_MODEL, at, at),
    db
      .prepare(
        `INSERT INTO messages (id, owner_sub, conversation_id, role, content, model, interrupted, created_at)
         VALUES (?, ?, ?, 'assistant', ?, ?, ?, ?)`,
      )
      .bind(copyId, owner, conversationId, message.content, message.model ?? null, Number(message.interrupted ?? 0) ? 1 : 0, at),
    db
      .prepare(`INSERT INTO ${found.table} (message_id, owner_sub, content, created_at) VALUES (?, ?, ?, ?)`)
      .bind(copyId, owner, found.content, at),
    db
      .prepare(
        `INSERT INTO message_sources (message_id, owner_sub, content, created_at)
         SELECT ?, owner_sub, content, ? FROM message_sources WHERE message_id = ? AND owner_sub = ?`,
      )
      .bind(copyId, at, messageId, owner),
  ])
  return privateJson(c, { conversationId }, 201)
})
