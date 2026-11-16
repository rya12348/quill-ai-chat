import type { AttachmentInput, ChatEvent, DatasetInput, ReasoningEffort } from '../../shared/types'
import { readError } from './api'
import { requestDuckTurn, type DuckTurn } from './duck'
import { noteOffline } from './offline'

export type ChatRequest = {
  conversationId?: string
  content?: string
  attachments?: AttachmentInput[]
  dataset?: DatasetInput
  projectId?: string | null
  model?: string
  regenerate?: boolean
  strategy?: 'fast' | 'blend' | 'proof' | 'research' | 'analyze' | 'build' | 'canvas' | 'agent' | 'advisor'
  reasoning?: boolean
  effort?: ReasoningEffort
  /** Stable id for this send, so an offline retry cannot create a duplicate. */
  clientMessageId?: string
  /** Solved in the browser for the free Claude lane. */
  duck?: DuckTurn
}

/**
 * Sends one turn and reads the reply's server-sent events until the server
 * closes the stream. Resolves when the stream ends; rejects with ApiError when
 * the request itself is refused (limit reached, no key, bad input).
 */
export async function streamChat(body: ChatRequest, options: { signal: AbortSignal; onEvent: (event: ChatEvent) => void }): Promise<void> {
  let payload = body
  // The free Claude and ChatGPT rows use the same no-key DuckDuckGo lane as
  // Buffy. Their proof must be solved in this browser and sent with this exact
  // turn; fetching it here also covers retries and regenerations.
  if (body.model === 'claude-haiku-5-5' || body.model === 'gpt-6-luna') {
    const duck = await requestDuckTurn(body.model, options.signal)
    const label = body.model === 'claude-haiku-5-5' ? 'Claude' : 'ChatGPT'
    if (!duck) throw new Error(`The free ${label} lane is busy right now. Try again or pick another model.`)
    payload = { ...body, duck }
  }
  const response = await fetch('/api/chat', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'content-type': 'application/json',
      accept: 'text/event-stream',
      // The service worker may replay this request once after a handoff. The
      // client message id makes the replay idempotent on the server.
      ...(payload.clientMessageId ? { 'x-stet-idempotent': '1' } : {}),
    },
    body: JSON.stringify(payload),
    signal: options.signal,
  })
  noteOffline(response)
  if (!response.ok) throw await readError(response)
  if (!response.body) return
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += value
      let end: number
      while ((end = buffer.indexOf('\n\n')) !== -1) {
        const lines = buffer.slice(0, end).split('\n')
        buffer = buffer.slice(end + 2)
        const data = lines
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trimStart())
          .join('\n')
        if (data) {
          try {
            options.onEvent(JSON.parse(data) as ChatEvent)
          } catch {
            // A proxy or a truncated frame can leave one bad event. Ignore it
            // and keep the stream alive instead of failing the whole reply.
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}
