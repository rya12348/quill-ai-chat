import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'

import { BUFFY_FREE_PROMPT, DAILY_MESSAGE_LIMIT } from '../../shared/config'
import { AiError, type ChatMessage } from '../ai'
import { allowsMutation, isGuestUser, isLoopback, isOwner, privateJson } from '../auth'
import { laneKey, orderLanes, publicComplete, publicLanes, type LaneResult } from '../public-ai'
import { recordProviderResult } from '../provider-health'
import { guestUsageKey, RATE_WINDOWS, rateLimit } from '../rate-limit'
import type { AppContext } from '../env'

export const buffy = new Hono<AppContext>()

const MAX_MESSAGES = 40
const MAX_CHARS = 48_000
const BRIDGE_TIMEOUT_MS = 15_000
const FREE_BURST_LIMIT = 20

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

/**
 * The hosted Buffy lane never spends paid provider credits. Local bridge rows
 * and paid OpenRouter variants are both excluded.
 */
function freeLanes(env: AppContext['Bindings']) {
  return publicLanes(env).filter((lane) => !lane.model.startsWith('buffy') && lane.billing !== 'paid')
}

type BuffyMessage = { role: 'system' | 'user' | 'assistant'; content: string }

function parseMessages(value: unknown): BuffyMessage[] {
  if (!Array.isArray(value)) return []
  return value
    .filter(
      (message): message is BuffyMessage =>
        Boolean(message) &&
        typeof message === 'object' &&
        ['system', 'user', 'assistant'].includes((message as { role?: string }).role ?? '') &&
        typeof (message as { content?: unknown }).content === 'string',
    )
    .slice(-MAX_MESSAGES)
    .map((message) => ({ role: message.role, content: message.content.slice(0, 12_000) }))
}

/** Use the local bridge only for the owner; everyone else gets the free lane. */
async function bridgeReply(
  c: { env: AppContext['Bindings']; req: { raw: Request }; header: (name: string, value: string) => void },
  messages: BuffyMessage[],
): Promise<Response | null> {
  const base = bridgeBase(c)
  if (!base) return null
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
    if (!response.ok || !response.body) return null
    c.header('Cache-Control', 'private, no-store')
    return new Response(response.body, {
      headers: {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'private, no-store, no-transform',
        connection: 'keep-alive',
        'x-accel-buffering': 'no',
      },
    })
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
    c.req.raw.signal.removeEventListener('abort', abort)
  }
}

buffy.get('/status', async (c) => {
  const owner = isOwner(c.env, c.get('user'), c.req.raw)
  const base = bridgeBase(c)
  const lanes = freeLanes(c.env)
  const freeStatus = {
    ready: true,
    configured: false,
    mode: 'free' as const,
    model: 'Buffy',
    reason: 'Free hosted models, no Codebuff credits needed.',
  }

  if (!owner || !base) {
    if (lanes.length) return privateJson(c, freeStatus)
    return privateJson(c, {
      ready: false,
      configured: false,
      reason: owner ? 'No Buffy model is configured on this deployment.' : 'Buffy is not available right now.',
    })
  }

  try {
    const response = await fetch(`${base}/health`, {
      headers: bridgeHeaders(c),
      signal: AbortSignal.timeout(2_500),
    })
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      if (lanes.length) return privateJson(c, { ...freeStatus, reason: publicReason(response.status, detail.slice(0, 240)) })
      return privateJson(c, { ready: false, configured: false, reason: publicReason(response.status, detail.slice(0, 240)) })
    }
    const health = (await response.json().catch(() => ({}))) as { configured?: boolean; model?: string; mock?: boolean }
    if (!health.configured) {
      if (lanes.length) return privateJson(c, freeStatus)
      return privateJson(c, {
        ready: false,
        configured: false,
        reason: 'The bridge is running, but CODEBUFF_API_KEY is missing. Add it to .env and restart `npm run buffy`.',
      })
    }
    return privateJson(c, {
      ready: true,
      configured: true,
      mode: 'bridge',
      model: health.model || 'Buffy',
      mock: Boolean(health.mock),
    })
  } catch {
    if (lanes.length) return privateJson(c, freeStatus)
    return privateJson(c, {
      ready: false,
      configured: false,
      reason: 'No bridge answered. Run `npm run buffy` in this project, then try again.',
    })
  }
})

buffy.post('/chat', async (c) => {
  if (!allowsMutation(c.env, c.req.raw)) return c.json({ error: 'Cross-origin request refused.' }, 403)

  const body = (await c.req.json().catch(() => null)) as { messages?: unknown } | null
  if (!body || !Array.isArray(body.messages)) {
    return c.json({ error: 'A messages array is required.' }, 400)
  }
  const messages = parseMessages(body.messages)
  const total = messages.reduce((sum, message) => sum + message.content.length, 0)
  if (!messages.length || total > MAX_CHARS) {
    return c.json({ error: 'That conversation is empty or too long for Buffy.' }, 400)
  }

  const owner = isOwner(c.env, c.get('user'), c.req.raw)
  if (owner) {
    const bridged = await bridgeReply(c, messages)
    if (bridged) return bridged
  }

  const lanes = freeLanes(c.env)
  if (!lanes.length) return c.json({ error: 'Buffy is not configured on this deployment.' }, 503)

  const db = c.get('db')
  const user = c.get('user')
  const subject = isGuestUser(user) ? await guestUsageKey(c.req.raw) : user.sub
  const burst = await rateLimit(db, 'buffy-free-burst', c.req.raw, FREE_BURST_LIMIT, RATE_WINDOWS.chat, subject)
  if (!burst.allowed) {
    c.header('Retry-After', String(burst.retryAfter))
    return c.json({ error: 'Too many messages. Wait a moment and try again.' }, 429)
  }
  const daily = await rateLimit(db, 'buffy-free-day', c.req.raw, DAILY_MESSAGE_LIMIT, RATE_WINDOWS.day, subject)
  if (!daily.allowed) {
    c.header('Retry-After', String(daily.retryAfter))
    return c.json({ error: `You have reached today's limit of ${DAILY_MESSAGE_LIMIT} Buffy messages.` }, 429)
  }

  const controller = new AbortController()
  const abort = () => controller.abort()
  c.req.raw.signal.addEventListener('abort', abort, { once: true })
  c.header('Cache-Control', 'private, no-store')

  return streamSSE(c, async (stream) => {
    stream.onAbort(() => controller.abort())
    try {
      await stream.writeSSE({
        event: 'status',
        data: JSON.stringify({ type: 'status', text: 'Buffy is thinking…' }),
      })
      const completion = publicComplete(orderLanes(lanes, 'buffy'), {
        messages: [
          {
            role: 'system',
            content: `${BUFFY_FREE_PROMPT}\n\nToday is ${new Date().toISOString().slice(0, 10)} (UTC).`,
          },
          ...messages.filter((message) => message.role !== 'system'),
        ] satisfies ChatMessage[],
        signal: controller.signal,
        onLaneResult: (result: LaneResult) => {
          void recordProviderResult(db, user.sub, laneKey(result.lane), result).catch(() => {})
        },
      })
      for await (const piece of completion) {
        if (piece.type !== 'text') continue
        await stream.writeSSE({
          data: JSON.stringify({ choices: [{ delta: { content: piece.text } }] }),
        })
      }
      await stream.writeSSE({ data: '[DONE]' })
    } catch (error) {
      if (controller.signal.aborted) return
      const message = error instanceof AiError ? error.message : 'Buffy could not answer right now. Try again.'
      await stream.writeSSE({ data: JSON.stringify({ error: { message } }) }).catch(() => {})
    } finally {
      c.req.raw.signal.removeEventListener('abort', abort)
    }
  })
})
