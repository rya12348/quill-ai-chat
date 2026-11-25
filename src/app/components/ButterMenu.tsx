import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { BookMarked, Bot, Home, Monitor, Settings } from 'lucide-react'
import { Link, useLocation } from 'react-router'

/** The menu Krillion puts behind the three bars in the game's top-left corner:
 *  a centred panel of pixel tiles over whatever is running. Butter has two
 *  pages of its own and the rest of the bookmarks land back in Ink. */

const DIVE: ReadonlyArray<{ to: string; label: string }> = [
  { to: '/butter', label: 'Daily dive' },
  { to: '/butter/endless', label: 'Unlimited' },
  { to: '/butter/party', label: 'Puffer party' },
  { to: '/butter/archive', label: 'Archive' },
  { to: '/butter/packs', label: 'Themed packs' },
]

const INK: ReadonlyArray<{ to: string; label: string; icon: typeof Home }> = [
  { to: '/library', label: 'Library', icon: BookMarked },
  { to: '/browser', label: 'Browser', icon: Monitor },
  { to: '/buffy', label: 'Buffy', icon: Bot },
]

export function ButterMenu({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)
  const location = useLocation()

  // A menu left open across a navigation would sit over the page it opened for.
  useEffect(() => setOpen(false), [location.pathname])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const here = location.pathname
  const current = (to: string) => (here === to ? 'page' : undefined)

  return (
    <>
      <button
        className={className}
        type="button"
        aria-label="Menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Menu"
        onClick={() => setOpen(true)}
      >
        <svg viewBox="0 0 20 20" fill="currentColor" shapeRendering="crispEdges" aria-hidden>
          <path d="M2 3h16v3H2zm0 6h16v3H2zm0 6h16v3H2z" />
        </svg>
      </button>

      {open &&
        createPortal(
          <div className="butter-menu" onMouseDown={() => setOpen(false)}>
          <div
            className="butter-menu-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <header>
              <div>
                <p className="butter-menu-eyebrow">Butter</p>
                <h2 className="butter-menu-title">Menu</h2>
              </div>
              <button className="butter-menu-close" type="button" aria-label="Close menu" onClick={() => setOpen(false)}>
                ×
              </button>
            </header>

            <p className="butter-menu-rule">
              <span>Dive in</span>
            </p>
            <nav className="butter-menu-nav" aria-label="Main navigation">
              {DIVE.map(({ to, label }) => (
                <Link key={to} to={to} className="butter-menu-tile" aria-current={current(to)}>
                  {to === '/butter/party' ? (
                    <span className="butter-menu-puffer" aria-hidden>
                      <img src="/gen/party/puffer-0.png" alt="" width={52} height={52} />
                    </span>
                  ) : (
                    <svg viewBox="0 0 20 20" fill="currentColor" shapeRendering="crispEdges" aria-hidden>
                      <path d="M9 2h2v10h5v2h-2v2h-2v2H8v-2H6v-2H4v-2h5z" fillRule="evenodd" />
                    </svg>
                  )}
                  <span>{label}</span>
                </Link>
              ))}
            </nav>

            <p className="butter-menu-rule">
              <span>Ink</span>
            </p>
            <nav className="butter-menu-nav" aria-label="Ink navigation">
              {INK.map(({ to, label, icon: Icon }) => (
                <Link key={to} to={to} className="butter-menu-tile" aria-current={current(to)}>
                  <Icon aria-hidden />
                  <span>{label}</span>
                </Link>
              ))}
              <Link to="/settings" className="butter-menu-tile" aria-current={current('/settings')}>
                <Settings aria-hidden />
                <span>Settings</span>
              </Link>
            </nav>

            <div className="butter-menu-links">
              <Link to="/" className="butter-menu-link">
                <Home aria-hidden />
                <span>
                  <strong>Ink</strong>
                  <em>chat, library &amp; tools</em>
                </span>
                <span className="butter-menu-go" aria-hidden>
                  ↗
                </span>
              </Link>
            </div>
          </div>
          </div>,
          document.body,
        )}
    </>
  )
}
