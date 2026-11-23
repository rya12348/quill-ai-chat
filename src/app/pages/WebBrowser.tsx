import { Loader2, RotateCw } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router'

import { siteUrlFromCode } from '../../shared/sites'

/**
 * The site this tab should open.
 *
 * A tile links to `/proxy?s=<handle>`, which keeps the site's domain out of
 * Ink's URL and history. `?url=` and `/proxy/<encoded>` are still read so a
 * link saved by an older build still opens its site instead of Google.
 */
function targetFromLocation(): string {
  const params = new URLSearchParams(window.location.search)
  const handle = params.get('s')
  if (handle) {
    const known = siteUrlFromCode(handle)
    const fromHandle = known ? normalize(known) : null
    if (fromHandle) return fromHandle
  }
  const named = params.get('url')
  if (named) {
    const fromQuery = normalize(named)
    if (fromQuery) return fromQuery
  }
  const marker = '/proxy/'
  const path = window.location.pathname
  if (path.startsWith(marker)) {
    try {
      const fromPath = normalize(decodeURIComponent(path.slice(marker.length)))
      if (fromPath) return fromPath
    } catch {
      // A malformed path is not a site; fall through to the default.
    }
  }
  return ''
}

/**
 * A "show <site>" command hands its address over in router state, which is the
 * one place the address can travel without landing in the URL or history.
 */
function targetFromState(state: unknown): string | null {
  const target = (state as { target?: unknown } | null | undefined)?.target
  return typeof target === 'string' ? normalize(target) : null
}

/**
 * Diagnostics a proxied frame reported. The frame is a sandboxed opaque origin,
 * so this page cannot read its DOM or console; a bounded buffer of what it posts
 * is the only way to see why a page or a game stalled.
 */
type PreviewDiagnostic = { kind?: unknown; href?: unknown; detail?: unknown; at?: unknown }
const diagnostics: PreviewDiagnostic[] = []

function reportDiagnostic(message: PreviewDiagnostic): void {
  diagnostics.push(message)
  while (diagnostics.length > 20) diagnostics.shift()
  ;(window as unknown as { __inkDiag?: PreviewDiagnostic[] }).__inkDiag = diagnostics
  try {
    console.warn('[ink-diag]', String(message.kind), JSON.stringify(message.detail))
  } catch {
    // A payload that cannot be serialised is still in the buffer.
  }
}

function normalize(raw: string): string | null {
  const value = raw.trim()
  if (!value) return null
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

/**
 * Ink's browser: one proxied site served edge to edge by one proxy.
 *
 * There is no browser chrome — no address bar, no buttons. The page *is* the
 * site.
 *
 * Every site, including a shortcut opened from its tile, is opened through the
 * capability proxy at `/api/web-proxy/<token>`. That proxy keeps a cookie jar
 * and storage per session token, rewrites the document and the resources its
 * scripts build, and streams large responses, so a site's own login, menus and
 * games keep working inside a sandboxed frame. There is deliberately only this
 * one route: two engines meant a site behaved differently depending on how it
 * was opened, and the slower one silently lost cookies and large assets.
 */
export function WebBrowser() {
  // The browser opens Google unless a command or a shortcut named a site.
  const location = useLocation()
  const requested = targetFromState(location.state) || targetFromLocation() || 'https://www.google.com/'
  const label = (() => {
    try {
      return new URL(requested).hostname.replace(/^www\./, '')
    } catch {
      return 'the page'
    }
  })()

  const [frame, setFrame] = useState('')
  const [error, setError] = useState('')
  const frameRef = useRef<HTMLIFrameElement | null>(null)

  // A proxied page is sandboxed with no top navigation, so it cannot move this
  // tab itself. It asks its parent to move the frame instead; without this the
  // search results page and every link inside a site look dead.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data: unknown = event.data
      if (!data || typeof data !== 'object') return
      const message = data as { type?: unknown; url?: unknown; kind?: unknown; detail?: unknown }
      // A nested frame reports from a grandchild window, so the direct-child
      // check below cannot apply. Diagnostics carry no instruction: they are
      // recorded and shown, never acted on.
      if (message.type === 'stet:preview-diagnostic') {
        reportDiagnostic(message)
        return
      }
      if (event.source !== frameRef.current?.contentWindow) return
      if (message.type !== 'stet:preview-navigate' || typeof message.url !== 'string') return
      let next: URL
      try {
        next = new URL(message.url, window.location.origin)
      } catch {
        return
      }
      // Only a capability route may take over the frame: that keeps the session
      // token, and therefore the cookie jar, the same across the whole visit.
      if (next.origin !== window.location.origin) return
      if (!next.pathname.startsWith('/api/web-proxy/') && !next.pathname.startsWith('/api/poki-game/')) return
      setFrame(next.href)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  // The tab title is visible to a classroom filter and to browser history, so
  // it stays neutral while the page is open: the site's name is only on screen.
  useEffect(() => {
    const previousTitle = document.title
    document.title = 'Ink'
    return () => {
      document.title = previousTitle
    }
  }, [])

  const open = useCallback(async () => {
    setError('')
    setFrame('')
    try {
      const response = await fetch('/api/proxy/session', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: requested }),
      })
      const body = (await response.json().catch(() => null)) as
        | { session?: { proxyPath?: string }; message?: string }
        | null
      const path = body?.session?.proxyPath
      if (!response.ok || !path) {
        setError(body?.message || 'That page could not be opened.')
        return
      }
      setFrame(path)
    } catch {
      setError('That page could not be opened.')
    }
  }, [requested])

  useEffect(() => {
    void open()
  }, [open])

  if (error) {
    return (
      <main className="fixed inset-0 z-50 grid place-items-center bg-bg px-6 text-center" aria-label="Browser">
        <div className="flex flex-col items-center gap-4">
          <p className="max-w-[420px] text-[13px] leading-relaxed text-muted">{error}</p>
          <button
            type="button"
            onClick={() => void open()}
            className="inline-flex items-center gap-2 rounded-control border border-line px-3 py-1.5 text-[12.5px] font-medium text-fg transition-colors hover:bg-surface"
          >
            <RotateCw className="size-3.5" />
            Try again
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="fixed inset-0 z-50 bg-white" aria-label="Browser">
      {frame ? (
        <iframe
          ref={frameRef}
          src={frame}
          title="Browser"
          className="h-full w-full border-0 bg-white"
          allow="fullscreen; autoplay; clipboard-write; gamepad"
          allowFullScreen
        />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-4 bg-bg">
          <Loader2 className="size-5 animate-spin text-faint" />
          <p className="text-[13px] text-muted">Opening {label}…</p>
        </div>
      )}
    </main>
  )
}
