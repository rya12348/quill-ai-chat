import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'

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
type Day = { date: string; dayNumber: number; resetsAt?: string; prompts: Prompt[]; source?: 'live' | 'local' }
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
const MAX_ANSWER_LENGTH = 40
const PLAYER_KEY = 'butter.dive.player'

/** The shipped tier ladder: name, points, depth and the line under the banner. */
const TIERS: Record<TierId, { name: string; score: number; color: string; blurb: string }> = {
  plankton: { name: 'Plankton', score: 10, color: '#8fa3c4', blurb: 'The answer everyone blurts out.' },
  tooclever: {
    name: 'Too Clever',
    score: 15,
    color: '#ff9f43',
    blurb: 'A famously “obscure” pick. Everyone reaches for it.',
  },
  schooler: { name: 'Schooler', score: 30, color: '#4de3ff', blurb: 'Solid — swims with the school.' },
  rare: { name: 'Rare', score: 60, color: '#ff5252', blurb: 'Genuinely uncommon. Nice pull.' },
  deepcut: { name: 'Deep Cut', score: 85, color: '#9d7bff', blurb: 'True obscurity. Few go this deep.' },
  krillion: {
    name: 'One in a Butter Churn',
    score: 100,
    color: '#ffd166',
    blurb: 'The designated gem. Trench floor.',
  },
}

/** Emoji and depth for each tier, straight from the shipped table: the share of
 *  the card an answer of this tier should reach, which is what the dive log
 *  plots against. */
const TIER_EMOJI: Record<TierId, string> = {
  plankton: '🫧',
  tooclever: '🤡',
  schooler: '🐟',
  rare: '🦑',
  deepcut: '🏮',
  krillion: '🌟',
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
  'the pick that feels clever? the school thought of it too.',
  'every point sinks you 10 metres. 700 is the trench.',
  'one dive per day. no second chances.',
]

/** The shipped score bands: what your seven answers add up to, and the line the
 *  results page reads out for the band you landed in. */
const SCORE_BANDS: { min: number; tier: TierId; range: string; verdict: string }[] = [
  { min: 0, tier: 'plankton', range: '0–150', verdict: 'Plankton. Plenty of ocean left down there.' },
  { min: 151, tier: 'schooler', range: '151–250', verdict: 'Schooler. Swimming with the school.' },
  { min: 251, tier: 'rare', range: '251–350', verdict: 'Rare. Below the thermocline. Nice.' },
  { min: 351, tier: 'deepcut', range: '351–449', verdict: 'Deep cut. Seriously deep dive.' },
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
  const [viewport, setViewport] = useState(() => (typeof window === 'undefined' ? 800 : window.innerHeight))
  const [stageWidth, setStageWidth] = useState(() => (typeof window === 'undefined' ? 426 : window.innerWidth))
  // The height the shipped engine solves for the prompt card, in stage pixels.
  const [cardTarget, setCardTarget] = useState(0)
  // How far through its fall the answer chip is, 0 → 1.
  const [sinkT, setSinkT] = useState(0)
  const cardRef = useRef<HTMLDivElement | null>(null)
  const dockRef = useRef<HTMLFormElement | null>(null)
  const [resetsIn, setResetsIn] = useState('')
  const [copied, setCopied] = useState(false)
  const [muted, setMuted] = useState(false)
  // How many people are at open party tables right now, shown the way the real
  // game shows its own live count next to "Puffer Party" on the front door.
  const [playing, setPlaying] = useState<number | null>(null)
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
    const duration = result?.tier ? SINK_MS[result.tier] : 900
    const started = performance.now()
    let raf = 0
    setSinkT(0)
    const step = (now: number) => {
      const t = Math.min(1, (now - started) / duration)
      setSinkT(t)
      if (t < 1) raf = requestAnimationFrame(step)
      else setPhase('feedback')
    }
    raf = requestAnimationFrame(step)
    // A tab that is not painting holds rAF back; the dive still has to land, so
    // the fall is timed on the clock as well.
    const landing = window.setTimeout(() => setPhase('feedback'), duration + 120)
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(landing)
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
  const diveFrame = Math.max(240, viewport)
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
  const wobble = last?.tier ? chipWobble(last.tier, sinkE) : { x: 0, rot: 0 }
  const camera =
    phase === 'intro' || phase === 'error'
      ? 0
      : phase === 'done'
        ? Math.round(-depth * 2)
        : phase === 'sinking'
          ? // The camera rides 30 m under the falling answer, which is what
            // keeps it in the middle of the frame.
            Math.round(diveFrame / 2 - (chipDepth + 30) * 2)
          : phase === 'feedback'
            ? // Once it lands the camera stops 30 m under it, which parks the
              // banner dead centre instead of under the HUD.
              Math.round(diveFrame / 2 - (landing + 30) * 2)
            : Math.round(cardTarget - roundDepth * 2)
  // The engine pins the card to its own depth (2px a metre) and lets the camera
  // bring it to the waterline: at rest its top edge sits exactly on the surface.
  const cardTop = roundDepth * 2
  // Where the card sits on screen, which is also where the krill waits.
  const cardScreen = phase === 'feedback' ? Math.round(diveFrame / 2 - 60) : cardTarget
  // The depth readout rides the fall with the chip instead of jumping.
  const shownDepth = phase === 'sinking' ? Math.round(roundDepth + (depth - roundDepth) * sinkE) : depth
  const promptLabel =
    phase === 'intro'
      ? 'SURFACE'
      : results.length >= ROUNDS
        ? 'DIVE COMPLETE'
        : `PROMPT ${Math.min(landed + 1, ROUNDS)} OF ${ROUNDS}`

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
            className={`ds-world${
              (phase === 'preview' || phase === 'answering' || phase === 'sinking') && results.length === 0
                ? ' ds-reveal'
                : ''
            }`}
            // The intro's waterline is set in viewport units rather than from a
            // measured height: the panel around the page can settle after mount,
            // and a stale number sinks the title under the surface.
            style={{
              transform:
                phase === 'intro'
                  ? `translate3d(0, calc(${Math.round(diveFrame / 2 + 90)}px + var(--ds-intro-lift, 0px)), 0)`
                  : `translate3d(0, ${camera}px, 0)`,
            }}
          >
            <div className="ds-surface" style={{ top: -336 }}>
              <div className="ds-title">
                {'BUTTER'.split('').map((letter, index) => (
                  <span key={index} style={{ animationDelay: `${0.18 * index}s` }}>
                    {letter}
                  </span>
                ))}
              </div>
              <div className="ds-tagline">THE DAILY DIVE</div>
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
                className={`ds-chip ds-px${last.tier === 'krillion' ? ' gold' : ''}`}
                style={{
                  ['--cc' as string]: `var(--tier-${last.tier})`,
                  transform: `translate3d(calc(-50% + ${wobble.x.toFixed(2)}px), ${(chipDepth * 2).toFixed(2)}px, 0) rotate(${wobble.rot.toFixed(2)}deg)`,
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
          <div className="ds-vignette" />
          <div className="ds-edge" />

          <div className="ds-hud">
            <div className="ds-pod ds-px">
              <div className="label">DEPTH</div>
              <div className="ds-depth-num">{shownDepth.toLocaleString('en-US')}m</div>
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
              <div className="ds-score-num">{points}</div>
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
              dialog triggers stacked under the mute button. Ink has no menu,
              settings or wardrobe behind them, so they keep the look only. */}
          <button className="ds-site-menu" type="button" aria-hidden="true" tabIndex={-1}>
            <svg viewBox="0 0 20 20" fill="currentColor" shapeRendering="crispEdges" aria-hidden="true">
              <path d="M2 3h16v3H2zm0 6h16v3H2zm0 6h16v3H2z" />
            </svg>
          </button>
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

          <div
            className="ds-mascot"
            title="a friend"
            style={
              phase === 'intro' || phase === 'error'
                ? // The title screen places the krill from the stylesheet.
                  undefined
                : // Just outside the card's top-left corner: 157px to its left and
                  // a few pixels down, exactly where the shipped krill swims.
                  { top: cardScreen + 5, left: 'calc(50% - 402px)', margin: 0, bottom: 'auto' }
            }
          >
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
              {correction && (
                <div className="ds-correction" id="answer-correction" aria-live="polite">
                  <div className="ds-preview-pill ds-px ds-correction-panel">
                    <span className="ds-correction-arrow">
                      {correction.from} → {correction.to}
                    </span>
                    <span className="ds-correction-hint">auto-correct</span>
                  </div>
                </div>
              )}
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
