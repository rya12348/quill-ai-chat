import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'

/**
 * One seven-round run: a game from one of the packs, or a day out of the
 * archive. Krillion plays both the same way — a card, a three-second look, 25
 * seconds to name something on it, a verdict from the card's own rarity table —
 * so one runner serves all six of their surfaces.
 *
 * The verdicts, units and bands come from the server, which carries the pack
 * copy read out of their client. Nothing here keeps a receipt or talks to their
 * servers: the cards are Ink's own, graded on Ink's own table.
 */

type Band = { min: number; tier: string; verdict: string; range: string }
type Prompt = { id: string; text: string }
type PackInfo = {
  id: string
  name: string
  tagline: string
  badge: string
  diveLabel: string
  unit: string
  accent: string
}
type Load = {
  pack?: PackInfo
  game?: number
  date?: string
  dayNumber?: number
  prompts: Prompt[]
  bands?: Band[]
  maxScore?: number
}
type Result = { round: string; text: string; answer: string; tier: string | null; score: number; quip?: string }
type RevealRound = { id: string; text: string; answers: { answer: string; tier: string; score: number }[] }

type Phase = 'intro' | 'preview' | 'answer' | 'feedback' | 'done'

const PREVIEW_MS = 3000
const ANSWER_MS = 25_000
const GAMES_PER_PACK = 30
const MAX_SCORE = 700
const PROGRESS_KEY = 'butter.packs.v1'
const ARCHIVE_KEY = 'butter.archive.v1'

const TIER_META: Record<string, { name: string; color: string; emoji: string }> = {
  plankton: { name: 'Margarine', color: '#8fa3c4', emoji: '🧈' },
  tooclever: { name: 'Whipped', color: '#ff9f43', emoji: '🌀' },
  schooler: { name: 'Salted', color: '#4de3ff', emoji: '🧂' },
  rare: { name: 'Cultured', color: '#ff5252', emoji: '🥛' },
  deepcut: { name: 'Brown Butter', color: '#9d7bff', emoji: '🥜' },
  krillion: { name: 'One in a Butter Churn', color: '#ffd166', emoji: '✨' },
}

const DEFAULT_BANDS: Band[] = [
  { min: 0, tier: 'plankton', verdict: 'The surface took you back. The water is still there.', range: '0–149' },
  { min: 150, tier: 'schooler', verdict: 'A steady descent. The light holds.', range: '150–249' },
  { min: 250, tier: 'rare', verdict: 'Past the shelf. The pressure is doing the work now.', range: '250–349' },
  { min: 350, tier: 'deepcut', verdict: 'Deep water, no line. Only the rare answers go this far.', range: '350–449' },
  { min: 450, tier: 'krillion', verdict: 'One in a krillion. The trench floor has your name on it.', range: '450–700' },
]

/** What one point is worth in the pack's own unit, as their result screens print it. */
function distanceFor(packId: string | undefined, score: number): string {
  switch (packId) {
    case 'movies':
      return `${(score / 10).toLocaleString('en-US')} blocks`
    case 'sports':
      return `${(10 * score).toLocaleString('en-US')} yds`
    case 'geography':
      return `${Math.round(3.6 * score)}°`
    case 'lexicon':
      return `${(10 * score).toLocaleString('en-US')} wds`
    case 'classic':
      return `-${(10 * score).toLocaleString('en-US')}m`
    default:
      return ''
  }
}

function bandFor(bands: Band[], score: number): Band {
  let found = bands[0]
  for (const band of bands) if (score >= band.min) found = band
  return found
}

function readStore<T extends object>(key: string): T {
  try {
    const raw = JSON.parse(localStorage.getItem(key) ?? 'null')
    return raw && typeof raw === 'object' ? (raw as T) : ({} as T)
  } catch {
    return {} as T
  }
}

export function ButterRun() {
  const { pack = '', date = '' } = useParams()
  const [params] = useSearchParams()
  const isArchive = Boolean(date)
  const game = Math.min(GAMES_PER_PACK, Math.max(1, Number(params.get('game') ?? 1) || 1))

  const base = isArchive
    ? `/api/butter-modes/archive/${encodeURIComponent(date)}`
    : `/api/butter-modes/packs/${encodeURIComponent(pack)}/${game}`
  const revealUrl = `${base}/reveal`
  const submitUrl = `${base}/submit`

  const [load, setLoad] = useState<Load | null>(null)
  const [error, setError] = useState('')
  const [phase, setPhase] = useState<Phase>('intro')
  const [index, setIndex] = useState(0)
  const [results, setResults] = useState<Result[]>([])
  const [draft, setDraft] = useState('')
  const [note, setNote] = useState('')
  const [tone, setTone] = useState<'plain' | 'bad' | 'good'>('plain')
  const [busy, setBusy] = useState(false)
  const [deadline, setDeadline] = useState(0)
  const [left, setLeft] = useState(ANSWER_MS / 1000)
  const [reveal, setReveal] = useState<RevealRound[] | null>(null)
  const [revealOpen, setRevealOpen] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let alive = true
    setLoad(null)
    setPhase('intro')
    setIndex(0)
    setResults([])
    setDraft('')
    setNote('')
    setReveal(null)
    setRevealOpen(false)
    setError('')
    fetch(base, { cache: 'no-store' })
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as Load & { error?: string }
        if (!res.ok) throw new Error(body.error ?? 'This dive did not surface.')
        return body
      })
      .then((body) => {
        if (alive) setLoad(body)
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : 'This dive did not surface.')
      })
    return () => {
      alive = false
    }
  }, [base])

  const prompts = load?.prompts ?? []
  const bands = load?.bands?.length ? load.bands : DEFAULT_BANDS
  const total = useMemo(() => results.reduce((sum, result) => sum + result.score, 0), [results])
  const current = prompts[index]

  const record = useCallback(
    (result: Result) => {
      setResults((prev) => [...prev, result])
      setPhase('feedback')
      setNote('')
      setTone('plain')
    },
    [],
  )

  // A three-second look at the card, then the clock.
  useEffect(() => {
    if (phase !== 'preview') return
    const timer = window.setTimeout(() => {
      setDeadline(Date.now() + ANSWER_MS)
      setLeft(ANSWER_MS / 1000)
      setPhase('answer')
    }, PREVIEW_MS)
    return () => window.clearTimeout(timer)
  }, [phase, index])

  useEffect(() => {
    if (phase === 'answer') input.current?.focus()
  }, [phase, index])

  // The answer clock. Running out spends the round, exactly as it does there.
  useEffect(() => {
    if (phase !== 'answer') return
    const tick = window.setInterval(() => {
      const remaining = Math.max(0, deadline - Date.now())
      setLeft(Math.ceil(remaining / 1000))
      if (remaining <= 0) {
        window.clearInterval(tick)
        record({ round: current?.id ?? '', text: current?.text ?? '', answer: '', tier: null, score: 0 })
      }
    }, 200)
    return () => window.clearInterval(tick)
  }, [phase, deadline, current, record])

  const submit = async () => {
    const text = draft.trim()
    if (!text || busy || phase !== 'answer' || !current) return
    setBusy(true)
    setNote('')
    setTone('plain')
    try {
      const res = await fetch(submitUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ round: current.id, answer: text }),
      })
      const out = (await res.json().catch(() => ({}))) as {
        accepted?: boolean
        answer?: string
        tier?: string
        score?: number
        quip?: string
        correction?: string
        rejectionReason?: string
        error?: string
      }
      if (!res.ok) {
        setNote(out.error ?? 'signal lost. resend')
        setTone('bad')
        return
      }
      if (out.correction) {
        setDraft(out.correction)
        setNote(`→ ${out.correction}`)
        setTone('plain')
        input.current?.focus()
        return
      }
      if (out.accepted && out.tier) {
        record({
          round: current.id,
          text: current.text,
          answer: out.answer ?? text,
          tier: out.tier,
          score: out.score ?? 0,
          quip: out.quip,
        })
        setDraft('')
        return
      }
      setNote(out.rejectionReason ? `${out.rejectionReason} Try again.` : 'no echo. try again')
      setTone('bad')
      setDraft('')
      input.current?.focus()
    } catch {
      setNote('signal lost. resend')
      setTone('bad')
    } finally {
      setBusy(false)
    }
  }

  const next = () => {
    if (index + 1 < prompts.length) {
      setIndex(index + 1)
      setDraft('')
      setNote('')
      setPhase('preview')
      return
    }
    setPhase('done')
  }

  // A finished run is remembered against its pack (or its day) so the shelf can
  // show how many have surfaced and what the best one scored.
  useEffect(() => {
    if (phase !== 'done') return
    const score = results.reduce((sum, result) => sum + result.score, 0)
    if (isArchive) {
      const store = readStore<Record<string, number>>(ARCHIVE_KEY)
      const best = Math.max(score, store[date] ?? 0)
      localStorage.setItem(ARCHIVE_KEY, JSON.stringify({ ...store, [date]: best }))
      return
    }
    const store = readStore<Record<string, { done: number[]; best: number }>>(PROGRESS_KEY)
    const entry = store[pack] ?? { done: [], best: 0 }
    const done = entry.done.includes(game) ? entry.done : [...entry.done, game]
    localStorage.setItem(PROGRESS_KEY, JSON.stringify({ ...store, [pack]: { done, best: Math.max(entry.best, score) } }))
  }, [phase, results, isArchive, date, pack, game])

  const openCatch = async () => {
    if (revealOpen) {
      setRevealOpen(false)
      return
    }
    setRevealOpen(true)
    if (reveal) return
    try {
      const res = await fetch(revealUrl, { cache: 'no-store' })
      const body = (await res.json().catch(() => ({}))) as { rounds?: RevealRound[] }
      setReveal(Array.isArray(body.rounds) ? body.rounds : [])
    } catch {
      setReveal([])
    }
  }

  const packInfo = load?.pack
  const accent = packInfo?.accent ?? '#4de3ff'
  const shellStyle = { '--pm-accent': accent } as CSSProperties
  const label = isArchive ? 'The archive' : packInfo?.name ?? 'The packs'
  const lastResult = results[results.length - 1]
  const done = phase === 'done'
  const band = bandFor(bands, total)

  return (
    <div className="pm-shell" style={shellStyle}>
      <div className="pm-top">
        <span className="pm-brand">{isArchive ? `ARCHIVE ⟲ DAY #${load?.dayNumber ?? '—'}` : 'KRILLION · INK'}</span>
        <nav className="pm-links">
          <Link to="/butter">TODAY’S DIVE</Link>
          <Link to="/butter/packs">THE PACKS</Link>
          <Link to="/butter/archive">ARCHIVE ⟲</Link>
          <Link to="/butter/party">PUFFER PARTY</Link>
        </nav>
      </div>

      <div className="pm-run">
        {error && <p className="pm-error">{error}</p>}

        {!error && !load && <p className="pm-sub">sounding the depths…</p>}

        {load && phase === 'intro' && (
          <header className="pm-head">
            <span className="pm-badge">{packInfo?.badge ?? '⟲'}</span>
            <h1 className="pm-title">{label}</h1>
            <p className="pm-sub">
              {isArchive ? (
                <>
                  {load.date} · seven cards, exactly the seven that day was dealt. Same 25 seconds a card, same
                  rarity table.
                </>
              ) : (
                <>
                  {packInfo?.tagline ?? 'seven rounds, one deck'} · {packInfo?.diveLabel ?? 'game'} {game} of 30.
                </>
              )}
            </p>
            <p className="pm-round" style={{ marginTop: 18 }}>
              7 ROUNDS · 25S A CARD · MAX {MAX_SCORE}
            </p>
            <div className="pm-actions">
              <button className="pm-btn" type="button" onClick={() => setPhase('preview')}>
                ▼ Begin descent ▼
              </button>
            </div>
          </header>
        )}

        {load && (phase === 'preview' || phase === 'answer') && current && (
          <div>
            <div className="pm-progress">
              {prompts.map((prompt, at) => (
                <span key={prompt.id} className={`pm-pip${at <= index ? ' on' : ''}`} />
              ))}
            </div>
            <div className="pm-round">
              {isArchive ? `DAY #${load.dayNumber}` : `${packInfo?.diveLabel ?? 'game'} ${game} OF 30`} · ROUND {index + 1} OF{' '}
              {prompts.length}
            </div>
            <h2 className="pm-prompt">{current.text}</h2>

            {phase === 'preview' ? (
              <p className="pm-hint">look at the card · the clock starts in three…</p>
            ) : (
              <>
                <div className="pm-timer">
                  <span style={{ width: `${Math.max(0, Math.min(100, (left * 1000 * 100) / ANSWER_MS))}%` }} />
                </div>
                <div className="pm-clock">{left}s</div>
                <form
                  className="pm-answer"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void submit()
                  }}
                >
                  <input
                    ref={input}
                    className="pm-input"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="name one…"
                    maxLength={256}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button className="pm-btn" type="submit" disabled={busy || !draft.trim()}>
                    {busy ? '…' : 'DIVE'}
                  </button>
                </form>
                <p className={`pm-hint${tone === 'bad' ? ' bad' : tone === 'good' ? ' good' : ''}`}>{note}</p>
              </>
            )}
          </div>
        )}

        {load && phase === 'feedback' && lastResult && (
          <div className="pm-feedback">
            <div className="pm-round">ROUND {index + 1} OF {prompts.length}</div>
            <p className="pm-prompt" style={{ fontSize: 20 }}>
              {lastResult.text}
            </p>
            {lastResult.tier ? (
              <p>
                <span className="pm-tier" style={{ color: TIER_META[lastResult.tier]?.color ?? '#4de3ff' }}>
                  {TIER_META[lastResult.tier]?.emoji} {lastResult.answer} · {TIER_META[lastResult.tier]?.name ?? lastResult.tier}
                </span>
                <span className="pm-points" style={{ color: TIER_META[lastResult.tier]?.color ?? '#4de3ff' }}>
                  +{lastResult.score}
                </span>
              </p>
            ) : (
              <p>
                <span className="pm-tier" style={{ color: '#6d8db3' }}>
                  no echo — nothing on the card
                </span>
                <span className="pm-points" style={{ color: '#6d8db3' }}>
                  +0
                </span>
              </p>
            )}
            {lastResult.quip && <p className="pm-quip">{lastResult.quip}</p>}
            <div className="pm-actions">
              <button className="pm-btn" type="button" onClick={next}>
                {index + 1 < prompts.length ? 'NEXT CARD →' : 'SURFACE ▲'}
              </button>
              <span className="pm-clock" style={{ alignSelf: 'center' }}>
                {total} / {MAX_SCORE}
              </span>
            </div>
          </div>
        )}

        {done && (
          <div>
            <div className="pm-round">
              {isArchive ? `⟲ DAY #${load?.dayNumber} RESURFACED` : `∞ ${packInfo?.diveLabel ?? 'game'} ${game} COMPLETE`}
            </div>
            <div>
              <span className="pm-score">{total}</span>
              <span className="pm-score">
                <small>/{load?.maxScore ?? MAX_SCORE}</small>
              </span>
              {distanceFor(packInfo?.id, total) && <span className="pm-dist">{distanceFor(packInfo?.id, total)}</span>}
            </div>
            <p className="pm-verdict">{band.verdict}</p>

            <div className="pm-bands">
              {bands.map((entry) => (
                <div key={entry.min} className={`pm-band${entry.min === band.min ? ' on' : ''}`}>
                  <span style={{ color: TIER_META[entry.tier]?.color ?? '#6d8db3' }}>{entry.range}</span>
                  <span>{entry.verdict}</span>
                </div>
              ))}
            </div>

            <div className="pm-catch">
              <button className="pm-catch-head" type="button" onClick={() => void openCatch()}>
                <span>the catch · every card, every answer</span>
                <span>{revealOpen ? '▲ HIDE' : '▼ OPEN'}</span>
              </button>
              {revealOpen && (
                <div className="pm-catch-body">
                  {reveal === null && <span className="pm-sub">sounding the depths…</span>}
                  {reveal?.map((round) => (
                    <div key={round.id}>
                      <p className="pm-catch-round">{round.text}</p>
                      <div className="pm-answers">
                        {round.answers.map((entry) => (
                          <span
                            key={entry.answer}
                            className="pm-answer-pill"
                            style={{ color: TIER_META[entry.tier]?.color ?? '#8fb0d6' }}
                          >
                            {entry.answer}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                  {reveal?.length === 0 && <span className="pm-sub">the sheet is empty.</span>}
                </div>
              )}
            </div>

            <div className="pm-actions">
              {!isArchive && (
                <Link className="pm-btn" to={`/butter/unlimited/${pack}?game=${game < GAMES_PER_PACK ? game + 1 : 1}`}>
                  NEXT {packInfo?.diveLabel?.toUpperCase() ?? 'GAME'} →
                </Link>
              )}
              <button
                className="pm-btn ghost"
                type="button"
                onClick={() => {
                  setResults([])
                  setIndex(0)
                  setDraft('')
                  setNote('')
                  setPhase('intro')
                }}
              >
                PLAY IT AGAIN
              </button>
              <Link className="pm-btn ghost" to={isArchive ? '/butter/archive' : '/butter/packs'}>
                {isArchive ? 'BACK TO THE ARCHIVE' : 'BACK TO THE PACKS'}
              </Link>
            </div>
            <p className="pm-quip" style={{ marginTop: 16 }}>
              scored against the card, not against anyone else’s run.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
