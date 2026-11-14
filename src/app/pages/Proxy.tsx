import { ArrowLeft, Loader2, RefreshCw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'

import type { ProxySession } from '../../shared/types'
import { Button } from '../components/ui'
import { ApiError, createProxySession } from '../lib/api'
import { isolatedLiveUrl, isIsolatedLiveUrl } from '../lib/live-preview'

const GOOGLE_HOME = 'https://www.google.com/'
const GOOGLE_SEARCH = 'https://www.google.com/search'

function isGoogleUrl(raw: string): boolean {
  try {
    const host = new URL(raw).hostname.replace(/^www\./i, '').toLowerCase()
    return host === 'google.com'
  } catch {
    return false
  }
}

/** Keep a Google result URL small enough for the address bar and stable. */
function normalizeTarget(raw: string): string {
  try {
    const url = new URL(raw)
    if (isGoogleUrl(raw) && url.pathname === '/search') {
      const query = (url.searchParams.get('q') ?? '').replace(/\s+/g, ' ').trim()
      if (query) {
        const next = new URL(GOOGLE_SEARCH)
        next.searchParams.set('q', query)
        next.searchParams.set('gbv', '1')
        next.searchParams.set('hl', 'en')
        next.searchParams.set('gl', 'us')
        return next.href
      }
    }
  } catch {
    /* the server validates the target */
  }
  return raw
}

function GoogleWordmark() {
  return (
    <div className="flex text-[36px] font-semibold tracking-[-0.085em]" aria-label="Google">
      <span className="text-[#4285f4]">G</span>
      <span className="text-[#ea4335]">o</span>
      <span className="text-[#fbbc05]">o</span>
      <span className="text-[#4285f4]">g</span>
      <span className="text-[#34a853]">l</span>
      <span className="text-[#ea4335]">e</span>
    </div>
  )
}

/**
 * Google is the whole surface here. The app route is still protected by the
 * Ink gate, but once open this is a full-viewport proxied Google document
 * with no app header, URL bar or other local page chrome.
 */
export function ProxyPage() {
  const [session, setSession] = useState<ProxySession | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [frameKey, setFrameKey] = useState(0)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const lastNavigation = useRef('')
  const requestRef = useRef(0)
  const initialLoad = useRef(false)

  const openGoogle = async () => {
    const request = ++requestRef.current
    setBusy(true)
    setError('')
    try {
      const { session: next } = await createProxySession(GOOGLE_HOME)
      if (request !== requestRef.current) return
      lastNavigation.current = ''
      setSession(next)
      setFrameKey((value) => value + 1)
    } catch (cause) {
      if (request !== requestRef.current) return
      setError(cause instanceof ApiError ? cause.message : 'Google could not be opened.')
    } finally {
      if (request === requestRef.current) setBusy(false)
    }
  }

  useEffect(() => {
    const previousTitle = document.title
    document.title = 'Google'
    return () => {
      document.title = previousTitle
    }
  }, [])

  useEffect(() => {
    if (initialLoad.current) return
    initialLoad.current = true
    void openGoogle()
    // Open Google exactly once even if React remounts the page during HMR.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Searches and links happen inside the proxied document. Keep the iframe
  // sandboxed, but swap its capability URL when it navigates.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow) return
      const data = event.data as { type?: unknown; url?: unknown } | null
      if (!data || data.type !== 'stet:preview-navigate' || typeof data.url !== 'string') return
      const frame = frameRef.current
      if (!frame) return
      let next: URL
      let current: URL
      try {
        next = new URL(data.url)
        current = new URL(frame.src, window.location.href)
      } catch {
        return
      }
      if (next.origin !== current.origin || !next.pathname.startsWith('/api/web-proxy/')) return
      const rawTarget = next.searchParams.get('url')
      if (!rawTarget) return
      const target = normalizeTarget(rawTarget)
      let title: string
      try {
        const parsed = new URL(target)
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return
        title = parsed.hostname.replace(/^www\./, '')
      } catch {
        return
      }
      const params = new URLSearchParams({ url: target })
      const proxyPath = `${next.pathname}?${params}`
      // A broken target page can post repeated navigations. Treat the same
      // destination as a single change instead of reloading the frame forever.
      if (lastNavigation.current === proxyPath) return
      lastNavigation.current = proxyPath
      setSession((value) =>
        value
          ? {
              ...value,
              url: target,
              title,
              proxyPath,
            }
          : value,
      )
      setError('')
      setFrameKey((value) => value + 1)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  const frameSrc = session ? isolatedLiveUrl(session.proxyPath) : ''
  const sandbox = isIsolatedLiveUrl(frameSrc)
    ? 'allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-popups allow-modals allow-downloads'
    : 'allow-scripts allow-forms allow-pointer-lock allow-popups allow-modals allow-downloads'

  return (
    <main className="fixed inset-0 z-50 flex overflow-hidden bg-white" aria-label="Google">
      <Link
        to="/"
        className="absolute left-3 top-3 z-10 inline-flex h-8 items-center gap-1.5 rounded-control border border-line bg-bg/90 px-2.5 text-[12px] font-medium text-fg shadow-card backdrop-blur transition-colors hover:bg-bg"
        aria-label="Close Google"
        title="Back to Ink"
      >
        <ArrowLeft className="size-3.5" />
        Ink
      </Link>
      {session ? (
        <iframe
          key={frameKey}
          ref={frameRef}
          src={frameSrc}
          title={session.title || 'Google'}
          sandbox={sandbox}
          allow="fullscreen; pointer-lock"
          className="h-full w-full border-0 bg-white"
          referrerPolicy="no-referrer"
          tabIndex={0}
          onLoad={() => {
            const frame = frameRef.current
            if (!frame) return
            frame.focus()
            frame.contentWindow?.postMessage({ type: 'stet:focus-search' }, '*')
          }}
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-bg px-6 text-center">
          <GoogleWordmark />
          <p className="max-w-[420px] text-[13px] leading-relaxed text-muted">
            {error || 'Opening Google…'}
          </p>
          {error && (
            <p className="max-w-[420px] text-[11.5px] leading-relaxed text-faint">
              If Securly shows its own block page instead of this message, it blocked the page before Ink could see the request. When Ink can see the block, the HTTP status and target reason are shown above.
            </p>
          )}
          {!error && <Loader2 className="size-5 animate-spin text-faint" />}
          {error && (
            <Button type="button" variant="secondary" onClick={() => void openGoogle()} loading={busy}>
              <RefreshCw />
              Try again
            </Button>
          )}
        </div>
      )}
      {busy && session && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-white/55 backdrop-blur-[1px]">
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-bg px-3 py-2 text-[12px] text-muted shadow-card">
            <Loader2 className="size-4 animate-spin" />
            Opening Google…
          </span>
        </div>
      )}
    </main>
  )
}
