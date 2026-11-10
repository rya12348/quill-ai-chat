// The Freebuff API client. The API is OpenAI-compatible (chat completions),
// so this is a thin layer: one request per reply, streamed when the model
// supports it, with the API's errors turned into messages the app can show.
// The key is read from env here and nowhere else.

import { FREEBUFF_API_URL, MAX_OUTPUT_TOKENS, MODELS, type ModelId } from '../shared/config'
import { ThinkingSplitter, splitThinking } from '../shared/thinking'
import type { Env } from './env'

export type ChatContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string | ChatContentPart[] }

/** One piece of a streamed reply: visible text or the model's reasoning. */
export type StreamPiece = { type: 'text' | 'reasoning'; text: string }

export class AiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 502,
  ) {
    super(message)
  }
}

export const aiConfigured = (env: Env) => Boolean(env.OPENAI_API_KEY)

const apiBase = (env: Env) => (env.OPENAI_BASE_URL || FREEBUFF_API_URL).replace(/\/$/, '')

function headers(env: Env): HeadersInit {
  if (!env.OPENAI_API_KEY) throw new AiError('not_configured', 'No API key is configured.', 503)
  return { authorization: `Bearer ${env.OPENAI_API_KEY}`, 'content-type': 'application/json', accept: 'application/json' }
}

export const isModelId = (value: unknown): value is ModelId => MODELS.some((m) => m.id === value)

/**
 * Visible text from an OpenAI-style content field. Some models return parts and
 * put their reasoning in a separate block, so keep text parts and drop the rest.
 */
export function textFromContent(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  let text = ''
  for (const part of content) {
    if (!part || typeof part !== 'object') continue
    const { type, text: piece } = part as { type?: string; text?: string }
    if (type === 'thinking' || type === 'reasoning') continue
    if (typeof piece === 'string') text += piece
  }
  return text
}

// What the API offers, cached per isolate. Only the models in MODELS are kept;
// the API lists hundreds. A failed fetch yields null and the app carries on
// assuming every configured model exists and none streams, which always works.
type Capabilities = { streaming: boolean }
const MODELS_TTL = 10 * 60_000
let modelCache: { at: number; models: Map<string, Capabilities> } | undefined
let modelInflight: Promise<Map<string, Capabilities> | null> | undefined

export function availableModels(env: Env): Promise<Map<string, Capabilities> | null> {
  if (modelCache && Date.now() - modelCache.at < MODELS_TTL) return Promise.resolve(modelCache.models)
  modelInflight ??= (async () => {
    try {
      const response = await fetch(`${apiBase(env)}/models`, {
        headers: env.OPENAI_API_KEY ? { authorization: `Bearer ${env.OPENAI_API_KEY}` } : {},
        signal: AbortSignal.timeout(8_000),
      })
      if (!response.ok) return null
      const body = (await response.json()) as { data?: { id: string; capabilities?: { streaming?: boolean } }[] }
      const models = new Map<string, Capabilities>()
      for (const model of body.data ?? []) {
        if (isModelId(model.id)) models.set(model.id, { streaming: Boolean(model.capabilities?.streaming) })
      }
      modelCache = { at: Date.now(), models }
      return models
    } catch {
      return null
    } finally {
      modelInflight = undefined
    }
  })()
  return modelInflight
}

/** Turns an API failure into something safe to show. Never includes the key. */
async function failure(response: Response): Promise<AiError> {
  let code = ''
  let detail = ''
  try {
    const body = (await response.json()) as { error?: { code?: string; message?: string } }
    code = body.error?.code ?? ''
    detail = (body.error?.message ?? '').slice(0, 160)
  } catch {
    /* not JSON */
  }
  const status = response.status
  if (status === 401) return new AiError('invalid_key', 'The API key is not valid. Update OPENAI_API_KEY and try again.', 503)
  if (status === 402) return new AiError('no_credits', 'This app is out of API credits.', 503)
  if (status === 403 && code === 'model_not_allowed') return new AiError('model_not_allowed', 'The API key cannot use this model.', 503)
  if (status === 403) return new AiError('key_disabled', 'The API key is paused or disabled.', 503)
  if (status === 404) return new AiError('model_unavailable', 'This model is not available right now. Try another.', 503)
  if (status === 429) return new AiError('busy', 'The model is busy. Try again in a moment.', 429)
  if (status === 400) return new AiError('refused', detail ? `The request was refused: ${detail}` : 'The request was refused.', 400)
  return new AiError('unavailable', 'The model is unavailable right now. Try again shortly.', 503)
}

/**
 * One reply, as text pieces. Streams token by token when the model supports
 * streaming, otherwise yields the whole reply once. `signal` aborts the
 * upstream request; the API's own deadline is 270 seconds.
 */
export async function* complete(env: Env, input: { model: ModelId; messages: ChatMessage[]; signal?: AbortSignal }): AsyncGenerator<StreamPiece> {
  const capabilities = await availableModels(env)
  const stream = capabilities?.get(input.model)?.streaming ?? false
  const timeout = AbortSignal.timeout(240_000)
  const signal = input.signal ? AbortSignal.any([input.signal, timeout]) : timeout

  let response: Response
  try {
    response = await fetch(`${apiBase(env)}/chat/completions`, {
      method: 'POST',
      headers: headers(env),
      body: JSON.stringify({ model: input.model, messages: input.messages, max_tokens: MAX_OUTPUT_TOKENS, stream }),
      signal,
    })
  } catch (error) {
    if (input.signal?.aborted) return
    if (timeout.aborted) throw new AiError('timeout', 'The model took too long to answer.', 504)
    throw new AiError('network', 'Could not reach the Freebuff API.', 503)
  }
  if (!response.ok) throw await failure(response)

  if (!stream) {
    const body = (await response.json()) as { choices?: { message?: { content?: unknown } }[] }
    const split = splitThinking(textFromContent(body.choices?.[0]?.message?.content))
    if (split.reasoning) yield { type: 'reasoning', text: split.reasoning }
    const text = split.text || split.reasoning
    if (!text) throw new AiError('malformed', 'The model returned an empty reply.', 502)
    yield { type: 'text', text }
    return
  }

  yield* readSse(response, { client: input.signal, timeout })
}

/**
 * One non-streamed reply, for internal work such as search planning. A short
 * budget keeps the planning stage from delaying the answer for long.
 */
export async function completeText(
  env: Env,
  input: { model: ModelId; messages: ChatMessage[]; signal?: AbortSignal; maxTokens?: number },
): Promise<string> {
  const timeout = AbortSignal.timeout(30_000)
  const signal = input.signal ? AbortSignal.any([input.signal, timeout]) : timeout
  let response: Response
  try {
    response = await fetch(`${apiBase(env)}/chat/completions`, {
      method: 'POST',
      headers: headers(env),
      body: JSON.stringify({ model: input.model, messages: input.messages, max_tokens: input.maxTokens ?? 200, stream: false }),
      signal,
    })
  } catch {
    if (input.signal?.aborted) throw new AiError('aborted', 'The reply was stopped.', 499)
    if (timeout.aborted) throw new AiError('timeout', 'The model took too long to plan.', 504)
    throw new AiError('network', 'Could not reach the Freebuff API.', 503)
  }
  if (!response.ok) throw await failure(response)
  const body = (await response.json().catch(() => null)) as { choices?: { message?: { content?: unknown } }[] } | null
  const split = splitThinking(textFromContent(body?.choices?.[0]?.message?.content))
  const text = split.text || split.reasoning
  if (!text.trim()) throw new AiError('malformed', 'The model returned an empty plan.', 502)
  return text
}

/** OpenRouter and Z.ai stream reasoning as text, sometimes alongside structured details. */
function reasoningFromDelta(delta: { reasoning?: unknown; reasoning_content?: unknown; reasoning_details?: unknown }): string {
  if (typeof delta.reasoning === 'string' && delta.reasoning) return delta.reasoning
  if (typeof delta.reasoning_content === 'string' && delta.reasoning_content) return delta.reasoning_content
  if (!Array.isArray(delta.reasoning_details)) return ''
  let text = ''
  for (const part of delta.reasoning_details) {
    if (!part || typeof part !== 'object') continue
    const detail = part as { text?: unknown; summary?: unknown }
    if (typeof detail.text === 'string') text += detail.text
    else if (typeof detail.summary === 'string') text += detail.summary
  }
  return text
}

/** Reads an OpenAI-style SSE body, yielding each delta's text or reasoning. */
export async function* readSse(response: Response, signals: { client?: AbortSignal; timeout: AbortSignal }): AsyncGenerator<StreamPiece> {
  if (!response.body) throw new AiError('malformed', 'The model returned no reply.', 502)
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
  const splitter = new ThinkingSplitter()
  let buffer = ''
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += value
      let end: number
      while ((end = buffer.indexOf('\n\n')) !== -1) {
        const event = buffer.slice(0, end)
        buffer = buffer.slice(end + 2)
        const data = event
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trim())
          .join('\n')
        if (!data || data === '[DONE]') continue
        let chunk: {
          choices?: { delta?: { content?: unknown; reasoning?: unknown; reasoning_content?: unknown; reasoning_details?: unknown } }[]
          error?: { message?: string }
        }
        try {
          chunk = JSON.parse(data)
        } catch {
          throw new AiError('malformed', 'The reply was interrupted.', 502)
        }
        if (chunk.error) throw new AiError('unavailable', 'The model stopped unexpectedly.', 502)
        const delta = chunk.choices?.[0]?.delta
        if (!delta) continue
        const reasoning = reasoningFromDelta(delta)
        if (reasoning) yield { type: 'reasoning', text: reasoning }
        const text = textFromContent(delta.content)
        if (text) {
          const split = splitter.push(text)
          if (split.reasoning) yield { type: 'reasoning', text: split.reasoning }
          if (split.text) yield { type: 'text', text: split.text }
        }
      }
    }
    const tail = splitter.flush()
    if (tail.reasoning) yield { type: 'reasoning', text: tail.reasoning }
    if (tail.text) yield { type: 'text', text: tail.text }
  } catch (error) {
    if (error instanceof AiError) throw error
    // The client went away; the caller keeps what arrived.
    if (signals.client?.aborted) return
    if (signals.timeout.aborted) throw new AiError('timeout', 'The model took too long to answer.', 504)
    throw new AiError('interrupted', 'The reply was interrupted.', 502)
  } finally {
    reader.releaseLock()
  }
}
