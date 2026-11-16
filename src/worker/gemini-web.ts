// Google's Gemini web app has a public StreamGenerate endpoint that accepts a
// basic text turn without a Google API key or account cookie. The payload is a
// sparse positional array, reverse-engineered by the open-source
// gemini-web2api/gemini-relay-worker projects. This is deliberately a separate
// lane from the official Gemini API: it stays free with no setup, but it is
// unofficial and can be unavailable when Google changes the endpoint.

import { AiError, textFromContent, type ChatMessage } from './ai'
import { browserPostFromGemini } from './browserbase'
import type { Env } from './env'

export const GEMINI_WEB_MODEL = 'gemini-web'

// Refresh this date-stamped label if Google starts rejecting the endpoint.
const GEMINI_BL = 'boq_gemini-web-uiserver_20261113.11_p0'
const GEMINI_URL =
  'https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate'
const GEMINI_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36'

function promptFor(messages: ChatMessage[]): string {
  const transcript = messages
    .map((message) => {
      const label = message.role === 'user' ? 'User' : message.role === 'assistant' ? 'Assistant' : 'System'
      return `${label}: ${textFromContent(message.content)}`
    })
    .join('\n\n')
  return `${transcript}\n\nAssistant:`
}

/** The sparse 102-field payload expected by Gemini's web frontend. */
function payloadFor(prompt: string, mode: number): string {
  const inner: unknown[] = new Array(102).fill(null)
  inner[0] = [prompt, 0, null, null, null, null, 0]
  inner[1] = ['en']
  inner[2] = ['', '', '', null, null, null, null, null, null, '']
  inner[6] = [0]
  inner[7] = 1
  inner[10] = 1
  inner[11] = 0
  inner[17] = [[4]]
  inner[18] = 0
  inner[27] = 1
  inner[30] = [4]
  inner[41] = [2]
  inner[53] = 0
  inner[59] = crypto.randomUUID()
  inner[61] = []
  inner[68] = 1
  inner[79] = mode
  return new URLSearchParams({ 'f.req': JSON.stringify([null, JSON.stringify(inner)]) }).toString()
}

type Attempt = { mode: number; withBuildLabel: boolean }

// Mode 54 asks the web app for its strongest current Gemini 4 route; 8 and 1
// are older model modes kept as fallbacks when Google retires the selector.
// The web endpoint is unofficial and occasionally answers with a transient
// empty body or 429. A retry with a fresh reqid usually succeeds; the last
// variant also omits the rolling build label, which Google accepts for a while
// after a frontend deploy.
const ATTEMPTS: Attempt[] = [
  { mode: 54, withBuildLabel: true },
  { mode: 8, withBuildLabel: true },
  { mode: 3, withBuildLabel: true },
  { mode: 1, withBuildLabel: true },
  { mode: 1, withBuildLabel: false },
]

function requestUrl(attempt: Attempt): string {
  const reqid = Math.floor(Date.now() / 1000) % 1_000_000
  const build = attempt.withBuildLabel ? `&bl=${GEMINI_BL}` : ''
  return `${GEMINI_URL}?hl=en&_reqid=${reqid}&rt=c${build}`
}

function requestFor(messages: ChatMessage[], attempt: Attempt, signal?: AbortSignal): Promise<Response> {
  return fetch(requestUrl(attempt), {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      origin: 'https://gemini.google.com',
      referer: 'https://gemini.google.com/app',
      'x-same-domain': '1',
      'user-agent': GEMINI_UA,
    },
    body: payloadFor(promptFor(messages), attempt.mode),
    signal,
  })
}

function extractTextsFromLine(line: string): string[] {
  if (!line.includes('"wrb.fr"') || line.length < 200) return []
  try {
    const outer = JSON.parse(line) as unknown
    const innerText = Array.isArray(outer) ? (outer[0] as unknown[] | undefined)?.[2] : undefined
    if (typeof innerText !== 'string' || innerText.length < 50) return []
    const inner = JSON.parse(innerText) as unknown
    if (!Array.isArray(inner) || inner.length < 5 || !Array.isArray(inner[4])) return []
    const texts: string[] = []
    for (const part of inner[4]) {
      if (!Array.isArray(part) || part.length < 2 || !Array.isArray(part[1])) continue
      for (const text of part[1]) if (typeof text === 'string' && text) texts.push(text)
    }
    return texts
  } catch {
    return []
  }
}

export function extractGeminiWebText(raw: string): string {
  let last = ''
  for (const line of raw.split('\n')) {
    for (const text of extractTextsFromLine(line)) if (text.length > last.length) last = text
  }
  return last.trim()
}

async function browserText(messages: ChatMessage[], signal?: AbortSignal, env?: Env): Promise<string> {
  if (!env) throw new AiError('unavailable', 'Gemini is unavailable right now.', 503)
  const attempt = ATTEMPTS[0]!
  const result = await browserPostFromGemini(
    env,
    requestUrl(attempt),
    payloadFor(promptFor(messages), attempt.mode),
    {
      'content-type': 'application/x-www-form-urlencoded',
      'x-same-domain': '1',
    },
    signal,
  )
  if (result.status !== 200) {
    throw new AiError(
      'unavailable',
      `Gemini is unavailable right now (${result.status}).`,
      result.status === 429 ? 429 : 503,
    )
  }
  const text = extractGeminiWebText(result.text)
  if (!text) throw new AiError('empty', 'Gemini returned an empty reply.', 502)
  return text
}

function sseChunk(text: string): string {
  return `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`
}

/** A complete text answer for planning/review helpers. */
export async function geminiWebText(messages: ChatMessage[], signal?: AbortSignal, env?: Env): Promise<string> {
  let lastError = new AiError('unavailable', 'Gemini is unavailable right now.', 503)
  for (let index = 0; index < ATTEMPTS.length; index += 1) {
    if (signal?.aborted) throw new AiError('aborted', 'The reply was stopped.', 499)
    try {
      const response = await requestFor(messages, ATTEMPTS[index]!, signal)
      const raw = await response.text()
      if (!response.ok) {
        lastError = new AiError(
          'unavailable',
          `Gemini is unavailable right now (${response.status}).`,
          response.status === 429 ? 429 : 503,
        )
      } else {
        const text = extractGeminiWebText(raw)
        if (text) return text
        lastError = new AiError('empty', 'Gemini returned an empty reply.', 502)
      }
    } catch (error) {
      if (signal?.aborted) throw new AiError('aborted', 'The reply was stopped.', 499)
      lastError = error instanceof AiError ? error : new AiError('network', 'Could not reach Gemini.', 503)
    }
    if (index < ATTEMPTS.length - 1) await delay(450 * (index + 1), signal)
  }
  // Google rate-limits some Cloudflare egress ranges even when the same
  // request works from another network. Retry the winning mode once from a
  // real browser page before giving up; this keeps the keyless lane usable
  // without sending the prompt to another model or provider.
  if (env && (env.STEEL_API_KEY || env.BROWSERBASE_API_KEY || env.HYPERBROWSER_API_KEY)) {
    try {
      return await browserText(messages, signal, env)
    } catch (error) {
      if (signal?.aborted) throw new AiError('aborted', 'The reply was stopped.', 499)
      lastError = error instanceof AiError ? error : new AiError('network', 'Could not reach Gemini.', 503)
    }
  }
  throw lastError
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new AiError('aborted', 'The reply was stopped.', 499))
      return
    }
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(new AiError('aborted', 'The reply was stopped.', 499))
      },
      { once: true },
    )
  })
}

/** OpenAI-compatible SSE so the normal lane parser and health checks work. */
export async function geminiWebResponse(messages: ChatMessage[], signal?: AbortSignal, env?: Env): Promise<Response> {
  const text = await geminiWebText(messages, signal, env)
  let body = ''
  for (let offset = 0; offset < text.length; offset += 160) body += sseChunk(text.slice(offset, offset + 160))
  body += 'data: [DONE]\n\n'
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } })
}
