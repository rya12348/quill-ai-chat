// Draft text is stored per conversation so a reload puts the exact text back in
// the composer. Sends are never queued in the background: if a request cannot
// start, the caller restores the text as a normal draft and lets the person try
// again immediately.
const LEGACY_PENDING_KEY = 'stet:pending-send'

export function draftKey(conversationId: string | undefined): string {
  return `stet:draft:${conversationId ?? 'new'}`
}

export function readDraft(key: string): string {
  if (typeof localStorage === 'undefined') return ''
  try {
    return localStorage.getItem(key) ?? ''
  } catch {
    return ''
  }
}

export function writeDraft(key: string, value: string) {
  if (typeof localStorage === 'undefined') return
  try {
    if (value) localStorage.setItem(key, value)
    else localStorage.removeItem(key)
  } catch {
    /* storage can be unavailable; the in-memory draft still works */
  }
}

/**
 * Older builds kept one failed send in localStorage and retried it in the
 * background. If that retry stalled it could block the composer forever.
 * Consume a matching legacy entry once, restore its text as a draft, and
 * remove the key. New sends never create this entry.
 */
export function takeLegacyPendingMessage(conversationId: string | undefined): string | null {
  if (typeof localStorage === 'undefined') return null
  let raw: string | null
  try {
    raw = localStorage.getItem(LEGACY_PENDING_KEY)
  } catch {
    return null
  }
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as { content?: unknown; conversationId?: unknown }
    if (typeof value.content !== 'string' || !value.content.trim()) {
      localStorage.removeItem(LEGACY_PENDING_KEY)
      return null
    }
    const storedConversationId = typeof value.conversationId === 'string' ? value.conversationId : null
    if (storedConversationId !== (conversationId ?? null)) return null
    localStorage.removeItem(LEGACY_PENDING_KEY)
    return value.content
  } catch {
    localStorage.removeItem(LEGACY_PENDING_KEY)
    return null
  }
}
