import assert from 'node:assert/strict'
import test, { mock } from 'node:test'

import { Hono } from 'hono'

import type { BuildInfo } from '../src/shared/types'
import type { FreebuffUser } from '@freebuff/auth'
import type { BuildIntent, BuildOutcome } from '../src/worker/build'
import type { AppContext, Env } from '../src/worker/env'
import type { LaneResult, PublicLane } from '../src/worker/public-ai'

/**
 * Chat's Build mode wiring: a follow-up in a conversation that already has a
 * stored workspace must take the shared diff path, and a rejected diff must
 * hand the turn to the full page builder. Buffy Code's copy of the loop is
 * covered by scripts/buffy-code-route.test.ts; this file covers the chat route.
 */

const page = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Card Project</title>
<link rel="stylesheet" href="styles.css"></head>
<body><h1>Card Project</h1><div class="card">Hello</div><button id="go">Go</button><script src="app.js"></script></body></html>`

const storedBuild: BuildInfo = {
  status: 'ready',
  kind: 'page',
  title: 'Card Project',
  html: page,
  files: [
    { path: 'index.html', content: page },
    { path: 'styles.css', content: '.card { color: red }' },
    {
      path: 'app.js',
      content:
        'document.getElementById("go").addEventListener("click", function () { document.querySelector(".card").textContent = "Clicked" })',
    },
  ],
  models: ['Test lane'],
  asOf: Date.now(),
}

const fallbackBuild: BuildInfo = {
  status: 'ready',
  kind: 'page',
  title: 'Fallback Page',
  html: page.replace('Card Project', 'Fallback Page'),
  models: ['Page Builder'],
  asOf: Date.now(),
}

const lane: PublicLane = {
  url: 'https://free.test/v1/chat/completions',
  model: 'test-free',
  label: 'Test Free',
  description: 'test free lane',
  billing: 'free',
}

let completions = 0
let completionPrompts: string[] = []
let fallbackCalls = 0

async function* fakePublicComplete(
  _lanes: PublicLane[],
  input: { messages: { role: string; content: string }[]; onLaneResult?: (result: LaneResult) => void },
) {
  completions += 1
  completionPrompts.push(input.messages.at(-1)?.content ?? '')
  const text = replies.shift() ?? ''
  input.onLaneResult?.({ lane, ok: true, latencyMs: 1 })
  yield { type: 'text' as const, text }
}

let replies: string[] = []

async function fakeBuildComplete(input: BuildIntent): Promise<BuildOutcome> {
  fallbackCalls += 1
  return { text: 'The fallback page is ready.', build: fallbackBuild, route: input.route ?? {} } as BuildOutcome
}

const publicAi = await import('../src/worker/public-ai')
const buildModule = await import('../src/worker/build')

mock.module('../src/worker/public-ai.ts', {
  namedExports: {
    ...publicAi,
    publicLanes: () => [lane],
    publicComplete: fakePublicComplete,
  },
})

mock.module('../src/worker/build.ts', {
  namedExports: {
    ...buildModule,
    buildComplete: fakeBuildComplete,
  },
})

const { chat } = await import('../src/worker/routes/chat.ts')

const conversation = {
  id: 'conv-1',
  owner_sub: 'route-test-user',
  title: 'Card Project',
  model: 'test-free',
  created_at: Date.now() - 60_000,
  updated_at: Date.now() - 60_000,
  project_id: null,
  reaction: null,
}

/** Answers only the queries this route needs; everything else is empty. */
function fakeDb(): Env['DB'] {
  return {
    prepare(sql: string) {
      const statement = {
        bind: () => statement,
        first: async () => {
          if (sql.includes('INSERT INTO rate_limits')) return { count: 1, reset_at: Date.now() + 60_000 }
          if (sql.includes('FROM conversations')) return conversation
          return null
        },
        all: async () => {
          // latestBuild() and loadBuildReferences() both read the stored build.
          if (sql.includes('FROM message_build')) {
            return { results: [{ content: JSON.stringify({ info: storedBuild }) }] }
          }
          return { results: [] }
        },
        run: async () => ({ success: true }),
      }
      return statement
    },
    batch: async () => [],
  } as unknown as Env['DB']
}

const env = {
  ASSETS: { fetch: async () => new Response('') },
  DB: fakeDb(),
  BUILD_ENABLED: '1',
  OWNER_SUB: 'route-test-user',
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
app.route('/api/chat', chat)

type ChatEvent = { type?: string; text?: string; build?: BuildInfo; buildRef?: unknown }

function parseEvents(body: string): ChatEvent[] {
  return body
    .split(/\r?\n\r?\n/)
    .filter((block) => block.trim())
    .flatMap((block) => {
      const data: string[] = []
      for (const line of block.split(/\r?\n/)) {
        if (line.startsWith('data:')) data.push(line.slice('data:'.length).trimStart())
      }
      const raw = data.join('\n')
      if (!raw.startsWith('{')) return []
      try {
        return [JSON.parse(raw) as ChatEvent]
      } catch {
        return []
      }
    })
}

async function requestBuildFollowUp(content: string) {
  const response = await app.request(
    'http://localhost/api/chat',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost' },
      body: JSON.stringify({ conversationId: 'conv-1', content, strategy: 'build' }),
    },
    env,
    { waitUntil: () => {}, passThroughOnException: () => {} } as unknown as ExecutionContext,
  )
  const body = await response.text()
  return { response, body, events: parseEvents(body) }
}

function buildEvent(events: ChatEvent[]): BuildInfo {
  const event = events.findLast((entry) => entry.type === 'build')
  assert.ok(event?.build, `expected a build event, saw: ${events.map((entry) => entry.type).join(', ')}`)
  return event.build
}

test('a Build follow-up with a stored workspace edits files instead of reprinting', async () => {
  replies = [
    `=== FILE: styles.css
<<<<<<< SEARCH
.card { color: red }
=======
.card { color: blue }
>>>>>>> REPLACE`,
  ]
  completions = 0
  completionPrompts = []
  fallbackCalls = 0

  const { response, events } = await requestBuildFollowUp('make the card blue')

  assert.equal(response.status, 200)
  assert.equal(fallbackCalls, 0, 'a landed edit must not fall through to the page builder')
  assert.equal(completions, 1, 'an applied edit is one model call with no repair')

  // The turn was handed the real files from the stored workspace.
  assert.match(completionPrompts[0]!, /<file path="styles\.css">/)
  assert.match(completionPrompts[0]!, /make the card blue/)

  const statuses = events.filter((entry) => entry.type === 'status').map((entry) => entry.text ?? '')
  assert.ok(statuses.some((text) => /Editing 3 project files/.test(text)))

  // The reply is the edit summary, not a fresh document.
  const deltas = events.filter((entry) => entry.type === 'delta').map((entry) => entry.text ?? '').join('')
  assert.match(deltas, /Updated the existing project/)

  const build = buildEvent(events)
  assert.equal(build.files?.find((file) => file.path === 'styles.css')?.content, '.card { color: blue }')
  assert.match(build.html, /color: blue/, 'the preview reflects the edited file')
  assert.equal(build.title, 'Card Project', 'the existing project keeps its title')
})

test('a rejected Build edit falls back to the full page builder', async () => {
  replies = [
    `=== FILE: index.html
<<<<<<< CREATE
<!doctype html><html><body></body></html>
>>>>>>> CREATE`,
    // The one corrective call the regression buys, and it still scores worse.
    `=== FILE: index.html
<<<<<<< CREATE
<!doctype html><html><body><p>still broken</p></body></html>
>>>>>>> CREATE`,
  ]
  completions = 0
  completionPrompts = []
  fallbackCalls = 0

  const { response, events } = await requestBuildFollowUp('make the page simpler')

  assert.equal(response.status, 200)
  assert.equal(completions, 2, 'the regression buys exactly one corrective call')
  assert.match(completionPrompts[1] ?? '', /made the page checks worse/)
  assert.equal(fallbackCalls, 1, 'a regression must hand the turn to the page builder')

  const statuses = events.filter((entry) => entry.type === 'status').map((entry) => entry.text ?? '')
  assert.ok(statuses.some((text) => /page checks worse/.test(text)))

  const build = buildEvent(events)
  assert.equal(build.title, 'Fallback Page', 'the fallback build is what gets sent')
  assert.equal(
    build.files?.some((file) => file.content.trim() === '<!doctype html><html><body></body></html>') ?? false,
    false,
    'the rejected workspace is discarded, not published',
  )
})
