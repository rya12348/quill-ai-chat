import assert from 'node:assert/strict'
import test from 'node:test'

import type { WorkspaceFile } from '../src/shared/workspace'
import {
  CHECK_SCRIPT,
  SANDBOX_LIMITS,
  SANDBOX_NETWORK_DOMAINS,
  openSandboxSession,
  parseCommandStream,
  planVerification,
  runWorkspaceSandbox,
  sandboxConfigured,
  sandboxFiles,
  trimOutput,
  writeFileCommands,
} from '../src/worker/sandbox'

const files: WorkspaceFile[] = [
  { path: 'index.html', content: '<!doctype html><html lang="en"><head><title>Card</title></head><body><h1>Card</h1></body></html>' },
  { path: 'styles.css', content: '.card { color: red }' },
]

const env = {
  VERCEL_TOKEN: 'token',
  VERCEL_PROJECT_ID: 'prj_123',
}

type Call = { url: string; method: string; body?: string }

function fakeFetch(calls: Call[], commandOutput = 'OK: 2 files checked', exitCode = 0) {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    calls.push({ url, method: init?.method ?? 'GET', ...(typeof init?.body === 'string' ? { body: init.body } : {}) })
    if (url.includes('/v2/sandboxes/sessions/') && url.includes('/cmd')) {
      // Setup writes always succeed; only the verification command carries the
      // outcome, which is what a real sandbox does too.
      const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as { command?: string }) : {}
      const verify = body.command === 'node' || body.command === 'npm'
      const line = verify
        ? JSON.stringify({ command: { exitCode }, stream: 'stdout', data: commandOutput })
        : JSON.stringify({ command: { exitCode: 0 }, stream: 'stdout', data: '' })
      return new Response(`${line}\n`, { status: 200, headers: { 'content-type': 'application/x-ndjson' } })
    }
    if (init?.method === 'DELETE') return new Response('{}', { status: 200 })
    return new Response(JSON.stringify({ sandbox: { name: 'sbx_1' }, session: { id: 'sess_1' } }), { status: 200 })
  }) as typeof fetch
}

test('the sandbox stays dark without a token and a project', () => {
  assert.equal(sandboxConfigured({}), false)
  assert.equal(sandboxConfigured({ VERCEL_TOKEN: 't' }), false)
  assert.equal(sandboxConfigured({ VERCEL_PROJECT_ID: 'p' }), false)
  assert.equal(sandboxConfigured({ VERCEL_TOKEN: 't', VERCEL_PROJECT_ID: 'p' }), true)
})

test('an unconfigured sandbox does no network work at all', async () => {
  const calls: Call[] = []
  const outcome = await runWorkspaceSandbox({}, files, { fetchImpl: fakeFetch(calls) })
  assert.equal(outcome.configured, false)
  assert.equal(outcome.ran, false)
  assert.equal(outcome.status, 'skipped')
  assert.equal(calls.length, 0, 'no token means no request may leave the worker')
})

test('a static workspace runs the file checker', () => {
  const plan = planVerification(files)
  assert.ok(plan)
  assert.equal(plan.label, 'static checks')
  assert.deepEqual(plan.steps, [{ command: 'node', args: ['checks.mjs'] }])
  assert.equal(plan.network, false)
  assert.match(CHECK_SCRIPT, /missing local asset/)
})

test('a package.json project runs its own test script after installing', () => {
  const plan = planVerification([
    {
      path: 'package.json',
      content: JSON.stringify({ scripts: { test: 'node --test' }, devDependencies: { typescript: '^5' } }),
    },
  ])
  assert.ok(plan)
  assert.equal(plan.label, 'npm test')
  assert.equal(plan.network, true)
  assert.deepEqual(
    plan.steps.map((step) => step.command + ' ' + step.args[0]),
    ['npm install', 'npm test'],
  )
})

test('a package.json with no runnable script does not invent one', () => {
  assert.equal(planVerification([{ path: 'package.json', content: '{"scripts":{}}' }]), null)
  assert.equal(planVerification([{ path: 'package.json', content: 'not json' }]), null)
})

test('command output is parsed from ND-JSON and from a plain object', () => {
  const stream = [
    JSON.stringify({ command: { exitCode: null }, stream: 'stdout', data: 'building…\n' }),
    JSON.stringify({ command: { exitCode: 1 }, stream: 'stderr', data: 'error TS2345\n' }),
  ].join('\n')
  const parsed = parseCommandStream(stream)
  assert.equal(parsed.exitCode, 1)
  assert.equal(parsed.output, 'building…\nerror TS2345\n')

  const plain = parseCommandStream(JSON.stringify({ command: { exitCode: 0 } }))
  assert.equal(plain.exitCode, 0)
})

test('base64 payloads are decoded but short log words are left alone', () => {
  const encoded = Buffer.from('2 files checked\n').toString('base64')
  assert.equal(parseCommandStream(JSON.stringify({ stream: 'stdout', data: encoded })).output, '2 files checked\n')
  // "FAIL" is valid base64 of unprintable bytes; it must stay as text.
  assert.equal(parseCommandStream(JSON.stringify({ stream: 'stdout', data: 'FAIL' })).output, 'FAIL')
})

test('large files are written in chunks under the argument limit', () => {
  const big = { path: 'app.js', content: 'x'.repeat(120_000) }
  const steps = writeFileCommands(big)
  assert.equal(steps.length, 3)
  for (const step of steps) {
    assert.ok(step.args[1]!.length < 128_000, 'each shell argument stays under MAX_ARG_STRLEN')
  }
  const encoded = steps.map((step) => /printf '%s' '([^']*)' \| base64/.exec(step.args[1]!)?.[1] ?? '').join('')
  assert.equal(atob(encoded), big.content)
})

test('file selection respects the byte budget', () => {
  // Sized against the real limit, so raising it for imported repositories does
  // not quietly make this test vacuous.
  const big = Math.floor(SANDBOX_LIMITS.bytes * 0.7)
  const chosen = sandboxFiles([
    { path: 'a.html', content: 'a'.repeat(big) },
    { path: 'b.html', content: 'b'.repeat(big) },
    { path: 'c.js', content: 'c'.repeat(Math.floor(SANDBOX_LIMITS.bytes * 0.35)) },
  ])
  assert.deepEqual(chosen.map((file) => file.path), ['a.html'])
})

test('the output keeps the reason for a failure', () => {
  const long = 'start\n' + 'x'.repeat(9_000) + '\nTypeError: boom'
  const trimmed = trimOutput(long, 1_000)
  assert.ok(trimmed.length <= 1_050)
  assert.match(trimmed, /TypeError: boom/)
})

test('a passing run creates, writes, verifies, then deletes the sandbox', async () => {
  const calls: Call[] = []
  const outcome = await runWorkspaceSandbox(env, files, { fetchImpl: fakeFetch(calls) })

  assert.equal(outcome.configured, true)
  assert.equal(outcome.ran, true)
  assert.equal(outcome.status, 'pass')
  assert.equal(outcome.exitCode, 0)
  assert.match(outcome.output, /OK: 2 files checked/)

  assert.equal(calls[0]!.method, 'POST')
  assert.match(calls[0]!.url, /\/v2\/sandboxes$/)
  const created = JSON.parse(calls[0]!.body ?? '{}') as Record<string, unknown>
  assert.equal(created.projectId, 'prj_123')
  assert.equal(created.persistent, false)
  // The API rejects a bare mode string, so the policy must be an object.
  assert.deepEqual(created.networkPolicy, { mode: 'deny-all' })

  // checker + two files, then the verification command
  assert.equal(calls.filter((call) => call.url.includes('/cmd')).length, 4)
  // A non-persistent sandbox is released through its session, not by name.
  assert.equal(calls.at(-1)!.method, 'POST')
  assert.match(calls.at(-1)!.url, /\/v2\/sandboxes\/sessions\/sess_1\/stop$/)
})

test('a failing build is reported with its output, not thrown', async () => {
  const calls: Call[] = []
  const outcome = await runWorkspaceSandbox(env, files, {
    fetchImpl: fakeFetch(calls, 'index.html: missing local asset styles.css\nFAIL', 1),
  })
  assert.equal(outcome.status, 'fail')
  assert.equal(outcome.exitCode, 1)
  assert.match(outcome.output, /missing local asset/)
  assert.match(calls.at(-1)!.url, /\/stop$/, 'a failing run still releases its sandbox')
})

test('an error record in the command stream is a failure, not a pass', () => {
  const parsed = parseCommandStream(
    [
      JSON.stringify({ command: { id: 'cmd_1' } }),
      JSON.stringify({ stream: 'error', data: { code: 'quota_exceeded', message: 'no runtime capacity' } }),
    ].join('\n'),
  )
  assert.equal(parsed.exitCode, 1)
  assert.match(parsed.output, /no runtime capacity/)
})

test('the manifest is kept even when the project is too big for the budget', () => {
  const chosen = sandboxFiles([
    { path: 'index.html', content: 'x'.repeat(150_000) },
    { path: 'app.js', content: 'y'.repeat(60_000) },
    { path: 'package.json', content: JSON.stringify({ scripts: { test: 'node --test' } }) },
  ])
  assert.equal(chosen[0]!.path, 'package.json')
})

test('a rejected stop falls back to deleting a named sandbox', async () => {
  const calls: Call[] = []
  const stopping = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    calls.push({ url, method: init?.method ?? 'GET' })
    if (url.endsWith('/stop')) return new Response('{"error":"session gone"}', { status: 404 })
    if (url.includes('/cmd')) return new Response(JSON.stringify({ command: { exitCode: 0 }, stream: 'stdout', data: 'OK' }) + '\n', { status: 200 })
    if (init?.method === 'DELETE') return new Response('{}', { status: 200 })
    return new Response(JSON.stringify({ sandbox: { name: 'sbx_1' }, session: { id: 'sess_1' } }), { status: 200 })
  }) as typeof fetch

  await runWorkspaceSandbox(env, files, { fetchImpl: stopping })
  const last = calls.at(-1)!
  assert.equal(last.method, 'DELETE')
  assert.match(last.url, /\/v2\/sandboxes\/sbx_1\?projectId=prj_123$/)
})

test('a sandbox that cannot start is an error, not a project failure', async () => {
  const calls: Call[] = []
  const failing = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), method: init?.method ?? 'GET' })
    return new Response('{"error":"insufficient credits"}', { status: 402 })
  }) as typeof fetch

  const outcome = await runWorkspaceSandbox(env, files, { fetchImpl: failing })
  assert.equal(outcome.status, 'error')
  assert.equal(outcome.ran, false)
  assert.match(outcome.reason ?? '', /could not start \(402\)/)
})

test('the agent shell may install from the registry and nothing else', async () => {
  const calls: Call[] = []
  const session = await openSandboxSession(env, { fetchImpl: fakeFetch(calls) })
  assert.ok(session)

  // An install is the difference between a repository task being possible and
  // being impossible, so the registries are reachable. Everything else stays
  // closed: a command the model wrote cannot scrape an arbitrary host.
  const created = JSON.parse(calls[0]!.body ?? '{}') as Record<string, unknown>
  assert.deepEqual(created.networkPolicy, { mode: 'custom', allowedDomains: SANDBOX_NETWORK_DOMAINS })
  assert.deepEqual(SANDBOX_NETWORK_DOMAINS, ['registry.npmjs.org', 'registry.yarnpkg.com'])

  await session.stop()
})
