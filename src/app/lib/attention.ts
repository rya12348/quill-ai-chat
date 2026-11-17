// The tab title count and app badge are the only notifications that work
// without permission, so they are kept in one place and always clear together.
const TITLE_PREFIX = /^\(\d+\+?\) new messages? · /

type BadgeNavigator = Navigator & {
  setAppBadge?: (count: number) => Promise<void>
  clearAppBadge?: () => Promise<void>
}

let count = 0
const roomCounts = new Map<string, number>()

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
  document.title = `(${count > 99 ? '99+' : count}) new message${count === 1 ? '' : 's'} · Ink`
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
    if (!unread) return
    roomCounts.delete(room)
    count = Math.max(0, count - unread)
  } else {
    roomCounts.clear()
    count = 0
  }
  render()
}

export function setAttentionCount(next: number): void {
  count = Math.max(0, next)
  roomCounts.clear()
  render()
}

export function addAttention(extra: number, room?: string): void {
  if (room) roomCounts.set(room, (roomCounts.get(room) ?? 0) + extra)
  count = Math.max(0, count + extra)
  render()
}
