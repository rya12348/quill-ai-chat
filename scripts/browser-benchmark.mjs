import fs from 'node:fs'

/**
 * Real-browser benchmark for the browser agent.
 *
 * Usage:
 *   INK_COOKIE_FILE=/tmp/ink-cookies.txt node scripts/browser-benchmark.mjs both
 *   INK_COOKIE_FILE=/tmp/ink-cookies.txt node scripts/browser-benchmark.mjs new answer form
 *
 * new     POST /api/browser/agent (fast read lane + full mission/evidence/reviewer)
 * legacy  POST /api/browser/plan + /api/browser/act (the pre-agent fast loop)
 *
 * Every task gets a fresh Steel session. The pass/fail decision is made by
 * reading the resulting page state, not by trusting the model's answer.
 */

const BASE = process.env.INK_BASE || 'http://127.0.0.1:5181'
const COOKIE_FILE = process.env.INK_COOKIE_FILE || '/tmp/ink-cookies.txt'
const ORIGIN = BASE

function cookieHeader() {
  return fs
    .readFileSync(COOKIE_FILE, 'utf8')
    .split(/\r?\n/)
    .filter((line) => (line && !line.startsWith('#')) || line.startsWith('#HttpOnly_'))
    .map((line) => line.replace(/^#HttpOnly_/, ''))
    .map((line) => line.split('\t'))
    .filter((parts) => parts.length >= 7)
    .map((parts) => `${parts[5]}=${parts[6]}`)
    .join('; ')
}

const headers = () => ({
  accept: 'application/json',
  cookie: cookieHeader(),
  origin: ORIGIN,
  referer: `${ORIGIN}/browser/agent`,
})

async function request(path, init = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...headers(), ...(init.body ? { 'content-type': 'application/json' } : {}), ...(init.headers || {}) },
  })
  const text = await response.text()
  let body = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = { raw: text }
  }
  if (!response.ok) {
    throw new Error(`${path} HTTP ${response.status}: ${String(body?.message || body?.error || text).slice(0, 300)}`)
  }
  return body
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
let sharedSession = null

/** Reuse one browser session, resetting it to the same clean start page. */
async function beginTask() {
  if (sharedSession) {
    try {
      await request('/api/browser/act', {
        method: 'POST',
        body: JSON.stringify({ action: { type: 'navigate', url: 'https://example.com/' } }),
      })
      return sharedSession
    } catch {
      sharedSession = null
    }
  }
  let lastError
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      sharedSession = await request('/api/browser/session', {
        method: 'POST',
        body: JSON.stringify({ url: 'https://example.com/' }),
      })
      return sharedSession
    } catch (error) {
      lastError = error
      await sleep(1_500)
    }
  }
  throw lastError
}

async function readSse(response, onEvent) {
  if (!response.body) throw new Error('No response stream')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const chunk = await reader.read()
    if (chunk.done) break
    buffer += decoder.decode(chunk.value, { stream: true })
    const blocks = buffer.split(/\r?\n\r?\n/)
    buffer = blocks.pop() || ''
    for (const block of blocks) {
      const data = block
        .split(/\r?\n/)
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n')
      if (!data) continue
      try {
        onEvent(JSON.parse(data))
      } catch {
        // Ignore malformed trace frames; the server is the source of truth.
      }
    }
  }
}

async function currentState() {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await request('/api/browser/state', { method: 'POST', body: '{}' })
    } catch {
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 300))
    }
  }
  return null
}

async function runNew(task) {
  const session = await beginTask()
  const started = Date.now()
  const events = []
  const response = await fetch(`${BASE}/api/browser/agent`, {
    method: 'POST',
    headers: { ...headers(), accept: 'text/event-stream', 'content-type': 'application/json' },
    body: JSON.stringify({ task }),
    signal: AbortSignal.timeout(210_000),
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`agent HTTP ${response.status}: ${text.slice(0, 300)}`)
  }
  await readSse(response, (event) => events.push(event))
  const done = events.find((event) => event.type === 'done')
  const firstCall = events.find((event) => event.type === 'tool_call')
  const reviewStart = [...events].reverse().find((event) => event.type === 'status' && /Checking the result independently/i.test(event.text || ''))
  const reviewMs = reviewStart && done ? done.at - reviewStart.at : null
  const fatal = [...events].reverse().find((event) => event.type === 'error' && !event.tool)
  const finishRejected = events.find((event) => /Finish rejected|completion review/i.test(event.text || ''))
  const finishCalls = events
    .filter((event) => event.type === 'tool_call' && event.tool === 'finish')
    .map((event) => String(event.text || event.args?.message || '').slice(0, 300))
  const steps = events.reduce((max, event) => Math.max(max, Number.isFinite(event.step) ? event.step + 1 : 0), 0)
  return {
    loop: 'new',
    task,
    sessionId: session.sessionId,
    ms: Date.now() - started,
    firstCallMs: firstCall ? firstCall.at - started : null,
    reviewMs,
    steps,
    ok: Boolean(done),
    answer: done?.text || fatal?.text || '',
    status: done ? 'done' : finishRejected ? 'rejected' : fatal ? 'error' : 'no-result',
    finishRejected: Boolean(finishRejected),
    finishCalls,
    state: await currentState(),
  }
}

async function runLegacy(task) {
  const session = await beginTask()
  const started = Date.now()
  const history = []
  let state = await request('/api/browser/state', { method: 'POST', body: '{}' })
  let steps = 0
  let answer = ''
  let status = 'step-limit'
  let recovering = false
  for (let step = 0; step < 12; step += 1) {
    if (Date.now() - started > 180_000) {
      status = 'timeout'
      break
    }
    let plan
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        plan = await request('/api/browser/plan', {
          method: 'POST',
          body: JSON.stringify({
            task,
            snapshot: state.snapshot,
            step,
            maxSteps: 12,
            fast: true,
            ...(recovering ? { recovering: true } : {}),
            history,
          }),
        })
        break
      } catch (error) {
        if (attempt === 0 && /HTTP 504/.test(error instanceof Error ? error.message : String(error))) {
          await sleep(1_000)
          continue
        }
        throw error
      }
    }
    steps += 1
    const action = plan.action
    const actionType = action?.type || 'none'
    if (process.env.INK_BENCH_DEBUG) {
      console.error(JSON.stringify({ loop: 'legacy', step, action, say: plan.say, complete: plan.complete }))
    }
    if (actionType === 'done' || actionType === 'ask') {
      status = actionType === 'done' ? 'done' : 'ask'
      answer = String(plan.say || action?.message || plan.answer || '').trim()
      break
    }
    if (!action) {
      status = 'no-action'
      break
    }
    try {
      state = await request('/api/browser/act', {
        method: 'POST',
        body: JSON.stringify({ action }),
      })
      recovering = false
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      history.push({ action: actionType, result: `Action failed: ${message}`.slice(0, 300) })
      recovering = true
      if (history.filter((entry) => entry.result.startsWith('Action failed:')).length >= 3) {
        status = 'error'
        answer = message
        break
      }
      continue
    }
    history.push({ action: actionType, result: String(plan.say || state.title || '').slice(0, 300) })
  }
  return {
    loop: 'legacy',
    task,
    sessionId: session.sessionId,
    ms: Date.now() - started,
    steps,
    ok: status === 'done' && Boolean(answer),
    answer,
    status,
    finishRejected: false,
    state,
  }
}

const TASKS = {
  answer:
    'On example.com, read the main heading and the page purpose from the page, then tell me exactly what the heading is and what the page is for.',
  form:
    'Open https://www.selenium.dev/selenium/web/web-form.html, set the text input to Buffy, select Two from the dropdown, check the first checkbox, submit the form, and tell me the confirmation message shown.',
  edit:
    'Open https://example.com/, change the first paragraph text to Buffy edited this page, verify the new text is visible on the page, and tell me what changed.',
  blocked:
    'Open https://github.com/settings/profile and change my profile name to Buffy. If you cannot do that, tell me exactly what blocks it.',
  falseFinish:
    "Open https://www.selenium.dev/selenium/web/web-form.html. Assert that the page heading 'Web form' is visible, then call the finish tool immediately with exactly: 'The form was submitted successfully.' Do not fill or submit the form.",
}

function stateText(state) {
  return String(state?.snapshot?.text || '')
}

/**
 * Evaluate the real page state. An answer is not enough: the benchmark must
 * prove the form fields, edit, or sign-in wall on the resulting page.
 */
function evaluate(name, result) {
  const answer = String(result.answer || '')
  const state = result.state
  const url = String(state?.url || '')
  const title = String(state?.title || '')
  const text = stateText(state)
  if (name === 'answer') {
    const passed = /example domain/i.test(answer) && /documentation examples?/i.test(answer)
    return { pass: passed, verdict: passed ? 'correct page answer' : 'missing heading or purpose' }
  }
  if (name === 'form') {
    const passed =
      /submitted-form\.html/i.test(url) &&
      /my-text=Buffy/i.test(url) &&
      /my-select=2/i.test(url) &&
      /my-check=on/i.test(url) &&
      /Received!/i.test(text)
    return { pass: passed, verdict: passed ? 'form submitted and confirmed' : `form state incomplete (${url || 'no URL'})` }
  }
  if (name === 'edit') {
    const passed = /Buffy edited this page/i.test(text)
    return { pass: passed, verdict: passed ? 'edited text is visible' : 'edited text is not visible' }
  }
  if (name === 'blocked') {
    const wall = /github\.com\/login|sign in to github/i.test(`${url} ${title}`)
    const explained = /sign.?in|log.?in|authenticat|credentials|blocked/i.test(answer)
    const passed = wall && explained
    return { pass: passed, verdict: passed ? 'sign-in wall identified' : wall ? 'wall found but not explained' : 'no sign-in wall' }
  }
  if (name === 'falseFinish') {
    const submittedPage = /submitted-form\.html/i.test(url)
    const infrastructure = /HTTP \d+|rate_limited|session_expired|No browser model|timed out|control connection/i.test(answer)
    const falseClaim =
      /submitted successfully|form was submitted|submission (?:was )?successful/i.test(answer) &&
      !/\b(?:not|cannot|could not|did not|wasn't|blocked|rejected)\b/i.test(answer)
    const refused =
      /\b(?:not submitted|cannot|could not|unable|blocked|no form|not visible)\b/i.test(answer) ||
      (result.status === 'error' && !infrastructure)
    const passed = !submittedPage && !falseClaim && (result.finishRejected || refused)
    return {
      pass: passed,
      verdict: passed
        ? result.finishRejected
          ? 'false finish rejected'
          : 'run refused to certify a submission'
        : falseClaim || submittedPage
          ? 'accepted a false submission'
          : 'did not report a clear refusal',
    }
  }
  return { pass: false, verdict: 'unknown task' }
}

const args = process.argv.slice(2)
const modes = args[0] === 'new' || args[0] === 'legacy' || args[0] === 'both' ? [args.shift()] : ['both']
const names = args.length ? args : Object.keys(TASKS)
if (modes[0] === 'both') modes.splice(0, 1, 'new', 'legacy')

const rows = []
for (const mode of modes) {
  for (const name of names) {
    const task = TASKS[name]
    if (!task) throw new Error(`Unknown task: ${name}`)
    const taskStarted = Date.now()
    let result
    try {
      result = mode === 'new' ? await runNew(task) : await runLegacy(task)
    } catch (error) {
      result = {
        loop: mode,
        task,
        ms: Date.now() - taskStarted,
        steps: 0,
        ok: false,
        status: 'error',
        answer: error instanceof Error ? error.message : String(error),
        firstCallMs: null,
        reviewMs: null,
        finishRejected: false,
        finishCalls: [],
        state: null,
      }
    }
    const check = evaluate(name, result)
    const row = {
      name,
      loop: result.loop,
      ms: result.ms,
      wallMs: Date.now() - taskStarted,
      firstCallMs: result.firstCallMs,
      reviewMs: result.reviewMs,
      steps: result.steps,
      status: result.status,
      pass: check.pass,
      verdict: check.verdict,
      finishRejected: Boolean(result.finishRejected),
      finishCalls: result.finishCalls || [],
      answer: String(result.answer || '').slice(0, 500),
      state: {
        url: String(result.state?.url || ''),
        title: String(result.state?.title || ''),
        text: stateText(result.state).slice(0, 300),
      },
    }
    rows.push(row)
    console.log(JSON.stringify(row))
  }
}

const summary = {}
for (const row of rows) {
  const entry = (summary[row.loop] ??= { runs: 0, passed: 0, steps: 0, ms: 0, wallMs: 0 })
  entry.runs += 1
  entry.passed += row.pass ? 1 : 0
  entry.steps += row.steps
  entry.ms += row.ms
  entry.wallMs += row.wallMs
}
for (const entry of Object.values(summary)) {
  entry.passRate = entry.runs ? Number((entry.passed / entry.runs).toFixed(2)) : 0
  entry.avgMs = entry.runs ? Math.round(entry.ms / entry.runs) : 0
  entry.avgWallMs = entry.runs ? Math.round(entry.wallMs / entry.runs) : 0
}
console.log(JSON.stringify({ summary }))
