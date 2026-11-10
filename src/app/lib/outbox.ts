// A send typed while offline is kept in localStorage until the network comes
// back. The draft is stored separately per conversation so a reload puts the
// exact text back in the composer; the pending item carries the settings and a
// client-generated message id, so the Worker can make the retry idempotent.
import { useSyncExternalStore } from 'react'

import type { ReasoningEffort } from '../../shared/types'

export type PendingMessage = {
  clientMessageId: string
  conversationId: string | null
  projectId: string | null
  content: string
  model: string
  strategy: 'fast' | 'blend' | 'proof' | 'research' | 'analyze' | 'build' | 'canvas' | 'agent'
  reasoning: boolean
  effort?: ReasoningEffort
  createdAt: number
}

const PENDING_KEY = 'quill:pending-send'
const listeners = new Set<() => void>()

function parsePending(value: string | null): PendingMessage | null {
  if (!value) return null
  try {
    const raw = JSON.parse(value) as Partial<PendingMessage>
    if (typeof raw.clientMessageId !== 'string' || typeof raw.content !== 'string' || !raw.content.trim()) return null
    return {
      clientMessageId: raw.clientMessageId,
      conversationId: typeof raw.conversationId === 'string' ? raw.conversationId : null,
      projectId: typeof raw.projectId === 'string' ? raw.projectId : null,
      content: raw.content,
      model: typeof raw.model === 'string' ? raw.model : '',
      strategy: raw.strategy === 'fast' ? 'fast' : raw.strategy === 'proof' ? 'proof' : raw.strategy === 'research' ? 'research' : raw.strategy === 'analyze' ? 'analyze' : raw.strategy === 'build' ? 'build' : raw.strategy === 'canvas' ? 'canvas' : raw.strategy === 'agent' ? 'agent' : 'blend',
      reasoning: raw.reasoning === true,
      ...(raw.effort === 'low' || raw.effort === 'default' || raw.effort === 'max' ? { effort: raw.effort } : {}),
      createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
    }
  } catch {
    return null
  }
}

let pending: PendingMessage | null = typeof localStorage !== 'undefined' ? parsePending(localStorage.getItem(PENDING_KEY)) : null

function emit() {
  listeners.forEach((listener) => listener())
}

function update(next: PendingMessage | null) {
  pending = next
  if (typeof localStorage !== 'undefined') {
    if (next) localStorage.setItem(PENDING_KEY, JSON.stringify(next))
    else localStorage.removeItem(PENDING_KEY)
  }
  emit()
}

export function usePendingMessage(): PendingMessage | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => pending,
    () => pending,
  )
}

/** Keeps one queued send at a time so a retry cannot fan out into duplicates. */
export function queueMessage(message: PendingMessage): boolean {
  if (pending) return false
  update(message)
  return true
}

export function clearPendingMessage(clientMessageId: string) {
  if (pending?.clientMessageId !== clientMessageId) return
  update(null)
}

export function draftKey(conversationId: string | undefined): string {
  return `quill:draft:${conversationId ?? 'new'}`
}

export function readDraft(key: string): string {
  if (typeof localStorage === 'undefined') return ''
  return localStorage.getItem(key) ?? ''
}

export function writeDraft(key: string, value: string) {
  if (typeof localStorage === 'undefined') return
  if (value) localStorage.setItem(key, value)
  else localStorage.removeItem(key)
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== PENDING_KEY) return
    pending = parsePending(event.newValue)
    emit()
  })
}
