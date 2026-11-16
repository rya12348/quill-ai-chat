import type { BrowserAgentTrace } from '../../shared/browser-agent'

/**
 * The browser agent run lives outside the page component. React Router
 * unmounts /browser/agent when someone goes back to the browser, but that must
 * not abort the stream or erase the trace. This controller keeps one run for
 * the tab, survives route changes, and lets the page reattach to it.
 */
export type BrowserAgentRunState = {
  task: string
  trace: BrowserAgentTrace[]
  busy: boolean
  error: string
  completed: boolean
  startedAt: number
}

const STORAGE_KEY = 'ink.browser-agent.run.v1'
const MAX_TRACE = 180

const EMPTY: BrowserAgentRunState = {
  task: '',
  trace: [],
  busy: false,
  error: '',
  completed: false,
  startedAt: 0,
}

function readSaved(): BrowserAgentRunState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY
    const parsed = JSON.parse(raw) as Partial<BrowserAgentRunState>
    if (!Array.isArray(parsed.trace) || typeof parsed.task !== 'string') return EMPTY
    // A saved run was interrupted by a reload; there is no server stream to
    // reattach to. Keep the evidence visible but never pretend it is running.
    return {
      task: parsed.task,
      trace: parsed.trace.filter((event) => event && typeof event.type === 'string').slice(-MAX_TRACE),
      busy: false,
      completed: parsed.completed === true,
      error: parsed.busy ? 'The previous run was interrupted by a page reload. Start a new task to continue.' : '',
      startedAt: Number(parsed.startedAt) || 0,
    }
  } catch {
    return EMPTY
  }
}

function persist(value: BrowserAgentRunState): void {
  try {
    const compact = {
      ...value,
      // Screenshots are large; the saved copy is only for the visible chat
      // history after a reload, not for resuming the run.
      trace: value.trace.slice(-80).map((event) => (event.image ? { ...event, image: undefined } : event)),
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(compact))
  } catch {
    // Private mode or a full quota should not break the live run.
  }
}

let state: BrowserAgentRunState = readSaved()
let controller: AbortController | null = null
let runCounter = 0
let activeRun = 0
const listeners = new Set<() => void>()

function commit(patch: Partial<BrowserAgentRunState>): void {
  state = { ...state, ...patch }
  persist(state)
  for (const listener of listeners) listener()
}

function append(event: BrowserAgentTrace): void {
  commit({ trace: [...state.trace, event].slice(-MAX_TRACE) })
}

export function subscribeBrowserAgentRun(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getBrowserAgentSnapshot(): BrowserAgentRunState {
  return state
}

/** Parse the server's SSE frames without depending on the page lifecycle. */
function eventFromBlock(block: string): BrowserAgentTrace | null {
  const data = block
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n')
  if (!data) return null
  try {
    const event = JSON.parse(data) as BrowserAgentTrace
    return event && typeof event.type === 'string' ? event : null
  } catch {
    return null
  }
}

export async function startBrowserAgentRun(task: string): Promise<void> {
  const id = ++runCounter
  activeRun = id
  controller?.abort()
  const current = new AbortController()
  controller = current
  commit({ task, trace: [], busy: true, error: '', completed: false, startedAt: Date.now() })

  try {
    const response = await fetch('/api/browser/agent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ task }),
      signal: current.signal,
    })
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { message?: string; error?: string }
      throw new Error(body.message || body.error || 'The browser agent could not start.')
    }
    if (!response.body) throw new Error('The browser agent returned no stream.')

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (id === activeRun) {
      const chunk = await reader.read()
      if (chunk.done) break
      buffer += decoder.decode(chunk.value, { stream: true })
      const blocks = buffer.split(/\r?\n\r?\n/)
      buffer = blocks.pop() ?? ''
      for (const block of blocks) {
        const event = eventFromBlock(block)
        if (!event) continue
        if (id !== activeRun) return
        if (event.type === 'done') {
          commit({ completed: true, error: '' })
        } else if (event.type === 'error' && event.text && !event.tool) {
          commit({ error: event.text })
        }
        append(event)
      }
    }
  } catch (cause) {
    if (id !== activeRun) return
    if (current.signal.aborted) {
      append({ type: 'status', at: Date.now(), text: 'Stopped.' })
    } else {
      commit({ error: cause instanceof Error ? cause.message : 'The browser agent stopped.' })
    }
  } finally {
    if (id === activeRun) {
      controller = null
      commit({ busy: false })
    }
  }
}

export function stopBrowserAgentRun(): void {
  controller?.abort()
}

export function clearBrowserAgentRun(): void {
  controller?.abort()
  controller = null
  activeRun = 0
  commit({ ...EMPTY })
}
