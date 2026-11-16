/**
 * A small, platform-neutral repo verifier loop.
 *
 * The model gets only explicit tools: list files, read a file, write a source
 * file, run tests, and finish. It never receives a shell. The caller supplies
 * the repository tools, which makes the same loop usable by a local Buffy Code
 * runner or a test double without putting Node execution inside the Worker.
 */

export type RepoMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type RepoAction =
  | { action: 'list_files' }
  | { action: 'read_file'; path: string }
  | { action: 'write_file'; path: string; content: string }
  | { action: 'run_tests' }
  | { action: 'finish'; summary?: string }

export type TestResult = {
  exitCode: number
  output: string
}

export type RepoTools = {
  listFiles: () => Promise<string[]>
  readFile: (path: string) => Promise<string>
  writeFile: (path: string, content: string) => Promise<void>
  runTests: () => Promise<TestResult>
}

export type RepoCompletion = (messages: readonly RepoMessage[], signal?: AbortSignal) => Promise<string>

export type RepoLoopEvent =
  | { type: 'model'; step: number; ms: number; text: string }
  | { type: 'action'; step: number; action: RepoAction; ms: number; observation: string }
  | { type: 'error'; step: number; message: string }

export type RepoActionRecord = {
  step: number
  action: RepoAction['action'] | 'invalid'
  ms: number
  observation: string
}

export type RepoLoopResult = {
  solved: boolean
  summary: string
  steps: number
  modelCalls: number
  toolCalls: number
  testRuns: number
  latencyMs: number
  lastExitCode: number
  lastOutput: string
  actions: RepoActionRecord[]
  error?: string
}

export type RepoLoopInput = {
  task: string
  files: string[]
  tools: RepoTools
  complete: RepoCompletion
  maxSteps?: number
  signal?: AbortSignal
  system?: string
  onEvent?: (event: RepoLoopEvent) => void
}

export const REPO_SYSTEM_PROMPT = `You are Buffy Code's repo verifier. You are working inside a real repository. You may only change files under src/; tests are read-only. Use one tool at a time and inspect before editing.

Return exactly one JSON object and nothing else:
{"action":"list_files"}
{"action":"read_file","path":"src/example.js"}
{"action":"write_file","path":"src/example.js","content":"...complete file contents..."}
{"action":"run_tests"}
{"action":"finish","summary":"what changed and which tests pass"}

Rules:
- Start by inspecting the relevant source and test files. Do not guess at their contents.
- Reproduce the failure with run_tests before changing code when possible.
- After editing, run the tests again. If they fail, read the failure, find the cause, and repair it.
- Tests are fixed. Never create, edit, delete or bypass a test.
- Call finish only after the full test suite passes. The verifier runs the tests one more time before accepting the result.
- Keep source changes inside src/. Do not edit package.json, test files or the verifier.`

function cleanPath(value: string): string {
  const path = value.trim().replace(/\\/g, '/')
  if (!path || path.startsWith('/') || path.includes('\0') || path.split('/').includes('..')) {
    throw new Error('The path must be a relative repository path without "..".')
  }
  return path
}

function asString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`"${field}" must be a non-empty string.`)
  return value
}

/**
 * Parse one model reply. This is intentionally forgiving about a Markdown code
 * fence or one line of prose, but strict about the action schema itself.
 */
export function parseRepoAction(text: string): RepoAction {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]
  const first = text.indexOf('{')
  const last = text.lastIndexOf('}')
  const candidate = fenced ?? (first >= 0 && last > first ? text.slice(first, last + 1) : '')
  if (!candidate.trim()) throw new Error('Return one JSON object describing the next action.')
  let value: Record<string, unknown>
  try {
    const parsed = JSON.parse(candidate) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object')
    value = parsed as Record<string, unknown>
  } catch {
    throw new Error('The reply was not valid JSON. Return exactly one action object.')
  }
  const rawAction = String(value.action ?? value.tool ?? value.name ?? '').toLowerCase()
  if (rawAction === 'list' || rawAction === 'list_files') return { action: 'list_files' }
  if (rawAction === 'read' || rawAction === 'read_file') {
    return { action: 'read_file', path: cleanPath(asString(value.path, 'path')) }
  }
  if (rawAction === 'write' || rawAction === 'write_file') {
    if (typeof value.content !== 'string') throw new Error('"content" must be a string.')
    return { action: 'write_file', path: cleanPath(asString(value.path, 'path')), content: value.content }
  }
  if (rawAction === 'test' || rawAction === 'run_tests') return { action: 'run_tests' }
  if (rawAction === 'finish' || rawAction === 'done') {
    return {
      action: 'finish',
      ...(typeof value.summary === 'string' && value.summary.trim() ? { summary: value.summary.trim() } : {}),
    }
  }
  throw new Error('Unknown action. Use list_files, read_file, write_file, run_tests or finish.')
}

function formatTestResult(result: TestResult): string {
  const label = result.exitCode === 0 ? 'PASS' : 'FAIL'
  const output = result.output.trim() || '(the test command produced no output)'
  return `Tests ${label} (exit ${result.exitCode}).\n${output}`
}

function clip(value: string, max = 8_000): string {
  return value.length > max ? `${value.slice(0, max)}\n… output truncated` : value
}

/**
 * Run a bounded inspect → edit → test → repair loop.
 *
 * A finish is not trusted on its own: tests are executed again before the
 * result is marked solved. If that final run fails, the model gets the failure
 * as an observation and can continue repairing.
 */
export async function runRepoVerifierLoop(input: RepoLoopInput): Promise<RepoLoopResult> {
  const startedAt = Date.now()
  const maxSteps = Math.max(1, Math.min(20, input.maxSteps ?? 8))
  const messages: RepoMessage[] = [
    { role: 'system', content: input.system ?? REPO_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `TASK:\n${input.task}\n\nREPOSITORY FILES:\n${input.files.map((file) => `- ${file}`).join('\n')}\n\nBegin by inspecting the relevant files. Return one JSON action.`,
    },
  ]
  const actions: RepoActionRecord[] = []
  let last: TestResult = { exitCode: 1, output: 'Tests have not run yet.' }
  let modelCalls = 0
  let toolCalls = 0
  let testRuns = 0
  let solved = false
  let summary = ''

  for (let step = 1; step <= maxSteps; step += 1) {
    if (input.signal?.aborted) {
      return {
        solved: false,
        summary: 'Stopped before a verified result.',
        steps: step - 1,
        modelCalls,
        toolCalls,
        testRuns,
        latencyMs: Date.now() - startedAt,
        lastExitCode: last.exitCode,
        lastOutput: last.output,
        actions,
        error: 'aborted',
      }
    }

    let raw: string
    const modelStartedAt = Date.now()
    try {
      raw = await input.complete(messages, input.signal)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      input.onEvent?.({ type: 'error', step, message })
      return {
        solved: false,
        summary: 'Dent could not complete the repo turn.',
        steps: step - 1,
        modelCalls,
        toolCalls,
        testRuns,
        latencyMs: Date.now() - startedAt,
        lastExitCode: last.exitCode,
        lastOutput: last.output,
        actions,
        error: message,
      }
    }
    modelCalls += 1
    input.onEvent?.({ type: 'model', step, ms: Date.now() - modelStartedAt, text: clip(raw, 1_200) })

    let action: RepoAction
    try {
      action = parseRepoAction(raw)
    } catch (error) {
      const observation = error instanceof Error ? error.message : String(error)
      messages.push({ role: 'assistant', content: raw })
      messages.push({ role: 'user', content: `TOOL ERROR:\n${observation}\n\nReturn one JSON action.` })
      actions.push({ step, action: 'invalid', ms: 0, observation })
      input.onEvent?.({ type: 'error', step, message: observation })
      continue
    }

    const actionStartedAt = Date.now()
    let observation = ''
    try {
      if (action.action === 'list_files') {
        toolCalls += 1
        const files = await input.tools.listFiles()
        observation = files.length ? files.join('\n') : '(the repository has no files)'
      } else if (action.action === 'read_file') {
        toolCalls += 1
        observation = clip(await input.tools.readFile(action.path))
      } else if (action.action === 'write_file') {
        toolCalls += 1
        await input.tools.writeFile(action.path, action.content)
        observation = `Wrote ${action.path} (${action.content.length} characters). Run the tests after you finish editing.`
      } else if (action.action === 'run_tests') {
        toolCalls += 1
        last = await input.tools.runTests()
        testRuns += 1
        observation = formatTestResult(last)
      } else {
        toolCalls += 1
        last = await input.tools.runTests()
        testRuns += 1
        if (last.exitCode === 0) {
          solved = true
          summary = action.summary || 'The repository test suite passes.'
          observation = formatTestResult(last)
          actions.push({ step, action: action.action, ms: Date.now() - actionStartedAt, observation })
          input.onEvent?.({ type: 'action', step, action, ms: Date.now() - actionStartedAt, observation })
          break
        }
        observation = `${formatTestResult(last)}\n\nThe tests do not pass yet. Repair the cause, then call finish again.`
      }
    } catch (error) {
      observation = `Tool error: ${error instanceof Error ? error.message : String(error)}`
    }

    if (!observation) observation = 'The tool completed without output.'
    actions.push({ step, action: action.action, ms: Date.now() - actionStartedAt, observation: clip(observation) })
    input.onEvent?.({ type: 'action', step, action, ms: Date.now() - actionStartedAt, observation: clip(observation) })
    messages.push({ role: 'assistant', content: raw })
    messages.push({
      role: 'user',
      content: `TOOL RESULT (${action.action}):\n${clip(observation)}\n\nChoose the next action. Call finish only after the tests pass.`,
    })
  }

  // A max-step stop still gets an honest final test result. It is never
  // reported as solved just because the model stopped talking.
  if (!solved) {
    last = await input.tools.runTests()
    testRuns += 1
    if (last.exitCode === 0) {
      solved = true
      summary = 'The final test run passed after the step budget was reached.'
    }
  }

  return {
    solved,
    summary: solved ? summary : 'No verified solution was reached within the step budget.',
    steps: modelCalls,
    modelCalls,
    toolCalls,
    testRuns,
    latencyMs: Date.now() - startedAt,
    lastExitCode: last.exitCode,
    lastOutput: last.output,
    actions,
  }
}
