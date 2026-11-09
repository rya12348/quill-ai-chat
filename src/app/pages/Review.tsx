import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowLeft, ArrowUpRight, Brain, Check, Clock3, Eye, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'

import { intervalLabel, reviewPreviews } from '../../shared/review'
import type { ReviewRating } from '../../shared/types'
import { Spinner, useToast } from '../components/ui'
import { useRateReview, useReviewQueue, useReviewSummary } from '../lib/api'
import { cx } from '../lib/cx'

const RATINGS: { id: ReviewRating; label: string; hint: string; tone: string; hover: string }[] = [
  { id: 'again', label: 'Again', hint: 'Forgot it', tone: 'text-danger', hover: 'hover:border-danger/45 hover:bg-danger/5' },
  { id: 'hard', label: 'Hard', hint: 'Struggled', tone: 'text-warning', hover: 'hover:border-warning/45 hover:bg-warning/5' },
  { id: 'good', label: 'Good', hint: 'Knew it', tone: 'text-accent', hover: 'hover:border-accent/45 hover:bg-accent/5' },
  { id: 'easy', label: 'Easy', hint: 'Too easy', tone: 'text-success', hover: 'hover:border-success/45 hover:bg-success/5' },
]

const SHORTCUTS: Record<string, ReviewRating> = { '1': 'again', '2': 'hard', '3': 'good', '4': 'easy' }

const emptyTally = (): Record<ReviewRating, number> => ({ again: 0, hard: 0, good: 0, easy: 0 })

const whenLabel = (ts: number) =>
  new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(ts)

export function Review() {
  const [params] = useSearchParams()
  const deck = params.get('deck') ?? undefined
  const { data, isLoading, error, refetch } = useReviewQueue(deck)
  const { data: summary, isSuccess: summaryReady } = useReviewSummary()
  const rate = useRateReview()
  const toast = useToast()
  const reduceMotion = useReducedMotion()
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [tally, setTally] = useState<Record<ReviewRating, number>>(emptyTally)
  const saving = useRef(false)

  const items = data?.items ?? []
  const total = items.length
  const card = items[index]
  const finished = Boolean(data) && total > 0 && index >= total
  const due = summary?.due ?? data?.totalDue ?? 0

  useEffect(() => {
    setIndex(0)
    setRevealed(false)
    setTally(emptyTally())
    saving.current = false
  }, [deck])

  const previews = useMemo(() => (card ? reviewPreviews(card) : null), [card])
  const progress = total ? Math.round((index / total) * 100) : 0

  const choose = useCallback(
    (rating: ReviewRating) => {
      if (!card || rate.isPending || saving.current) return
      saving.current = true
      void rate
        .mutateAsync({ messageId: card.messageId, cardIndex: card.cardIndex, rating })
        .then(() => {
          setTally((current) => ({ ...current, [rating]: current[rating] + 1 }))
          setRevealed(false)
          setIndex((current) => current + 1)
        })
        .catch((cause) => {
          toast(cause instanceof Error ? cause.message : 'Could not save this review', 'danger')
        })
        .finally(() => {
          saving.current = false
        })
    },
    [card, rate, toast],
  )

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return
      if (!revealed) {
        if ((event.key === ' ' || event.key === 'Enter') && !target?.closest('button, a')) {
          event.preventDefault()
          setRevealed(true)
        }
        return
      }
      const rating = SHORTCUTS[event.key]
      if (!rating) return
      event.preventDefault()
      choose(rating)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [choose, revealed])

  const reviewed = Object.values(tally).reduce((sum, value) => sum + value, 0)
  const noSchedule = summaryReady && summary?.total === 0
  const hasOtherDue = Boolean(deck && summary && summary.due > 0)

  return (
    <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[760px] px-4 pb-16 pt-8 md:px-6 md:pt-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">Smart Review</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[28px] font-semibold tracking-[-0.02em]">
              {deck ? data?.deckTitle ?? 'Deck review' : 'Review what’s due'}
            </h1>
            <p className="mt-1 max-w-[500px] text-[13px] leading-relaxed text-muted">
              A little every day beats cramming. Reveal each card, then tell Quill how it felt.
            </p>
          </div>
          <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[11.5px] font-medium text-muted">
            <Brain className="size-3.5 text-accent" />
            {due} due today
          </span>
        </div>

        {isLoading ? (
          <div className="grid min-h-[320px] place-items-center">
            <Spinner />
          </div>
        ) : error ? (
          <div className="mt-10 rounded-card border border-line bg-surface px-5 py-8 text-center">
            <p className="text-[14px] font-medium">Smart Review could not load.</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{error instanceof Error ? error.message : 'Try again in a moment.'}</p>
            <button type="button" onClick={() => void refetch()} className="mt-3 text-[12.5px] text-muted underline underline-offset-2 hover:text-fg">
              Try again
            </button>
          </div>
        ) : !data || total === 0 ? (
          <div className="mt-10 rounded-card border border-dashed border-line bg-surface/50 px-5 py-12 text-center">
            <span className="mx-auto grid size-11 place-items-center rounded-tile bg-accent-soft text-accent">
              <Brain className="size-5" />
            </span>
            <h2 className="mt-3 text-[16px] font-semibold">{noSchedule ? 'Start with a flashcard deck' : 'All caught up'}</h2>
            <p className="mx-auto mt-1 max-w-[380px] text-[12.5px] leading-relaxed text-muted">
              {noSchedule
                ? 'Open a study deck and choose Review once. Quill will schedule its cards for you.'
                : hasOtherDue
                  ? 'This deck is caught up, but other decks have cards due today.'
                  : 'Nothing is due right now. Your cards will come back when they are ready for another pass.'}
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              {hasOtherDue && (
                <Link to="/review" className="inline-flex h-9 items-center gap-1.5 rounded-control bg-fg px-3.5 text-[12.5px] font-medium text-white transition-colors hover:bg-[#2e2c27]">
                  Review all due
                  <ArrowUpRight className="size-3.5" />
                </Link>
              )}
              <Link to="/library" className="inline-flex h-9 items-center gap-1.5 rounded-control border border-line bg-surface px-3.5 text-[12.5px] font-medium text-muted transition-colors hover:text-fg">
                <ArrowLeft className="size-3.5" />
                Back to Library
              </Link>
            </div>
          </div>
        ) : finished ? (
          <div className="mt-8 rounded-card border border-line bg-surface p-6 text-center shadow-[0_24px_60px_-50px_rgb(27_26_23/0.45)] md:p-10">
            <span className="mx-auto grid size-12 place-items-center rounded-[16px] bg-success-soft text-success">
              <Sparkles className="size-6" />
            </span>
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">Session complete</p>
            <h2 className="mt-1 text-[24px] font-semibold tracking-[-0.02em]">Those cards are filed away.</h2>
            <p className="mx-auto mt-2 max-w-[430px] text-[13px] leading-relaxed text-muted">
              You reviewed {reviewed} card{reviewed === 1 ? '' : 's'}. Quill will bring each one back on its own schedule.
            </p>
            <div className="mx-auto mt-6 grid max-w-[480px] grid-cols-2 gap-2 sm:grid-cols-4">
              {RATINGS.map((rating) => (
                <div key={rating.id} className="rounded-tile border border-line bg-surface-2/50 px-3 py-3">
                  <p className={cx('text-[17px] font-semibold tabular-nums', rating.tone)}>{tally[rating.id]}</p>
                  <p className="mt-0.5 text-[10.5px] font-medium text-faint">{rating.label}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-[11.5px] text-faint">
              <span className="inline-flex items-center gap-1.5">
                <Clock3 className="size-3.5" />
                {summary?.nextDueAt ? `Next review ${whenLabel(summary.nextDueAt)}` : 'Nothing else scheduled'}
              </span>
              {summary?.reviewedToday ? <span>· {summary.reviewedToday} reviewed today</span> : null}
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              {hasOtherDue && (
                <Link to="/review" className="inline-flex h-9 items-center gap-1.5 rounded-control bg-fg px-3.5 text-[12.5px] font-medium text-white transition-colors hover:bg-[#2e2c27]">
                  Review more
                  <ArrowUpRight className="size-3.5" />
                </Link>
              )}
              <Link to="/library" className="inline-flex h-9 items-center gap-1.5 rounded-control border border-line bg-surface px-3.5 text-[12.5px] font-medium text-muted transition-colors hover:text-fg">
                <ArrowLeft className="size-3.5" />
                Back to Library
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-7">
            <div className="flex items-center justify-between gap-3 text-[11.5px] text-faint">
              <span className="truncate">{card?.deckTitle}</span>
              <span className="shrink-0 tabular-nums">
                {index + 1} / {total}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line/80">
              <motion.span
                initial={false}
                animate={{ width: `${progress}%` }}
                transition={{ duration: reduceMotion ? 0 : 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="block h-full rounded-full bg-accent"
              />
            </div>

            <AnimatePresence mode="wait" initial={false}>
              {card && (
                <motion.div
                  key={`${card.messageId}:${card.cardIndex}`}
                  initial={reduceMotion ? false : { opacity: 0, x: 18 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={reduceMotion ? undefined : { opacity: 0, x: -18 }}
                  transition={{ duration: reduceMotion ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div
                    className="relative mt-5 overflow-hidden rounded-[24px] border border-line bg-surface p-5 shadow-[0_24px_60px_-50px_rgb(27_26_23/0.5)] md:p-8"
                    style={{ backgroundImage: 'radial-gradient(circle at top right, rgb(194 87 27 / 0.08), transparent 42%)' }}
                  >
                    <div className="relative flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-2 text-[9.5px] font-semibold uppercase tracking-[0.13em] text-faint">
                        <span className="grid size-5 place-items-center rounded-full bg-surface-2 text-[9px] tabular-nums text-muted">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        Question
                      </span>
                      <span className="truncate text-[10.5px] text-faint">{card.conversationTitle}</span>
                    </div>
                    <p className="relative mt-7 text-[21px] font-medium leading-snug tracking-[-0.01em] text-fg md:text-[25px]">{card.front}</p>

                    <AnimatePresence initial={false}>
                      {revealed && (
                        <motion.div
                          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: reduceMotion ? 0 : 0.25, ease: [0.22, 1, 0.36, 1] }}
                          className="relative mt-7 rounded-[14px] border border-accent/20 bg-accent-soft/55 px-4 py-4"
                        >
                          <p className="text-[9.5px] font-semibold uppercase tracking-[0.13em] text-accent">Answer</p>
                          <p className="mt-2 break-words text-[14px] leading-relaxed text-fg">{card.back}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {!revealed ? (
                      <button
                        type="button"
                        onClick={() => setRevealed(true)}
                        className="relative mt-8 inline-flex h-10 items-center gap-2 rounded-control bg-fg px-4 text-[12.5px] font-medium text-white transition-colors hover:bg-[#2e2c27]"
                      >
                        <Eye className="size-4" />
                        Show answer
                        <kbd className="ml-1 rounded-[5px] border border-white/20 px-1.5 py-0.5 text-[9.5px] font-normal text-white/55">Space</kbd>
                      </button>
                    ) : null}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {revealed ? (
              <div className="mt-4">
                <div className="flex items-center justify-between gap-3 text-[10.5px] uppercase tracking-[0.1em] text-faint">
                  <span>How well did you know it?</span>
                  <span>1–4</span>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-4">
                  {RATINGS.map((rating, ratingIndex) => (
                    <button
                      key={rating.id}
                      type="button"
                      disabled={rate.isPending}
                      onClick={() => choose(rating.id)}
                      className={cx(
                        'flex min-h-[86px] flex-col rounded-[14px] border border-line bg-surface p-3 text-left transition-[border-color,background-color,transform] hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-55',
                        rating.hover,
                      )}
                    >
                      <span className="flex w-full items-center justify-between gap-2">
                        <span className="text-[12.5px] font-semibold text-fg">{rating.label}</span>
                        <kbd className="rounded-[5px] border border-line px-1 text-[9.5px] font-normal text-faint">{ratingIndex + 1}</kbd>
                      </span>
                      <span className="mt-1 text-[10.5px] text-muted">{rating.hint}</span>
                      <span className={cx('mt-auto pt-2 text-[10.5px] font-medium', rating.tone)}>
                        {previews ? intervalLabel(previews[rating.id]) : '—'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="mt-3 text-center text-[10.5px] text-faint">Tip: press Space to reveal, then 1–4 to rate.</p>
            )}
          </div>
        )}

        {finished && (
          <p className="mt-4 text-center text-[10.5px] text-faint">
            <Check className="mr-1 inline size-3 text-success" />
            Progress saves as you go.
          </p>
        )}
      </div>
    </div>
  )
}
