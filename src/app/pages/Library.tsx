import { ArrowUpRight, Brain, Copy, Download, FileSpreadsheet, Hammer, Layers, MessageCircle, Pin, Search, Share2, Shuffle } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'

import type { ArtifactKind, ArtifactStatus, ArtifactSummary } from '../../shared/types'
import { ShareDialog } from '../components/ShareDialog'
import { Badge, Spinner, useToast } from '../components/ui'
import { downloadArtifact, useArtifacts, useDuplicateArtifact, usePinArtifact, useReviewSummary } from '../lib/api'
import { cx } from '../lib/cx'

type Filter = 'all' | 'pinned' | ArtifactKind

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'pinned', label: 'Pinned' },
  { id: 'build', label: 'Builds' },
  { id: 'analysis', label: 'Analyses' },
  { id: 'canvas', label: 'Study sets' },
  { id: 'research', label: 'Research' },
]

const KIND_META = {
  build: { label: 'Build', icon: Hammer },
  analysis: { label: 'Analyze', icon: FileSpreadsheet },
  canvas: { label: 'Canvas', icon: Layers },
  research: { label: 'Research', icon: Search },
} satisfies Record<ArtifactKind, { label: string; icon: typeof Hammer }>

const STATUS_LABEL: Record<ArtifactStatus, string> = {
  ready: 'Ready',
  warning: 'Warning',
  checking: 'Running',
  verified: 'Verified',
  failed: 'Failed',
  unverified: 'Unverified',
}

function statusTone(status: ArtifactStatus): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'ready' || status === 'verified') return 'success'
  if (status === 'warning') return 'warning'
  if (status === 'failed') return 'danger'
  return 'neutral'
}

function when(ts: number): string {
  const date = new Date(ts)
  const today = new Date()
  if (date.toDateString() === today.toDateString()) {
    return `Today, ${date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric' })
}

/** The draft a remix opens with; it is meant to be edited before sending. */
function remixText(item: ArtifactSummary): string {
  const subject = `"${item.title}"`
  if (item.kind === 'build') return `Rebuild ${subject} with these changes: `
  if (item.kind === 'research') return `Research ${subject} again, focusing on: `
  if (item.kind === 'canvas') return `Make a new study set based on ${subject}, changing: `
  return `Rerun the analysis ${subject} with: `
}

const ACTION =
  'inline-flex h-7 items-center gap-1 rounded-tile px-1.5 text-[11px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-3.5 [&_svg]:shrink-0'

function ArtifactCard({
  item,
  downloading,
  duplicating,
  pinning,
  onPin,
  onDownload,
  onShare,
  onDuplicate,
  onRemix,
}: {
  item: ArtifactSummary
  downloading: boolean
  duplicating: boolean
  pinning: boolean
  onPin: (item: ArtifactSummary) => void
  onDownload: (item: ArtifactSummary) => void
  onShare: (item: ArtifactSummary) => void
  onDuplicate: (item: ArtifactSummary) => void
  onRemix: (item: ArtifactSummary) => void
}) {
  const meta = KIND_META[item.kind]
  const Icon = meta.icon
  return (
    <article className="flex min-h-[154px] flex-col rounded-card border border-line bg-surface p-4 text-left shadow-[0_1px_1px_rgb(27_26_23/0.03)] transition-[border-color,background-color] hover:border-line-strong hover:bg-surface-2/30">
      <div className="flex items-center gap-2">
        <span className="grid size-7 place-items-center rounded-tile bg-surface-2 text-fg">
          <Icon className="size-3.5" />
        </span>
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-faint">{meta.label}</span>
        <Badge tone={statusTone(item.status)} className="ml-auto h-5 px-1.5 text-[10.5px]">
          {STATUS_LABEL[item.status]}
        </Badge>
        <button
          type="button"
          aria-pressed={Boolean(item.pinned)}
          aria-label={item.pinned ? 'Unpin artifact' : 'Pin artifact'}
          title={item.pinned ? 'Unpin' : 'Pin to the top'}
          disabled={pinning}
          onClick={() => onPin(item)}
          className={cx(
            'grid size-6 shrink-0 place-items-center rounded-tile transition-colors disabled:opacity-40',
            item.pinned ? 'text-fg' : 'text-faint hover:bg-surface-2 hover:text-fg',
          )}
        >
          <Pin className={cx('size-3.5', item.pinned && 'fill-current')} />
        </button>
      </div>
      <Link to={`/c/${item.conversationId}#message-${item.messageId}`} className="group mt-3 block">
        <h2 className="line-clamp-2 text-[14px] font-medium leading-snug text-fg">{item.title}</h2>
        <p className="mt-1 line-clamp-2 text-[11.5px] leading-relaxed text-muted">{item.detail}</p>
      </Link>
      <div className="mt-auto flex items-end justify-between gap-3 pt-3 text-[10.5px] text-faint">
        <span className="min-w-0">
          <span className="flex min-w-0 items-center gap-1.5">
            <MessageCircle className="size-3 shrink-0" />
            <span className="truncate">{item.conversationTitle}</span>
          </span>
          <span className="mt-0.5 block">{when(item.createdAt)}</span>
        </span>
        <Link
          to={`/c/${item.conversationId}#message-${item.messageId}`}
          aria-label={`Open the chat for ${item.title}`}
          className="grid size-6 shrink-0 place-items-center rounded-tile text-faint transition-colors hover:bg-surface-2 hover:text-fg"
        >
          <ArrowUpRight className="size-4" />
        </Link>
      </div>
      <div className="-mx-1 mt-2 flex flex-wrap items-center gap-0.5 border-t border-line pt-2">
        <button type="button" className={ACTION} disabled={downloading} onClick={() => onDownload(item)}>
          <Download /> {downloading ? 'Saving…' : 'Download'}
        </button>
        <button type="button" className={ACTION} onClick={() => onShare(item)}>
          <Share2 /> Share
        </button>
        <button type="button" className={ACTION} disabled={duplicating} onClick={() => onDuplicate(item)}>
          <Copy /> {duplicating ? 'Copying…' : 'Duplicate'}
        </button>
        <button type="button" className={ACTION} onClick={() => onRemix(item)}>
          <Shuffle /> Remix
        </button>
      </div>
    </article>
  )
}

export function Library() {
  const { data, isLoading, error, refetch } = useArtifacts()
  const { data: review } = useReviewSummary()
  const [filter, setFilter] = useState<Filter>('all')
  const [shareFor, setShareFor] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)
  const toast = useToast()
  const navigate = useNavigate()
  const pin = usePinArtifact()
  const duplicate = useDuplicateArtifact()
  const items = data?.items ?? []
  const filtered =
    filter === 'all' ? items : filter === 'pinned' ? items.filter((item) => item.pinned) : items.filter((item) => item.kind === filter)
  const count = (id: Filter) =>
    id === 'all' ? items.length : id === 'pinned' ? items.filter((item) => item.pinned).length : items.filter((item) => item.kind === id).length

  const togglePin = (item: ArtifactSummary) => {
    pin.mutate(
      { id: item.messageId, pinned: !item.pinned },
      {
        onSuccess: () => toast(item.pinned ? 'Unpinned' : 'Pinned to the top'),
        onError: () => toast('Could not change this pin', 'danger'),
      },
    )
  }

  const download = async (item: ArtifactSummary) => {
    setDownloading(item.messageId)
    try {
      toast(`Downloaded ${await downloadArtifact(item.messageId)}`)
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : 'Could not download this artifact', 'danger')
    } finally {
      setDownloading(null)
    }
  }

  const copy = (item: ArtifactSummary) => {
    duplicate.mutate(item.messageId, {
      onSuccess: ({ conversationId }) => {
        toast('Duplicated into a new chat')
        navigate(`/c/${conversationId}`)
      },
      onError: () => toast('Could not duplicate this artifact', 'danger'),
    })
  }

  return (
    <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[920px] px-4 pb-14 pt-8 md:px-6 md:pt-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">Library</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[28px] font-semibold tracking-[-0.02em]">Artifacts</h1>
            <p className="mt-1 max-w-[480px] text-[13px] leading-relaxed text-muted">
              Pages, spreadsheet analyses, study sets and research reports saved alongside your chats.
            </p>
          </div>
          {items.length > 0 && <span className="text-[11.5px] tabular-nums text-faint">{items.length} saved</span>}
        </div>

        {review && review.total > 0 ? (
          <Link
            to="/review"
            className="mt-5 flex items-center gap-3 rounded-card border border-line bg-surface px-4 py-3 shadow-[0_1px_1px_rgb(27_26_23/0.03)] transition-colors hover:border-line-strong hover:bg-surface-2/40"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-tile bg-accent-soft text-accent">
              <Brain className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[12.5px] font-medium">Smart Review</span>
              <span className="mt-0.5 block text-[11.5px] text-muted">
                {review.due > 0 ? `${review.due} card${review.due === 1 ? '' : 's'} due today` : 'All caught up — nothing due today.'}
              </span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 text-[11.5px] font-medium text-muted">
              {review.due > 0 ? 'Review' : 'Open'}
              <ArrowUpRight className="size-3.5" />
            </span>
          </Link>
        ) : null}

        {items.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-1" role="group" aria-label="Filter artifacts">
            {FILTERS.map((option) => {
              const selected = filter === option.id
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setFilter(option.id)}
                  className={cx(
                    'inline-flex h-8 items-center gap-1.5 rounded-tile px-3 text-[12.5px] font-medium transition-colors',
                    selected ? 'bg-fg text-white' : 'text-muted hover:bg-surface-2 hover:text-fg',
                  )}
                >
                  {option.label}
                  <span className={cx('text-[10.5px] tabular-nums', selected ? 'text-white/60' : 'text-faint')}>{count(option.id)}</span>
                </button>
              )
            })}
          </div>
        )}

        {isLoading ? (
          <div className="grid min-h-[300px] place-items-center">
            <Spinner />
          </div>
        ) : error ? (
          <div className="mt-10 rounded-card border border-line bg-surface px-5 py-8 text-center">
            <p className="text-[14px] font-medium">The library could not load.</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{error instanceof Error ? error.message : 'Try again in a moment.'}</p>
            <button type="button" onClick={() => void refetch()} className="mt-3 text-[12.5px] text-muted underline underline-offset-2 hover:text-fg">
              Try again
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="mt-10 rounded-card border border-dashed border-line bg-surface/50 px-5 py-12 text-center">
            <span className="mx-auto grid size-10 place-items-center rounded-tile bg-surface-2 text-faint">
              <Layers className="size-4" />
            </span>
            <p className="mt-3 text-[14px] font-medium">Nothing saved yet</p>
            <p className="mx-auto mt-1 max-w-[360px] text-[12.5px] leading-relaxed text-muted">
              Build a page, analyze a spreadsheet, study a topic or run research. The result will appear here automatically.
            </p>
            <Link to="/" className="mt-4 inline-flex h-8 items-center rounded-tile border border-line bg-surface px-3 text-[12.5px] font-medium text-muted transition-colors hover:text-fg">
              Start a task
            </Link>
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-10 rounded-card border border-line bg-surface px-5 py-10 text-center">
            {filter === 'pinned' ? (
              <>
                <p className="text-[13px] text-muted">Nothing pinned yet.</p>
                <p className="mx-auto mt-1 max-w-[320px] text-[12px] leading-relaxed text-faint">Use the pin on any card to keep it at the top of the library.</p>
              </>
            ) : (
              <p className="text-[13px] text-muted">No {FILTERS.find((option) => option.id === filter)?.label.toLowerCase()} yet.</p>
            )}
            <button type="button" onClick={() => setFilter('all')} className="mt-2 text-[12.5px] text-muted underline underline-offset-2 hover:text-fg">
              Show everything
            </button>
          </div>
        ) : (
          <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {filtered.map((item) => (
              <ArtifactCard
                key={`${item.kind}:${item.messageId}`}
                item={item}
                downloading={downloading === item.messageId}
                duplicating={duplicate.isPending && duplicate.variables === item.messageId}
                pinning={pin.isPending && pin.variables?.id === item.messageId}
                onPin={togglePin}
                onDownload={(value) => void download(value)}
                onShare={(value) => setShareFor(value.conversationId)}
                onDuplicate={copy}
                onRemix={(value) => navigate('/', { state: { remixDraft: remixText(value) } })}
              />
            ))}
          </div>
        )}
      </div>
      <ShareDialog open={Boolean(shareFor)} onClose={() => setShareFor(null)} conversationId={shareFor ?? undefined} />
    </div>
  )
}
