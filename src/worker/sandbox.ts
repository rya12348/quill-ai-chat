import type { WorkspaceFile } from '../shared/workspace'

/**
 * Vercel Sandbox: a disposable Linux microVM the coding agent can actually run
 * commands in, so a failed build is something the model reads instead of
 * something a person discovers.
 *
 * This speaks the REST API directly. The official SDK is Node-only and too
 * large for a Worker, and the REST surface is the same one under it.
 *
 * It is opt-in by configuration: without VERCEL_TOKEN and VERCEL_PROJECT_ID
 * every function here is a no-op and the build path behaves exactly as before.
 * The Hobby allowance is small (5 active CPU hours, 420 GB-hours, 20 creations
 * a minute), so a turn is one sandbox, one short command, then destroyed.
 */

const API = 'https://api.vercel.com'

export const SANDBOX_LIMITS = {
  /**
   * Files copied into the sandbox. A generated site needs a handful; an
   * imported repository needs its manifest, sources and tests, so the ceiling
   * is set by what one turn can still write inside the deadline rather than by
   * the size of a demo. Writes are ~200 ms each, so 40 is about eight seconds.
   */
  files: 40,
  bytes: 500_000,
  /** npm install on a real repository needs more than a static check does. */
  commandMs: 90_000,
  totalMs: 240_000,
  outputChars: 4_000,
  /** base64 characters per shell argument chunk. */
  chunk: 60_000,
  writeSteps: 40,
} as const

/**
 * The only hosts a sandbox may reach: the two npm registries.
 *
 * The agent shell used to be deny-all, which meant `npm install` was dead and
 * any task on a repository with dependencies was impossible rather than hard.
 * A registry allowlist is the smallest opening that makes a real install work:
 * packages resolve and download, and nothing else on the internet is reachable
 * from a command the model wrote. Web facts still come through fetch_url and
 * web_search, which run in the Worker and are budgeted.
 */
export const SANDBOX_NETWORK_DOMAINS = ['registry.npmjs.org', 'registry.yarnpkg.com']

export type SandboxStatus = 'pass' | 'fail' | 'error' | 'skipped'

export type SandboxOutcome = {
  configured: boolean
  ran: boolean
  status: SandboxStatus
  /** A short, person-readable label such as "npm test". */
  command: string
  exitCode: number | null
  /** stdout + stderr, trimmed to the part that explains the failure. */
  output: string
  durationMs: number
  reason?: string
}

export type SandboxPlan = {
  label: string
  steps: { command: string; args: string[] }[]
  /** Whether the commands need package-registry access. */
  network: boolean
}

type FetchLike = typeof fetch

/** Both values are required; a half-configured deployment stays dark. */
export function sandboxConfigured(env: {
  VERCEL_TOKEN?: string
  VERCEL_PROJECT_ID?: string
}): boolean {
  return Boolean(env.VERCEL_TOKEN?.trim() && env.VERCEL_PROJECT_ID?.trim())
}

/**
 * The command worth running for this project. A real package.json runs the
 * project's own test or build script; a static workspace still has executable
 * checks, because "it loads and every referenced file exists" is a truth
 * condition the model cannot talk its way out of.
 */
export function planVerification(files: WorkspaceFile[]): SandboxPlan | null {
  if (!files.length) return null
  const pkg = files.find((file) => file.path === 'package.json' || file.path.endsWith('/package.json'))
  if (pkg) {
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(pkg.content) as Record<string, unknown>
    } catch {
      return null
    }
    const scripts = (parsed.scripts && typeof parsed.scripts === 'object' ? parsed.scripts : {}) as Record<string, unknown>
    const script =
      typeof scripts.test === 'string' && !/no test specified/i.test(scripts.test)
        ? 'test'
        : typeof scripts.build === 'string'
          ? 'build'
          : typeof scripts.lint === 'string'
            ? 'lint'
            : ''
    if (!script) return null
    const dependencies = Object.keys((parsed.dependencies as object | undefined) ?? {}).length
    const devDependencies = Object.keys((parsed.devDependencies as object | undefined) ?? {}).length
    const steps: SandboxPlan['steps'] = []
    if (dependencies + devDependencies > 0) {
      steps.push({ command: 'npm', args: ['install', '--no-audit', '--no-fund', '--loglevel=error'] })
    }
    steps.push({ command: 'npm', args: script === 'test' ? ['test', '--silent'] : ['run', script] })
    return { label: `npm ${script}`, steps, network: true }
  }
  return { label: 'static checks', steps: [{ command: 'node', args: ['checks.mjs'] }], network: false }
}

/**
 * The static checker written into every non-package workspace. It fails on the
 * mistakes that actually break a page: a missing local asset, a script that
 * does not parse, unbalanced CSS, a document with no title.
 */
export const CHECK_SCRIPT = `import { readdir, readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'

const files = (await readdir('.', { recursive: true })).filter((name) => /\\.[a-z0-9]+$/i.test(name))
const problems = []
const exists = new Set(files.map((file) => file.replace(/^\\.\\//, '')))

for (const file of files) {
  if (!/\\.html?$/i.test(file)) continue
  const html = await readFile(file, 'utf8')
  if (!/<title[^>]*>\\s*\\S/i.test(html)) problems.push(file + ': no <title>')
  const refs = [...html.matchAll(/<(?:link|script|img|source)\\b[^>]*?(?:href|src)=["']([^"']+)["']/gi)].map((match) => match[1])
  for (const ref of refs) {
    if (!ref || /^(?:[a-z]+:|#|\\/\\/)/i.test(ref)) continue
    const target = ref.split(/[?#]/)[0].replace(/^\\.\\//, '')
    if (!exists.has(target)) problems.push(file + ': missing local asset ' + target)
  }
  if (!/<html\\b/i.test(html)) problems.push(file + ': no <html> element')
}

for (const file of files) {
  if (!/\\.m?js$/i.test(file)) continue
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' })
  } catch (error) {
    const detail = String(error?.stderr || error?.message || 'syntax error').split('\\n').slice(0, 3).join(' ')
    problems.push(file + ': ' + detail.trim())
  }
}

for (const file of files) {
  if (!/\\.css$/i.test(file)) continue
  const css = await readFile(file, 'utf8')
  const opens = (css.match(/{/g) || []).length
  const closes = (css.match(/}/g) || []).length
  if (opens !== closes) problems.push(file + ': ' + opens + ' { but ' + closes + ' }')
}

if (problems.length) {
  console.log('FAIL')
  for (const problem of problems.slice(0, 20)) console.log('- ' + problem)
  process.exit(1)
}
console.log('OK: ' + files.length + ' files checked')
`

/** Reads the ND-JSON (or plain JSON) result of a command. */
export function parseCommandStream(body: string): { exitCode: number | null; output: string } {
  let exitCode: number | null = null
  const chunks: string[] = []
  const record = (entry: unknown) => {
    if (!entry || typeof entry !== 'object') return
    const value = entry as { stream?: unknown; data?: unknown; command?: { exitCode?: unknown } }
    const code = value.command?.exitCode
    if (typeof code === 'number' && Number.isFinite(code)) exitCode = code
    if (value.stream === 'error') {
      // The command stream reports its own failures (a bad runtime, an
      // exhausted quota) as a log record rather than an exit code.
      const detail = (value.data as { message?: unknown } | undefined)?.message
      if (typeof detail === 'string') chunks.push(detail)
      if (exitCode === null) exitCode = 1
      return
    }
    if (typeof value.data === 'string') {
      if (value.stream === 'stdout' || value.stream === 'stderr' || value.stream === undefined) chunks.push(value.data)
      return
    }
    if (value.data && typeof value.data === 'object') {
      const message = (value.data as { message?: unknown }).message
      if (typeof message === 'string') chunks.push(message)
    }
  }

  let parsedWhole = false
  try {
    const parsed = JSON.parse(body) as unknown
    if (Array.isArray(parsed)) parsed.forEach(record)
    else {
      record(parsed)
      parsedWhole = true
    }
  } catch {
    parsedWhole = false
  }
  if (!parsedWhole) {
    for (const line of body.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('{')) continue
      try {
        record(JSON.parse(trimmed))
      } catch {
        // A truncated final line is normal when the stream is cut short.
      }
    }
  }
  return { exitCode, output: maybeBase64(chunks.join('')) }
}

/**
 * Some responses carry the bytes base64-encoded rather than as text. Decode
 * only when the payload is unambiguously base64 and decodes to readable text,
 * so a one-word log line like "FAIL" is never mangled.
 */
function maybeBase64(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length < 12 || trimmed.length % 4 !== 0) return value
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(trimmed)) return value
  try {
    const binary = atob(trimmed)
    let printable = 0
    for (let index = 0; index < binary.length; index += 1) {
      const code = binary.charCodeAt(index)
      if (code === 9 || code === 10 || code === 13 || (code >= 32 && code <= 126)) printable += 1
    }
    if (printable / binary.length < 0.9) return value
    return binary
  } catch {
    return value
  }
}

/** Keeps the start and the end: the end is where a compiler puts the reason. */
export function trimOutput(text: string, limit: number = SANDBOX_LIMITS.outputChars): string {
  const cleaned = text.replace(/\u001b\[[0-9;]*m/g, '').trim()
  if (cleaned.length <= limit) return cleaned
  const head = cleaned.slice(0, Math.floor(limit / 3))
  const tail = cleaned.slice(-Math.floor((limit * 2) / 3))
  return `${head}\n…\n${tail}`
}

/** Manifest first, then documents, then the files they reference. */
function sandboxRank(path: string): number {
  const name = path.slice(path.lastIndexOf('/') + 1)
  if (name === 'package.json') return 0
  if (/\.html?$/i.test(name)) return 1
  if (/\.(?:css|m?js)$/i.test(name)) return 2
  return 3
}

function base64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  }
  return btoa(binary)
}

/** A shell command that writes one workspace file, chunked to stay under ARG_MAX. */
export function writeFileCommands(file: WorkspaceFile): { command: string; args: string[] }[] {
  const encoded = base64(file.content)
  const directory = file.path.includes('/') ? file.path.slice(0, file.path.lastIndexOf('/')) : ''
  const steps: { command: string; args: string[] }[] = []
  const chunks: string[] = []
  for (let index = 0; index < encoded.length; index += SANDBOX_LIMITS.chunk) {
    chunks.push(encoded.slice(index, index + SANDBOX_LIMITS.chunk))
  }
  if (!chunks.length) chunks.push('')
  chunks.forEach((chunk, index) => {
    const redirect = index === 0 ? '>' : '>>'
    const prefix = directory ? `mkdir -p "${directory}" && ` : ''
    steps.push({
      command: 'sh',
      args: ['-c', `${prefix}printf '%s' '${chunk}' | base64 -d ${redirect} "${file.path}"`],
    })
  })
  return steps
}

function query(env: { VERCEL_TEAM_ID?: string; VERCEL_TEAM_SLUG?: string }): string {
  const params = new URLSearchParams()
  const team = env.VERCEL_TEAM_ID?.trim()
  const slug = env.VERCEL_TEAM_SLUG?.trim()
  if (team) params.set('teamId', team)
  else if (slug) params.set('slug', slug)
  return params.size ? `?${params.toString()}` : ''
}

/** Deleting a named sandbox also needs the project it belongs to. */
function deleteQuery(env: {
  VERCEL_PROJECT_ID?: string
  VERCEL_TEAM_ID?: string
  VERCEL_TEAM_SLUG?: string
}): string {
  const params = new URLSearchParams()
  const project = env.VERCEL_PROJECT_ID?.trim()
  if (project) params.set('projectId', project)
  const team = env.VERCEL_TEAM_ID?.trim()
  const slug = env.VERCEL_TEAM_SLUG?.trim()
  if (team) params.set('teamId', team)
  else if (slug) params.set('slug', slug)
  return params.size ? `?${params.toString()}` : ''
}

/**
 * The files worth copying: pages, styles, scripts, manifests. The manifest and
 * the pages go first so a large project cannot push `package.json` past the
 * file or byte budget and turn a Node project into a static-check run.
 */
export function sandboxFiles(files: WorkspaceFile[]): WorkspaceFile[] {
  const chosen: WorkspaceFile[] = []
  let bytes = 0
  const ordered = [...files].sort((a, b) => sandboxRank(a.path) - sandboxRank(b.path))
  for (const file of ordered) {
    if (file.content.length > SANDBOX_LIMITS.bytes) continue
    if (bytes + file.content.length > SANDBOX_LIMITS.bytes) break
    bytes += file.content.length
    chosen.push(file)
    if (chosen.length >= SANDBOX_LIMITS.files) break
  }
  return chosen
}

async function call(
  fetchImpl: FetchLike,
  env: {
    VERCEL_TOKEN?: string
    VERCEL_TEAM_ID?: string
    VERCEL_TEAM_SLUG?: string
  },
  path: string,
  init: RequestInit,
  signal?: AbortSignal,
): Promise<Response> {
  return fetchImpl(`${API}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${env.VERCEL_TOKEN!.trim()}`,
      'content-type': 'application/json',
      ...(init.headers as Record<string, string> | undefined),
    },
    ...(signal ? { signal } : {}),
  })
}

/**
 * Runs the project's verification command in a fresh sandbox and returns what
 * it printed. Always stops the sandbox, even when a step throws.
 */
export async function runWorkspaceSandbox(
  env: {
    VERCEL_TOKEN?: string
    VERCEL_PROJECT_ID?: string
    VERCEL_TEAM_ID?: string
    VERCEL_TEAM_SLUG?: string
    SANDBOX_RUNTIME?: string
  },
  files: WorkspaceFile[],
  options: { signal?: AbortSignal; fetchImpl?: FetchLike; now?: () => number } = {},
): Promise<SandboxOutcome> {
  const idle: SandboxOutcome = {
    configured: false,
    ran: false,
    status: 'skipped',
    command: '',
    exitCode: null,
    output: '',
    durationMs: 0,
  }
  if (!sandboxConfigured(env)) return idle

  const used = sandboxFiles(files)
  const plan = planVerification(used)
  if (!plan) return { ...idle, configured: true, reason: 'This project has no runnable build or test command.' }

  const fetchImpl = options.fetchImpl ?? fetch
  const clock = options.now ?? Date.now
  const started = clock()
  const deadline = new AbortController()
  const onAbort = () => deadline.abort()
  options.signal?.addEventListener('abort', onAbort, { once: true })
  const timer = setTimeout(() => deadline.abort(), SANDBOX_LIMITS.totalMs)

  let sandboxName = ''
  let sessionId = ''
  let output = ''
  let exitCode: number | null = null
  let ran = false

  try {
    const created = await call(
      fetchImpl,
      env,
      `/v2/sandboxes${query(env)}`,
      {
        method: 'POST',
        body: JSON.stringify({
          projectId: env.VERCEL_PROJECT_ID!.trim(),
          runtime: env.SANDBOX_RUNTIME?.trim() || 'node24',
          persistent: false,
          timeout: SANDBOX_LIMITS.commandMs * 2,
          // The API takes a policy object, never a bare mode string: a string
          // is rejected at creation, which reads as "sandbox unavailable".
          networkPolicy: plan.network
            ? { mode: 'custom', allowedDomains: SANDBOX_NETWORK_DOMAINS }
            : { mode: 'deny-all' },
        }),
      },
      deadline.signal,
    )
    if (!created.ok) {
      const detail = await created.text().catch(() => '')
      return {
        ...idle,
        configured: true,
        status: 'error',
        command: plan.label,
        durationMs: clock() - started,
        reason: `Sandbox could not start (${created.status})${detail ? `: ${trimOutput(detail, 200)}` : ''}`,
      }
    }
    const data = (await created.json()) as {
      sandbox?: { name?: string }
      session?: { id?: string }
    }
    sandboxName = data.sandbox?.name ?? ''
    sessionId = data.session?.id ?? data.sandbox?.name ?? ''
    if (!sessionId) {
      return { ...idle, configured: true, status: 'error', command: plan.label, reason: 'Sandbox returned no session.' }
    }

    // The checker goes in first so an edit that adds many files cannot push it
    // past the step budget and turn a real result into "module not found".
    const writes: { command: string; args: string[] }[] = [
      ...(plan.network ? [] : [{ command: 'sh', args: ['-c', CHECK_SCRIPT_B64] }]),
      ...used.flatMap(writeFileCommands),
    ]
    if (writes.length > SANDBOX_LIMITS.writeSteps) writes.length = SANDBOX_LIMITS.writeSteps

    const run = async (step: { command: string; args: string[] }, wait: boolean) => {
      const response = await call(
        fetchImpl,
        env,
        `/v2/sandboxes/sessions/${encodeURIComponent(sessionId)}/cmd${query(env)}`,
        {
          method: 'POST',
          headers: { accept: 'application/x-ndjson' },
          body: JSON.stringify({
            command: step.command,
            args: step.args,
            env: {},
            sudo: false,
            wait,
            logs: wait,
            timeout: SANDBOX_LIMITS.commandMs,
          }),
        },
        deadline.signal,
      )
      const body = await response.text().catch(() => '')
      if (!response.ok) {
        return { ok: false, exitCode: null as number | null, output: trimOutput(body), status: response.status }
      }
      return { ok: true, ...parseCommandStream(body), status: response.status }
    }

    // Setup failures are reported as errors, not as the project's failure.
    for (const step of writes) {
      const result = await run(step, true)
      if (!result.ok || (result.exitCode !== null && result.exitCode !== 0)) {
        return {
          ...idle,
          configured: true,
          status: 'error',
          command: plan.label,
          durationMs: clock() - started,
          reason: `Writing the workspace failed (${result.status})${result.output ? `: ${result.output}` : ''}`,
        }
      }
    }

    let last = { command: plan.label, exitCode: 0 as number | null, output: '' }
    for (const step of plan.steps) {
      const result = await run(step, true)
      ran = true
      output = result.output
      exitCode = result.exitCode
      last = { command: `${step.command} ${step.args.filter((arg) => !arg.startsWith('-')).join(' ')}`.trim(), exitCode, output }
      if (!result.ok) {
        return {
          ...idle,
          configured: true,
          ran,
          status: 'error',
          command: last.command,
          exitCode,
          output,
          durationMs: clock() - started,
          reason: `The sandbox rejected the command (${result.status}).`,
        }
      }
      if (exitCode !== 0) break
    }

    return {
      configured: true,
      ran,
      status: exitCode === 0 ? 'pass' : 'fail',
      command: plan.label,
      exitCode,
      output: trimOutput(output),
      durationMs: clock() - started,
    }
  } catch (error) {
    if (options.signal?.aborted) {
      return { ...idle, configured: true, ran, status: 'skipped', command: plan.label, reason: 'The build was stopped.' }
    }
    return {
      ...idle,
      configured: true,
      ran,
      status: 'error',
      command: plan.label,
      exitCode,
      output: trimOutput(output),
      durationMs: clock() - started,
      reason: error instanceof Error ? error.message : 'The sandbox request failed.',
    }
  } finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', onAbort)
    // A non-persistent sandbox has no name to delete, so it is released
    // through its session. That is the documented stop path and it also covers
    // the named case; only a rejected stop falls back to deleting the name, so
    // nothing is left running after the turn.
    const stopped = sessionId
      ? await call(
          fetchImpl,
          env,
          `/v2/sandboxes/sessions/${encodeURIComponent(sessionId)}/stop${query(env)}`,
          { method: 'POST' },
        ).catch(() => null)
      : null
    if (!stopped?.ok && sandboxName) {
      await call(
        fetchImpl,
        env,
        `/v2/sandboxes/${encodeURIComponent(sandboxName)}${deleteQuery(env)}`,
        { method: 'DELETE' },
      ).catch(() => undefined)
    }
  }
}

/** The checker script as a base64 write, so quoting cannot break it. */
const CHECK_SCRIPT_B64 = `mkdir -p . && printf '%s' '${base64(CHECK_SCRIPT).slice(0, 90_000)}' | base64 -d > checks.mjs`

export type SandboxCommandResult = {
  ok: boolean
  exitCode: number | null
  /** Raw stdout + stderr, untrimmed: the agent parses its own markers out. */
  output: string
}

/** A live microVM that stays up for a whole turn instead of one command. */
export type SandboxSessionLike = {
  run: (command: string) => Promise<SandboxCommandResult>
  write: (files: WorkspaceFile[]) => Promise<{ ok: boolean; error?: string }>
  stop: () => Promise<void>
}

/**
 * Opens one sandbox and keeps it, for a turn that runs many commands.
 *
 * `runWorkspaceSandbox` is deliberately one-shot: it creates, verifies and
 * destroys. An agent loop cannot work that way — `npm install` and every file a
 * command writes would vanish between steps — so this exposes the same REST
 * plumbing as a session and leaves the caller to close it.
 *
 * Returns null when the deployment has no sandbox configured. Throws only when
 * the sandbox exists but could not start, so the caller can report the reason.
 */
export async function openSandboxSession(
  env: {
    VERCEL_TOKEN?: string
    VERCEL_PROJECT_ID?: string
    VERCEL_TEAM_ID?: string
    VERCEL_TEAM_SLUG?: string
    SANDBOX_RUNTIME?: string
  },
  options: { signal?: AbortSignal; fetchImpl?: FetchLike } = {},
): Promise<SandboxSessionLike | null> {
  if (!sandboxConfigured(env)) return null
  const fetchImpl = options.fetchImpl ?? fetch
  let sessionId = ''
  let sandboxName = ''
  let stopped = false

  const created = await call(
    fetchImpl,
    env,
    `/v2/sandboxes${query(env)}`,
    {
      method: 'POST',
      body: JSON.stringify({
        projectId: env.VERCEL_PROJECT_ID!.trim(),
        runtime: env.SANDBOX_RUNTIME?.trim() || 'node24',
        persistent: false,
        timeout: SANDBOX_LIMITS.commandMs * 4,
        // Registry-only, not deny-all: an install is the difference between a
        // repository task being possible and being impossible. Anything beyond
        // the registries stays closed, so a command cannot reach the open web.
        networkPolicy: { mode: 'custom', allowedDomains: SANDBOX_NETWORK_DOMAINS },
      }),
    },
    options.signal,
  )
  if (!created.ok) {
    const detail = await created.text().catch(() => '')
    throw new Error(`Sandbox could not start (${created.status})${detail ? `: ${trimOutput(detail, 200)}` : ''}`)
  }
  const data = (await created.json()) as { sandbox?: { name?: string }; session?: { id?: string } }
  sandboxName = data.sandbox?.name ?? ''
  sessionId = data.session?.id ?? data.sandbox?.name ?? ''
  if (!sessionId) throw new Error('The sandbox returned no session.')

  const run = async (command: string): Promise<SandboxCommandResult> => {
    if (stopped) return { ok: false, exitCode: null, output: 'The sandbox was stopped.' }
    const response = await call(
      fetchImpl,
      env,
      `/v2/sandboxes/sessions/${encodeURIComponent(sessionId)}/cmd${query(env)}`,
      {
        method: 'POST',
        headers: { accept: 'application/x-ndjson' },
        body: JSON.stringify({
          command: 'sh',
          args: ['-c', command],
          env: {},
          sudo: false,
          wait: true,
          logs: true,
          timeout: SANDBOX_LIMITS.commandMs,
        }),
      },
      options.signal,
    )
    const body = await response.text().catch(() => '')
    if (!response.ok) {
      return {
        ok: false,
        exitCode: null,
        output: trimOutput(body, SANDBOX_LIMITS.outputChars) || `The sandbox rejected the command (${response.status}).`,
      }
    }
    const parsed = parseCommandStream(body)
    // Files are copied back as base64, so the raw stream is kept well above the
    // human-readable limit. The agent trims it before the model sees it.
    return { ok: true, exitCode: parsed.exitCode, output: parsed.output.slice(0, 400_000) }
  }

  const write = async (changed: WorkspaceFile[]): Promise<{ ok: boolean; error?: string }> => {
    if (!changed.length) return { ok: true }
    const scripts = changed.flatMap((file) => writeFileCommands(file).map((step) => step.args[1] ?? ''))
    // One command per batch, not one per file. Every command is a subrequest,
    // and a Worker turn only gets 50 of them on the free plan: a five-file
    // project used to cost five subrequests before a single command ran.
    const batches: string[] = []
    let batch = ''
    for (const script of scripts) {
      if (batch.length && batch.length + script.length > 120_000) {
        batches.push(batch)
        batch = ''
      }
      batch = batch ? `${batch}\n${script}` : script
    }
    if (batch) batches.push(batch)
    for (const script of batches) {
      const result = await run(script)
      if (!result.ok || (result.exitCode !== null && result.exitCode !== 0)) {
        return { ok: false, error: result.output || `Writing the files failed (exit ${result.exitCode ?? '?'}).` }
      }
    }
    return { ok: true }
  }

  const stop = async () => {
    if (stopped) return
    stopped = true
    const sessionStopped = await call(
      fetchImpl,
      env,
      `/v2/sandboxes/sessions/${encodeURIComponent(sessionId)}/stop${query(env)}`,
      { method: 'POST' },
    ).catch(() => null)
    if (!sessionStopped?.ok && sandboxName) {
      await call(
        fetchImpl,
        env,
        `/v2/sandboxes/${encodeURIComponent(sandboxName)}${deleteQuery(env)}`,
        { method: 'DELETE' },
      ).catch(() => undefined)
    }
  }

  return { run, write, stop }
}
