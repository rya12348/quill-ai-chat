import { useEffect, type CSSProperties } from 'react'
import { Link } from 'react-router'

import { ButterMenu } from '../components/ButterMenu'
import { PACKS } from '../lib/butter-packs'

/**
 * The themed packs hub — `/packs` in the real game.
 *
 * The markup is the shipped page's: the same `.hub-*` shell and `.pack-card`
 * cards, the free banner over Words & Language, the "NOW SHOWING / GAME ON /
 * PASSPORT READY" chip on each art, the closing MUSIC card and the logbook
 * panel. `dive.css` is the real stylesheet, so the cards are the shipped
 * geometry rather than a lookalike.
 */

const HUB = PACKS.filter((pack) => pack.id !== 'classic')

export function ButterPacks() {
  useEffect(() => {
    const previous = document.title
    document.title = 'Themed packs · Butter'
    return () => {
      document.title = previous
    }
  }, [])

  return (
    <div className="dive-page relative min-h-0 flex-1 overflow-y-auto">
      <main className="hub-root">
        <div className="hub-crt" aria-hidden />
        <ButterMenu className="hub-menu" />
        <div className="hub-inner">
          <header>
            <p className="hub-wordmark font-display">BUTTER</p>
            <p className="hub-sub">themed packs · beyond the daily dive</p>
          </header>

          <div className="flex flex-col gap-6">
            {HUB.map((pack) => (
              <Link
                key={pack.id}
                className={`pack-card${pack.id === 'lexicon' ? ' pack-card--free' : ''}`}
                style={
                  {
                    '--pc': pack.accent,
                    '--pc-ring': pack.ring,
                    '--pc-panel': pack.panel,
                  } as CSSProperties
                }
                to={`/butter/${pack.slug}`}
              >
                {pack.id === 'lexicon' && (
                  <div className="pack-free-banner">
                    <strong>Free for now · BETA</strong>
                    <span>Answers &amp; scoring may have issues</span>
                  </div>
                )}
                <div className="pack-art">
                  <img alt="" loading="lazy" decoding="async" className="pack-art-image" src={pack.art} />
                  {pack.id !== 'lexicon' && <span className="pack-chip">{pack.hubOpen}</span>}
                </div>
                <div className="pack-body">
                  <div className="pack-name font-display">{pack.name}</div>
                  <p className="pack-tagline">{pack.hubTagline}</p>
                  <div className="pack-foot" style={{ justifyContent: 'flex-end' }}>
                    <span className="pack-go">{pack.hubCta}</span>
                  </div>
                </div>
              </Link>
            ))}

            <div className="pack-card opacity-55" aria-disabled="true" style={{ pointerEvents: 'none' } as CSSProperties}>
              <div className="pack-art">
                <div
                  className="pack-art-image"
                  aria-hidden
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 64,
                    color: '#c77dff',
                    background: 'linear-gradient(160deg, #1b1030, #0d1626)',
                  }}
                >
                  ♪
                </div>
                <span className="pack-chip" style={{ '--pc': '#c77dff' } as CSSProperties}>
                  COMING SOON
                </span>
              </div>
              <div className="pack-body">
                <div className="pack-name font-display">MUSIC</div>
                <p className="pack-tagline">from the charts to the deep cuts</p>
              </div>
            </div>

            <p className="hub-charting">more packs are being charted…</p>
          </div>

          <section className="hub-panel">
            <p className="fathom mb-1">
              <span>the logbook</span>
              <span className="fathom-depth">your unlocks, kept</span>
            </p>
            <div className="flex items-center justify-between gap-3 pt-1 pb-3">
              <p className="font-mono-ui text-[12px] text-drift/70 max-w-[26ch]">
                Every aired daily, resurfaceable.
              </p>
              <Link className="btn-quiet whitespace-nowrap" to="/butter/archive">
                Archive ⟲
              </Link>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-[var(--hairline)] pt-3">
              <p className="font-mono-ui text-[12px] text-drift/70 max-w-[26ch]">
                Dive after dive, every prompt.
              </p>
              <Link className="btn-quiet whitespace-nowrap" to="/butter/endless">
                Unlimited ∞
              </Link>
            </div>
          </section>

          <div className="flex justify-center">
            <Link className="hub-back" to="/butter">
              ← today&apos;s dive
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
