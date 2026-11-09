import assert from 'node:assert/strict'
import test from 'node:test'

import { intervalLabel, nextReview, reviewPreviews } from '../src/shared/review'
import type { ReviewSchedule } from '../src/shared/types'

const fresh: ReviewSchedule = { intervalDays: 0, ease: 2.5, repetitions: 0, lapses: 0 }
const at = Date.UTC(2026, 0, 2, 9, 0, 0)

test('Again returns in ten minutes and resets the streak', () => {
  const result = nextReview({ intervalDays: 12, ease: 2.5, repetitions: 4, lapses: 1 }, 'again', at)
  assert.equal(result.intervalDays, 10 / (24 * 60))
  assert.equal(result.dueAt, at + 10 * 60_000)
  assert.equal(result.repetitions, 0)
  assert.equal(result.lapses, 2)
  assert.ok(result.ease < 2.5)
})

test('Hard starts at six hours, then grows more slowly', () => {
  const first = nextReview(fresh, 'hard', at)
  assert.equal(first.intervalDays, 0.25)
  assert.equal(intervalLabel(first.intervalDays), '6 hr')
  const second = nextReview(first, 'hard', at)
  assert.equal(second.intervalDays, 1)
  assert.ok(second.ease < first.ease)
})

test('Good steps from one day to three days', () => {
  const first = nextReview(fresh, 'good', at)
  assert.equal(first.intervalDays, 1)
  const second = nextReview(first, 'good', at)
  assert.equal(second.intervalDays, 3)
  const third = nextReview(second, 'good', at)
  assert.ok(third.intervalDays > 3)
  assert.equal(third.lapses, 0)
})

test('Easy starts faster and raises ease', () => {
  const result = nextReview(fresh, 'easy', at)
  assert.equal(result.intervalDays, 3)
  assert.ok(result.ease > 2.5)
  assert.ok(nextReview(result, 'easy', at).intervalDays > result.intervalDays)
})

test('previews and labels cover every rating', () => {
  const previews = reviewPreviews(fresh, at)
  assert.deepEqual(Object.keys(previews).sort(), ['again', 'easy', 'good', 'hard'].sort())
  assert.equal(intervalLabel(previews.again), '10 min')
  assert.equal(intervalLabel(previews.good), '1 day')
  assert.equal(intervalLabel(0), 'now')
  assert.equal(intervalLabel(45), '2 mos')
  assert.equal(intervalLabel(730), '2 yrs')
})

test('intervals never exceed one year', () => {
  let state = fresh
  for (let index = 0; index < 30; index += 1) state = nextReview(state, 'easy', at)
  assert.ok(state.intervalDays <= 365)
  assert.equal(intervalLabel(state.intervalDays), '1 yr')
})
