/**
 * The Daily Dive's own card deck.
 *
 * The dive used to read krillion.io at runtime, which meant the game had no
 * questions in this folder at all: with that site unreachable the dive had
 * nothing to show, and the prompts changed under us whenever it did. The deck
 * now comes from the same generated cards Puffer Party deals, picked
 * deterministically from the date, so every player gets the same seven prompts
 * on the same day and the whole game ships as files.
 */

import { BUTTER_TOPICS, answerTier, closestAnswer, type ButterTopic } from './butter-topics'
import { SIMSBURY_CARDS, simsburyForDay } from './butter-simsbury'

const DAY_MS = 86_400_000
/** Dive #1: matches the shipped site's own numbering, which counts 23 Nov
 *  2026 as dive #131. */
const EPOCH = Date.UTC(2026, 6, 16)
const ROUNDS = 7

export type DivePrompt = { id: string; text: string }
export type DiveDay = { date: string; dayNumber: number; resetsAt: string; prompts: DivePrompt[] }

/** A card with a letter rule belongs to the party, not the dive: "name a
 *  country starting with N" is a different game from "name a country". */
const LETTER_RULE = /\b(letter|starts? with|ends? (in|with)|begins? with)\b/i

/** Cards worth diving on: enough accepted answers to rate an answer fairly. */
function divePool(): ButterTopic[] {
  return BUTTER_TOPICS.filter((topic) => !LETTER_RULE.test(topic.prompt) && topic.answers.length >= 8)
}

export function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Mulberry32: small, fast, and the same sequence for the same seed. */
function seeded(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

function dayNumberFor(date: string): number {
  const at = Date.parse(`${date}T00:00:00Z`)
  if (!Number.isFinite(at)) return 1
  return Math.max(1, Math.floor((at - EPOCH) / DAY_MS) + 1)
}

/** Today's seven prompts: the same seven for everyone, every time it is asked. */
export function diveDay(date = today()): DiveDay {
  const dayNumber = dayNumberFor(date)
  const pool = divePool()
  const random = seeded(dayNumber * 2_654_435_761)
  const order = pool.map((_, index) => index)
  for (let index = order.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1))
    ;[order[index], order[swap]] = [order[swap], order[index]]
  }
  const prompts = order.slice(0, ROUNDS).map((index, position) => ({
    id: `p${position + 1}`,
    text: pool[index].prompt,
  }))
  // The town gets one or two rounds of its own, on the same slots whatever deck
  // was dealt, so a live day and the local fallback carry the same cards.
  for (const entry of simsburyForDay(dayNumber)) {
    const prompt = prompts[entry.index]
    if (prompt) prompt.text = entry.card.prompt
  }
  const at = Date.parse(`${date}T00:00:00Z`)
  return {
    date,
    dayNumber,
    resetsAt: new Date((Number.isFinite(at) ? at : Date.now()) + DAY_MS).toISOString(),
    prompts,
  }
}

/** The card a prompt id points at, on the server's own day. */
export function diveCard(promptId: string, date = today()): ButterTopic | undefined {
  const prompt = diveDay(date).prompts.find((entry) => entry.id === promptId)
  if (!prompt) return undefined
  return (
    BUTTER_TOPICS.find((topic) => topic.prompt === prompt.text) ??
    (SIMSBURY_CARDS.find((card) => card.prompt === prompt.text) as unknown as ButterTopic | undefined)
  )
}

/** Whether a round of a day's dive is one of the Simsbury cards. */
export function isSimsburySlot(promptId: string, date = today()): boolean {
  const prompt = diveDay(date).prompts.find((entry) => entry.id === promptId)
  return Boolean(prompt && SIMSBURY_CARDS.some((card) => card.prompt === prompt.text))
}

/** The Simsbury text that belongs on a slot of a day, if it takes one. */
export function simsburyTextAt(dayNumber: number, index: number): string | undefined {
  return simsburyForDay(dayNumber).find((entry) => entry.index === index)?.card.prompt
}

export type DiveRating = {
  accepted: boolean
  answer?: string
  tier?: string
  score?: number
  correction?: string
  rejectionReason?: string
}

/** Rate one answer against the card the prompt id names. */
export function rateDiveAnswer(
  promptId: string,
  answer: string,
  date = today(),
  /** The card's full answer list, when the caller could read it: the bundled
   *  copy is trimmed, and a trimmed copy is what refused real answers. */
  override?: ButterTopic,
): DiveRating {
  const card = override ?? diveCard(promptId, date)
  if (!card) return { accepted: false, rejectionReason: 'That prompt is not in today’s dive.' }
  const tier = answerTier(card, answer)
  if (tier) return { accepted: true, answer: tier.value, tier: tier.id, score: tier.score }
  // A near miss that the card can spell is offered back instead of being spent
  // as a blank: the client puts it in the box and the player sends it again.
  const near = closestAnswer(card, answer)
  if (near) return { accepted: false, correction: near.value }
  return { accepted: false, rejectionReason: 'Not on today’s card.' }
}
