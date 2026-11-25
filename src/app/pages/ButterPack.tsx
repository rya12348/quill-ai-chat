import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'

import { ButterMenu } from '../components/ButterMenu'
import { bandFor, MAX_SCORE, packOf, ROUNDS, TIERS, type TierId } from '../lib/butter-packs'

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

  const points = useMemo(() => results.reduce((sum, result) => sum + result.score, 0), [results])

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
      if (receipts.length !== ROUNDS) return
      try {
        const res = await fetch(`/api/butter-packs/${pack.id}/${deck.game}/complete`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            playerId: playerId(),
            score: points,
            receipts,
            runId: runIdRef.current,
            version: deck.version,
          }),
        })
        const body = (await res.json().catch(() => null)) as { betterThan?: number } | null
        if (live && res.ok && typeof body?.betterThan === 'number') setCurve({ betterThan: body.betterThan })
      } catch {
        /* the gauge still reads without the crowd */
      }
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

  return (
    <div className="dive-page butter-dive relative min-h-0 flex-1 overflow-hidden" data-phase={phase}>
      <div
        className="ds-root pk-root"
        data-world={pack.world}
        data-phase={phase === 'error' || phase === 'loading' ? 'intro' : phase}
      >
        <div className="ds-stage" ref={stageRef}>
          <div
            className={`pk-scene${phase === 'intro' || phase === 'loading' || phase === 'error' ? '' : ' pk-dim'}`}
            style={{ backgroundImage: `url(${pack.scene ?? pack.art})` }}
            aria-hidden
          />
          <div className="pk-shade" aria-hidden />

          <div className="ds-world">
            {(phase === 'intro' || phase === 'loading' || phase === 'error') && (
              <div className="ds-surface pk-surface">
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

            {(phase === 'preview' || phase === 'answering') && prompt && (
              <div className="pk-center">
                <div className="ds-card ds-px" style={{ animationDelay: '0.45s' }}>
                  <div className="rnd">
                    {pack.promptWord} {round + 1} OF {ROUNDS}
                  </div>
                  <div className="prompt">{prompt.text}</div>
                  <div className="hint">{pack.hint}</div>
                </div>
              </div>
            )}

            {phase === 'feedback' && last && (
              <div className="pk-center">
                <div
                  className={`ds-landed${last.tier ? '' : ' miss'}`}
                  style={{ ['--tc' as string]: last.tier ? `var(--tier-${last.tier})` : 'var(--tier-miss)' }}
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
              </div>
            )}
          </div>

          <div className="ds-dim" />
          <div className="ds-vignette" />
          <div className="ds-edge" />

          <div className="ds-hud">
            <div className="ds-pod ds-px">
              <div className="label">{pack.promptWord}</div>
              <div className="ds-depth-num">
                {Math.min(round + (phase === 'done' ? 0 : 1), ROUNDS)}/{ROUNDS}
              </div>
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
