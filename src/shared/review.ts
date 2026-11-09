import type { ReviewRating, ReviewSchedule } from './types'

const DAY_MS = 86_400_000
const AGAIN_MINUTES = 10
const AGAIN_DAYS = AGAIN_MINUTES / (24 * 60)
const HARD_FIRST_DAYS = 6 / 24
const MIN_EASE = 1.3
const MAX_EASE = 3
const MAX_INTERVAL_DAYS = 365
const RATINGS: ReviewRating[] = ['again', 'hard', 'good', 'easy']

export type ReviewScheduleResult = ReviewSchedule & { dueAt: number }

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

function normalize(state: ReviewSchedule) {
  return {
    intervalDays: Number.isFinite(state.intervalDays) && state.intervalDays > 0 ? state.intervalDays : 0,
    ease: clamp(Number.isFinite(state.ease) ? state.ease : 2.5, MIN_EASE, MAX_EASE),
    repetitions: Math.max(0, Math.floor(Number(state.repetitions) || 0)),
    lapses: Math.max(0, Math.floor(Number(state.lapses) || 0)),
  }
}

/**
 * A small, predictable spaced-repetition scheduler. It deliberately has no
 * model call: the only inputs are the card's last state, the rating and the
 * current clock. `intervalDays` is fractional so Again can return in minutes.
 */
export function nextReview(state: ReviewSchedule, rating: ReviewRating, at = Date.now()): ReviewScheduleResult {
  const current = normalize(state)
  let { intervalDays, ease, repetitions, lapses } = current

  if (rating === 'again') {
    ease = clamp(ease - 0.2, MIN_EASE, MAX_EASE)
    lapses += 1
    repetitions = 0
    intervalDays = AGAIN_DAYS
  } else {
    if (rating === 'hard') {
      ease = clamp(ease - 0.15, MIN_EASE, MAX_EASE)
      intervalDays = repetitions === 0 ? HARD_FIRST_DAYS : Math.max(1, intervalDays * 1.2)
    } else if (rating === 'good') {
      intervalDays = repetitions === 0 ? 1 : repetitions === 1 ? 3 : Math.max(1, intervalDays * ease)
    } else {
      ease = clamp(ease + 0.15, MIN_EASE, MAX_EASE)
      intervalDays = repetitions === 0 ? 3 : Math.max(2, intervalDays * ease * 1.3)
    }
    repetitions += 1
  }

  intervalDays = clamp(intervalDays, AGAIN_DAYS, MAX_INTERVAL_DAYS)
  return {
    intervalDays,
    ease,
    repetitions,
    lapses,
    dueAt: at + Math.round(intervalDays * DAY_MS),
  }
}

/** The interval shown under each rating before it is chosen. */
export function reviewPreviews(state: ReviewSchedule, at = Date.now()): Record<ReviewRating, number> {
  const previews = {} as Record<ReviewRating, number>
  for (const rating of RATINGS) previews[rating] = nextReview(state, rating, at).intervalDays
  return previews
}

/** A short human label for a schedule interval. */
export function intervalLabel(days: number): string {
  if (!Number.isFinite(days) || days <= 0) return 'now'
  const minutes = Math.round(days * 24 * 60)
  if (minutes < 60) return `${Math.max(1, minutes)} min`
  if (days < 1) return `${Math.round(days * 24)} hr`
  if (days < 30) {
    const value = Math.round(days)
    return `${value} ${value === 1 ? 'day' : 'days'}`
  }
  if (days < 365) {
    const months = Math.round(days / 30)
    return `${months} ${months === 1 ? 'mo' : 'mos'}`
  }
  const years = Math.round(days / 365)
  return `${years} ${years === 1 ? 'yr' : 'yrs'}`
}
