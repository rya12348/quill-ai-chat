import { Hono } from 'hono'

import { MAX_CANVAS_CARDS } from '../../shared/config'
import { nextReview } from '../../shared/review'
import type { ReviewCard, ReviewQueue, ReviewRating, ReviewRatingResult, ReviewSummary } from '../../shared/types'
import { privateJson } from '../auth'
import { now, parseCanvas } from '../db'
import type { AppContext } from '../env'

export const review = new Hono<AppContext>()

const RATINGS = new Set<ReviewRating>(['again', 'hard', 'good', 'easy'])
const MAX_QUEUE = 200

type DueRow = {
  message_id: string
  card_index: number
  due_at: number
  interval_days: number
  ease: number
  repetitions: number
  lapses: number
  canvas_content: string
  conversation_id: string
  conversation_title: string
}

type SummaryRow = {
  due: number | null
  total: number | null
  reviewed_today: number | null
  next_due_at: number | null
}

type ScheduleRow = {
  interval_days: number
  ease: number
  repetitions: number
  lapses: number
  canvas_content: string
}

const numeric = (value: unknown): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0
}

/**
 * Owner-scoped summary used by the home screen and Library. It joins the saved
 * deck and conversation so deleting either one removes its cards from the
 * queue without a separate cleanup pass on every read.
 */
async function summaryFor(db: D1Database, owner: string, at = now()): Promise<ReviewSummary> {
  const date = new Date(at)
  const dayStart = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  const row = await db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN r.due_at <= ? THEN 1 ELSE 0 END), 0) AS due,
         COUNT(*) AS total,
         COALESCE(SUM(CASE WHEN r.last_reviewed_at >= ? THEN 1 ELSE 0 END), 0) AS reviewed_today,
         MIN(CASE WHEN r.due_at > ? THEN r.due_at END) AS next_due_at
       FROM canvas_reviews r
       JOIN messages m ON m.id = r.message_id AND m.owner_sub = r.owner_sub
       JOIN conversations c ON c.id = m.conversation_id AND c.owner_sub = m.owner_sub
       JOIN message_canvas mc ON mc.message_id = r.message_id AND mc.owner_sub = r.owner_sub
       WHERE r.owner_sub = ?`,
    )
    .bind(at, dayStart, at, owner)
    .first<SummaryRow>()
  return {
    due: numeric(row?.due),
    total: numeric(row?.total),
    reviewedToday: numeric(row?.reviewed_today),
    nextDueAt: row?.next_due_at == null ? null : Number(row.next_due_at),
  }
}

async function deckRow(db: D1Database, owner: string, messageId: string) {
  return db
    .prepare(
      `SELECT mc.content
       FROM message_canvas mc
       JOIN messages m ON m.id = mc.message_id AND m.owner_sub = mc.owner_sub
       JOIN conversations c ON c.id = m.conversation_id AND c.owner_sub = m.owner_sub
       WHERE mc.owner_sub = ? AND mc.message_id = ? AND m.role = 'assistant'`,
    )
    .bind(owner, messageId)
    .first<{ content: string }>()
}

function cardFor(row: DueRow): ReviewCard | undefined {
  const canvas = parseCanvas(row.canvas_content)
  const index = numeric(row.card_index)
  const card = canvas?.cards?.[index]
  if (!canvas || canvas.kind !== 'flashcards' || !card) return undefined
  return {
    messageId: String(row.message_id),
    cardIndex: index,
    front: card.front,
    back: card.back,
    deckTitle: canvas.title,
    conversationId: String(row.conversation_id),
    conversationTitle: String(row.conversation_title),
    dueAt: Number(row.due_at),
    intervalDays: Number(row.interval_days) || 0,
    ease: Number(row.ease) || 2.5,
    repetitions: numeric(row.repetitions),
    lapses: numeric(row.lapses),
  }
}

review.get('/summary', async (c) => {
  const summary = await summaryFor(c.get('db'), c.get('user').sub)
  return privateJson(c, summary)
})

review.get('/', async (c) => {
  const db = c.get('db')
  const owner = c.get('user').sub
  const deckId = c.req.query('deck')?.trim().slice(0, 100) || undefined
  let deckTitle: string | undefined

  if (deckId) {
    const row = await deckRow(db, owner, deckId)
    if (!row) return privateJson(c, { error: 'not_found', message: 'That study deck is no longer here.' }, 404)
    const canvas = parseCanvas(row.content)
    if (!canvas || canvas.kind !== 'flashcards' || !canvas.cards?.length) {
      return privateJson(c, { error: 'not_flashcards', message: 'Smart Review works with flashcard decks.' }, 400)
    }
    deckTitle = canvas.title
  }

  const at = now()
  const params: (string | number)[] = [owner, at]
  let sql = `SELECT r.message_id, r.card_index, r.due_at, r.interval_days, r.ease, r.repetitions, r.lapses,
                    mc.content AS canvas_content, c.id AS conversation_id, c.title AS conversation_title
             FROM canvas_reviews r
             JOIN messages m ON m.id = r.message_id AND m.owner_sub = r.owner_sub
             JOIN conversations c ON c.id = m.conversation_id AND c.owner_sub = m.owner_sub
             JOIN message_canvas mc ON mc.message_id = r.message_id AND mc.owner_sub = r.owner_sub
             WHERE r.owner_sub = ? AND r.due_at <= ? AND m.role = 'assistant'`
  if (deckId) {
    sql += ` AND r.message_id = ?`
    params.push(deckId)
  }
  sql += ` ORDER BY r.due_at ASC, r.created_at ASC LIMIT ${MAX_QUEUE}`

  const rows = await db.prepare(sql).bind(...params).all<DueRow>()
  const items = (rows.results ?? []).flatMap((row) => {
    const item = cardFor(row)
    return item ? [item] : []
  })
  const summary = await summaryFor(db, owner, at)
  const body: ReviewQueue = { items, totalDue: summary.due, ...(deckTitle ? { deckTitle } : {}) }
  return privateJson(c, body)
})

/**
 * Enrolling is idempotent: an existing card keeps its current due date, while
 * new cards start due now. This is why opening Review again never resets work.
 */
review.post('/decks/:messageId', async (c) => {
  const db = c.get('db')
  const owner = c.get('user').sub
  const messageId = c.req.param('messageId')
  const row = await deckRow(db, owner, messageId)
  if (!row) return privateJson(c, { error: 'not_found', message: 'That study deck is no longer here.' }, 404)

  const canvas = parseCanvas(row.content)
  const cards = canvas?.cards ?? []
  if (!canvas || canvas.kind !== 'flashcards' || !cards.length) {
    return privateJson(c, { error: 'not_flashcards', message: 'Smart Review works with flashcard decks.' }, 400)
  }

  const at = now()
  const statements = cards.map((_, index) =>
    db
      .prepare(
        `INSERT OR IGNORE INTO canvas_reviews
           (owner_sub, message_id, card_index, due_at, interval_days, ease, repetitions, lapses, created_at)
         VALUES (?, ?, ?, ?, 0, 2.5, 0, 0, ?)`,
      )
      .bind(owner, messageId, index, at, at),
  )
  if (statements.length) await db.batch(statements)
  const summary = await summaryFor(db, owner, at)
  return privateJson(c, { deckTitle: canvas.title, cards: cards.length, summary }, 201)
})

review.post('/:messageId/:cardIndex', async (c) => {
  const db = c.get('db')
  const owner = c.get('user').sub
  const messageId = c.req.param('messageId')
  const cardIndex = Number(c.req.param('cardIndex'))
  if (!Number.isInteger(cardIndex) || cardIndex < 0 || cardIndex >= MAX_CANVAS_CARDS) {
    return privateJson(c, { error: 'card_index', message: 'That card is not valid.' }, 400)
  }

  const input = await c.req.json<{ rating?: unknown }>().catch(() => ({} as { rating?: unknown }))
  if (typeof input.rating !== 'string' || !RATINGS.has(input.rating as ReviewRating)) {
    return privateJson(c, { error: 'rating', message: 'Rate the card Again, Hard, Good or Easy.' }, 400)
  }
  const rating = input.rating as ReviewRating

  const row = await db
    .prepare(
      `SELECT r.interval_days, r.ease, r.repetitions, r.lapses, mc.content AS canvas_content
       FROM canvas_reviews r
       JOIN messages m ON m.id = r.message_id AND m.owner_sub = r.owner_sub
       JOIN conversations c ON c.id = m.conversation_id AND c.owner_sub = m.owner_sub
       JOIN message_canvas mc ON mc.message_id = r.message_id AND mc.owner_sub = r.owner_sub
       WHERE r.owner_sub = ? AND r.message_id = ? AND r.card_index = ? AND m.role = 'assistant'`,
    )
    .bind(owner, messageId, cardIndex)
    .first<ScheduleRow>()
  if (!row) return privateJson(c, { error: 'not_found', message: 'That card is not in Smart Review.' }, 404)

  const canvas = parseCanvas(row.canvas_content)
  if (!canvas || canvas.kind !== 'flashcards' || !canvas.cards?.[cardIndex]) {
    return privateJson(c, { error: 'not_flashcards', message: 'That card is no longer available.' }, 404)
  }

  const at = now()
  const next = nextReview(
    {
      intervalDays: Number(row.interval_days) || 0,
      ease: Number(row.ease) || 2.5,
      repetitions: numeric(row.repetitions),
      lapses: numeric(row.lapses),
    },
    rating,
    at,
  )
  await db
    .prepare(
      `UPDATE canvas_reviews
       SET due_at = ?, interval_days = ?, ease = ?, repetitions = ?, lapses = ?,
           last_rating = ?, last_reviewed_at = ?
       WHERE owner_sub = ? AND message_id = ? AND card_index = ?`,
    )
    .bind(next.dueAt, next.intervalDays, next.ease, next.repetitions, next.lapses, rating, at, owner, messageId, cardIndex)
    .run()

  const summary = await summaryFor(db, owner, at)
  const result: ReviewRatingResult = { ...next, summary }
  return privateJson(c, result)
})
