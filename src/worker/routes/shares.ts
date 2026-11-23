import { Hono } from 'hono'

import { MODELS } from '../../shared/config'
import type { SharedConversation, SharedMessage } from '../../shared/types'
import { contentDisposition, readAttachmentBytes, readAttachmentThumbnail } from '../attachment-storage'
import { groupAttachmentMeta } from '../attachments'
import { mapMessage, requireDb } from '../db'
import type { AppContext, Env } from '../env'
import { publicLanes } from '../public-ai'
import { RATE_WINDOWS, rateLimit, tooManyRequests } from '../rate-limit'

export const shares = new Hono<AppContext>()

shares.use('*', requireDb)

function modelName(env: Env, model: string | null | undefined): string | undefined {
  if (!model) return undefined
  return publicLanes(env).find((lane) => lane.model === model)?.label ?? MODELS.find((item) => item.id === model)?.name ?? model
}

shares.get('/:token', async (c) => {
  const limit = await rateLimit(c.get('db'), 'share', c.req.raw, 120, RATE_WINDOWS.share)
  if (!limit.allowed) return tooManyRequests(c, limit)
  // A live link is checked on every load. Keep this response out of caches.
  c.header('Cache-Control', 'no-store')
  const db = c.get('db')
  const share = await db
    .prepare(`SELECT owner_sub, conversation_id FROM conversation_shares WHERE token = ?`)
    .bind(c.req.param('token'))
    .first<{ owner_sub: string; conversation_id: string }>()
  // A missing share is a successful availability check with no conversation.
  // Returning 404 here would make the browser log a console error on every
  // revoked link, even though the page handled it correctly.
  if (!share) return c.json(null)

  const [, conversationResult, messagesResult, attachmentRows] = await db.batch([
    db.prepare(`DELETE FROM conversation_shares WHERE token = ? AND conversation_id NOT IN (SELECT id FROM conversations WHERE owner_sub = ?)`).bind(c.req.param('token'), share.owner_sub),
    db.prepare(`SELECT title, model, created_at, updated_at FROM conversations WHERE owner_sub = ? AND id = ?`).bind(share.owner_sub, share.conversation_id),
    db
      .prepare(
        `SELECT m.*, r.content AS reasoning, r.duration_ms AS reasoning_ms, s.content AS sources, tm.content AS team, mp.content AS proof, mr.content AS research, ma.content AS analysis, mb.content AS build, mc.content AS canvas, mg.content AS agent
         FROM messages m
         LEFT JOIN message_reasoning r ON r.message_id = m.id AND r.owner_sub = m.owner_sub
         LEFT JOIN message_sources s ON s.message_id = m.id AND s.owner_sub = m.owner_sub
         LEFT JOIN message_team tm ON tm.message_id = m.id AND tm.owner_sub = m.owner_sub
         LEFT JOIN message_proof mp ON mp.message_id = m.id AND mp.owner_sub = m.owner_sub
         LEFT JOIN message_research mr ON mr.message_id = m.id AND mr.owner_sub = m.owner_sub
         LEFT JOIN message_analysis ma ON ma.message_id = m.id AND ma.owner_sub = m.owner_sub
         LEFT JOIN message_build mb ON mb.message_id = m.id AND mb.owner_sub = m.owner_sub
         LEFT JOIN message_canvas mc ON mc.message_id = m.id AND mc.owner_sub = m.owner_sub
         LEFT JOIN message_agent mg ON mg.message_id = m.id AND mg.owner_sub = m.owner_sub
         WHERE m.owner_sub = ? AND m.conversation_id = ? AND NOT (m.role = 'assistant' AND m.content = '')
         ORDER BY m.created_at ASC`,
      )
      .bind(share.owner_sub, share.conversation_id),
    db
      .prepare(`SELECT id, message_id, name, mime, size, kind, CASE WHEN mime = 'text/uri-list' THEN data END AS url FROM message_attachments WHERE owner_sub = ? AND conversation_id = ? ORDER BY message_id, position, created_at`)
      .bind(share.owner_sub, share.conversation_id),
  ])
  const conversation = conversationResult.results[0] as Record<string, unknown> | undefined
  if (!conversation) return c.json(null)
  const token = c.req.param('token')
  const attachmentMeta = groupAttachmentMeta(
    attachmentRows.results as Record<string, unknown>[],
    `/api/share/${encodeURIComponent(token)}/attachments`,
  )

  const messages: SharedMessage[] = (messagesResult.results as Record<string, unknown>[]).map((row) => {
    const message = mapMessage(row)
    const files = attachmentMeta.get(message.id)
    return {
      role: message.role,
      content: message.content,
      model: message.model,
      ...(message.model ? { modelName: modelName(c.env, message.model) } : {}),
      interrupted: message.interrupted,
      createdAt: message.createdAt,
      ...(message.reasoning ? { reasoning: message.reasoning } : {}),
      ...(message.reasoningMs !== undefined ? { reasoningMs: message.reasoningMs } : {}),
      ...(message.sources ? { sources: message.sources } : {}),
      ...(message.team ? { team: message.team } : {}),
      ...(message.proof ? { proof: message.proof } : {}),
      ...(message.research ? { research: message.research } : {}),
      ...(message.analysis ? { analysis: message.analysis } : {}),
      ...(message.build ? { build: message.build } : {}),
      ...(message.canvas ? { canvas: message.canvas } : {}),
      ...(message.agent ? { agent: message.agent } : {}),
      ...(files?.length ? { attachments: files } : {}),
    }
  })
  const body: SharedConversation = {
    title: conversation.title as string,
    model: conversation.model as string,
    ...(conversation.model ? { modelName: modelName(c.env, conversation.model as string) } : {}),
    createdAt: Number(conversation.created_at),
    updatedAt: Number(conversation.updated_at),
    messages,
  }
  // A revoked link must stop working immediately; never let a browser keep it.
  return c.json(body)
})

shares.get('/:token/attachments/:id', async (c) => {
  const limit = await rateLimit(c.get('db'), 'share', c.req.raw, 120, RATE_WINDOWS.share)
  if (!limit.allowed) return tooManyRequests(c, limit)
  // Images in a shared chat are public only while the share link is live.
  const row = await c
    .get('db')
    .prepare(
      `SELECT a.id, a.name, a.mime, a.kind, a.data, a.r2_key FROM message_attachments a
       JOIN conversation_shares s
         ON s.conversation_id = a.conversation_id AND s.owner_sub = a.owner_sub
       WHERE s.token = ? AND a.id = ?`,
    )
    .bind(c.req.param('token'), c.req.param('id'))
    .first<{ id: string; name: string; mime: string; kind: string; data: string; r2_key: string | null }>()
  if (!row) return c.json({ error: 'not_found' }, 404)
  const download = c.req.query('download') === '1'
  if (row.kind !== 'image' && !download) return c.json({ error: 'not_found' }, 404)
  const thumbnail = row.kind === 'image' && c.req.query('thumb') === '1'
  const loaded = thumbnail
    ? await readAttachmentThumbnail(c.env.FILES, 'chat', row)
    : await readAttachmentBytes(c.env.FILES, row).then((bytes) => (bytes ? { bytes, mime: row.mime } : null))
  if (!loaded) return c.json({ error: 'not_found' }, 404)
  return new Response(loaded.bytes.buffer as ArrayBuffer, {
    headers: {
      'content-type': loaded.mime,
      'content-length': String(loaded.bytes.byteLength),
      'cache-control': 'private, no-store',
      'content-disposition': contentDisposition(row.name, !download),
      'x-content-type-options': 'nosniff',
    },
  })
})
