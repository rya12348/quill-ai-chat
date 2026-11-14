import { ArrowUp, Bot, ExternalLink, RotateCcw, Square, Terminal } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Markdown } from '../components/Markdown'
import { Mark } from '../components/Shell'

type Message = { role: 'user' | 'assistant'; content: string }
type BridgeStatus = {
  ready: boolean
  configured: boolean
  mode?: 'bridge' | 'free'
  reason?: string
  model?: string
  mock?: boolean
}

const STORAGE_KEY = 'buffy:chat:v1'
const SUGGESTIONS = [
  'What does this project do, and where should I start reading?',
  'Review the browser agent for bugs or fragile assumptions.',
  'Explain the tradeoffs in the current model routing.',
]
const FREE_SUGGESTIONS = [
  'Explain how a transformer works in plain English.',
  'Help me debug a React component that re-renders too often.',
  'Write a short launch plan for a small web app.',
]

function readSaved(): Message[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (message): message is Message =>
          Boolean(message) &&
          typeof message === 'object' &&
          ((message as Message).role === 'user' || (message as Message).role === 'assistant') &&
          typeof (message as Message).content === 'string',
      )
      .slice(-60)
  } catch {
    return []
  }
}

function errorText(value: unknown): string {
  if (!value || typeof value !== 'object') return ''
  const error = (value as { error?: unknown }).error
  if (typeof error === 'string') return error
  if (error && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string') {
    return (error as { message: string }).message
  }
  return ''
}

export function Buffy() {
  const [messages, setMessages] = useState<Message[]>(readSaved)
  const [input, setInput] = useState('')
  const [pending, setPending] = useState(false)
  const [activity, setActivity] = useState('')
  const [status, setStatus] = useState<BridgeStatus | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const freeMode = status?.mode === 'free'
  const suggestions = freeMode ? FREE_SUGGESTIONS : SUGGESTIONS
  const abortRef = useRef<AbortController | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-60)))
    } catch {
      /* private mode can refuse storage; the chat still works for this visit */
    }
  }, [messages])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages, activity])

  useEffect(() => {
    let alive = true
    const check = async () => {
      try {
        const response = await fetch('/api/buffy/status', { headers: { accept: 'application/json' } })
        const body = (await response.json().catch(() => ({}))) as BridgeStatus & { error?: string }
        if (alive) setStatus(response.ok ? body : { ready: false, configured: false, reason: body.reason || body.error })
      } catch {
        if (alive) setStatus({ ready: false, configured: false, reason: 'Ink could not check the local bridge.' })
      } finally {
        if (alive) setStatusLoading(false)
      }
    }
    void check()
    // Recover quickly when the dev server starts or restarts the bridge.
    const timer = window.setInterval(check, 4_000)
    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => () => abortRef.current?.abort(), [])

  const send = async (raw: string) => {
    const content = raw.trim()
    if (!content || pending || !status?.ready) return
    const controller = new AbortController()
    abortRef.current = controller
    setInput('')
    setPending(true)
    setActivity('Buffy is thinking…')
    setMessages((current) => [...current, { role: 'user', content }, { role: 'assistant', content: '' }])

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
      const response = await fetch('/api/buffy/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, { role: 'user', content }].map(({ role, content: text }) => ({ role, content: text })),
        }),
        signal: controller.signal,
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(errorText(body) || 'Buffy could not answer. Is the bridge running?')
      }
      if (!response.body) throw new Error('The bridge returned no response.')

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
              /* ignore malformed progress events */
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
      if (!accumulated) update('Buffy finished without a reply. Try asking again.')
    } catch (error) {
      if (controller.signal.aborted) {
        setMessages((current) => {
          const next = [...current]
          const last = next[next.length - 1]
          if (last?.role === 'assistant' && !last.content) next[next.length - 1] = { ...last, content: 'Stopped.' }
          return next
        })
      } else {
        const message = error instanceof Error ? error.message : 'Buffy could not answer.'
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

  const stop = () => {
    abortRef.current?.abort()
  }

  const reset = () => {
    abortRef.current?.abort()
    setMessages([])
    setActivity('')
    setPending(false)
    setInput('')
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col bg-bg text-fg">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-4 md:px-6">
        <span className="grid size-8 place-items-center rounded-tile bg-fg text-bg" aria-hidden>
          <Bot className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[17px] font-medium leading-tight">Buffy</h1>
          <p className="truncate text-[12.5px] text-faint">
            {freeMode ? 'Free hosted models · no Codebuff credits needed' : 'The Codebuff coding agent, locally bridged'}
          </p>
        </div>
        {status?.ready && (
          <span className="hidden items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[11.5px] text-muted sm:flex">
            <span className={`size-1.5 rounded-full ${freeMode ? 'bg-sky-500' : 'bg-emerald-500'}`} />
            {freeMode ? 'Free lane' : status.mock ? 'Mock bridge' : 'Bridge connected'}
          </span>
        )}
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-8 items-center gap-1.5 rounded-control px-2.5 text-[13px] text-muted transition-colors hover:bg-surface hover:text-fg"
        >
          <RotateCcw className="size-3.5" />
          New
        </button>
      </header>

      <section className="scrollbar-thin flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[760px] flex-1 flex-col px-4 pb-8 pt-6 md:px-6">
          {messages.length === 0 ? (
            <div className="flex flex-1 flex-col justify-center py-10">
              <div className="flex items-center gap-3">
                <Mark size={34} />
                <div>
                  <p className="font-display text-[27px] font-medium leading-tight tracking-[-0.02em]">Talk to Buffy.</p>
                  <p className="mt-1 text-[14px] text-muted">The Codebuff agent when credits are available, with a free fallback lane.</p>
                </div>
              </div>

              {statusLoading ? (
                <p className="mt-8 text-[13px] text-faint">Checking Buffy…</p>
              ) : status?.ready ? (
                <div className="mt-8 grid gap-2">
                  {suggestions.map((suggestion) => (
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
              ) : (
                <div className="mt-8 rounded-card border border-line bg-surface p-4">
                  <p className="flex items-center gap-2 text-[14px] font-medium">
                    <Terminal className="size-4 text-faint" />
                    Start the bridge to chat with Buffy
                  </p>
                  <p className="mt-2 text-[13px] leading-relaxed text-muted">
                    {status?.reason || 'The bridge is not running yet.'}
                  </p>
                  <div className="mt-4 space-y-3 text-[12.5px]">
                    <div>
                      <p className="mb-1.5 text-faint">1. Put your Codebuff API key in .env</p>
                      <pre className="overflow-x-auto rounded-control border border-line bg-bg px-3 py-2 font-mono text-[12px] text-fg">CODEBUFF_API_KEY=cb_…</pre>
                      <a
                        href="https://codebuff.com/api-keys"
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1.5 inline-flex items-center gap-1 text-[12px] text-muted underline underline-offset-2 hover:text-fg"
                      >
                        Create a key <ExternalLink className="size-3" />
                      </a>
                    </div>
                    <div>
                      <p className="mb-1.5 text-faint">2. Start the bridge</p>
                      <pre className="overflow-x-auto rounded-control border border-line bg-bg px-3 py-2 font-mono text-[12px] text-fg">npm run buffy</pre>
                    </div>
                  </div>
                  <p className="mt-3 text-[11.5px] leading-relaxed text-faint">
                    The bridge runs only on 127.0.0.1 and is never exposed by the deployed site.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {!status?.ready && (
                <div className="rounded-card border border-line bg-surface px-4 py-3 text-[13px] leading-relaxed text-muted">
                  <p className="font-medium text-fg">Buffy is offline.</p>
                  <p className="mt-1">{status?.reason || 'Start the local bridge to keep chatting.'}</p>
                  <p className="mt-1.5 text-faint">
                    Run <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11.5px]">npm run buffy</code> and add your Codebuff key to .env.
                  </p>
                </div>
              )}
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
                      <Bot className="size-3.5" />
                    </span>
                    <div className="min-w-0 flex-1 pt-0.5">
                      {message.content ? (
                        <Markdown className="prose-chat text-[14.5px] leading-[1.7]">{message.content}</Markdown>
                      ) : (
                        <p className="text-[13px] text-faint">{activity || 'Thinking…'}</p>
                      )}
                    </div>
                  </div>
                ),
              )}
              {pending && messages[messages.length - 1]?.content ? (
                <p className="pl-10 text-[12.5px] text-faint">{activity || 'Buffy is working…'}</p>
              ) : null}
              <div ref={endRef} />
            </div>
          )}
        </div>
      </section>

      <div className="shrink-0 border-t border-line bg-bg px-4 py-3 md:px-6">
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void send(input)
          }}
          className="mx-auto flex w-full max-w-[760px] items-end gap-2 rounded-card border border-line bg-surface p-2 shadow-card focus-within:border-accent/50"
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
            placeholder={status?.ready ? 'Ask Buffy anything…' : 'Start the bridge to chat with Buffy'}
            disabled={!status?.ready}
            aria-label="Message Buffy"
            className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-[14px] leading-relaxed text-fg placeholder:text-faint focus:outline-none disabled:cursor-not-allowed"
          />
          {pending ? (
            <button
              type="button"
              onClick={stop}
              aria-label="Stop Buffy"
              className="grid size-9 shrink-0 place-items-center rounded-control bg-fg text-bg transition-opacity hover:opacity-85"
            >
              <Square className="size-3.5" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!status?.ready || !input.trim()}
              aria-label="Send message"
              className="grid size-9 shrink-0 place-items-center rounded-control bg-fg text-bg transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ArrowUp className="size-4" />
            </button>
          )}
        </form>
        <p className="mx-auto mt-1.5 w-full max-w-[760px] text-[10.5px] text-faint">
          {freeMode ? 'Buffy · hosted free models · no tools or file access' : 'Local bridge · Codebuff when available · free fallback otherwise'}
        </p>
      </div>

    </main>
  )
}
