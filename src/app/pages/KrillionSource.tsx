import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { cx } from '../lib/cx'

/**
 * Krillion's shipped client build, read inside Ink.
 *
 * `public/krillion-source/` holds the mirror: the game's chunks, an indented
 * copy of each, the server-rendered pages and the API documents. Everything is
 * static, so this page is a file tree and a viewer — no server work, and no
 * network calls beyond the files themselves.
 */

type Entry = { p: string; s: number; twin: string | null }

const ROOT = '/krillion-source/'

const kib = (size: number) =>
  size > 1_048_576 ? `${(size / 1_048_576).toFixed(1)} MiB` : `${Math.max(1, Math.round(size / 1024))} KiB`

const isCode = (path: string) => /\.(js|css|html|json|md|txt)$/.test(path)

/* ------------------------------------------------------------- highlight */

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;' }
const esc = (text: string) => text.replace(/[&<>]/g, (char) => ESCAPES[char])

// One pass, four alternatives: comments, strings, numbers, keywords. Each
// alternative is escaped and wrapped as it is consumed, so the markup is never
// produced from raw source and no token can escape its span.
const TOKENS =
  /(\/\*[\s\S]*?\*\/|\/\/[^\n]*)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`)|(\b\d[\d_]*(?:\.\d+)?\b)|(\b(?:async|await|break|case|catch|class|const|continue|default|delete|do|else|export|extends|false|finally|for|from|function|if|import|in|instanceof|let|new|null|of|return|static|super|switch|this|throw|true|try|typeof|undefined|var|void|while|yield)\b)/g

function highlight(source: string): string {
  let out = ''
  let last = 0
  for (const match of source.matchAll(TOKENS)) {
    const at = match.index ?? 0
    out += esc(source.slice(last, at))
    const [token] = match
    const kind = match[1] ? 'comment' : match[2] ? 'string' : match[3] ? 'number' : 'keyword'
    out += `<span class="tk-${kind}">${esc(token)}</span>`
    last = at + token.length
  }
  return out + esc(source.slice(last))
}

/* ------------------------------------------------------------------ tree */

type Node = { dirs: Map<string, Node>; files: Entry[] }
const emptyNode = (): Node => ({ dirs: new Map(), files: [] })

function buildTree(files: Entry[]): Node {
  const root = emptyNode()
  for (const file of files) {
    const parts = file.p.split('/')
    let node = root
    for (const part of parts.slice(0, -1)) {
      let child = node.dirs.get(part)
      if (!child) {
        child = emptyNode()
        node.dirs.set(part, child)
      }
      node = child
    }
    node.files.push(file)
  }
  return root
}

function Branch({
  node,
  depth,
  current,
  onOpen,
}: {
  node: Node
  depth: number
  current: string | null
  onOpen: (entry: Entry) => void
}) {
  const dirs = [...node.dirs.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  const files = [...node.files].sort((a, b) => a.p.localeCompare(b.p))
  return (
    <>
      {files.map((file) => (
        <button
          key={file.p}
          type="button"
          onClick={() => onOpen(file)}
          className={cx(
            'flex w-full items-center gap-2 rounded px-2 py-[3px] text-left text-[12px] transition-colors',
            current === file.p ? 'bg-accent/15 text-accent' : 'text-muted hover:bg-surface-2/60 hover:text-fg',
          )}
          style={{ paddingLeft: 8 + depth * 11 }}
          title={file.p}
        >
          <span className="truncate">{file.p.split('/').pop()}</span>
          <span className="ml-auto shrink-0 text-[10px] text-faint">{kib(file.s)}</span>
        </button>
      ))}
      {dirs.map(([name, child]) => (
        <details key={name} open={depth < 2}>
          <summary
            className="flex cursor-pointer items-center gap-1 rounded px-2 py-[3px] text-[11.5px] font-medium text-faint hover:text-fg"
            style={{ paddingLeft: 6 + depth * 11 }}
          >
            <span className="truncate">{name}/</span>
          </summary>
          <Branch node={child} depth={depth + 1} current={current} onOpen={onOpen} />
        </details>
      ))}
    </>
  )
}

/* ------------------------------------------------------------------ page */

export function KrillionSource() {
  const [files, setFiles] = useState<Entry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [entry, setEntry] = useState<Entry | null>(null)
  const [pretty, setPretty] = useState(false)
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const started = useRef(false)

  useEffect(() => {
    fetch(`${ROOT}manifest.json`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((list) => setFiles(list as Entry[]))
      .catch(() => setError('The mirror is not on this build.'))
  }, [])

  const open = useCallback(
    async (next: Entry, asPretty = false) => {
      setEntry(next)
      setPretty(asPretty)
      setLoading(true)
      try {
        const path = asPretty && next.twin ? next.twin : next.p
        const res = await fetch(ROOT + path)
        const body = await res.text()
        setText(res.ok ? body : `Could not read ${path}`)
      } catch {
        setText('Could not read that file.')
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  // The mirror's guide is the useful thing to land on.
  useEffect(() => {
    if (!files || started.current) return
    started.current = true
    const readme = files.find((file) => file.p === 'README.md')
    if (readme) void open(readme)
  }, [files, open])

  const tree = useMemo(() => (files ? buildTree(files) : null), [files])
  const needle = filter.trim().toLowerCase()
  const matches = useMemo(
    () => (needle ? (files ?? []).filter((file) => file.p.toLowerCase().includes(needle)) : []),
    [files, needle],
  )

  const lines = useMemo(() => text.split('\n').length, [text])
  const html = useMemo(() => {
    if (!entry) return ''
    if (!entry.p.endsWith('.js')) return esc(text)
    return highlight(text)
  }, [entry, text])

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden">
      <aside className="flex w-[308px] shrink-0 flex-col border-r border-line bg-bg" aria-label="Files">
        <div className="border-b border-line px-3 py-3">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-faint">Krillion source code</p>
          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="filter files…"
            aria-label="Filter files"
            spellCheck={false}
            className="mt-2 w-full rounded-control border border-line bg-surface px-2.5 py-1.5 font-mono text-[12px] text-fg outline-none placeholder:text-faint focus:border-accent/50"
          />
        </div>
        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto py-2 pr-2">
          {error && <p className="px-3 text-[12px] text-danger">{error}</p>}
          {!files && !error && <p className="px-3 text-[12px] text-faint">loading…</p>}
          {tree && !needle && <Branch node={tree} depth={0} current={entry?.p ?? null} onOpen={(file) => void open(file)} />}
          {needle &&
            matches.map((file) => (
              <button
                key={file.p}
                type="button"
                onClick={() => void open(file)}
                className={cx(
                  'flex w-full items-center gap-2 rounded px-2 py-[3px] text-left text-[12px]',
                  entry?.p === file.p ? 'bg-accent/15 text-accent' : 'text-muted hover:bg-surface-2/60 hover:text-fg',
                )}
              >
                <span className="truncate">{file.p}</span>
              </button>
            ))}
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2">
          <code className="min-w-0 truncate font-mono text-[12.5px] text-accent">{entry?.p ?? '—'}</code>
          {entry && (
            <span className="text-[11.5px] text-faint">
              {kib(entry.s)}
              {text && ` · ${lines.toLocaleString()} lines`}
            </span>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            {entry?.twin && (
              <button
                type="button"
                onClick={() => void open(entry, !pretty)}
                className="rounded-control border border-line px-2.5 py-1 text-[11.5px] text-muted transition-colors hover:border-accent/50 hover:text-fg"
              >
                {pretty ? 'minified' : 'pretty'}
              </button>
            )}
            {entry && (
              <a
                href={ROOT + entry.p}
                target="_blank"
                rel="noreferrer"
                className="rounded-control border border-line px-2.5 py-1 text-[11.5px] text-muted transition-colors hover:border-accent/50 hover:text-fg"
              >
                raw
              </a>
            )}
          </div>
        </div>

        <div className="scrollbar-thin min-h-0 flex-1 overflow-auto bg-surface/40">
          {loading && !text && <p className="p-4 text-[12px] text-faint">loading…</p>}
          {entry && !isCode(entry.p) && <p className="p-4 text-[12px] text-faint">This file is not text.</p>}
          {entry && isCode(entry.p) && (
            <div className="flex min-h-full font-mono text-[12px] leading-[1.6]">
              <pre className="shrink-0 select-none border-r border-line/60 px-3 py-3 text-right text-faint" aria-hidden>
                {Array.from({ length: lines }, (_, index) => index + 1).join('\n')}
              </pre>
              <pre
                className={cx('min-w-0 flex-1 px-4 py-3 text-fg', entry.p.endsWith('.js') && !pretty && 'whitespace-pre')}
                style={{ tabSize: 2 }}
                dangerouslySetInnerHTML={{ __html: html }}
              />
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
