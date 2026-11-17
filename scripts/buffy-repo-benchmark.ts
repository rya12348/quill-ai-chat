import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative, resolve, sep } from 'node:path'
import { promisify } from 'node:util'

import { runRepoVerifierLoop, type RepoMessage, type TestResult } from '../src/shared/repo-loop'

for (const file of ['.env', '.env.local']) {
  try {
    process.loadEnvFile(file)
  } catch {
    /* the file is optional */
  }
}

const execFileAsync = promisify(execFile)
// NVIDIA retired deepseek-v4.1-flash on 2026-11-16. Use its current strongest
// hosted lane by default; DENT_MODEL_ID overrides this for a pin.
const MODEL = process.env.DENT_MODEL_ID?.trim() || 'nvidia/nemotron-3-ultra-550b-a55b'
const ENDPOINT = 'https://integrate.api.nvidia.com/v1/chat/completions'
const MAX_STEPS = Math.max(3, Math.min(12, Number(process.env.REPO_MAX_STEPS || 8)))
const OUTPUT_DIR = 'bench'

// Keep the benchmark's model input small enough for a free lane while still
// giving Dent the exact failure it needs to repair.
const MAX_TEST_OUTPUT = 7_000
const MAX_FILE_CHARS = 48_000

type Task = {
  id: string
  prompt: string
  files: Record<string, string>
  hidden: Record<string, string>
}

const TASKS: Task[] = [
  {
    id: 'normalize-tags',
    prompt:
      'Fix normalizeTags in src/tags.js. It must trim every tag, lowercase it, remove empty tags, and remove duplicates while preserving the order of the first occurrence. Do not change the tests.',
    files: {
      'src/tags.js': `export function normalizeTags(input) {
  if (!Array.isArray(input)) return []
  return input.map((tag) => String(tag).trim()).filter(Boolean)
}
`,
      'tests/tags.test.js': `import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeTags } from '../src/tags.js'

test('trims, lowercases and deduplicates tags', () => {
  assert.deepEqual(normalizeTags(['  Node ', 'API', '', 'node']), ['node', 'api'])
})

test('preserves the first occurrence order', () => {
  assert.deepEqual(normalizeTags(['beta', 'alpha', 'BETA', ' gamma ']), ['beta', 'alpha', 'gamma'])
})

test('handles a non-array input', () => {
  assert.deepEqual(normalizeTags(null), [])
})
`,
    },
    hidden: {
      '.verifier/tags-edge.test.js': `import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeTags } from '../src/tags.js'

test('hidden: removes whitespace-only and duplicate tags', () => {
  assert.deepEqual(normalizeTags(['   ', 'A', 'a', ' B ', 'b']), ['a', 'b'])
})

test('hidden: keeps the first spelling after normalization', () => {
  assert.deepEqual(normalizeTags(['Rust', 'rust', 'GO', 'go']), ['rust', 'go'])
})
`,
    },
  },
  {
    id: 'csv-line-parser',
    prompt:
      'Fix parseCsvLine in src/csv.js so it parses one CSV record. It must support quoted fields containing commas and doubled quotes inside quoted fields, preserve empty fields, and leave unquoted text otherwise unchanged. Do not change the tests.',
    files: {
      'src/csv.js': `export function parseCsvLine(line) {
  return String(line).split(',')
}
`,
      'tests/csv.test.js': `import assert from 'node:assert/strict'
import test from 'node:test'
import { parseCsvLine } from '../src/csv.js'

test('splits an ordinary record', () => {
  assert.deepEqual(parseCsvLine('a,b,c'), ['a', 'b', 'c'])
})

test('keeps commas inside quoted fields', () => {
  assert.deepEqual(parseCsvLine('"a,b",c'), ['a,b', 'c'])
})

test('unescapes doubled quotes', () => {
  assert.deepEqual(parseCsvLine('"a""b",c'), ['a"b', 'c'])
})

test('preserves empty fields', () => {
  assert.deepEqual(parseCsvLine('a,,c'), ['a', '', 'c'])
})
`,
    },
    hidden: {
      '.verifier/csv-edge.test.js': `import assert from 'node:assert/strict'
import test from 'node:test'
import { parseCsvLine } from '../src/csv.js'

test('hidden: quoted empty fields and spaces', () => {
  assert.deepEqual(parseCsvLine('"", a ," b "'), ['', ' a ', ' b '])
})

test('hidden: comma after an escaped quote', () => {
  assert.deepEqual(parseCsvLine('"say ""hi""",next'), ['say "hi"', 'next'])
})
`,
    },
  },
  {
    id: 'paginate',
    prompt:
      'Fix paginate in src/pagination.js. pages must be the ceiling of total / pageSize and at least 1; page must be clamped to the valid range; and the slice must start at (page - 1) * pageSize using the clamped page. Keep using clampInt from src/numbers.js. Do not change the tests.',
    files: {
      'src/numbers.js': `export function clampInt(value, min, max) {
  const n = Math.trunc(Number(value))
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, n))
}
`,
      'src/pagination.js': `import { clampInt } from './numbers.js'

export function paginate(items, page, pageSize) {
  const total = items.length
  const pages = Math.floor(total / pageSize)
  const current = page
  const start = (current - 1) * pageSize
  return {
    items: items.slice(start, start + pageSize),
    page: current,
    pages,
    total,
  }
}
`,
      'tests/pagination.test.js': `import assert from 'node:assert/strict'
import test from 'node:test'
import { paginate } from '../src/pagination.js'

test('returns the requested middle page', () => {
  assert.deepEqual(paginate([1, 2, 3, 4, 5], 2, 2), {
    items: [3, 4],
    page: 2,
    pages: 3,
    total: 5,
  })
})

test('gives an empty list one page', () => {
  assert.deepEqual(paginate([], 1, 2), { items: [], page: 1, pages: 1, total: 0 })
})

test('clamps a page past the end to the last page', () => {
  assert.deepEqual(paginate([1, 2, 3, 4, 5], 9, 2), {
    items: [5],
    page: 3,
    pages: 3,
    total: 5,
  })
})
`,
    },
    hidden: {
      '.verifier/pagination-edge.test.js': `import assert from 'node:assert/strict'
import test from 'node:test'
import { paginate } from '../src/pagination.js'

test('hidden: clamps page zero to page one', () => {
  assert.deepEqual(paginate([1, 2, 3], 0, 2), { items: [1, 2], page: 1, pages: 2, total: 3 })
})

test('hidden: handles an exact page boundary', () => {
  assert.deepEqual(paginate([1, 2, 3, 4], 2, 2), { items: [3, 4], page: 2, pages: 2, total: 4 })
})
`,
    },
  },
]

type TokenUsage = {
  requests: number
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

type RunResult = {
  task: string
  model: string
  baseline: { exitCode: number; output: string }
  solved: boolean
  steps: number
  toolCalls: number
  testRuns: number
  latencyMs: number
  lastExitCode: number
  lastOutput: string
  usage: TokenUsage
  error?: string
  actionTrace: { step: number; action: string; ms: number; observation: string }[]
}

function emptyUsage(): TokenUsage {
  return { requests: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0 }
}

function requireKey(): string {
  const key = process.env.NVIDIA_API_KEY?.trim()
  if (!key) throw new Error('NVIDIA_API_KEY is missing; Dent is unavailable.')
  return key
}

async function dentComplete(
  messages: readonly RepoMessage[],
  signal?: AbortSignal,
  usage?: TokenUsage,
): Promise<string> {
  if (usage) usage.requests += 1
  // DeepSeek V4.1 can take over a minute to produce its first token on NVIDIA;
  // a non-streaming request looks like a dead connection. Stream and collect
  // only the final content, never the reasoning tokens.
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${requireKey()}`,
      'content-type': 'application/json',
      accept: 'text/event-stream',
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.1,
      max_tokens: 1_600,
      stream: true,
      stream_options: { include_usage: true },
    }),
    signal: signal ?? AbortSignal.timeout(150_000),
  })
  if (!response.ok) {
    const detail = (await response.text().catch(() => '')).slice(0, 300)
    throw new Error(`Dent HTTP ${response.status}: ${detail || 'request failed'}`)
  }
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Dent returned no response body.')
  const decoder = new TextDecoder()
  let buffer = ''
  let content = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data:')) continue
      const payload = line.slice(5).trim()
      if (!payload || payload === '[DONE]') continue
      try {
        const event = JSON.parse(payload) as {
          choices?: { delta?: { content?: string } }[]
          usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
        }
        if (usage && event.usage) {
          usage.promptTokens += Number(event.usage.prompt_tokens ?? 0)
          usage.completionTokens += Number(event.usage.completion_tokens ?? 0)
          usage.totalTokens += Number(event.usage.total_tokens ?? 0)
        }
        const piece = event.choices?.[0]?.delta?.content
        if (typeof piece === 'string') content += piece
      } catch {
        /* a keep-alive or a provider comment is not a content frame */
      }
    }
  }
  const text = content.trim()
  if (!text) throw new Error('Dent returned an empty repo action.')
  return text
}

function safeInside(root: string, path: string): string {
  const full = resolve(root, path)
  if (full !== root && !full.startsWith(`${root}${sep}`)) throw new Error('Path escaped the repository.')
  return full
}

async function testFiles(root: string, directory: string): Promise<string[]> {
  const entries = await readdir(join(root, directory), { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const path = `${directory}/${entry.name}`
    if (entry.isDirectory()) files.push(...(await testFiles(root, path)))
    else if (entry.name.endsWith('.test.js')) files.push(path)
  }
  return files
}

async function runNodeTests(root: string, target: string): Promise<TestResult> {
  const files = await testFiles(root, target)
  if (!files.length) return { exitCode: 1, output: `No tests found in ${target}.` }
  try {
    const result = await execFileAsync(process.execPath, ['--test', ...files], {
      cwd: root,
      timeout: 20_000,
      maxBuffer: 4_000_000,
      windowsHide: true,
    })
    return { exitCode: 0, output: `${result.stdout}\n${result.stderr}`.trim() }
  } catch (error) {
    const failure = error as { code?: number; stdout?: string; stderr?: string; message?: string }
    return {
      exitCode: Number(failure.code ?? 1),
      output: `${failure.stdout ?? ''}\n${failure.stderr ?? failure.message ?? ''}`.trim(),
    }
  }
}

async function listRepoFiles(root: string, prefix = ''): Promise<string[]> {
  const entries = await readdir(join(root, prefix), { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.verifier') continue
    const path = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) files.push(...(await listRepoFiles(root, path)))
    else files.push(path)
  }
  return files
}

async function createTaskRepo(task: Task): Promise<{ root: string; files: string[]; runTests: () => Promise<TestResult> }> {
  const root = await mkdtemp(join(tmpdir(), 'ink-repo-'))
  await writeFile(join(root, 'package.json'), JSON.stringify({ type: 'module', private: true }, null, 2))
  for (const [path, content] of Object.entries(task.files)) {
    const full = safeInside(root, path)
    await mkdir(resolve(full, '..'), { recursive: true })
    await writeFile(full, content)
  }
  for (const [path, content] of Object.entries(task.hidden)) {
    const full = safeInside(root, path)
    await mkdir(resolve(full, '..'), { recursive: true })
    await writeFile(full, content)
  }
  const files = await listRepoFiles(root)
  const runTests = async (): Promise<TestResult> => {
    const visible = await runNodeTests(root, 'tests')
    const hidden = await runNodeTests(root, '.verifier')
    const output = `${visible.output}\n\n-- hidden verifier --\n${hidden.output}`.trim()
    return {
      exitCode: visible.exitCode === 0 && hidden.exitCode === 0 ? 0 : 1,
      output: output.length > MAX_TEST_OUTPUT ? `${output.slice(0, MAX_TEST_OUTPUT)}\n… output truncated` : output,
    }
  }
  return { root, files, runTests }
}

async function runTask(task: Task): Promise<RunResult> {
  const repo = await createTaskRepo(task)
  const baseline = await repo.runTests()
  const startedAt = Date.now()
  const usage = emptyUsage()
  try {
    const result = await runRepoVerifierLoop({
      task: task.prompt,
      files: repo.files,
      maxSteps: MAX_STEPS,
      complete: (messages, signal) => dentComplete(messages, signal, usage),
      onEvent: (event) => {
        if (event.type === 'action') console.log(`    step ${event.step}: ${event.action.action}`)
        else if (event.type === 'error') console.log(`    step ${event.step}: ${event.message}`)
      },
      tools: {
        listFiles: () => listRepoFiles(repo.root),
        readFile: async (path) => {
          // Tests are readable; the hidden verifier is not. Reading tests helps
          // the model understand the contract, but it can never edit them.
          if (path === '.verifier' || path.startsWith('.verifier/')) throw new Error('The verifier is read-only and hidden.')
          const content = await readFile(safeInside(repo.root, path), 'utf8')
          return content.length > MAX_FILE_CHARS ? `${content.slice(0, MAX_FILE_CHARS)}\n… file truncated` : content
        },
        writeFile: async (path, content) => {
          if (!path.startsWith('src/')) throw new Error('Only files under src/ may be changed.')
          const full = safeInside(repo.root, path)
          await mkdir(resolve(full, '..'), { recursive: true })
          await writeFile(full, content)
        },
        runTests: repo.runTests,
      },
    })
    return {
      task: task.id,
      model: MODEL,
      baseline,
      solved: result.solved,
      steps: result.steps,
      toolCalls: result.toolCalls,
      testRuns: result.testRuns,
      latencyMs: Date.now() - startedAt,
      lastExitCode: result.lastExitCode,
      lastOutput: result.lastOutput,
      usage,
      ...(result.error ? { error: result.error } : {}),
      actionTrace: result.actions.map((action) => ({
        step: action.step,
        action: action.action,
        ms: action.ms,
        observation: action.observation.slice(0, 500),
      })),
    }
  } catch (error) {
    return {
      task: task.id,
      model: MODEL,
      baseline,
      solved: false,
      steps: 0,
      toolCalls: 0,
      testRuns: 0,
      latencyMs: Date.now() - startedAt,
      lastExitCode: 1,
      lastOutput: error instanceof Error ? error.message : String(error),
      usage,
      error: error instanceof Error ? error.message : String(error),
      actionTrace: [],
    }
  } finally {
    await rm(repo.root, { recursive: true, force: true }).catch(() => undefined)
  }
}

function tableRow(result: RunResult): string {
  const status = result.solved ? 'PASS' : result.lastExitCode === 0 ? 'TESTS PASS / NO FINISH' : 'FAIL'
  return `| ${result.task} | ${status} | ${result.steps} | ${result.toolCalls} | ${result.testRuns} | ${
    result.usage.totalTokens
  } | ${(result.latencyMs / 1_000).toFixed(1)}s | ${result.error ? result.error.replace(/\|/g, '\\|').slice(0, 90) : '—'} |`
}

async function main(): Promise<void> {
  if (!process.env.NVIDIA_API_KEY?.trim()) throw new Error('NVIDIA_API_KEY is missing.')
  await mkdir(OUTPUT_DIR, { recursive: true })
  const filter = process.env.REPO_TASKS?.split(',').map((value) => value.trim()).filter(Boolean)
  const selected = filter?.length ? TASKS.filter((task) => filter.includes(task.id)) : TASKS
  const results: RunResult[] = []
  for (const task of selected) {
    console.log(`running ${task.id} with Dent…`)
    const result = await runTask(task)
    results.push(result)
    const status = result.solved ? 'PASS' : result.lastExitCode === 0 ? 'TESTS PASS / NO FINISH' : 'FAIL'
    console.log(
      `  ${status} · ${result.steps} steps · ${result.usage.totalTokens} tokens · ${(
        result.latencyMs / 1_000
      ).toFixed(1)}s`,
    )
    await writeFile(join(OUTPUT_DIR, 'buffy-repo-results.json'), JSON.stringify(results, null, 2))
  }

  const passed = results.filter((result) => result.solved).length
  const testVerified = results.filter((result) => result.lastExitCode === 0 && result.testRuns > 0).length
  const baselinePassed = results.filter((result) => result.baseline.exitCode === 0).length
  const mean = (values: number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0)
  const lines = [
    '# Buffy Code repo verifier benchmark',
    '',
    `Run: ${new Date().toISOString()}`,
    `Model: Dent (${MODEL})`,
    `Endpoint: ${ENDPOINT}`,
    `Tasks: ${results.length} · max model steps: ${MAX_STEPS}`,
    '',
    `**Strict pass rate: ${passed}/${results.length} (${Math.round((passed / results.length) * 100)}%)**`,
    `Test-verified final states: ${testVerified}/${results.length} (the final visible + hidden suite passed)`,
    '',
    `Baseline (unfixed seed repos): ${baselinePassed}/${results.length} pass`,
    `Mean model steps: ${mean(results.map((result) => result.steps)).toFixed(1)}`,
    `Mean tool calls: ${mean(results.map((result) => result.toolCalls)).toFixed(1)}`,
    `Mean test runs: ${mean(results.map((result) => result.testRuns)).toFixed(1)}`,
    `Mean latency: ${(mean(results.map((result) => result.latencyMs)) / 1_000).toFixed(1)}s`,
    `Mean tokens: ${mean(results.map((result) => result.usage.totalTokens)).toFixed(0)}`,
    `Total tokens: ${results.reduce((sum, result) => sum + result.usage.totalTokens, 0)}`,
    '',
    '| Task | Result | Steps | Tool calls | Test runs | Tokens | Latency | Error |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
    ...results.map(tableRow),
    '',
    'Each task started with failing tests, used a real temporary repository, and was scored only after both the visible and hidden verifier suites passed. A strict pass additionally requires an accepted finish action; a passing final test state with a timed-out finish is shown separately, not counted as a strict pass.',
    '',
    ...(results.some((result) => !result.solved && result.lastExitCode === 0)
      ? ['A task marked TESTS PASS / NO FINISH had both suites green, but Dent did not return an accepted finish before the provider timeout.']
      : []),
    '',
  ]
  await writeFile(join(OUTPUT_DIR, 'buffy-repo-latest.md'), lines.join('\n'))
  console.log(lines.join('\n'))
}

await main()
