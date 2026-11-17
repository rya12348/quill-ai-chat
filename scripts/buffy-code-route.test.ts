import assert from 'node:assert/strict'
import test, { mock } from 'node:test'

import { Hono } from 'hono'

import type { BuildInfo } from '../src/shared/types'
import type { FreebuffUser } from '@freebuff/auth'
import type { BuildIntent, BuildOutcome } from '../src/worker/build'
import type { AppContext, Env } from '../src/worker/env'
import type { LaneResult, PublicLane } from '../src/worker/public-ai'

const goodPage = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Field Notes</title>
<style>
:root{--ink:#20231f;--paper:#f7f4ec;--surface:#fffdf8;--line:#dfd9cb;--accent:#a4472b;--radius:12px;--space:8px}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.6 system-ui,sans-serif}
header{display:flex;align-items:center;justify-content:space-between;gap:20px;max-width:1120px;margin:0 auto;padding:16px 24px}
main{max-width:1120px;margin:0 auto;padding:0 24px}.hero{display:grid;grid-template-columns:1.1fr .9fr;gap:40px;padding:64px 0}
.eyebrow{color:var(--accent);font-size:12px;letter-spacing:.14em;text-transform:uppercase}h1{font-size:clamp(2rem,6vw,4rem);line-height:1;margin:.2em 0}
p{max-width:60ch;color:#556055}.panel{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:24px}
button{min-height:44px;padding:0 18px;border:1px solid var(--line);border-radius:9px;background:var(--surface);font:inherit;cursor:pointer}
button:focus-visible,a:focus-visible{outline:3px solid var(--accent);outline-offset:3px}.note{margin-top:16px;font-weight:600}
@media (max-width:720px){.hero{grid-template-columns:1fr;padding:36px 0}header{flex-wrap:wrap}}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
</style></head>
<body><header><strong>Field Notes</strong><nav><a href="#work">Work</a><a href="#contact">Contact</a></nav></header>
<main><section class="hero"><div><p class="eyebrow">Independent studio</p><h1>Useful things, made carefully.</h1><p>We design notebooks and small objects for people who care about how a tool feels in the hand. Every material is chosen for repair and daily use.</p><button id="cta">See the collection</button><p class="note" id="note" aria-live="polite"></p></div><div class="panel"><h2>Made to be used</h2><p>Simple forms, visible construction and paper that takes ink without bleeding through.</p></div></section>
<section id="work"><h2>Selected work</h2><p>The Field Book, the Low Desk and a small set of folders. Each piece is finished by hand in the studio.</p></section>
<section id="contact"><h2>Start a project</h2><p>Tell us what you need and we will reply with a material and timing estimate.</p></section></main>
<script>document.getElementById('cta').addEventListener('click',function(){document.getElementById('note').textContent='The collection is ready to view.'})</script>
</body></html>`

const weakPage =
  '<!doctype html><html><head><title>Weak</title></head><body><h1>Weak page</h1><p>This page has enough readable copy to be a complete candidate, but it is missing a viewport and a real button action.</p><button>Go</button></body></html>'

const dentLane: PublicLane = {
  url: 'https://dent.test/v1/chat/completions',
  model: 'deepseek-v4.1-flash',
  label: 'DeepSeek V4.1 Flash',
  description: 'test Dent lane',
  billing: 'free',
}

let pageResponses: string[] = []
let completionPrompts: string[] = []
let fallbackCalls = 0
let fallbackQuestion = ''
let fallbackBuild: BuildInfo = {
  status: 'ready',
  kind: 'page',
  title: 'Fallback Page',
  html: goodPage,
  models: ['Page Builder'],
  asOf: Date.now(),
}

async function* fakePublicComplete(
  _lanes: PublicLane[],
  input: {
    messages: { role: string; content: string }[]
    onLaneResult?: (result: LaneResult) => void
  },
) {
  completionPrompts.push(input.messages.at(-1)?.content ?? '')
  const text = pageResponses.shift() ?? ''
  input.onLaneResult?.({ lane: dentLane, ok: true, latencyMs: 1 })
  yield { type: 'text' as const, text }
}

async function fakeBuildComplete(input: BuildIntent): Promise<BuildOutcome> {
  fallbackCalls += 1
  fallbackQuestion = input.question
  return { text: 'The fallback page is ready.', build: fallbackBuild }
}

const publicAi = await import('../src/worker/public-ai')
const buildModule = await import('../src/worker/build')

mock.module('../src/worker/public-ai.ts', {
  namedExports: {
    ...publicAi,
    publicLanes: () => [dentLane],
    publicComplete: fakePublicComplete,
  },
})
mock.module('../src/worker/build.ts', {
  namedExports: {
    ...buildModule,
    buildComplete: fakeBuildComplete,
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
app.route('/api/buffy', buffy)

type SseEvent = { event?: string; data: string }

function parseEvents(body: string): SseEvent[] {
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

async function requestBuild(prompt: string) {
  const response = await app.request(
    'http://localhost/api/buffy/code',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost' },
      body: JSON.stringify({ prompt, model: 'dent' }),
    },
    env,
  )
  return { response, events: parseEvents(await response.text()) }
}

function buildEvent(events: SseEvent[]): BuildInfo {
  const event = events.findLast((entry) => entry.event === 'build')
  assert.ok(event, 'expected a build event')
  return (JSON.parse(event.data) as { build: BuildInfo }).build
}

function statusTexts(events: SseEvent[]): string[] {
  return events
    .filter((entry) => entry.event === 'status')
    .map((entry) => (JSON.parse(entry.data) as { text?: string }).text ?? '')
}

test('Dent page route repairs through the verifier before emitting a build', async () => {
  pageResponses = [weakPage, goodPage]
  completionPrompts = []
  fallbackCalls = 0

  const { response, events } = await requestBuild('Build a landing page for a small design studio')

  assert.equal(response.status, 200)
  assert.equal(completionPrompts.length, 2, 'the route should make a draft and one verifier-gated repair')
  assert.match(completionPrompts[0]!, /landing page for a small design studio/)
  assert.match(completionPrompts[1]!, /deterministic page checks/)
  assert.match(completionPrompts[1]!, /FAILED CHECKS/)

  const build = buildEvent(events)
  assert.match(build.html, /Field Notes/)
  assert.equal(build.verification?.status, 'verified')
  assert.equal(build.verification?.repaired, true)
  assert.equal(fallbackCalls, 0, 'a verified repair must not fall through to the page builder')
})

test('Dent page route falls back to the page builder when no complete page is produced', async () => {
  pageResponses = ['I could not produce a complete page.']
  completionPrompts = []
  fallbackCalls = 0
  fallbackBuild = {
    status: 'ready',
    kind: 'page',
    title: 'Fallback Page',
    html: goodPage,
    models: ['Page Builder'],
    asOf: Date.now(),
  }

  const { response, events } = await requestBuild('Build a landing page for a small design studio')

  assert.equal(response.status, 200)
  assert.equal(completionPrompts.length, 1)
  assert.equal(fallbackCalls, 1, 'an empty Dent candidate should hand the turn to the page builder')
  assert.equal(fallbackQuestion, 'Build a landing page for a small design studio')

  const messages = statusTexts(events)
  assert.ok(messages.some((text) => /incomplete page/.test(text)))
  assert.ok(messages.some((text) => /page builder/.test(text)))

  const build = buildEvent(events)
  assert.equal(build.title, 'Fallback Page')
  assert.deepEqual(build.models, ['Page Builder'])
})
