import { useEffect, useMemo } from 'react'
import { Link } from 'react-router'

import { ButterMenu } from '../components/ButterMenu'
import { PACKS } from '../lib/butter-packs'

/**
 * The logbook — `/archive` in the real game.
 *
 * Krillion's archive is the one thing on the site behind its $5 unlock: every
 * `/api/archive/<day>` answers `402 locked`, and an old day's answer sheet
 * answers `403`, so there is no archived card to deal here and none is invented
 * in its place. What Butter can show is what this browser actually played: each
 * finished daily dive and each finished pack run, read back out of the same keys
 * the two games write.
 */

type Row = { key: string; title: string; note: string; score: number; to: string }

function playedRows(): Row[] {
  const rows: Row[] = []
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (!key) continue
      if (key.startsWith('butter.dive.done.')) {
        const date = key.slice('butter.dive.done.'.length)
        const raw = localStorage.getItem(key)
        const results = raw ? ((JSON.parse(raw) as { results?: { score?: number }[] }).results ?? []) : []
        if (!results.length) continue
        rows.push({
          key,
          title: `daily dive · ${date}`,
          note: `${results.length} prompts`,
          score: results.reduce((sum, result) => sum + (result.score ?? 0), 0),
          to: '/butter',
        })
        continue
      }
      if (key.startsWith('butter.pack.')) {
        const [, , packId, game] = key.split('.')
        const pack = PACKS.find((entry) => entry.id === packId)
        if (!pack || !game) continue
        const raw = localStorage.getItem(key)
        const results = raw ? ((JSON.parse(raw) as { results?: { score?: number }[] }).results ?? []) : []
        if (results.length !== 7) continue
        const total = results.reduce((sum, result) => sum + (result.score ?? 0), 0)
        rows.push({
          key,
          title: `${pack.diveLabel} #${game} · ${pack.name.toLowerCase()}`,
          note: pack.ui.dist(total),
          score: total,
          to: `/butter/${pack.slug}?game=${game}`,
        })
      }
    }
  } catch {
    /* a locked-down browser just shows an empty logbook */
  }
  return rows.sort((a, b) => b.score - a.score)
}

export function ButterArchive() {
  useEffect(() => {
    const previous = document.title
    document.title = 'Archive · Butter'
    return () => {
      document.title = previous
    }
  }, [])

  const rows = useMemo(() => playedRows(), [])

  return (
    <div className="dive-page relative min-h-0 flex-1 overflow-y-auto">
      <main className="hub-root">
        <div className="hub-crt" aria-hidden />
        <ButterMenu className="hub-menu" />
        <div className="hub-inner">
          <header>
            <p className="hub-wordmark font-display">BUTTER</p>
            <p className="hub-sub">archive · every dive and every pack</p>
          </header>

          <section className="hub-panel">
            <p className="fathom mb-1">
              <span>the logbook</span>
              <span className="fathom-depth">{rows.length} played here</span>
            </p>
            {rows.length === 0 ? (
              <p className="font-mono-ui text-[13px] text-drift/70 py-2">
                Nothing surfaced yet. Finish today&apos;s dive, or a pack, and it lands here.
              </p>
            ) : (
              <div className="book-list">
                {rows.map((row) => (
                  <Link className="book-row" key={row.key} to={row.to}>
                    <strong>{row.title}</strong>
                    <em>{row.note}</em>
                    <b>{row.score}</b>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="hub-panel">
            <p className="fathom mb-1">
              <span>unlimited</span>
              <span className="fathom-depth">dive after dive</span>
            </p>
            <div className="flex items-center justify-between gap-3 pt-1">
              <p className="font-mono-ui text-[12px] text-drift/70 max-w-[26ch]">
                The endless dive keeps dealing. Every run is its own card.
              </p>
              <Link className="btn-quiet whitespace-nowrap" to="/butter/endless">
                Endless ∞
              </Link>
            </div>
          </section>

          <div className="flex justify-center">
            <Link className="hub-back" to="/butter/packs">
              ← themed packs
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
