// The tab title count and app badge are the only notifications that work
// without permission, so they are kept in one place and always clear together.
const TITLE_PREFIX = /^\(\d+\+?\)[^·]*· /

type BadgeNavigator = Navigator & {
  setAppBadge?: (count: number) => Promise<void>
  clearAppBadge?: () => Promise<void>
}

let count = 0
const roomCounts = new Map<string, number>()
// Invitations are unseen until Ink can actually surface them. Keep them
// separate from message counts so opening one room does not clear the other.
const inviteRooms = new Set<string>()

function badge(): BadgeNavigator {
  return navigator as BadgeNavigator
}

function clearBadge(): void {
  try {
    void badge().clearAppBadge?.()
  } catch {
    /* app badges are not available in every browser */
  }
}

function render(): void {
  if (!count) {
    document.title = document.title.replace(TITLE_PREFIX, '')
    clearBadge()
    return
  }
  const invites = inviteRooms.size
  const messages = Math.max(0, count - invites)
  const label =
    invites && !messages
      ? `new invitation${invites === 1 ? '' : 's'}`
      : invites
        ? `new notification${count === 1 ? '' : 's'}`
        : `new message${count === 1 ? '' : 's'}`
  document.title = `(${count > 99 ? '99+' : count}) ${label} · Ink`
  try {
    void badge().setAppBadge?.(count)
  } catch {
    /* app badges are not available in every browser */
  }
}

/** Clear every room's unread count, or only the room being opened. */
export function clearAttention(room?: string): void {
  if (room) {
    const unread = roomCounts.get(room) ?? 0
    const invited = inviteRooms.delete(room)
    if (!unread && !invited) return
    if (unread) roomCounts.delete(room)
    count = Math.max(0, count - unread - (invited ? 1 : 0))
  } else {
    roomCounts.clear()
    inviteRooms.clear()
    count = 0
  }
  render()
}

export function setAttentionCount(next: number): void {
  count = Math.max(0, next)
  roomCounts.clear()
  inviteRooms.clear()
  render()
}

/**
 * Reconcile the invitation share of the count with the invitations still
 * unseen on the server. Passing an empty list clears every invite badge.
 */
export function setInviteAttention(rooms: string[]): void {
  const next = new Set(rooms)
  let changed = false
  for (const room of inviteRooms) {
    if (next.has(room)) continue
    inviteRooms.delete(room)
    count = Math.max(0, count - 1)
    changed = true
  }
  for (const room of next) {
    if (inviteRooms.has(room)) continue
    inviteRooms.add(room)
    count += 1
    changed = true
  }
  if (changed) render()
}

export function addAttention(extra: number, room?: string): void {
  if (room) roomCounts.set(room, (roomCounts.get(room) ?? 0) + extra)
  count = Math.max(0, count + extra)
  render()
}
