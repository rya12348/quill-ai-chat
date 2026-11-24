/**
 * Butter Party question bank.
 *
 * Answers live only on the server: a player never receives the accepted list,
 * which is what stops the game being solvable by reading the network tab. The
 * wording is deliberately ordinary ("Name a type of …") so the prompt reads the
 * same to everyone and nothing depends on a specific site's copy.
 *
 * Each card carries the real tier of every answer, taken from the game's own
 * tier table, and is ordered from the answer everybody shouts to the one nobody
 * remembers. Position is only the fallback for an answer the table has never
 * scored.
 */

export type ButterTopic = { prompt: string; answers: string[]; tiers?: ButterTier[] }


import { BANK_CARDS } from './butter-cards'

/**
 * Every card the table can deal: the generated bank, one prompt per card with
 * the real tier of each accepted answer. See `butter-cards.ts`.
 */
export const BUTTER_TOPICS: ButterTopic[] = BANK_CARDS as unknown as ButterTopic[]

/** Case, punctuation, plurals and spacing are the four ways a right answer gets
 *  marked wrong, so the match is done on a flattened copy. A leading "a" or
 *  "the" is how people type, not a different answer. */
export function flatAnswer(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(a|an|the) /, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/s$/, '')
}

/**
 * The floor a party card has to clear to be dealt. A table of ten burns through
 * answers far faster than one, and the shipped categories all carry hundreds
 * (the deep end runs to five figures), so a card with a handful of answers is a
 * card that strands the table twenty seconds in: every later guess is refused
 * as a repeat. Those thin cards stay in the bank — the dive only ever asks one
 * question, so it can use them — but the party refuses to deal them.
 */
export const PARTY_MIN_ANSWERS = 100

const PARTY_TOPICS: ButterTopic[] = BUTTER_TOPICS.filter((topic) => topic.answers.length >= PARTY_MIN_ANSWERS)

/** The arcade never deals a category the table has already seen; once every
 *  card has been played it starts over rather than running dry. */
export function nextTopic(seen: string[] = []): ButterTopic {
  const fresh = PARTY_TOPICS.filter((topic) => !seen.includes(topic.prompt))
  const pool = fresh.length ? fresh : PARTY_TOPICS
  return pool[Math.floor(Math.random() * pool.length)]
}

export function pickTopic(avoid?: string): ButterTopic {
  const pool = avoid ? PARTY_TOPICS.filter((topic) => topic.prompt !== avoid) : PARTY_TOPICS
  return (pool.length ? pool : PARTY_TOPICS)[Math.floor(Math.random() * (pool.length || PARTY_TOPICS.length))]
}

/** Two edits apart, three for a long word: a typo, never a different answer. */
function editDistance(from: string, to: string): number {
  if (from === to) return 0
  const rows = from.length + 1
  const cols = to.length + 1
  let previous = new Array<number>(cols)
  let current = new Array<number>(cols)
  for (let col = 0; col < cols; col += 1) previous[col] = col
  for (let row = 1; row < rows; row += 1) {
    current[0] = row
    for (let col = 1; col < cols; col += 1) {
      const cost = from[row - 1] === to[col - 1] ? 0 : 1
      current[col] = Math.min(previous[col] + 1, current[col - 1] + 1, previous[col - 1] + cost)
    }
    const swap = previous
    previous = current
    current = swap
  }
  return previous[cols - 1]
}

/**
 * The real table forgives spelling: a missing letter, a swapped pair, a doubled
 * letter, a plural, and a half-typed answer long enough to be unambiguous.
 * Short words get one edit, medium two, long ones three — enough for "labradr"
 * and "spagetti", never enough to turn one accepted answer into another.
 */
/** One adjacent pair typed the wrong way round: "kettel", "pruple", "recieve". */
function swappedPair(left: string, right: string): boolean {
  if (left.length !== right.length) return false
  let first = -1
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] === right[index]) continue
    if (first === -1) {
      first = index
      continue
    }
    return (
      index === first + 1 &&
      left[first] === right[index] &&
      left[index] === right[first] &&
      left.slice(index + 1) === right.slice(index + 1)
    )
  }
  return false
}

function withinTypos(needle: string, target: string): boolean {
  if (!needle) return false
  if (needle === target) return true
  // "sweetcorn" for "sweet corn", "icecream" for "ice cream", "spiderman" for
  // "spider man": people run words together and split them apart, and neither is
  // a different answer. Compare the packed forms before giving up on the word.
  const packed = needle.replace(/ /g, '')
  const packedTarget = target.replace(/ /g, '')
  if (packed !== needle || packedTarget !== target) return withinTypos(packed, packedTarget)
  // Three letters leave no room for a typo: "to" is not "go" and "pay" is not
  // "ray".
  if (target.length <= 3) return false
  // A prefix only counts while it is nearly the whole answer. "chess" is not
  // "chess boxing" and "foot" is not "football": a card now carries hundreds
  // of multi-word answers, and an unguarded prefix test handed out a whole
  // answer for typing the first word of it.
  const shorter = Math.min(needle.length, target.length)
  const longer = Math.max(needle.length, target.length)
  if (shorter >= 4 && shorter / longer >= 0.7 && (target.startsWith(needle) || needle.startsWith(target))) return true
  const distance = editDistance(needle, target)
  if (distance <= 1) return true
  // A dropped-then-retyped pair is still two edits on paper.
  if (distance === 2 && swappedPair(needle, target)) return true
  // Two edits only count while the word still opens and closes the same way.
  // Without that, "tango" was being taken for "nando" — a whole answer for
  // free on a card that never had it.
  if (distance === 2 && target.length >= 6 && needle[0] === target[0] && needle[needle.length - 1] === target[target.length - 1]) {
    return true
  }
  // Long words are where people spell by ear ("chiwawa"): one more edit is
  // still a typo, but only when the word opens the same way, so two different
  // answers never collapse into each other.
  if (target.length >= 9 && needle.length >= 7 && needle[0] === target[0] && target[1] === needle[1]) {
    // Four edits are only forgivable when both words open with the same three
    // letters, which is what keeps "chiwawa" a typo of "chihuahua" and not a
    // free pass on some other answer on the card.
    if (distance <= 3) return true
    return distance === 4 && needle.slice(0, 3) === target.slice(0, 3)
  }
  return false
}

/** The accepted answer a typed one is close enough to, with its real spelling. */
export function closestAnswer(topic: ButterTopic, answer: string): { index: number; value: string } | null {
  const needle = flatAnswer(answer)
  if (!needle) return null
  let best: { index: number; value: string; distance: number } | null = null
  for (let index = 0; index < topic.answers.length; index += 1) {
    const value = topic.answers[index]
    const target = flatAnswer(value)
    if (!withinTypos(needle, target)) continue
    const distance = target === needle ? 0 : Math.max(1, Math.min(editDistance(needle, target), Math.abs(target.length - needle.length)))
    if (!best || distance < best.distance) best = { index, value, distance }
  }
  return best ? { index: best.index, value: best.value } : null
}

/** Whether a typed answer is the same answer as one already spent this round. */
export function sameAnswer(left: string, right: string): boolean {
  return withinTypos(flatAnswer(left), flatAnswer(right))
}

export function answerFits(topic: ButterTopic, answer: string): boolean {
  return closestAnswer(topic, answer) !== null
}

/* ------------------------------------------------------------------- tiers */

/**
 * Puffer Party's rarity ladder. The points are the real ones: the table fills a
 * 600-point meter, so a plankton answer barely moves it and a One in a Butter
 * Churn is worth a sixth of a spare life on its own. Each card carries the real
 * tier of every accepted answer, straight from the game's own answer sheets.
 */
export type ButterTier = 'plankton' | 'tooclever' | 'schooler' | 'rare' | 'deepcut' | 'krillion'

/** The shipped table, field for field: score, the depth it starts at, its emoji
 *  and its blurb. Depth is the share of the card that answers at or above this
 *  tier should cover, which is why the bands below are read off it. */
export const TIERS: Record<
  ButterTier,
  { name: string; score: number; color: string; depth: number; emoji: string; blurb: string }
> = {
  plankton: {
    name: 'Margarine',
    score: 10,
    color: '#8fa3c4',
    depth: 0.08,
    emoji: '🧈',
    blurb: 'Not even butter.',
  },
  tooclever: {
    name: 'Whipped',
    score: 15,
    color: '#ff9f43',
    depth: 0.18,
    emoji: '🌀',
    blurb: 'Puffed up. Mostly air.',
  },
  schooler: {
    name: 'Salted',
    score: 30,
    color: '#4de3ff',
    depth: 0.36,
    emoji: '🧂',
    blurb: 'The standard block. Solid.',
  },
  rare: { name: 'Cultured', score: 60, color: '#ff5252', depth: 0.6, emoji: '🥛', blurb: 'Tangier. Takes work to find.' },
  deepcut: {
    name: 'Brown Butter',
    score: 85,
    color: '#9d7bff',
    depth: 0.82,
    emoji: '🥜',
    blurb: 'Nutty, dark, and hard-won.',
  },
  krillion: {
    name: 'One in a Butter Churn',
    score: 100,
    color: '#ffd166',
    depth: 0.97,
    emoji: '✨',
    blurb: 'The designated gem. Churn floor.',
  },
}

export const TIER_ORDER: ButterTier[] = ['plankton', 'schooler', 'rare', 'deepcut', 'krillion']

export type MeterSeg = { tier: ButterTier; amt: number }

const RARITY_BANDS: { max: number; tier: ButterTier }[] = [
  { max: TIERS.plankton.depth, tier: 'plankton' },
  { max: TIERS.tooclever.depth, tier: 'tooclever' },
  { max: TIERS.schooler.depth, tier: 'schooler' },
  { max: TIERS.rare.depth, tier: 'rare' },
  { max: TIERS.deepcut.depth, tier: 'deepcut' },
  { max: 1.01, tier: 'krillion' },
]

/** Null means the answer is not in the category at all: the puffer pops. */
export function answerTier(
  topic: ButterTopic,
  answer: string,
): { id: ButterTier; score: number; name: string; value: string } | null {
  const match = closestAnswer(topic, answer)
  if (!match) return null
  const index = match.index
  // The card's own tier for this answer is the real one; position is only used
  // for a card that arrived without tiers.
  const stored = topic.tiers?.[index]
  const ratio = topic.answers.length > 1 ? index / (topic.answers.length - 1) : 1
  const band = stored
    ? { tier: stored }
    : (RARITY_BANDS.find((entry) => ratio <= entry.max) ?? RARITY_BANDS[RARITY_BANDS.length - 1])
  const tier = TIERS[band.tier]
  return { id: band.tier, score: tier.score, name: tier.name, value: match.value }
}

/** Meter segments arrive from D1 as JSON; anything malformed is dropped. */
export function parseSegs(value: unknown): MeterSeg[] {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((seg): seg is MeterSeg =>
        Boolean(seg) && typeof seg === 'object' && seg.tier in TIERS && Number.isFinite(Number(seg.amt)),
      )
      .map((seg) => ({ tier: seg.tier, amt: Number(seg.amt) }))
      .slice(-80)
  } catch {
    return []
  }
}
