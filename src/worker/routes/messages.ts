import { Hono } from 'hono'

import { privateJson } from '../auth'
import { now } from '../db'
import type { AppContext } from '../env'

export const messages = new Hono<AppContext>()

messages.post('/:id/feedback', async (c) => {
  const db = c.get('db')
  const owner = c.get('user').sub
  const messageId = c.req.param('id')
  const input = await c.req.json<{ rating?: unknown }>().catch(() => ({} as { rating?: unknown }))
  if (input.rating !== 'up' && input.rating !== 'down') {
    return c.json({ error: 'rating', message: 'Choose helpful or not helpful.' }, 400)
  }
  const message = await db.prepare(`SELECT id FROM messages WHERE owner_sub = ? AND id = ? AND role = 'assistant'`).bind(owner, messageId).first()
  if (!message) return c.json({ error: 'not_found', message: 'This reply is no longer here.' }, 404)
  await db
    .prepare(
      `INSERT INTO message_feedback (message_id, owner_sub, rating, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(message_id) DO UPDATE SET rating = excluded.rating, created_at = excluded.created_at`,
    )
    .bind(messageId, owner, input.rating, now())
    .run()
  return privateJson(c, { ok: true, rating: input.rating })
})
