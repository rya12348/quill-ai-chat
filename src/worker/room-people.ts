import type { RoomInvite, RoomPerson, RoomPeople } from '../shared/types'

const DISPLAY_NAME_CHARS = 40
const ONLINE_WINDOW_MS = 2 * 60_000
const MAX_PEOPLE = 500
const MAX_INVITES = 50

export type RoomPersonUser = {
  sub: string
  name?: string
  email?: string
}

type PersonRow = {
  author_id: string
  display_name: string
  account_name: string
  is_guest: number
  last_seen_at: number
  saved: number
  label: string | null
}

export type InvitedPerson = {
  userSub: string
  authorId: string
  name: string
}

/** The short public tag every person uses in rooms. It is stable and unique. */
export async function roomAuthorId(userSub: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(userSub))
  return Array.from(new Uint8Array(digest).slice(0, 6), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function cleanRoomPersonId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const id = value.trim().toLowerCase()
  return /^[a-f0-9]{12}$/.test(id) ? id : null
}

function cleanName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const name = value
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return name ? name.slice(0, DISPLAY_NAME_CHARS) : null
}

function accountName(user: RoomPersonUser): string {
  const name = cleanName(user.name)
  if (name && name.toLowerCase() !== 'guest') return name
  const local = user.email?.split('@')[0]?.replace(/[._-]+/g, ' ').trim()
  return local ? cleanName(local) ?? 'Ink user' : 'Guest'
}

function baseName(authorId: string, name: string): string {
  const clean = cleanName(name)
  if (clean && clean.toLowerCase() !== 'guest') return clean
  return `Guest ${authorId.slice(0, 4).toUpperCase()}`
}

/** The longest private nickname a viewer can give someone. */
export const ROOM_PERSON_LABEL_CHARS = DISPLAY_NAME_CHARS

/**
 * A nickname for the viewer's own people list. It is normalised like a display
 * name, and an empty value means "use the name they chose themselves".
 */
export function cleanRoomPersonLabel(value: unknown): string | null {
  return cleanName(value)
}

/**
 * Record the signed-in or guest identity in the people directory. This is
 * deliberately independent of room membership so someone can be found and
 * invited later even when they are offline.
 */
export async function rememberRoomPerson(
  db: D1Database,
  user: RoomPersonUser,
  at = Date.now(),
): Promise<RoomPersonUser> {
  const authorId = await roomAuthorId(user.sub)
  const names = await db
    .prepare(
      `SELECT
         (SELECT display_name FROM room_profiles WHERE user_sub = ?) AS profile_name,
         (SELECT display_name FROM room_member_names WHERE user_sub = ?
          ORDER BY updated_at DESC LIMIT 1) AS member_name`,
    )
    .bind(user.sub, user.sub)
    .first<{ profile_name: string | null; member_name: string | null }>()
  const name = baseName(authorId, names?.profile_name ?? names?.member_name ?? '')
  const account = accountName(user)
  const guest = user.sub.startsWith('guest:') ? 1 : 0
  await db
    .prepare(
      `INSERT INTO room_people
         (user_sub, author_id, display_name, account_name, is_guest, last_seen_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_sub) DO UPDATE SET
         author_id = excluded.author_id,
         display_name = excluded.display_name,
         account_name = excluded.account_name,
         is_guest = excluded.is_guest,
         last_seen_at = excluded.last_seen_at,
         updated_at = excluded.updated_at`,
    )
    .bind(user.sub, authorId, name, account, guest, at, at, at)
    .run()
  return user
}

/**
 * Fill directory gaps from the users Ink already knew before this feature
 * shipped. Offline people remain invitable without waiting for a new visit.
 */
export async function backfillRoomPeople(db: D1Database, limit = 1000): Promise<number> {
  const rows = await db
    .prepare(
      `SELECT u.owner_sub, u.created_at, a.name, a.email
       FROM users u
       LEFT JOIN auth_users a ON ('account:' || a.id) = u.owner_sub
       WHERE (u.owner_sub LIKE 'guest:%' OR u.owner_sub LIKE 'account:%' OR u.owner_sub = 'dev-user')
         AND NOT EXISTS (SELECT 1 FROM room_people p WHERE p.user_sub = u.owner_sub)
       ORDER BY u.created_at ASC
       LIMIT ?`,
    )
    .bind(limit)
    .all<{ owner_sub: string; created_at: number; name: string | null; email: string | null }>()
  for (const row of rows.results) {
    await rememberRoomPerson(
      db,
      { sub: row.owner_sub, name: row.name ?? '', email: row.email ?? undefined },
      Number(row.created_at),
    )
  }
  return rows.results.length
}

/** Everyone Ink has seen, with the viewer's saved people marked. */
export async function listRoomPeople(
  db: D1Database,
  viewerSub: string,
  at = Date.now(),
): Promise<RoomPeople> {
  const rows = await db
    .prepare(
      `SELECT p.author_id, p.display_name, p.account_name, p.is_guest,
              p.last_seen_at, l.label AS label,
              CASE WHEN s.person_sub IS NULL THEN 0 ELSE 1 END AS saved
       FROM room_people p
       LEFT JOIN room_people_saved s
         ON s.person_sub = p.user_sub AND s.owner_sub = ?
       LEFT JOIN room_people_labels l
         ON l.person_sub = p.user_sub AND l.owner_sub = ?
       WHERE p.user_sub <> ?
       ORDER BY CASE WHEN p.last_seen_at >= ? THEN 0 ELSE 1 END,
                p.last_seen_at DESC,
                p.display_name COLLATE NOCASE
       LIMIT ?`,
    )
    .bind(viewerSub, viewerSub, viewerSub, at - ONLINE_WINDOW_MS, MAX_PEOPLE)
    .all<PersonRow>()
  const items: RoomPerson[] = rows.results.map((row) => {
    const label = cleanRoomPersonLabel(row.label)
    return {
      id: row.author_id,
      // The viewer's private nickname wins, so a guest tag is replaced by the
      // name they actually remember. Everyone else still sees display_name.
      name: label ?? row.display_name,
      guest: Boolean(row.is_guest),
      online: Number(row.last_seen_at) >= at - ONLINE_WINDOW_MS,
      saved: Boolean(row.saved),
      ...(label ? { renamed: true, originalName: row.display_name } : {}),
    }
  })
  return { items, asOf: at }
}

/** Save or remove someone from the viewer's quick-add list. */
export async function setRoomPersonSaved(
  db: D1Database,
  ownerSub: string,
  personId: string,
  saved: boolean,
  at = Date.now(),
): Promise<boolean | null> {
  const person = await db
    .prepare(`SELECT user_sub FROM room_people WHERE author_id = ?`)
    .bind(personId)
    .first<{ user_sub: string }>()
  if (!person || person.user_sub === ownerSub) return null
  if (saved) {
    await db
      .prepare(`INSERT OR IGNORE INTO room_people_saved (owner_sub, person_sub, created_at) VALUES (?, ?, ?)`)
      .bind(ownerSub, person.user_sub, at)
      .run()
  } else {
    await db
      .prepare(`DELETE FROM room_people_saved WHERE owner_sub = ? AND person_sub = ?`)
      .bind(ownerSub, person.user_sub)
      .run()
  }
  return saved
}

/**
 * Set or clear the viewer's private nickname for someone. Returns undefined
 * when the person is not in the directory, and null when the nickname was
 * removed and their own name applies again.
 */
export async function setRoomPersonLabel(
  db: D1Database,
  ownerSub: string,
  personId: string,
  label: string | null,
  at = Date.now(),
): Promise<string | null | undefined> {
  const person = await db
    .prepare(`SELECT user_sub FROM room_people WHERE author_id = ?`)
    .bind(personId)
    .first<{ user_sub: string }>()
  if (!person || person.user_sub === ownerSub) return undefined
  if (label === null) {
    await db
      .prepare(`DELETE FROM room_people_labels WHERE owner_sub = ? AND person_sub = ?`)
      .bind(ownerSub, person.user_sub)
      .run()
    return null
  }
  await db
    .prepare(
      `INSERT INTO room_people_labels (owner_sub, person_sub, label, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(owner_sub, person_sub) DO UPDATE SET
         label = excluded.label,
         updated_at = excluded.updated_at`,
    )
    .bind(ownerSub, person.user_sub, label, at, at)
    .run()
  return label
}

/**
 * Grant direct access to selected people. Rows live in the directory, so this
 * works while the person is offline; their room list will show the invite the
 * next time they open Ink.
 */
export async function inviteRoomPeople(
  db: D1Database,
  roomId: string,
  ownerSub: string,
  personIds: string[],
  at = Date.now(),
): Promise<InvitedPerson[]> {
  const ids = [...new Set(personIds.map(cleanRoomPersonId).filter((id): id is string => Boolean(id)))].slice(
    0,
    MAX_INVITES,
  )
  if (!ids.length) return []
  const rows = await db
    .prepare(
      `SELECT user_sub, author_id, display_name
       FROM room_people
       WHERE author_id IN (${ids.map(() => '?').join(',')})
         AND user_sub <> ?`,
    )
    .bind(...ids, ownerSub)
    .all<{ user_sub: string; author_id: string; display_name: string }>()
  if (!rows.results.length) return []
  await db.batch(
    rows.results.map((row) =>
      db
        .prepare(
          `INSERT INTO room_access
             (room_id, user_sub, created_at, invited, invited_at, invited_by, invite_seen)
           VALUES (?, ?, ?, 1, ?, ?, 0)
           ON CONFLICT(room_id, user_sub) DO UPDATE SET
             invited = 1,
             invited_at = excluded.invited_at,
             invited_by = excluded.invited_by,
             invite_seen = 0`,
        )
        .bind(roomId, row.user_sub, at, at, ownerSub),
    ),
  )
  return rows.results.map((row) => ({
    userSub: row.user_sub,
    authorId: row.author_id,
    name: row.display_name,
  }))
}

/** Unseen direct invitations for the app-wide notification poll. */
export async function listRoomInvites(
  db: D1Database,
  userSub: string,
  at = Date.now(),
): Promise<RoomInvite[]> {
  const rows = await db
    .prepare(
      `SELECT r.id AS room_id, r.name AS room_name, a.invited_at,
              COALESCE(p.display_name, 'The room creator') AS inviter_name
       FROM room_access a
       JOIN chat_rooms r ON r.id = a.room_id
       LEFT JOIN room_people p ON p.user_sub = a.invited_by
       WHERE a.user_sub = ? AND a.invited = 1 AND a.invite_seen = 0
         AND r.id <> 'general'
       ORDER BY a.invited_at DESC
       LIMIT 20`,
    )
    .bind(userSub)
    .all<{ room_id: string; room_name: string; invited_at: number; inviter_name: string }>()
  return rows.results.map((row) => ({
    roomId: row.room_id,
    roomName: row.room_name,
    invitedAt: Number(row.invited_at) || at,
    inviterName: row.inviter_name,
  }))
}

export async function markRoomInvitesSeen(
  db: D1Database,
  userSub: string,
  roomIds: string[],
): Promise<void> {
  const ids = [...new Set(roomIds.filter((id) => typeof id === 'string' && id.length > 0 && id.length <= 64))].slice(
    0,
    20,
  )
  if (!ids.length) return
  await db
    .prepare(
      `UPDATE room_access SET invite_seen = 1
       WHERE user_sub = ? AND room_id IN (${ids.map(() => '?').join(',')})`,
    )
    .bind(userSub, ...ids)
    .run()
}
