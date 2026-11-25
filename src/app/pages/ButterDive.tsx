import { type FormEvent, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'

import { ButterMenu } from '../components/ButterMenu'
import { Fore } from './dive-fore'
import { Sea } from './dive-sea'

/**
 * The Daily Dive — Butter's seven-prompt dive, laid out on Puffer Party's own
 * stylesheet (`.ds-*` in `src/butter-party.css`).
 *
 * Same shape as the real dive: seven prompts, twenty-five seconds each, one
 * answer per prompt, rarity decides points, every point sinks you ten metres
 * and 700 points is the trench floor. The prompts, the tiers and the spelling
 * corrections come from the shipped game through `/api/butter-dive`, so the
 * questions are today's questions and the rarities are today's rarities.
 */

type TierId = 'plankton' | 'tooclever' | 'schooler' | 'rare' | 'deepcut' | 'krillion'
type Phase = 'loading' | 'intro' | 'preview' | 'answering' | 'sinking' | 'feedback' | 'done' | 'error'

type Prompt = { id: string; text: string }
type Day = { date: string; dayNumber: number; resetsAt?: string; prompts: Prompt[]; source?: 'live' | 'local' | 'locked' }
type Result = {
  promptId: string
  promptText: string
  rawAnswer: string | null
  answer: string | null
  tier: TierId | null
  score: number
  quip?: string
}

const ANSWER_MS = 25_000
const PREVIEW_MS = 3_000
const ROUNDS = 7
const METRES_PER_POINT = 10
const MAX_ANSWER_LENGTH = 256
const PLAYER_KEY = 'butter.dive.player'

/** The shipped tier ladder: name, points, depth and the line under the banner. */
const TIERS: Record<TierId, { name: string; score: number; color: string; blurb: string }> = {
  plankton: { name: 'Margarine', score: 10, color: '#8fa3c4', blurb: 'Not even butter.' },
  tooclever: {
    name: 'Whipped',
    score: 15,
    color: '#ff9f43',
    blurb: 'Puffed up. Mostly air.',
  },
  schooler: { name: 'Salted', score: 30, color: '#4de3ff', blurb: 'The standard block. Solid.' },
  rare: { name: 'Cultured', score: 60, color: '#ff5252', blurb: 'Tangier. Takes work to find.' },
  deepcut: { name: 'Brown Butter', score: 85, color: '#9d7bff', blurb: 'Nutty, dark, and hard-won.' },
  krillion: {
    name: 'One in a Butter Churn',
    score: 100,
    color: '#ffd166',
    blurb: 'The designated gem. Churn floor.',
  },
}

/** Emoji and depth for each tier, straight from the shipped table: the share of
 *  the card an answer of this tier should reach, which is what the dive log
 *  plots against. */
const TIER_EMOJI: Record<TierId, string> = {
  plankton: '🧈',
  tooclever: '🌀',
  schooler: '🧂',
  rare: '🥛',
  deepcut: '🥜',
  krillion: '✨',
}
const TIER_DEPTH: Record<TierId, number> = {
  plankton: 0.08,
  tooclever: 0.18,
  schooler: 0.36,
  rare: 0.6,
  deepcut: 0.82,
  krillion: 0.97,
}

/** How long an answer takes to fall, per tier, read out of the shipped table. */
const SINK_MS: Record<TierId, number> = {
  plankton: 3400,
  tooclever: 3000,
  schooler: 3000,
  rare: 3400,
  deepcut: 4300,
  krillion: 4600,
}

/** The sideways wobble the answer chip swims through while it sinks, with the
 *  tilt the engine pairs with it. Every tier has its own curve. */
function chipWobble(tier: TierId, t: number): { x: number; rot: number } {
  switch (tier) {
    case 'plankton': {
      const x = 36 * Math.sin(7 * t) * (1 - 0.25 * t)
      return { x, rot: 0.55 * x }
    }
    case 'tooclever':
      return { x: 7 * Math.sin(42 * t) + (Math.random() - 0.5) * 4, rot: (Math.random() - 0.5) * 6 }
    case 'krillion': {
      const x = Math.sin(24 * t) * (1 - t) * 26
      return { x, rot: 0.5 * x }
    }
    default: {
      const x = Math.sin(16 * t) * (1 - t) * 14
      return { x, rot: 0.4 * x }
    }
  }
}

/** The water column, in metres, exactly as the real dive labels it. */
const AMBIENT: [number, string, 'L' | 'R', boolean?][] = [
  [60, 'light begins to fade', 'L'],
  [200, 'most sunlight stops here', 'R'],
  [332, 'deepest scuba dive ever — 332m', 'R'],
  [385, 'sperm whales hunt below here', 'L'],
  [535, 'emperor penguins dive this deep', 'R'],
  [660, 'pressure: 67x the surface', 'L'],
  [800, 'siphonophore drift zone', 'R'],
  [1040, 'THE MIDNIGHT ZONE', 'L', true],
  [1240, 'anglerfish territory', 'R'],
  [1550, 'sperm whales duel giant squid here', 'L'],
  [1850, 'giant squid territory', 'R'],
  [2150, 'colossal squid eyes: football-sized', 'L'],
  [2500, 'the water is 2°C and utterly black', 'R'],
  [3000, 'THE ABYSSAL ZONE', 'L', true],
  [3800, 'the Titanic rests here — 3,800m', 'R'],
  [4400, 'cusk eels patrol the plain', 'L'],
  [4900, 'the abyssal plain stretches out', 'R'],
  [5500, 'deeper than most submarines survive', 'L'],
  [6000, 'THE HADAL ZONE', 'R', true],
  [6500, 'named for Hades. fitting.', 'L'],
  [7000, 'the trench floor — a perfect dive ends here', 'R', true],
]

const HOW_TO_PLAY = [
  '7 prompts a day. same for everyone.',
  '25 seconds to name one thing.',
  'rare answers score big. obvious ones float.',
  'the pick that feels clever? everyone reached for it too.',
  'every point sinks you 10 metres. 700 is the trench.',
  'one dive per day. no second chances.',
]

/** The shipped score bands: what your seven answers add up to, and the line the
 *  results page reads out for the band you landed in. */
const SCORE_BANDS: { min: number; tier: TierId; range: string; verdict: string }[] = [
  { min: 0, tier: 'plankton', range: '0–150', verdict: 'Margarine. Not even butter, and plenty of ocean left.' },
  { min: 151, tier: 'schooler', range: '151–250', verdict: 'Salted. The standard block. Solid.' },
  { min: 251, tier: 'rare', range: '251–350', verdict: 'Cultured. Below the thermocline. Nice.' },
  { min: 351, tier: 'deepcut', range: '351–449', verdict: 'Brown butter. Nutty, dark, seriously deep.' },
  { min: 450, tier: 'krillion', range: '450+', verdict: 'One in a butter churn. Trench dweller. Absurd.' },
]

function bandFor(score: number) {
  return [...SCORE_BANDS].reverse().find((band) => score >= band.min) ?? SCORE_BANDS[0]
}

/** The tier medallion the dive log and the bearing both draw. */
function TierIcon({ tier, size = 20, glow = false }: { tier: TierId | 'miss'; size?: number; glow?: boolean }) {
  if (tier === 'miss') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#3d4f6e" strokeWidth={1.8} strokeLinecap="round" aria-hidden>
        <circle cx="12" cy="12" r="7.5" strokeDasharray="2.8 4" />
      </svg>
    )
  }
  return (
    <img
      src={`/tiers/${tier}.png`}
      alt=""
      width={size}
      height={size}
      draggable={false}
      aria-hidden
      style={{
        imageRendering: 'pixelated',
        filter: glow ? `drop-shadow(0 0 ${Math.max(4, size / 4)}px ${TIERS[tier].color})` : undefined,
      }}
    />
  )
}

/* ------------------------------------------------ the result screen's parts */

/** The shipped ladder, shallowest first: the answer sheet's tier chips walk it. */
const TIER_ORDER: TierId[] = ['plankton', 'tooclever', 'schooler', 'rare', 'deepcut', 'krillion']
/** Seven prompts, a hundred points at the top of the ladder: the curve's x axis. */
const MAX_DAY_SCORE = ROUNDS * 100

/** One answer on a day's card, as the sheet reports it. */
type SheetAnswer = { answer: string; tier: TierId; score?: number; quip?: string; aliases?: string[] }
type SheetPrompt = { id: string; text: string; answers: SheetAnswer[]; resultsNote?: string }

/** `formatPercentile`, exactly: two decimals only at the very top of the field. */
function formatPercentile(value: number): string {
  return value >= 99.5 ? value.toFixed(2) : String(value)
}

/**
 * The score curve under the result, drawn the way the shipped one is: twenty
 * histogram buckets smoothed with a 1-4-6-4-1 kernel, laid across 320 units,
 * joined with Catmull-Rom control points into a filled hill, ticked every
 * hundred points, and marked at your score — everything to the left of the
 * marker filled in as the share of players you beat.
 */
function ScoreCurve({
  dist,
  score,
  betterThan,
}: {
  dist: number[]
  score: number
  betterThan: number | null
}) {
  const kernel = [0.06, 0.24, 0.4, 0.24, 0.06]
  const smoothed = dist.map((_, index) => {
    let total = 0
    let weight = 0
    for (let offset = -2; offset <= 2; offset += 1) {
      const at = index + offset
      if (at < 0 || at >= dist.length) continue
      const share = kernel[offset + 2]
      total += dist[at] * share
      weight += share
    }
    return weight > 0 ? total / weight : 0
  })
  const peak = Math.max(...smoothed)
  if (!(peak > 0)) return null

  const points: [number, number][] = [[0, 78]]
  smoothed.forEach((value, index) => {
    points.push([((index + 0.5) / smoothed.length) * 320, 78 - (value / peak) * 68])
  })
  points.push([320, 78])

  const x = (Math.min(score, MAX_DAY_SCORE) / MAX_DAY_SCORE) * 320
  let y = 78
  for (let index = 0; index < points.length - 1; index += 1) {
    const [x1, y1] = points[index]
    const [x2, y2] = points[index + 1]
    if (x >= x1 && x <= x2) {
      y = y1 + (y2 - y1) * (x2 === x1 ? 0 : (x - x1) / (x2 - x1))
      break
    }
  }

  let curve = `M ${points[0][0]} ${points[0][1]}`
  for (let index = 0; index < points.length - 1; index += 1) {
    const before = points[Math.max(0, index - 1)]
    const from = points[index]
    const to = points[index + 1]
    const after = points[Math.min(points.length - 1, index + 2)]
    const c1x = from[0] + (to[0] - before[0]) / 6
    const c1y = from[1] + (to[1] - before[1]) / 6
    const c2x = to[0] - (after[0] - from[0]) / 6
    const c2y = to[1] - (after[1] - from[1]) / 6
    curve += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${to[0]} ${to[1]}`
  }
  const hill = `${curve} L 320 78 L 0 78 Z`
  const labelX = Math.min(Math.max(x, 14), 306)

  return (
    <div className="mt-3">
      <svg
        viewBox="0 0 320 96"
        className="w-full h-auto"
        role="img"
        aria-label={
          betterThan === null
            ? "Score distribution of today's players"
            : `Score distribution of today's players; your score beats ${formatPercentile(betterThan)}% of them`
        }
      >
        <defs>
          <linearGradient id="pc-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-lumen-cyan)" stopOpacity="0.45" />
            <stop offset="100%" stopColor="var(--color-lumen-cyan)" stopOpacity="0.02" />
          </linearGradient>
          <clipPath id="pc-beaten">
            <rect x="0" y="0" width={x} height="96" />
          </clipPath>
        </defs>
        <path d={hill} fill="url(#pc-fill)" opacity="0.28" />
        <path d={hill} fill="url(#pc-fill)" clipPath="url(#pc-beaten)" />
        <path d={curve} fill="none" stroke="var(--color-lumen-cyan)" strokeWidth="1.4" strokeOpacity="0.75" />
        <line x1="0" y1="78" x2="320" y2="78" stroke="var(--hairline)" />
        {[100, 200, 300, 400, 500, 600].map((tick) => {
          const at = (tick / MAX_DAY_SCORE) * 320
          const crowded = Math.abs(at - x) < 18
          return (
            <g key={tick}>
              <line x1={at} y1="78" x2={at} y2="81.5" stroke="var(--color-drift)" strokeOpacity="0.5" />
              {!crowded && (
                <text x={at} y="90" textAnchor="middle" className="font-mono-ui" fontSize="9" fill="var(--color-drift)" opacity="0.55">
                  {tick}
                </text>
              )}
            </g>
          )
        })}
        <line x1={x} y1={Math.min(y, 74) - 3} x2={x} y2="78" stroke="var(--color-lumen-pink)" strokeWidth="1.2" />
        <circle cx={x} cy={y} r="2.6" fill="var(--color-lumen-pink)" />
        <text x={labelX} y="90" textAnchor="middle" className="font-mono-ui" fontSize="9" letterSpacing="0.12em" fill="var(--color-lumen-pink)">
          YOU
        </text>
        <text x="0" y="90" className="font-mono-ui" fontSize="9" fill="var(--color-drift)" opacity="0.6">
          0
        </text>
        <text x="320" y="90" textAnchor="end" className="font-mono-ui" fontSize="9" fill="var(--color-drift)" opacity="0.6">
          {MAX_DAY_SCORE}
        </text>
      </svg>
      {betterThan !== null && (
        <p
          className="font-mono-ui text-[13px] tracking-[0.14em] uppercase text-lumen-cyan mt-1"
          style={{ textShadow: '0 0 6px var(--color-abyss), 0 1px 0 var(--color-abyss)' }}
        >
          better than {formatPercentile(betterThan)}% of today&apos;s players
        </p>
      )}
    </div>
  )
}

/**
 * One round's answer sheet: the tier chips, a search box once a card is long
 * enough to need one, and the answers themselves in the card's own order, each
 * with its tier icon, its quip and the points it pays. Your own answer is lit.
 */
function AnswerSheet({ answers, playerAnswer }: { answers: SheetAnswer[]; playerAnswer: string | null }) {
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(100)
  const [tier, setTier] = useState<'all' | TierId>('all')
  const listRef = useRef<HTMLUListElement | null>(null)
  const counts = useMemo(() => {
    const map = new Map<TierId, number>()
    for (const answer of answers) map.set(answer.tier, (map.get(answer.tier) ?? 0) + 1)
    return map
  }, [answers])
  const filtered = useMemo(
    () => (tier === 'all' ? answers : answers.filter((answer) => answer.tier === tier)),
    [answers, tier],
  )
  const matched = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return filtered
    const named: SheetAnswer[] = []
    const aliased: SheetAnswer[] = []
    for (const answer of filtered) {
      if (answer.answer.toLowerCase().includes(needle)) named.push(answer)
      else if (answer.aliases?.some((alias) => alias.toLowerCase().includes(needle))) aliased.push(answer)
    }
    return [...named, ...aliased]
  }, [filtered, query])
  const shown = matched.slice(0, limit)
  const more = shown.length < matched.length
  const mine = playerAnswer?.toLowerCase()
  const chips =
    answers.length > 100
      ? [
          { id: 'all' as const, name: 'All', color: 'var(--color-foam)' },
          ...TIER_ORDER.map((id) => ({ id, name: TIERS[id].name, color: TIERS[id].color })),
        ].filter((chip) => chip.id === 'all' || counts.has(chip.id))
      : []

  return (
    <div className="mt-2 mb-1 pl-[27px]">
      {chips.length > 0 && (
        <div role="group" aria-label="Filter answers by tier" className="mb-2 flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              aria-pressed={tier === chip.id}
              onClick={() => {
                setTier(chip.id)
                setQuery('')
                setLimit(100)
                if (listRef.current) listRef.current.scrollTop = 0
              }}
              className="rounded border px-2 py-1 font-mono-ui text-[12px]"
              style={{
                color: chip.color,
                borderColor: tier === chip.id ? chip.color : 'var(--hairline)',
                background: tier === chip.id ? 'rgba(255,255,255,0.08)' : 'transparent',
              }}
            >
              {chip.name}{' '}
              <span className="opacity-70">
                {(chip.id === 'all' ? answers.length : (counts.get(chip.id) ?? 0)).toLocaleString()}
              </span>
            </button>
          ))}
        </div>
      )}
      {answers.length > 100 && (
        <input
          type="search"
          aria-label="Search answers"
          placeholder={tier === 'all' ? 'Search all answers…' : `Search ${TIERS[tier].name} answers…`}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setLimit(100)
          }}
          className="w-full mb-2 rounded border px-2 py-1 text-sm text-foam"
          style={{ background: 'rgba(16,29,51,0.5)', borderColor: 'var(--hairline)' }}
        />
      )}
      <ul
        ref={listRef}
        aria-label="Answers"
        tabIndex={0}
        onScroll={(event) => {
          const el = event.currentTarget
          if (more && el.scrollHeight - el.scrollTop - el.clientHeight <= 200) {
            setLimit(Math.min(limit + 100, matched.length))
          }
        }}
        className="flex flex-col gap-1 max-h-72 overflow-y-auto pr-1"
      >
        {shown.map((answer) => (
          <li
            key={answer.answer}
            className="flex items-start gap-2 px-1.5 py-1"
            style={answer.answer.toLowerCase() === mine ? { background: 'rgba(16,29,51,0.5)' } : undefined}
          >
            <span className="mt-0.5">
              <TierIcon tier={answer.tier} size={14} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="text-[14px] text-foam">{answer.answer}</span>
              {answer.answer.toLowerCase() === mine && (
                <span className="ml-2 font-mono-ui text-[10px] tracking-[0.14em] uppercase text-lumen-cyan">you</span>
              )}
              {answer.quip && <span className="block text-[13px] leading-snug text-drift/70">{answer.quip}</span>}
            </span>
            <span
              className="font-mono-ui text-[11px] tabular-nums ml-auto shrink-0 min-w-7 text-right"
              style={{ color: TIERS[answer.tier].color }}
            >
              +{answer.score ?? TIERS[answer.tier].score}
            </span>
          </li>
        ))}
      </ul>
      {answers.length > 100 && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 font-mono-ui text-[12px] text-drift/70">
          <span role="status">
            {shown.length === 0
              ? 'No matching answers'
              : `${shown.length.toLocaleString()} of ${matched.length.toLocaleString()} answers`}
          </span>
          {more && <span>Scroll for more</span>}
        </div>
      )}
    </div>
  )
}

/** Every dive this browser has finished, newest key last. The results page's
 *  logbook is read straight off these, the way the real one reads its history. */
function diveHistory(): Record<string, Result[]> {
  const out: Record<string, Result[]> = {}
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (!key || !key.startsWith('butter.dive.done.')) continue
      const date = key.slice('butter.dive.done.'.length)
      const raw = localStorage.getItem(key)
      const parsed = raw ? (JSON.parse(raw) as { results?: Result[] }) : null
      if (parsed && Array.isArray(parsed.results)) out[date] = parsed.results
    }
  } catch {
    /* a blocked storage just means no logbook */
  }
  return out
}

function logbookOf(today: string) {
  const history = diveHistory()
  const dates = Object.keys(history).sort()
  const total = dates.reduce((sum, date) => sum + history[date].reduce((n, row) => n + row.score, 0), 0)
  const best = dates.reduce((top, date) => Math.max(top, history[date].reduce((n, row) => n + row.score, 0)), 0)
  let streak = 0
  let cursor = today
  while (history[cursor]) {
    streak += 1
    const at = new Date(`${cursor}T12:00:00Z`)
    at.setUTCDate(at.getUTCDate() - 1)
    cursor = at.toISOString().slice(0, 10)
    if (streak > 400) break
  }
  return { played: dates.length, average: dates.length ? Math.round(total / dates.length) : 0, best, streak }
}

/**
 * The result screen's "got an idea for a question?" box, copied from the shipped
 * DoneView: it posts `{ playerId, text }` to `/api/suggest` and shows their three
 * answers — `logged`, `that's plenty for today`, and the one-line error.
 */
function SuggestQuestion() {
  const [text, setText] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'throttled' | 'error'>('idle')

  async function submit(event: FormEvent) {
    event.preventDefault()
    const trimmed = text.trim()
    if (trimmed.length < 3 || state === 'sending') return
    setState('sending')
    try {
      const res = await fetch('/api/butter-dive/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: playerId(), text: trimmed }),
      })
      const body = (await res.json().catch(() => null)) as { ok?: boolean; reason?: string } | null
      if (body?.ok) setState('sent')
      else if (body?.reason === 'throttled') setState('throttled')
      else setState('error')
    } catch {
      setState('error')
    }
  }

  if (state === 'sent') {
    return (
      <p className="font-mono-ui text-[12px] tracking-[0.12em] uppercase text-drift/60">
        logged — it might surface in a future dive.
      </p>
    )
  }
  if (state === 'throttled') {
    return (
      <p className="font-mono-ui text-[12px] tracking-[0.12em] uppercase text-drift/60">
        that&apos;s plenty for today — resurface tomorrow.
      </p>
    )
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-1.5">
      <label
        htmlFor="suggest-question"
        className="font-mono-ui text-[12px] tracking-[0.12em] uppercase text-drift/60"
      >
        got an idea for a question? tell us what to ask
      </label>
      <div className="flex items-baseline gap-3 max-w-sm">
        <input
          id="suggest-question"
          value={text}
          onChange={(event) => {
            setText(event.target.value)
            if (state === 'error') setState('idle')
          }}
          maxLength={160}
          placeholder="name a type of cloud…"
          className="flex-1 bg-transparent border-b border-drift/40 focus:border-lumen-cyan outline-none font-mono-ui text-[13px] text-foam placeholder:text-drift/40 py-1"
        />
        <button
          type="submit"
          disabled={text.trim().length < 3 || state === 'sending'}
          className="font-mono-ui text-[12px] tracking-[0.12em] uppercase underline text-drift hover:text-lumen-cyan disabled:opacity-40 disabled:no-underline"
        >
          {state === 'sending' ? 'sending…' : 'submit'}
        </button>
      </div>
      {state === 'error' && (
        <p className="font-mono-ui text-[11px] tracking-[0.12em] uppercase text-lumen-pink/80">
          couldn&apos;t send — try again in a moment.
        </p>
      )}
    </form>
  )
}

function playerId(): string {
  let id = localStorage.getItem(PLAYER_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(PLAYER_KEY, id)
  }
  return id
}

function runIdFor(date: string): string {
  return `dive_${date}_${Math.random().toString(36).slice(2, 10)}`
}

type SavedGame = { runId: string; results: Result[]; round: number; phase: 'intro' | 'play' }

function loadGame(date: string): SavedGame | null {
  try {
    const raw = localStorage.getItem(`butter.dive.${date}`)
    return raw ? (JSON.parse(raw) as SavedGame) : null
  } catch {
    return null
  }
}

function saveGame(date: string, game: SavedGame): void {
  try {
    localStorage.setItem(`butter.dive.${date}`, JSON.stringify(game))
  } catch {
    /* a full quota only costs the resume, not the dive */
  }
}

function clearGame(date: string): void {
  try {
    localStorage.removeItem(`butter.dive.${date}`)
  } catch {
    /* nothing to clear */
  }
}

function loadDone(date: string): Result[] | null {
  try {
    const raw = localStorage.getItem(`butter.dive.done.${date}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { results?: Result[] }
    return Array.isArray(parsed.results) ? parsed.results : null
  } catch {
    return null
  }
}

function saveDone(date: string, results: Result[]): void {
  try {
    localStorage.setItem(`butter.dive.done.${date}`, JSON.stringify({ results }))
  } catch {
    /* the dive is over either way */
  }
}

export function ButterDive() {
  const [day, setDay] = useState<Day | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [error, setError] = useState<string | null>(null)
  const [round, setRound] = useState(0)
  const [results, setResults] = useState<Result[]>([])
  const [input, setInput] = useState('')
  const [correction, setCorrection] = useState<{ from: string; to: string } | null>(null)
  const [rejected, setRejected] = useState<string | null>(null)
  const [rejectAt, setRejectAt] = useState(0)
  const [endsAt, setEndsAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [busy, setBusy] = useState(false)
  // The dive's frame, not the window: the ad layout takes its strip off the
  // bottom before the stage is measured, and a stage caught mid-layout can
  // report the world's own height instead.
  const [viewport, setViewport] = useState(() =>
    typeof window === 'undefined' ? 800 : window.innerHeight - (window.innerWidth >= 1060 ? 90 : 50),
  )
  const [stageWidth, setStageWidth] = useState(() => (typeof window === 'undefined' ? 426 : window.innerWidth))
  // The height the shipped engine solves for the prompt card, in stage pixels.
  const [cardTarget, setCardTarget] = useState(0)
  // How far through its fall the answer chip is, 0 → 1.
  const [sinkT, setSinkT] = useState(0)
  const cardRef = useRef<HTMLDivElement | null>(null)
  const dockRef = useRef<HTMLFormElement | null>(null)
  const mascotRef = useRef<HTMLDivElement | null>(null)
  // Where the krill is swimming right now, in stage pixels. Kept across renders
  // so a phase change eases from where it already is instead of snapping.
  const mascotPos = useRef({ x: 0, y: 0, rot: 0, live: false })
  // The shipped loop owns the camera: a target in metres, a damped follower
  // easing towards it, and a bob on top. These are the nodes it writes to.
  const worldRef = useRef<HTMLDivElement | null>(null)
  const vignetteRef = useRef<HTMLDivElement | null>(null)
  const scoreNumRef = useRef<HTMLDivElement | null>(null)
  // The answer's fall is written onto these two nodes by the animation frame.
  const chipRef = useRef<HTMLDivElement | null>(null)
  const depthNumRef = useRef<HTMLDivElement | null>(null)
  const engineRef = useRef({
    phase: 'loading' as Phase,
    round: 0,
    ep: -45,
    frame: 810,
    depth: 0,
    points: 0,
  })
  const phaseRef = useRef<Phase>('loading')
  phaseRef.current = phase
  const [resetsIn, setResetsIn] = useState('')
  const [copied, setCopied] = useState(false)
  const [muted, setMuted] = useState(false)
  // How many people are at open party tables right now, shown the way the real
  // game shows its own live count next to "Puffer Party" on the front door.
  const [playing, setPlaying] = useState<number | null>(null)
  // The result screen's two extras: the day's answer sheets (`undefined` while
  // they are still surfacing, `null` when they could not be fetched) and where
  // this dive landed among everyone else's.
  const [sheet, setSheet] = useState<SheetPrompt[] | null | undefined>(undefined)
  const [curve, setCurve] = useState<{ dist: number[]; betterThan: number } | null>(null)
  const [openRound, setOpenRound] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const runIdRef = useRef('')
  // Only the finished dives feed the logbook, so it is read when the dive ends.
  const logbook = useMemo(() => logbookOf(day?.date ?? ''), [day?.date, phase])

  const points = useMemo(() => results.reduce((sum, result) => sum + result.score, 0), [results])
  const depth = points * METRES_PER_POINT
  const depthRef = useRef(0)
  depthRef.current = depth

  /* ------------------------------------------------------------------ load */

  useEffect(() => {
    let live = true
    fetch('/api/butter-dive/today')
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as (Day & { error?: string }) | null
        if (!res.ok || !body) throw new Error(body?.error ?? "Couldn't load today's dive")
        return body
      })
      .then((body) => {
        if (!live) return
        setDay(body)
        const finished = loadDone(body.date)
        if (finished) {
          setResults(finished)
          setRound(ROUNDS - 1)
          setPhase('done')
          return
        }
        const saved = loadGame(body.date)
        if (saved) {
          runIdRef.current = saved.runId
          setResults(saved.results)
          setRound(saved.round)
          if (saved.phase === 'play') {
            setPhase('preview')
            setEndsAt(Date.now() + PREVIEW_MS)
          } else {
            setPhase('intro')
          }
          return
        }
        runIdRef.current = runIdFor(body.date)
        setPhase('intro')
      })
      .catch((problem: Error) => {
        if (!live) return
        setError(problem.message)
        setPhase('error')
      })
    return () => {
      live = false
    }
  }, [])

  // Keep the door's "N playing" line live, the way the real game's own
  // counter sits on its landing page.
  useEffect(() => {
    let stop = false
    const refresh = async () => {
      try {
        const res = await fetch('/api/butter/rooms')
        const body = (await res.json().catch(() => null)) as { playing?: number } | null
        if (!stop && res.ok && body && typeof body.playing === 'number') setPlaying(body.playing)
      } catch {
        // The count is decorative; a failed poll leaves the last good number.
      }
    }
    refresh()
    const timer = setInterval(refresh, 30_000)
    return () => {
      stop = true
      clearInterval(timer)
    }
  }, [])

  // The dive is drawn against the stage's own height. Reading the window can
  // hand back a stale number while the panel around the page is still settling,
  // which parks the waterline in the wrong place, so watch the stage itself.
  const stageRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const resize = () => {
      setViewport(stage.clientHeight || window.innerHeight)
      setStageWidth(stage.clientWidth || window.innerWidth)
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [])

  /* ----------------------------------------------------------- the clock */

  useEffect(() => {
    if (phase !== 'preview' && phase !== 'answering') return
    const tick = window.setInterval(() => setNow(Date.now()), 100)
    return () => window.clearInterval(tick)
  }, [phase])

  // Persist mid-dive progress so a refresh resumes the same run, as the real
  // dive does, instead of handing out a second string of prompts.
  useEffect(() => {
    if (!day || (phase !== 'preview' && phase !== 'answering' && phase !== 'sinking' && phase !== 'feedback'))
      return
    saveGame(day.date, {
      runId: runIdRef.current,
      results,
      round,
      phase: phase === 'feedback' ? 'play' : 'play',
    })
  }, [day, phase, results, round])

  const land = useCallback((result: Result) => {
    setResults((current) => (current.length > round ? current : [...current, result]))
    setInput('')
    setCorrection(null)
    setRejected(null)
    setEndsAt(null)
    setPhase('sinking')
  }, [round])

  const miss = useCallback(
    (answerText: string | null) => {
      if (!day) return
      const prompt = day.prompts[round]
      land({
        promptId: prompt.id,
        promptText: prompt.text,
        rawAnswer: answerText,
        answer: null,
        tier: null,
        score: 0,
      })
    },
    [day, land, round],
  )

  const send = useCallback(
    async (raw: string) => {
      if (!day || busy) return
      const text = raw.trim()
      const prompt = day.prompts[round]
      if (!prompt) return
      setBusy(true)
      setRejected(null)
      try {
        const res = await fetch('/api/butter-dive/answer', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            date: day.date,
            promptId: prompt.id,
            answer: text,
            playerId: playerId(),
            runId: runIdRef.current,
            via: day.source ?? 'live',
          }),
        })
        const data = (await res.json().catch(() => null)) as
          | { accepted?: boolean; answer?: string; tier?: TierId; score?: number; quip?: string; correction?: string; rejectionReason?: string; error?: string }
          | null
        if (!res.ok) {
          setRejected(data?.error ?? 'signal lost. resend')
          return
        }
        if (data?.correction) {
          // The card's own spell-check: fix the word and let the player send it,
          // rather than burning the prompt on a typo.
          setInput(data.correction)
          setCorrection({ from: text, to: data.correction })
          inputRef.current?.focus()
          return
        }
        if (data?.accepted && data.tier) {
          land({
            promptId: prompt.id,
            promptText: prompt.text,
            rawAnswer: text,
            answer: data.answer ?? text,
            tier: data.tier,
            score: data.score ?? TIERS[data.tier].score,
            quip: data.quip,
          })
          return
        }
        const late = endsAt !== null && Date.now() >= endsAt
        if (late) {
          miss(text)
          return
        }
        setRejected(
          data?.rejectionReason ? `${data.rejectionReason} Try again.` : `“${text}”: no echo. try again`,
        )
        setRejectAt((n) => n + 1)
      } catch {
        setRejected('signal lost. resend')
        setRejectAt((n) => n + 1)
      } finally {
        setBusy(false)
      }
    },
    [busy, day, endsAt, land, miss, round],
  )

  // Preview counts down, then the clock starts; when it runs out the answer box
  // sends whatever is in it, or the prompt lands empty.
  useEffect(() => {
    if (!day || (phase !== 'preview' && phase !== 'answering')) return
    if (phase === 'preview') {
      if (endsAt === null) {
        setEndsAt(Date.now() + PREVIEW_MS)
        return
      }
      if (now >= endsAt) {
        setEndsAt(endsAt + ANSWER_MS)
        setPhase('answering')
      }
      return
    }
    if (endsAt !== null && now >= endsAt) {
      const typed = input.trim()
      if (typed && !busy) void send(typed)
      else if (!busy) miss(null)
    }
  }, [busy, day, endsAt, input, miss, now, phase, send])

  useEffect(() => {
    if (phase === 'answering') inputRef.current?.focus()
  }, [phase, round])

  // The answer falls for exactly as long as the shipped table allows, then it
  // lands and the banner takes its place — the chip is never left hanging.
  useEffect(() => {
    if (phase !== 'sinking') return
    const result = results[results.length - 1]
    // The shipped table's own fall times, per tier and nothing else.
    const duration = result?.tier ? SINK_MS[result.tier] : 900
    const started = performance.now()
    const from = roundDepth + 90
    const to = landing
    let raf = 0
    setSinkT(0)
    // The fall is written straight onto the chip and into the camera's target,
    // frame by frame, exactly like the engine's tween list: React never renders
    // a frame of it. Rendering the fall through state made the camera chase a
    // staircase — and the last few pixels of an ease-out are a long way apart,
    // which is what looked like the answer stopping short and sitting there.
    const step = (now: number) => {
      const t = Math.min(1, (now - started) / duration)
      const eased = result?.tier === 'plankton' ? -(Math.cos(Math.PI * t) - 1) / 2 : 1 - Math.pow(1 - t, 3)
      const depthNow = from + (to - from) * eased
      const wob = result?.tier ? chipWobble(result.tier, eased) : { x: 0, rot: 0 }
      if (chipRef.current) {
        chipRef.current.style.transform = `translate3d(calc(-50% + ${wob.x.toFixed(2)}px), ${(depthNow * 2).toFixed(2)}px, 0) rotate(${wob.rot.toFixed(2)}deg)`
      }
      if (depthNumRef.current) depthNumRef.current.textContent = `${Math.round(depthNow).toLocaleString('en-US')}m`
      // The rungs light in step with the descent: the same frame that moves the
      // chip decides which ones it has crossed.
      const rungs = (stageRef.current ?? document).querySelectorAll<HTMLElement>('.ds-tierline')
      if (rungs) {
        for (const rung of rungs) {
          const at = Number(rung.dataset.rung)
          if (Number.isFinite(at)) rung.classList.toggle('passed', depthNow > at - 4)
        }
      }
      // The camera is handed a target every frame, so its own damped follower
      // sees a moving chip rather than a fresh value twice a second.
      engineRef.current.ep = depthNow + 30
      if (t < 1) raf = requestAnimationFrame(step)
      else setPhase('feedback')
    }
    raf = requestAnimationFrame(step)
    // A tab that is not painting holds rAF back; the dive still has to land, so
    // the fall is timed on the clock as well.
    // The stamp lands on the frame the tween ends, the way the shipped client
    // does it (`l >= 1 ? (upd(ease(1)), done())`), not a beat after it.
    const landingTimer = window.setTimeout(() => setPhase('feedback'), duration)
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(landingTimer)
    }
  }, [phase, results])

  const begin = useCallback(() => {
    setRound(0)
    setResults([])
    setInput('')
    setCorrection(null)
    setRejected(null)
    setEndsAt(Date.now() + PREVIEW_MS)
    setPhase('preview')
  }, [])

  const descend = useCallback(() => {
    if (!day) return
    if (round >= ROUNDS - 1) {
      saveDone(day.date, results)
      clearGame(day.date)
      setPhase('done')
      return
    }
    setRound((current) => current + 1)
    setInput('')
    setCorrection(null)
    setRejected(null)
    setEndsAt(Date.now() + PREVIEW_MS)
    setPhase('preview')
  }, [day, results, round])

  // The done screen counts down to the next dive instead of leaving last
  // night's score looking current.
  useEffect(() => {
    if (phase !== 'done' || !day?.resetsAt) return
    const target = new Date(day.resetsAt).getTime()
    const tick = () => {
      const left = target - Date.now()
      if (left <= 0) {
        setResetsIn('ready')
        return
      }
      const hours = Math.floor(left / 3_600_000)
      const minutes = Math.floor((left % 3_600_000) / 60_000)
      const seconds = Math.floor((left % 60_000) / 1_000)
      setResetsIn(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`)
    }
    tick()
    const timer = window.setInterval(tick, 1_000)
    return () => window.clearInterval(timer)
  }, [day?.resetsAt, phase])

  /* -------------------------------------------------------------- render */

  const answerLeft = phase === 'answering' && endsAt !== null ? Math.max(0, endsAt - now) : ANSWER_MS
  const seconds = Math.ceil(answerLeft / 1_000)
  const hot = phase === 'answering' && answerLeft <= 3_050
  const previewSeconds =
    phase === 'preview' && endsAt !== null ? Math.max(0, Math.ceil((endsAt - now) / 1_000)) : 0

  const prompt = day?.prompts[round] ?? null
  const last = results[results.length - 1] ?? null
  // The engine advances its round counter when an answer lands, not when the
  // player presses descend, so the dots and the label are one ahead of the
  // banner for that moment.
  const landed = results.length - (phase === 'sinking' ? 1 : 0)
  // Everything below is the shipped engine's own arithmetic, read out of its
  // bundle rather than eyeballed:
  //
  //   card world top = 2 * depth-in-metres
  //   world translate = stageHeight / 2 - 2 * camera-metres
  //   camera-metres   = cardDepth + (stageHeight / 2 - cardTarget) / 2
  //
  // which puts the prompt card at exactly `cardTarget` on screen. The engine
  // solves that target from the space between the answer dock and the card:
  // `max(8, min(width < 700 ? 175 : 210, (dockTop - cardHeight) / 2))`. Read
  // live, because the dock only exists once the round starts.
  useLayoutEffect(() => {
    const measure = () => {
      const stage = stageRef.current
      const height = stage?.clientHeight || viewport
      // The engine's own solve (`y(u, cardHeight, dockTop)`): the card's top is
      // a fixed 210 px down a wide frame (175 on a phone), shrunk only when the
      // gap between the card and the answer dock is tighter than that. Its top
      // edge is the waterline, which is exactly what the live dive shows.
      const cardHeight = cardRef.current?.offsetHeight ?? 0
      const dockTop = dockRef.current?.offsetTop ?? height
      const target = Math.max(
        8,
        Math.min(stageWidth < 700 ? 175 : 210, (dockTop - cardHeight) / 2),
      )
      setCardTarget(Math.round(target))
    }
    measure()
    // The card's own font settles a frame or two after it mounts.
    const late = window.setTimeout(measure, 400)
    return () => window.clearTimeout(late)
  }, [phase, round, stageWidth, viewport])

  // The stage is already the shipped game's frame: the ad layout insets the root
  // by the rails and the bottom strip, so the engine's "middle of the frame" is
  // this box's height — no strip to subtract a second time.
  const diveFrame = Math.max(
    240,
    Math.min(viewport, typeof window === 'undefined' ? viewport : window.innerHeight),
  )
  // The depth the current round's card was dropped at; the card stays pinned
  // there while the camera sinks, exactly as the engine leaves it behind.
  const roundDepth = results.slice(0, round).reduce((sum, result) => sum + result.score, 0) * METRES_PER_POINT
  // 2px of water for every metre: the dive's whole vertical scale.
  // Where this round's answer comes to rest, in metres: a landed answer sinks
  // its own points (10 m each), a miss drifts 40 m below the round's start.
  const landing = last
    ? last.tier
      ? roundDepth + last.score * METRES_PER_POINT
      : roundDepth + 40
    : roundDepth
  // The chip's fall: eased, and per-tier — plankton bobs on a cosine.
  const sinkE =
    last?.tier === 'plankton' ? -(Math.cos(Math.PI * sinkT) - 1) / 2 : 1 - Math.pow(1 - sinkT, 3)
  const chipDepth = roundDepth + 90 + (landing - (roundDepth + 90)) * sinkE
  // The engine's target camera, in metres: the intro and the finale hang at -45,
  // a round sits at its own depth plus `(frame/2 - cardTarget)/2`, and a falling
  // or landed answer keeps the camera 30 m under it.
  const cardOffset = Math.max(0, (diveFrame / 2 - cardTarget) / 2)
  const camTarget =
    phase === 'intro' || phase === 'error' || phase === 'loading' || phase === 'done'
      ? -45
      : phase === 'sinking'
        ? chipDepth + 30
        : phase === 'feedback'
          ? landing + 30
          : roundDepth + cardOffset
  // While an answer falls, its own animation frame owns the camera target; a
  // re-render must not snap the target back to where the fall started.
  engineRef.current = {
    phase,
    round,
    ep: phase === 'sinking' ? engineRef.current.ep : camTarget,
    frame: diveFrame,
    depth,
    points,
  }
  // The engine pins the card to its own depth (2px a metre) and lets the camera
  // bring it to the waterline: at rest its top edge sits exactly on the surface.
  const cardTop = roundDepth * 2
  // The depth readout rides the fall with the chip instead of jumping.
  const shownDepth = phase === 'sinking' ? Math.round(roundDepth + (depth - roundDepth) * sinkE) : depth
  const promptLabel =
    phase === 'intro'
      ? 'SURFACE'
      : results.length >= ROUNDS
        ? 'DIVE COMPLETE'
        : `PROMPT ${Math.min(landed + 1, ROUNDS)} OF ${ROUNDS}`

  // Both reads happen when the dive ends, on the shipped game's own endpoints:
  // the answer sheet behind each round, and the score histogram the curve is
  // drawn from. Neither can fail loudly — a missing sheet still leaves the
  // headline, the log and the bearing readable.
  useEffect(() => {
    if (phase !== 'done' || !day) return
    let live = true
    setSheet(undefined)
    setCurve(null)
    setOpenRound(null)
    const loadSheet = async () => {
      try {
        const res = await fetch(`/api/butter-dive/sheet?date=${encodeURIComponent(day.date)}`)
        const body = res.ok
          ? ((await res.json().catch(() => null)) as { prompts?: SheetPrompt[] } | null)
          : null
        if (live) setSheet(Array.isArray(body?.prompts) ? body.prompts : null)
      } catch {
        if (live) setSheet(null)
      }
    }
    const loadCurve = async () => {
      try {
        const res = await fetch('/api/butter-dive/catch', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            date: day.date,
            playerId: playerId(),
            score: points,
            runId: runIdRef.current,
          }),
        })
        const body = res.ok
          ? ((await res.json().catch(() => null)) as { betterThan?: number; dist?: number[] } | null)
          : null
        if (live && typeof body?.betterThan === 'number') {
          setCurve({ betterThan: body.betterThan, dist: Array.isArray(body.dist) ? body.dist : [] })
        }
      } catch {
        /* the hideout is quiet — the headline still stands on its own */
      }
    }
    void loadSheet()
    void loadCurve()
    return () => {
      live = false
    }
  }, [day, phase, points])

  // The shipped krill is not placed with CSS at all: its loop keeps a centre
  // point per station, eases towards it at `1 - exp(-2.6 * dt)`, and writes a
  // translate with a bob and a sway on top. Its stations, straight out of the
  // bundle: a round waits at `48, h - 168` (beside the answer dock), the plunge
  // holds 95px to the right of the falling chip and 14px above it at 24°, a
  // landed banner leaves it at `.16w, .28h` and -8°, and the finale takes it to
  // `.82w, .16h` at -6°. Reading the chip's own box keeps it on the answer as
  // the camera rides down, the way the engine's `ey()` does.
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      const dt = Math.min(0.05, (now - last) / 1_000)
      last = now
      const mascot = mascotRef.current
      const stage = stageRef.current
      const current = phaseRef.current
      if (!mascot || !stage) return
      if (current === 'intro' || current === 'error' || current === 'loading') {
        // The title screen places the krill from the stylesheet.
        if (mascotPos.current.live) {
          mascot.style.transform = ''
          mascotPos.current.live = false
        }
        return
      }
      const u = stage.clientWidth
      const h = stage.clientHeight
      let station = { x: 48, y: h - 168, rot: 0 }
      if (current === 'sinking') {
        const stageBox = stage.getBoundingClientRect()
        const chip = stage.querySelector('.ds-chip')?.getBoundingClientRect()
        const cx = chip ? chip.left - stageBox.left + chip.width / 2 : u / 2
        const cy = chip ? chip.top - stageBox.top + chip.height / 2 : h / 2
        station = { x: Math.min(cx + 95, u - 44), y: cy - 14, rot: 24 }
      } else if (current === 'feedback') {
        station = { x: 0.16 * u, y: 0.28 * h, rot: -8 }
      } else if (current === 'done') {
        station = { x: 0.82 * u, y: 0.16 * h, rot: -6 }
      }
      const pos = mascotPos.current
      if (!pos.live) {
        pos.x = station.x
        pos.y = station.y
        pos.rot = station.rot
        pos.live = true
      }
      const ease = 1 - Math.exp(-2.6 * dt)
      pos.x += (station.x - pos.x) * ease
      pos.y += (station.y - pos.y) * ease
      pos.rot += (station.rot - pos.rot) * ease
      const seconds = now / 1_000
      const bob = Math.sin(1.7 * seconds) * 6
      const sway = Math.sin(1.1 * seconds) * 4
      const half = mascot.offsetWidth / 2
      mascot.style.transform = `translate3d(${pos.x - half}px, ${pos.y - half + bob}px, 0) rotate(${pos.rot + sway}deg)`
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  // First paint, before the loop's first frame: the world belongs at the intro
  // station and the score at today's total, so a throttled tab (no rAF) still
  // shows the surface where it sits instead of the bare top of the world.
  useLayoutEffect(() => {
    const frame =
      typeof window === 'undefined'
        ? viewport
        : Math.max(240, window.innerHeight - (window.innerWidth >= 1060 ? 90 : 50))
    if (worldRef.current) {
      worldRef.current.style.transform = `translate3d(0, ${frame / 2 + 90}px, 0)`
    }
    if (scoreNumRef.current) scoreNumRef.current.textContent = String(points)
    if (vignetteRef.current) vignetteRef.current.style.opacity = '0.25'
    // The seed is deliberately mount-only; the loop owns these nodes after it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The shipped camera loop, ported: the target eases in on a 2200ms
  // easeInOutCubic descent, a damped follower closes the gap at
  // `1 - exp(-6 * dt)`, a 2.2px bob rides on top, the world sits at
  // `frame/2 - 2 * camera`, and the vignette darkens with depth. The score
  // counts up over 700ms on the engine's easeOutQuart.
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let ep = -45
    let em = -45
    let tween: { from: number; to: number; start: number; dur: number } | null = null
    let key = ''
    let shownPoints = -1
    let scoreTween: { from: number; to: number; start: number } | null = null
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      const dt = Math.min(0.05, (now - last) / 1_000)
      last = now
      const state = engineRef.current
      const frame = state.frame || 810
      const roundKey = `${state.phase}:${state.round}`
      if (roundKey !== key) {
        key = roundKey
        if (state.phase === 'preview') tween = { from: ep, to: state.ep, start: now, dur: 2_200 }
        else if (state.phase === 'done') tween = { from: ep, to: -45, start: now, dur: 2_500 }
        else tween = null
      }
      if (state.phase === 'sinking' || state.phase === 'feedback') {
        ep = state.ep
        tween = null
      } else if (tween) {
        const progress = Math.min(1, (now - tween.start) / tween.dur)
        const eased =
          progress < 0.5
            ? 4 * progress * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 3) / 2
        ep = tween.from + (tween.to - tween.from) * eased
        if (progress >= 1) tween = null
      } else {
        ep = state.ep
      }
      em += (ep - em) * (1 - Math.exp(-6 * dt))
      const eg = em + (reduce ? 0 : 2.2 * Math.sin(0.45 * (now / 1_000)))
      if (worldRef.current) worldRef.current.style.transform = `translate3d(0, ${frame / 2 - 2 * eg}px, 0)`
      if (vignetteRef.current) {
        vignetteRef.current.style.opacity = Math.min(0.72, 0.25 + Math.max(0, eg) / 2_400).toFixed(3)
      }
      if (shownPoints < 0) shownPoints = state.points
      if (scoreTween === null && state.points !== shownPoints) {
        scoreTween = { from: shownPoints, to: state.points, start: now }
      }
      if (scoreTween) {
        const progress = Math.min(1, (now - scoreTween.start) / 700)
        const eased = 1 - Math.pow(1 - progress, 4)
        const value = Math.round(scoreTween.from + (scoreTween.to - scoreTween.from) * eased)
        shownPoints = value
        if (progress >= 1) {
          shownPoints = scoreTween.to
          scoreTween = null
        }
      }
      if (scoreNumRef.current) scoreNumRef.current.textContent = String(shownPoints)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="dive-page butter-dive relative min-h-0 flex-1 overflow-hidden" data-phase={phase}>
      <div className="kr-ad-layout">
      <div
        className="ds-root"
        data-sink={phase === 'sinking' ? '1' : undefined}
        data-phase={
          phase === 'error' || phase === 'loading' ? 'intro' : phase === 'sinking' ? 'answering' : phase
        }
      >
        <div className="ds-stage" ref={stageRef}>
          <Sea depthRef={depthRef} />
          <div
            // The engine turns the water's captions on while the dive is live and
            // takes them away the moment an answer lands (its `ds-reveal` class),
            // so a landed banner sits in clean water.
            // The engine adds `ds-reveal` when an answer plunges and drops it on
            // the next descent, so the captions belong to the fall, not the card.
            className={`ds-world${phase === 'sinking' || phase === 'feedback' ? ' ds-reveal' : ''}`}
            ref={worldRef}
          >
            <div className="ds-surface" style={{ top: -336 }}>
              <div className="ds-title">
                {'BUTTER'.split('').map((letter, index) => (
                  <span key={index} style={{ animationDelay: `${0.18 * index}s` }}>
                    {letter}
                  </span>
                ))}
              </div>
              <div className="ds-tagline">THE DAILY CHURN</div>
              <div className="ds-subline">7 prompts · 25 seconds each · rarer answers sink deeper</div>
            </div>
            <img className="ds-floor" src="/water-bg.webp" alt="" style={{ top: 14_020 }} />
            {AMBIENT.map(([metres, text, side, major]) => (
              <div
                key={`${metres}-${side}`}
                className={`ds-amb ${side}${major ? ' major' : ''}`}
                style={{ top: metres * 2 - 9 }}
              >
                {side === 'L' ? (
                  <>
                    <span className="dash">──</span> {text}
                  </>
                ) : (
                  <>
                    {text} <span className="dash">──</span>
                  </>
                )}
              </div>
            ))}

            {/* The ladder is the answer's landing strip: the real dive only draws
                it once an answer has landed, so the tiers appear in the water
                with the quote beside them instead of labelling an empty sea. */}
            {(phase === 'sinking' || phase === 'feedback') &&
              Object.entries(TIERS).map(([id, tier]) => {
                // A landed answer's own rung is the line its banner sits on; the
                // engine drops it as the banner arrives.
                if (phase === 'feedback' && last?.tier === id) return null
                const rung = roundDepth + tier.score * METRES_PER_POINT
                // The rung lights up as the chip crosses it.
                const passed = (phase === 'sinking' ? chipDepth : landing) > rung - 4
                return (
                  <div
                    key={id}
                    className={`ds-tierline${passed ? ' passed' : ''}`}
                    // The fall's own frame lights these as the chip crosses
                    // them; the depth it compares against is on the node.
                    data-rung={rung}
                    style={{
                      // Each rung sits where an answer of that tier would land
                      // from the depth this round started at.
                      top: rung * 2,
                      ['--tc' as string]: `var(--tier-${id})`,
                    }}
                  >
                    <div className="tag">
                      <img src={`/tiers/${id}.png`} alt="" />
                      {tier.name.toUpperCase()} &middot; {tier.score}
                    </div>
                  </div>
                )
              })}

            {/* The answer itself, falling: a chip in the tier's colour that swims
                down to its own depth and then lands as the banner. */}
            {phase === 'sinking' && last?.tier && (
              <div
                ref={chipRef}
                className={`ds-chip ds-px${last.tier === 'krillion' ? ' gold' : ''}`}
                style={{
                  ['--cc' as string]: `var(--tier-${last.tier})`,
                  // The transform belongs to the fall's own animation frame; a
                  // re-render must not put the chip back at the top of it.
                  transform: `translate3d(calc(-50% + 0px), ${((roundDepth + 90) * 2).toFixed(2)}px, 0)`,
                }}
              >
                “{(last.answer ?? last.rawAnswer ?? '').toUpperCase()}”
              </div>
            )}

            {day && prompt && (phase === 'preview' || phase === 'answering' || phase === 'sinking') && (
              <div
                ref={cardRef}
                className={`ds-card ds-px${phase === 'sinking' ? ' gone' : ''}`}
                style={{ top: cardTop, animationDelay: '0.45s' }}
              >
                <div className="rnd">
                  PROMPT {round + 1} OF {ROUNDS}
                </div>
                <div className="prompt">{prompt.text}</div>
                {/* The engine keeps the hint on the card for the whole round;
                    it only goes with the card, when the answer plunges. */}
                <div className="hint">▼ rarer answers sink deeper ▼</div>
              </div>
            )}

            {phase === 'feedback' && last && (
              <div
                className={`ds-landed${last.tier ? '' : ' miss'}`}
                style={{
                  // The banner is pinned to where the answer landed, and the
                  // camera is what brings it into view.
                  top: landing * 2,
                  ['--tc' as string]: last.tier ? `var(--tier-${last.tier})` : 'var(--tier-miss)',
                }}
              >
                {last.tier && <img className="icon" src={`/tiers/${last.tier}.png`} alt="" />}
                <div className="tname">{last.tier ? TIERS[last.tier].name.toUpperCase() : 'NOTHING LANDED'}</div>
                <div className="tans">{last.answer ? `“${last.answer}”` : '—'}</div>
                <div className="tpts">
                  <b>+{last.score} PTS</b>
                  {last.score > 0
                    ? ` · sink ${(last.score * METRES_PER_POINT).toLocaleString('en-US')}m`
                    : null}
                </div>
                <div className="tsub">
                  {last.quip ??
                    (last.tier
                      ? TIERS[last.tier].blurb
                      : last.rawAnswer
                        ? 'never made it onto the reef.'
                        : 'the clock beat you to it.')}
                </div>
              </div>
            )}
          </div>

          <Fore depthRef={depthRef} />

          <div className="ds-dim" />
          <div className="ds-vignette" ref={vignetteRef} />
          <div className="ds-edge" />

          <div className="ds-hud">
            <div className="ds-pod ds-px">
              <div className="label">DEPTH</div>
              <div className="ds-depth-num" ref={depthNumRef}>
                {shownDepth.toLocaleString('en-US')}m
              </div>
            </div>
            <div className="ds-hud-mid">
              <div className="ds-dots">
                {Array.from({ length: ROUNDS }, (_, index) => (
                  <i
                    key={index}
                    className={
                      index < landed
                        ? 'done'
                        : index === landed && phase !== 'done' && phase !== 'intro'
                          ? 'cur'
                          : ''
                    }
                  />
                ))}
              </div>
              <div className="ds-prompt-count">{promptLabel}</div>
            </div>
            <div className="ds-pod ds-px ds-score-pod">
              <div className="label">SCORE</div>
              <div className="ds-score-num" ref={scoreNumRef} />
            </div>
          </div>

          <button
            className={`ds-mute${muted ? ' off' : ''}`}
            type="button"
            aria-label={muted ? 'turn sound on' : 'turn sound off'}
            aria-pressed={muted}
            onClick={() => setMuted((on) => !on)}
          >
            <svg viewBox="0 0 20 16" shapeRendering="crispEdges" fill="currentColor" aria-hidden="true">
              <path d="M2 6h3l4-4v12l-4-4H2z" />
              <rect x="11" y="6" width="2" height="4" />
              <rect x="15" y="3" width="2" height="10" />
            </svg>
          </button>

          {/* The shipped chrome: the site menu in the top-left corner and the two
              dialog triggers stacked under the mute button. The menu opens the
              real one; settings and wardrobe keep the look only. */}
          <ButterMenu className="ds-site-menu" />
          <button className="ds-side-btn settings" type="button" aria-hidden="true" tabIndex={-1}>
            <svg viewBox="0 0 20 20" shapeRendering="crispEdges" fill="currentColor" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M6 4H14V6H16V14H14V16H6V14H4V6H6Z M8 1H12V4H8Z M8 16H12V19H8Z M1 8H4V12H1Z M16 8H19V12H16Z M3 3H6V6H3Z M14 3H17V6H14Z M3 14H6V17H3Z M14 14H17V17H14Z M8 8H12V12H8Z"
              />
            </svg>
          </button>
          <button className="ds-side-btn wardrobe" type="button" aria-hidden="true" tabIndex={-1}>
            <svg viewBox="0 0 20 20" shapeRendering="crispEdges" fill="currentColor" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M4 3H8V5H4Z M12 3H16V5H12Z M2 5H18V9H2Z M5 9H15V17H5Z M9 5H11V7H9Z"
              />
            </svg>
          </button>

          <div className="ds-mascot" title="a friend" ref={mascotRef}>
            <span className="ds-mascot-sprite">
              <img src="/tiers/krillion.png" alt="krill" />
            </span>
            <span className="ds-blub">{phase === 'done' ? 'blub blub!' : 'blub!'}</span>
          </div>

          <div className="ds-crt" />

          {phase === 'intro' && day && (
            <div className="ds-intro">
              <div className="ds-intro-inner">
                <details className="ds-howto">
                  <summary>how to play</summary>
                  <ul>
                    {HOW_TO_PLAY.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </details>
                <div>
                  <div className="kr-ad-privacy">
                    <Link to="/privacy">Privacy</Link>
                    <div className="consumer-privacy">
                      <Link className="consumer-privacy-btn" to="/privacy">
                        DO NOT SELL OR SHARE MY PERSONAL INFORMATION
                      </Link>
                    </div>
                  </div>
                </div>
                <div className="DailyIntro-module__e61tQq__actions">
                  <Link
                    className="GameDiscovery-module__sRLeRq__link GameDiscovery-module__sRLeRq__home"
                    to="/butter/party"
                  >
                    <span className="GameDiscovery-module__sRLeRq__newMode">Beta · limited time</span>
                    <span className="GameDiscovery-module__sRLeRq__heading">
                      <span className="GameDiscovery-module__sRLeRq__puffer" aria-hidden="true">
                        <img width={52} height={52} src="/gen/party/puffer-0.png" alt="" />
                      </span>
                      <span className="GameDiscovery-module__sRLeRq__title">Puffer Party</span>
                    </span>
                    <span className="GameDiscovery-module__sRLeRq__activity">
                      <span className="GameDiscovery-module__sRLeRq__live" aria-hidden="true" />
                      {typeof playing === 'number' ? `${playing.toLocaleString()} playing` : 'in the water now'}
                    </span>
                  </Link>
                  <button className="ds-begin-btn" type="button" onClick={begin}>
                    ▼ BEGIN DESCENT ▼
                  </button>
                </div>
                <div className="ds-intro-meta" style={{ flexWrap: 'wrap' }}>
                  <span>dive #{day.dayNumber}</span>
                  {/* The shipped row's three chips. Ink has no archive, themed
                      packs or unlimited mode, so they are the look of the row
                      and nothing more. */}
                  <div className="butter-dive-meta-links">
                    <a aria-hidden="true" tabIndex={-1}>
                      ARCHIVE ⟲
                    </a>
                    <a aria-hidden="true" tabIndex={-1}>
                      THEMED PACKS
                    </a>
                    <a aria-hidden="true" tabIndex={-1}>
                      UNLIMITED ∞
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

          {phase === 'preview' && (
            <div className="ds-preview-pill ds-px">
              descending · the clock starts in <b>{previewSeconds}</b>
            </div>
          )}

          {phase === 'answering' && (
            <>
              {/* Krillion's own pill, element for element: the quoted spelling
                  you sent, an arrow hidden from screen readers, the quoted
                  spelling it becomes, and the line that asks you to send it
                  again to keep it. Sent again, the card accepts it. */}
              <div
                className="ds-correction"
                id="answer-correction"
                role="status"
                aria-live="polite"
                aria-atomic="true"
              >
                {correction && (
                  <div className="ds-preview-pill ds-px ds-correction-panel">
                    <span className="ds-correction-change">
                      <span>“{correction.from}”</span>
                      <span className="ds-correction-arrow" aria-hidden="true">
                        {' → '}
                      </span>
                      <span className="sr-only"> corrects to </span>
                      <b>“{correction.to}”</b>
                    </span>
                    <span className="ds-correction-hint">submit again to confirm · or edit</span>
                  </div>
                )}
              </div>
              {rejected && (
                <div className="ds-reject ds-reject-shake" key={rejectAt} aria-live="polite">
                  {rejected}
                </div>
              )}
              <form
                ref={dockRef}
                className={`ds-dock${hot ? ' hot' : ''}`}
                onSubmit={(event) => {
                  event.preventDefault()
                  const text = input.trim()
                  if (text && !busy) void send(text)
                }}
              >
                <div className="ds-dock-inner">
                  <div className="ds-sonar-wrap">
                    <div className="ds-sonar-scope">
                      <div className={`ds-sweep${hot ? ' hot' : ''}`} />
                    </div>
                    <div className={`ds-time-digits${hot ? ' hot' : ''}`}>{seconds}</div>
                  </div>
                  <div className="ds-input-col">
                    <input
                      ref={inputRef}
                      className="ds-input"
                      value={input}
                      aria-describedby={correction ? 'answer-correction' : undefined}
                      onChange={(event) => {
                        setInput(event.target.value)
                        setCorrection(null)
                        setRejected(null)
                      }}
                      placeholder="type one answer…"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      enterKeyHint="send"
                      maxLength={MAX_ANSWER_LENGTH}
                      aria-label="Your answer"
                    />
                    <div className="ds-fuse">
                      <div className="ds-fuse-fill" style={{ transform: `scaleX(${answerLeft / ANSWER_MS})` }} />
                    </div>
                  </div>
                  <button type="submit" className="ds-dive-btn" disabled={!input.trim() || busy}>
                    {busy ? '…' : 'DIVE'}
                  </button>
                </div>
              </form>
            </>
          )}

          {phase === 'feedback' && last && (
            <div className="ds-next-wrap">
              <button className="ds-next-btn" type="button" onClick={descend}>
                {round >= ROUNDS - 1 ? 'SURFACE ▲' : 'DESCEND ▼'}
              </button>
            </div>
          )}

          {phase === 'done' && day && (
            <div className="ds-done">
              <div className="ds-done-inner">
                <div className="flex flex-col gap-9 mt-1 pb-12 w-full">
                  <div>
                    <div className="flex items-baseline justify-between">
                      <span className="ds-done-krill">BUTTER</span>
                      <span className="font-mono-ui text-[13px] tracking-[0.14em] text-drift uppercase">
                        Dive #{day.dayNumber} complete
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2 mt-4">
                      <span className="font-display text-[5rem] leading-none text-foam tabular-nums">{points}</span>
                      <span className="font-mono-ui text-sm text-lumen-cyan tabular-nums ml-2">
                        -{depth.toLocaleString('en-US')}m
                      </span>
                    </div>
                    {curve && curve.dist.length > 0 && (
                      <ScoreCurve dist={curve.dist} score={points} betterThan={curve.betterThan} />
                    )}
                  </div>

                  <div>
                    <p className="fathom mb-3">
                      <span>dive log</span>
                      <span className="fathom-depth">deeper = rarer</span>
                    </p>
                    <div className="relative h-60">
                      {[0, 0.25, 0.5, 0.75, 1].map((mark) => (
                        <div key={mark}>
                          <div
                            aria-hidden
                            className="absolute left-6 right-0 border-t border-dashed"
                            style={{ top: `${100 * mark}%`, borderColor: 'var(--hairline)', opacity: mark === 0 ? 1 : 0.5 }}
                          />
                          <span
                            className="absolute left-0 font-mono-ui text-[10px] text-drift/60 tabular-nums -translate-y-1/2"
                            style={{ top: `${100 * mark}%` }}
                          >
                            {mark === 0 ? '0m' : `-${Math.round(mark * 7000)}m`}
                          </span>
                        </div>
                      ))}
                      <div className="absolute inset-y-0 left-8 right-0 grid grid-cols-7">
                        {results.map((result, index) => {
                          const meta = result.tier ? TIERS[result.tier] : null
                          const place = result.tier ? TIER_DEPTH[result.tier] : 0.03
                          const color = meta ? meta.color : 'var(--tier-miss)'
                          return (
                            <div className="relative" key={result.promptId}>
                              <div
                                aria-hidden
                                className="absolute left-1/2 -translate-x-1/2 w-px"
                                style={{
                                  top: 0,
                                  height: `calc(${100 * place}% - 8px)`,
                                  background: `linear-gradient(180deg, transparent, ${color})`,
                                  opacity: 0.45,
                                }}
                              />
                              <div
                                className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 animate-sink"
                                style={{ top: `${100 * place}%`, animationDelay: `${90 * index}ms` }}
                                title={`Round ${index + 1}: ${result.answer ?? 'miss'}, ${result.score} pts`}
                              >
                                <TierIcon tier={result.tier ?? 'miss'} size={19} glow={Boolean(meta)} />
                              </div>
                              <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 font-mono-ui text-[11px] text-drift/70">
                                {index + 1}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                    <div className="h-5" />
                  </div>

                  <section>
                    <p className="fathom mb-1">
                      <span>the catch</span>
                      <span className="fathom-depth">tap a round for every answer</span>
                    </p>
                    <ul>
                      {results.map((result, index) => {
                        const sheetPrompt = sheet?.find((entry) => entry.id === result.promptId)
                        const open = openRound === result.promptId
                        return (
                          <li
                            key={result.promptId}
                            className="py-2.5 border-b last:border-b-0"
                            style={{ borderColor: 'var(--hairline)' }}
                          >
                            <button
                              type="button"
                              className="flex items-center gap-3 w-full text-left"
                              onClick={() => setOpenRound(open ? null : result.promptId)}
                              aria-expanded={open}
                            >
                              <span className="font-mono-ui text-[12px] text-drift/60 w-3 shrink-0">{index + 1}</span>
                              <TierIcon tier={result.tier ?? 'miss'} size={19} />
                              <div className="min-w-0 flex-1">
                                <p className="font-mono-ui text-[12px] text-drift/70 truncate uppercase tracking-[0.05em]">
                                  {sheetPrompt?.text ?? result.promptText}
                                </p>
                                <p className="text-[17px] text-foam truncate">
                                  {result.answer ?? (result.rawAnswer ? `"${result.rawAnswer}"` : '—')}
                                </p>
                              </div>
                              <span
                                className="font-mono-ui text-sm tabular-nums"
                                style={{ color: result.tier ? TIERS[result.tier].color : 'var(--tier-miss)' }}
                              >
                                {result.score}
                              </span>
                              <span className="font-mono-ui text-[11px] text-drift/50 w-3">{open ? '−' : '+'}</span>
                            </button>
                            {sheetPrompt?.resultsNote && (
                              <p className="mt-1.5 pl-[55px] text-[14px] leading-snug text-drift/70">
                                {sheetPrompt.resultsNote}
                              </p>
                            )}
                            {open &&
                              (sheetPrompt ? (
                                <AnswerSheet answers={sheetPrompt.answers} playerAnswer={result.answer} />
                              ) : (
                                <p className="mt-2 mb-1 pl-[27px] font-mono-ui text-[12px] text-drift/50">
                                  {sheet === null ? 'answer sheet lost at sea' : 'surfacing the answer sheets…'}
                                </p>
                              ))}
                          </li>
                        )
                      })}
                    </ul>
                  </section>

                  <section>
                    <p className="fathom mb-1">
                      <span>the bearing</span>
                    </p>
                    <ul>
                      {SCORE_BANDS.map((band) => {
                        const here = bandFor(points) === band
                        return (
                          <li
                            key={band.min}
                            className="flex items-center gap-3 px-1.5 py-2 border-b last:border-b-0"
                            style={{ borderColor: 'var(--hairline)' }}
                          >
                            <TierIcon tier={band.tier} size={17} />
                            <span
                              className="font-mono-ui text-[13px] tabular-nums w-[4.5rem] shrink-0"
                              style={{ color: TIERS[band.tier].color }}
                            >
                              {band.range}
                            </span>
                            <span className={`text-[15px] flex-1 min-w-0 ${here ? 'text-foam' : 'text-drift/70'}`}>
                              {band.verdict}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  </section>

                  <section>
                    <p className="fathom mb-1">
                      <span>the catch</span>
                      <span className="fathom-depth">every answer</span>
                    </p>
                    <ul>
                      {results.map((result, index) => (
                        <li
                          key={result.promptId}
                          className="py-2.5 border-b last:border-b-0"
                          style={{ borderColor: 'var(--hairline)' }}
                        >
                          <div className="flex items-center gap-3 w-full text-left">
                            <span className="font-mono-ui text-[12px] text-drift/60 w-3 shrink-0">{index + 1}</span>
                            <TierIcon tier={result.tier ?? 'miss'} size={19} />
                            <div className="min-w-0 flex-1">
                              <p className="font-mono-ui text-[12px] text-drift/70 truncate uppercase tracking-[0.05em]">
                                {result.promptText}
                              </p>
                              <p className="text-[17px] text-foam truncate">
                                {result.answer ?? (result.rawAnswer ? `"${result.rawAnswer}"` : '—')}
                              </p>
                            </div>
                            <span
                              className="font-mono-ui text-sm tabular-nums"
                              style={{ color: result.tier ? TIERS[result.tier].color : 'var(--tier-miss)' }}
                            >
                              {result.score}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>

                  <div className="flex flex-col gap-4">
                    <div className="flex gap-3">
                      <button
                        type="button"
                        className="btn-descend flex-1"
                        onClick={() => {
                          const emojis = results
                            .map((result) => (result.tier ? TIER_EMOJI[result.tier] : '⬛'))
                            .join('')
                          void navigator.clipboard
                            .writeText(`Butter #${day.dayNumber} 🦐\n${points}\n\n${emojis}`)
                            .then(() => {
                              setCopied(true)
                              window.setTimeout(() => setCopied(false), 2000)
                            })
                            .catch(() => undefined)
                        }}
                      >
                        {copied ? 'Copied ✓' : 'Copy result'}
                      </button>
                    </div>
                    <div className="flex flex-col gap-3">
                      <Link to="/butter/party" className="btn-quiet inline-block self-start">
                        PUFFER PARTY →
                      </Link>
                    </div>
                  </div>

                  <section>
                    <p className="fathom mb-2">
                      <span>logbook</span>
                    </p>
                    <p className="font-mono-ui text-[14px] tracking-[0.1em] text-drift uppercase tabular-nums">
                      streak <span className="text-foam">{logbook.streak}</span> · played{' '}
                      <span className="text-foam">{logbook.played}</span> · avg{' '}
                      <span className="text-foam">{logbook.average}</span> · best{' '}
                      <span className="text-foam">{logbook.best}</span>
                    </p>
                  </section>

                  <p className="font-mono-ui text-[13px] tracking-[0.12em] uppercase text-drift">
                    next dive in <span className="text-lumen-cyan tabular-nums">{resetsIn || '--:--:--'}</span>
                    {resetsIn === 'ready' ? (
                      <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="ml-2 underline text-lumen-pink"
                      >
                        refresh
                      </button>
                    ) : null}
                  </p>

                  <SuggestQuestion />
                </div>
              </div>
            </div>
          )}

          {phase === 'loading' && (
            <div className="ds-boot">
              <img className="krill" src="/tiers/krillion.png" alt="" width={64} height={64} />
              <p className="ds-boot-label">descending…</p>
            </div>
          )}

          {phase === 'error' && (
            <div className="ds-boot">
              <img className="krill" src="/tiers/krillion.png" alt="" width={64} height={64} />
              <p className="ds-boot-title">no signal</p>
              <p className="ds-boot-msg">{error ?? "Couldn't load today's dive"}</p>
              <button className="ds-next-btn" type="button" onClick={() => window.location.reload()}>
                RETRY
              </button>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  )
}
