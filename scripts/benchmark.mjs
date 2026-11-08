#!/usr/bin/env node
// Live benchmark for Quill's free Team mode.
//
// It talks to the running app's real /api/chat SSE endpoint, records the
// conversation id from the start event, deletes that conversation immediately,
// and verifies the daily usage counter returns to its pre-run value. It never
// mocks the model path and never touches the app's existing conversations.
//
// Usage:
//   node scripts/benchmark.mjs --calibrate
//   node scripts/benchmark.mjs --best-model=nvidia/nemotron-3-super-120b
//   node scripts/benchmark.mjs --tasks=C1,M1 --modes=team,best
//
// The full run writes bench/results.json and bench/latest.md. Calibration
// writes bench/calibration.json.

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASE = (process.env.QUILL_BASE_URL || 'http://127.0.0.1:5180').replace(/\/$/, '')
const ORIGIN = new URL(BASE).origin
const BENCH_DIR = path.join(ROOT, 'bench')
const STATE_PATH = path.join(BENCH_DIR, 'inflight.json')
const RESULTS_PATH = path.join(BENCH_DIR, 'results.json')
const CALIBRATION_PATH = path.join(BENCH_DIR, 'calibration.json')
const TASK_TIMEOUT = 8 * 60_000
const CODE_TIMEOUT = 8_000
const LONG_CODE = 'QX-7319-MINT'

mkdirSync(BENCH_DIR, { recursive: true })

function args(argv) {
  const out = { _: [] }
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (!token.startsWith('--')) {
      out._.push(token)
      continue
    }
    const [key, inline] = token.slice(2).split('=')
    if (inline !== undefined) out[key] = inline
    else if (argv[i + 1] && !argv[i + 1].startsWith('--')) out[key] = argv[++i]
    else out[key] = true
  }
  return out
}

const cli = args(process.argv.slice(2))
const taskFilter = typeof cli.tasks === 'string' ? cli.tasks.split(',').map((item) => item.trim()).filter(Boolean) : null
const modeFilter = typeof cli.modes === 'string' ? cli.modes.split(',').map((item) => item.trim()).filter(Boolean) : null
const BEST_MODEL = typeof cli['best-model'] === 'string' ? cli['best-model'] : 'nvidia/nemotron-3-super-120b'
const BASELINE_MODEL = typeof cli['baseline-model'] === 'string' ? cli['baseline-model'] : 'command-a-plus-05-2026'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const utcToday = () => new Date().toISOString().slice(0, 10)
function plusDays(iso, days) {
  const date = new Date(`${iso}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
const TODAY = utcToday()
const PLUS53 = plusDays(TODAY, 53)

class HttpError extends Error {
  constructor(message, status, body) {
    super(message)
    this.status = status
    this.body = body
  }
}

async function request(pathname, init = {}) {
  const headers = new Headers(init.headers)
  headers.set('origin', ORIGIN)
  headers.set('accept', init.accept || 'application/json')
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json')
  const response = await fetch(`${BASE}${pathname}`, { ...init, headers })
  return response
}

async function json(pathname, init = {}) {
  const response = await request(pathname, init)
  const text = await response.text()
  let body = null
  try { body = text ? JSON.parse(text) : null } catch { body = text }
  if (!response.ok) throw new HttpError(`${pathname} returned ${response.status}`, response.status, body)
  return body
}

async function deleteConversation(id) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await request(`/api/conversations/${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (response.ok) return true
      if (response.status === 404) return true
    } catch {
      /* retry */
    }
    await sleep(250 * attempt)
  }
  return false
}

function readState() {
  try {
    const parsed = JSON.parse(readFileSync(STATE_PATH, 'utf8'))
    return Array.isArray(parsed?.ids) ? parsed.ids.filter((id) => typeof id === 'string') : []
  } catch {
    return []
  }
}

function writeState(ids) {
  if (!ids.length) {
    if (existsSync(STATE_PATH)) rmSync(STATE_PATH, { force: true })
    return
  }
  writeFileSync(STATE_PATH, JSON.stringify({ ids, at: Date.now() }, null, 2))
}

async function cleanupOrphans() {
  const ids = readState()
  if (!ids.length) return []
  const removed = []
  for (const id of ids) {
    if (await deleteConversation(id)) removed.push(id)
  }
  const left = ids.filter((id) => !removed.includes(id))
  writeState(left)
  return removed
}

async function snapshot() {
  const list = await json('/api/conversations')
  const items = Array.isArray(list?.items) ? list.items : []
  let messages = 0
  let readErrors = 0
  for (const conversation of items) {
    try {
      const body = await json(`/api/conversations/${encodeURIComponent(conversation.id)}`)
      messages += Array.isArray(body?.messages) ? body.messages.length : 0
    } catch {
      // A conversation could disappear between list and read. Count it so the
      // caller retries instead of silently reporting a smaller message total.
      readErrors += 1
    }
  }
  const me = await json('/api/me')
  return {
    conversations: items.length,
    messages,
    readErrors,
    usage: me?.usage?.used ?? null,
    limit: me?.usage?.limit ?? null,
    mode: me?.capabilities?.mode ?? null,
    search: me?.capabilities?.search ?? null,
  }
}

/** Waits for two identical reads so a transient D1/read race is not reported as data loss. */
async function stableSnapshot() {
  let previous = await snapshot()
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await sleep(700)
    const next = await snapshot()
    if (JSON.stringify(next) === JSON.stringify(previous)) return next
    previous = next
  }
  return previous
}

function parseSseBlock(block) {
  const data = block
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .join('\n')
  if (!data) return null
  try {
    return JSON.parse(data)
  } catch {
    return null
  }
}

/**
 * One real app turn. The SSE stream is consumed incrementally so the
 * conversation id is persisted before the model finishes; cleanup can happen
 * even if the model or the harness aborts.
 */
async function runTurn({ task, strategy, model }) {
  const startedAt = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TASK_TIMEOUT)
  let conversationId = null
  let startEvent = null
  let teamEvents = []
  let statuses = []
  let doneEvent = null
  let errorEvent = null
  let deltaText = ''
  let firstDeltaMs = null
  let finishMs = null
  let streamError = null
  let cleanup = 'not_needed'
  let usageAfter = null

  try {
    const response = await request('/api/chat', {
      method: 'POST',
      accept: 'text/event-stream',
      body: JSON.stringify({ content: task.prompt, strategy, ...(model ? { model } : {}), reasoning: false }),
      signal: controller.signal,
    })

    if (!response.ok || !response.body) {
      const body = await response.text().catch(() => '')
      throw new HttpError(`chat returned ${response.status}`, response.status, body)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    const consume = (block) => {
      const event = parseSseBlock(block)
      if (!event) return
      if (event.type === 'start') {
        startEvent = event
        const id = event?.conversation?.id
        if (typeof id === 'string' && id && id !== conversationId) {
          conversationId = id
          const ids = readState()
          if (!ids.includes(id)) writeState([...ids, id])
        }
      } else if (event.type === 'team') {
        teamEvents = [...teamEvents, event.team]
      } else if (event.type === 'status') {
        if (statuses.length < 40) statuses = [...statuses, event.text]
      } else if (event.type === 'delta') {
        if (firstDeltaMs === null) firstDeltaMs = Date.now() - startedAt
        deltaText += event.text ?? ''
      } else if (event.type === 'done') {
        doneEvent = event
        finishMs = Date.now() - startedAt
      } else if (event.type === 'error') {
        errorEvent = event
      }
    }

    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let boundary
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        consume(buffer.slice(0, boundary))
        buffer = buffer.slice(boundary + 2)
      }
    }
    if (buffer.trim()) consume(buffer)
    finishMs ??= Date.now() - startedAt
  } catch (error) {
    streamError = error instanceof Error ? error.message : String(error)
  } finally {
    clearTimeout(timer)
    if (conversationId) {
      const deleted = await deleteConversation(conversationId)
      cleanup = deleted ? 'deleted' : 'failed'
      if (deleted) {
        writeState(readState().filter((id) => id !== conversationId))
      } else {
        const ids = readState()
        if (!ids.includes(conversationId)) writeState([...ids, conversationId])
      }
      try {
        const me = await json('/api/me')
        usageAfter = me?.usage?.used ?? null
      } catch {
        usageAfter = null
      }
    }
  }

  const answer = doneEvent?.message?.content ?? deltaText
  const team = teamEvents.length ? teamEvents[teamEvents.length - 1] : null
  let verdict = { pass: null, detail: 'no checker' }
  try {
    verdict = task.check(answer, { team, teamEvents, events: { startEvent, doneEvent, errorEvent } }) ?? verdict
  } catch (error) {
    verdict = { pass: false, detail: `checker threw: ${error instanceof Error ? error.message : String(error)}` }
  }

  return {
    taskId: task.id,
    area: task.area,
    strategy,
    model: model ?? null,
    startedAt,
    latencyMs: finishMs ?? Date.now() - startedAt,
    firstDeltaMs,
    prompt: task.prompt,
    answer,
    answerChars: answer.length,
    statuses,
    team,
    teamEvents,
    error: errorEvent ?? (streamError ? { code: 'harness', message: streamError } : null),
    interrupted: !doneEvent,
    usageAfter,
    cleanup,
    ...verdict,
  }
}

/* -------------------------------------------------------------------------- */
/* Task definitions and objective checks                                      */
/* -------------------------------------------------------------------------- */

function extractPython(answer, functionName) {
  const fenced = [...answer.matchAll(/```(?:python|py)?\s*\n([\s\S]*?)```/gi)].map((match) => match[1] ?? '')
  const preferred = fenced.find((code) => new RegExp(`def\\s+${functionName}\\s*\\(`).test(code))
  if (preferred) return preferred
  if (new RegExp(`def\\s+${functionName}\\s*\\(`).test(answer)) return answer
  return ''
}

function runPython(code, tests) {
  const dir = mkdtempSync(path.join(tmpdir(), 'quill-bench-'))
  const file = path.join(dir, 'solution.py')
  try {
    writeFileSync(file, `${code}\n\n${tests}\n`)
    const result = spawnSync('python', ['-I', file], {
      cwd: dir,
      timeout: CODE_TIMEOUT,
      encoding: 'utf8',
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    })
    const stdout = (result.stdout ?? '').slice(-2_000)
    const stderr = (result.stderr ?? '').slice(-2_000)
    return {
      ok: result.status === 0 && stdout.includes('HIDDEN_OK'),
      status: result.status,
      signal: result.signal,
      stdout,
      stderr,
      error: result.error ? String(result.error) : null,
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const C1_TESTS = `
def _quill_case(values, expected):
    original = list(values)
    got = two_largest(list(values))
    if expected is None:
        assert got is None, f"expected None for {values!r}, got {got!r}"
    else:
        assert got is not None, f"expected {expected!r} for {values!r}, got None"
        assert list(got) == expected, f"expected {expected!r} for {values!r}, got {got!r}"
    assert values == original, f"mutated input for {values!r}"

_quill_case([], None)
_quill_case([42], None)
_quill_case([5, 5, 1], [5, 5])
_quill_case([7, 7, 3], [7, 7])
_quill_case([3, 1, 2], [3, 2])
_quill_case([-1, -5, -3], [-1, -3])
_quill_case([10, 10, 9, 9], [10, 10])
print("HIDDEN_OK")
`

const C2_TESTS = `
def _quill_close(a, b):
    assert abs(a - b) < 1e-9, f"expected {b}, got {a}"

assert average([]) is None, "empty list must return None"
_quill_close(average([2, 4, 6]), 4)
_quill_close(average([-1, 1]), 0)
_quill_close(average([5]), 5)
print("HIDDEN_OK")
`

function codeCheck(answer, functionName, tests) {
  const code = extractPython(answer, functionName)
  if (!code) return { pass: false, detail: `no Python code block defining ${functionName}()` }
  const block = answer.match(/```(?:python|py)?\s*\n([\s\S]*?)```/i)
  const outside = block ? answer.replace(block[0], '').trim() : answer.trim()
  const meta = /(?:The user wants me|Let me analyze|Let me think|I need to|We need to produce|Checker's finding|Earlier drafts|The candidate answer|looking at the candidate)/i.test(outside)
  const clean = outside.length <= 400 && !meta
  const run = runPython(code, tests)
  const pass = run.ok && clean
  const detail = !run.ok
    ? `hidden tests failed (status ${run.status}${run.signal ? `, ${run.signal}` : ''})`
    : !clean
      ? `code passed, but the final answer contains ${outside.length} characters of non-code meta/prose`
      : 'hidden Python tests passed with a clean final answer'
  return {
    pass,
    detail,
    evidence: { status: run.status, stderr: run.stderr, stdout: run.stdout, error: run.error, outsideChars: outside.length, meta },
  }
}

function hasNumber(answer, value) {
  const normalized = answer.replace(/,/g, '')
  return new RegExp(`(^|[^0-9])${String(value).replace('.', '\\.')}([^0-9]|$)`).test(normalized)
}

function longManual() {
  const parts = []
  for (let i = 1; i <= 26; i += 1) {
    if (i === 17) {
      parts.push(
        `Section ${i}. Operations note. The vault access code is ${LONG_CODE}. Keep it out of ordinary status reports; it is used only during a verified maintenance handoff. The surrounding sections describe routines that do not require the code.`,
      )
    } else {
      parts.push(
        `Section ${i}. Routine operations. The team records inventory, checks the backup log, and confirms that the previous shift completed its checklist. Nothing in this section changes the weekly schedule or grants access to the vault. The supervisor reviews exceptions the next business day.`,
      )
    }
  }
  return parts.join('\n\n')
}

const LONG_PROMPT = `Read the entire operations manual below. The answer is inside it. Do not use outside knowledge.\n\n${longManual()}\n\nQuestion: What is the vault access code? Answer with only the code, with no other words.`
if (LONG_PROMPT.length > 7_900) throw new Error(`long-context prompt is ${LONG_PROMPT.length} chars; the app limit is 8,000`)

function jsonCheck(answer) {
  const trimmed = answer.trim()
  if (!trimmed) return { pass: false, detail: 'empty answer' }
  if (trimmed.startsWith('```')) return { pass: false, detail: 'answer used a Markdown code fence' }
  let body
  try {
    body = JSON.parse(trimmed)
  } catch {
    return { pass: false, detail: 'answer is not strict JSON' }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { pass: false, detail: 'answer is not a JSON object' }
  const keys = Object.keys(body).sort()
  const expected = ['actions', 'risk', 'score', 'vendor']
  if (keys.join(',') !== expected.join(',')) return { pass: false, detail: `wrong keys: ${keys.join(',')}` }
  if (typeof body.vendor !== 'string' || !body.vendor.trim()) return { pass: false, detail: 'vendor is not a non-empty string' }
  if (!['low', 'medium', 'high', 'critical'].includes(body.risk)) return { pass: false, detail: 'risk is not an allowed value' }
  if (!['high', 'critical'].includes(body.risk)) return { pass: false, detail: 'risk did not reflect the missed deadlines' }
  if (!Number.isInteger(body.score) || body.score < 0 || body.score > 100) return { pass: false, detail: 'score is not an integer from 0 to 100' }
  if (!Array.isArray(body.actions) || body.actions.length !== 3 || body.actions.some((item) => typeof item !== 'string' || !item.trim())) {
    return { pass: false, detail: 'actions must be exactly three non-empty strings' }
  }
  return { pass: true, detail: 'strict JSON and schema passed' }
}

function fiveStepsCheck(answer) {
  const lines = answer.trim().split(/\r?\n/)
  if (lines.length !== 5) return { pass: false, detail: `expected exactly 5 lines, got ${lines.length}` }
  for (let index = 0; index < 5; index += 1) {
    const line = lines[index].trim()
    const expected = new RegExp(`^STEP ${index + 1}: .+\\.$`)
    if (!expected.test(line)) return { pass: false, detail: `line ${index + 1} does not match "STEP ${index + 1}: <sentence>."` }
  }
  return { pass: true, detail: 'exactly five constrained lines passed' }
}

function dateCheck(answer) {
  const normalized = answer.replace(/[`*_]/g, '').trim()
  const today = normalized.match(/(?:^|\n)\s*TODAY:\s*(\d{4}-\d{2}-\d{2})\s*(?:\n|$)/i)?.[1]
  const plus = normalized.match(/(?:^|\n)\s*PLUS53:\s*(\d{4}-\d{2}-\d{2})\s*(?:\n|$)/i)?.[1]
  if (today !== TODAY) return { pass: false, detail: `TODAY was ${today ?? 'missing'}, expected ${TODAY}` }
  if (plus !== PLUS53) return { pass: false, detail: `PLUS53 was ${plus ?? 'missing'}, expected ${PLUS53}` }
  return { pass: true, detail: `both dates exact (${TODAY}, ${PLUS53})` }
}

function manualGrade(autoChecks, rubric) {
  return {
    pass: null,
    manual: true,
    detail: `manual rubric required; automatic checks: ${autoChecks.map((item) => `${item.label}=${item.pass ? 'pass' : 'fail'}`).join(', ')}`,
    autoChecks,
    rubric,
  }
}

const TASKS = [
  {
    id: 'C1',
    area: 'coding',
    limitMs: 8 * 60_000,
    prompt:
      'Write a short Python program with a function two_largest(nums) that returns the two largest numbers in a list, including duplicates. For example, two_largest([5, 5, 1]) must return 5 and 5. Return None when the list has fewer than two numbers. Do not mutate the input. Include three examples. Put the final solution in one Python code block.',
    check: (answer) => codeCheck(answer, 'two_largest', C1_TESTS),
  },
  {
    id: 'C2',
    area: 'coding',
    limitMs: 8 * 60_000,
    prompt:
      'Write a short Python program with a function average(nums) that returns None for an empty list and the arithmetic mean otherwise. Do not mutate the input. Include two tests that run. Put the final solution in one Python code block.',
    check: (answer) => codeCheck(answer, 'average', C2_TESTS),
  },
  {
    id: 'M1',
    area: 'math',
    limitMs: 8 * 60_000,
    prompt:
      "An $80 shirt is 25% off, then an extra 10% off the sale price. What is the final price, and why isn't it 35% off? Show the working. Also state what a flat 35% discount would have been, and compare it with the correct final price.",
    check: (answer) => {
      const checks = [
        { label: '$54 final', pass: hasNumber(answer, 54) },
        { label: '$60 after first discount', pass: hasNumber(answer, 60) },
        { label: '$52 comparison', pass: hasNumber(answer, 52) },
        { label: 'explains sequential discounts', pass: /(?:one after|sequentially|second discount|applied to the sale|not additive|compounded)/i.test(answer) },
      ]
      return { pass: checks.every((item) => item.pass), detail: checks.map((item) => `${item.label}=${item.pass ? 'pass' : 'fail'}`).join(', '), checks }
    },
  },
  {
    id: 'M3',
    area: 'math',
    limitMs: 8 * 60_000,
    prompt:
      "A 180-mile trip: the first 120 miles at 60 mph, the last 60 miles at 20 mph. What is the average speed, and why isn't it 40 mph? Show the time.",
    check: (answer) => {
      const checks = [
        { label: '36 mph', pass: hasNumber(answer, 36) },
        { label: '2 hours first leg', pass: /\b2\s*(?:hours?|hrs?|h)\b/i.test(answer) },
        { label: '3 hours second leg', pass: /\b3\s*(?:hours?|hrs?|h)\b/i.test(answer) },
        { label: '5 hours total', pass: /\b5\b[^\n]{0,40}(?:hours?|hrs?|h)\b/i.test(answer) || /(?:total(?:\s+time)?)[^\n]{0,80}\b5\b/i.test(answer) },
        { label: 'not 40 mph', pass: /(?:not|isn't|is not)\s+40|40\s*mph\s+(?:would|is|assumes)/i.test(answer) || hasNumber(answer, 40) },
      ]
      return { pass: checks.every((item) => item.pass), detail: checks.map((item) => `${item.label}=${item.pass ? 'pass' : 'fail'}`).join(', '), checks }
    },
  },
  {
    id: 'I1',
    area: 'instruction',
    limitMs: 8 * 60_000,
    prompt:
      'A vendor missed a security deadline twice. Return only a valid JSON object, with no Markdown fence and no prose, containing exactly these keys: "vendor" (string), "risk" (one of "low", "medium", "high", "critical"), "score" (integer 0-100), and "actions" (an array of exactly three non-empty strings). Use "Northstar" as the vendor and set risk to "high" or "critical".',
    check: (answer) => jsonCheck(answer),
  },
  {
    id: 'I2',
    area: 'instruction',
    limitMs: 3 * 60_000,
    prompt:
      'Give exactly five steps for safely restarting a home router. Output only five lines. Each line must be exactly in the form "STEP n: <one sentence>." with n from 1 to 5. Do not include a title, bullets, blank lines, or any closing text.',
    check: (answer) => fiveStepsCheck(answer),
  },
  {
    id: 'L1',
    area: 'long-context',
    limitMs: 8 * 60_000,
    prompt: LONG_PROMPT,
    check: (answer) => {
      const compact = answer.replace(/[`*_\s]/g, '').toUpperCase()
      return compact === LONG_CODE
        ? { pass: true, detail: `exact buried code ${LONG_CODE}` }
        : { pass: false, detail: `expected only ${LONG_CODE}, got ${JSON.stringify(answer.slice(0, 200))}` }
    },
  },
  {
    id: 'F1',
    area: 'freshness',
    limitMs: 3 * 60_000,
    prompt: `Using today's date (UTC), answer with exactly two lines and no other text:\nTODAY: YYYY-MM-DD\nPLUS53: YYYY-MM-DD`,
    check: (answer) => dateCheck(answer),
  },
  {
    id: 'R1',
    area: 'research',
    limitMs: 8 * 60_000,
    prompt:
      'Does the EU AI Act ban facial recognition in public places? Explain the actual rule and cite two real sources. Prefer an official EU source.',
    check: (answer) => {
      const urls = [...answer.matchAll(/https?:\/\/[^\s)\]>]+/g)].map((match) => match[0])
      const checks = [
        { label: 'mentions facial recognition/biometrics', pass: /facial recognition|biometric/i.test(answer) },
        { label: 'mentions public spaces', pass: /public(?:ly)? accessible|public places|public spaces/i.test(answer) },
        { label: 'mentions exceptions/limits', pass: /exception|law enforcement|national security|serious crime|authori[sz]ation|narrow/i.test(answer) },
        { label: 'two links', pass: urls.length >= 2 },
      ]
      return manualGrade(
        checks,
        'PASS only if it distinguishes the real-time public-space ban from narrow law-enforcement exceptions, is not a total-ban claim, cites two openable sources with dates, and gives the current stage/date.',
      )
    },
  },
  {
    id: 'R2',
    area: 'research',
    limitMs: 8 * 60_000,
    prompt:
      'What changed in the latest iPhone compared with the previous model? Give three changes that matter and cite one hands-on review.',
    check: (answer) => {
      const urls = [...answer.matchAll(/https?:\/\/[^\s)\]>]+/g)].map((match) => match[0])
      const checks = [
        { label: 'current iPhone 18', pass: /iphone\s*18/i.test(answer) },
        { label: 'previous iPhone 17', pass: /iphone\s*17/i.test(answer) },
        { label: 'one link', pass: urls.length >= 1 },
        { label: 'three changes (manual)', pass: (answer.match(/^\s*(?:[-*]|\d+\.)\s+/gm) ?? []).length >= 3 },
      ]
      return manualGrade(
        checks,
        'PASS only if it names the iPhone 18 generation as current, compares it with iPhone 17, gives three concrete changes, and cites one real hands-on review; stale iPhone 17-as-latest or invented specs fail.',
      )
    },
  },
]

const TASK_MAP = new Map(TASKS.map((task) => [task.id, task]))
const selectedTasks = (taskFilter ?? TASKS.map((task) => task.id)).map((id) => {
  const task = TASK_MAP.get(id)
  if (!task) throw new Error(`Unknown task ${id}; choose from ${TASKS.map((item) => item.id).join(',')}`)
  return task
})

const MODES = {
  team: { strategy: 'team', model: null, label: 'New Team' },
  best: { strategy: 'fast', model: BEST_MODEL, label: `Best single (${BEST_MODEL})` },
  baseline: { strategy: 'fast', model: BASELINE_MODEL, label: `Legacy single (${BASELINE_MODEL})` },
  single: { strategy: 'fast', model: null, label: 'Default single' },
}
const selectedModes = (modeFilter ?? ['team', 'best', 'baseline']).map((mode) => {
  if (!MODES[mode]) throw new Error(`Unknown mode ${mode}; choose from ${Object.keys(MODES).join(',')}`)
  return mode
})

function summarize(runs) {
  const byMode = {}
  for (const [mode, config] of Object.entries(MODES)) {
    const rows = runs.filter((run) => run.mode === mode)
    if (!rows.length) continue
    const auto = rows.filter((run) => run.pass !== null)
    const passed = auto.filter((run) => run.pass === true).length
    const failed = auto.filter((run) => run.pass === false).length
    const manual = rows.filter((run) => run.pass === null).length
    const latencies = rows.map((run) => run.latencyMs).sort((a, b) => a - b)
    byMode[mode] = {
      label: config.label,
      total: rows.length,
      autoScored: auto.length,
      passed,
      failed,
      manualPending: manual,
      passRate: auto.length ? Number(((passed / auto.length) * 100).toFixed(1)) : null,
      overallPassRate: Number(((passed / rows.length) * 100).toFixed(1)),
      avgMs: Math.round(latencies.reduce((sum, value) => sum + value, 0) / (latencies.length || 1)),
      slow: rows.filter((run) => run.latencyMs > (TASK_MAP.get(run.taskId)?.limitMs ?? TASK_TIMEOUT)).length,
      errors: rows.filter((run) => run.error).length,
    }
  }
  return byMode
}

function markdownTable(runs) {
  const lines = [
    '| Task | Area | Mode | Verdict | Latency | Drafters | Referee | Verifier | Repaired |',
    '|---|---|---|---:|---:|---|---|---|---:|',
  ]
  for (const run of runs) {
    const team = run.team ?? {}
    lines.push(
      `| ${run.taskId} | ${run.area} | ${MODES[run.mode]?.label ?? run.mode} | ${run.pass === null ? 'manual' : run.pass ? 'PASS' : 'FAIL'} | ${(run.latencyMs / 1000).toFixed(1)}s | ${(team.drafters ?? []).join(', ') || '—'} | ${team.referee ?? '—'} | ${team.verifier ?? '—'} | ${team.repaired ? 'yes' : 'no'} |`,
    )
  }
  return lines.join('\n')
}

async function waitForUsage(expected) {
  if (expected === null) return true
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const me = await json('/api/me')
    if (me?.usage?.used === expected) return true
    await sleep(400)
  }
  return false
}

async function runSuite({ modes, tasks, bestModel = BEST_MODEL, baselineModel = BASELINE_MODEL, baselineSnapshot }) {
  const runs = []
  for (const mode of modes) {
    for (const task of tasks) {
      const config = { ...MODES[mode] }
      if (mode === 'best') config.model = bestModel
      if (mode === 'baseline') config.model = baselineModel
      process.stderr.write(`[${mode}] ${task.id} ... `)
      const run = await runTurn({ task, strategy: config.strategy, model: config.model })
      runs.push({ ...run, mode, modeLabel: config.label })
      // Persist after every turn: a cleanup hiccup must not throw away the
      // evidence from turns that already completed.
      writeFileSync(RESULTS_PATH, JSON.stringify({ partial: true, meta: { at: Date.now(), base: BASE }, before: baselineSnapshot, runs }, null, 2))
      process.stderr.write(`${run.pass === null ? 'manual' : run.pass ? 'PASS' : 'FAIL'} ${(run.latencyMs / 1000).toFixed(1)}s\n`)
      if (!(await waitForUsage(baselineSnapshot.usage))) {
        const me = await json('/api/me')
        throw new Error(`usage stayed at ${me?.usage?.used}; expected ${baselineSnapshot.usage} after cleanup of ${task.id}`)
      }
    }
  }
  return runs
}

async function calibrate() {
  const models = typeof cli.models === 'string'
    ? cli.models.split(',').map((item) => item.trim()).filter(Boolean)
    : ['nvidia/nemotron-3-super-120b', 'command-a-plus-05-2026', 'mistral-large-4', 'openai/gpt-oss-120b']
  const ids = typeof cli['calibration-tasks'] === 'string' ? cli['calibration-tasks'].split(',') : ['C1', 'M1', 'I1']
  const tasks = ids.map((id) => TASK_MAP.get(id)).filter(Boolean)
  const baseline = await stableSnapshot()
  const runs = []
  for (const model of models) {
    for (const task of tasks) {
      process.stderr.write(`[calibrate ${model}] ${task.id} ... `)
      const run = await runTurn({ task, strategy: 'fast', model })
      runs.push({ ...run, model, mode: 'calibration', modeLabel: model })
      process.stderr.write(`${run.pass === null ? 'manual' : run.pass ? 'PASS' : 'FAIL'} ${(run.latencyMs / 1000).toFixed(1)}s\n`)
      const me = await json('/api/me')
      if (baseline.usage !== null && me?.usage?.used !== baseline.usage) {
        throw new Error(`usage changed to ${me?.usage?.used}; expected ${baseline.usage}`)
      }
    }
  }
  const ranking = models.map((model) => {
    const rows = runs.filter((run) => run.model === model && run.pass !== null)
    const passed = rows.filter((run) => run.pass === true).length
    const latencies = rows.map((run) => run.latencyMs).sort((a, b) => a - b)
    return {
      model,
      passed,
      scored: rows.length,
      passRate: rows.length ? Number(((passed / rows.length) * 100).toFixed(1)) : null,
      avgMs: Math.round(latencies.reduce((sum, value) => sum + value, 0) / (latencies.length || 1)),
    }
  }).sort((a, b) => b.passed - a.passed || a.avgMs - b.avgMs)
  mkdirSync(BENCH_DIR, { recursive: true })
  writeFileSync(CALIBRATION_PATH, JSON.stringify({ at: Date.now(), tasks, models, ranking, runs }, null, 2))
  console.log(JSON.stringify({ tasks, ranking }, null, 2))
  const after = await stableSnapshot()
  if (JSON.stringify(after) !== JSON.stringify(baseline)) {
    console.error('WARNING: live snapshot changed during calibration', { before: baseline, after })
  }
}

async function main() {
  if (cli.help) {
    console.log('Usage: node scripts/benchmark.mjs [--calibrate] [--tasks=C1,M1] [--modes=team,best,baseline] [--best-model=id] [--baseline-model=id]')
    return
  }
  const cleaned = await cleanupOrphans()
  if (cleaned.length) console.error(`cleaned ${cleaned.length} orphaned benchmark conversation(s)`)

  if (cli.calibrate) {
    await calibrate()
    return
  }

  const baselineSnapshot = await stableSnapshot()
  console.error('baseline snapshot', baselineSnapshot)
  const startedAt = Date.now()
  const runs = await runSuite({
    modes: selectedModes,
    tasks: selectedTasks,
    bestModel: BEST_MODEL,
    baselineModel: BASELINE_MODEL,
    baselineSnapshot,
  })
  const after = await stableSnapshot()
  const summary = summarize(runs)
  const result = {
    meta: {
      at: Date.now(),
      startedAt,
      finishedAt: Date.now(),
      base: BASE,
      todayUtc: TODAY,
      plus53: PLUS53,
      bestModel: BEST_MODEL,
      baselineModel: BASELINE_MODEL,
      modes: selectedModes,
      tasks: selectedTasks.map((task) => task.id),
    },
    before: baselineSnapshot,
    after,
    summary,
    runs,
  }
  writeFileSync(RESULTS_PATH, JSON.stringify(result, null, 2))
  const report = [
    '# Live Team benchmark',
    '',
    `Run: ${new Date(startedAt).toISOString()} · endpoint: ${BASE}`,
    `Live snapshot before: ${baselineSnapshot.conversations} conversations, ${baselineSnapshot.messages} messages, usage ${baselineSnapshot.usage}/${baselineSnapshot.limit}`,
    `Live snapshot after: ${after.conversations} conversations, ${after.messages} messages, usage ${after.usage}/${after.limit}`,
    '',
    markdownTable(runs),
    '',
    '## Summary',
    '',
    '| Mode | Auto-scored | Passed | Failed | Manual | Pass rate | Avg latency | Slow | Errors |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|',
    ...Object.entries(summary).map(([, row]) => `| ${row.label} | ${row.autoScored} | ${row.passed} | ${row.failed} | ${row.manualPending} | ${row.passRate ?? '—'}% | ${(row.avgMs / 1000).toFixed(1)}s | ${row.slow} | ${row.errors} |`),
    '',
  ].join('\n')
  writeFileSync(path.join(BENCH_DIR, 'latest.md'), report)
  console.log(report)
  if (JSON.stringify(after) !== JSON.stringify(baselineSnapshot)) {
    console.error('WARNING: live snapshot changed', { before: baselineSnapshot, after })
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
