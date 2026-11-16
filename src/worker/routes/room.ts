import { Hono } from 'hono'

import { ROOM_ID, ROOM_MESSAGE_CHARS, ROOM_MESSAGE_TTL_MS, ROOM_NAME } from '../../shared/config'
import type { RoomMessage, RoomSnapshot } from '../../shared/types'
import { appOrigin, privateJson } from '../auth'
import { id, now } from '../db'
import type { AppContext } from '../env'
import { createRealtimeTicket, publishRealtime } from '../realtime'

export const room = new Hono<AppContext>()

const HISTORY_LIMIT = 60
const KEEP_MESSAGES = 200
const RATE_WINDOW_MS = 60_000
const RATE_LIMIT = 20
const MIN_GAP_MS = 1_500

type RoomRow = {
  id: string
  room: string
  author_sub: string
  author_id: string
  author_name: string
  body: string
  created_at: number
}

/** Normalize one room message. Null means empty or too long. */
export function cleanRoomMessage(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const body = value
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .trim()
  if (!body || body.length > ROOM_MESSAGE_CHARS) return null
  return body
}

/** A stable public tag for styling one's own bubbles without exposing user.sub. */
export async function roomAuthorId(userSub: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(userSub))
  return Array.from(new Uint8Array(digest).slice(0, 6), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function roomAuthorName(user: { name?: string; email?: string }, authorId: string): string {
  const name = user.name?.replace(/\s+/g, ' ').trim()
  if (name && name.toLowerCase() !== 'guest') return name.slice(0, 40)
  const local = user.email?.split('@')[0]?.replace(/[._-]+/g, ' ').trim()
  if (local) {
    return local
      .split(/\s+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
      .slice(0, 40)
  }
  return `Guest ${authorId.slice(0, 4).toUpperCase()}`
}

export function mapRoomMessage(row: RoomRow): RoomMessage {
  return {
    id: row.id,
    room: row.room,
    body: row.body,
    authorName: row.author_name,
    authorId: row.author_id,
    createdAt: Number(row.created_at),
  }
}

/** A message at or before this timestamp is no longer part of the room. */
export function roomMessageCutoff(at = now()): number {
  return at - ROOM_MESSAGE_TTL_MS
}

/** Permanently remove messages whose thirty-minute window has closed. */
export async function purgeExpiredRoomMessages(db: D1Database, at = now()): Promise<void> {
  await db
    .prepare(`DELETE FROM room_messages WHERE room = ? AND created_at <= ?`)
    .bind(ROOM_ID, roomMessageCutoff(at))
    .run()
}

room.get('/room', async (c) => {
  const user = c.get('user')
  const at = now()
  const db = c.get('db')
  await purgeExpiredRoomMessages(db, at)
  const rows = await db
    .prepare(
      `SELECT id, room, author_sub, author_id, author_name, body, created_at
       FROM room_messages
       WHERE room = ? AND created_at > ?
       ORDER BY created_at DESC, id DESC LIMIT ?`,
    )
    .bind(ROOM_ID, roomMessageCutoff(at), HISTORY_LIMIT)
    .all<RoomRow>()
  const body: RoomSnapshot = {
    room: ROOM_ID,
    name: ROOM_NAME,
    messages: rows.results.reverse().map(mapRoomMessage),
    viewerId: await roomAuthorId(user.sub),
    asOf: at,
  }
  return privateJson(c, body)
})

room.post('/room/messages', async (c) => {
  const user = c.get('user')
  const db = c.get('db')
  const input = await c.req.json<{ body?: unknown }>().catch(() => ({}) as { body?: unknown })
  if (typeof input.body === 'string' && input.body.length > ROOM_MESSAGE_CHARS) {
    return c.json({ error: 'too_long', message: `Keep room messages to ${ROOM_MESSAGE_CHARS} characters.` }, 400)
  }
  const content = cleanRoomMessage(input.body)
  if (!content) return c.json({ error: 'empty', message: 'Write a message first.' }, 400)

  const at = now()
  await purgeExpiredRoomMessages(db, at)
  const recent = await db
    .prepare(
      `SELECT COUNT(*) AS n, MAX(created_at) AS last
       FROM room_messages
       WHERE author_sub = ? AND room = ? AND created_at > ?`,
    )
    .bind(user.sub, ROOM_ID, at - RATE_WINDOW_MS)
    .first<{ n: number; last: number | null }>()
  const count = Number(recent?.n ?? 0)
  const last = Number(recent?.last ?? 0)
  if (last > at - MIN_GAP_MS) {
    return c.json({ error: 'rate_limited', message: 'Give the room a moment between messages.' }, 429)
  }
  if (count >= RATE_LIMIT) {
    return c.json({ error: 'rate_limited', message: 'That is a lot of messages. Try again in a minute.' }, 429)
  }

  const authorId = await roomAuthorId(user.sub)
  const message: RoomMessage = {
    id: id(),
    room: ROOM_ID,
    body: content,
    authorName: roomAuthorName(user, authorId),
    authorId,
    createdAt: at,
  }
  await db.batch([
    db
      .prepare(
        `INSERT INTO room_messages (id, room, author_sub, author_id, author_name, body, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(message.id, ROOM_ID, user.sub, authorId, message.authorName, message.body, message.createdAt),
    db
      .prepare(
        `DELETE FROM room_messages
         WHERE room = ? AND created_at < COALESCE((
           SELECT created_at FROM room_messages WHERE room = ?
           ORDER BY created_at DESC LIMIT 1 OFFSET ${KEEP_MESSAGES}
         ), 0)`,
      )
      .bind(ROOM_ID, ROOM_ID),
  ])

  // The row is committed first. A failed live publish must not turn a saved
  // message into an error; clients reload the snapshot on their next ready.
  let live = true
  try {
    await publishRealtime(c.env, { room: ROOM_ID, event: 'room_message', data: message })
  } catch (error) {
    live = false
    console.warn('room_publish_failed', error)
  }
  return privateJson(c, { message, live }, 201)
})

room.post('/realtime/ticket', async (c) => {
  const input = await c.req.json<{ room?: unknown }>().catch(() => null)
  if (!input || input.room !== ROOM_ID) {
    return c.json({ error: 'room', message: 'Unknown room.' }, 400)
  }
  if (!c.env.REALTIME) {
    // This is a normal fallback, not a server failure: the browser keeps the
    // HTTP room and polling path. A 200 with live:false stops the client from
    // retrying and keeps the aggregate 5xx monitor free of expected 503s.
    return privateJson(c, { ok: false, live: false, message: 'Live updates are not enabled on this deployment.' })
  }
  const user = c.get('user')
  try {
    const ticket = await createRealtimeTicket(c.env, {
      room: ROOM_ID,
      userId: user.sub,
      // Never trust a browser-supplied origin. The configured public origin is
      // the only one the managed realtime worker accepts in production.
      origin: appOrigin(c.env, c.req.raw),
      publish: false,
      presence: true,
    })
    return privateJson(c, { ...ticket, viewerId: await roomAuthorId(user.sub) })
  } catch (error) {
    console.error('realtime_ticket_failed', error)
    return c.json({ error: 'realtime_unavailable', message: 'Live updates are temporarily unavailable.' }, 503)
  }
})

// This room is deliberately public to every signed-in or guest session. It is
// one fixed id, so there is no user-supplied room name to check for membership.
// Private or shared rooms would need a membership lookup here before a ticket
// is minted. Clients can subscribe and set presence, never publish.