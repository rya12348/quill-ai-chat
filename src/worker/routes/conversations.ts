import { Hono } from 'hono'

import { groupAttachmentMeta } from '../attachments'
import { aiConfigured, isModelId } from '../ai'
import { privateJson } from '../auth'
import { mapConversation, mapMessage, now } from '../db'
import type { AppContext } from '../env'
import { publicLanes } from '../public-ai'

export const conversations = new Hono<AppContext>()

// 24 random bytes as hex: unguessable, URL-safe, and never a conversation id.
function shareToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

conversations.get('/', async (c) => {
  const rows = await c
    .get('db')
    .prepare(
      `SELECT c.*, pc.project_id FROM conversations c
       LEFT JOIN project_conversations pc ON pc.conversation_id = c.id AND pc.owner_sub = c.owner_sub
       WHERE c.owner_sub = ? ORDER BY c.updated_at DESC LIMIT 200`,
    )
    .bind(c.get('user').sub)
    .all()
  return privateJson(c, { items: (rows.results as Record<string, unknown>[]).map(mapConversation) })
})

// A reply row is created empty when generation starts (routes/chat.ts) and
// filled in at the end. One still empty this long after has been orphaned by
// a lost connection; it is removed when the conversation is next read.
const ORPHAN_AFTER = 10 * 60_000

conversations.get('/:id', async (c) => {
  const db = c.get('db')
  const owner = c.get('user').sub
  const conversationId = c.req.param('id')
  // Ten cleanup DELETEs precede the conversation, message and attachment SELECTs.
  const [, , , , , , , , , , conversation, messages, attachmentRows] = await db.batch([
    db
      .prepare(`DELETE FROM message_reasoning WHERE owner_sub = ? AND message_id IN (SELECT id FROM messages WHERE owner_sub = ? AND conversation_id = ? AND role = 'assistant' AND content = '' AND created_at < ?)`)
      .bind(owner, owner, conversationId, now() - ORPHAN_AFTER),
    db
      .prepare(`DELETE FROM message_sources WHERE owner_sub = ? AND message_id IN (SELECT id FROM messages WHERE owner_sub = ? AND conversation_id = ? AND role = 'assistant' AND content = '' AND created_at < ?)`)
      .bind(owner, owner, conversationId, now() - ORPHAN_AFTER),
    db
      .prepare(`DELETE FROM message_feedback WHERE owner_sub = ? AND message_id IN (SELECT id FROM messages WHERE owner_sub = ? AND conversation_id = ? AND role = 'assistant' AND content = '' AND created_at < ?)`)
      .bind(owner, owner, conversationId, now() - ORPHAN_AFTER),
    db
      .prepare(`DELETE FROM message_team WHERE owner_sub = ? AND message_id IN (SELECT id FROM messages WHERE owner_sub = ? AND conversation_id = ? AND role = 'assistant' AND content = '' AND created_at < ?)`)
      .bind(owner, owner, conversationId, now() - ORPHAN_AFTER),
    db
      .prepare(`DELETE FROM message_proof WHERE owner_sub = ? AND message_id IN (SELECT id FROM messages WHERE owner_sub = ? AND conversation_id = ? AND role = 'assistant' AND content = '' AND created_at < ?)`)
      .bind(owner, owner, conversationId, now() - ORPHAN_AFTER),
    db
      .prepare(`DELETE FROM message_research WHERE owner_sub = ? AND message_id IN (SELECT id FROM messages WHERE owner_sub = ? AND conversation_id = ? AND role = 'assistant' AND content = '' AND created_at < ?)`)
      .bind(owner, owner, conversationId, now() - ORPHAN_AFTER),
    db
      .prepare(`DELETE FROM message_analysis WHERE owner_sub = ? AND message_id IN (SELECT id FROM messages WHERE owner_sub = ? AND conversation_id = ? AND role = 'assistant' AND content = '' AND created_at < ?)`)
      .bind(owner, owner, conversationId, now() - ORPHAN_AFTER),
    db
      .prepare(`DELETE FROM message_build WHERE owner_sub = ? AND message_id IN (SELECT id FROM messages WHERE owner_sub = ? AND conversation_id = ? AND role = 'assistant' AND content = '' AND created_at < ?)`)
      .bind(owner, owner, conversationId, now() - ORPHAN_AFTER),
    db
      .prepare(`DELETE FROM message_canvas WHERE owner_sub = ? AND message_id IN (SELECT id FROM messages WHERE owner_sub = ? AND conversation_id = ? AND role = 'assistant' AND content = '' AND created_at < ?)`)
      .bind(owner, owner, conversationId, now() - ORPHAN_AFTER),
    db
      .prepare(`DELETE FROM build_embeds WHERE owner_sub = ? AND message_id IN (SELECT id FROM messages WHERE owner_sub = ? AND conversation_id = ? AND role = 'assistant' AND content = '' AND created_at < ?)`)
      .bind(owner, owner, conversationId, now() - ORPHAN_AFTER),
    db
      .prepare(`DELETE FROM messages WHERE owner_sub = ? AND conversation_id = ? AND role = 'assistant' AND content = '' AND created_at < ?`)
      .bind(owner, conversationId, now() - ORPHAN_AFTER),
    db
      .prepare(
        `SELECT c.*, pc.project_id FROM conversations c
         LEFT JOIN project_conversations pc ON pc.conversation_id = c.id AND pc.owner_sub = c.owner_sub
         WHERE c.owner_sub = ? AND c.id = ?`,
      )
      .bind(owner, conversationId),
    db
      .prepare(`SELECT m.*, r.content AS reasoning, r.duration_ms AS reasoning_ms, s.content AS sources, f.rating AS feedback, tm.content AS team, mp.content AS proof, mr.content AS research, ma.content AS analysis, mb.content AS build, mc.content AS canvas FROM messages m LEFT JOIN message_reasoning r ON r.message_id = m.id AND r.owner_sub = m.owner_sub LEFT JOIN message_sources s ON s.message_id = m.id AND s.owner_sub = m.owner_sub LEFT JOIN message_feedback f ON f.message_id = m.id AND f.owner_sub = m.owner_sub LEFT JOIN message_team tm ON tm.message_id = m.id AND tm.owner_sub = m.owner_sub LEFT JOIN message_proof mp ON mp.message_id = m.id AND mp.owner_sub = m.owner_sub LEFT JOIN message_research mr ON mr.message_id = m.id AND mr.owner_sub = m.owner_sub LEFT JOIN message_analysis ma ON ma.message_id = m.id AND ma.owner_sub = m.owner_sub LEFT JOIN message_build mb ON mb.message_id = m.id AND mb.owner_sub = m.owner_sub LEFT JOIN message_canvas mc ON mc.message_id = m.id AND mc.owner_sub = m.owner_sub WHERE m.owner_sub = ? AND m.conversation_id = ? AND NOT (m.role = 'assistant' AND m.content = '') ORDER BY m.created_at ASC`)
      .bind(owner, conversationId),
    db
      .prepare(`SELECT id, message_id, name, mime, size, kind FROM message_attachments WHERE owner_sub = ? AND conversation_id = ? ORDER BY message_id, position, created_at`)
      .bind(owner, conversationId),
  ])
  if (!conversation.results[0]) return c.json({ error: 'Not found.' }, 404)
  const attachmentMeta = groupAttachmentMeta(attachmentRows.results as Record<string, unknown>[])
  return privateJson(c, {
    conversation: mapConversation(conversation.results[0] as Record<string, unknown>),
    messages: (messages.results as Record<string, unknown>[]).map((row) => {
      const message = mapMessage(row)
      const files = attachmentMeta.get(message.id)
      return files?.length ? { ...message, attachments: files } : message
    }),
  })
})

conversations.get('/:id/share', async (c) => {
  const db = c.get('db')
  const owner = c.get('user').sub
  const conversationId = c.req.param('id')
  const conversation = await db.prepare(`SELECT id FROM conversations WHERE owner_sub = ? AND id = ?`).bind(owner, conversationId).first()
  if (!conversation) return c.json({ error: 'Not found.' }, 404)
  const share = await db.prepare(`SELECT token FROM conversation_shares WHERE owner_sub = ? AND conversation_id = ?`).bind(owner, conversationId).first<{ token: string }>()
  return privateJson(c, { token: share?.token ?? null })
})

conversations.post('/:id/share', async (c) => {
  const db = c.get('db')
  const owner = c.get('user').sub
  const conversationId = c.req.param('id')
  const conversation = await db.prepare(`SELECT id FROM conversations WHERE owner_sub = ? AND id = ?`).bind(owner, conversationId).first()
  if (!conversation) return c.json({ error: 'Not found.' }, 404)
  const existing = await db.prepare(`SELECT token FROM conversation_shares WHERE owner_sub = ? AND conversation_id = ?`).bind(owner, conversationId).first<{ token: string }>()
  if (existing) return privateJson(c, { token: existing.token })
  const token = shareToken()
  await db.prepare(`INSERT OR IGNORE INTO conversation_shares (token, conversation_id, owner_sub, created_at) VALUES (?, ?, ?, ?)`).bind(token, conversationId, owner, now()).run()
  const saved = await db.prepare(`SELECT token FROM conversation_shares WHERE owner_sub = ? AND conversation_id = ?`).bind(owner, conversationId).first<{ token: string }>()
  return privateJson(c, { token: saved?.token ?? token })
})

conversations.delete('/:id/share', async (c) => {
  const db = c.get('db')
  const owner = c.get('user').sub
  const conversationId = c.req.param('id')
  const conversation = await db.prepare(`SELECT id FROM conversations WHERE owner_sub = ? AND id = ?`).bind(owner, conversationId).first()
  if (!conversation) return c.json({ error: 'Not found.' }, 404)
  await db.prepare(`DELETE FROM conversation_shares WHERE owner_sub = ? AND conversation_id = ?`).bind(owner, conversationId).run()
  return privateJson(c, { ok: true })
})

conversations.patch('/:id', async (c) => {
  const db = c.get('db')
  const owner = c.get('user').sub
  const conversationId = c.req.param('id')
  const input = await c.req.json<{ title?: unknown; model?: unknown; projectId?: unknown }>().catch(() => ({}) as { title?: unknown; model?: unknown; projectId?: unknown })
  const existing = await db.prepare(`SELECT * FROM conversations WHERE owner_sub = ? AND id = ?`).bind(owner, conversationId).first<Record<string, unknown>>()
  if (!existing) return c.json({ error: 'Not found.' }, 404)
  let projectId: string | null | undefined
  if (input.projectId !== undefined) {
    if (input.projectId === null || input.projectId === '') {
      projectId = null
    } else if (typeof input.projectId === 'string') {
      const project = await db.prepare(`SELECT id FROM projects WHERE owner_sub = ? AND id = ?`).bind(owner, input.projectId).first()
      if (!project) return c.json({ error: 'Project not found.' }, 400)
      projectId = input.projectId
    } else {
      return c.json({ error: 'Invalid project.' }, 400)
    }
  }
  let title = existing.title as string
  if (input.title !== undefined) {
    if (typeof input.title !== 'string') return c.json({ error: 'Invalid title.' }, 400)
    title = input.title.replace(/\s+/g, ' ').trim().slice(0, 80)
    if (!title) return c.json({ error: 'Give the chat a title.' }, 400)
  }
  let model = existing.model as string
  if (input.model !== undefined) {
    const lanes = aiConfigured(c.env) ? [] : publicLanes(c.env)
    const allowed = isModelId(input.model) || (typeof input.model === 'string' && lanes.some((lane) => lane.model === input.model))
    if (!allowed) return c.json({ error: 'Unknown model.' }, 400)
    model = input.model as string
  }
  const statements = [db.prepare(`UPDATE conversations SET title = ?, model = ? WHERE owner_sub = ? AND id = ?`).bind(title, model, owner, conversationId)]
  if (projectId !== undefined) {
    statements.push(db.prepare(`DELETE FROM project_conversations WHERE owner_sub = ? AND conversation_id = ?`).bind(owner, conversationId))
    if (projectId) {
      statements.push(
        db.prepare(`INSERT INTO project_conversations (conversation_id, project_id, owner_sub, updated_at) VALUES (?, ?, ?, ?)`).bind(conversationId, projectId, owner, now()),
      )
    }
  }
  await db.batch(statements)
  const row = await db
    .prepare(
      `SELECT c.*, pc.project_id FROM conversations c
       LEFT JOIN project_conversations pc ON pc.conversation_id = c.id AND pc.owner_sub = c.owner_sub
       WHERE c.owner_sub = ? AND c.id = ?`,
    )
    .bind(owner, conversationId)
    .first<Record<string, unknown>>()
  return privateJson(c, { conversation: mapConversation(row!) })
})

conversations.delete('/:id', async (c) => {
  const db = c.get('db')
  const owner = c.get('user').sub
  const conversationId = c.req.param('id')
  await db.batch([
    db.prepare(`DELETE FROM message_reasoning WHERE owner_sub = ? AND message_id IN (SELECT id FROM messages WHERE owner_sub = ? AND conversation_id = ?)`).bind(owner, owner, conversationId),
    db.prepare(`DELETE FROM message_sources WHERE owner_sub = ? AND message_id IN (SELECT id FROM messages WHERE owner_sub = ? AND conversation_id = ?)`).bind(owner, owner, conversationId),
    db.prepare(`DELETE FROM message_feedback WHERE owner_sub = ? AND message_id IN (SELECT id FROM messages WHERE owner_sub = ? AND conversation_id = ?)`).bind(owner, owner, conversationId),
    db.prepare(`DELETE FROM message_team WHERE owner_sub = ? AND message_id IN (SELECT id FROM messages WHERE owner_sub = ? AND conversation_id = ?)`).bind(owner, owner, conversationId),
    db.prepare(`DELETE FROM message_proof WHERE owner_sub = ? AND message_id IN (SELECT id FROM messages WHERE owner_sub = ? AND conversation_id = ?)`).bind(owner, owner, conversationId),
    db.prepare(`DELETE FROM message_research WHERE owner_sub = ? AND message_id IN (SELECT id FROM messages WHERE owner_sub = ? AND conversation_id = ?)`).bind(owner, owner, conversationId),
    db.prepare(`DELETE FROM message_analysis WHERE owner_sub = ? AND message_id IN (SELECT id FROM messages WHERE owner_sub = ? AND conversation_id = ?)`).bind(owner, owner, conversationId),
    db.prepare(`DELETE FROM message_build WHERE owner_sub = ? AND message_id IN (SELECT id FROM messages WHERE owner_sub = ? AND conversation_id = ?)`).bind(owner, owner, conversationId),
    db.prepare(`DELETE FROM message_canvas WHERE owner_sub = ? AND message_id IN (SELECT id FROM messages WHERE owner_sub = ? AND conversation_id = ?)`).bind(owner, owner, conversationId),
    db.prepare(`DELETE FROM build_embeds WHERE owner_sub = ? AND message_id IN (SELECT id FROM messages WHERE owner_sub = ? AND conversation_id = ?)`).bind(owner, owner, conversationId),
    db.prepare(`DELETE FROM message_attachments WHERE owner_sub = ? AND conversation_id = ?`).bind(owner, conversationId),
    db.prepare(`DELETE FROM conversation_shares WHERE owner_sub = ? AND conversation_id = ?`).bind(owner, conversationId),
    db.prepare(`DELETE FROM conversation_summaries WHERE owner_sub = ? AND conversation_id = ?`).bind(owner, conversationId),
    db.prepare(`DELETE FROM project_conversations WHERE owner_sub = ? AND conversation_id = ?`).bind(owner, conversationId),
    db.prepare(`DELETE FROM messages WHERE owner_sub = ? AND conversation_id = ?`).bind(owner, conversationId),
    db.prepare(`DELETE FROM conversations WHERE owner_sub = ? AND id = ?`).bind(owner, conversationId),
  ])
  return privateJson(c, { ok: true, at: now() })
})
