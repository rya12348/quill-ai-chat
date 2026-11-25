import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'

import { ButterMenu } from '../components/ButterMenu'
import { bandFor, MAX_SCORE, packOf, ROUNDS, TIERS, type TierId } from '../lib/butter-packs'
import { PACK_WORLDS, PX_PER_POINT, image, paintPackWorld, themeImages } from '../lib/pack-world'
import {
  createGoldSpriteController,
  createMascotSpriteController,
  playMascotState,
  seasonalKrillSprite,
  type GoldSprite,
  type MascotSprite,
  type MascotState,
} from '../lib/butter-sprites'

/**
 * A themed pack — the movies, the gauntlet, the atlas, the notebook — and the
 * endless dive, which is the same seven rounds in open water.
 *
 * The flow is the shipped one, read out of the bundle: an intro that names the
 * pack and its number, seven rounds of `preview → answering → feedback`, then a
 * result screen with the score, the route gauge, the band verdicts, the answer
 * sheet and the next game. The rounds, the version string and every verdict come
 * from their own endpoints through `/api/butter-packs`, so an answer is graded
 * by the same card the real game would grade it against.
 */

type Phase = 'loading' | 'intro' | 'preview' | 'answering' | 'feedback' | 'done' | 'error'
type Prompt = { id: string; text: string }
type Deck = { game: number; version: string; lastGame: number; prompts: Prompt[] }
type Result = {
  promptId: string
  promptText: string
  rawAnswer: string | null
  answer: string | null
  tier: TierId | null
  score: number
  quip?: string
  receipt?: string
}
type Saved = { runId: string; version: string; results: Result[]; round: number }
type SheetRound = {
  round: string
  text: string
  answers: { answer: string; tier: TierId; score: number; quip?: string }[]
}

const PREVIEW_MS = 3_000
const ANSWER_MS = 25_000
const MAX_ANSWER_LENGTH = 256
const PLAYER_KEY = 'butter.dive.player'

function playerId(): string {
  let id = ''
  try {
    id = localStorage.getItem(PLAYER_KEY) ?? ''
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(PLAYER_KEY, id)
    }
  } catch {
    id = crypto.randomUUID()
  }
  return id
}

const saveKey = (pack: string, game: number) => `butter.pack.${pack}.${game}`

function loadSaved(pack: string, game: number): Saved | null {
  try {
    const raw = localStorage.getItem(saveKey(pack, game))
    if (!raw) return null
    const saved = JSON.parse(raw) as Saved
    return Array.isArray(saved.results) && typeof saved.runId === 'string' ? saved : null
  } catch {
    return null
  }
}

function keep(pack: string, game: number, saved: Saved | null): void {
  try {
    if (saved) localStorage.setItem(saveKey(pack, game), JSON.stringify(saved))
    else localStorage.removeItem(saveKey(pack, game))
  } catch {
    /* a full quota only costs the resume, not the run */
  }
}

/* ------------------------------------------------------ the percentile, once */

/**
 * How the shipped result screen keeps a run from being recorded twice: the
 * finished run claims its percentile in local storage before the request goes
 * out, and every later mount of the same run reads the claim back instead of
 * posting again — a reload, or the logbook reopening it, shows the stored number.
 * The in-memory copies cover a remount inside the tab (and an answer that is
 * still in flight), the stored copy covers a reload.
 */
type Claim = { betterThan: number | null; at: number }
const CLAIMS_KEY = 'butter.pack.claims'
const claims = new Map<string, Claim>() // runId → what the table answered
const pending = new Map<string, Promise<number | null>>()
let claimsRead = false

function readClaims(): void {
  if (claimsRead) return
  claimsRead = true
  try {
    const raw = localStorage.getItem(CLAIMS_KEY)
    if (!raw) return
    const stored = JSON.parse(raw) as Record<string, Claim>
    for (const [runId, claim] of Object.entries(stored ?? {})) {
      if (!claim || typeof claim.at !== 'number') continue
      claims.set(runId, {
        betterThan: typeof claim.betterThan === 'number' ? claim.betterThan : null,
        at: claim.at,
      })
    }
  } catch {
    /* unreadable storage only costs the shortcut, not the run */
  }
}

/** Keep the newest handful of runs — the logbook can reopen an older one. */
function keepClaim(runId: string, claim: Claim): void {
  readClaims()
  claims.set(runId, claim)
  try {
    const newest = [...claims.entries()].sort((a, b) => b[1].at - a[1].at).slice(0, 24)
    localStorage.setItem(CLAIMS_KEY, JSON.stringify(Object.fromEntries(newest)))
  } catch {
    /* a full quota still leaves the in-memory claim */
  }
}

/**
 * Post one finished run's score exactly once. Resolves the run's percentile, or
 * null when the table could not be asked (the gauge reads without the crowd).
 */
function completeOnce(run: {
  pack: string
  game: number
  runId: string
  version: string
  score: number
  receipts: string[]
}): Promise<number | null> {
  readClaims()
  // The run already claimed its post — including one the table refused: asking
  // again on every open is what turned one run into two submissions.
  const claimed = claims.get(run.runId)
  if (claimed) return Promise.resolve(claimed.betterThan)
  const already = pending.get(run.runId)
  if (already) return already
  // The claim goes down before the request, the way the shipped screen writes
  // its receipt first, so a second mount in the same tick finds it instead of
  // posting the same run twice.
  keepClaim(run.runId, { betterThan: null, at: Date.now() })
  const work = (async () => {
    try {
      const res = await fetch(`/api/butter-packs/${run.pack}/${run.game}/complete`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          playerId: playerId(),
          score: run.score,
          receipts: run.receipts,
          runId: run.runId,
          version: run.version,
        }),
      })
      const body = (await res.json().catch(() => null)) as { betterThan?: number } | null
      if (!res.ok || typeof body?.betterThan !== 'number') return null
      keepClaim(run.runId, { betterThan: body.betterThan, at: Date.now() })
      return body.betterThan
    } catch {
      return null
    } finally {
      pending.delete(run.runId)
    }
  })()
  pending.set(run.runId, work)
  return work
}

/** The four chips a pack's own HUD shows under the score. */
function tierIcon(tier: TierId | null): string {
  if (!tier) return '—'
  return TIERS[tier].color
}

export function ButterPack({ packId }: { packId: string }) {
  const pack = packOf(packId)
  const [params, setParams] = useSearchParams()
  const requested = Number(params.get('game') ?? '')
  const [deck, setDeck] = useState<Deck | null>(null)
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
  const [picker, setPicker] = useState(false)
  const [sheet, setSheet] = useState<SheetRound[] | null | undefined>(undefined)
  const [openRound, setOpenRound] = useState<string | null>(null)
  const [curve, setCurve] = useState<{ betterThan: number } | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const runIdRef = useRef('')
  const stageRef = useRef<HTMLDivElement | null>(null)
  const seaRef = useRef<HTMLCanvasElement | null>(null)
  const worldRef = useRef<HTMLDivElement | null>(null)
  const mascotHostRef = useRef<HTMLDivElement | null>(null)
  const mascotRef = useRef<HTMLImageElement | null>(null)
  const carRef = useRef<HTMLImageElement | null>(null)
  const mascotCtl = useRef<MascotSprite | null>(null)
  const carCtl = useRef<GoldSprite | null>(null)
  // The ladder appears rung by rung: the shipped one is appended at opacity 0
  // and faded in on the next frame, so the transition has something to run on.
  const [rungsIn, setRungsIn] = useState(false)
  const worldTheme = PACK_WORLDS[pack.id as keyof typeof PACK_WORLDS]
  // The shipped strip starts just behind the gate; the camera follows the score.
  const targetRef = useRef(-45)

  const points = useMemo(() => results.reduce((sum, result) => sum + result.score, 0), [results])
  // One krillion anywhere in the run gilds the krill and the car for good.
  const gold = results.some((result) => result.tier === 'krillion')
  targetRef.current = phase === 'intro' || phase === 'loading' || phase === 'error' ? -45 : points

  useEffect(() => {
    document.title = `${pack.name} · Butter`
    return () => {
      document.title = 'Butter · Ink'
    }
  }, [pack.name])

  /* ------------------------------------------------------------------- deck */

  const dealing = useCallback(
    async (game: number) => {
      setPhase('loading')
      setError(null)
      try {
        const res = await fetch(`/api/butter-packs/${pack.id}/${game}`, { cache: 'no-store' })
        const body = (await res.json().catch(() => null)) as (Deck & { error?: string; lastGame?: number }) | null
        if (res.status === 404 && typeof body?.lastGame === 'number' && body.lastGame !== game) {
          setParams({ game: String(Math.max(1, body.lastGame)) }, { replace: true })
          return
        }
        if (!res.ok || !body || !Array.isArray(body.prompts) || body.prompts.length !== ROUNDS) {
          throw new Error(body?.error ?? "Couldn't deal this one")
        }
        setDeck(body)
        const saved = loadSaved(pack.id, body.game)
        if (saved && saved.version === body.version && saved.results.length === ROUNDS) {
          runIdRef.current = saved.runId
          setResults(saved.results)
          setRound(ROUNDS - 1)
          setPhase('done')
          return
        }
        if (saved && saved.version === body.version) {
          runIdRef.current = saved.runId
          setResults(saved.results)
          setRound(saved.round)
          setPhase('preview')
          setEndsAt(Date.now() + PREVIEW_MS)
          return
        }
        runIdRef.current = crypto.randomUUID()
        setResults([])
        setRound(0)
        setPhase('intro')
      } catch (problem) {
        setError(problem instanceof Error ? problem.message : 'The packs are out of reach.')
        setPhase('error')
      }
    },
    [pack.id, setParams],
  )

  const game = deck?.game ?? (Number.isFinite(requested) && requested >= 1 ? requested : 1)

  useEffect(() => {
    void dealing(Number.isFinite(requested) && requested >= 1 ? requested : 1)
    // A different `?game=` is a different deck.
  }, [dealing, requested])

  /* ------------------------------------------------------------- the clock */

  useEffect(() => {
    if (phase !== 'preview' && phase !== 'answering') return
    const tick = window.setInterval(() => setNow(Date.now()), 100)
    return () => window.clearInterval(tick)
  }, [phase])

  useEffect(() => {
    if (phase !== 'preview' && phase !== 'answering') return
    if (deck) keep(pack.id, deck.game, { runId: runIdRef.current, version: deck.version, results, round })
  }, [deck, pack.id, phase, results, round])

  useEffect(() => {
    if (phase === 'answering') inputRef.current?.focus()
  }, [phase, round])

  const land = useCallback(
    (result: Result) => {
      setResults((current) => (current.length > round ? current : [...current, result]))
      setInput('')
      setCorrection(null)
      setRejected(null)
      setEndsAt(null)
      setPhase('feedback')
    },
    [round],
  )

  const miss = useCallback(
    (answerText: string | null) => {
      const prompt = deck?.prompts[round]
      if (!prompt) return
      land({
        promptId: prompt.id,
        promptText: prompt.text,
        rawAnswer: answerText,
        answer: null,
        tier: null,
        score: 0,
      })
    },
    [deck, land, round],
  )

  const send = useCallback(
    async (raw: string) => {
      if (!deck || busy) return
      const prompt = deck.prompts[round]
      if (!prompt) return
      const text = raw.trim()
      setBusy(true)
      setRejected(null)
      try {
        const res = await fetch(`/api/butter-packs/${pack.id}/${deck.game}/submit`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            round: prompt.id,
            answer: text,
            previewCorrection: false,
            version: deck.version,
            playerId: playerId(),
            runId: runIdRef.current,
          }),
        })
        const data = (await res.json().catch(() => null)) as
          | {
              accepted?: boolean
              answer?: string
              tier?: TierId
              score?: number
              quip?: string
              receipt?: string
              correction?: string
              rejectionReason?: string
              error?: string
            }
          | null
        if (res.status === 409) {
          void dealing(deck.game)
          return
        }
        if (!res.ok) {
          setRejected(data?.error ?? 'signal lost. resend')
          return
        }
        if (data?.correction) {
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
            receipt: data.receipt,
          })
          return
        }
        const late = endsAt !== null && Date.now() >= endsAt
        if (late) {
          miss(text)
          return
        }
        setRejected(
          data?.rejectionReason ? `${data.rejectionReason} Try again.` : pack.ui.reject(text),
        )
        setRejectAt((n) => n + 1)
      } catch {
        setRejected('signal lost. resend')
        setRejectAt((n) => n + 1)
      } finally {
        setBusy(false)
      }
    },
    [busy, deck, endsAt, land, miss, pack.id, pack.ui, round],
  )

  // The preview counts down, then the clock starts; when it runs out the dock
  // sends what is typed, or the round lands empty.
  useEffect(() => {
    if (!deck || (phase !== 'preview' && phase !== 'answering')) return
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
  }, [busy, deck, endsAt, input, miss, now, phase, send])

  const begin = useCallback(() => {
    if (deck) keep(pack.id, deck.game, null)
    runIdRef.current = crypto.randomUUID()
    setRound(0)
    setResults([])
    setInput('')
    setCorrection(null)
    setRejected(null)
    setEndsAt(Date.now() + PREVIEW_MS)
    setPhase('preview')
  }, [deck, pack.id])

  const advance = useCallback(() => {
    if (!deck) return
    if (round >= ROUNDS - 1) {
      setPhase('done')
      return
    }
    setRound((current) => current + 1)
    setInput('')
    setCorrection(null)
    setRejected(null)
    setEndsAt(Date.now() + PREVIEW_MS)
    setPhase('preview')
  }, [deck, round])

  /* --------------------------------------------------------- the wrap-up */

  useEffect(() => {
    if (phase !== 'done' || !deck) return
    // The finished run is what a reload and the logbook read back.
    keep(pack.id, deck.game, { runId: runIdRef.current, version: deck.version, results, round: ROUNDS - 1 })
    let live = true
    setSheet(undefined)
    setCurve(null)
    setOpenRound(null)
    const load = async () => {
      try {
        const res = await fetch(`/api/butter-packs/${pack.id}/${deck.game}/reveal`)
        const body = (await res.json().catch(() => null)) as { rounds?: SheetRound[] } | null
        if (live) setSheet(res.ok && Array.isArray(body?.rounds) ? body.rounds : null)
      } catch {
        if (live) setSheet(null)
      }
    }
    const complete = async () => {
      const receipts = results.map((result) => result.receipt).filter((item): item is string => Boolean(item))
      const runId = runIdRef.current
      if (receipts.length !== ROUNDS || !runId) return
      // One post per run, the way the shipped screen claims it: reopening a
      // finished run reads its stored percentile back instead of asking again.
      const betterThan = await completeOnce({
        pack: pack.id,
        game: deck.game,
        runId,
        version: deck.version,
        score: points,
        receipts,
      })
      if (live && betterThan !== null) setCurve({ betterThan })
    }
    void load()
    void complete()
    return () => {
      live = false
    }
  }, [deck, pack.id, phase, points, results])

  const pickGame = useCallback(
    (next: number) => {
      setPicker(false)
      setParams({ game: String(next) })
    },
    [setParams],
  )

  /** Play this one again from the top: a fresh run id, a fresh card. */
  const restart = useCallback(() => {
    if (!deck) return
    keep(pack.id, deck.game, null)
    runIdRef.current = crypto.randomUUID()
    setResults([])
    setRound(0)
    setPhase('intro')
  }, [deck, pack.id])

  /**
   * The strip itself. Every pack page is one long world the camera keeps centred:
   * the shipped painter draws the sky and the ground on the canvas, the DOM
   * cards ride inside the strip at twice their score, and the camera eases
   * toward the current one exactly as the shipped renderer does.
   */
  useEffect(() => {
    const canvas = seaRef.current
    const theme = worldTheme
    if (!canvas || !theme) return
    const context = canvas.getContext('2d')
    if (!context) return
    let width = 1
    let height = 1
    let distance = -45
    let dirty = true
    let stopped = false
    let frame = 0
    let then = performance.now()
    const pictures = themeImages(theme)
    const onLoad = () => {
      dirty = true
    }
    const draw = () => {
      dirty = false
      const ratio = Math.min(2, window.devicePixelRatio || 1)
      const box = canvas.getBoundingClientRect()
      width = Math.max(1, Math.round(box.width))
      height = Math.max(1, Math.round(box.height))
      if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
        canvas.width = Math.round(width * ratio)
        canvas.height = Math.round(height * ratio)
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      paintPackWorld(context, theme, width, height, distance * PX_PER_POINT, onLoad)
    }
    const step = (time: number) => {
      if (stopped) return
      const dt = Math.min(0.05, Math.max(0.001, (time - then) / 1000))
      then = time
      const goal = targetRef.current
      const next = distance + (goal - distance) * (1 - Math.exp(-3.4 * dt))
      const moved = Math.abs(next - distance) > 0.02
      distance = moved ? next : goal
      if (moved || dirty) draw()
      if (worldRef.current) {
        // The world is 2px a point; the camera keeps its origin at mid-screen.
        worldRef.current.style.transform = `translate3d(${width / 2 - PX_PER_POINT * distance}px,0,0)`
      }
      frame = requestAnimationFrame(step)
    }
    // First paint before the loop's first frame: a tab that is not being drawn
    // never gets an animation frame, and a blank stage is not a loading state.
    draw()
    if (worldRef.current) {
      worldRef.current.style.transform = `translate3d(${width / 2 - PX_PER_POINT * distance}px,0,0)`
    }
    frame = requestAnimationFrame(step)
    // A picture that lands after the first frame has to trigger one more paint,
    // and a resized stage needs the canvas resized with it.
    const pending = window.setInterval(() => {
      if (pictures.some((src) => !image(src).complete)) dirty = true
      // Paint here as well as in the loop: a hidden tab is never handed an
      // animation frame, and the strip should still be complete when it is
      // looked at.
      if (dirty && !stopped) draw()
    }, 200)
    const observer = new ResizeObserver(() => {
      dirty = true
    })
    observer.observe(canvas)
    return () => {
      stopped = true
      window.clearInterval(pending)
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [worldTheme])

  /* ------------------------------------------- the krill and the buddy car */

  // Both are the shipped controllers: the mascot's gold swap, its season swap
  // and its fx layers come from `createMascotSpriteController`, and the movies'
  // car from the shared `createGoldSpriteController` it hands the two files to.
  useEffect(() => {
    const img = mascotRef.current
    if (!img) return
    const mascot = createMascotSpriteController(img)
    mascotCtl.current = mascot
    let car: GoldSprite | null = null
    if (worldTheme?.kind === 'cinema' && carRef.current) {
      car = createGoldSpriteController(carRef.current, worldTheme.car, worldTheme.carGold)
      carCtl.current = car
    }
    return () => {
      mascot.destroy()
      car?.destroy()
      mascotCtl.current = null
      carCtl.current = null
    }
  }, [worldTheme])

  // The shipped `plunge` sets the gold on both sprites and the class on both
  // elements; the krill's own `.gold` is what starts the aura breathing.
  useEffect(() => {
    mascotCtl.current?.setGold(gold)
    carCtl.current?.setGold(gold)
    carRef.current?.classList.toggle('gold', gold)
    mascotHostRef.current?.classList.toggle('gold', gold)
  }, [gold])

  // The shipped per-tier reaction, off its own `plunge` switch: a miss and a
  // plankton answer droop, a Too Clever answer faints, the rest celebrate, and a
  // krillion gilds on top of that.
  useEffect(() => {
    if (phase !== 'feedback') return
    const landed = results[results.length - 1]
    const img = mascotRef.current
    if (!landed || !img) return
    const state: MascotState = !landed.tier
      ? 'sad'
      : landed.tier === 'plankton'
        ? 'sad'
        : landed.tier === 'tooclever'
          ? 'faint'
          : 'celebrate'
    const ms = !landed.tier ? 2600 : landed.tier === 'plankton' ? 4200 : landed.tier === 'tooclever' ? 2400 : 1250
    playMascotState(img, state, ms)
    const host = mascotHostRef.current
    if (landed.tier !== 'krillion' || !host) return
    host.classList.remove('gilding')
    void host.offsetWidth
    host.classList.add('gilding')
    const timer = window.setTimeout(() => host.classList.remove('gilding'), 1200)
    return () => window.clearTimeout(timer)
  }, [phase, results])

  // The ladder is laid out on the plunge and faded in rung by rung; the shipped
  // one is appended at opacity 0 and flipped on the next frame for that reason.
  useEffect(() => {
    if (phase !== 'feedback') {
      setRungsIn(false)
      return
    }
    setRungsIn(false)
    const frame = requestAnimationFrame(() => setRungsIn(true))
    // A tab that is not being painted is never handed a frame, and the ladder
    // still has to be readable when it is looked at.
    const timer = window.setTimeout(() => setRungsIn(true), 120)
    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(timer)
    }
  }, [phase, round])

  /* -------------------------------------------------------------- render */

  const prompt = deck?.prompts[round] ?? null
  const last = results[results.length - 1] ?? null
  const answerLeft = phase === 'answering' && endsAt !== null ? Math.max(0, endsAt - now) : ANSWER_MS
  const seconds = Math.ceil(answerLeft / 1_000)
  const hot = phase === 'answering' && answerLeft <= 3_050
  const previewSeconds =
    phase === 'preview' && endsAt !== null ? Math.max(0, Math.ceil((endsAt - now) / 1_000)) : 0
  const shownGame = deck?.game ?? game
  const band = bandFor(pack, points)
  const savedRun = deck ? loadSaved(pack.id, deck.game) : null
  // Cards live where they were dealt: two pixels of strip for every point the
  // table had when it dealt them. Only the two scrolling worlds place them.
  const dealt = results.map((result, index) => ({
    result,
    start: results.slice(0, index).reduce((sum, entry) => sum + entry.score, 0),
  }))
  const scrolling = worldTheme?.kind === 'cinema' || worldTheme?.kind === 'gauntlet'
  const at = (score: number) => (scrolling ? { left: PX_PER_POINT * score } : undefined)
  // The mascot and the car ride the strip at the camera's own score, which is
  // where the shipped engine writes them each frame. The two still worlds have
  // no strip to ride, so they hold the middle of the stage.
  const stripLeft = (score: number) => (scrolling ? PX_PER_POINT * score : '50%')
  // The ladder starts where the round did: every rung is that many points on.
  const ladderBase = points - (last?.score ?? 0)
  const hudLabel =
    pack.id === 'movies' ? 'SCENE' : pack.id === 'sports' ? 'YARD' : pack.id === 'geography' ? 'LEG' : pack.id === 'lexicon' ? 'PAGE' : 'DEPTH'

  return (
    <div className="dive-page butter-dive relative min-h-0 flex-1 overflow-hidden" data-phase={phase}>
      <div
        className="ds-root pk-root"
        data-world={pack.world}
        data-phase={phase === 'error' || phase === 'loading' ? 'intro' : phase}
      >
        <div className="ds-stage" ref={stageRef}>
          {worldTheme ? (
            <canvas className="pk-sea" ref={seaRef} aria-hidden />
          ) : (
            <div
              className={`pk-scene${phase === 'intro' || phase === 'loading' || phase === 'error' ? '' : ' pk-dim'}`}
              style={{ backgroundImage: `url(${pack.scene ?? pack.art})` }}
              aria-hidden
            />
          )}
          <div className="pk-shade" aria-hidden />

          <div className="ds-world" ref={worldRef}>
            {(phase === 'intro' || phase === 'loading' || phase === 'error') && (
              <div
                className="ds-surface pk-surface"
                style={worldTheme?.kind === 'cinema' ? { left: -690, width: 1200, right: 'auto' } : undefined}
              >
                <div className="ds-title">
                  {'BUTTER'.split('').map((letter, index) => (
                    <span key={index} style={{ animationDelay: `${0.18 * index}s` }}>
                      {letter}
                    </span>
                  ))}
                </div>
                <div className="ds-tagline">{pack.tagline}</div>
                <div className="ds-subline">{pack.subline}</div>
              </div>
            )}

            {worldTheme?.kind === 'cinema' && (
              <>
                <img className="dr-gate" src={worldTheme.gate} alt="" style={{ left: -510 }} aria-hidden />
                <img
                  className="ds-floor dr-premiere"
                  src={worldTheme.premiere}
                  alt=""
                  style={{ left: 14020 }}
                  aria-hidden
                />
              </>
            )}

            {worldTheme?.kind === 'cinema' && (
              <img
                ref={carRef}
                className={`dr-buddy-car pk-car${gold ? ' gold' : ''}`}
                src={worldTheme.car}
                alt=""
                aria-hidden
                style={{ left: stripLeft(points) }}
              />
            )}

            <div
              className="ds-mascot pk-mascot"
              title="a friend"
              ref={mascotHostRef}
              style={{ left: stripLeft(points) }}
            >
              <span className="ds-mascot-sprite">
                <img ref={mascotRef} src="/tiers/krillion.png" alt="krill" />
              </span>
              <span className="ds-blub">blub!</span>
            </div>
            {(phase === 'preview' || phase === 'answering') && prompt && (
              <div className="ds-card ds-px" style={{ ...at(points), animationDelay: '0.45s' }}>
                <div className="rnd">
                  {pack.promptWord} {round + 1} OF {ROUNDS}
                </div>
                <div className="prompt">{prompt.text}</div>
                <div className="hint">{pack.hint}</div>
              </div>
            )}

            {phase !== 'intro' && phase !== 'done' && phase !== 'loading' && phase !== 'error' &&
              dealt.map(({ result, start }, index) =>
                phase === 'feedback' && result === last ? null : (
                <div className="ds-card ds-px" key={result.promptId} style={at(start)} aria-hidden>
                  <div className="rnd">
                    {pack.promptWord} {index + 1} OF {ROUNDS}
                  </div>
                  <div className="prompt">{result.promptText}</div>
                  <div className="hint">{pack.hint}</div>
                </div>
                ),
              )}

            {/* The tier ladder, laid out on the plunge the way the shipped one is:
                every rung sits where an answer of that tier would have landed from
                the score this round started at, alternating its tag above and below
                the line, and turns gold once the camera has passed it. */}
            {scrolling &&
              phase === 'feedback' &&
              last?.tier &&
              Object.entries(TIERS).map(([id, tier], index) => {
                const rung = ladderBase + tier.score
                const passed = points > rung - 0.5
                return (
                  <div
                    key={id}
                    className={`ds-tierline${passed ? ' passed' : ''}`}
                    style={{
                      left: PX_PER_POINT * rung,
                      opacity: rungsIn ? 1 : 0,
                      transition: `opacity .55s ease-out ${90 * index}ms`,
                      ['--tc' as string]: `var(--tier-${id})`,
                      ['--tag-y' as string]: index % 2 ? '-52px' : '-24px',
                    }}
                  >
                    <div className="tag">
                      <img src={seasonalKrillSprite(`/tiers/${id}.png`)} alt="" />
                      {tier.name.toUpperCase()} &middot; {tier.score}
                    </div>
                    <i className="pole" />
                  </div>
                )
              })}

            {phase === 'feedback' && last && (
              <div
                className={`ds-landed${last.tier ? '' : ' miss'}`}
                style={{
                  ...at(points),
                  ['--tc' as string]: last.tier ? `var(--tier-${last.tier})` : 'var(--tier-miss)',
                }}
              >
                  {last.tier && <img className="icon" src={`/tiers/${last.tier}.png`} alt="" />}
                  <div className="tname">{last.tier ? TIERS[last.tier].name.toUpperCase() : 'NOTHING LANDED'}</div>
                  <div className="tans">{last.answer ? `“${last.answer}”` : '—'}</div>
                  <div className="tpts">
                    <b>+{last.score} PTS</b>
                    {last.score > 0 ? ` · ${pack.ui.dist(last.score)}` : null}
                  </div>
                  <div className="tsub">
                    {last.quip ??
                      (last.tier
                        ? TIERS[last.tier].blurb
                        : last.rawAnswer
                          ? pack.missTyped
                          : 'the clock beat you to it.')}
                  </div>
              </div>
            )}
          </div>

          <div className="ds-dim" />
          <div className="ds-vignette" />
          <div className="ds-edge" />

          <div className="ds-hud">
            <div className="ds-pod ds-px">
              <div className="label">{hudLabel}</div>
              <div className="ds-depth-num">{Math.floor(Math.max(0, points) / 100)}</div>
            </div>
            <div className="ds-hud-mid">
              <div className="ds-dots">
                {Array.from({ length: ROUNDS }, (_, index) => (
                  <i
                    key={index}
                    className={
                      index < results.length
                        ? 'done'
                        : index === results.length && phase !== 'done' && phase !== 'intro'
                          ? 'cur'
                          : ''
                    }
                  />
                ))}
              </div>
              <div className="ds-prompt-count">
                {pack.diveLabel.toUpperCase()} #{shownGame}
              </div>
            </div>
            <div className="ds-pod ds-px ds-score-pod">
              <div className="label">SCORE</div>
              <div className="ds-score-num">{points}</div>
            </div>
          </div>

          <ButterMenu className="ds-site-menu" />
          <div className="ds-crt" />

          {(phase === 'intro' || phase === 'loading' || phase === 'error') && (
            <div className="ds-intro">
              <div className="ds-intro-inner">
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
                <button className="pk-picker-link" type="button" onClick={() => setPicker(true)}>
                  {pack.pickerLabel.toUpperCase()}
                </button>
                <div className="pk-actions">
                  <button
                    className="ds-begin-btn"
                    type="button"
                    onClick={begin}
                    disabled={phase !== 'intro'}
                  >
                    {phase === 'intro' ? pack.ui.begin : phase === 'error' ? 'TRY AGAIN' : pack.ui.boot}
                  </button>
                </div>
                {error && <p className="pk-error">{error}</p>}
                <div className="ds-intro-meta">
                  <span>
                    {pack.diveLabel} #{shownGame}
                  </span>
                  <div className="butter-dive-meta-links">
                    {pack.introLinks.map((link) => (
                      <Link key={link.to + link.label} to={link.to}>
                        {link.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {phase === 'preview' && (
            <div className="ds-preview-pill ds-px">
              {pack.ui.previewPrefix} <b>{previewSeconds}</b>
            </div>
          )}

          {phase === 'answering' && (
            <>
              <div className="ds-correction" role="status" aria-live="polite" aria-atomic="true">
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
                    {busy ? '…' : pack.ui.submit}
                  </button>
                </div>
              </form>
            </>
          )}

          {phase === 'feedback' && last && (
            <div className="ds-next-wrap">
              <button className="ds-next-btn" type="button" onClick={advance}>
                {round >= ROUNDS - 1 ? pack.ui.surface : pack.ui.next}
              </button>
            </div>
          )}

          {phase === 'done' && deck && (
            <div className="ds-done">
              <div className="ds-done-inner">
                <div className="flex flex-col gap-9 mt-1 pb-12 w-full">
                  <div>
                    <div className="flex items-baseline justify-between">
                      <span className="ds-done-krill">BUTTER</span>
                      <span className="font-mono-ui text-[13px] tracking-[0.14em] text-drift uppercase">
                        {pack.ui.doneHeadline(deck.game)}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2 mt-4">
                      <span className="font-display text-[5rem] leading-none text-foam tabular-nums">{points}</span>
                      <span className="font-mono-ui text-sm text-drift">/ {MAX_SCORE}</span>
                      <span className="font-mono-ui text-sm text-lumen-cyan tabular-nums ml-2">
                        {pack.ui.dist(points)}
                      </span>
                    </div>
                    <p className="pk-band">{band.verdict}</p>
                    {curve && (
                      <p className="pk-curve">
                        better than {curve.betterThan >= 99.5 ? curve.betterThan.toFixed(2) : curve.betterThan}% of
                        first runs on {pack.diveLabel} #{deck.game}
                      </p>
                    )}
                  </div>

                  <section>
                    <p className="fathom mb-1">
                      <span>{pack.ui.gaugeTitle}</span>
                      <span className="fathom-depth">{pack.ui.gaugeSub}</span>
                    </p>
                    <div className="pk-gauge">
                      {results.map((result, index) => (
                        <div className="pk-gauge-col" key={result.promptId}>
                          <span
                            className="pk-gauge-bar"
                            style={{
                              height: `${Math.max(4, result.score)}%`,
                              background: result.tier ? TIERS[result.tier].color : 'var(--tier-miss)',
                            }}
                          />
                          <span className="pk-gauge-num">{index + 1}</span>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section>
                    <p className="fathom mb-1">
                      <span>{pack.ui.catchLabel}</span>
                      <span className="fathom-depth">tap a round for every answer</span>
                    </p>
                    <ul>
                      {results.map((result, index) => {
                        const sheetRound = sheet?.find((entry) => entry.round === result.promptId)
                        const open = openRound === result.promptId
                        return (
                          <li key={result.promptId} className="py-2.5 border-b last:border-b-0" style={{ borderColor: 'var(--hairline)' }}>
                            <button
                              type="button"
                              className="flex items-center gap-3 w-full text-left"
                              onClick={() => setOpenRound(open ? null : result.promptId)}
                              aria-expanded={open}
                            >
                              <span className="font-mono-ui text-[12px] text-drift/60 w-3 shrink-0">{index + 1}</span>
                              <span
                                className="font-mono-ui text-[11px] w-3 shrink-0"
                                style={{ color: tierIcon(result.tier) }}
                                aria-hidden
                              >
                                ●
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="font-mono-ui text-[12px] text-drift/70 truncate uppercase tracking-[0.05em]">
                                  {sheetRound?.text ?? result.promptText}
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
                            {open &&
                              (sheetRound ? (
                                <ul className="pk-sheet">
                                  {sheetRound.answers.slice(0, 40).map((entry) => (
                                    <li key={entry.answer}>
                                      <span style={{ color: TIERS[entry.tier]?.color ?? 'var(--tier-miss)' }}>
                                        {entry.tier}
                                      </span>
                                      <b>{entry.answer}</b>
                                      {entry.quip && <em>{entry.quip}</em>}
                                    </li>
                                  ))}
                                </ul>
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
                      <span>{pack.ui.bearingLabel}</span>
                    </p>
                    <ul>
                      {pack.bands.map((entry) => (
                        <li
                          key={entry.min}
                          className="flex items-center gap-3 px-1.5 py-2 border-b last:border-b-0"
                          style={{ borderColor: 'var(--hairline)' }}
                        >
                          <span className="font-mono-ui text-[13px] tabular-nums w-[4.5rem] shrink-0 text-drift">
                            {entry.min}+
                          </span>
                          <span className={`text-[15px] flex-1 min-w-0 ${band.min === entry.min ? 'text-foam' : 'text-drift/70'}`}>
                            {entry.verdict}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>

                  <div className="flex flex-col gap-3">
                    <Link className="btn-descend" to={`/butter/${pack.slug}?game=${deck.game + 1}`}>
                      {pack.ui.next}
                    </Link>
                    <Link className="btn-quiet" to="/butter/packs">
                      {pack.pickerLabel}
                    </Link>
                    {savedRun && savedRun.results.length === ROUNDS && (
                      <div className="flex flex-col gap-2">
                        <button type="button" className="btn-quiet" onClick={restart}>
                          play #{deck.game} again
                        </button>
                        <p className="font-mono-ui text-[12px] text-drift/60">
                          {pack.replayNote(
                            deck.game,
                            pack.ui.dist(savedRun.results.reduce((sum, result) => sum + result.score, 0)),
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {picker && deck && (
            <div className="pk-picker" role="dialog" aria-modal="true" aria-label={pack.pickerLabel}>
              <div className="pk-picker-panel">
                <p className="fathom">
                  <span>{pack.pickerLabel}</span>
                  <span className="fathom-depth">1 – {deck.lastGame}</span>
                </p>
                <div className="pk-picker-grid">
                  {Array.from({ length: deck.lastGame }, (_, index) => index + 1).map((number) => (
                    <button
                      key={number}
                      type="button"
                      className={`pk-picker-cell${number === deck.game ? ' here' : ''}`}
                      onClick={() => pickGame(number)}
                    >
                      {number}
                    </button>
                  ))}
                </div>
                <button type="button" className="btn-quiet" onClick={() => setPicker(false)}>
                  close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
