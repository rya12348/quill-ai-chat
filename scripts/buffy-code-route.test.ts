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
const sandboxModule = await import('../src/worker/sandbox')

// The sandbox itself is covered by scripts/sandbox.test.ts; here it only needs
// to prove the route calls it and publishes what it said.
let sandboxRuns = 0
let sandboxResult: Awaited<ReturnType<typeof sandboxModule.runWorkspaceSandbox>> = {
  configured: true,
  ran: true,
  status: 'pass',
  command: 'static checks',
  exitCode: 0,
  output: 'OK: 3 files checked',
  durationMs: 1_200,
}

mock.module('../src/worker/sandbox.ts', {
  namedExports: {
    ...sandboxModule,
    runWorkspaceSandbox: async () => {
      sandboxRuns += 1
      return sandboxResult
    },
  },
})

mock.module('../src/worker/public-ai.ts', {
  namedExports: {
    ...publicAi,
    publicLanes: () => [dentLane],
    publicComplete: fakePublicComplete,
  },
})
// Lets one test make the checks fail only for the edited workspace, which is
// how the regression gate is exercised end to end.
let verifyOverride: ((pages: { name: string; html: string }[]) => ReturnType<typeof buildModule.verifyPages>) | null = null

mock.module('../src/worker/build.ts', {
  namedExports: {
    ...buildModule,
    buildComplete: fakeBuildComplete,
    verifyPages: (pages: { name: string; html: string }[], options?: { interactive?: boolean; question?: string }) =>
      verifyOverride ? verifyOverride(pages) : buildModule.verifyPages(pages, options),
  },
})

const { buffy } = await import('../src/worker/routes/buffy.ts')

// The saved project the worker keeps, the undo step behind it, and the writes
// it makes to either.
let storedWorkspace: { title: string; content: string; updated_at: number } | null = null
let versionRow: { id: number; title: string; content: string; created_at: number } | null = null
let versionCount = 0
let workspaceSaves: { sql: string; params: unknown[] }[] = []

function fakeDb(): Env['DB'] {
  return {
    prepare(sql: string) {
      let params: unknown[] = []
      const statement = {
        bind: (...values: unknown[]) => {
          params = values
          return statement
        },
        first: async () => {
          if (sql.includes('INSERT INTO rate_limits')) return { count: 1, reset_at: Date.now() + 60_000 }
          if (sql.includes('code_workspace_versions')) {
            return /COUNT\(\*\)/i.test(sql) ? { n: versionCount } : versionRow
          }
          if (sql.includes('FROM code_workspaces')) return storedWorkspace
          return null
        },
        run: async () => {
          if (/^DELETE FROM code_workspaces\b/.test(sql.trim())) storedWorkspace = null
          if (/^DELETE FROM code_workspace_versions\b/.test(sql.trim())) {
            versionRow = null
            versionCount = 0
          }
          if (sql.includes('code_workspaces')) workspaceSaves.push({ sql, params })
          // The upsert is what the next load reads back.
          if (sql.includes('INSERT INTO code_workspaces') && params.length === 4) {
            storedWorkspace = { title: String(params[1]), content: String(params[2]), updated_at: Number(params[3]) }
          }
          return { success: true }
        },
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

const workspace = [
  {
    path: 'index.html',
    content:
      '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Card</title><link rel="stylesheet" href="styles.css"></head><body><h1>Card</h1><div class="card">Hello</div></body></html>',
  },
  { path: 'styles.css', content: '.card { color: red }' },
]

async function requestEdit(prompt: string) {
  const response = await app.request(
    'http://localhost/api/buffy/code',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost' },
      body: JSON.stringify({ prompt, model: 'dent', workspace }),
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

test('a tab with no local project continues from the saved workspace', async () => {
  storedWorkspace = {
    title: 'Saved Project',
    content: JSON.stringify({
      files: workspace,
      plan: [{ text: 'Ship the card', done: false }],
    }),
    updated_at: Date.now() - 1_000,
  }
  workspaceSaves = []
  pageResponses = [
    `=== FILE: styles.css
<<<<<<< SEARCH
.card { color: red }
=======
.card { color: blue }
>>>>>>> REPLACE`,
  ]
  completionPrompts = []
  fallbackCalls = 0

  const response = await app.request(
    'http://localhost/api/buffy/code',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost' },
      // No workspace and no previous build: the browser forgot everything.
      body: JSON.stringify({ prompt: 'make the card blue', model: 'dent' }),
    },
    env,
  )
  const events = parseEvents(await response.text())

  assert.equal(response.status, 200)
  assert.equal(fallbackCalls, 0, 'the saved project must be edited, not rebuilt')
  assert.match(completionPrompts[0]!, /<file path="styles\.css">/)
  assert.match(completionPrompts[0]!, /Plan so far:/)

  // A restored project is reported as the current one, not as a new build.
  const statuses = events.filter((entry) => entry.event === 'status').map((entry) => JSON.parse(entry.data) as { text?: string })
  assert.ok(statuses.some((status) => /Reading the current project/.test(status.text ?? '')))
  assert.ok(!statuses.some((status) => /Starting a new project/.test(status.text ?? '')))
  assert.ok(events.some((entry) => entry.event === 'tool' && entry.data.includes('2 files loaded')))

  const build = buildEvent(events)
  assert.equal(build.files?.find((file) => file.path === 'styles.css')?.content, '.card { color: blue }')

  const save = workspaceSaves.find((entry) => entry.sql.includes('code_workspaces'))
  assert.ok(save, 'the edited project is saved for the next device')
  assert.equal(save.params[0], 'route-test-user')
  assert.match(String(save.params[2]), /color: blue/)

  storedWorkspace = null
})

test('a request to move a file edits the saved project instead of rebuilding', async () => {
  storedWorkspace = {
    title: 'Saved Project',
    content: JSON.stringify({ files: workspace, plan: [] }),
    updated_at: Date.now() - 1_000,
  }
  workspaceSaves = []
  // "make sure the page still links it" matches the build intent regex, so this
  // prompt used to skip the saved workspace and rebuild from scratch, throwing
  // the project away.
  pageResponses = ['=== RENAME: styles.css -> theme.css']
  completionPrompts = []
  fallbackCalls = 0

  const response = await app.request(
    'http://localhost/api/buffy/code',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost' },
      body: JSON.stringify({
        prompt: 'Rename styles.css to theme.css instead of styles.css, and make sure the page still links it.',
        model: 'dent',
      }),
    },
    env,
  )
  const events = parseEvents(await response.text())

  assert.equal(response.status, 200)
  assert.equal(fallbackCalls, 0, 'a rename must never start a new project')
  assert.match(completionPrompts[0]!, /<file path="styles\.css">/)

  const statuses = statusTexts(events)
  assert.ok(statuses.some((text) => /Reading the current project/.test(text)))
  assert.ok(!statuses.some((text) => /Starting a new project/.test(text)))

  const build = buildEvent(events)
  assert.ok(!build.files?.some((file) => file.path === 'styles.css'), 'the old path is gone')
  assert.ok(build.files?.some((file) => file.path === 'theme.css'), 'the new path exists')

  storedWorkspace = null
})

test('undo puts the previous saved project back', async () => {
  const previous = {
    title: 'Saved Project',
    content: JSON.stringify({ files: workspace, plan: [{ text: 'Ship the card', done: true }] }),
    updated_at: 1,
  }
  storedWorkspace = {
    title: 'New Project',
    content: JSON.stringify({ files: [{ path: 'index.html', content: '<h1>new</h1>' }], plan: [] }),
    updated_at: 2,
  }
  versionRow = { id: 7, ...previous }
  versionCount = 1

  const response = await app.request(
    'http://localhost/api/buffy/code/revert',
    { method: 'POST', headers: { origin: 'http://localhost' } },
    env,
  )
  const body = (await response.json()) as { title: string; files: { path: string }[]; plan: { text: string }[]; history: number }

  assert.equal(response.status, 200)
  assert.equal(body.title, 'Saved Project')
  assert.deepEqual(
    body.files.map((file) => file.path),
    ['index.html', 'styles.css'],
  )
  assert.equal(body.plan[0]?.text, 'Ship the card')

  // A project with no saved step refuses instead of pretending.
  versionRow = null
  versionCount = 0
  const empty = await app.request(
    'http://localhost/api/buffy/code/revert',
    { method: 'POST', headers: { origin: 'http://localhost' } },
    env,
  )
  assert.equal(empty.status, 404)
  storedWorkspace = null
})

test('a new chat clears the saved project and its undo history', async () => {
  storedWorkspace = {
    title: 'Saved Project',
    content: JSON.stringify({ files: workspace, plan: [{ text: 'Ship the card', done: true }] }),
    updated_at: 1,
  }
  versionRow = { id: 9, title: 'Saved Project', content: '{}', created_at: 1 }
  versionCount = 2

  const response = await app.request(
    'http://localhost/api/buffy/code/reset',
    { method: 'POST', headers: { origin: 'http://localhost' } },
    env,
  )
  const body = (await response.json()) as { ok: boolean; history: number }
  assert.equal(response.status, 200)
  assert.equal(body.ok, true)
  assert.equal(body.history, 0)

  // The next read is empty, so the new chat cannot inherit the old project.
  const read = await app.request('http://localhost/api/buffy/code/workspace', {}, env)
  const after = (await read.json()) as { files: unknown[]; plan: unknown[]; history: number }
  assert.deepEqual(after.files, [])
  assert.deepEqual(after.plan, [])
  assert.equal(after.history, 0, 'undo history goes with the project')

  // Another origin cannot wipe someone's project.
  const foreign = await app.request(
    'http://localhost/api/buffy/code/reset',
    { method: 'POST', headers: { origin: 'https://evil.example' } },
    env,
  )
  assert.equal(foreign.status, 403)
})

test('the saved workspace is readable without a build', async () => {
  storedWorkspace = {
    title: 'Saved Project',
    content: JSON.stringify({ files: workspace, plan: [{ text: 'Ship the card', done: true }] }),
    updated_at: 1_700_000_000_000,
  }
  const response = await app.request('http://localhost/api/buffy/code/workspace', {}, env)
  const body = (await response.json()) as { title: string; files: { path: string }[]; plan: { text: string }[] }

  assert.equal(response.status, 200)
  assert.match(response.headers.get('cache-control') ?? '', /no-store/)
  assert.equal(body.title, 'Saved Project')
  assert.deepEqual(
    body.files.map((file) => file.path),
    ['index.html', 'styles.css'],
  )
  assert.equal(body.plan[0]?.text, 'Ship the card')
  storedWorkspace = null
})

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

test('a follow-up turn edits workspace files instead of reprinting the page', async () => {
  pageResponses = [
    `=== FILE: styles.css
<<<<<<< SEARCH
.card { color: red }
=======
.card { color: blue }
>>>>>>> REPLACE`,
  ]
  completionPrompts = []
  fallbackCalls = 0

  const { response, events } = await requestEdit('make the card blue')

  assert.equal(response.status, 200)
  assert.equal(completionPrompts.length, 1, 'an applied edit must not spend a second model call')
  // The edit turn is shown the real files, not a reprint request.
  assert.match(completionPrompts[0]!, /<file path="styles\.css">/)
  assert.match(completionPrompts[0]!, /make the card blue/)
  assert.equal(fallbackCalls, 0, 'a landed edit must not fall through to the page builder')

  const build = buildEvent(events)
  assert.equal(sandboxRuns, 0, 'no Vercel token means no sandbox is created')
  assert.equal(build.sandbox, undefined)
  assert.equal(build.files?.find((file) => file.path === 'styles.css')?.content, '.card { color: blue }')
  // The preview inlines the local stylesheet, so the change is visible without
  // a second document.
  assert.match(build.html, /<style data-workspace="styles\.css">/)
  assert.match(build.html, /color: blue/)
})

test('a configured sandbox verifies the edit and its output reaches the build', async () => {
  pageResponses = [
    `=== FILE: styles.css
<<<<<<< SEARCH
.card { color: red }
=======
.card { color: blue }
>>>>>>> REPLACE`,
  ]
  sandboxRuns = 0
  sandboxResult = {
    configured: true,
    ran: true,
    status: 'fail',
    command: 'static checks',
    exitCode: 1,
    output: 'index.html: missing local asset styles.css',
    durationMs: 2_400,
  }

  const response = await app.request(
    'http://localhost/api/buffy/code',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost' },
      body: JSON.stringify({ prompt: 'make the card blue', model: 'dent', workspace }),
    },
    { ...env, VERCEL_TOKEN: 'token', VERCEL_PROJECT_ID: 'prj_123' } as unknown as Env,
  )
  const events = parseEvents(await response.text())

  assert.equal(response.status, 200)
  // One run: the failing result is attached. The repair call is covered by the
  // sandbox and workspace tests, and this mock returns the same answer again.
  assert.ok(sandboxRuns >= 1)
  const build = buildEvent(events)
  assert.equal(build.sandbox?.status, 'fail')
  assert.match(build.sandbox?.output ?? '', /missing local asset/)
  assert.ok(
    events.some((entry) => entry.event === 'tool' && entry.data.includes('run_command')),
    'the activity timeline should show the command run',
  )
})

test('an edit that applies but breaks a page check is reverted, and the full builder runs', async () => {
  pageResponses = [
    `=== FILE: styles.css
<<<<<<< SEARCH
.card { color: red }
=======
.card { color: blue }
>>>>>>> REPLACE`,
  ]
  fallbackCalls = 0
  fallbackBuild = {
    status: 'ready',
    kind: 'page',
    title: 'Fallback Page',
    html: goodPage,
    models: ['Page Builder'],
    asOf: Date.now(),
  }
  verifyOverride = (pages) =>
    pages.some((page) => /color: blue/.test(page.html))
      ? { checks: [{ id: 'viewport', label: 'index.html: No viewport', status: 'fail' as const }], failures: ['index.html: No viewport'], warnings: [], score: 40 }
      : { checks: [], failures: [], warnings: [], score: 100 }

  const { response, events } = await requestEdit('make the card blue')
  verifyOverride = null

  assert.equal(response.status, 200)
  assert.equal(fallbackCalls, 1, 'a regression must hand the turn to the page builder')
  assert.ok(statusTexts(events).some((text) => /page checks worse/.test(text)))

  const build = buildEvent(events)
  assert.equal(build.title, 'Fallback Page')
  assert.equal(
    build.files?.some((file) => file.content.includes('color: blue')) ?? false,
    false,
    'the rejected workspace is discarded, not published',
  )
})

test('a neutral edit still lands without a rebuild', async () => {
  pageResponses = [
    `=== FILE: styles.css
<<<<<<< SEARCH
.card { color: red }
=======
.card { color: green }
>>>>>>> REPLACE`,
  ]
  fallbackCalls = 0
  // The same page-level warning before and after: a colour tweak is fine.
  verifyOverride = () => ({
    checks: [{ id: 'viewport', label: 'index.html: No viewport', status: 'warn' as const }],
    failures: [],
    warnings: ['index.html: No viewport'],
    score: 90,
  })

  const { events } = await requestEdit('make the card green')
  verifyOverride = null

  assert.equal(fallbackCalls, 0)
  const build = buildEvent(events)
  assert.equal(build.files?.find((file) => file.path === 'styles.css')?.content, '.card { color: green }')
})

test('an edit that cannot be applied falls back to the page builder', async () => {
  pageResponses = ['Sure, I made the card blue.']
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

  const { response, events } = await requestEdit('make the card blue')

  assert.equal(response.status, 200)
  assert.equal(fallbackCalls, 1, 'an unusable edit should hand the turn to the page builder')
  assert.ok(statusTexts(events).some((text) => /rebuilding/.test(text)))

  const build = buildEvent(events)
  assert.equal(build.title, 'Fallback Page')
  assert.ok(build.files?.length, 'the fallback page is converted into workspace files')
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
