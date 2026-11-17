import { execFile } from 'node:child_process'
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { promisify } from 'node:util'

import type { RepoCompletion, RepoMessage, RepoTools, TestResult } from '../src/shared/repo-loop'
import { runBestOfThreeRepoVerifierLoop } from '../src/shared/repo-best-of-three'

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
const CANDIDATE_CONCURRENCY = Math.max(
  1,
  Math.min(3, Math.trunc(Number(process.env.REPO_CANDIDATE_CONCURRENCY || 3))),
)
const OUTPUT_DIR = 'bench'
const RESULT_FILE = 'buffy-repo-best-of-three-results.json'
const REPORT_FILE = 'buffy-repo-best-of-three-latest.md'
const SINGLE_RESULT_FILE = 'buffy-repo-results.json'
const COMPARISON_FILE = 'buffy-repo-comparison.md'
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

type CandidateSummary = {
  id: string
  solved: boolean
  steps: number
  testRuns: number
  lastExitCode: number
  latencyMs: number
  usage: TokenUsage
  error?: string
}

type RunResult = {
  task: string
  model: string
  mode: 'best-of-three'
  baseline: { exitCode: number; output: string }
  solved: boolean
  selectedId?: string
  steps: number
  toolCalls: number
  testRuns: number
  latencyMs: number
  lastExitCode: number
  lastOutput: string
  usage: TokenUsage
  candidates: CandidateSummary[]
  error?: string
  actionTrace: { step: number; action: string; ms: number; observation: string; candidate: string }[]
}

function emptyUsage(): TokenUsage {
  return { requests: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0 }
}

function requireKey(): string {
  const key = process.env.NVIDIA_API_KEY?.trim()
  if (!key) throw new Error('NVIDIA_API_KEY is missing; Dent is unavailable.')
  return key
}

function createDentComplete(usage: TokenUsage): RepoCompletion {
  return async (messages: readonly RepoMessage[], signal?: AbortSignal): Promise<string> => {
    usage.requests += 1
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
          if (event.usage) {
            usage.promptTokens += Number(event.usage.prompt_tokens ?? 0)
            usage.completionTokens += Number(event.usage.completion_tokens ?? 0)
            usage.totalTokens += Number(event.usage.total_tokens ?? 0)
          }
          const piece = event.choices?.[0]?.delta?.content
          if (typeof piece === 'string') content += piece
        } catch {
          /* a keep-alive or provider comment is not a content frame */
        }
      }
    }
    const text = content.trim()
    if (!text) throw new Error('Dent returned an empty repo action.')
    return text
  }
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

async function createTaskRepo(
  task: Task,
): Promise<{ root: string; files: string[]; runTests: () => Promise<TestResult> }> {
  const root = await mkdtemp(join(tmpdir(), 'ink-best-of-three-'))
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

function repoTools(root: string, runTests: () => Promise<TestResult>): RepoTools {
  return {
    listFiles: () => listRepoFiles(root),
    readFile: async (path) => {
      if (path === '.verifier' || path.startsWith('.verifier/')) {
        throw new Error('The verifier is read-only and hidden.')
      }
      const content = await readFile(safeInside(root, path), 'utf8')
      return content.length > MAX_FILE_CHARS ? `${content.slice(0, MAX_FILE_CHARS)}\n… file truncated` : content
    },
    writeFile: async (path, content) => {
      if (!path.startsWith('src/')) throw new Error('Only files under src/ may be changed.')
      const full = safeInside(root, path)
      await mkdir(resolve(full, '..'), { recursive: true })
      await writeFile(full, content)
    },
    runTests,
  }
}

async function copySource(fromRoot: string, toRoot: string): Promise<void> {
  const destination = join(toRoot, 'src')
  await rm(destination, { recursive: true, force: true })
  await mkdir(destination, { recursive: true })
  await cp(join(fromRoot, 'src'), destination, { recursive: true, force: true })
}

async function runTask(task: Task): Promise<RunResult> {
  const base = await createTaskRepo(task)
  const baseline = await base.runTests()
  const startedAt = Date.now()
  const usageByCandidate = new Map<string, TokenUsage>()

  try {
    const result = await runBestOfThreeRepoVerifierLoop({
      task: task.prompt,
      files: base.files,
      maxSteps: MAX_STEPS,
      concurrency: CANDIDATE_CONCURRENCY,
      createCandidate: async (index) => {
        const repo = await createTaskRepo(task)
        const id = `candidate-${index + 1}`
        const usage = emptyUsage()
        usageByCandidate.set(id, usage)
        return {
          id,
          tools: repoTools(repo.root, repo.runTests),
          complete: createDentComplete(usage),
          accept: async () => {
            await copySource(repo.root, base.root)
            const checked = await base.runTests()
            if (checked.exitCode !== 0) {
              throw new Error(`The accepted candidate failed destination tests.\n${checked.output.slice(0, 1_000)}`)
            }
          },
          discard: async () => {
            await rm(repo.root, { recursive: true, force: true })
          },
        }
      },
      onEvent: (event) => {
        if (event.event.type === 'action') {
          console.log(`    ${event.candidateId} step ${event.event.step}: ${event.event.action.action}`)
        } else if (event.event.type === 'error') {
          console.log(`    ${event.candidateId} step ${event.event.step}: ${event.event.message}`)
        }
      },
    })

    const final = await base.runTests()
    const solved = result.solved && final.exitCode === 0
    const candidates = result.candidates.map((candidate) => ({
      id: candidate.id,
      solved: candidate.result?.solved ?? false,
      steps: candidate.result?.steps ?? 0,
      testRuns: candidate.result?.testRuns ?? 0,
      lastExitCode: candidate.result?.lastExitCode ?? 1,
      latencyMs: candidate.result?.latencyMs ?? 0,
      usage: usageByCandidate.get(candidate.id) ?? emptyUsage(),
      ...(candidate.error ? { error: candidate.error } : {}),
    }))
    const usage: TokenUsage = {
      requests: candidates.reduce((sum, candidate) => sum + candidate.usage.requests, 0),
      promptTokens: candidates.reduce((sum, candidate) => sum + candidate.usage.promptTokens, 0),
      completionTokens: candidates.reduce((sum, candidate) => sum + candidate.usage.completionTokens, 0),
      totalTokens: candidates.reduce((sum, candidate) => sum + candidate.usage.totalTokens, 0),
    }

    return {
      task: task.id,
      model: MODEL,
      mode: 'best-of-three',
      baseline,
      solved,
      ...(result.selectedId ? { selectedId: result.selectedId } : {}),
      steps: result.modelCalls,
      toolCalls: result.toolCalls,
      testRuns: result.testRuns,
      latencyMs: Date.now() - startedAt,
      lastExitCode: final.exitCode,
      lastOutput: final.output,
      usage,
      candidates,
      ...(result.error || (!solved && final.exitCode !== 0)
        ? { error: result.error ?? 'The destination repository still fails its tests.' }
        : {}),
      actionTrace: result.candidates.flatMap((candidate) =>
        (candidate.result?.actions ?? []).map((action) => ({
          step: action.step,
          action: action.action,
          ms: action.ms,
          observation: action.observation.slice(0, 500),
          candidate: candidate.id,
        })),
      ),
    }
  } catch (error) {
    return {
      task: task.id,
      model: MODEL,
      mode: 'best-of-three',
      baseline,
      solved: false,
      steps: 0,
      toolCalls: 0,
      testRuns: 0,
      latencyMs: Date.now() - startedAt,
      lastExitCode: 1,
      lastOutput: error instanceof Error ? error.message : String(error),
      usage: emptyUsage(),
      candidates: [],
      error: error instanceof Error ? error.message : String(error),
      actionTrace: [],
    }
  } finally {
    await rm(base.root, { recursive: true, force: true }).catch(() => undefined)
  }
}

function candidateTable(result: RunResult): string[] {
  return result.candidates.flatMap((candidate) => [
    `| ${result.task} | ${candidate.id}${candidate.id === result.selectedId ? ' ✓' : ''} | ${
      candidate.lastExitCode === 0 ? 'PASS' : 'FAIL'
    } | ${candidate.steps} | ${candidate.usage.totalTokens} | ${(candidate.latencyMs / 1_000).toFixed(1)}s |`,
  ])
}

function taskRow(result: RunResult): string {
  const status = result.solved ? 'PASS' : result.lastExitCode === 0 ? 'TESTS PASS / NO FINISH' : 'FAIL'
  return `| ${result.task} | ${status} | ${result.selectedId ?? '—'} | ${result.steps} | ${(
    result.usage.totalTokens
  )} | ${(result.latencyMs / 1_000).toFixed(1)}s | ${result.error ? result.error.replace(/\|/g, '\\|').slice(0, 90) : '—'} |`
}

type PriorSingle = {
  task: string
  solved: boolean
  steps: number
  latencyMs: number
  lastExitCode: number
  testRuns: number
  usage?: TokenUsage
}

async function readPriorSingle(): Promise<PriorSingle[]> {
  try {
    const raw = JSON.parse(await readFile(join(OUTPUT_DIR, SINGLE_RESULT_FILE), 'utf8')) as PriorSingle[]
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

function mean(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
}

async function main(): Promise<void> {
  if (!process.env.NVIDIA_API_KEY?.trim()) throw new Error('NVIDIA_API_KEY is missing.')
  await mkdir(OUTPUT_DIR, { recursive: true })
  const filter = process.env.REPO_TASKS?.split(',').map((value) => value.trim()).filter(Boolean)
  const selected = filter?.length ? TASKS.filter((task) => filter.includes(task.id)) : TASKS
  const results: RunResult[] = []

  for (const task of selected) {
    console.log(`running ${task.id} with three Dent candidates…`)
    const result = await runTask(task)
    results.push(result)
    const status = result.solved ? 'PASS' : result.lastExitCode === 0 ? 'TESTS PASS / NO FINISH' : 'FAIL'
    console.log(
      `  ${status} · ${result.selectedId ?? 'no winner'} · ${result.steps} candidate steps · ${(
        result.latencyMs / 1_000
      ).toFixed(1)}s · ${result.usage.totalTokens} tokens`,
    )
    await writeFile(join(OUTPUT_DIR, RESULT_FILE), JSON.stringify(results, null, 2))
  }

  const passed = results.filter((result) => result.solved).length
  const testVerified = results.filter((result) => result.lastExitCode === 0).length
  const baselinePassed = results.filter((result) => result.baseline.exitCode === 0).length
  const candidateCompute = results.map((result) =>
    result.candidates.reduce((sum, candidate) => sum + candidate.latencyMs, 0),
  )
  const winnerTokens = results.flatMap((result) =>
    result.candidates
      .filter((candidate) => candidate.id === result.selectedId)
      .map((candidate) => candidate.usage.totalTokens),
  )
  const prior = await readPriorSingle()
  const priorByTask = new Map(prior.map((result) => [result.task, result]))
  const compared = results.filter((result) => priorByTask.has(result.task))
  const singleStrict = compared.filter((result) => priorByTask.get(result.task)?.solved).length
  const singleVerified = compared.filter((result) => {
    const item = priorByTask.get(result.task)
    return item && item.lastExitCode === 0 && item.testRuns > 0
  }).length
  const bestStrict = compared.filter((result) => result.solved).length
  const bestVerified = compared.filter((result) => result.lastExitCode === 0).length
  const singleUsage = compared.map((result) => priorByTask.get(result.task)?.usage)
  const singleUsageRecorded =
    singleUsage.length > 0 && singleUsage.every((usage) => Boolean(usage))
  const singleTokenTotal = singleUsage.reduce((sum, usage) => sum + (usage?.totalTokens ?? 0), 0)
  const singleMeanTokens = mean(singleUsage.map((usage) => usage?.totalTokens ?? 0))
  const bestTokenTotal = compared.reduce((sum, result) => sum + result.usage.totalTokens, 0)
  const bestMeanTokens = mean(compared.map((result) => result.usage.totalTokens))
  const tokenMultiple = singleMeanTokens ? (bestMeanTokens / singleMeanTokens).toFixed(2) : '—'
  const tokenRows = compared.map((result) => {
    const single = priorByTask.get(result.task)?.usage
    const ratio = single?.totalTokens ? (result.usage.totalTokens / single.totalTokens).toFixed(2) : '—'
    return `| ${result.task} | ${single?.promptTokens ?? '—'} | ${single?.completionTokens ?? '—'} | ${
      single ? single.totalTokens : 'not recorded'
    } | ${result.usage.promptTokens} | ${result.usage.completionTokens} | ${result.usage.totalTokens} | ${ratio} |`
  })
  const comparisonLines = compared.length
    ? [
        `Compared tasks: ${compared.map((result) => result.task).join(', ')}`,
        '',
        'The earlier DeepSeek V4.1 Flash run is not comparable: NVIDIA retired that model on 2026-11-16. Both modes were rerun on the replacement model above.',
        'Best-of-three ran candidates serially to avoid provider 429s; its wall latency is serial.',
        '',
        '| Mode | Strict pass | Test-verified | Mean wall latency | Mean candidate compute | Mean tokens |',
        '| --- | ---: | ---: | ---: | ---: | ---: |',
        `| Single candidate (same model) | ${singleStrict}/${compared.length} | ${singleVerified}/${compared.length} | ${(
          mean(compared.map((result) => priorByTask.get(result.task)?.latencyMs ?? 0)) / 1_000
        ).toFixed(1)}s | same as wall | ${singleUsageRecorded ? singleMeanTokens.toFixed(0) : 'not recorded'} |`,
        `| Best of three | ${bestStrict}/${compared.length} | ${bestVerified}/${compared.length} | ${(
          mean(compared.map((result) => result.latencyMs)) / 1_000
        ).toFixed(1)}s | ${(
          mean(
            compared.map((result) =>
              result.candidates.reduce((sum, candidate) => sum + candidate.latencyMs, 0),
            ),
          ) / 1_000
        ).toFixed(1)}s | ${bestMeanTokens.toFixed(0)} |`,
        '',
        `Quality gain: ${bestStrict - singleStrict >= 0 ? '+' : ''}${bestStrict - singleStrict} strict, ${
          bestVerified - singleVerified >= 0 ? '+' : ''
        }${bestVerified - singleVerified} test-verified.`,
        `Token cost: single ${singleUsageRecorded ? `${singleTokenTotal} total / ${singleMeanTokens.toFixed(0)} mean per task` : 'not recorded'}; best of three ${bestTokenTotal} total / ${bestMeanTokens.toFixed(0)} mean per task${
          singleUsageRecorded ? ` (${tokenMultiple}× single)` : ''
        }.`,
        'Both modes used the same model and endpoint. Best-of-three totals include every candidate, including candidates discarded after a failure.',
        '',
        '### Exact tokens by task',
        '',
        '| Task | Single prompt | Single completion | Single total | Best prompt | Best completion | Best total | Best / single |',
        '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
        ...tokenRows,
        '',
        ...(singleUsageRecorded
          ? []
          : ['The single-candidate artifact is missing usage for at least one task. Rerun it with the token-tracking version before comparing token cost.']),
      ]
    : ['No prior single-candidate artifact was available for comparison.']

  const lines = [
    '# Buffy Code repo verifier — best of three',
    '',
    `Run: ${new Date().toISOString()}`,
    `Model: Dent (${MODEL})`,
    `Mode: 3 isolated candidates, ${CANDIDATE_CONCURRENCY} in flight, first passing candidate accepted`,
    `Tasks: ${results.length} · max model steps per candidate: ${MAX_STEPS}`,
    '',
    `**Strict pass rate: ${passed}/${results.length} (${Math.round((passed / results.length) * 100)}%)**`,
    `Test-verified final states: ${testVerified}/${results.length}`,
    `Baseline (unfixed seed repos): ${baselinePassed}/${results.length} pass`,
    `Mean wall latency: ${(mean(results.map((result) => result.latencyMs)) / 1_000).toFixed(1)}s`,
    `Mean total candidate compute: ${(mean(candidateCompute) / 1_000).toFixed(1)}s`,
    `Mean total candidate steps: ${mean(results.map((result) => result.steps)).toFixed(1)}`,
    `Mean total tokens: ${mean(results.map((result) => result.usage.totalTokens)).toFixed(0)}`,
    `Mean winner tokens: ${mean(winnerTokens).toFixed(0)}`,
    `Mean tokens per candidate: ${mean(
      results.flatMap((result) => result.candidates.map((candidate) => candidate.usage.totalTokens)),
    ).toFixed(0)}`,
    '',
    '| Task | Result | Winner | Total candidate steps | Tokens | Wall latency | Error |',
    '| --- | ---: | --- | ---: | ---: | ---: | --- |',
    ...results.map(taskRow),
    '',
    '## Candidates',
    '',
    '| Task | Candidate | Tests | Steps | Tokens | Candidate latency |',
    '| --- | --- | ---: | ---: | ---: | ---: |',
    ...results.flatMap(candidateTable),
    '',
    '## Comparison with the single-candidate run',
    '',
    ...comparisonLines,
    '',
    'Each candidate started from the same failing repository snapshot. A candidate was eligible only after its visible and hidden tests passed; `accept` then copied its source into the destination repository and reran the destination tests before the result was marked solved.',
    '',
  ]
  await writeFile(join(OUTPUT_DIR, REPORT_FILE), lines.join('\n'))
  const comparison = [
    '# Single candidate vs best of three',
    '',
    `Model: Dent (${MODEL})`,
    `Best-of-three candidate concurrency: ${CANDIDATE_CONCURRENCY}`,
    '',
    ...comparisonLines,
    '',
  ]
  await writeFile(join(OUTPUT_DIR, COMPARISON_FILE), comparison.join('\n'))
  console.log(lines.join('\n'))
}

await main()
