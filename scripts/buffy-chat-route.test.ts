import assert from 'node:assert/strict'
import test, { mock } from 'node:test'

import { Hono } from 'hono'

import type { FreebuffUser } from '@freebuff/auth'
import type { AppContext, Env } from '../src/worker/env'
import type { PublicLane } from '../src/worker/public-ai'

const freeLane: PublicLane = {
  url: 'https://free.test/v1/chat/completions',
  model: 'test-free',
  label: 'Test Free',
  description: 'test free lane',
  billing: 'free',
}

let freeCompletions = 0

async function* fakePublicComplete() {
  freeCompletions += 1
  yield { type: 'text' as const, text: 'Free lane answer.' }
}

const publicAi = await import('../src/worker/public-ai')
mock.module('../src/worker/public-ai.ts', {
  exports: {
    ...publicAi,
    publicLanes: () => [freeLane],
    publicComplete: fakePublicComplete,
  },
})

const { buffy } = await import('../src/worker/routes/buffy.ts')

function fakeDb(): Env['DB'] {
  return {
    prepare(sql: string) {
      const statement = {
        bind: () => statement,
        first: async () =>
          sql.includes('INSERT INTO rate_limits') ? { count: 1, reset_at: Date.now() + 60_000 } : null,
        run: async () => ({ success: true }),
        all: async () => ({ results: [] }),
      }
      return statement
    },
  } as unknown as Env['DB']
}

const env = {
  ASSETS: { fetch: async () => new Response('') },
  DB: fakeDb(),
  OWNER_SUB: 'route-test-user',
  BUFFY_BRIDGE_URL: 'http://bridge.test',
  APP_ORIGIN: 'http://localhost',
} as unknown as Env

const user = {
  sub: 'route-test-user',
  name: 'Route Test',
  email_verified: true,
} as unknown as FreebuffUser

const app = new Hono<AppContext>()
app.use('*', async (c, next) => {
  c.set('db', env.DB!)
  c.set('user', user)
  await next()
})
app.route('/api/buffy', buffy)

const BRIDGE_SSE = [
  'event: status\n',
  'data: {"type":"status","text":"Agent is working…"}\n\n',
  'data: {"choices":[{"delta":{"content":"Bridge "}}]}\n\n',
  'data: {"choices":[{"delta":{"content":"works."}}]}\n\n',
  'data: [DONE]\n\n',
].join('')

function requestChat() {
  return app.request(
    'http://localhost/api/buffy/chat',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Compare the two approaches and recommend one.' }],
      }),
    },
    env,
  )
}

function parseEvents(body: string): { event?: string; data: string }[] {
  return body
    .split(/\r?\n\r?\n/)
    .filter((block) => block.trim())
    .map((block) => {
      let event: string | undefined
      const data: string[] = []
      for (const line of block.split(/\r?\n/)) {
        if (line.startsWith('event:')) event = line.slice('event:'.length).trim()
        else if (line.startsWith('data:')) data.push(line.slice('data:'.length).trimStart())
      }
      return { ...(event ? { event } : {}), data: data.join('\n') }
    })
}

async function flushTasks() {
  await Promise.resolve()
  await new Promise((resolve) => setImmediate(resolve))
}

test('a bridge that sends headers but no body falls through to the free lanes', async (t) => {
  const realFetch = globalThis.fetch
  let bridgeCalls = 0
  freeCompletions = 0

  mock.timers.enable({ apis: ['setTimeout'] })
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url === 'http://bridge.test/v1/chat/completions') {
      bridgeCalls += 1
      return new Response(
        new ReadableStream<Uint8Array>({
          start() {
            // Headers are live, but the body never emits a chunk.
          },
        }),
        { status: 200, headers: { 'content-type': 'text/event-stream' } },
      )
    }
    throw new Error(`unexpected fetch: ${url}`)
  }) as typeof fetch

  t.after(() => {
    globalThis.fetch = realFetch
    mock.timers.reset()
  })

  const pending = requestChat()
  await flushTasks()
  mock.timers.tick(30_000)

  const response = await pending
  const events = parseEvents(await response.text())

  assert.equal(response.status, 200)
  assert.equal(bridgeCalls, 1, 'the bridge should be tried once before falling through')
  assert.equal(freeCompletions, 1, 'the free lane should answer when the bridge body is silent')
  assert.ok(events.some((event) => event.event === 'status' && /local agent did not answer/i.test(event.data)))
  assert.ok(events.some((event) => event.data.includes('Free lane answer.')))
  assert.ok(events.some((event) => event.data === '[DONE]'))
})

test('a healthy bridge SSE stream is passed through unchanged', async (t) => {
  const realFetch = globalThis.fetch
  let bridgeCalls = 0
  freeCompletions = 0

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url === 'http://bridge.test/v1/chat/completions') {
      bridgeCalls += 1
      return new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(BRIDGE_SSE))
            controller.close()
          },
        }),
        { status: 200, headers: { 'content-type': 'text/event-stream' } },
      )
    }
    throw new Error(`unexpected fetch: ${url}`)
  }) as typeof fetch

  t.after(() => {
    globalThis.fetch = realFetch
  })

  const response = await requestChat()
  const body = await response.text()

  assert.equal(response.status, 200)
  assert.match(response.headers.get('content-type') ?? '', /text\/event-stream/)
  assert.equal(bridgeCalls, 1)
  assert.equal(freeCompletions, 0, 'a healthy bridge must not fall through to the free lanes')
  assert.equal(body, BRIDGE_SSE, 'the bridge stream must pass through byte-for-byte')
})

test('a slow agent that emits its first status after 6 seconds is not replaced', async (t) => {
  const realFetch = globalThis.fetch
  let bridgeCalls = 0
  let bridgeController: ReadableStreamDefaultController<Uint8Array> | undefined
  freeCompletions = 0

  mock.timers.enable({ apis: ['setTimeout'] })
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url === 'http://bridge.test/v1/chat/completions') {
      bridgeCalls += 1
      return new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            bridgeController = controller
          },
        }),
        { status: 200, headers: { 'content-type': 'text/event-stream' } },
      )
    }
    throw new Error(`unexpected fetch: ${url}`)
  }) as typeof fetch

  t.after(() => {
    globalThis.fetch = realFetch
    mock.timers.reset()
  })

  const pending = requestChat()
  await flushTasks()
  // Cross the old 6-second gate with no event. The agent must still be alive.
  mock.timers.tick(6_000)
  assert.equal(bridgeCalls, 1)
  assert.equal(freeCompletions, 0, 'a slow agent must not be replaced by free chat')

  assert.ok(bridgeController, 'the bridge stream should be open')
  bridgeController.enqueue(new TextEncoder().encode(BRIDGE_SSE))
  bridgeController.close()

  const response = await pending
  const body = await response.text()

  assert.equal(response.status, 200)
  assert.equal(freeCompletions, 0, 'the slow agent must keep the turn')
  assert.equal(body, BRIDGE_SSE, 'the slow agent stream must pass through unchanged')
})
