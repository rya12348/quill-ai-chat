import { Brain, Check, ChevronDown, Copy, Download, ExternalLink, FileSpreadsheet, FileText, Globe2, Hammer, Layers, Link2, Maximize2, RefreshCw, Shield, ShieldAlert, ShieldCheck, ShieldX, ThumbsDown, ThumbsUp, Users, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import type { AnalysisInfo, BuildInfo, CanvasInfo, FeedbackRating, MessageAttachment, ProofInfo, ResearchInfo, Source, TeamInfo } from '../../shared/types'
import { cx } from '../lib/cx'
import { Markdown } from './Markdown'
import { Mark } from './Shell'

const fileSize = (bytes: number) => (bytes < 1_000 ? `${bytes} B` : bytes < 1_000_000 ? `${Math.round(bytes / 1_000)} KB` : `${(bytes / 1_000_000).toFixed(1)} MB`)

export function UserMessage({ content, attachments }: { content: string; attachments?: MessageAttachment[] }) {
  const images = (attachments ?? []).filter((attachment) => attachment.kind === 'image' && attachment.url)
  const files = (attachments ?? []).filter((attachment) => attachment.kind === 'text')
  return (
    <div className="flex justify-end">
      <div className="flex min-w-0 max-w-[78%] flex-col items-end gap-2">
        {images.length > 0 && (
          <div className="flex flex-wrap justify-end gap-1.5">
            {images.map((attachment) => (
              <img
                key={attachment.id}
                src={attachment.url}
                alt={attachment.name}
                title={attachment.name}
                loading="lazy"
                className="max-h-56 max-w-[280px] rounded-[16px] border border-line bg-surface-2 object-contain"
              />
            ))}
          </div>
        )}
        {files.length > 0 && (
          <div className="flex flex-wrap justify-end gap-1.5">
            {files.map((attachment) => (
              <span key={attachment.id} className="inline-flex max-w-[260px] items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-[12.5px] text-muted" title={attachment.name}>
                <FileText className="size-3.5 shrink-0" />
                <span className="truncate">{attachment.name}</span>
                <span className="shrink-0 text-faint">{fileSize(attachment.size)}</span>
              </span>
            ))}
          </div>
        )}
        {content.trim() && (
          <div className="whitespace-pre-wrap break-words rounded-bubble rounded-br-[8px] bg-surface-2 px-4 py-2.5 text-[15px] leading-[1.55]">{content}</div>
        )}
      </div>
    </div>
  )
}

function Thoughts({ text, ms, live }: { text: string; ms?: number; live: boolean }) {
  const [open, setOpen] = useState(live)
  const body = useRef<HTMLDivElement>(null)
  useEffect(() => {
    setOpen(live)
  }, [live])
  useEffect(() => {
    if (live && open && body.current) body.current.scrollTop = body.current.scrollHeight
  }, [text, live, open])
  const label = live ? 'Thinking…' : ms !== undefined ? `Thought for ${ms < 1000 ? '<1s' : `${Math.round(ms / 1000)}s`}` : 'Thoughts'
  return (
    <div className="mb-2 rounded-[12px] border border-line bg-surface-2/60">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] font-medium text-muted transition-colors hover:text-fg"
      >
        <Brain className="size-3.5 shrink-0" />
        <span>{label}</span>
        {live && (
          <span className="thinking inline-flex items-center gap-0.5" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        )}
        <ChevronDown className={cx('ml-auto size-3.5 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div ref={body} className="scrollbar-thin max-h-60 overflow-y-auto whitespace-pre-wrap border-t border-line px-3 py-2 text-[12.5px] leading-relaxed text-muted">
          {text}
        </div>
      )}
    </div>
  )
}

function Progress({ statusLog, statusText }: { statusLog?: string[]; statusText?: string | null }) {
  const steps = statusLog?.length ? statusLog : statusText ? [statusText] : []
  if (!steps.length) {
    return (
      <div className="flex min-h-[24px] items-center gap-2.5">
        <span className="thinking inline-flex h-[24px] items-center gap-1" aria-label="Thinking">
          <span />
          <span />
          <span />
        </span>
      </div>
    )
  }
  return (
    <div className="space-y-1.5 py-1" aria-live="polite">
      {steps.map((step, index) => {
        const active = index === steps.length - 1
        return (
          <div key={`${index}-${step}`} className="flex items-center gap-2 text-[12.5px]">
            {active ? (
              <span className="thinking inline-flex items-center gap-0.5" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            ) : (
              <Check className="size-3.5 shrink-0 text-accent" />
            )}
            <span className={active ? 'text-muted' : 'text-faint'}>{step}</span>
          </div>
        )
      })}
    </div>
  )
}

function normalizeUrl(raw: string): string {
  try {
    const url = new URL(raw)
    url.hash = ''
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|ref$|source$|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key)
    }
    return `${url.hostname.replace(/^www\./, '')}${url.pathname.replace(/\/$/, '')}${url.search}`.toLowerCase()
  } catch {
    return raw.toLowerCase()
  }
}

function citedUrls(content: string): string[] {
  const urls = new Set<string>()
  for (const match of content.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)) urls.add(match[1]!)
  return [...urls]
}

function Sources({ sources, unverified }: { sources?: Source[]; unverified?: number }) {
  const [open, setOpen] = useState(false)
  const unique = (sources ?? []).filter((source, index, all) => all.findIndex((item) => item.url === source.url) === index)
  if (!unique.length) return null
  return (
    <div className="mt-3 rounded-[12px] border border-line bg-surface-2/40">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] font-medium text-muted transition-colors hover:text-fg"
      >
        <Link2 className="size-3.5 shrink-0" />
        <span>Sources</span>
        <span className="rounded-full bg-surface px-1.5 py-0.5 text-[11px] text-faint">{unique.length}</span>
        <ChevronDown className={cx('ml-auto size-3.5 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>
      {unverified ? <p className="border-t border-line px-3 py-2 text-[11.5px] leading-relaxed text-warning">Some links in this answer were not in the retrieved sources. Check them before relying on them.</p> : null}
      {open && (
        <ul className="border-t border-line">
          {unique.map((source) => {
            let host = source.url
            try {
              host = new URL(source.url).hostname.replace(/^www\./, '')
            } catch {
              /* keep the raw URL */
            }
            return (
              <li key={source.url} className="border-b border-line last:border-0">
                <a href={source.url} target="_blank" rel="noreferrer" className="group/source block px-3 py-2.5 transition-colors hover:bg-surface-2/60">
                  <span className="flex items-start gap-2 text-[12.5px] font-medium leading-snug text-fg">
                    <span className="min-w-0 flex-1">{source.title}</span>
                    <ExternalLink className="mt-0.5 size-3 shrink-0 text-faint transition-colors group-hover/source:text-fg" />
                  </span>
                  <span className="mt-0.5 block text-[11.5px] text-faint">{host}</span>
                  {source.snippet && <span className="mt-1 line-clamp-2 block text-[12px] leading-relaxed text-muted">{source.snippet}</span>}
                </a>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function TeamNote({ team }: { team: TeamInfo }) {
  const confidence = team.confidence === 'high' ? 'High confidence' : team.confidence === 'medium' ? 'Medium confidence' : 'Low confidence'
  const label = team.verified ? `Team verified · ${confidence}` : team.reviewed ? `Team checked · ${confidence}` : team.drafts > 1 ? 'Team merged · review unavailable' : 'Team fallback · one draft'
  const count = `${team.models.length} ${team.models.length === 1 ? 'model' : 'models'}`
  return (
    <p className="mt-2 inline-flex max-w-full items-center gap-1.5 text-[11.5px] leading-none text-faint" title={`Team: ${team.models.join(' · ')}`}>
      <Users className="size-3.5 shrink-0" />
      <span className="truncate">{label}</span>
      <span aria-hidden>·</span>
      <span className="shrink-0">{count}</span>
    </p>
  )
}

function ResearchNote({ research, sources, content }: { research: ResearchInfo; sources?: Source[]; content: string }) {
  const [open, setOpen] = useState(false)
  const sourceByUrl = new Map((sources ?? []).map((source) => [source.url, source]))
  const ordered = research.sourceOrder
    .map((url) => sourceByUrl.get(url))
    .filter((source): source is Source => Boolean(source))
  const shown = ordered.length ? ordered : (sources ?? [])
  const supported = research.claims.filter((claim) => claim.status === 'supported').length
  const label =
    research.status === 'verified'
      ? `Research · ${supported}/${research.claims.length} claims supported`
      : research.status === 'warning'
        ? `Research · checked with warnings${research.reason ? ` · ${research.reason}` : ''}`
        : research.status === 'failed'
          ? `Research · failed${research.reason ? ` · ${research.reason}` : ''}`
          : `Research · unverified${research.reason ? ` · ${research.reason}` : ''}`
  const Icon = research.status === 'verified' ? ShieldCheck : research.status === 'failed' ? ShieldX : research.status === 'warning' ? ShieldAlert : Shield
  const tone =
    research.status === 'verified'
      ? 'text-accent'
      : research.status === 'failed'
        ? 'text-danger'
        : research.status === 'warning'
          ? 'text-warning'
          : 'text-faint'
  const sourceLabel = (url: string) => {
    const index = research.sourceOrder.indexOf(url)
    let host = url
    try {
      host = new URL(url).hostname.replace(/^www\./, '')
    } catch {
      /* keep the raw URL */
    }
    return `${index >= 0 ? `[${index + 1}] ` : ''}${host}`
  }
  const download = () => {
    const lines = [
      '# Research report',
      '',
      content,
      '',
      '## Sources',
      ...shown.map((source, index) => `${index + 1}. [${source.title}](${source.url})${source.publishedAt ? ` — ${new Date(source.publishedAt).toLocaleDateString()}` : ''}`),
      '',
      `Status: ${research.status}${research.reason ? ` (${research.reason})` : ''}`,
      `Checked: ${new Date(research.asOf).toLocaleDateString()}`,
      `Models: ${research.models.join(', ') || 'not recorded'}`,
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'research-report.md'
    link.click()
    URL.revokeObjectURL(url)
  }
  return (
    <div className="mt-2 rounded-[12px] border border-line bg-surface-2/40">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11.5px] font-medium text-muted transition-colors hover:text-fg"
      >
        <Icon className={`size-3.5 shrink-0 ${tone}`} />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <span className="hidden shrink-0 text-[11px] text-faint sm:inline">{research.counts.sources} sources</span>
        <ChevronDown className={cx('size-3.5 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="border-t border-line px-3 py-2.5">
          {research.reason && <p className="mb-2 text-[11.5px] leading-relaxed text-faint">{research.reason}</p>}
          <div className="space-y-2">
            {research.claims.length ? research.claims.map((claim) => (
              <div key={claim.id} className="flex items-start gap-2 text-[11.5px] leading-relaxed">
                <span
                  aria-hidden="true"
                  className={cx(
                    'mt-1 size-1.5 shrink-0 rounded-full',
                    claim.status === 'supported' ? 'bg-accent' : claim.status === 'single-source' ? 'bg-warning' : 'bg-danger',
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-muted">{claim.text}</p>
                  <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1">
                    {claim.sourceUrls.map((url) => (
                      <a key={url} href={url} target="_blank" rel="noreferrer" className="text-[10.5px] text-faint underline underline-offset-2 hover:text-fg">
                        {sourceLabel(url)}
                      </a>
                    ))}
                    <span className="text-[10px] uppercase tracking-wide text-faint">
                      {claim.status === 'single-source' ? 'single source' : claim.status}
                    </span>
                  </div>
                </div>
              </div>
            )) : (
              <p className="text-[11.5px] leading-relaxed text-faint">No cited key findings were extracted, so this report is not verified.</p>
            )}
          </div>
          <div className="mt-3 border-t border-line pt-2">
            <p className="text-[10px] uppercase tracking-wide text-faint">Sources opened</p>
            <ol className="mt-1 space-y-1">
              {shown.map((source, index) => (
                <li key={`${source.url}-${index}`} className="flex items-start gap-1.5 text-[11px] leading-relaxed">
                  <span className="shrink-0 text-faint">{index + 1}.</span>
                  <a href={source.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-muted underline underline-offset-2 hover:text-fg">
                    {source.title}
                  </a>
                  {source.publishedAt ? <span className="shrink-0 text-faint">{new Date(source.publishedAt).toLocaleDateString()}</span> : null}
                </li>
              ))}
            </ol>
          </div>
          <p className="mt-2 text-[10.5px] leading-relaxed text-faint">
            {research.models.length ? `${research.models.join(' · ')} · ` : ''}
            checked {new Date(research.asOf).toLocaleDateString()}
            {research.queries.length ? ` · ${research.queries.length} searches` : ''}
          </p>
          <button
            type="button"
            onClick={download}
            className="mt-2 inline-flex items-center gap-1.5 rounded-[8px] border border-line bg-surface px-2.5 py-1.5 text-[11px] font-medium text-muted transition-colors hover:text-fg"
          >
            <Download className="size-3" />
            Download .md
          </button>
        </div>
      )}
    </div>
  )
}

function BuildNote({ build }: { build: BuildInfo }) {
  const [open, setOpen] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const live = build.kind === 'embed' && Boolean(build.proxyUrl)
  const sourceHost = (() => {
    try {
      return new URL(build.sourceUrl ?? '').hostname.replace(/^www\./, '')
    } catch {
      return 'live site'
    }
  })()
  useEffect(() => {
    if (!expanded) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpanded(false)
    }
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [expanded])
  const download = () => {
    const blob = new Blob([build.html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${build.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'build'}.html`
    link.click()
    URL.revokeObjectURL(url)
  }
  const preview = (className: string) =>
    live ? (
      <iframe
        src={build.proxyUrl}
        sandbox="allow-scripts allow-popups allow-modals allow-downloads"
        title={`Live preview of ${sourceHost}`}
        className={className}
        referrerPolicy="no-referrer"
      />
    ) : (
      <iframe
        sandbox="allow-scripts"
        srcDoc={build.html}
        title={`Preview of ${build.title}`}
        className={className}
      />
    )
  return (
    <>
      <div className="mt-2 overflow-hidden rounded-[12px] border border-line bg-surface-2/40">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11.5px] font-medium text-muted transition-colors hover:text-fg"
        >
          {live ? <Globe2 className="size-3.5 shrink-0 text-accent" /> : <Hammer className="size-3.5 shrink-0 text-accent" />}
          <span className="min-w-0 flex-1 truncate">{live ? `Live site · ${sourceHost}` : `Build · ${build.title}`}</span>
          <span className="hidden shrink-0 text-[11px] text-faint sm:inline">{live ? 'live proxy' : 'sandboxed preview'}</span>
          <ChevronDown className={cx('size-3.5 shrink-0 transition-transform', open && 'rotate-180')} />
        </button>
        {open && (
          <div className="border-t border-line p-2.5">
            {preview('h-72 w-full rounded-[8px] border border-line bg-white')}
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
              {live ? (
                build.sourceUrl ? (
                  <a
                    href={build.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-[8px] border border-line bg-surface px-2.5 py-1.5 text-[11px] font-medium text-muted transition-colors hover:text-fg"
                  >
                    <ExternalLink className="size-3" />
                    Open original
                  </a>
                ) : null
              ) : (
                <button
                  type="button"
                  onClick={download}
                  className="inline-flex items-center gap-1.5 rounded-[8px] border border-line bg-surface px-2.5 py-1.5 text-[11px] font-medium text-muted transition-colors hover:text-fg"
                >
                  <Download className="size-3" />
                  Download .html
                </button>
              )}
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="inline-flex items-center gap-1.5 rounded-[8px] border border-line bg-surface px-2.5 py-1.5 text-[11px] font-medium text-muted transition-colors hover:text-fg"
              >
                <Maximize2 className="size-3" />
                Expand
              </button>
              <span className="text-[10.5px] text-faint">
                {live ? 'live page · ' : build.models.length ? `${build.models.join(' · ')} · ` : ''}
                {new Date(build.asOf).toLocaleString()}
              </span>
            </div>
            <p className="mt-2 text-[10.5px] leading-relaxed text-faint">
              {live
                ? "This is a live page fetched through Quill's proxy, not a screenshot. Sign-in, payments and some cross-origin features may not work."
                : 'The preview runs with scripts but without access to this app or its cookies. Images may load from the web.'}
            </p>
          </div>
        )}
      </div>
      {expanded && typeof document !== 'undefined'
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-label={live ? `Live preview of ${sourceHost}` : `Preview of ${build.title}`}
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) setExpanded(false)
              }}
              className="fixed inset-0 z-[90] flex flex-col bg-black/75 p-3 md:p-6"
            >
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[16px] border border-line bg-surface shadow-pop">
                <div className="flex items-center gap-2 border-b border-line px-3 py-2">
                  {live ? <Globe2 className="size-4 shrink-0 text-accent" /> : <Hammer className="size-4 shrink-0 text-accent" />}
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">
                    {live ? `Live site · ${sourceHost}` : `Build · ${build.title}`}
                  </span>
                  {live && build.sourceUrl ? (
                    <a
                      href={build.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="hidden items-center gap-1 text-[11px] text-muted hover:text-fg sm:inline-flex"
                    >
                      <ExternalLink className="size-3" />
                      Open original
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setExpanded(false)}
                    aria-label="Close preview"
                    className="grid size-8 shrink-0 place-items-center rounded-tile text-faint transition-colors hover:bg-surface-2 hover:text-fg"
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <div className="min-h-0 flex-1 bg-white">{preview('h-full w-full border-0 bg-white')}</div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}

function AnalysisNote({ analysis, content, onRerun }: { analysis: AnalysisInfo; content: string; onRerun?: () => void }) {
  const [open, setOpen] = useState(false)
  const label =
    analysis.status === 'checking'
      ? 'Analyze · running Python…'
      : analysis.status === 'verified'
        ? `Analyze · Python ran · ${analysis.rows.toLocaleString()} rows`
        : analysis.status === 'warning'
          ? `Analyze · ran without a printed result${analysis.reason ? ` · ${analysis.reason}` : ''}`
          : analysis.status === 'failed'
            ? `Analyze · failed${analysis.reason ? ` · ${analysis.reason}` : ''}`
            : `Analyze · unverified${analysis.reason ? ` · ${analysis.reason}` : ''}`
  const tone = analysis.status === 'verified' ? 'text-accent' : analysis.status === 'failed' ? 'text-danger' : analysis.status === 'warning' ? 'text-warning' : 'text-faint'
  const download = () => {
    const lines = [
      '# Analysis',
      '',
      content,
      '',
      '## Result',
      '```text',
      analysis.stdout || 'No output was printed.',
      '```',
      '',
      '## Python',
      '```python',
      analysis.code,
      '```',
      '',
      `Status: ${analysis.status}${analysis.reason ? ` (${analysis.reason})` : ''}`,
      `Rows: ${analysis.rows} · Columns: ${analysis.columns.length}`,
      `Models: ${analysis.models.join(', ') || 'not recorded'}`,
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'analysis.md'
    link.click()
    URL.revokeObjectURL(url)
  }
  return (
    <div className="mt-2 overflow-hidden rounded-[12px] border border-line bg-surface-2/40">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11.5px] font-medium text-muted transition-colors hover:text-fg"
      >
        <FileSpreadsheet className={`size-3.5 shrink-0 ${tone}`} />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <span className="hidden shrink-0 text-[11px] text-faint sm:inline">
          {analysis.rows.toLocaleString()} rows · {analysis.columns.length} columns
        </span>
        <ChevronDown className={cx('size-3.5 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="border-t border-line px-3 py-2.5">
          {analysis.reason && <p className="mb-2 text-[11.5px] leading-relaxed text-faint">{analysis.reason}</p>}
          {analysis.status === 'checking' && (
            <p className="mb-2 text-[11.5px] leading-relaxed text-faint">The Python is running in a sandboxed browser tab. This reply will update when it finishes.</p>
          )}
          {analysis.chart && (
            <img
              src={analysis.chart}
              alt="Generated analysis chart"
              className="mb-2 max-h-72 w-full rounded-[8px] border border-line bg-white object-contain"
            />
          )}
          {analysis.stdout && (
            <pre className="scrollbar-thin max-h-72 overflow-auto whitespace-pre-wrap rounded-[8px] border border-line bg-surface px-2.5 py-2 font-mono text-[11.5px] leading-relaxed text-muted">{analysis.stdout}</pre>
          )}
          {!analysis.stdout && !analysis.chart && analysis.status !== 'checking' && (
            <p className="text-[11.5px] leading-relaxed text-faint">The code finished without printing a table or drawing a chart.</p>
          )}
          {analysis.error && (
            <p className="mt-2 break-words rounded-[8px] border border-line bg-surface px-2.5 py-2 font-mono text-[11px] leading-relaxed text-danger">{analysis.error}</p>
          )}
          <details className="mt-3 border-t border-line pt-2">
            <summary className="cursor-pointer text-[11px] font-medium text-faint hover:text-fg">Python used</summary>
            <pre className="scrollbar-thin mt-2 max-h-72 overflow-auto whitespace-pre rounded-[8px] border border-line bg-surface px-2.5 py-2 font-mono text-[11px] leading-relaxed text-muted">{analysis.code}</pre>
          </details>
          <p className="mt-2 text-[10.5px] leading-relaxed text-faint">
            {analysis.fileName} · {analysis.rows.toLocaleString()} rows · {analysis.columns.length} columns
            {analysis.models.length ? ` · ${analysis.models.join(' · ')}` : ''}
            {' · '}run {new Date(analysis.asOf).toLocaleString()}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {onRerun && analysis.status !== 'checking' && (
              <button
                type="button"
                onClick={onRerun}
                className="inline-flex items-center gap-1.5 rounded-[8px] border border-line bg-surface px-2.5 py-1.5 text-[11px] font-medium text-muted transition-colors hover:text-fg"
              >
                <RefreshCw className="size-3" />
                Rerun in this browser
              </button>
            )}
            <button
              type="button"
              onClick={download}
              className="inline-flex items-center gap-1.5 rounded-[8px] border border-line bg-surface px-2.5 py-1.5 text-[11px] font-medium text-muted transition-colors hover:text-fg"
            >
              <Download className="size-3" />
              Download .md
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function CanvasNote({ canvas }: { canvas: CanvasInfo }) {
  const [flipped, setFlipped] = useState<Record<number, boolean>>({})
  const [picked, setPicked] = useState<Record<number, number>>({})
  const cards = canvas.cards ?? []
  const questions = canvas.questions ?? []
  const answered = Object.keys(picked).length
  const correct = questions.filter((question, index) => picked[index] === question.answer).length
  const download = () => {
    const lines = [`# ${canvas.title}`, '']
    for (const card of cards) lines.push(`- **${card.front}** — ${card.back}`)
    questions.forEach((question, index) => {
      lines.push(`${index + 1}. ${question.question}`, `   - Answer: ${question.choices[question.answer]}`)
      if (question.explanation) lines.push(`   - ${question.explanation}`)
    })
    lines.push('', `Made by Quill Canvas${canvas.models.length ? ` · ${canvas.models.join(' · ')}` : ''}`)
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${canvas.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'canvas'}.md`
    link.click()
    URL.revokeObjectURL(url)
  }
  return (
    <div className="mt-2 overflow-hidden rounded-[12px] border border-line bg-surface-2/40">
      <div className="flex items-center gap-2 px-3 py-2 text-[11.5px] font-medium text-muted">
        <Layers className="size-3.5 shrink-0 text-accent" />
        <span className="min-w-0 flex-1 truncate">Canvas · {canvas.title}</span>
        <span className="hidden shrink-0 text-[11px] text-faint sm:inline">
          {canvas.kind === 'quiz' ? `${questions.length} questions` : `${cards.length} cards`}
        </span>
      </div>
      <div className="border-t border-line p-3">
        {canvas.kind === 'flashcards' ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {cards.map((card, index) => {
              const open = Boolean(flipped[index])
              return (
                <button
                  key={`${card.front}-${index}`}
                  type="button"
                  aria-pressed={open}
                  onClick={() => setFlipped((current) => ({ ...current, [index]: !current[index] }))}
                  className={cx(
                    'flex min-h-24 flex-col justify-between gap-2 rounded-[10px] border bg-surface px-3 py-2.5 text-left transition-colors',
                    open ? 'border-line-strong' : 'border-line hover:border-line-strong',
                  )}
                >
                  <span className="text-[12.5px] font-medium leading-snug text-fg">{open ? card.back : card.front}</span>
                  <span className="text-[10px] uppercase tracking-wide text-faint">{open ? 'Answer' : 'Tap to flip'}</span>
                </button>
              )
            })}
          </div>
        ) : (
          <ol className="space-y-3">
            {questions.map((question, index) => {
              const choice = picked[index]
              const revealed = choice !== undefined
              return (
                <li key={`${question.question}-${index}`}>
                  <p className="text-[12.5px] font-medium leading-snug text-fg">
                    {index + 1}. {question.question}
                  </p>
                  <div className="mt-1.5 grid gap-1">
                    {question.choices.map((option, optionIndex) => {
                      const isAnswer = optionIndex === question.answer
                      const isChoice = choice === optionIndex
                      return (
                        <button
                          key={`${option}-${optionIndex}`}
                          type="button"
                          disabled={revealed}
                          onClick={() => setPicked((current) => ({ ...current, [index]: optionIndex }))}
                          className={cx(
                            'flex items-center gap-2 rounded-[8px] border px-2.5 py-1.5 text-left text-[12px] transition-colors',
                            !revealed
                              ? 'border-line text-muted hover:border-line-strong hover:text-fg'
                              : isAnswer
                                ? 'border-accent/40 bg-surface-2 text-fg'
                                : isChoice
                                  ? 'border-danger/40 text-danger'
                                  : 'border-line text-faint opacity-70',
                          )}
                        >
                          <span className="min-w-0 flex-1">{option}</span>
                          {revealed && isAnswer && <Check className="size-3.5 shrink-0 text-accent" />}
                          {revealed && isChoice && !isAnswer && <X className="size-3.5 shrink-0" />}
                        </button>
                      )
                    })}
                  </div>
                  {revealed && question.explanation && <p className="mt-1 text-[11px] leading-relaxed text-faint">{question.explanation}</p>}
                </li>
              )
            })}
          </ol>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-2">
          <span className="text-[10.5px] text-faint">
            {canvas.kind === 'quiz'
              ? `${correct}/${questions.length} correct${answered < questions.length ? ` · ${questions.length - answered} to go` : ''}`
              : `${Object.values(flipped).filter(Boolean).length}/${cards.length} flipped`}
          </span>
          <button
            type="button"
            onClick={() => {
              setFlipped({})
              setPicked({})
            }}
            className="ml-auto inline-flex items-center gap-1.5 rounded-[8px] border border-line bg-surface px-2.5 py-1.5 text-[11px] font-medium text-muted transition-colors hover:text-fg"
          >
            <RefreshCw className="size-3" />
            Reset
          </button>
          <button
            type="button"
            onClick={download}
            className="inline-flex items-center gap-1.5 rounded-[8px] border border-line bg-surface px-2.5 py-1.5 text-[11px] font-medium text-muted transition-colors hover:text-fg"
          >
            <Download className="size-3" />
            Download .md
          </button>
        </div>
        <p className="mt-2 text-[10.5px] leading-relaxed text-faint">
          {canvas.models.length ? `${canvas.models.join(' · ')} · ` : ''}
          made {new Date(canvas.asOf).toLocaleString()}
        </p>
      </div>
    </div>
  )
}

function ProofNote({ proof }: { proof: ProofInfo }) {
  const [open, setOpen] = useState(false)
  const critical = proof.checks.filter((item) => item.critical)
  const relevant = critical.length ? critical : proof.checks
  const passed = relevant.filter((item) => item.status === 'pass').length
  const label =
    proof.status === 'checking'
      ? 'Proof · checking code…'
      : proof.status === 'verified'
        ? `Proof · ${passed}/${relevant.length} checks passed`
        : proof.status === 'warning'
          ? 'Proof · checked with warnings'
          : proof.status === 'failed'
            ? `Proof · failed${proof.reason ? ` · ${proof.reason}` : ''}`
            : `Proof · unverified${proof.reason ? ` · ${proof.reason}` : ''}`
  const Icon = proof.status === 'verified' ? ShieldCheck : proof.status === 'failed' ? ShieldX : proof.status === 'warning' ? ShieldAlert : Shield
  const tone =
    proof.status === 'verified'
      ? 'text-accent'
      : proof.status === 'failed'
        ? 'text-danger'
        : proof.status === 'warning'
          ? 'text-warning'
          : 'text-faint'
  return (
    <div className="mt-2 rounded-[12px] border border-line bg-surface-2/40">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11.5px] font-medium text-muted transition-colors hover:text-fg"
      >
        <Icon className={`size-3.5 shrink-0 ${tone}`} />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {proof.mutants ? (
          <span className="hidden shrink-0 text-[11px] text-faint sm:inline">
            {proof.mutants.killed}/{proof.mutants.total} wrong programs rejected
          </span>
        ) : null}
        <ChevronDown className={cx('size-3.5 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="border-t border-line px-3 py-2.5">
          <ul className="space-y-1.5">
            {proof.checks.map((item) => (
              <li key={item.id} className="flex items-start gap-2 text-[11.5px] leading-relaxed">
                <span
                  aria-hidden="true"
                  className={cx(
                    'mt-1 size-1.5 shrink-0 rounded-full',
                    item.status === 'pass' ? 'bg-accent' : item.status === 'fail' ? 'bg-danger' : 'bg-faint',
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className={item.status === 'pass' ? 'text-muted' : item.status === 'fail' ? 'text-danger' : 'text-faint'}>{item.label}</span>
                  {item.critical ? <span className="ml-1.5 text-[10px] uppercase tracking-wide text-faint">critical</span> : null}
                  {item.detail ? <span className="mt-0.5 block text-[11px] leading-relaxed text-faint">{item.detail}</span> : null}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[10.5px] leading-relaxed text-faint">
            {proof.models.length ? `Models: ${proof.models.join(' · ')}` : 'No model recorded.'}
            {proof.attempts > 1 ? ` · ${proof.attempts} attempts` : ''}
          </p>
        </div>
      )}
    </div>
  )
}

export function AssistantMessage({
  content,
  reasoning,
  reasoningMs,
  sources,
  statusText,
  statusLog,
  model,
  team,
  proof,
  research,
  analysis,
  build,
  canvas,
  onRerun,
  messageId,
  feedback,
  onFeedback,
  streaming,
  interrupted,
  onRegenerate,
  error,
  onRetry,
}: {
  content: string
  /** Reasoning the model exposed before its answer. */
  reasoning?: string
  /** How long the model reasoned before the first answer token. */
  reasoningMs?: number
  /** Web results retrieved for this reply. */
  sources?: Source[]
  /** What the free models are doing before the first token arrives. */
  statusText?: string | null
  /** The progress trail, in order. */
  statusLog?: string[]
  /** The model that produced the reply. */
  model?: string
  /** The free team's independent drafts and check, when Team mode produced this reply. */
  team?: TeamInfo
  /** What Proof checked for this reply. */
  proof?: ProofInfo
  /** What Research checked for this reply. */
  research?: ResearchInfo
  /** What the browser ran for this reply. */
  analysis?: AnalysisInfo
  /** The generated page, when Build mode produced this reply. */
  build?: BuildInfo
  /** The generated study set, when Canvas mode produced this reply. */
  canvas?: CanvasInfo
  /** Rerun a saved analysis using the browser-local dataset. */
  onRerun?: () => void
  /** The saved reply id, when feedback is available. */
  messageId?: string
  /** The rating already saved for this reply. */
  feedback?: FeedbackRating
  onFeedback?: (rating: FeedbackRating) => void
  /** Still receiving text: show the caret, hide the actions. */
  streaming?: boolean
  interrupted?: boolean
  onRegenerate?: () => void
  error?: string | null
  onRetry?: () => void
}) {
  const [copied, setCopied] = useState(false)
  const sourceKeys = new Set((sources ?? []).map((source) => normalizeUrl(source.url)))
  const unverified = sources?.length ? citedUrls(content).filter((url) => !sourceKeys.has(normalizeUrl(url))).length : 0
  const [rating, setRating] = useState<FeedbackRating | undefined>(feedback)
  useEffect(() => setRating(feedback), [feedback])
  const rate = (next: FeedbackRating) => {
    setRating(next)
    onFeedback?.(next)
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable */
    }
  }
  const waiting = streaming && !content
  return (
    <div className="group flex gap-3.5">
      <Mark size={26} className="mt-0.5 rounded-[8px]" />
      <div className="min-w-0 flex-1 pt-0.5">
        {reasoning && <Thoughts text={reasoning} ms={reasoningMs} live={Boolean(waiting)} />}
        {waiting ? reasoning ? null : <Progress statusLog={statusLog} statusText={statusText} /> : <Markdown className={cx('prose-chat', streaming && 'streaming')}>{content}</Markdown>}
        {!research && <Sources sources={sources} unverified={unverified} />}
        {!streaming && !error && (build ? <BuildNote build={build} /> : canvas ? <CanvasNote canvas={canvas} /> : analysis ? <AnalysisNote analysis={analysis} content={content} onRerun={onRerun} /> : research ? <ResearchNote research={research} sources={sources} content={content} /> : proof ? <ProofNote proof={proof} /> : team ? <TeamNote team={team} /> : model && (
          <p className="mt-2 text-[11.5px] leading-none text-faint" title={`Answered by ${model}`}>
            Answered by {model}
          </p>
        ))}
        {error && (
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-danger">
            <span>{error}</span>
            {onRetry && (
              <button type="button" onClick={onRetry} className="font-medium underline underline-offset-2 hover:text-fg">
                Try again
              </button>
            )}
          </div>
        )}
        {!streaming && !error && (
          <div className="mt-1 flex h-7 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            {interrupted && <span className="mr-2 text-[12px] text-faint">Stopped</span>}
            {messageId && onFeedback && (
              <>
                <button
                  type="button"
                  onClick={() => rate('up')}
                  aria-label="Helpful"
                  aria-pressed={rating === 'up'}
                  className={cx(
                    'grid size-7 place-items-center rounded-[8px] transition-colors hover:bg-surface-2 hover:text-fg [&_svg]:size-3.5',
                    rating === 'up' ? 'bg-surface-2 text-fg' : 'text-faint',
                  )}
                >
                  <ThumbsUp />
                </button>
                <button
                  type="button"
                  onClick={() => rate('down')}
                  aria-label="Not helpful"
                  aria-pressed={rating === 'down'}
                  className={cx(
                    'grid size-7 place-items-center rounded-[8px] transition-colors hover:bg-surface-2 hover:text-fg [&_svg]:size-3.5',
                    rating === 'down' ? 'bg-surface-2 text-fg' : 'text-faint',
                  )}
                >
                  <ThumbsDown />
                </button>
              </>
            )}
            <button type="button" onClick={copy} aria-label={copied ? 'Copied' : 'Copy'} className="grid size-7 place-items-center rounded-[8px] text-faint transition-colors hover:bg-surface-2 hover:text-fg [&_svg]:size-3.5">
              {copied ? <Check /> : <Copy />}
            </button>
            {onRegenerate && (
              <button type="button" onClick={onRegenerate} aria-label="Regenerate" className="grid size-7 place-items-center rounded-[8px] text-faint transition-colors hover:bg-surface-2 hover:text-fg [&_svg]:size-3.5">
                <RefreshCw />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}