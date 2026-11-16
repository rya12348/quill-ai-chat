import {
  AlertCircle,
  ArrowLeft,
  ArrowUp,
  Bot,
  Check,
  Code2,
  Download,
  FileCode2,
  FolderTree,
  Loader2,
  Monitor,
  Play,
  RotateCcw,
  RotateCw,
  Smartphone,
  Square,
  Tablet,
  Terminal,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'

import type { BuildInfo, BuildPage } from '../../shared/types'
import { BUFFY_MODEL_LABELS, BUFFY_MODELS, DENT_MODEL, buffyModelSpeed, isDuckModel, normalizeBuffyModel, type BuffyModel } from '../lib/buffy-models'
import { requestDuckTurn, type DuckTurn } from '../lib/duck'
import { Markdown } from '../components/Markdown'

type ToolStatus = 'running' | 'done' | 'error' | 'stopped'
type Tool = {
  id: string
  name: string
  detail?: string
  status: ToolStatus
  summary?: string
}
type Message = { role: 'user' | 'assistant'; content: string; tools?: Tool[] }
type WireTool = {
  type: 'tool_call' | 'tool_result'
  id?: string
  name?: string
  detail?: string
  status?: string
  summary?: string
}

const CHAT_KEY = 'buffy:code:chat:v1'
const WORKSPACE_KEY = 'buffy:code:workspace:v1'
const MODEL_KEY = 'buffy:code:model:v1'
const SUGGESTIONS = [
  'Build a working tip calculator with a live receipt breakdown.',
  'Make a two-page site for a neighborhood coffee shop with a menu and hours.',
  'Create a kanban board with drag-and-drop cards and a working add-card form.',
]

const TOOL_TITLES: Record<string, string> = {
  read_files: 'Read workspace',
  create_plan: 'Plan the build',
  write_file: 'Write project files',
  run_preview: 'Open the preview',
  run_file_change_hooks: 'Run page checks',
}

function toolTitle(name: string): string {
  return TOOL_TITLES[name] || name.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function readMessages(): Message[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(CHAT_KEY) || '[]') as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((value): Message | null => {
        if (!value || typeof value !== 'object') return null
        const message = value as { role?: unknown; content?: unknown; tools?: unknown }
        if ((message.role !== 'user' && message.role !== 'assistant') || typeof message.content !== 'string') return null
        const tools = Array.isArray(message.tools)
          ? message.tools
              .filter((tool): tool is Tool => {
                if (!tool || typeof tool !== 'object') return false
                const item = tool as Partial<Tool>
                return typeof item.id === 'string' && typeof item.name === 'string' && ['running', 'done', 'error', 'stopped'].includes(item.status || '')
              })
              .map((tool) => (tool.status === 'running' ? { ...tool, status: 'stopped' as const } : tool))
              .slice(-40)
          : []
        return {
          role: message.role,
          content: message.content,
          ...(tools.length ? { tools } : {}),
        }
      })
      .filter((message): message is Message => message !== null)
      .slice(-50)
  } catch {
    return []
  }
}

function readBuild(value: unknown): BuildInfo | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Partial<BuildInfo>
  if (typeof raw.html !== 'string' || !raw.html.trim() || raw.html.length > 140_000) return null
  const pages = Array.isArray(raw.pages)
    ? raw.pages
        .filter(
          (page): page is BuildPage =>
            Boolean(page) &&
            typeof page === 'object' &&
            typeof (page as BuildPage).name === 'string' &&
            /^[A-Za-z0-9._-]{1,80}\.html?$/.test((page as BuildPage).name) &&
            typeof (page as BuildPage).html === 'string' &&
            Boolean((page as BuildPage).html.trim()),
        )
        .slice(0, 8)
        .map((page) => ({ name: page.name, html: page.html.slice(0, 140_000) }))
    : []
  const verification =
    raw.verification &&
    typeof raw.verification === 'object' &&
    Array.isArray((raw.verification as { checks?: unknown }).checks)
      ? raw.verification
      : undefined
  return {
    status: raw.status === 'ready' ? 'ready' : 'warning',
    kind: 'page',
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim().slice(0, 140) : 'Buffy project',
    html: raw.html,
    ...(pages.length ? { pages } : {}),
    ...(raw.interactive === true ? { interactive: true } : {}),
    models: Array.isArray(raw.models) ? raw.models.filter((model): model is string => typeof model === 'string').slice(0, 4) : [],
    asOf: Number.isFinite(Number(raw.asOf)) ? Number(raw.asOf) : Date.now(),
    ...(verification ? { verification } : {}),
  }
}

function pagesFor(build: BuildInfo): BuildPage[] {
  return build.pages?.length ? build.pages : [{ name: 'index.html', html: build.html }]
}

function ToolIcon({ name }: { name: string }) {
  const className = 'size-3.5 shrink-0 text-faint'
  if (name === 'write_file') return <FileCode2 className={className} />
  if (name === 'run_preview') return <Play className={className} />
  if (name === 'run_file_change_hooks') return <Terminal className={className} />
  if (name === 'read_files' || name === 'create_plan') return <FolderTree className={className} />
  return <Bot className={className} />
}

function ToolTimeline({ tools }: { tools: Tool[] }) {
  if (!tools.length) return null
  return (
    <div className="mb-3 overflow-hidden rounded-control border border-line bg-surface/60">
      <div className="flex items-center gap-2 border-b border-line px-3 py-1.5 text-[11px] text-faint">
        <Terminal className="size-3.5" />
        Agent activity · {tools.length} {tools.length === 1 ? 'step' : 'steps'}
      </div>
      <ol className="divide-y divide-line/70">
        {tools.map((tool) => (
          <li key={tool.id} className="px-3 py-2">
            <div className="flex items-center gap-2">
              <ToolIcon name={tool.name} />
              <span className="shrink-0 text-[12px] font-medium text-fg">{toolTitle(tool.name)}</span>
              {tool.detail ? (
                <span className="min-w-0 flex-1 truncate font-mono text-[10.5px] text-faint" title={tool.detail}>
                  {tool.detail}
                </span>
              ) : (
                <span className="flex-1" />
              )}
              {tool.status === 'running' ? (
                <Loader2 aria-label="Running" className="size-3.5 shrink-0 animate-spin text-sky-500" />
              ) : tool.status === 'error' ? (
                <AlertCircle aria-label="Failed" className="size-3.5 shrink-0 text-warning" />
              ) : tool.status === 'stopped' ? (
                <Square aria-label="Stopped" className="size-3 shrink-0 text-faint" />
              ) : (
                <Check aria-label="Finished" className="size-3.5 shrink-0 text-emerald-500" />
              )}
            </div>
            {tool.summary ? <p className="mt-1 pl-[22px] text-[11.5px] leading-relaxed text-muted">{tool.summary}</p> : null}
          </li>
        ))}
      </ol>
    </div>
  )
}

export function BuffyCode() {
  const [messages, setMessages] = useState<Message[]>(readMessages)
  const [input, setInput] = useState('')
  const [pending, setPending] = useState(false)
  const [activity, setActivity] = useState('')
  const [error, setError] = useState('')
  const [model, setModel] = useState<BuffyModel>(() => {
    try {
      // Claude completed both measured page tasks; Dent and ChatGPT did not.
      // Keep the measured fast default, with Dent as an explicit slower mode.
      const saved = localStorage.getItem(MODEL_KEY)
      return saved ? normalizeBuffyModel(saved) : 'claude-haiku-5-5'
    } catch {
      return 'claude-haiku-5-5'
    }
  })
  const [build, setBuild] = useState<BuildInfo | null>(() => {
    try {
      return readBuild(JSON.parse(localStorage.getItem(WORKSPACE_KEY) || 'null'))
    } catch {
      return null
    }
  })
  const [selectedPage, setSelectedPage] = useState('index.html')
  const [panel, setPanel] = useState<'preview' | 'code'>('preview')
  const [mobileView, setMobileView] = useState<'chat' | 'workspace'>('chat')
  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'phone'>('desktop')
  const [previewError, setPreviewError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const abortRef = useRef<AbortController | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    try {
      localStorage.setItem(CHAT_KEY, JSON.stringify(messages.slice(-50)))
    } catch {
      /* private mode can refuse storage; the chat still works for this visit */
    }
  }, [messages])

  useEffect(() => {
    try {
      if (build) localStorage.setItem(WORKSPACE_KEY, JSON.stringify(build))
      else localStorage.removeItem(WORKSPACE_KEY)
    } catch {
      /* a large build can exceed local storage; it still renders for this visit */
    }
  }, [build])

  useEffect(() => {
    try {
      localStorage.setItem(MODEL_KEY, model)
    } catch {
      /* model choice still applies for this visit */
    }
  }, [model])

  useEffect(() => {
    if (!build) return
    const pages = pagesFor(build)
    setSelectedPage((current) => (pages.some((page) => page.name === current) ? current : pages[0]?.name || 'index.html'))
  }, [build])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return
      const data = event.data as { source?: unknown; type?: unknown; detail?: unknown } | null
      if (!data || data.source !== 'buffy-preview') return
      if (data.type === 'navigate' && data.detail && typeof data.detail === 'object') {
        const requested = String((data.detail as { page?: unknown }).page ?? '')
        const target = (build ? pagesFor(build) : []).find(
          (item) => item.name.replace(/\.html?$/i, '') === requested.replace(/\.html?$/i, ''),
        )
        if (target) {
          setSelectedPage(target.name)
          setPreviewError('')
        }
        return
      }
      if (data.type === 'error' && data.detail && typeof data.detail === 'object') {
        const detail = data.detail as { message?: unknown; line?: unknown }
        const message =
          typeof detail.message === 'string' && detail.message.trim()
            ? detail.message.trim().slice(0, 240)
            : 'A page script stopped unexpectedly.'
        const line = typeof detail.line === 'number' && detail.line > 0 ? ` (line ${detail.line})` : ''
        setPreviewError(`${message}${line}`)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [build])

  useEffect(() => {
    setPreviewError('')
  }, [build?.asOf, selectedPage, reloadKey])

  useEffect(() => {
    if (!pending) {
      setElapsed(0)
      return
    }
    const started = Date.now()
    setElapsed(0)
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1_000)), 1_000)
    return () => window.clearInterval(timer)
  }, [pending])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages, activity])

  useEffect(() => () => abortRef.current?.abort(), [])

  const updateTool = (incoming: WireTool) => {
    if (!incoming.id) return
    const id = incoming.id
    setMessages((current) => {
      const next = [...current]
      const last = next[next.length - 1]
      if (last?.role !== 'assistant') return current
      const tools = [...(last.tools ?? [])]
      const index = tools.findIndex((tool) => tool.id === id)
      if (incoming.type === 'tool_call') {
        const item: Tool = {
          id,
          name: incoming.name || 'tool',
          detail: incoming.detail || '',
          status: 'running',
        }
        if (index >= 0) tools[index] = { ...tools[index], ...item }
        else tools.push(item)
      } else {
        const status: ToolStatus = incoming.status === 'error' ? 'error' : 'done'
        if (index >= 0) {
          tools[index] = {
            ...tools[index],
            ...(incoming.name ? { name: incoming.name } : {}),
            ...(incoming.summary ? { summary: incoming.summary } : {}),
            status,
          }
        } else {
          tools.push({
            id,
            name: incoming.name || 'tool',
            status,
            ...(incoming.summary ? { summary: incoming.summary } : {}),
          })
        }
      }
      next[next.length - 1] = { ...last, tools }
      return next
    })
  }

  const settleTools = (status: ToolStatus) => {
    setMessages((current) => {
      const next = [...current]
      const last = next[next.length - 1]
      if (last?.role !== 'assistant' || !last.tools?.length) return current
      next[next.length - 1] = {
        ...last,
        tools: last.tools.map((tool) => (tool.status === 'running' ? { ...tool, status } : tool)),
      }
      return next
    })
  }

  const send = async (raw: string) => {
    const prompt = raw.trim()
    if (!prompt || pending) return
    const controller = new AbortController()
    abortRef.current = controller
    setInput('')
    setError('')
    setPending(true)
    setActivity('Preparing the free coding model…')
    setMobileView('chat')
    setMessages((current) => [
      ...current,
      { role: 'user', content: prompt },
      { role: 'assistant', content: '' },
    ])
    let accumulated = ''
    const update = (text: string) => {
      accumulated += text
      setMessages((current) => {
        const next = [...current]
        const last = next[next.length - 1]
        if (last?.role === 'assistant') next[next.length - 1] = { ...last, content: accumulated }
        return next
      })
    }

    try {
      let duck: DuckTurn | null = null
      if (isDuckModel(model)) {
        try {
          duck = await requestDuckTurn(model, controller.signal)
        } catch (error) {
          if (controller.signal.aborted) throw error
          // Do not silently replace an explicitly selected Duck model with a
          // different hosted model. The person can retry or choose Dent.
          throw new Error(`${BUFFY_MODEL_LABELS[model].name} could not connect. Try again or choose Dent deep mode.`)
        }
      }
      if (isDuckModel(model) && !duck) {
        throw new Error(`${BUFFY_MODEL_LABELS[model].name} could not connect. Try again or choose Dent deep mode.`)
      }
      setActivity(`${BUFFY_MODEL_LABELS[model].name} is writing the project…`)
      const response = await fetch('/api/buffy/code', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt, model, ...(build ? { previous: build } : {}), ...(duck ? { duck } : {}) }),
        signal: controller.signal,
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: unknown }
        throw new Error(typeof body.error === 'string' ? body.error : 'Buffy Code could not start this build.')
      }
      if (!response.body) throw new Error('Buffy Code returned no stream.')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let done = false
      while (!done) {
        const chunk = await reader.read()
        if (chunk.done) break
        buffer += decoder.decode(chunk.value, { stream: true })
        const blocks = buffer.split(/\r?\n\r?\n/)
        buffer = blocks.pop() ?? ''
        for (const block of blocks) {
          let event = 'message'
          const data: string[] = []
          for (const line of block.split(/\r?\n/)) {
            if (line.startsWith('event:')) event = line.slice(6).trim()
            else if (line.startsWith('data:')) data.push(line.slice(5).trimStart())
          }
          const rawData = data.join('\n')
          if (!rawData) continue
          if (event === 'status') {
            try {
              const parsed = JSON.parse(rawData) as { text?: string }
              if (parsed.text) setActivity(parsed.text)
            } catch {
              /* malformed progress event */
            }
            continue
          }
          if (event === 'tool') {
            try {
              updateTool(JSON.parse(rawData) as WireTool)
            } catch {
              /* a malformed tool event should not end the build */
            }
            continue
          }
          if (event === 'build') {
            try {
              const parsed = JSON.parse(rawData) as { build?: unknown }
              const next = readBuild(parsed.build)
              if (next) {
                const nextPages = pagesFor(next)
                setBuild(next)
                setSelectedPage((current) =>
                  nextPages.some((item) => item.name === current) ? current : nextPages[0]?.name || 'index.html',
                )
                setPanel('preview')
                setMobileView('workspace')
              }
            } catch {
              /* the final build event is validated above */
            }
            continue
          }
          if (rawData === '[DONE]') {
            done = true
            break
          }
          try {
            const parsed = JSON.parse(rawData) as {
              error?: { message?: string }
              choices?: { delta?: { content?: string } }[]
            }
            if (parsed.error?.message) throw new Error(parsed.error.message)
            const piece = parsed.choices?.[0]?.delta?.content
            if (piece) {
              setActivity('')
              update(piece)
            }
          } catch (error) {
            if (error instanceof SyntaxError) continue
            throw error
          }
        }
      }
      if (!accumulated) update('Buffy Code finished without a message. Check the project panel.')
    } catch (thrown) {
      if (controller.signal.aborted) {
        settleTools('stopped')
        setMessages((current) => {
          const next = [...current]
          const last = next[next.length - 1]
          if (last?.role === 'assistant' && !last.content) next[next.length - 1] = { ...last, content: 'Stopped.' }
          return next
        })
      } else {
        settleTools('error')
        const message = thrown instanceof Error ? thrown.message : 'Buffy Code could not finish this build.'
        setError(message)
        setInput(prompt)
        setMessages((current) => {
          const next = [...current]
          const last = next[next.length - 1]
          if (last?.role === 'assistant') next[next.length - 1] = { ...last, content: message }
          return next
        })
      }
    } finally {
      abortRef.current = null
      setPending(false)
      setActivity('')
      window.setTimeout(() => inputRef.current?.focus(), 0)
    }
  }

  const stop = () => abortRef.current?.abort()

  const reset = () => {
    abortRef.current?.abort()
    setMessages([])
    setBuild(null)
    setSelectedPage('index.html')
    setPanel('preview')
    setInput('')
    setError('')
    setActivity('')
    setPreviewError('')
    setReloadKey(0)
    setElapsed(0)
    setPending(false)
    try {
      localStorage.removeItem(CHAT_KEY)
      localStorage.removeItem(WORKSPACE_KEY)
    } catch {
      /* storage is optional */
    }
    setMobileView('chat')
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }

  const pages = build ? pagesFor(build) : []
  const page = pages.find((item) => item.name === selectedPage) ?? pages[0]
  const verification = build?.verification
  const passed = verification?.checks.filter((item) => item.status === 'pass').length ?? 0
  const totalChecks = verification?.checks.length ?? 0
  const statusText = `${activity || 'Buffy is working…'}${pending && elapsed > 0 ? ` · ${elapsed}s` : ''}`
  const previewWidth = viewport === 'phone' ? 390 : viewport === 'tablet' ? 768 : undefined

  const download = () => {
    if (!build || !page) return
    const blob = new Blob([page.html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = page.name
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col bg-bg text-fg">
      <header className="flex min-h-14 shrink-0 flex-wrap items-center gap-3 border-b border-line px-4 py-2 md:px-6">
        <Link
          to="/buffy"
          className="grid size-8 place-items-center rounded-tile text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          aria-label="Back to Buffy chat"
          title="Back to Buffy chat"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <span className="grid size-8 place-items-center rounded-tile bg-fg text-bg" aria-hidden>
          <Code2 className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[17px] font-medium leading-tight">Buffy Code</h1>
          <p className="truncate text-[12.5px] text-faint">Hosted coding agent · writes files, checks the page, runs a sandboxed preview</p>
        </div>
        <select
          aria-label="Choose free coding model"
          title="Claude is the measured fast default. Dent is the deep mode and takes longer. ChatGPT is the alternate and takes longer."
          value={model}
          disabled={pending}
          onChange={(event) => setModel(normalizeBuffyModel(event.target.value))}
          className="h-8 rounded-control border border-line bg-surface px-2 text-[12px] text-muted outline-none transition-colors hover:text-fg focus:border-accent/50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {BUFFY_MODELS.map((id) => {
            const note = id === DENT_MODEL ? 'deep mode' : id === 'claude-haiku-5-5' ? 'default' : 'alternate'
            return (
              <option key={id} value={id}>
                {BUFFY_MODEL_LABELS[id].name} — {buffyModelSpeed(id).label.toLowerCase()} ({note})
              </option>
            )
          })}
        </select>
        <span className="hidden items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[11.5px] text-muted lg:flex">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          Free coding lanes
        </span>
        <Link
          to="/buffy"
          className="hidden h-8 items-center gap-1.5 rounded-control border border-line bg-surface px-2.5 text-[12.5px] text-muted transition-colors hover:text-fg sm:inline-flex"
        >
          <Bot className="size-3.5" />
          Chat
        </Link>
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-8 items-center gap-1.5 rounded-control px-2.5 text-[13px] text-muted transition-colors hover:bg-surface hover:text-fg"
        >
          <RotateCcw className="size-3.5" />
          New
        </button>
      </header>

      <div className="flex shrink-0 border-b border-line lg:hidden" role="tablist" aria-label="Buffy Code view">
        <button
          type="button"
          role="tab"
          aria-selected={mobileView === 'chat'}
          onClick={() => setMobileView('chat')}
          className={`flex-1 border-b-2 px-3 py-2 text-[12.5px] font-medium transition-colors ${mobileView === 'chat' ? 'border-accent text-fg' : 'border-transparent text-faint'}`}
        >
          Chat
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileView === 'workspace'}
          onClick={() => setMobileView('workspace')}
          className={`flex-1 border-b-2 px-3 py-2 text-[12.5px] font-medium transition-colors ${mobileView === 'workspace' ? 'border-accent text-fg' : 'border-transparent text-faint'}`}
        >
          Workspace{build ? ' · preview' : ''}
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <section className={`min-h-0 flex-1 flex-col border-r border-line lg:flex lg:w-[400px] lg:flex-none ${mobileView === 'chat' ? 'flex' : 'hidden'}`}>
          <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto flex w-full max-w-[720px] flex-col px-4 pb-8 pt-6 md:px-6">
              {messages.length === 0 ? (
                <div className="flex flex-1 flex-col justify-center py-8">
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-tile bg-fg text-bg" aria-hidden>
                      <Code2 className="size-5" />
                    </span>
                    <div>
                      <p className="font-display text-[24px] font-medium leading-tight tracking-[-0.02em]">Your coding workspace.</p>
                      <p className="mt-1 text-[13.5px] leading-relaxed text-muted">
                        Describe a page, tool or game. Buffy writes complete files, checks the markup and opens the result in a sandbox.
                      </p>
                    </div>
                  </div>
                  <div className="mt-7 grid gap-2">
                    {SUGGESTIONS.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => void send(suggestion)}
                        className="rounded-control border border-line bg-surface px-3.5 py-3 text-left text-[13.5px] leading-snug text-muted transition-colors hover:border-accent/40 hover:text-fg"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                  <p className="mt-5 text-[11.5px] leading-relaxed text-faint">
                    This runs on the hosted free models. It edits the project in this browser; the full local terminal bridge is available on the Buffy chat page when you are running Ink locally.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {messages.map((message, index) =>
                    message.role === 'user' ? (
                      <div key={`${index}-user`} className="flex justify-end">
                        <div className="max-w-[88%] rounded-card bg-surface px-4 py-3 text-[14px] leading-relaxed shadow-card">
                          <p className="whitespace-pre-wrap">{message.content}</p>
                        </div>
                      </div>
                    ) : (
                      <div key={`${index}-assistant`} className="flex gap-3">
                        <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-tile bg-fg text-bg" aria-hidden>
                          <Code2 className="size-3.5" />
                        </span>
                        <div className="min-w-0 flex-1 pt-0.5">
                          {message.tools?.length ? <ToolTimeline tools={message.tools} /> : null}
                          {message.content ? (
                            <Markdown className="prose-chat text-[14.5px] leading-[1.7]">{message.content}</Markdown>
                          ) : message.tools?.length ? null : (
                            <p className="text-[13px] text-faint">{statusText}</p>
                          )}
                        </div>
                      </div>
                    ),
                  )}
                  {pending && messages[messages.length - 1]?.content ? (
                    <p className="pl-10 text-[12.5px] text-faint">{statusText}</p>
                  ) : null}
                  {build && mobileView === 'chat' ? (
                    <button
                      type="button"
                      onClick={() => {
                        setMobileView('workspace')
                        setPanel('preview')
                      }}
                      className="ml-10 inline-flex items-center gap-1.5 rounded-control border border-line bg-surface px-3 py-2 text-[12.5px] text-muted transition-colors hover:text-fg lg:hidden"
                    >
                      <Play className="size-3.5" />
                      View the generated project
                    </button>
                  ) : null}
                  <div ref={endRef} />
                </div>
              )}
            </div>
          </div>

          <div className="shrink-0 border-t border-line bg-bg px-4 py-3 md:px-6">
            {error ? (
              <p role="alert" className="mx-auto mb-2 w-full max-w-[720px] text-[12px] leading-relaxed text-warning">
                {error}
              </p>
            ) : null}
            <form
              onSubmit={(event) => {
                event.preventDefault()
                void send(input)
              }}
              className="mx-auto flex w-full max-w-[720px] items-end gap-2 rounded-card border border-line bg-surface p-2 shadow-card focus-within:border-accent/50"
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    void send(input)
                  }
                }}
                rows={1}
                placeholder="Describe the app, page or change…"
                disabled={pending}
                aria-label="Describe what Buffy Code should build"
                className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-[14px] leading-relaxed text-fg placeholder:text-faint focus:outline-none disabled:cursor-not-allowed"
              />
              {pending ? (
                <button
                  type="button"
                  onClick={stop}
                  aria-label="Stop Buffy Code"
                  className="grid size-9 shrink-0 place-items-center rounded-control bg-fg text-bg transition-opacity hover:opacity-85"
                >
                  <Square className="size-3.5" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  aria-label="Send build request"
                  className="grid size-9 shrink-0 place-items-center rounded-control bg-fg text-bg transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ArrowUp className="size-4" />
                </button>
              )}
            </form>
            <p className="mx-auto mt-1.5 w-full max-w-[720px] text-[10.5px] text-faint">
              Claude is fast (the default) · Dent takes longer (deep mode) · ChatGPT takes longer (alternate) · edits stay in this browser
            </p>
          </div>
        </section>

        <section className={`min-h-0 flex-1 flex-col bg-surface/20 lg:flex ${mobileView === 'workspace' ? 'flex' : 'hidden'}`}>
          <div className="flex min-h-12 shrink-0 flex-wrap items-center gap-2 border-b border-line px-4 py-2">
            <FolderTree className="size-4 shrink-0 text-faint" />
            <span className="min-w-0 max-w-[45%] truncate text-[13px] font-medium">{build?.title || 'Workspace'}</span>
            {build ? (
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] ${
                  build.status === 'ready' ? 'border-emerald-500/30 text-emerald-600' : 'border-amber-500/30 text-amber-600'
                }`}
              >
                {build.status === 'ready' ? <Check className="size-3" /> : <AlertCircle className="size-3" />}
                {build.status === 'ready' ? 'Checks passed' : 'Review warnings'}
              </span>
            ) : null}
            {build?.interactive ? (
              <span className="rounded-full border border-line px-2 py-0.5 text-[10.5px] text-faint">Interactive</span>
            ) : null}
            {build?.models.length ? (
              <span
                className="max-w-[240px] truncate rounded-full border border-line px-2 py-0.5 text-[10.5px] text-faint"
                title={`Actual model: ${build.models.join(', ')}`}
              >
                {build.models.length === 1 ? 'Model' : 'Models'}: {build.models.join(', ')}
              </span>
            ) : null}
            <div className="ml-auto flex items-center gap-1">
              {build ? (
                <>
                  <div className="mr-1 hidden items-center gap-0.5 rounded-tile border border-line p-0.5 sm:flex">
                    <button
                      type="button"
                      onClick={() => setViewport('desktop')}
                      aria-label="Desktop preview width"
                      aria-pressed={viewport === 'desktop'}
                      title="Desktop width"
                      className={`grid size-6 place-items-center rounded-[5px] transition-colors ${viewport === 'desktop' ? 'bg-surface text-fg shadow-card' : 'text-faint hover:text-fg'}`}
                    >
                      <Monitor className="size-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewport('tablet')}
                      aria-label="Tablet preview width"
                      aria-pressed={viewport === 'tablet'}
                      title="Tablet width"
                      className={`grid size-6 place-items-center rounded-[5px] transition-colors ${viewport === 'tablet' ? 'bg-surface text-fg shadow-card' : 'text-faint hover:text-fg'}`}
                    >
                      <Tablet className="size-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewport('phone')}
                      aria-label="Phone preview width"
                      aria-pressed={viewport === 'phone'}
                      title="Phone width"
                      className={`grid size-6 place-items-center rounded-[5px] transition-colors ${viewport === 'phone' ? 'bg-surface text-fg shadow-card' : 'text-faint hover:text-fg'}`}
                    >
                      <Smartphone className="size-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setReloadKey((current) => current + 1)}
                      aria-label="Reload the preview"
                      title="Reload preview"
                      className="grid size-6 place-items-center rounded-[5px] text-faint transition-colors hover:text-fg"
                    >
                      <RotateCw className="size-3" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPanel('preview')}
                    className={`inline-flex h-7 items-center gap-1 rounded-tile px-2 text-[11.5px] transition-colors ${panel === 'preview' ? 'bg-surface text-fg shadow-card' : 'text-muted hover:text-fg'}`}
                  >
                    <Play className="size-3" />
                    Preview
                  </button>
                  <button
                    type="button"
                    onClick={() => setPanel('code')}
                    className={`inline-flex h-7 items-center gap-1 rounded-tile px-2 text-[11.5px] transition-colors ${panel === 'code' ? 'bg-surface text-fg shadow-card' : 'text-muted hover:text-fg'}`}
                  >
                    <Code2 className="size-3" />
                    Code
                  </button>
                  <button
                    type="button"
                    onClick={download}
                    className="inline-flex h-7 items-center gap-1 rounded-tile px-2 text-[11.5px] text-muted transition-colors hover:text-fg"
                  >
                    <Download className="size-3" />
                    Download
                  </button>
                </>
              ) : null}
            </div>
          </div>

          {build && page ? (
            <>
              {pages.length > 1 ? (
                <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-line px-3 py-1.5">
                  {pages.map((item) => (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() => setSelectedPage(item.name)}
                      className={`shrink-0 rounded-tile px-2.5 py-1 font-mono text-[11px] transition-colors ${
                        item.name === page.name ? 'bg-surface text-fg shadow-card' : 'text-faint hover:text-fg'
                      }`}
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex shrink-0 items-center gap-2 border-b border-line px-4 py-1.5 font-mono text-[11px] text-faint">
                  <FileCode2 className="size-3.5" />
                  {page.name}
                </div>
              )}
              {previewError ? (
                <div
                  role="alert"
                  aria-live="polite"
                  className="flex shrink-0 items-start gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-[11.5px] leading-relaxed text-amber-800"
                >
                  <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">Preview runtime</span> {previewError}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPreviewError('')}
                    aria-label="Dismiss preview error"
                    className="grid size-5 shrink-0 place-items-center rounded text-amber-800/70 hover:bg-amber-500/15 hover:text-amber-900"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ) : null}
              <div className="min-h-0 flex-1 overflow-auto bg-[#e8edf4]">
                {panel === 'preview' ? (
                  <div className="mx-auto h-full w-full" style={previewWidth ? { maxWidth: previewWidth } : undefined}>
                    <iframe
                      ref={iframeRef}
                      key={`${build.asOf}-${page.name}-${reloadKey}`}
                      title={`Preview of ${build.title} — ${page.name}`}
                      srcDoc={page.html}
                      sandbox="allow-scripts allow-forms allow-pointer-lock allow-popups allow-modals allow-downloads"
                      referrerPolicy="no-referrer"
                      className="h-full min-h-[420px] w-full border-0 bg-white"
                    />
                  </div>
                ) : (
                  <pre className="scrollbar-thin h-full min-h-[420px] w-full overflow-auto bg-[#0d1117] p-4 font-mono text-[11.5px] leading-relaxed text-[#d6deeb]">
                    <code>{page.html}</code>
                  </pre>
                )}
              </div>
              <div className="shrink-0 border-t border-line bg-bg px-4 py-2 text-[11px] leading-relaxed text-faint">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="inline-flex items-center gap-1">
                    <Check className="size-3 text-emerald-500" />
                    {verification ? `${passed}/${totalChecks} page checks passed` : 'Page checks not available'}
                  </span>
                  {build.models.length ? <span>Models used: {build.models.join(', ')}</span> : null}
                  <span>Preview runs in a sandbox; downloads are the generated HTML.</span>
                </div>
                {verification?.checks.length ? (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-muted hover:text-fg">Show all checks</summary>
                    <ul className="mt-1.5 grid gap-1 sm:grid-cols-2">
                      {verification.checks.slice(0, 12).map((check) => (
                        <li key={check.id} className="flex items-start gap-1.5">
                          {check.status === 'pass' ? (
                            <Check className="mt-0.5 size-3 shrink-0 text-emerald-500" />
                          ) : check.status === 'warn' ? (
                            <AlertCircle className="mt-0.5 size-3 shrink-0 text-amber-500" />
                          ) : (
                            <AlertCircle className="mt-0.5 size-3 shrink-0 text-red-500" />
                          )}
                          <span>{check.label}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
              <span className="grid size-12 place-items-center rounded-tile border border-line bg-surface text-faint">
                <Code2 className="size-5" />
              </span>
              <p className="mt-4 font-display text-[20px] font-medium">Your project appears here.</p>
              <p className="mt-1.5 max-w-[380px] text-[13px] leading-relaxed text-muted">
                Ask Buffy Code for a page, tool or game. The generated files, live preview and page checks will appear in this workspace.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-1.5 text-[11px] text-faint">
                <span className="rounded-full border border-line bg-surface px-2.5 py-1">HTML + CSS + JS</span>
                <span className="rounded-full border border-line bg-surface px-2.5 py-1">Sandboxed preview</span>
                <span className="rounded-full border border-line bg-surface px-2.5 py-1">Follow-up edits</span>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
