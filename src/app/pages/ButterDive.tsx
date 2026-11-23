import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'

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
type Phase = 'loading' | 'intro' | 'preview' | 'answering' | 'feedback' | 'done' | 'error'

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

const STOPS: [number, string][] = [
  [0, '#1d5580'],
  [150, '#123a5e'],
  [350, '#0b1526'],
  [800, '#081020'],
  [1400, '#050a14'],
  [2600, '#03070f'],
  [5200, '#02050b'],
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

function rgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** The water's colour at a depth, interpolated between the shipped stops. */
function seaColor(metres: number): [number, number, number] {
  const m = Math.max(0, metres)
  for (let i = STOPS.length - 1; i >= 0; i -= 1) {
    const [depth, color] = STOPS[i]
    if (m >= depth) {
      const next = STOPS[i + 1]
      if (!next) return rgb(color)
      const t = Math.min(1, (m - depth) / (next[0] - depth))
      const a = rgb(color)
      const b = rgb(next[1])
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
    }
  }
  return rgb(STOPS[0][1])
}

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function shade(color: [number, number, number], factor: number): string {
  return `rgb(${clampChannel(color[0] * factor)}, ${clampChannel(color[1] * factor)}, ${clampChannel(color[2] * factor)})`
}

/** Marine snow and the shafts of light, painted behind the world. */
function Sea({ depthRef }: { depthRef: { current: number } }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let raf = 0
    const dust = Array.from({ length: 64 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.7 + Math.random() * 1.9,
      v: 0.00004 + Math.random() * 0.00016,
      a: 0.06 + Math.random() * 0.24,
    }))
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr))
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)

    const paint = () => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (!w || !h) {
        raf = requestAnimationFrame(paint)
        return
      }
      const depth = depthRef.current
      const top = seaColor(depth)
      const grad = ctx.createLinearGradient(0, 0, 0, h)
      grad.addColorStop(0, shade(top, 1))
      grad.addColorStop(1, shade(seaColor(depth + 1200), 0.7))
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, w, h)

      // Sunlight only reaches the first few hundred metres.
      const light = Math.max(0, 1 - depth / 620)
      if (light > 0) {
        ctx.save()
        ctx.globalAlpha = 0.12 * light
        for (let i = 0; i < 5; i += 1) {
          const x = (w / 5) * (i + 0.5) + Math.sin(i * 2.1) * 24
          const shaft = ctx.createLinearGradient(x, 0, x + 90, h * 0.85)
          shaft.addColorStop(0, 'rgba(190,232,255,0.85)')
          shaft.addColorStop(1, 'rgba(190,232,255,0)')
          ctx.fillStyle = shaft
          ctx.beginPath()
          ctx.moveTo(x - 40, 0)
          ctx.lineTo(x + 40, 0)
          ctx.lineTo(x + 150, h)
          ctx.lineTo(x + 20, h)
          ctx.closePath()
          ctx.fill()
        }
        ctx.restore()
      }

      for (const flake of dust) {
        flake.y -= flake.v * 16 * (1 + depth / 900)
        if (flake.y < -0.02) {
          flake.y = 1.02
          flake.x = Math.random()
        }
        ctx.fillStyle = `rgba(214,238,255,${flake.a})`
        ctx.beginPath()
        ctx.arc(flake.x * w, flake.y * h, flake.r, 0, Math.PI * 2)
        ctx.fill()
      }
      raf = requestAnimationFrame(paint)
    }
    raf = requestAnimationFrame(paint)
    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [depthRef])

  return <canvas className="ds-sea" ref={canvasRef} aria-hidden />
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
  const [resetsIn, setResetsIn] = useState('')
  const [copied, setCopied] = useState(false)
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

  useEffect(() => {
    const resize = () => setViewport(window.innerHeight)
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
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
    if (!day || (phase !== 'preview' && phase !== 'answering' && phase !== 'feedback')) return
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
    setPhase('feedback')
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
  const live = phase === 'preview' || phase === 'answering' || phase === 'feedback'
  // The card hangs near the top of the water, the way the real dive parks it
  // below the HUD while the seamount scrolls past underneath.
  const anchor = phase === 'intro' || phase === 'done' || phase === 'error' ? 0 : Math.round(viewport * 0.26)
  const camera = Math.round(anchor - depth * 2)
  const cardTop = depth * 2
  const promptLabel =
    phase === 'intro'
      ? 'SURFACE'
      : results.length >= ROUNDS
        ? 'DIVE COMPLETE'
        : `PROMPT ${Math.min(round + 1, ROUNDS)} OF ${ROUNDS}`

  return (
    <div className="dive-page butter-dive relative min-h-0 flex-1 overflow-hidden" data-phase={phase}>
      <div className="kr-ad-layout">
      <div className="ds-root" data-phase={phase === 'error' || phase === 'loading' ? 'intro' : phase}>
        <div className="ds-stage">
          <Sea depthRef={depthRef} />
          <div className={`ds-world${phase === 'intro' ? '' : ' ds-reveal'}`} style={{ transform: `translate3d(0, ${camera}px, 0)` }}>
            <div className="ds-surface" style={{ top: phase === 'intro' ? 0 : -336 }}>
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

            {day && prompt && live && (
              <div className="ds-card ds-px" style={{ top: cardTop, animationDelay: '0.45s' }}>
                <div className="rnd">
                  PROMPT {round + 1} OF {ROUNDS}
                </div>
                <div className="prompt">{prompt.text}</div>
                <div className="hint">▼ rarer answers sink deeper ▼</div>
              </div>
            )}

            {phase === 'feedback' && last && (
              <div
                className={`ds-landed${last.tier ? '' : ' miss'}`}
                style={{ top: cardTop, ['--tc' as string]: last.tier ? TIERS[last.tier].color : '#7d93b8' }}
              >
                {last.tier && <img className="icon" src={`/tiers/${last.tier}.png`} alt="" />}
                <div className="tname">{last.tier ? TIERS[last.tier].name.toUpperCase() : 'NOTHING LANDED'}</div>
                <div className="tans">{last.answer ? `“${last.answer}”` : '—'}</div>
                <div className="tpts">
                  <b>+{last.score} PTS</b>
                  {last.score > 0 ? ` · sink ${(last.score * METRES_PER_POINT).toLocaleString('en-US')}m` : ''}
                </div>
                <div className="tsub">{last.quip ?? (last.tier ? TIERS[last.tier].blurb : 'the puffer floats on')}</div>
              </div>
            )}
          </div>

          <div className="ds-dim" />
          <div className="ds-vignette" />
          <div className="ds-edge" />

          <div className="ds-hud">
            <div className="ds-pod ds-px">
              <div className="label">DEPTH</div>
              <div className="ds-depth-num">{depth.toLocaleString('en-US')}m</div>
            </div>
            <div className="ds-hud-mid">
              <div className="ds-dots">
                {Array.from({ length: ROUNDS }, (_, index) => (
                  <i
                    key={index}
                    className={
                      index < results.length
                        ? 'done'
                        : index === round && phase !== 'done' && phase !== 'intro'
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

          <div className="ds-mascot" title="a friend">
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
                <div className="butter-dive-actions">
                  <button className="ds-begin-btn" type="button" onClick={begin}>
                    ▼ BEGIN DESCENT ▼
                  </button>
                </div>
                <div className="ds-intro-meta" style={{ flexWrap: 'wrap' }}>
                  <span>dive #{day.dayNumber}</span>
                  <div className="butter-dive-meta-links">
                    <Link to="/butter/party">puffer party →</Link>
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
