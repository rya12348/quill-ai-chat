import { AlertCircle, ArrowLeft, Bot, Brain, Check, Camera, ExternalLink, Globe2, Loader2, MousePointer2, Play, Search, Square, Terminal } from 'lucide-react'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router'

import type { BrowserAgentTrace } from '../../shared/browser-agent'
import type { BrowserSessionResponse } from '../../shared/types'
import { api, ApiError } from '../lib/api'
import { getBrowserAgentSnapshot, startBrowserAgentRun, stopBrowserAgentRun, subscribeBrowserAgentRun } from '../lib/browser-agent-run'
import { cx } from '../lib/cx'

const SUGGESTIONS = [
  'Open example.com, read the heading, and tell me what the page is for.',
  'Search for the current UTC date and report the result with the source URL.',
  'Open a page, inspect one element, and explain its computed color and font size.',
]

const TOOL_LABELS: Record<string, string> = {
  snapshot: 'Snapshot',
  page_text: 'Read page text',
  inspect_element: 'Inspect element',
  page_source: 'Read page source',
  console_logs: 'Console logs',
  network_logs: 'Network logs',
  screenshot: 'Screenshot',
  navigate: 'Navigate',
  click: 'Click',
  type: 'Type',
  fill: 'Fill fields',
  select: 'Select option',
  check: 'Set checkbox',
  hover: 'Hover',
  press: 'Press key',
  scroll: 'Scroll',
  back: 'Go back',
  forward: 'Go forward',
  reload: 'Reload page',
  wait: 'Wait',
  evaluate: 'Run page code',
  edit_page: 'Edit page',
  run_page_code: 'Run page program',
  read_page_result: 'Read code result',
  diff_page: 'Diff page',
  think: 'Think',
  update_plan: 'Update plan',
  add_note: 'Add note',
  compact_context: 'Compact context',
  assert_text: 'Verify text',
  assert_selector: 'Verify selector',
  assert_no_console_errors: 'Verify console',
  assert_page_changed: 'Verify page changed',
  finish: 'Finish',
}

function toolLabel(name: string): string {
  return TOOL_LABELS[name] || name.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function ToolIcon({ name, className }: { name: string; className?: string }) {
  const cls = className || 'size-3.5 shrink-0'
  if (name === 'screenshot') return <Camera className={cls} />
  if (/click|type|press|scroll|navigate|fill|select|check|hover|back|forward|reload/.test(name)) return <MousePointer2 className={cls} />
  if (/snapshot|page_text|page_source|inspect/.test(name)) return <Globe2 className={cls} />
  if (/think|plan|note|compact/.test(name)) return <Brain className={cls} />
  if (/search|network|console/.test(name)) return <Search className={cls} />
  return <Terminal className={cls} />
}

function timeLabel(at: number): string {
  return new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function argsSummary(args: Record<string, unknown> | undefined): string {
  if (!args) return ''
  try {
    return JSON.stringify(args).slice(0, 700)
  } catch {
    return ''
  }
}

function TraceCard({ event }: { event: BrowserAgentTrace }) {
  if (event.type === 'status') {
    return (
      <div className="flex items-center gap-2 px-1 py-1 text-[12.5px] text-faint">
        <Loader2 className="size-3 shrink-0 animate-spin text-accent" />
        <span>{event.text}</span>
        {event.step !== undefined ? <span className="ml-auto shrink-0">step {event.step + 1}</span> : null}
      </div>
    )
  }
  if (event.type === 'tool_call') {
    return (
      <div className="rounded-control border border-line bg-surface px-3.5 py-3">
        <div className="flex items-center gap-2 text-[12.5px] font-medium text-fg">
          <ToolIcon name={event.tool || ''} className="size-3.5 shrink-0 text-accent" />
          <span>{toolLabel(event.tool || '')}</span>
          <span className="ml-auto shrink-0 text-[11px] font-normal text-faint">{timeLabel(event.at)}</span>
        </div>
        {event.text ? <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">{event.text}</p> : null}
        {event.args && Object.keys(event.args).length ? (
          <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-[7px] bg-surface-2 px-2.5 py-2 font-mono text-[11px] leading-relaxed text-muted">{argsSummary(event.args)}</pre>
        ) : null}
      </div>
    )
  }
  if (event.type === 'thinking') {
    return (
      <div className="flex gap-2 px-2 py-1.5 text-[12.5px] leading-relaxed text-muted">
        <Brain className="mt-0.5 size-3.5 shrink-0 text-faint" />
        <span>{event.text}</span>
      </div>
    )
  }
  if (event.type === 'plan') {
    return (
      <div className="rounded-control border border-line bg-surface-2/60 px-3.5 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">Plan</p>
        <ol className="mt-1.5 space-y-1 text-[12.5px] leading-relaxed text-muted">
          {(event.plan || []).map((item, index) => (
            <li key={`${item}-${index}`}>{index + 1}. {item}</li>
          ))}
        </ol>
      </div>
    )
  }
  if (event.type === 'done') {
    return (
      <div className="rounded-card border border-emerald-500/30 bg-emerald-500/5 px-4 py-3.5">
        <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-emerald-600">
          <Check className="size-3.5" />
          Verified result
        </div>
        <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed text-fg">{event.text}</p>
      </div>
    )
  }
  if (event.type === 'error') {
    return (
      <div className="rounded-card border border-danger/25 bg-danger-soft px-4 py-3.5">
        <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-danger">
          <AlertCircle className="size-3.5" />
          {event.tool === 'finish' ? 'Finish rejected' : 'Agent stopped'}
        </div>
        <p className="mt-1.5 whitespace-pre-wrap text-[12.5px] leading-relaxed text-danger">{event.text}</p>
      </div>
    )
  }
  if (event.type === 'tool_result' || event.type === 'verification') {
    return (
      <div className={cx('rounded-control border px-3.5 py-3', event.ok === false ? 'border-danger/25 bg-danger-soft/40' : event.type === 'verification' ? 'border-emerald-500/25 bg-emerald-500/5' : 'border-line bg-surface')}>
        <div className="flex items-center gap-2 text-[12px] font-medium text-muted">
          <ToolIcon name={event.tool || ''} className="size-3.5 shrink-0 text-faint" />
          <span>{toolLabel(event.tool || '')}</span>
          <span className={cx('rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.08em]', event.ok === false ? 'bg-danger/10 text-danger' : event.type === 'verification' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-surface-2 text-faint')}>
            {event.type === 'verification' ? 'verified' : event.ok === false ? 'failed' : 'result'}
          </span>
          {event.ms ? <span className="ml-auto text-[11px] font-normal text-faint">{(event.ms / 1_000).toFixed(1)}s</span> : null}
        </div>
        <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words text-[12px] leading-relaxed text-muted">{event.text}</pre>
        {event.image ? <img src={event.image} alt="Browser viewport" className="mt-2 max-h-64 rounded-[8px] border border-line object-contain" /> : null}
      </div>
    )
  }
  return null
}

export function BrowserAgent() {
  const runState = useSyncExternalStore(subscribeBrowserAgentRun, getBrowserAgentSnapshot)
  const [session, setSession] = useState<BrowserSessionResponse | null>(null)
  const [checking, setChecking] = useState(true)
  const [starting, setStarting] = useState(false)
  const [task, setTask] = useState(() => getBrowserAgentSnapshot().task)
  const [sessionError, setSessionError] = useState('')
  const [bridgeReady, setBridgeReady] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const { busy, trace } = runState
  const error = runState.error || sessionError

  useEffect(() => {
    let cancelled = false
    api<BrowserSessionResponse>('/browser/session')
      .then((next) => {
        if (!cancelled) setSession(next)
      })
      .catch((cause) => {
        if (cancelled) return
        if (!(cause instanceof ApiError) || cause.status !== 404) {
          setSessionError(cause instanceof Error ? cause.message : 'Could not check the browser session.')
        }
      })
      .finally(() => {
        if (!cancelled) setChecking(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/buffy/status', { headers: { accept: 'application/json' } })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        const value = body as { configured?: boolean; ready?: boolean } | null
        if (!cancelled) setBridgeReady(Boolean(value?.configured && value?.ready))
      })
      .catch(() => {
        if (!cancelled) setBridgeReady(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [trace, busy])

  const startBrowser = async (): Promise<BrowserSessionResponse | null> => {
    setStarting(true)
    setSessionError('')
    try {
      const next = await api<BrowserSessionResponse>('/browser/session', {
        method: 'POST',
        json: { url: 'https://www.google.com/' },
      })
      setSession(next)
      return next
    } catch (cause) {
      // A session can already exist from another tab even though this page's
      // first read raced it. Reuse that session instead of reporting a dead end.
      if (cause instanceof ApiError && cause.status === 409) {
        const existing = await api<BrowserSessionResponse>('/browser/session').catch(() => null)
        if (existing) {
          setSession(existing)
          return existing
        }
      }
      setSessionError(cause instanceof Error ? cause.message : 'The browser could not start.')
      return null
    } finally {
      setStarting(false)
    }
  }

  const run = async () => {
    const prompt = task.trim()
    if (!prompt || busy) return
    let active = session
    if (!active) active = await startBrowser()
    if (!active) return
    setSessionError('')
    // The run lives in a module-level controller, so leaving this route does
    // not abort the stream and returning reattaches to the same trace.
    void startBrowserAgentRun(prompt)
  }

  const stop = () => stopBrowserAgentRun()

  return (
    <main className="flex min-h-dvh flex-col bg-bg text-fg md:h-dvh md:overflow-hidden">
      <header className="flex min-h-16 shrink-0 items-center gap-3 border-b border-line bg-bg px-4">
        <Link to="/browser" className="inline-flex h-9 items-center gap-1.5 rounded-tile px-2 text-[13px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg" aria-label="Back to Browser">
          <ArrowLeft className="size-3.5" />
          Browser
        </Link>
        <span className="hidden h-5 w-px bg-line sm:block" />
        <span className="grid size-8 place-items-center rounded-tile bg-fg text-bg" aria-hidden>
          <Bot className="size-4" />
        </span>
        <div className="min-w-0">
          <h1 className="font-display text-[16px] font-semibold leading-tight">Browser Agent</h1>
          <p className="hidden text-[11.5px] text-faint sm:block">One tool at a time, with the trace visible.</p>
        </div>
        <span className={cx('ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium', busy ? 'border-accent/30 bg-accent/10 text-accent' : session ? 'border-line bg-surface text-muted' : 'border-line bg-surface text-faint')}>
          <span className={cx('size-1.5 rounded-full', busy ? 'animate-pulse bg-accent' : session ? 'bg-emerald-500' : 'bg-line-strong')} />
          {busy ? 'Working' : session ? 'Session ready' : 'No session'}
        </span>
        <Link to="/browser" className="hidden h-8 items-center gap-1.5 rounded-control border border-line bg-surface px-2.5 text-[12px] text-muted transition-colors hover:text-fg sm:inline-flex">
          <MonitorIcon />
          Live page
        </Link>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <section className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-[860px] flex-col px-4 pb-10 pt-7 md:px-8">
            <div className="rounded-card border border-line bg-surface p-4 shadow-card md:p-5">
              <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-tile bg-fg text-bg"><Bot className="size-4" /></span>
                <div className="min-w-0">
                  <h2 className="font-display text-[22px] font-medium tracking-[-0.02em]">Give it a goal.</h2>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted">
                    The agent reads, acts and verifies. It will not finish just because it made a plan.
                  </p>
                </div>
              </div>
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  void run()
                }}
                className="mt-4"
              >
                <textarea
                  value={task}
                  onChange={(event) => setTask(event.target.value)}
                  rows={3}
                  disabled={busy}
                  placeholder="Open a page, find something, fill a form, change the page, and show the evidence…"
                  className="block w-full resize-none rounded-control border border-line bg-bg px-3.5 py-3 text-[14px] leading-relaxed text-fg outline-none placeholder:text-faint focus:border-accent/50 disabled:opacity-50"
                />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {busy ? (
                    <button type="button" onClick={stop} className="inline-flex h-9 items-center gap-1.5 rounded-tile bg-accent px-3.5 text-[12.5px] font-medium text-bg">
                      <Square className="size-3 fill-current" /> Stop
                    </button>
                  ) : (
                    <button type="submit" disabled={!task.trim() || starting} className="inline-flex h-9 items-center gap-1.5 rounded-tile bg-accent px-3.5 text-[12.5px] font-medium text-bg transition-opacity hover:bg-accent-strong disabled:opacity-30">
                      {starting ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3 fill-current" />}
                      {session ? 'Run agent' : 'Start & run'}
                    </button>
                  )}
                  {!session && !checking ? <span className="text-[11.5px] text-faint">Starts a cloud browser first.</span> : null}
                </div>
              </form>
              {error ? <p role="alert" className="mt-2 rounded-control border border-danger/20 bg-danger-soft px-3 py-2 text-[12.5px] leading-relaxed text-danger">{error}</p> : null}
            </div>

            {!trace.length && !busy ? (
              <div className="mt-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">Try a task</p>
                <div className="mt-2 grid gap-2">
                  {SUGGESTIONS.map((suggestion) => (
                    <button key={suggestion} type="button" onClick={() => setTask(suggestion)} className="rounded-control border border-line bg-surface px-3.5 py-3 text-left text-[13px] leading-snug text-muted transition-colors hover:border-accent/40 hover:text-fg">
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-6 space-y-2.5">
              {trace.map((event, index) => <TraceCard key={`${event.type}-${event.at}-${index}`} event={event} />)}
              {busy ? (
                <div className="flex items-center gap-2 rounded-control border border-dashed border-line px-3.5 py-3 text-[12.5px] text-faint">
                  <Loader2 className="size-3.5 animate-spin text-accent" /> Agent is working…
                </div>
              ) : null}
            </div>
            <div ref={endRef} />
          </div>
        </section>

        <aside className="w-full shrink-0 border-t border-line bg-bg px-4 py-5 md:px-6 lg:w-[320px] lg:overflow-y-auto lg:border-l lg:border-t-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">How this differs</p>
          <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
            This loop uses real tool results, fresh snapshots, page code, assertions and a visible trace. The fast Run path is still on the Browser page.
          </p>
          <div className="mt-4 rounded-control border border-line bg-surface px-3.5 py-3">
            <div className="flex items-center gap-2 text-[12.5px] font-medium text-fg"><Globe2 className="size-3.5 text-accent" /> Remote browser</div>
            <p className="mt-1.5 text-[12px] leading-relaxed text-faint">
              {session ? `Session ${session.sessionId.slice(0, 8)}… · remote page` : 'Start a session from the task box.'}
            </p>
            <Link to="/browser" className="mt-2 inline-flex items-center gap-1 text-[11.5px] text-muted underline underline-offset-2 hover:text-fg">
              Open live page <ExternalLink className="size-3" />
            </Link>
          </div>
          <div className="mt-3 rounded-control border border-line bg-surface px-3.5 py-3">
            <div className="flex items-center gap-2 text-[12.5px] font-medium text-fg"><Terminal className="size-3.5 text-accent" /> Full local agent</div>
            {bridgeReady && task.trim() ? (
              <>
                <p className="mt-1.5 text-[12px] leading-relaxed text-faint">Buffy can use files, shell, edits and browser tools on this computer.</p>
                <a href={`/buffy?task=${encodeURIComponent(task)}`} className="mt-2 inline-flex items-center gap-1.5 rounded-control border border-line bg-bg px-2.5 py-1.5 text-[12px] font-medium text-muted transition-colors hover:text-fg">
                  Run with Buffy <ExternalLink className="size-3" />
                </a>
              </>
            ) : (
              <p className="mt-1.5 text-[12px] leading-relaxed text-faint">
                {bridgeReady ? 'Enter a task to hand it to Buffy.' : 'Run npm run buffy for file, terminal and browser parity. The hosted remote mode cannot access local files.'}
              </p>
            )}
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-faint">
            Page text is treated as untrusted data. Purchases, messages and destructive account changes are not performed without confirmation.
          </p>
        </aside>
      </div>
    </main>
  )
}

function MonitorIcon() {
  return <Globe2 className="size-3.5" />
}
