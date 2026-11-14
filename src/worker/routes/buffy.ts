import { Hono } from 'hono'

import { allowsMutation, isLoopback, isOwner, privateJson } from '../auth'
import type { AppContext } from '../env'

export const buffy = new Hono<AppContext>()

const MAX_MESSAGES = 40
const MAX_CHARS = 48_000
const BRIDGE_TIMEOUT_MS = 15_000

/** The loopback bridge exists only while Ink and `npm run buffy` share a machine. */
function bridgeBase(c: { env: AppContext['Bindings']; req: { raw: Request } }): string {
  const configured = c.env.BUFFY_BRIDGE_URL?.trim()
  if (configured) return configured.replace(/\/+$/, '')
  if (isLoopback(c.req.raw)) return 'http://127.0.0.1:8766'
  return ''
}

function bridgeHeaders(c: { env: AppContext['Bindings'] }): Record<string, string> {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  const token = c.env.BUFFY_BRIDGE_TOKEN?.trim()
  if (token) headers.authorization = `Bearer ${token}`
  return headers
}

function publicReason(status: number, detail: string): string {
  if (status === 401 || status === 403) return 'The bridge rejected Ink. Check BUFFY_BRIDGE_TOKEN.'
  if (status === 503) return detail || 'The bridge is running, but no Codebuff API key is configured.'
  if (status === 404) return 'The bridge URL does not point at a Buffy bridge.'
  return detail || 'The Buffy bridge could not answer.'
}

buffy.get('/status', async (c) => {
  if (!isOwner(c.env, c.get('user'), c.req.raw)) {
    return privateJson(c, { ready: false, configured: false, reason: 'Buffy is available to the owner of this Ink copy.' }, 403)
  }
  const base = bridgeBase(c)
  if (!base) {
    return privateJson(c, {
      ready: false,
      configured: false,
      reason: 'Start `npm run buffy` on the same computer as Ink, or set BUFFY_BRIDGE_URL.',
    })
  }
  try {
    const response = await fetch(`${base}/health`, {
      headers: bridgeHeaders(c),
      signal: AbortSignal.timeout(2_500),
    })
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      return privateJson(c, { ready: false, configured: false, reason: publicReason(response.status, detail.slice(0, 240)) })
    }
    const health = (await response.json().catch(() => ({}))) as { configured?: boolean; model?: string; mock?: boolean }
    return privateJson(c, {
      ready: Boolean(health.configured),
      configured: Boolean(health.configured),
      model: health.model || 'Buffy',
      mock: Boolean(health.mock),
      ...(health.configured
        ? {}
        : { reason: 'The bridge is running, but CODEBUFF_API_KEY is missing. Add it to .env and restart `npm run buffy`.' }),
    })
  } catch {
    return privateJson(c, {
      ready: false,
      configured: false,
      reason: 'No bridge answered. Run `npm run buffy` in this project, then try again.',
    })
  }
})

buffy.post('/chat', async (c) => {
  if (!isOwner(c.env, c.get('user'), c.req.raw)) {
    return c.json({ error: 'Buffy is available to the owner of this Ink copy.' }, 403)
  }
  if (!allowsMutation(c.env, c.req.raw)) return c.json({ error: 'Cross-origin request refused.' }, 403)
  const base = bridgeBase(c)
  if (!base) {
    return c.json({ error: 'No Buffy bridge is configured. Run `npm run buffy` on this computer.' }, 503)
  }

  const body = (await c.req.json().catch(() => null)) as { messages?: unknown } | null
  if (!body || !Array.isArray(body.messages)) {
    return c.json({ error: 'A messages array is required.' }, 400)
  }
  const messages = body.messages
    .filter(
      (message): message is { role: 'system' | 'user' | 'assistant'; content: string } =>
        Boolean(message) &&
        typeof message === 'object' &&
        ['system', 'user', 'assistant'].includes((message as { role?: string }).role ?? '') &&
        typeof (message as { content?: unknown }).content === 'string',
    )
    .slice(-MAX_MESSAGES)
    .map((message) => ({ role: message.role, content: message.content.slice(0, 12_000) }))
  const total = messages.reduce((sum, message) => sum + message.content.length, 0)
  if (!messages.length || total > MAX_CHARS) {
    return c.json({ error: 'That conversation is empty or too long for Buffy.' }, 400)
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), BRIDGE_TIMEOUT_MS)
  const abort = () => controller.abort()
  c.req.raw.signal.addEventListener('abort', abort, { once: true })

  try {
    const response = await fetch(`${base}/v1/chat/completions`, {
      method: 'POST',
      headers: bridgeHeaders(c),
      body: JSON.stringify({ model: 'buffy', messages, stream: true }),
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      let parsed = ''
      try {
        parsed = (JSON.parse(detail) as { error?: string }).error ?? ''
      } catch {
        parsed = detail
      }
      return c.json({ error: publicReason(response.status, parsed.slice(0, 400)) }, response.status === 503 ? 503 : 502)
    }
    if (!response.body) return c.json({ error: 'The bridge returned no response body.' }, 502)
    c.header('Cache-Control', 'private, no-store')
    return new Response(response.body, {
      headers: {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'private, no-store, no-transform',
        connection: 'keep-alive',
        'x-accel-buffering': 'no',
      },
    })
  } catch (error) {
    clearTimeout(timeout)
    const message =
      error instanceof Error && error.name === 'AbortError'
        ? 'Buffy took too long to start. The Codebuff bridge may still be starting.'
        : 'Could not reach the Buffy bridge. Run `npm run buffy` on this computer.'
    return c.json({ error: message }, 503)
  } finally {
    c.req.raw.signal.removeEventListener('abort', abort)
  }
})
