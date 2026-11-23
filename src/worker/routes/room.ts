import { Hono, type Context } from 'hono'

import {
  cleanReactionEmoji,
  MAX_ROOMS,
  ROOM_ATTACHMENT_ROOM_BYTES,
  ROOM_ATTACHMENT_USER_BYTES,
  ROOM_DISPLAY_NAME_CHARS,
  ROOM_ID,
  ROOM_MESSAGE_CHARS,
  ROOM_MESSAGE_TTL_MS,
  ROOM_NAME_CHARS,
  ROOM_PASSWORD_MAX_CHARS,
  ROOM_PASSWORD_MIN_CHARS,
} from '../../shared/config'
import type { RoomActivity, RoomActivityItem, RoomList, RoomMessage, RoomReaction, RoomSnapshot, RoomSummary, RoomVisibility } from '../../shared/types'
import { attachmentObjectKeys, contentDisposition, deleteAttachmentObjects, readAttachmentBytes, readAttachmentThumbnail, storeAttachmentObjects } from '../attachment-storage'
import { AttachmentValidationError, attachmentMeta, groupAttachmentMeta, parseAttachments, type StoredAttachment } from '../attachments'
import { appOrigin, DEV_USER, hashPassword, privateJson, verifyPassword } from '../auth'
import { id, now } from '../db'
import type { AppContext } from '../env'
import { RATE_WINDOWS, rateLimit, tooManyRequests } from '../rate-limit'
import { createRealtimeTicket, publishRealtime } from '../realtime'
import {
  backfillRoomPeople,
  cleanRoomPersonId,
  cleanRoomPersonLabel,
  inviteRoomPeople,
  listRoomInvites,
  listRoomPeople,
  markRoomInvitesSeen,
  rememberRoomPerson,
  ROOM_PERSON_LABEL_CHARS,
  roomAuthorId,
  setRoomPersonLabel,
  setRoomPersonSaved,
} from '../room-people'

export { roomAuthorId }

export const room = new Hono<AppContext>()

const HISTORY_LIMIT = 60
const KEEP_MESSAGES = 200
const RATE_WINDOW_MS = 60_000
const RATE_LIMIT = 20
const MIN_GAP_MS = 1_500
const ROOM_ID_CHARS = 64
const ROOM_CLEANUP_INTERVAL_MS = 60_000
let lastRoomCleanup = 0

type RoomRow = {
  id: string
  room: string
  author_sub: string
  author_id: string
  author_name: string
  author_email?: string | null
  body: string
  created_at: number
}

type ChatRoomRow = {
  id: string
  name: string
  visibility: RoomVisibility
  password_hash: string | null
  created_by: string
  invite_token: string | null
  created_at: number
  last_active_at?: number
}

type RoomListRow = Omit<ChatRoomRow, 'password_hash'> & { unlocked: number; invited: number | null }

type RoomActivityRow = RoomRow & { room_name: string }

type RoomReactionRow = {
  message_id: string
  reaction: string
  count: number
  mine: number
}

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

/** The name shown beside a message; separate from the login identity. */
export function cleanRoomDisplayName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const name = value
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!name || name.length > ROOM_DISPLAY_NAME_CHARS) return null
  return name
}

/** Resolve the public message tag used when renaming someone in a room. */
export function cleanRoomAuthorId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const id = value.trim().toLowerCase()
  return /^[a-f0-9]{12}$/.test(id) ? id : null
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

function newRoomInviteToken(): string {
  return crypto.randomUUID().replace(/-/g, '')
}

function cleanRoomInviteToken(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const token = value.trim().toLowerCase()
  return /^[a-f0-9]{32}$/.test(token) ? token : null
}

export function roomAuthorName(
  user: { name?: string; email?: string },
  authorId: string,
  displayName?: string | null,
): string {
  const custom = cleanRoomDisplayName(displayName)
  if (custom) return custom
  const name = user.name?.replace(/\s+/g, ' ').trim()
  if (name && name.toLowerCase() !== 'guest') return name.slice(0, ROOM_DISPLAY_NAME_CHARS)
  const local = user.email?.split('@')[0]?.replace(/[._-]+/g, ' ').trim()
  if (local) {
    return local
      .split(/\s+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
      .slice(0, ROOM_DISPLAY_NAME_CHARS)
  }
  return `Guest ${authorId.slice(0, 4).toUpperCase()}`
}

export function mapRoomMessage(row: RoomRow, authorOwner = false): RoomMessage {
  return {
    id: row.id,
    room: row.room,
    body: row.body,
    authorName: row.author_name,
    authorId: row.author_id,
    ...(authorOwner ? { authorOwner: true } : {}),
    createdAt: Number(row.created_at),
  }
}

/**
 * A small marker for the developer's own account, without exposing an account
 * id or email to the room. The local development identity always qualifies;
 * deployed copies can also pin OWNER_SUB or use the owner email.
 */
export function isRoomOwnerMessage(
  env: { OWNER_SUB?: string },
  authorSub: string,
  email?: string | null,
): boolean {
  if (authorSub === DEV_USER.sub) return true
  const configured = env.OWNER_SUB?.trim()
  if (configured && authorSub === configured) return true
  return /^davehall/i.test(email?.trim() ?? '')
}

function mapRoomReactionRow(row: RoomReactionRow): RoomReaction {
  return { reaction: row.reaction, count: Number(row.count), mine: Number(row.mine) === 1 }
}

function groupRoomReactions(rows: RoomReactionRow[]): Map<string, RoomReaction[]> {
  const grouped = new Map<string, RoomReaction[]>()
  for (const row of rows) {
    const list = grouped.get(row.message_id) ?? []
    list.push(mapRoomReactionRow(row))
    grouped.set(row.message_id, list)
  }
  return grouped
}

export function mapRoomSummary(
  row: ChatRoomRow | RoomListRow,
  userSub: string,
  unlocked?: boolean,
  invited = false,
): RoomSummary {
  const visibility: RoomVisibility = row.visibility === 'private' ? 'private' : 'public'
  return {
    id: row.id,
    name: row.name,
    visibility,
    createdAt: Number(row.created_at),
    createdByMe: row.created_by === userSub,
    unlocked: unlocked ?? (visibility === 'public' || row.created_by === userSub),
    ...(invited ? { invited: true } : {}),
  }
}

/** A message at or before this timestamp is no longer part of the room. */
export function roomMessageCutoff(at = now()): number {
  return at - ROOM_MESSAGE_TTL_MS
}

/** R2 keys for rows an upcoming D1 delete is about to remove. */
async function attachmentKeys(db: D1Database, sql: string, ...values: unknown[]): Promise<string[]> {
  const rows = await db.prepare(sql).bind(...values).all<{ id: string }>()
  return rows.results.flatMap((row) => attachmentObjectKeys('room', row.id))
}

/** Permanently remove messages whose thirty-minute window has closed. */
export async function purgeExpiredRoomMessages(
  db: D1Database,
  at = now(),
  roomId = ROOM_ID,
  files?: R2Bucket,
): Promise<void> {
  const cutoff = roomMessageCutoff(at)
  const keys = files
    ? await attachmentKeys(
        db,
        `SELECT id FROM room_message_attachments
         WHERE room = ?
           AND (
             created_at <= ?
             OR NOT EXISTS (
               SELECT 1 FROM room_messages m
               WHERE m.id = room_message_attachments.message_id
                 AND m.room = room_message_attachments.room
             )
           )`,
        roomId,
        cutoff,
      )
    : []
  await db.batch([
    db
      .prepare(
        `DELETE FROM room_message_attachments
         WHERE room = ?
           AND (
             created_at <= ?
             OR NOT EXISTS (
               SELECT 1 FROM room_messages m
               WHERE m.id = room_message_attachments.message_id
                 AND m.room = room_message_attachments.room
             )
           )`,
      )
      .bind(roomId, cutoff),
    db
      .prepare(
        `DELETE FROM room_message_reactions
         WHERE room = ?
           AND (
             message_id IN (SELECT id FROM room_messages WHERE room = ? AND created_at <= ?)
             OR NOT EXISTS (
               SELECT 1 FROM room_messages m
               WHERE m.id = room_message_reactions.message_id
                 AND m.room = room_message_reactions.room
             )
           )`,
      )
      .bind(roomId, roomId, cutoff),
    db.prepare(`DELETE FROM room_messages WHERE room = ? AND created_at <= ?`).bind(roomId, cutoff),
  ])
  await deleteAttachmentObjects(files, keys)
}

/**
 * Global retention sweep. Besides expired messages, it removes attachment
 * rows whose parent message is gone, so a failed insert or a room deleted by
 * another path cannot leave private bytes behind.
 */
export async function purgeRoomStorage(db: D1Database, at = now(), files?: R2Bucket): Promise<void> {
  const cutoff = roomMessageCutoff(at)
  const keys = files
    ? await attachmentKeys(
        db,
        `SELECT id FROM room_message_attachments
         WHERE (
           created_at <= ?
             OR NOT EXISTS (
               SELECT 1 FROM room_messages m
               WHERE m.id = room_message_attachments.message_id
                 AND m.room = room_message_attachments.room
             )
           )`,
        cutoff,
      )
    : []
  await db.batch([
    db.prepare(`DELETE FROM room_messages WHERE created_at <= ?`).bind(cutoff),
    db
      .prepare(
        `DELETE FROM room_message_attachments
         WHERE created_at <= ?
            OR NOT EXISTS (
              SELECT 1 FROM room_messages m
              WHERE m.id = room_message_attachments.message_id
                AND m.room = room_message_attachments.room
            )`,
      )
      .bind(cutoff),
    db
      .prepare(
        `DELETE FROM room_message_reactions
         WHERE NOT EXISTS (
           SELECT 1 FROM room_messages m
           WHERE m.id = room_message_reactions.message_id
             AND m.room = room_message_reactions.room
         )`,
      ),
  ])
  await deleteAttachmentObjects(files, keys)
}

/** Remove attachment rows orphaned by the room's 200-message window. */
async function purgeRoomOrphanAttachments(db: D1Database, roomId: string, files?: R2Bucket): Promise<void> {
  const keys = files
    ? await attachmentKeys(
        db,
        `SELECT id FROM room_message_attachments
         WHERE room = ? AND message_id NOT IN (SELECT id FROM room_messages WHERE room = ?)`,
        roomId,
        roomId,
      )
    : []
  await db
    .prepare(
      `DELETE FROM room_message_attachments
       WHERE room = ? AND message_id NOT IN (SELECT id FROM room_messages WHERE room = ?)`,
    )
    .bind(roomId, roomId)
    .run()
  await db
    .prepare(
      `DELETE FROM room_message_reactions
       WHERE room = ? AND message_id NOT IN (SELECT id FROM room_messages WHERE room = ?)`,
    )
    .bind(roomId, roomId)
    .run()
  await deleteAttachmentObjects(files, keys)
}

/** Remove a room and everything that only existed because of it. */
async function deleteRoomStorage(db: D1Database, roomId: string, files?: R2Bucket): Promise<boolean> {
  if (roomId === ROOM_ID) return false
  const keys = files
    ? await attachmentKeys(db, `SELECT id FROM room_message_attachments WHERE room = ?`, roomId)
    : []
  await db.batch([
    db.prepare(`DELETE FROM room_message_attachments WHERE room = ?`).bind(roomId),
    db.prepare(`DELETE FROM room_message_reactions WHERE room = ?`).bind(roomId),
    db.prepare(`DELETE FROM room_messages WHERE room = ?`).bind(roomId),
    db.prepare(`DELETE FROM room_access WHERE room_id = ?`).bind(roomId),
    db.prepare(`DELETE FROM room_member_names WHERE room_id = ?`).bind(roomId),
    db.prepare(`DELETE FROM chat_rooms WHERE id = ? AND id <> ?`).bind(roomId, ROOM_ID),
  ])
  await deleteAttachmentObjects(files, keys)
  return true
}

/**
 * Run at most one retention sweep per isolate per minute, off the response
 * path. Only expired messages and their bytes are removed: a room itself stays
 * until its creator deletes it.
 */
function scheduleRoomCleanup(c: Context<AppContext>, at: number) {
  if (at - lastRoomCleanup < ROOM_CLEANUP_INTERVAL_MS) return
  lastRoomCleanup = at
  const cleanup = purgeRoomStorage(c.get('db'), at, c.env.FILES)
    .catch((error) => console.warn('room_cleanup_failed', error))
  try {
    c.executionCtx.waitUntil(cleanup)
  } catch {
    // Local route checks may not provide an execution context. The sweep is
    // still started; its own rejection is handled above.
  }
}

async function roomAttachmentUsage(
  db: D1Database,
  owner: string,
  roomId: string,
): Promise<{ userBytes: number; roomBytes: number }> {
  // Bytes leave D1 for R2, so account for their decoded size, not the old
  // base64 payload length.
  const row = await db
    .prepare(
      `SELECT
         (SELECT COALESCE(SUM(size), 0)
          FROM room_message_attachments WHERE owner_sub = ?) AS user_bytes,
         (SELECT COALESCE(SUM(size), 0)
          FROM room_message_attachments WHERE room = ?) AS room_bytes`,
    )
    .bind(owner, roomId)
    .first<{ user_bytes: number; room_bytes: number }>()
  return {
    userBytes: Number(row?.user_bytes ?? 0),
    roomBytes: Number(row?.room_bytes ?? 0),
  }
}

function attachmentQuotaScope(
  usage: { userBytes: number; roomBytes: number },
  incomingBytes: number,
): 'user' | 'room' | null {
  if (usage.userBytes + incomingBytes > ROOM_ATTACHMENT_USER_BYTES) return 'user'
  if (usage.roomBytes + incomingBytes > ROOM_ATTACHMENT_ROOM_BYTES) return 'room'
  return null
}

function attachmentQuotaResponse(c: Context<AppContext>, scope: 'user' | 'room') {
  return c.json(
    {
      error: 'attachment_quota',
      scope,
      message:
        scope === 'user'
          ? 'You have reached your room media limit. Older files expire after 30 minutes.'
          : 'This room has reached its media limit. Older files expire after 30 minutes.',
    },
    413,
  )
}

/** Keep the old lobby id working for tabs that were open during a deploy. */
function canonicalRoomId(value: string): string {
  return value === 'lobby' ? ROOM_ID : value
}

async function findRoom(db: D1Database, roomId: string): Promise<ChatRoomRow | undefined> {
  const key = canonicalRoomId(roomId)
  if (!key || key.length > ROOM_ID_CHARS) return undefined
  const row = await db
    .prepare(`SELECT id, name, visibility, password_hash, created_by, invite_token, created_at, last_active_at FROM chat_rooms WHERE id = ?`)
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
  scheduleRoomCleanup(c, at)
  await purgeExpiredRoomMessages(db, at, roomRow.id, c.env.FILES)
  const rows = await db
    .prepare(
      `SELECT m.id, m.room, m.author_sub, m.author_id,
              COALESCE(n.display_name, p.display_name, m.author_name) AS author_name,
              u.email AS author_email, m.body, m.created_at
       FROM room_messages m
       LEFT JOIN room_profiles p ON p.user_sub = m.author_sub
       LEFT JOIN room_member_names n ON n.room_id = m.room AND n.user_sub = m.author_sub
       LEFT JOIN auth_users u ON ('account:' || u.id) = m.author_sub
       WHERE m.room = ? AND m.created_at > ?
       ORDER BY m.created_at DESC, m.id DESC LIMIT ?`,
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
  const reactionRows = ids.length
    ? await db
        .prepare(
          `SELECT message_id, reaction, COUNT(*) AS count,
                  MAX(CASE WHEN author_sub = ? THEN 1 ELSE 0 END) AS mine
           FROM room_message_reactions
           WHERE room = ? AND message_id IN (${ids.map(() => '?').join(',')})
           GROUP BY message_id, reaction
           ORDER BY MIN(updated_at) ASC, reaction ASC`,
        )
        .bind(user.sub, roomRow.id, ...ids)
        .all<RoomReactionRow>()
    : { results: [] }
  const reactionsByMessage = groupRoomReactions(reactionRows.results)
  const authorId = await roomAuthorId(user.sub)
  const profile = await db
    .prepare(`SELECT display_name FROM room_profiles WHERE user_sub = ?`)
    .bind(user.sub)
    .first<{ display_name: string }>()
  const memberName = await db
    .prepare(`SELECT display_name FROM room_member_names WHERE room_id = ? AND user_sub = ?`)
    .bind(roomRow.id, user.sub)
    .first<{ display_name: string }>()
  const body: RoomSnapshot = {
    room: roomRow.id,
    name: roomRow.name,
    visibility: roomRow.visibility === 'private' ? 'private' : 'public',
    createdByMe: roomRow.created_by === user.sub,
    messages: rows.results.reverse().map((row) => {
      const message = mapRoomMessage(row, isRoomOwnerMessage(c.env, row.author_sub, row.author_email))
      const files = filesByMessage.get(message.id)
      const reactions = reactionsByMessage.get(message.id)
      return {
        ...message,
        ...(files?.length ? { attachments: files } : {}),
        ...(reactions?.length ? { reactions } : {}),
      }
    }),
    viewerId: authorId,
    viewerName: roomAuthorName(user, authorId, memberName?.display_name ?? profile?.display_name),
    viewerOwner: isRoomOwnerMessage(c.env, user.sub, user.email),
    asOf: at,
  }
  return privateJson(c, body)
}

room.get('/rooms', async (c) => {
  const user = c.get('user')
  const at = now()
  scheduleRoomCleanup(c, at)
  await rememberRoomPerson(c.get('db'), user, at).catch((error) =>
    console.warn('room_people_touch_failed', error),
  )
  const rows = await c
    .get('db')
    .prepare(
      `SELECT r.id, r.name, r.visibility, r.created_by, r.invite_token, r.created_at,
              CASE WHEN r.visibility = 'public' OR r.created_by = ? OR a.user_sub IS NOT NULL THEN 1 ELSE 0 END AS unlocked,
              COALESCE(a.invited, 0) AS invited
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
    items: rows.results.map((row) =>
      mapRoomSummary(row, user.sub, Boolean(row.unlocked), Boolean(row.invited)),
    ),
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
      `SELECT m.id, m.room, m.author_sub, m.author_id,
              COALESCE(n.display_name, p.display_name, m.author_name) AS author_name,
              m.body, m.created_at, r.name AS room_name
       FROM room_messages m
       JOIN chat_rooms r ON r.id = m.room
       LEFT JOIN room_profiles p ON p.user_sub = m.author_sub
       LEFT JOIN room_member_names n ON n.room_id = m.room AND n.user_sub = m.author_sub
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

/** Everyone Ink has seen, with the viewer's saved quick-add list marked. */
room.get('/rooms/people', async (c) => {
  const user = c.get('user')
  const db = c.get('db')
  const at = now()
  await rememberRoomPerson(db, user, at).catch((error) => console.warn('room_people_touch_failed', error))
  await backfillRoomPeople(db).catch((error) => console.warn('room_people_backfill_failed', error))
  return privateJson(c, await listRoomPeople(db, user.sub, at))
})

/** Save or remove a person from the quick-add list. */
room.patch('/rooms/people/:personId/saved', async (c) => {
  const user = c.get('user')
  const db = c.get('db')
  const personId = cleanRoomPersonId(c.req.param('personId'))
  if (!personId) return c.json({ error: 'invalid_person', message: 'That person could not be found.' }, 400)
  const input = await c.req.json<{ saved?: unknown }>().catch(() => ({} as { saved?: unknown }))
  if (typeof input.saved !== 'boolean') {
    return c.json({ error: 'invalid_saved', message: 'Choose whether to save that person.' }, 400)
  }
  const limit = await rateLimit(db, 'room:people_saved', c.req.raw, 120, RATE_WINDOWS.auth, user.sub)
  if (!limit.allowed) return tooManyRequests(c, limit)
  const saved = await setRoomPersonSaved(db, user.sub, personId, input.saved)
  if (saved === null) return c.json({ error: 'person_not_found', message: 'That person could not be found.' }, 404)
  return privateJson(c, { ok: true, personId, saved })
})

/**
 * Give someone a private name in the viewer's own people list. It never changes
 * the name that person uses in rooms; it only makes a guest tag recognisable
 * when inviting them again. A null or empty label restores their own name.
 */
room.patch('/rooms/people/:personId/label', async (c) => {
  const user = c.get('user')
  const db = c.get('db')
  const personId = cleanRoomPersonId(c.req.param('personId'))
  if (!personId) return c.json({ error: 'invalid_person', message: 'That person could not be found.' }, 400)
  const input = await c.req.json<{ label?: unknown }>().catch(() => ({} as { label?: unknown }))
  if (!('label' in input)) {
    return c.json({ error: 'invalid_label', message: 'Choose a name for that person.' }, 400)
  }
  const cleared = input.label === null || input.label === ''
  const label = cleared ? null : cleanRoomPersonLabel(input.label)
  if (!cleared && !label) {
    return c.json(
      { error: 'invalid_label', message: `Use a name from 1 to ${ROOM_PERSON_LABEL_CHARS} characters.` },
      400,
    )
  }
  const limit = await rateLimit(db, 'room:people_label', c.req.raw, 120, RATE_WINDOWS.auth, user.sub)
  if (!limit.allowed) return tooManyRequests(c, limit)
  const saved = await setRoomPersonLabel(db, user.sub, personId, label)
  if (saved === undefined) return c.json({ error: 'person_not_found', message: 'That person could not be found.' }, 404)
  return privateJson(c, { ok: true, personId, label: saved })
})

/** Unseen direct invitations, for the app-wide notification poll. */
room.get('/rooms/invites', async (c) => {
  const user = c.get('user')
  const at = now()
  return privateJson(c, { items: await listRoomInvites(c.get('db'), user.sub, at), asOf: at })
})

room.post('/rooms/invites/seen', async (c) => {
  const user = c.get('user')
  const db = c.get('db')
  const input = await c.req.json<{ roomIds?: unknown }>().catch(() => ({} as { roomIds?: unknown }))
  const roomIds = Array.isArray(input.roomIds) ? input.roomIds.filter((id): id is string => typeof id === 'string') : []
  const limit = await rateLimit(db, 'room:invites_seen', c.req.raw, 120, RATE_WINDOWS.auth, user.sub)
  if (!limit.allowed) return tooManyRequests(c, limit)
  await markRoomInvitesSeen(db, user.sub, roomIds)
  return privateJson(c, { ok: true })
})

/**
 * Change how a name appears in a room. Without a target this updates the
 * viewer's own global chat name. With a target it leaves a room-scoped alias,
 * so nobody can overwrite another person's name in every room they visit.
 */
room.patch('/rooms/profile', async (c) => {
  const user = c.get('user')
  const db = c.get('db')
  const limit = await rateLimit(db, 'room:profile', c.req.raw, 10, RATE_WINDOWS.auth, user.sub)
  if (!limit.allowed) return tooManyRequests(c, limit)

  const input = await c.req
    .json<{ name?: unknown; room?: unknown; targetId?: unknown }>()
    .catch(() => null)
  if (!input) return c.json({ error: 'invalid_name', message: 'Choose a name for the room.' }, 400)
  const name = cleanRoomDisplayName(input.name)
  if (!name) {
    return c.json(
      {
        error: 'invalid_name',
        message: `Use a chat name from 1 to ${ROOM_DISPLAY_NAME_CHARS} characters.`,
      },
      400,
    )
  }
  const targetId = input.targetId === undefined ? null : cleanRoomAuthorId(input.targetId)
  if (input.targetId !== undefined && !targetId) {
    return c.json({ error: 'invalid_target', message: 'That person could not be found in this room.' }, 400)
  }

  const at = now()
  if (targetId) {
    if (typeof input.room !== 'string') {
      return c.json({ error: 'invalid_room', message: 'Choose a room before changing a name.' }, 400)
    }
    const roomRow = await findRoom(db, input.room)
    if (!roomRow || !(await hasRoomAccess(db, roomRow, user.sub))) return lockedRoom(c)

    // A public author tag only identifies someone who has actually chatted
    // here, so the endpoint cannot rename arbitrary accounts by guessing a tag.
    const target = await db
      .prepare(
        `SELECT author_sub FROM room_messages
         WHERE room = ? AND author_id = ? AND created_at > ?
         ORDER BY created_at DESC LIMIT 1`,
      )
      .bind(roomRow.id, targetId, roomMessageCutoff(at))
      .first<{ author_sub: string }>()
    if (!target) {
      return c.json({ error: 'not_in_room', message: 'That person is not chatting in this room.' }, 404)
    }

    if (target.author_sub !== user.sub) {
      await db
        .prepare(
          `INSERT INTO room_member_names (room_id, user_sub, display_name, set_by, updated_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(room_id, user_sub) DO UPDATE SET
             display_name = excluded.display_name,
             set_by = excluded.set_by,
             updated_at = excluded.updated_at`,
        )
        .bind(roomRow.id, target.author_sub, name, user.sub, at)
        .run()

      // Everyone in the room updates the name beside that person's existing
      // messages immediately; a snapshot will reconcile if the socket is down.
      try {
        await publishRealtime(c.env, {
          room: roomRow.id,
          event: 'room_profile',
          data: { authorId: targetId, authorName: name },
        })
      } catch (error) {
        console.warn('room_profile_publish_failed', error)
      }

      return privateJson(c, { name, viewerId: targetId, targetId })
    }
  }

  // Changing your own name takes it back from any room nickname someone else
  // gave you. Other rooms pick the new name up from their next snapshot.
  await db.batch([
    db
      .prepare(
        `INSERT INTO room_profiles (user_sub, display_name, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(user_sub) DO UPDATE SET
           display_name = excluded.display_name,
           updated_at = excluded.updated_at`,
      )
      .bind(user.sub, name, at),
    db.prepare(`DELETE FROM room_member_names WHERE user_sub = ?`).bind(user.sub),
  ])
  await rememberRoomPerson(db, { ...user, name }, at).catch((error) =>
    console.warn('room_people_touch_failed', error),
  )

  const authorId = await roomAuthorId(user.sub)
  if (typeof input.room === 'string') {
    const roomRow = await findRoom(db, input.room)
    if (roomRow && (await hasRoomAccess(db, roomRow, user.sub))) {
      try {
        await publishRealtime(c.env, {
          room: roomRow.id,
          event: 'room_profile',
          data: { authorId, authorName: name },
        })
      } catch (error) {
        console.warn('room_profile_publish_failed', error)
      }
    }
  }

  return privateJson(c, { name, viewerId: authorId })
})

room.post('/rooms', async (c) => {
  const user = c.get('user')
  const db = c.get('db')
  const limit = await rateLimit(db, 'room:create', c.req.raw, 5, RATE_WINDOWS.chat, user.sub)
  if (!limit.allowed) return tooManyRequests(c, limit)

  const input = await c
    .req
    .json<{ name?: unknown; visibility?: unknown; password?: unknown; inviteIds?: unknown }>()
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
    invite_token: null,
    created_at: createdAt,
    last_active_at: createdAt,
  }

  try {
    const statements = [
      db
        .prepare(
          `INSERT INTO chat_rooms (id, name, visibility, password_hash, created_by, created_at, last_active_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(roomRow.id, roomRow.name, roomRow.visibility, roomRow.password_hash, roomRow.created_by, roomRow.created_at, createdAt),
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

  let invited = 0
  if (visibility === 'private' && Array.isArray(input.inviteIds) && input.inviteIds.length) {
    try {
      invited = (await inviteRoomPeople(db, roomRow.id, user.sub, input.inviteIds)).length
    } catch (error) {
      // The room is already created. A failed quick-add must not make the
      // creator retry and hit the duplicate-name guard.
      console.warn('room_quick_invite_failed', error)
    }
  }
  return privateJson(c, { room: mapRoomSummary(roomRow, user.sub, true), invited }, 201)
})

room.delete('/rooms/:roomId', async (c) => {
  const user = c.get('user')
  const db = c.get('db')
  const roomRow = await findRoom(db, c.req.param('roomId'))
  if (!roomRow) return c.json({ error: 'room_not_found', message: 'That room no longer exists.' }, 404)
  if (roomRow.id === ROOM_ID) {
    return c.json({ error: 'cannot_delete_room', message: 'The General room cannot be deleted.' }, 400)
  }
  if (roomRow.created_by !== user.sub) {
    return c.json({ error: 'not_room_owner', message: 'Only the room’s creator can delete it.' }, 403)
  }
  const limit = await rateLimit(db, 'room:delete', c.req.raw, 5, RATE_WINDOWS.chat, user.sub)
  if (!limit.allowed) return tooManyRequests(c, limit)

  await deleteRoomStorage(db, roomRow.id, c.env.FILES)
  try {
    await publishRealtime(c.env, { room: roomRow.id, event: 'room_deleted', data: { roomId: roomRow.id } })
  } catch (error) {
    // The delete is already committed; a missed broadcast only delays another
    // participant’s return to General until their next room-list refresh.
    console.warn('room_delete_publish_failed', error)
  }
  return privateJson(c, { ok: true, roomId: roomRow.id })
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

/** The creator can turn a private room into a shareable, password-free link. */
room.post('/rooms/:roomId/invite', async (c) => {
  const user = c.get('user')
  const db = c.get('db')
  const roomRow = await findRoom(db, c.req.param('roomId'))
  if (!roomRow) return c.json({ error: 'room_not_found', message: 'That room no longer exists.' }, 404)
  if (roomRow.visibility !== 'private') {
    return c.json({ error: 'public_room', message: 'Public rooms already have an open link.' }, 400)
  }
  if (roomRow.created_by !== user.sub) {
    return c.json({ error: 'forbidden', message: 'Only the room creator can invite people.' }, 403)
  }
  const limit = await rateLimit(db, 'room:invite', c.req.raw, 10, RATE_WINDOWS.auth, user.sub)
  if (!limit.allowed) return tooManyRequests(c, limit)

  let token = roomRow.invite_token
  if (!token) {
    token = newRoomInviteToken()
    await db.prepare(`UPDATE chat_rooms SET invite_token = ? WHERE id = ?`).bind(token, roomRow.id).run()
  }
  const url = new URL('/join', appOrigin(c.env, c.req.raw))
  url.searchParams.set('room', roomRow.id)
  url.searchParams.set('invite', token)
  return privateJson(c, { url: url.toString() })
})

/** Invite one or more directory people directly, even while they are offline. */
room.post('/rooms/:roomId/invite/people', async (c) => {
  const user = c.get('user')
  const db = c.get('db')
  const roomRow = await findRoom(db, c.req.param('roomId'))
  if (!roomRow) return c.json({ error: 'room_not_found', message: 'That room no longer exists.' }, 404)
  if (roomRow.visibility !== 'private') {
    return c.json({ error: 'public_room', message: 'Public rooms are already open to everyone.' }, 400)
  }
  if (roomRow.created_by !== user.sub) {
    return c.json({ error: 'forbidden', message: 'Only the room creator can invite people.' }, 403)
  }
  const limit = await rateLimit(db, 'room:invite_people', c.req.raw, 20, RATE_WINDOWS.auth, user.sub)
  if (!limit.allowed) return tooManyRequests(c, limit)
  const input = await c.req.json<{ personIds?: unknown }>().catch(() => ({} as { personIds?: unknown }))
  const personIds = Array.isArray(input.personIds)
    ? input.personIds.filter((id): id is string => typeof id === 'string')
    : []
  if (!personIds.length) {
    return c.json({ error: 'no_people', message: 'Choose at least one person to invite.' }, 400)
  }
  const invited = await inviteRoomPeople(db, roomRow.id, user.sub, personIds)
  return privateJson(c, {
    ok: true,
    invited: invited.length,
    people: invited.map((person) => ({ id: person.authorId, name: person.name })),
  })
})

/** A valid invite link grants access without asking for the room password. */
room.post('/rooms/:roomId/invite/accept', async (c) => {
  const user = c.get('user')
  const db = c.get('db')
  const roomRow = await findRoom(db, c.req.param('roomId'))
  if (!roomRow) return c.json({ error: 'room_not_found', message: 'That room no longer exists.' }, 404)
  if (roomRow.visibility !== 'private') {
    return privateJson(c, { ok: true, room: mapRoomSummary(roomRow, user.sub, true) })
  }
  const input = await c.req.json<{ invite?: unknown }>().catch(() => ({} as { invite?: unknown }))
  const token = cleanRoomInviteToken(input.invite)
  if (!token || !roomRow.invite_token || token !== roomRow.invite_token) {
    return c.json({ error: 'invalid_invite', message: 'This invite link is no longer valid.' }, 403)
  }
  const limit = await rateLimit(db, 'room:invite_accept', c.req.raw, 20, RATE_WINDOWS.auth, `${user.sub}:${roomRow.id}`)
  if (!limit.allowed) return tooManyRequests(c, limit)

  const at = now()
  await db
    .prepare(
      `INSERT INTO room_access
         (room_id, user_sub, created_at, invited, invited_at, invite_seen)
       VALUES (?, ?, ?, 1, ?, 1)
       ON CONFLICT(room_id, user_sub) DO UPDATE SET
         invited = 1,
         invited_at = excluded.invited_at,
         invite_seen = 1`,
    )
    .bind(roomRow.id, user.sub, at, at)
    .run()
  return privateJson(c, {
    ok: true,
    room: mapRoomSummary(roomRow, user.sub, true, roomRow.created_by !== user.sub),
  })
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
      `SELECT id, name, mime, kind, size, data, r2_key FROM room_message_attachments
       WHERE room = ? AND id = ?`,
    )
    .bind(roomRow.id, c.req.param('attachmentId'))
    .first<{ id: string; name: string; mime: string; kind: string; size: number; data: string; r2_key: string | null }>()
  if (!row || row.mime === 'text/uri-list') return c.json({ error: 'not_found' }, 404)

  const download = c.req.query('download') === '1'
  const thumbnail = row.kind === 'image' && c.req.query('thumb') === '1'
  const loaded = thumbnail
    ? await readAttachmentThumbnail(c.env.FILES, 'room', row)
    : await readAttachmentBytes(c.env.FILES, row).then((bytes) => (bytes ? { bytes, mime: row.mime } : null))
  if (!loaded) return c.json({ error: 'not_found' }, 404)
  const headers: Record<string, string> = {
    'content-type': loaded.mime,
    'content-length': String(loaded.bytes.byteLength),
    'cache-control': 'private, max-age=1800',
    'x-content-type-options': 'nosniff',
    'content-disposition': contentDisposition(row.name, row.kind === 'image' && !download),
  }
  return new Response(loaded.bytes.buffer as ArrayBuffer, { headers })
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
  await purgeExpiredRoomMessages(db, at, roomRow.id, c.env.FILES)
  if (attachments.length) {
    const incomingBytes = attachments.reduce((total, attachment) => total + attachment.size, 0)
    let usage = await roomAttachmentUsage(db, user.sub, roomRow.id)
    let quota = attachmentQuotaScope(usage, incomingBytes)
    if (quota) {
      // A stale row in another room can keep an author at their cap even though
      // its message has expired. Sweep everything once before rejecting.
      await purgeRoomStorage(db, at, c.env.FILES).catch((error) => console.warn('room_cleanup_failed', error))
      usage = await roomAttachmentUsage(db, user.sub, roomRow.id)
      quota = attachmentQuotaScope(usage, incomingBytes)
    }
    if (quota) return attachmentQuotaResponse(c, quota)
  }
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
  const profile = await db
    .prepare(`SELECT display_name FROM room_profiles WHERE user_sub = ?`)
    .bind(user.sub)
    .first<{ display_name: string }>()
  const memberName = await db
    .prepare(`SELECT display_name FROM room_member_names WHERE room_id = ? AND user_sub = ?`)
    .bind(roomRow.id, user.sub)
    .first<{ display_name: string }>()
  const message: RoomMessage = {
    id: id(),
    room: roomRow.id,
    body: content,
    authorName: roomAuthorName(user, authorId, memberName?.display_name ?? profile?.display_name),
    authorId,
    ...(isRoomOwnerMessage(c.env, user.sub, user.email) ? { authorOwner: true } : {}),
    createdAt: at,
    ...(attachments.length ? { attachments: roomAttachmentMeta(attachments, roomRow.id) } : {}),
  }
  let attachmentStorage: Awaited<ReturnType<typeof storeAttachmentObjects>> = new Map()
  if (attachments.length) {
    try {
      attachmentStorage = await storeAttachmentObjects(c.env.FILES, 'room', attachments)
    } catch (error) {
      console.warn('room_attachment_upload_failed', error)
      return c.json({ error: 'attachment_storage', message: 'Could not store those files right now. Try again.' }, 503)
    }
  }
  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO room_messages (id, room, author_sub, author_id, author_name, body, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(message.id, roomRow.id, user.sub, authorId, message.authorName, message.body, message.createdAt),
    ...attachments.map((attachment, position) => {
      const stored = attachmentStorage.get(attachment.id) ?? { r2Key: null, thumbnailKey: null, data: attachment.data }
      return db
        .prepare(
          `INSERT INTO room_message_attachments
             (id, message_id, room, owner_sub, name, mime, size, kind, data, r2_key, position, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          stored.data,
          stored.r2Key,
          position,
          at,
        )
    }),
    db
      .prepare(
        `DELETE FROM room_messages
         WHERE room = ? AND created_at < COALESCE((
           SELECT created_at FROM room_messages WHERE room = ?
           ORDER BY created_at DESC LIMIT 1 OFFSET ${KEEP_MESSAGES}
         ), 0)`,
      )
      .bind(roomRow.id, roomRow.id),
    db.prepare(`UPDATE chat_rooms SET last_active_at = ? WHERE id = ?`).bind(at, roomRow.id),
  ]
  try {
    await db.batch(statements)
  } catch (error) {
    await deleteAttachmentObjects(
      c.env.FILES,
      [...attachmentStorage.values()].flatMap((stored) => [stored.r2Key, stored.thumbnailKey].filter((key): key is string => Boolean(key))),
    )
    throw error
  }
  await purgeRoomOrphanAttachments(db, roomRow.id, c.env.FILES).catch((error) => console.warn('room_cleanup_failed', error))

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

room.patch('/rooms/:roomId/messages/:messageId/reaction', async (c) => {
  const user = c.get('user')
  const db = c.get('db')
  const roomRow = await findRoom(db, c.req.param('roomId'))
  if (!roomRow) return c.json({ error: 'room_not_found', message: 'That room no longer exists.' }, 404)
  if (!(await hasRoomAccess(db, roomRow, user.sub))) return lockedRoom(c)

  const messageId = c.req.param('messageId')
  const message = await db
    .prepare(`SELECT id FROM room_messages WHERE id = ? AND room = ? AND created_at > ?`)
    .bind(messageId, roomRow.id, roomMessageCutoff(now()))
    .first()
  if (!message) return c.json({ error: 'message_not_found', message: 'That message is no longer in the room.' }, 404)

  const input = await c.req.json<{ reaction?: unknown }>().catch(() => ({} as { reaction?: unknown }))
  const raw = input.reaction
  const reaction = raw === null ? null : cleanReactionEmoji(raw)
  if (raw !== null && reaction === null) {
    return c.json({ error: 'reaction', message: 'React with a single emoji.' }, 400)
  }

  const limit = await rateLimit(db, 'room:reaction', c.req.raw, 60, RATE_WINDOW_MS, `${user.sub}:${roomRow.id}`)
  if (!limit.allowed) return tooManyRequests(c, limit)

  if (reaction === null) {
    await db
      .prepare(`DELETE FROM room_message_reactions WHERE message_id = ? AND author_sub = ?`)
      .bind(messageId, user.sub)
      .run()
  } else {
    await db
      .prepare(
        `INSERT INTO room_message_reactions (message_id, room, author_sub, reaction, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(message_id, author_sub) DO UPDATE SET
           reaction = excluded.reaction,
           updated_at = excluded.updated_at`,
      )
      .bind(messageId, roomRow.id, user.sub, reaction, now())
      .run()
  }

  const rows = await db
    .prepare(
      `SELECT message_id, reaction, COUNT(*) AS count,
              MAX(CASE WHEN author_sub = ? THEN 1 ELSE 0 END) AS mine
       FROM room_message_reactions
       WHERE room = ? AND message_id = ?
       GROUP BY message_id, reaction
       ORDER BY MIN(updated_at) ASC, reaction ASC`,
    )
    .bind(user.sub, roomRow.id, messageId)
    .all<RoomReactionRow>()
  const reactions = rows.results.map(mapRoomReactionRow)
  try {
    await publishRealtime(c.env, {
      room: roomRow.id,
      event: 'room_reaction',
      data: { messageId },
    })
  } catch (error) {
    // The saved reaction is authoritative; a missed broadcast falls back to
    // the next room snapshot.
    console.warn('room_reaction_publish_failed', error)
  }
  return privateJson(c, { messageId, reactions })
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
