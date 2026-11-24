import { useEffect, useState, type CSSProperties } from 'react'
import { Link } from 'react-router'

/**
 * The rack of packs, and the archive of days.
 *
 * Krillion ships five packs of thirty seven-round games (`/packs`, then
 * `/unlimited/classic`, `/movies`, `/sports`, `/geography`, `/lexicon`) and an
 * archive of dives that have already surfaced. This is Ink's copy of that front
 * shelf; the games themselves run at `/butter/unlimited/:pack`.
 */

type Band = { min: number; tier: string; verdict: string; range: string }
type PackRow = {
  id: string
  name: string
  tagline: string
  badge: string
  diveLabel: string
  unit: string
  paid: boolean
  accent: string
  bands: Band[]
}
type DayRow = { date: string; dayNumber: number; prompts: string[] }
type Progress = Record<string, { done: number[]; best: number }>

const PROGRESS_KEY = 'butter.packs.v1'
const ARCHIVE_KEY = 'butter.archive.v1'

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = JSON.parse(localStorage.getItem(key) ?? 'null')
    return raw && typeof raw === 'object' ? (raw as T) : fallback
  } catch {
    return fallback
  }
}

/** The first game of a pack that has not been played yet. */
function nextGame(done: number[]): number {
  for (let game = 1; game <= 30; game += 1) {
    if (!done.includes(game)) return game
  }
  return 1
}

export function ButterPacks({ view }: { view: 'packs' | 'archive' }) {
  const [packs, setPacks] = useState<PackRow[]>([])
  const [days, setDays] = useState<DayRow[]>([])
  const [error, setError] = useState('')
  const [progress] = useState<Progress>(() => readJson<Progress>(PROGRESS_KEY, {}))
  const [archiveScores] = useState<Record<string, number>>(() => readJson<Record<string, number>>(ARCHIVE_KEY, {}))

  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const [packsRes, archiveRes] = await Promise.all([
          fetch('/api/butter-modes/packs', { cache: 'no-store' }),
          fetch('/api/butter-modes/archive?days=21', { cache: 'no-store' }),
        ])
        if (!packsRes.ok) throw new Error('The packs did not surface.')
        const packsBody = (await packsRes.json()) as { packs?: PackRow[] }
        const archiveBody = archiveRes.ok ? ((await archiveRes.json()) as { days?: DayRow[] }) : { days: [] }
        if (!alive) return
        setPacks(Array.isArray(packsBody.packs) ? packsBody.packs : [])
        setDays(Array.isArray(archiveBody.days) ? archiveBody.days : [])
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : 'The packs did not surface.')
      }
    }
    void load()
    return () => {
      alive = false
    }
  }, [])

  return (
    <div className="pm-shell">
      <div className="pm-top">
        <span className="pm-brand">KRILLION · INK</span>
        <nav className="pm-links">
          <Link to="/butter">TODAY’S DIVE</Link>
          <Link to="/butter/packs">THE PACKS</Link>
          <Link to="/butter/archive">ARCHIVE ⟲</Link>
          <Link to="/butter/party">PUFFER PARTY</Link>
        </nav>
      </div>

      {view === 'packs' ? (
        <>
          <header className="pm-head">
            <h1 className="pm-title">The packs</h1>
            <p className="pm-sub">
              Five decks, thirty {`games`} each, seven rounds a game. Every card is graded the same way the
              daily dive is: the rarer the answer, the deeper it goes.
            </p>
          </header>

          {error && <p className="pm-error">{error}</p>}

          <div className="pm-grid">
            {packs.map((pack) => {
              const done = progress[pack.id]?.done ?? []
              return (
                <Link
                  key={pack.id}
                  className="pm-card"
                  to={`/butter/unlimited/${pack.id}?game=${nextGame(done)}`}
                  style={{ '--pm-accent': pack.accent } as CSSProperties}
                >
                  <span className="pm-badge">{pack.badge}</span>
                  <h2 className="pm-name">{pack.name}</h2>
                  <p className="pm-tagline">{pack.tagline}</p>
                  <div className="pm-meta">
                    <span>30 {pack.diveLabel}s</span>
                    <span>{done.length ? `${done.length} surfaced` : 'unopened'}</span>
                  </div>
                  <span className="pm-cta">PLAY →</span>
                </Link>
              )
            })}
          </div>
        </>
      ) : (
        <>
          <header className="pm-head">
            <h1 className="pm-title">The archive</h1>
            <p className="pm-sub">
              Days that have already surfaced. A day replays the same seven cards it was dealt, and the score
              is scored against those cards — not today’s.
            </p>
          </header>

          {error && <p className="pm-error">{error}</p>}

          <div className="pm-archive-list">
            {days.map((day) => (
              <Link key={day.date} className="pm-day" to={`/butter/archive/${day.date}`}>
                <span className="pm-day-num">⟲ Day #{day.dayNumber}</span>
                <span className="pm-day-prompts">{day.prompts.join(' · ')}</span>
                <span className="pm-day-score">
                  {typeof archiveScores[day.date] === 'number' ? `${archiveScores[day.date]} / 700` : '—'}
                </span>
              </Link>
            ))}
            {days.length === 0 && <div className="pm-day">the archive is still filling…</div>}
          </div>
        </>
      )}
    </div>
  )
}
