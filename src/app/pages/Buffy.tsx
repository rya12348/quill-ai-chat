import { ArrowUp, Bot, ExternalLink, Paperclip, RotateCcw, Square, Terminal, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Markdown } from '../components/Markdown'
import { Mark } from '../components/Shell'

type BuffyFile = { name: string; text: string }
type Message = { role: 'user' | 'assistant'; content: string; files?: BuffyFile[] }
type BridgeStatus = {
  ready: boolean
  configured: boolean
  mode?: 'bridge' | 'free'
  reason?: string
  model?: string
  mock?: boolean
}

const STORAGE_KEY = 'buffy:chat:v1'
const MAX_ATTACHMENTS = 4
const MAX_ATTACHMENT_CHARS = 12_000
const MAX_ATTACHMENT_FILE_CHARS = 8_000
const MAX_ATTACHMENT_BYTES = 128_000
const TEXT_FILE_ACCEPT =
  'text/*,.md,.markdown,.txt,.json,.csv,.tsv,.js,.jsx,.ts,.tsx,.css,.html,.py,.go,.rs,.java,.c,.cpp,.h,.sh,.yml,.yaml,.toml,.ini,.log,.sql,.rb,.php,.swift,.kt,.xml,.svg'
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
      .map((value): Message | null => {
        if (!value || typeof value !== 'object') return null
        const message = value as { role?: unknown; content?: unknown; files?: unknown }
        if ((message.role !== 'user' && message.role !== 'assistant') || typeof message.content !== 'string') return null
        const files = Array.isArray(message.files)
          ? message.files
              .filter(
                (file): file is BuffyFile =>
                  Boolean(file) &&
                  typeof file === 'object' &&
                  typeof (file as BuffyFile).name === 'string' &&
                  typeof (file as BuffyFile).text === 'string',
              )
              .slice(0, MAX_ATTACHMENTS)
          : []
        return { role: message.role, content: message.content, ...(files.length ? { files } : {}) }
      })
      .filter((message): message is Message => message !== null)
      .slice(-60)
  } catch {
    return []
  }
}

/** File text is sent with the turn but kept out of the visible bubble. */
function filesPrompt(files: BuffyFile[]): string {
  return [
    'The person attached the following file contents:',
    ...files.map((file) => `--- ${file.name} ---\n${file.text}`),
  ].join('\n\n')
}

function messageForModel(message: Message) {
  return {
    role: message.role,
    content: message.files?.length ? `${message.content}\n\n${filesPrompt(message.files)}` : message.content,
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
  const [attachments, setAttachments] = useState<BuffyFile[]>([])
  const [fileError, setFileError] = useState('')
  const [pending, setPending] = useState(false)
  const [activity, setActivity] = useState('')
  const [status, setStatus] = useState<BridgeStatus | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const freeMode = status?.mode === 'free'
  const suggestions = freeMode ? FREE_SUGGESTIONS : SUGGESTIONS
  const abortRef = useRef<AbortController | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

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

  const addFiles = async (incoming: File[]) => {
    if (!incoming.length) return
    setFileError('')
    const slots = MAX_ATTACHMENTS - attachments.length
    if (slots <= 0) {
      setFileError(`Attach up to ${MAX_ATTACHMENTS} files.`)
      return
    }
    if (incoming.length > slots) setFileError(`Attach up to ${MAX_ATTACHMENTS} files; the rest were skipped.`)
    const next: BuffyFile[] = []
    let total = attachments.reduce((sum, file) => sum + file.text.length, 0)
    for (const file of incoming.slice(0, slots)) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        setFileError(`${file.name || 'That file'} is too large. Attach a text file under 128 KB.`)
        continue
      }
      const text = await file.text().catch(() => '')
      if (!text.trim()) {
        setFileError(`${file.name || 'That file'} is empty or is not readable text.`)
        continue
      }
      if (text.includes('\u0000')) {
        setFileError(`${file.name || 'That file'} is not a text or code file.`)
        continue
      }
      const clipped = text.slice(0, MAX_ATTACHMENT_FILE_CHARS)
      if (clipped.length < text.length) {
        setFileError(`${file.name || 'That file'} was clipped to ${MAX_ATTACHMENT_FILE_CHARS.toLocaleString()} characters.`)
      }
      if (total + clipped.length > MAX_ATTACHMENT_CHARS) {
        setFileError(`Attachments can be up to ${MAX_ATTACHMENT_CHARS.toLocaleString()} characters at a time.`)
        break
      }
      next.push({ name: file.name || 'pasted.txt', text: clipped })
      total += clipped.length
    }
    if (next.length) setAttachments((current) => [...current, ...next])
  }

  const send = async (raw: string) => {
    const content = raw.trim()
    const files = attachments
    if ((!content && !files.length) || pending || !status?.ready) return
    const displayContent = content || 'Review the attached file(s).'
    const controller = new AbortController()
    abortRef.current = controller
    setInput('')
    setAttachments([])
    setFileError('')
    setPending(true)
    setActivity('Buffy is thinking…')
    setMessages((current) => [
      ...current,
      { role: 'user', content: displayContent, ...(files.length ? { files } : {}) },
      { role: 'assistant', content: '' },
    ])
    const outgoing: Message[] = [
      ...messages,
      { role: 'user', content: displayContent, ...(files.length ? { files } : {}) },
    ]

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
        body: JSON.stringify({ messages: outgoing.map(messageForModel) }),
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
    setAttachments([])
    setFileError('')
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
            {freeMode ? 'Free hosted models · no project setup needed' : 'The Codebuff coding agent, locally bridged'}
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
                  <p className="mt-1 text-[14px] text-muted">
                    {freeMode ? 'Free chat with Buffy. No project setup needed.' : 'The Codebuff agent when credits are available, with a free fallback lane.'}
                  </p>
                  <p className="mt-2 text-[12px] text-faint">Attach text or code with the paperclip, or paste it into the message.</p>
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
                      {message.files?.length ? (
                        <div className="mt-2 flex flex-wrap gap-1.5 border-t border-line pt-2">
                          {message.files.map((file, fileIndex) => (
                            <span
                              key={`${file.name}-${fileIndex}`}
                              className="inline-flex max-w-full items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[11.5px] text-muted"
                            >
                              <Paperclip className="size-3 shrink-0 text-faint" />
                              <span className="truncate">{file.name}</span>
                            </span>
                          ))}
                        </div>
                      ) : null}
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
        {(attachments.length > 0 || fileError) && (
          <div className="mx-auto mb-2 w-full max-w-[760px]">
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {attachments.map((file, index) => (
                  <span
                    key={`${file.name}-${index}`}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[11.5px] text-muted"
                  >
                    <Paperclip className="size-3 shrink-0 text-faint" />
                    <span className="truncate">{file.name}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${file.name}`}
                      onClick={() => setAttachments((current) => current.filter((_, at) => at !== index))}
                      className="grid size-4 place-items-center rounded-full text-faint transition-colors hover:bg-surface-2 hover:text-fg"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {fileError && (
              <p role="alert" className="mt-1.5 text-[11.5px] leading-relaxed text-warning">
                {fileError}
              </p>
            )}
          </div>
        )}
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void send(input)
          }}
          className="mx-auto flex w-full max-w-[760px] items-end gap-2 rounded-card border border-line bg-surface p-2 shadow-card focus-within:border-accent/50"
        >
          <input
            ref={fileRef}
            type="file"
            multiple
            accept={TEXT_FILE_ACCEPT}
            className="hidden"
            onChange={(event) => {
              const files = Array.from(event.target.files ?? [])
              event.target.value = ''
              void addFiles(files)
            }}
          />
          <button
            type="button"
            aria-label="Attach text or code"
            title="Attach text or code"
            disabled={pending || !status?.ready}
            onClick={() => fileRef.current?.click()}
            className="grid size-9 shrink-0 place-items-center rounded-control text-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:cursor-not-allowed disabled:opacity-30"
          >
            <Paperclip className="size-4" />
          </button>
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
            onPaste={(event) => {
              const pasted = Array.from(event.clipboardData.files)
              if (pasted.length) {
                event.preventDefault()
                void addFiles(pasted)
              }
            }}
            rows={1}
            placeholder={status?.ready ? 'Ask anything — paste or attach text…' : 'Buffy is unavailable'}
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
              disabled={!status?.ready || (!input.trim() && !attachments.length)}
              aria-label="Send message"
              className="grid size-9 shrink-0 place-items-center rounded-control bg-fg text-bg transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ArrowUp className="size-4" />
            </button>
          )}
        </form>
        <p className="mx-auto mt-1.5 w-full max-w-[760px] text-[10.5px] text-faint">
          {freeMode ? 'Buffy · free chat · no project or tools required' : 'Local bridge · Codebuff when available · free fallback otherwise'}
        </p>
      </div>

    </main>
  )
}
