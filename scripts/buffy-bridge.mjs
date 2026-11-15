// Loopback bridge between Ink's Worker and the Codebuff agent SDK.
//
// The SDK is Node-only and much too large for a Cloudflare Worker, so it stays
// here and speaks a small OpenAI-compatible SSE dialect. The Worker reaches it
// at 127.0.0.1:8766 in local development; a deployed Ink copy has no bridge
// unless its owner deliberately points BUFFY_BRIDGE_URL at one.
//
// Usage: npm run buffy
// Requires CODEBUFF_API_KEY in .env (or the shell environment). If the
// Codebuff account has no SDK credits, the bridge answers through a clearly
// labelled free fallback lane (Step 5 through NVIDIA, then keyless Kilo).

import { createServer } from 'node:http'
import { readFile, readdir } from 'node:fs/promises'
import { CodebuffClient } from '@codebuff/sdk'

// Node 20+ can load the same files Wrangler reads. `.env.local` wins because
// it is loaded second and loadEnvFile does not overwrite existing values.
for (const file of ['.env', '.env.local']) {
  try {
    process.loadEnvFile(file)
  } catch {
    /* the file is optional */
  }
}

const PORT = Number(process.env.BUFFY_BRIDGE_PORT || 8766)
const HOST = '127.0.0.1'
const API_KEY = (process.env.CODEBUFF_API_KEY || process.env.FREEBUFF_API_KEY || '').trim()
const TOKEN = (process.env.BUFFY_BRIDGE_TOKEN || '').trim()
const MODEL = (process.env.BUFFY_MODEL || 'anthropic/claude-opus-4.7').trim()
const COST_MODE = (process.env.BUFFY_COST_MODE || 'normal').trim()
const NVIDIA_KEY = (process.env.NVIDIA_API_KEY || '').trim()
const OPENROUTER_KEY = (process.env.OPENROUTER_API_KEY || '').trim()
const FALLBACK_MODEL = (process.env.BUFFY_FALLBACK_MODEL || 'stepfun-ai/step-5-preview').trim()
const MOCK = process.env.BUFFY_MOCK === '1'
const MAX_BODY_BYTES = 512 * 1024
const MAX_CONTEXT_CHARS = 48_000
const NVIDIA_URL = 'https://integrate.api.nvidia.com/v1/chat/completions'
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const OVH_URL = 'https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/chat/completions'
const KILO_URL = 'https://api.kilo.ai/api/gateway/chat/completions'
const BLOCKRUN_URL = 'https://blockrun.ai/api/v1/chat/completions'
const ULTRA_MODEL = 'nvidia/nemotron-3-ultra-550b-a55b'
// After a 402, do not make every chat wait for the same failed paid call.
let codebuffBlockedUntil = 0

const BUFFY_INSTRUCTIONS = `You are Buffy, the Codebuff coding agent, talking with the person inside Ink.

Be direct, technically precise and useful. Answer the question that was asked. Do not pad the reply with introductions, restatements, or a summary of what you are about to do. If you are unsure, say what you would need to check.

You have read-only access to the Ink project (read_files, code_search, glob, list_directory), web search, and think_deeply. Use those tools when the answer depends on the actual code or on current information. Never read .env, .dev.vars, credential files, or anything under .freebuff; those are private. You cannot edit files or run terminal commands in this chat. When a change is needed, explain the exact change and where it goes.

Format for a chat window: short paragraphs, markdown lists only when they help, and code blocks with a language tag. Never claim you changed, ran or tested something when you did not.`

// The free lane has no tools. Giving it the agent instructions above made it
// imitate tool calls; these instructions keep the same persona without
// promising capabilities it cannot use.
const BUFFY_FREE_INSTRUCTIONS = `You are Buffy, the Codebuff assistant inside Ink.

Be direct, technically precise and useful. Answer the question that was asked. Do not pad the reply with introductions, restatements, or a summary of what you are about to do. If you are unsure, say what you would need to check.

You are running as Buffy on the free lane: you have no tools. You cannot read files, search the web, run commands, or change anything, and you must not claim otherwise. Never output a tool name, a JSON tool call, or a fake tool result. This chat may include a small, secret-free snapshot of the Ink project; if one is present, use it when it helps. If no snapshot is present, do not assume a project is open and do not ask for one. You have the conversation and your own knowledge; say plainly when a question needs a file or fact that is not available.

Your name is Buffy. The surrounding app is called Ink; never introduce yourself as Ink.

Format for a chat window: short paragraphs, markdown lists only when they help, and code blocks with a language tag. Never claim you changed, ran or tested something when you did not.`

const client = API_KEY
  ? new CodebuffClient({
      apiKey: API_KEY,
      cwd: process.cwd(),
    })
  : null

const agent = {
  id: 'buffy',
  displayName: 'Buffy',
  model: MODEL,
  toolNames: ['end_turn', 'think_deeply', 'web_search', 'read_files', 'code_search', 'glob', 'list_directory'],
  instructionsPrompt: BUFFY_INSTRUCTIONS,
}

const TOOL_STATUS = {
  read_files: 'Reading the project…',
  code_search: 'Searching the code…',
  glob: 'Looking for files…',
  list_directory: 'Listing the project…',
  web_search: 'Searching the web…',
  think_deeply: 'Thinking it through…',
  end_turn: '',
}

function textPart(value) {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object') return ''
  if (typeof value.text === 'string') return value.text
  if (typeof value.content === 'string') return value.content
  if (Array.isArray(value.content)) return value.content.map(textPart).join('')
  return ''
}

function messageText(value) {
  if (Array.isArray(value)) return value.map(textPart).join('')
  return textPart(value)
}

function messageContent(message) {
  if (!message || typeof message !== 'object') return ''
  if (typeof message.content === 'string') return message.content
  if (Array.isArray(message.content)) return message.content.map(textPart).join('')
  return ''
}

function buildPrompt(messages) {
  const system = messages
    .filter((message) => message?.role === 'system')
    .map((message) => messageContent(message).trim())
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 8_000)
  const dialog = messages
    .filter((message) => message?.role === 'user' || message?.role === 'assistant')
    .map((message) => {
      const content = messageContent(message).trim().slice(0, 12_000)
      return content ? `${message.role === 'user' ? 'Person' : 'Buffy'}: ${content}` : ''
    })
    .filter(Boolean)
    .join('\n\n')
    .slice(-MAX_CONTEXT_CHARS)
  return [
    system ? `Context supplied by the Ink app:\n${system}` : '',
    dialog || 'The person sent an empty message.',
    'Reply to the last Person message as Buffy. Use any tools available to you when they help; never claim a tool ran when it did not.',
  ]
    .filter(Boolean)
    .join('\n\n')
}

function writeEvent(res, payload) {
  if (res.writableEnded || res.destroyed) return false
  try {
    res.write(`data: ${JSON.stringify(payload)}\n\n`)
    return true
  } catch {
    return false
  }
}

function writeStatus(res, text) {
  if (res.writableEnded || res.destroyed) return
  try {
    res.write(`event: status\ndata: ${JSON.stringify({ type: 'status', text })}\n\n`)
  } catch {
    /* the reader disconnected */
  }
}

function writeDelta(res, text) {
  if (!text) return
  writeEvent(res, { choices: [{ index: 0, delta: { content: text } }] })
}

function finish(res) {
  if (res.writableEnded || res.destroyed) return
  writeEvent(res, { choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })
  try {
    res.write('data: [DONE]\n\n')
    res.end()
  } catch {
    /* the reader disconnected */
  }
}

function fail(res, message, status = 502) {
  if (res.headersSent) {
    writeEvent(res, { error: { message } })
    finish(res)
    return
  }
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify({ error: message }))
}

function authorized(req) {
  if (!TOKEN) return true
  return req.headers.authorization === `Bearer ${TOKEN}`
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Request body is too large.'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

async function mockReply(res) {
  const text = 'The Buffy bridge is running in mock mode. Set CODEBUFF_API_KEY in .env to talk to the real Codebuff agent.'
  for (const word of text.split(' ')) {
    if (res.destroyed) return
    writeDelta(res, `${word} `)
    await new Promise((resolve) => setTimeout(resolve, 18))
  }
  finish(res)
}

/** Free OpenAI-compatible lanes used only when the Codebuff run cannot start. */
function fallbackLanes() {
  return [
    // OpenRouter's free Ultra variant is the strongest zero-cost lane. It is
    // still free even when the same OpenRouter key also has paid models.
    ...(OPENROUTER_KEY
      ? [{ url: OPENROUTER_URL, model: `${ULTRA_MODEL}:free`, headers: { authorization: `Bearer ${OPENROUTER_KEY}` } }]
      : []),
    // NVIDIA NIM's free allowance includes the same 550B model.
    ...(NVIDIA_KEY
      ? [
          { url: NVIDIA_URL, model: ULTRA_MODEL, headers: { authorization: `Bearer ${NVIDIA_KEY}` } },
          { url: NVIDIA_URL, model: FALLBACK_MODEL, headers: { authorization: `Bearer ${NVIDIA_KEY}` } },
        ]
      : []),
    // Keyless fallbacks, strongest first. OVH allows only a few requests a
    // minute, so it sits behind the keyed lanes and ahead of the tiny models.
    { url: OVH_URL, model: 'Qwen3.5-397B-A17B', headers: {} },
    { url: KILO_URL, model: `${ULTRA_MODEL}:free`, headers: {} },
    { url: KILO_URL, model: 'kilo-auto/free', headers: {} },
    { url: BLOCKRUN_URL, model: 'nvidia/nemotron-3.5-lightning', headers: {} },
  ]
}

/** A small, secret-free snapshot so Lite can still answer project questions. */
async function projectSnapshot() {
  const parts = []
  for (const file of ['README.md', 'STARTUP.md', 'package.json']) {
    try {
      const text = await readFile(file, 'utf8')
      if (text.trim()) parts.push(`--- ${file} ---\n${text.slice(0, 5_000)}`)
    } catch {
      /* the file is optional */
    }
  }
  for (const directory of ['src/app/pages', 'src/worker/routes', 'scripts']) {
    try {
      const names = (await readdir(directory, { withFileTypes: true }))
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name)
        .slice(0, 80)
      if (names.length) parts.push(`--- ${directory} ---\n${names.join('\n')}`)
    } catch {
      /* the directory is optional */
    }
  }
  return parts.join('\n\n').slice(0, 16_000)
}

async function fallbackReply(res, prompt, signal, reason) {
  writeStatus(res, 'Buffy is answering…')
  const snapshot = await projectSnapshot()
  let lastError = ''
  for (const lane of fallbackLanes()) {
    try {
      const response = await fetch(lane.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'text/event-stream', ...lane.headers },
        body: JSON.stringify({
          model: lane.model,
          stream: true,
          max_tokens: 4_096,
          messages: [
            {
              role: 'system',
              content: `${BUFFY_FREE_INSTRUCTIONS}\n\nCodebuff is unavailable (${String(reason).slice(0, 160)}).${snapshot ? `\n\nFixed read-only project snapshot:\n${snapshot}` : ''}`,
            },
            { role: 'user', content: prompt },
          ],
        }),
        signal,
      })
      if (!response.ok || !response.body) {
        lastError = `HTTP ${response.status}`
        continue
      }
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let gotText = false
      let done = false
      while (!done) {
        const chunk = await reader.read()
        if (chunk.done) break
        buffer += decoder.decode(chunk.value, { stream: true })
        const blocks = buffer.split(/\r?\n\r?\n/)
        buffer = blocks.pop() ?? ''
        for (const block of blocks) {
          for (const line of block.split(/\r?\n/)) {
            if (!line.startsWith('data:')) continue
            const raw = line.slice(5).trim()
            if (!raw) continue
            if (raw === '[DONE]') {
              done = true
              break
            }
            try {
              const parsed = JSON.parse(raw)
              const piece = parsed?.choices?.[0]?.delta?.content
              if (typeof piece === 'string' && piece) {
                if (!gotText) writeDelta(res, '**Buffy** (free lane)\n\n')
                gotText = true
                writeDelta(res, piece)
              }
            } catch {
              /* a malformed lane chunk should not end the whole reply */
            }
          }
          if (done) break
        }
      }
      if (gotText) {
        console.log('buffy.fallback.lane', { model: lane.model, url: lane.url })
        finish(res)
        return
      }
      lastError = 'The fallback returned no text.'
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return
      lastError = error instanceof Error ? error.message : 'The fallback failed.'
    }
  }
  fail(
    res,
    `Codebuff is unavailable (${String(reason).slice(0, 120)}) and the free fallback did not answer${lastError ? ` (${lastError.slice(0, 100)})` : ''}.`,
    503,
  )
}

async function runBuffy(res, prompt, signal) {
  writeStatus(res, 'Buffy is thinking…')
  if (!client) {
    await fallbackReply(res, prompt, signal, 'CODEBUFF_API_KEY is missing')
    return
  }
  if (Date.now() < codebuffBlockedUntil) {
    await fallbackReply(res, prompt, signal, 'Codebuff is out of credits')
    return
  }

  let streamed = false
  let finalText = ''
  let streamError = ''
  try {
    const result = await client.run({
      agent,
      prompt,
      agentDefinitions: [agent],
      maxAgentSteps: 10,
      costMode: COST_MODE,
      signal,
      handleStreamChunk: (chunk) => {
        if (typeof chunk === 'string' && chunk) {
          streamed = true
          writeDelta(res, chunk)
        }
      },
      handleEvent: (event) => {
        if (!event || typeof event !== 'object') return
        if (event.type === 'tool_call') {
          const status = TOOL_STATUS[event.toolName]
          if (status) writeStatus(res, status)
        } else if (event.type === 'error') {
          streamError = typeof event.message === 'string' ? event.message : 'The Codebuff run failed.'
        } else if (event.type === 'text' && !streamed && typeof event.text === 'string') {
          finalText = event.text
        }
      },
    })

    if (result?.output?.type === 'error') {
      throw new Error(result.output.message || 'The Codebuff run failed.')
    }
    if (streamError && !streamed) throw new Error(streamError)
    if (!streamed) {
      const outputText =
        result?.output?.type === 'lastMessage' || result?.output?.type === 'allMessages'
          ? messageText(result.output.value)
          : ''
      const text = finalText || outputText
      if (text) {
        streamed = true
        writeDelta(res, text)
      }
    }
    if (!streamed) throw new Error('Buffy finished without a text reply.')
    codebuffBlockedUntil = 0
    finish(res)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The Codebuff run failed.'
    if (streamed) {
      writeEvent(res, { error: { message: message.slice(0, 600) } })
      finish(res)
      return
    }
    // A Codebuff account with no remaining credits returns before any text.
    // Remember it briefly so the next message goes straight to the free lane.
    if (/credit|payment required|402/i.test(message)) codebuffBlockedUntil = Date.now() + 10 * 60_000
    // Keep the chat usable with a clearly labelled free lane.
    await fallbackReply(res, prompt, signal, message)
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${HOST}:${PORT}`)

  if (url.pathname === '/health') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
    res.end(
      JSON.stringify({
        ok: true,
        configured: Boolean(API_KEY || NVIDIA_KEY || MOCK),
        codebuff: Boolean(API_KEY),
        fallback: NVIDIA_KEY ? FALLBACK_MODEL : 'kilo-auto/free',
        mock: MOCK,
        model: MODEL,
      }),
    )
    return
  }

  if (url.pathname !== '/v1/chat/completions' && url.pathname !== '/chat/completions') {
    res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ error: 'Not found.' }))
    return
  }

  if (req.method !== 'POST') {
    res.writeHead(405, { 'content-type': 'application/json; charset=utf-8', allow: 'POST' })
    res.end(JSON.stringify({ error: 'Use POST.' }))
    return
  }

  if (!authorized(req)) {
    res.writeHead(401, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ error: 'Unauthorized.' }))
    return
  }

  let body
  try {
    body = JSON.parse(await readBody(req))
  } catch (error) {
    fail(res, error instanceof Error ? error.message : 'Invalid JSON.', 400)
    return
  }

  const messages = Array.isArray(body?.messages) ? body.messages : []
  if (!messages.length) {
    fail(res, 'At least one message is required.', 400)
    return
  }

  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-store, no-transform',
    connection: 'keep-alive',
    'x-accel-buffering': 'no',
  })
  res.flushHeaders?.()

  const controller = new AbortController()
  res.on('close', () => controller.abort())
  const prompt = buildPrompt(messages)
  const freeOnly = url.searchParams.get('free') === '1'

  if (MOCK) {
    await mockReply(res)
    return
  }

  const timeout = setTimeout(() => controller.abort(), 180_000)
  try {
    if (freeOnly) await fallbackReply(res, prompt, controller.signal, 'the free model lane is selected')
    else await runBuffy(res, prompt, controller.signal)
  } finally {
    clearTimeout(timeout)
  }
})

server.listen(PORT, HOST, () => {
  console.log(`Buffy bridge listening on http://${HOST}:${PORT}`)
  console.log(`Codebuff key: ${API_KEY ? 'configured' : 'missing'}${MOCK ? ' (mock mode)' : ''}`)
  console.log(`Model: ${MODEL}`)
  if (NVIDIA_KEY) console.log(`Free fallback: ${FALLBACK_MODEL}`)
  if (!API_KEY && !MOCK) console.log('Set CODEBUFF_API_KEY in .env, then restart this bridge.')
})
