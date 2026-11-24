import { Hono, type Context } from 'hono'

import type { AppContext } from '../env'
import { diveDay, diveCard, rateDiveAnswer, today } from '../butter-dive-bank'
import { BUTTER_TOPICS, TIERS, answerTier, closestAnswer, type ButterTopic } from '../butter-topics'

/**
 * Krillion's other modes, on Butter's own server.
 *
 * The front door of the real site is one daily dive, and behind it sit five
 * packs of thirty seven-round games each (classic/endless, movies, sports,
 * geography, lexicon) plus the archive of days that have already surfaced. The
 * pack copy, units, scoring bands and round count below are read out of their
 * shipped client; the cards are dealt from Ink's own bank, because their
 * per-pack decks and rarity tables live behind a server that only answers for
 * today's daily dive (`/api/reveal` is 403 for any other day).
 *
 * Nothing here keeps a receipt or a leaderboard: a run is seven prompts, graded
 * against a card, and the score is the sum of their own tier scores.
 */

const ROUNDS = 7
const GAMES_PER_PACK = 30
const MAX_SCORE = 700

/** Their bands, with the verdict each pack prints under the score. */
const BANDS = [
  { min: 0, tier: 'plankton' as const },
  { min: 150, tier: 'schooler' as const },
  { min: 250, tier: 'rare' as const },
  { min: 350, tier: 'deepcut' as const },
  { min: 450, tier: 'krillion' as const },
]

type Pack = {
  id: string
  name: string
  tagline: string
  badge: string
  diveLabel: string
  /** What one point of score is worth in the pack's own unit. */
  unit: string
  /** Score → the distance the result screen prints. */
  distance: (score: number) => string
  /** Set when the real pack asks for money; Ink's copy of it does not. */
  paid: boolean
  accent: string
  bandVerdicts: Record<number, string>
}

export const PACKS: Pack[] = [
  {
    id: 'classic',
    name: 'THE ENDLESS DIVE',
    tagline: 'every prompt, every depth · the original ∞',
    badge: '∞',
    diveLabel: 'endless dive',
    unit: 'm',
    distance: (score) => `-${(10 * score).toLocaleString('en-US')}m`,
    paid: true,
    accent: '#4de3ff',
    bandVerdicts: {
      0: 'The surface took you back. The water is still there.',
      151: 'A steady descent. The light holds.',
      251: 'Past the shelf. The pressure is doing the work now.',
      351: 'Deep water, no line. Only the rare answers go this far.',
      450: 'One in a krillion. The trench floor has your name on it.',
    },
  },
  {
    id: 'movies',
    name: 'AT THE MOVIES',
    tagline: '30 pictures · a night drive down the boulevard',
    badge: '🎬',
    diveLabel: 'picture',
    unit: 'blocks',
    distance: (score) => `${(score / 10).toLocaleString('en-US')} blocks`,
    paid: true,
    accent: '#ffd166',
    bandVerdicts: {
      0: 'Straight to video. The boulevard is still long.',
      151: 'A solid matinee. The crowd nods along.',
      251: 'Festival darling. Critics take notes.',
      351: 'Cult classic. Midnight screenings forever.',
      450: 'One in a krillion. Your star is on the boulevard.',
    },
  },
  {
    id: 'sports',
    name: 'SPORTS',
    tagline: '30 games · run the gauntlet, court to podium',
    badge: '🏆',
    diveLabel: 'game',
    unit: 'yds',
    distance: (score) => `${(10 * score).toLocaleString('en-US')} yds`,
    paid: true,
    accent: '#5ef2a4',
    bandVerdicts: {
      0: 'Sent down to the practice squad. Run it back.',
      151: 'Solid starter. The tape holds up.',
      251: 'All-conference. Past midfield and pulling away.',
      351: 'Hall of Fame ballot. The jumbotron knows your name.',
      450: 'One in a krillion. Top of the podium.',
    },
  },
  {
    id: 'geography',
    name: 'GEOGRAPHY',
    tagline: '30 expeditions · around the world in seven answers',
    badge: '🧭',
    diveLabel: 'expedition',
    unit: '°',
    distance: (score) => `${Math.round(3.6 * score)}°`,
    paid: true,
    accent: '#9d7bff',
    bandVerdicts: {
      0: 'Never left the harbor. The world stayed still.',
      151: 'A stamped passport and a sunburn. Respectable.',
      251: 'Three continents under your feet. The compass trusts you now.',
      351: 'The horizon keeps giving way. Home is closer ahead than behind.',
      450: 'One in a krillion. Around the world in seven answers.',
    },
  },
  {
    id: 'lexicon',
    name: 'Words & Language (English)',
    tagline: '30 chapters · fill the notebook, word by word',
    badge: '✒️',
    diveLabel: 'chapter',
    unit: 'wds',
    distance: (score) => `${(10 * score).toLocaleString('en-US')} wds`,
    paid: false,
    accent: '#f2e7c6',
    bandVerdicts: {
      0: 'A doodle in the margin. The page waits.',
      151: 'A tidy paragraph. The nib is warming up.',
      251: 'Pages turn on their own now. The inkwell worries.',
      351: 'Half the notebook in one sitting. Ink-stained fingers.',
      450: 'One in a krillion. Bound, shelved, quoted.',
    },
  },
]

/**
 * What makes a prompt belong to a pack. Their decks are curated per pack on a
 * server we cannot read, so the filter is the next best thing: the same
 * subjects, chosen from the cards Ink already has.
 */
const THEMES: Record<string, RegExp> = {
  movies:
    /\b(movie|movies|film|films|actor|actress|director|oscar|cinema|sequel|prequel|sitcom|tv|television|show|series|cartoon|anime|character|screen|hollywood|disney|pixar|marvel|superhero|documentary|scene|cast)\b/i,
  sports:
    /\b(sport|sports|team|player|olympi[ck]|league|cup|ball|coach|athlet|nfl|nba|mlb|nhl|soccer|football|baseball|basketball|tennis|golf|boxing|hockey|cricket|rugby|marathon|medal|podium|stadium|match|tournament)\b/i,
  geography:
    /\b(country|countries|city|cities|river|lake|ocean|sea|island|capital|continent|desert|volcano|mountain|geograph|border|province|region|landmark|tower|bridge|airport|currency|valley|coast|peninsula|strait|delta|archipelago)\b/i,
  lexicon:
    /\b(word|words|letter|letters|rhyme|synonym|antonym|phrase|idiom|language|spell|spelling|vowel|consonant|palindrome|anagram|prefix|suffix|grammar|pun|slang|acronym|noun|verb|adjective|alphabet|definition)\b/i,
}

function seeded(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hash(text: string): number {
  let value = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index)
    value = Math.imul(value, 16777619)
  }
  return value >>> 0
}

function packById(id: string): Pack | undefined {
  return PACKS.find((pack) => pack.id === id)
}

/** Every card a pack may deal: its own subject, and nothing else. */
function poolFor(packId: string): ButterTopic[] {
  const all = BUTTER_TOPICS.filter((topic) => topic.prompt && topic.answers.length >= 40)
  const theme = THEMES[packId]
  if (!theme) return all
  return all.filter((topic) => theme.test(topic.prompt))
}

/** The seven cards of one game, the same seven every time it is asked. */
function promptsFor(packId: string, game: number): { id: string; text: string }[] {
  // A subject short of seven cards takes the rest of the bank as top-up, but
  // only after its own deck. A subject is a promise: a Movies game that deals
  // "name a video game console" is not a Movies game, which is what shuffling
  // the subject and the whole bank together produced.
  const themed = poolFor(packId)
  const pool =
    themed.length >= ROUNDS
      ? themed
      : [
          ...themed,
          ...BUTTER_TOPICS.filter(
            (topic) => topic.prompt && topic.answers.length >= 40 && !themed.includes(topic),
          ),
        ]
  const random = seeded(hash(`${packId}:${game}`))
  const order = pool.map((_, index) => index)
  for (let index = order.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1))
    ;[order[index], order[swap]] = [order[swap], order[index]]
  }
  return order.slice(0, ROUNDS).map((index, position) => ({ id: `p${position + 1}`, text: pool[index].prompt }))
}

function cardFor(packId: string, game: number, promptId: string): ButterTopic | undefined {
  const prompt = promptsFor(packId, game).find((entry) => entry.id === promptId)
  return prompt ? BUTTER_TOPICS.find((topic) => topic.prompt === prompt.text) : undefined
}

function crossSite(c: Context<AppContext>): boolean {
  const origin = c.req.header('origin')
  if (!origin) return false
  try {
    return new URL(origin).host !== new URL(c.req.url).host
  } catch {
    return true
  }
}

function gameNumber(value: string): number {
  const game = Number(value)
  return Number.isInteger(game) && game >= 1 && game <= GAMES_PER_PACK ? game : 0
}

export const butterModes = new Hono<AppContext>()

/** The rack: five packs, their copy, and their bands. */
butterModes.get('/packs', (c) => {
  return c.json(
    {
      rounds: ROUNDS,
      gamesPerPack: GAMES_PER_PACK,
      maxScore: MAX_SCORE,
      bands: BANDS,
      packs: PACKS.map(({ distance, bandVerdicts, ...pack }) => ({
        ...pack,
        bands: BANDS.map((band) => ({
          ...band,
          verdict: bandVerdicts[band.min] ?? '',
          range: `${band.min}–${band.min === 0 ? 149 : band.min === 450 ? MAX_SCORE : band.min + 99}`,
        })),
      })),
    },
    200,
    { 'cache-control': 'public, max-age=300' },
  )
})

/** One game of one pack: seven prompts, no answers. */
butterModes.get('/packs/:pack/:game', (c) => {
  const pack = packById(c.req.param('pack'))
  const game = gameNumber(c.req.param('game'))
  if (!pack) return c.json({ error: 'No such pack.' }, 404)
  if (!game) return c.json({ error: `Games run 1 to ${GAMES_PER_PACK}.` }, 400)
  return c.json(
    {
      pack: { id: pack.id, name: pack.name, tagline: pack.tagline, badge: pack.badge, diveLabel: pack.diveLabel, unit: pack.unit, accent: pack.accent },
      game,
      rounds: ROUNDS,
      maxScore: MAX_SCORE,
      bands: BANDS.map((band) => ({
        ...band,
        verdict: pack.bandVerdicts[band.min] ?? '',
        range: `${band.min}–${band.min === 0 ? 149 : band.min === 450 ? MAX_SCORE : band.min + 99}`,
      })),
      distance: pack.distance(MAX_SCORE),
      prompts: promptsFor(pack.id, game),
    },
    200,
    { 'cache-control': 'public, max-age=300' },
  )
})

/**
 * Grade one answer against the card behind it. Same table as a daily dive: the
 * card's own tier decides the score, a near miss comes back as a correction
 * instead of spending the round, and a rejection costs nothing.
 */
butterModes.post('/packs/:pack/:game/submit', async (c) => {
  if (crossSite(c)) return c.json({ error: 'Cross-site request refused.' }, 403)
  const pack = packById(c.req.param('pack'))
  const game = gameNumber(c.req.param('game'))
  if (!pack) return c.json({ error: 'No such pack.' }, 404)
  if (!game) return c.json({ error: `Games run 1 to ${GAMES_PER_PACK}.` }, 400)
  const body = (await c.req.json().catch(() => ({}))) as { round?: string; answer?: string }
  const promptId = String(body.round ?? '')
  const answer = String(body.answer ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 256)
  if (!answer) return c.json({ error: 'Say something first.' }, 400)
  const card = cardFor(pack.id, game, promptId)
  if (!card) return c.json({ error: 'That prompt is not in this game.' }, 404)
  const tier = answerTier(card, answer)
  if (tier) {
    return c.json(
      {
        accepted: true,
        answer: tier.value,
        tier: tier.id,
        score: tier.score,
        quip: TIERS[tier.id as keyof typeof TIERS]?.blurb ?? '',
      },
      200,
      { 'cache-control': 'no-store' },
    )
  }
  const near = closestAnswer(card, answer)
  if (near) return c.json({ accepted: false, correction: near.value }, 200, { 'cache-control': 'no-store' })
  return c.json(
    { accepted: false, rejectionReason: 'Not on this card.' },
    200,
    { 'cache-control': 'no-store' },
  )
})

/** The catch: every card of the game, with its answers and their tiers. */
butterModes.get('/packs/:pack/:game/reveal', (c) => {
  const pack = packById(c.req.param('pack'))
  const game = gameNumber(c.req.param('game'))
  if (!pack) return c.json({ error: 'No such pack.' }, 404)
  if (!game) return c.json({ error: `Games run 1 to ${GAMES_PER_PACK}.` }, 400)
  const rounds = promptsFor(pack.id, game).map((prompt) => {
    const card = BUTTER_TOPICS.find((topic) => topic.prompt === prompt.text)
    return {
      id: prompt.id,
      text: prompt.text,
      answers: (card?.answers ?? []).map((answer, index) => {
        const tier = (card?.tiers?.[index] ?? 'schooler') as keyof typeof TIERS
        return { answer, tier, score: TIERS[tier]?.score ?? 0 }
      }),
    }
  })
  return c.json({ pack: pack.id, game, rounds }, 200, { 'cache-control': 'public, max-age=600' })
})

/** The archive: every day whose dive can still be replayed, newest first. */
butterModes.get('/archive', (c) => {
  const days = Math.min(60, Math.max(1, Number(c.req.query('days') ?? 21) || 21))
  const out: { date: string; dayNumber: number; prompts: string[] }[] = []
  const base = Date.parse(`${today()}T00:00:00Z`)
  for (let back = 0; back < days; back += 1) {
    const date = new Date(base - back * 86_400_000).toISOString().slice(0, 10)
    const day = diveDay(date)
    out.push({ date, dayNumber: day.dayNumber, prompts: day.prompts.slice(0, 2).map((prompt) => prompt.text) })
  }
  return c.json({ days: out }, 200, { 'cache-control': 'public, max-age=600' })
})

function archiveDate(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const at = Date.parse(`${value}T00:00:00Z`)
  if (!Number.isFinite(at)) return null
  return at > Date.parse(`${today()}T00:00:00Z`) ? null : value
}

/** One archived day, dealt from the same deck that day used. */
butterModes.get('/archive/:date', (c) => {
  const date = archiveDate(c.req.param('date'))
  if (!date) return c.json({ error: 'No such day.' }, 404)
  const day = diveDay(date)
  const classic = PACKS[0]
  return c.json(
    {
      date,
      dayNumber: day.dayNumber,
      rounds: ROUNDS,
      maxScore: MAX_SCORE,
      resetsAt: day.resetsAt,
      bands: BANDS.map((band) => ({
        ...band,
        verdict: classic.bandVerdicts[band.min] ?? '',
        range: `${band.min}–${band.min === 0 ? 149 : band.min === 450 ? MAX_SCORE : band.min + 99}`,
      })),
      prompts: day.prompts,
    },
    200,
    { 'cache-control': 'public, max-age=600' },
  )
})

butterModes.post('/archive/:date/submit', async (c) => {
  if (crossSite(c)) return c.json({ error: 'Cross-site request refused.' }, 403)
  const date = archiveDate(c.req.param('date'))
  if (!date) return c.json({ error: 'No such day.' }, 404)
  const body = (await c.req.json().catch(() => ({}))) as { round?: string; answer?: string }
  const promptId = String(body.round ?? '')
  const answer = String(body.answer ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 256)
  if (!answer) return c.json({ error: 'Say something first.' }, 400)
  return c.json(rateDiveAnswer(promptId, answer, date), 200, { 'cache-control': 'no-store' })
})

butterModes.get('/archive/:date/reveal', (c) => {
  const date = archiveDate(c.req.param('date'))
  if (!date) return c.json({ error: 'No such day.' }, 404)
  const day = diveDay(date)
  const rounds = day.prompts.map((prompt) => {
    const card = diveCard(prompt.id, date)
    return {
      id: prompt.id,
      text: card?.prompt ?? prompt.text,
      answers: (card?.answers ?? []).map((answer, index) => {
        const tier = (card?.tiers?.[index] ?? 'schooler') as keyof typeof TIERS
        return { answer, tier, score: TIERS[tier]?.score ?? 0 }
      }),
    }
  })
  return c.json({ date, dayNumber: day.dayNumber, rounds }, 200, { 'cache-control': 'public, max-age=600' })
})
