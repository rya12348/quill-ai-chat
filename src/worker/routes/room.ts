import { Hono, type Context } from 'hono'

import {
  MAX_ROOMS,
  ROOM_ID,
  ROOM_MESSAGE_CHARS,
  ROOM_MESSAGE_TTL_MS,
  ROOM_NAME_CHARS,
  ROOM_PASSWORD_MAX_CHARS,
  ROOM_PASSWORD_MIN_CHARS,
} from '../../shared/config'
import type { RoomActivity, RoomActivityItem, RoomList, RoomMessage, RoomSnapshot, RoomSummary, RoomVisibility } from '../../shared/types'
import { AttachmentValidationError, attachmentMeta, groupAttachmentMeta, parseAttachments, type StoredAttachment } from '../attachments'
import { appOrigin, hashPassword, privateJson, verifyPassword } from '../auth'
import { id, now } from '../db'
import type { AppContext } from '../env'
import { RATE_WINDOWS, rateLimit, tooManyRequests } from '../rate-limit'
import { createRealtimeTicket, publishRealtime } from '../realtime'

export const room = new Hono<AppContext>()

const HISTORY_LIMIT = 60
const KEEP_MESSAGES = 200
const RATE_WINDOW_MS = 60_000
const RATE_LIMIT = 20
const MIN_GAP_MS = 1_500
const ROOM_ID_CHARS = 64

type RoomRow = {
  id: string
  room: string
  author_sub: string
  author_id: string
  author_name: string
  body: string
  created_at: number
}

type ChatRoomRow = {
  id: string
  name: string
  visibility: RoomVisibility
  password_hash: string | null
  created_by: string
  created_at: number
}

type RoomListRow = Omit<ChatRoomRow, 'password_hash'> & { unlocked: number }

type RoomActivityRow = RoomRow & { room_name: string }

const attachmentBase = (roomId: string) => `/api/rooms/${encodeURIComponent(roomId)}/attachments`

function roomAttachmentMeta(attachments: StoredAttachment[], roomId: string) {
  const base = attachmentBase(roomId)
  return attachments.map((attachment) => {
    const meta = attachmentMeta(attachment, base)
    if (attachment.mime === 'text/uri-list' && /^https?:\/\//i.test(attachment.data)) {
      meta.url = attachment.data
    } else if (attachment.kind === 'text') {
      meta.url = `${base}/${encodeURIComponent(attachment.id)}`
    }
    return meta
  })
}

function withRoomAttachmentUrls(rows: Record<string, unknown>[], roomId: string) {
  const grouped = groupAttachmentMeta(rows, attachmentBase(roomId))
  for (const files of grouped.values()) {
    for (const file of files) {
      if (!file.url && file.mime !== 'text/uri-list') {
        file.url = `${attachmentBase(roomId)}/${encodeURIComponent(file.id)}`
      }
    }
  }
  return grouped
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

/** Names are single-line labels so they stay legible in the room rail. */
export function cleanRoomName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const name = value
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!name || name.length > ROOM_NAME_CHARS) return null
  return name
}

/** A password is only kept as a hash; this validates the input before hashing. */
export function validRoomPassword(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= ROOM_PASSWORD_MIN_CHARS &&
    value.length <= ROOM_PASSWORD_MAX_CHARS
  )
}

function visibilityFor(value: unknown): RoomVisibility | null {
  return value === 'public' || value === 'private' ? value : null
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

export function mapRoomSummary(row: ChatRoomRow | RoomListRow, userSub: string, unlocked?: boolean): RoomSummary {
  const visibility: RoomVisibility = row.visibility === 'private' ? 'private' : 'public'
  return {
    id: row.id,
    name: row.name,
    visibility,
    createdAt: Number(row.created_at),
    createdByMe: row.created_by === userSub,
    unlocked: unlocked ?? (visibility === 'public' || row.created_by === userSub),
  }
}

/** A message at or before this timestamp is no longer part of the room. */
export function roomMessageCutoff(at = now()): number {
  return at - ROOM_MESSAGE_TTL_MS
}

/** Permanently remove messages whose thirty-minute window has closed. */
export async function purgeExpiredRoomMessages(
  db: D1Database,
  at = now(),
  roomId = ROOM_ID,
): Promise<void> {
  const cutoff = roomMessageCutoff(at)
  await db.batch([
    db
      .prepare(
        `DELETE FROM room_message_attachments
         WHERE message_id IN (SELECT id FROM room_messages WHERE room = ? AND created_at <= ?)`,
      )
      .bind(roomId, cutoff),
    db.prepare(`DELETE FROM room_messages WHERE room = ? AND created_at <= ?`).bind(roomId, cutoff),
  ])
}

/** Keep the old lobby id working for tabs that were open during a deploy. */
function canonicalRoomId(value: string): string {
  return value === 'lobby' ? ROOM_ID : value
}

async function findRoom(db: D1Database, roomId: string): Promise<ChatRoomRow | undefined> {
  const key = canonicalRoomId(roomId)
  if (!key || key.length > ROOM_ID_CHARS) return undefined
  const row = await db
    .prepare(`SELECT id, name, visibility, password_hash, created_by, created_at FROM chat_rooms WHERE id = ?`)
    .bind(key)
    .first<ChatRoomRow>()
  return row ?? undefined
}

/** Private rooms require either ownership or a saved unlock grant. */
export async function hasRoomAccess(
  db: D1Database,
  roomRow: Pick<ChatRoomRow, 'id' | 'visibility' | 'created_by'>,
  userSub: string,
): Promise<boolean> {
  if (roomRow.visibility !== 'private') return true
  if (roomRow.created_by === userSub) return true
  const access = await db
    .prepare(`SELECT 1 AS allowed FROM room_access WHERE room_id = ? AND user_sub = ?`)
    .bind(roomRow.id, userSub)
    .first<{ allowed: number }>()
  return Boolean(access)
}

function lockedRoom(c: Context<AppContext>) {
  return c.json(
    { error: 'locked', message: 'This room is private. Enter its password to join.' },
    403,
  )
}

async function roomSnapshot(c: Context<AppContext>, roomRow: ChatRoomRow) {
  const user = c.get('user')
  const db = c.get('db')
  const at = now()
  await purgeExpiredRoomMessages(db, at, roomRow.id)
  const rows = await db
    .prepare(
      `SELECT id, room, author_sub, author_id, author_name, body, created_at
       FROM room_messages
       WHERE room = ? AND created_at > ?
       ORDER BY created_at DESC, id DESC LIMIT ?`,
    )
    .bind(roomRow.id, roomMessageCutoff(at), HISTORY_LIMIT)
    .all<RoomRow>()
  const ids = rows.results.map((row) => row.id)
  const attachmentRows = ids.length
    ? await db
        .prepare(
          `SELECT id, message_id, name, mime, size, kind,
                  CASE WHEN mime = 'text/uri-list' THEN data END AS url
           FROM room_message_attachments
           WHERE room = ? AND message_id IN (${ids.map(() => '?').join(',')})
           ORDER BY message_id, position, created_at`,
        )
        .bind(roomRow.id, ...ids)
        .all<Record<string, unknown>>()
    : { results: [] }
  const filesByMessage = withRoomAttachmentUrls(attachmentRows.results, roomRow.id)
  const body: RoomSnapshot = {
    room: roomRow.id,
    name: roomRow.name,
    visibility: roomRow.visibility === 'private' ? 'private' : 'public',
    createdByMe: roomRow.created_by === user.sub,
    messages: rows.results.reverse().map((row) => {
      const message = mapRoomMessage(row)
      const files = filesByMessage.get(message.id)
      return files?.length ? { ...message, attachments: files } : message
    }),
    viewerId: await roomAuthorId(user.sub),
    asOf: at,
  }
  return privateJson(c, body)
}

room.get('/rooms', async (c) => {
  const user = c.get('user')
  const rows = await c
    .get('db')
    .prepare(
      `SELECT r.id, r.name, r.visibility, r.created_by, r.created_at,
              CASE WHEN r.visibility = 'public' OR r.created_by = ? OR a.user_sub IS NOT NULL THEN 1 ELSE 0 END AS unlocked
       FROM chat_rooms r
       LEFT JOIN room_access a ON a.room_id = r.id AND a.user_sub = ?
       ORDER BY CASE WHEN r.visibility = 'private' THEN 0 ELSE 1 END,
                CASE WHEN r.id = ? THEN 0 ELSE 1 END,
                r.created_at DESC
       LIMIT 100`,
    )
    .bind(user.sub, user.sub, ROOM_ID)
    .all<RoomListRow>()
  const body: RoomList = {
    items: rows.results.map((row) => mapRoomSummary(row, user.sub, Boolean(row.unlocked))),
    defaultRoomId: ROOM_ID,
  }
  return privateJson(c, body)
})

/** New messages in every room this account can read, for app-wide notices. */
room.get('/rooms/activity', async (c) => {
  const user = c.get('user')
  const at = now()
  const cutoff = roomMessageCutoff(at)
  const requested = Number(c.req.query('after'))
  // Never let a missing or clock-skewed cursor replay the whole retention
  // window. The default is "nothing before now".
  const after = Math.max(cutoff, Math.min(at, Number.isFinite(requested) ? requested : at))
  const rows = await c
    .get('db')
    .prepare(
      `SELECT m.id, m.room, m.author_sub, m.author_id, m.author_name, m.body, m.created_at,
              r.name AS room_name
       FROM room_messages m
       JOIN chat_rooms r ON r.id = m.room
       LEFT JOIN room_access a ON a.room_id = r.id AND a.user_sub = ?
       WHERE m.created_at > ? AND m.created_at > ? AND m.author_sub <> ?
         AND (r.visibility = 'public' OR r.created_by = ? OR a.user_sub IS NOT NULL)
       ORDER BY m.created_at ASC, m.id ASC
       LIMIT 50`,
    )
    .bind(user.sub, after, cutoff, user.sub, user.sub)
    .all<RoomActivityRow>()
  const items: RoomActivityItem[] = rows.results.map((row) => ({
    ...mapRoomMessage(row),
    roomName: row.room_name,
  }))
  const body: RoomActivity = { items, asOf: at }
  return privateJson(c, body)
})

room.post('/rooms', async (c) => {
  const user = c.get('user')
  const db = c.get('db')
  const limit = await rateLimit(db, 'room:create', c.req.raw, 5, RATE_WINDOWS.chat, user.sub)
  if (!limit.allowed) return tooManyRequests(c, limit)

  const input = await c
    .req
    .json<{ name?: unknown; visibility?: unknown; password?: unknown }>()
    .catch(() => null)
  if (!input) return c.json({ error: 'invalid_room', message: 'Choose a room name and type.' }, 400)

  const name = cleanRoomName(input.name)
  if (!name) {
    return c.json(
      { error: 'invalid_name', message: `Use a room name from 1 to ${ROOM_NAME_CHARS} characters.` },
      400,
    )
  }
  const visibility = visibilityFor(input.visibility)
  if (!visibility) {
    return c.json({ error: 'invalid_visibility', message: 'Choose a public or private room.' }, 400)
  }
  if (visibility === 'private' && !validRoomPassword(input.password)) {
    return c.json(
      {
        error: 'invalid_password',
        message: `Private room passwords need ${ROOM_PASSWORD_MIN_CHARS}–${ROOM_PASSWORD_MAX_CHARS} characters.`,
      },
      400,
    )
  }

  const count = await db.prepare(`SELECT COUNT(*) AS n FROM chat_rooms`).first<{ n: number }>()
  if (Number(count?.n ?? 0) >= MAX_ROOMS) {
    return c.json(
      { error: 'too_many_rooms', message: `There is room for ${MAX_ROOMS} rooms right now.` },
      409,
    )
  }
  const existing = await db
    .prepare(`SELECT 1 AS found FROM chat_rooms WHERE name = ? COLLATE NOCASE`)
    .bind(name)
    .first<{ found: number }>()
  if (existing) {
    return c.json({ error: 'room_exists', message: 'A room with that name already exists.' }, 409)
  }

  const createdAt = now()
  const roomRow: ChatRoomRow = {
    id: id(),
    name,
    visibility,
    password_hash: visibility === 'private' ? await hashPassword(input.password as string) : null,
    created_by: user.sub,
    created_at: createdAt,
  }

  try {
    const statements = [
      db
        .prepare(
          `INSERT INTO chat_rooms (id, name, visibility, password_hash, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .bind(roomRow.id, roomRow.name, roomRow.visibility, roomRow.password_hash, roomRow.created_by, roomRow.created_at),
    ]
    if (visibility === 'private') {
      statements.push(
        db
          .prepare(`INSERT INTO room_access (room_id, user_sub, created_at) VALUES (?, ?, ?)`)
          .bind(roomRow.id, user.sub, createdAt),
      )
    }
    await db.batch(statements)
  } catch (error) {
    if (/unique/i.test(String(error))) {
      return c.json({ error: 'room_exists', message: 'A room with that name already exists.' }, 409)
    }
    throw error
  }

  return privateJson(c, { room: mapRoomSummary(roomRow, user.sub, true) }, 201)
})

room.post('/rooms/:roomId/unlock', async (c) => {
  const user = c.get('user')
  const db = c.get('db')
  const roomRow = await findRoom(db, c.req.param('roomId'))
  if (!roomRow) return c.json({ error: 'room_not_found', message: 'That room no longer exists.' }, 404)

  const limit = await rateLimit(
    db,
    'room:unlock',
    c.req.raw,
    8,
    RATE_WINDOWS.auth,
    `${user.sub}:${roomRow.id}`,
  )
  if (!limit.allowed) return tooManyRequests(c, limit)

  if (roomRow.visibility !== 'private') {
    return privateJson(c, { ok: true, room: mapRoomSummary(roomRow, user.sub, true) })
  }
  if (!roomRow.password_hash) {
    console.error('private_room_missing_password_hash', roomRow.id)
    return c.json({ error: 'room_locked', message: 'This room cannot be unlocked right now.' }, 500)
  }

  const input = await c
    .req
    .json<{ password?: unknown }>()
    .catch(() => ({}) as { password?: unknown })
  if (!validRoomPassword(input.password) || !(await verifyPassword(input.password, roomRow.password_hash))) {
    return c.json({ error: 'wrong_password', message: 'That password is not right.' }, 403)
  }

  await db
    .prepare(`INSERT INTO room_access (room_id, user_sub, created_at) VALUES (?, ?, ?) ON CONFLICT(room_id, user_sub) DO NOTHING`)
    .bind(roomRow.id, user.sub, now())
    .run()
  return privateJson(c, { ok: true, room: mapRoomSummary(roomRow, user.sub, true) })
})

room.get('/rooms/:roomId', async (c) => {
  const roomRow = await findRoom(c.get('db'), c.req.param('roomId'))
  if (!roomRow) return c.json({ error: 'room_not_found', message: 'That room no longer exists.' }, 404)
  if (!(await hasRoomAccess(c.get('db'), roomRow, c.get('user').sub))) return lockedRoom(c)
  return roomSnapshot(c, roomRow)
})

room.get('/rooms/:roomId/attachments/:attachmentId', async (c) => {
  const roomRow = await findRoom(c.get('db'), c.req.param('roomId'))
  if (!roomRow) return c.json({ error: 'not_found' }, 404)
  if (!(await hasRoomAccess(c.get('db'), roomRow, c.get('user').sub))) return lockedRoom(c)
  const row = await c
    .get('db')
    .prepare(
      `SELECT name, mime, kind, data FROM room_message_attachments
       WHERE room = ? AND id = ?`,
    )
    .bind(roomRow.id, c.req.param('attachmentId'))
    .first<{ name: string; mime: string; kind: string; data: string }>()
  if (!row || row.mime === 'text/uri-list') return c.json({ error: 'not_found' }, 404)

  const headers: Record<string, string> = {
    'content-type': row.mime,
    'cache-control': 'private, max-age=1800',
    'x-content-type-options': 'nosniff',
  }
  if (row.kind === 'image') {
    let bytes: Uint8Array
    try {
      const binary = atob(row.data)
      bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
    } catch {
      return c.json({ error: 'not_found' }, 404)
    }
    headers['content-length'] = String(bytes.byteLength)
    headers['content-disposition'] = 'inline'
    return new Response(bytes.buffer as ArrayBuffer, { headers })
  }

  const body = new TextEncoder().encode(row.data)
  headers['content-length'] = String(body.byteLength)
  headers['content-disposition'] = `attachment; filename*=UTF-8''${encodeURIComponent(row.name)}`
  return new Response(body, { headers })
})

async function sendMessage(c: Context<AppContext>, roomRow: ChatRoomRow) {
  const user = c.get('user')
  const db = c.get('db')
  const input = await c.req
    .json<{ body?: unknown; attachments?: unknown }>()
    .catch(() => ({}) as { body?: unknown; attachments?: unknown })
  let attachments: StoredAttachment[] = []
  try {
    attachments = parseAttachments(input.attachments)
  } catch (error) {
    if (error instanceof AttachmentValidationError) {
      return c.json({ error: 'attachment', message: error.message }, 400)
    }
    throw error
  }
  if (typeof input.body === 'string' && input.body.length > ROOM_MESSAGE_CHARS) {
    return c.json(
      { error: 'too_long', message: `Keep room messages to ${ROOM_MESSAGE_CHARS} characters.` },
      400,
    )
  }
  const content = cleanRoomMessage(input.body) ?? ''
  if (!content && !attachments.length) return c.json({ error: 'empty', message: 'Write a message first.' }, 400)

  const at = now()
  await purgeExpiredRoomMessages(db, at, roomRow.id)
  const recent = await db
    .prepare(
      `SELECT COUNT(*) AS n, MAX(created_at) AS last
       FROM room_messages
       WHERE author_sub = ? AND room = ? AND created_at > ?`,
    )
    .bind(user.sub, roomRow.id, at - RATE_WINDOW_MS)
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
    room: roomRow.id,
    body: content,
    authorName: roomAuthorName(user, authorId),
    authorId,
    createdAt: at,
    ...(attachments.length ? { attachments: roomAttachmentMeta(attachments, roomRow.id) } : {}),
  }
  await db.batch([
    db
      .prepare(
        `INSERT INTO room_messages (id, room, author_sub, author_id, author_name, body, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(message.id, roomRow.id, user.sub, authorId, message.authorName, message.body, message.createdAt),
    ...attachments.map((attachment, position) =>
      db
        .prepare(
          `INSERT INTO room_message_attachments
             (id, message_id, room, owner_sub, name, mime, size, kind, data, position, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          attachment.id,
          message.id,
          roomRow.id,
          user.sub,
          attachment.name,
          attachment.mime,
          attachment.size,
          attachment.kind,
          attachment.data,
          position,
          at,
        ),
    ),
    db
      .prepare(
        `DELETE FROM room_messages
         WHERE room = ? AND created_at < COALESCE((
           SELECT created_at FROM room_messages WHERE room = ?
           ORDER BY created_at DESC LIMIT 1 OFFSET ${KEEP_MESSAGES}
         ), 0)`,
      )
      .bind(roomRow.id, roomRow.id),
    db
      .prepare(
        `DELETE FROM room_message_attachments
         WHERE room = ? AND message_id NOT IN (SELECT id FROM room_messages WHERE room = ?)`,
      )
      .bind(roomRow.id, roomRow.id),
  ])

  // The row is committed first. A failed live publish must not turn a saved
  // message into an error; clients reload the snapshot on their next ready.
  let live = true
  try {
    await publishRealtime(c.env, { room: roomRow.id, event: 'room_message', data: message })
  } catch (error) {
    live = false
    console.warn('room_publish_failed', error)
  }
  return privateJson(c, { message, live }, 201)
}

room.post('/rooms/:roomId/messages', async (c) => {
  const roomRow = await findRoom(c.get('db'), c.req.param('roomId'))
  if (!roomRow) return c.json({ error: 'room_not_found', message: 'That room no longer exists.' }, 404)
  if (!(await hasRoomAccess(c.get('db'), roomRow, c.get('user').sub))) return lockedRoom(c)
  return sendMessage(c, roomRow)
})

room.get('/room', async (c) => {
  const roomRow = await findRoom(c.get('db'), ROOM_ID)
  if (!roomRow) return c.json({ error: 'room_not_found', message: 'The general room is missing.' }, 500)
  return roomSnapshot(c, roomRow)
})

room.post('/room/messages', async (c) => {
  const roomRow = await findRoom(c.get('db'), ROOM_ID)
  if (!roomRow) return c.json({ error: 'room_not_found', message: 'The general room is missing.' }, 500)
  return sendMessage(c, roomRow)
})

room.post('/realtime/ticket', async (c) => {
  const input = await c.req.json<{ room?: unknown }>().catch(() => null)
  if (!input || typeof input.room !== 'string') {
    return c.json({ error: 'room', message: 'Unknown room.' }, 400)
  }
  const roomRow = await findRoom(c.get('db'), input.room)
  if (!roomRow) return c.json({ error: 'room', message: 'Unknown room.' }, 400)
  const user = c.get('user')
  if (!(await hasRoomAccess(c.get('db'), roomRow, user.sub))) return lockedRoom(c)

  if (!c.env.REALTIME) {
    // This is a normal fallback, not a server failure: the browser keeps the
    // HTTP room and polling path. A 200 with live:false stops the client from
    // retrying and keeps the aggregate 5xx monitor free of expected 503s.
    return privateJson(c, { ok: false, live: false, message: 'Live updates are not enabled on this deployment.' })
  }
  try {
    const ticket = await createRealtimeTicket(c.env, {
      room: roomRow.id,
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
