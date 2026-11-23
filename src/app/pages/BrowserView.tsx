import { ArrowLeft, ArrowRight, Globe, Loader2, RotateCw } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'

import { siteUrlFromCode } from '../../shared/sites'
import type { BrowserAction, BrowserSessionResponse, BrowserViewState } from '../../shared/types'
import { api, ApiError } from '../lib/api'
import { Button } from '../components/ui'

/**
 * The cloud browser on its own.
 *
 * This drives the same Steel session the AI Agent uses, with none of the agent
 * around it: an address bar, back/forward/reload, and the provider's live view
 * filling the rest of the window. Browser and Unblocker open here so those
 * entries are a browser instead of a page of task controls.
 */

const HOME = 'https://www.google.com/'

/**
 * The site a link names.
 *
 * A shortcut passes an opaque handle (`?s=…`) so its domain never appears in
 * Ink's URL or history; a plain `?url=…` is still accepted for older links and
 * for the Unblocker's typed address.
 */
function requestedSite(params: URLSearchParams): string {
  const handle = params.get('s')
  if (handle) return siteUrlFromCode(handle) ?? ''
  return params.get('url') ?? ''
}
const KEEP_ALIVE_MS = 30_000
// The provider streams a 16:9 screen. Until the page reports its own viewport
// this is the shape the viewer draws.
const DEFAULT_ASPECT = 16 / 9

type Status = 'starting' | 'ready' | 'error'

/** Add Steel's documented viewer flags without disturbing signed query data.
 * The page has its own address bar, so Steel's is switched off rather than
 * stacked above it. */
function interactiveLiveUrl(url: string): string {
  try {
    const parsed = new URL(url)
    parsed.searchParams.set('interactive', 'true')
    parsed.searchParams.set('showControls', 'false')
    return parsed.toString()
  } catch {
    return url
  }
}

/** A host opens as a site; anything else is a Google search for those words. */
function addressTarget(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return HOME
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return trimmed
  const looksLikeHost =
    /^localhost(?::\d+)?(?:[/?#]|$)/i.test(trimmed) || /^[\w-]+(?:\.[\w-]+)+(?:[/:?#]|$)/.test(trimmed)
  if (!looksLikeHost || /\s/.test(trimmed)) return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`
  return `https://${trimmed}`
}

/**
 * Size the remote Chrome to the pane it will fill.
 *
 * This used to ask for roughly a megapixel screen whatever the pane was, so a
 * narrow pane streamed ~3x the pixels it could display: the encoder spent the
 * bandwidth and the decoder rescaled every frame. The stream is the screen, so
 * asking for the visible pane is both sharper and cheaper.
 *
 * The stream is capped rather than matched exactly: encoding a 1800px-wide
 * screen costs bandwidth on every frame, and the extra pixels only survive as
 * upscaling. Reading the pane a frame later matters too — measured during the
 * first render it is still zero, which silently fell back to the provider's
 * default screen shape and left the viewer letterboxed.
 */
function viewportForPane(element: HTMLElement | null) {
  if (!element) return undefined
  const width = element.clientWidth
  const height = element.clientHeight
  if (width < 240 || height < 240) return undefined
  const aspect = width / height
  // The stream is painted into the pane's physical pixels, so a 426 CSS px
  // pane on a 1.5x screen is 639 real pixels: a 426 px stream upscaled to fill
  // them is exactly what reads as a blurry picture. Ask for the device's real
  // pixels instead, capped at 2x so a 3x phone does not triple the bandwidth.
  const dpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2)
  // Steel refuses a window narrower than 500px, so keep the pane's aspect and
  // grow both sides past that floor rather than distorting the screen.
  let remoteWidth = Math.max(500, Math.ceil((width * dpr) / 2) * 2)
  let remoteHeight = Math.round(remoteWidth / aspect)
  if (remoteWidth > MAX_REMOTE_WIDTH) {
    remoteWidth = MAX_REMOTE_WIDTH
    remoteHeight = Math.round(remoteWidth / aspect)
  }
  if (remoteHeight > MAX_REMOTE_HEIGHT) {
    remoteHeight = MAX_REMOTE_HEIGHT
    remoteWidth = Math.round(remoteHeight * aspect)
  }
  return { width: Math.round(remoteWidth / 2) * 2, height: Math.round(remoteHeight / 2) * 2 }
}

/** The stream is a video: past this size every extra pixel is bandwidth, not
 * detail, and it is what makes the viewer feel slow on an ordinary connection. */
const MAX_REMOTE_WIDTH = 1_280
const MAX_REMOTE_HEIGHT = 800

/** Waits one frame so the pane has been laid out before it is measured. */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => window.requestAnimationFrame(() => resolve()))
}

export function BrowserView() {
  const [params] = useSearchParams()
  const [status, setStatus] = useState<Status>('starting')
  const [error, setError] = useState('')
  const [session, setSession] = useState<BrowserSessionResponse | null>(null)
  const [view, setView] = useState<BrowserViewState | null>(null)
  const [address, setAddress] = useState(() => addressTarget(requestedSite(params) || HOME))
  const [liveReady, setLiveReady] = useState(false)
  const [nonce, setNonce] = useState(0)
  const [frame, setFrame] = useState<{ width: number; height: number } | null>(null)
  const stage = useRef<HTMLDivElement | null>(null)
  const pending = useRef(false)

  useEffect(() => {
    const previous = document.title
    document.title = 'Browser'
    return () => {
      document.title = previous
    }
  }, [])

  /**
   * Read the remote address back after an action.
   *
   * A navigation is dispatched long before the page finishes loading, so a
   * single read after a fixed delay showed the previous address and made a slow
   * site look like a button that did nothing. Poll a few times instead, and stop
   * as soon as the address stops moving would be the same cost as one read.
   */
  const syncState = useCallback(async (attempts = 2) => {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        // Meta only: the player is already drawing the page, so the snapshot
        // was pure latency between a click and the address catching up.
        const next = await api<BrowserViewState>('/browser/state?light=1', { method: 'POST' })
        setView(next)
        if (next.url) setAddress(next.url)
      } catch {
        return
      }
      if (attempt < attempts - 1) await new Promise((resolve) => window.setTimeout(resolve, 1_200))
    }
  }, [])

  /** Send the remote Chrome somewhere without remounting the live view. */
  const navigate = useCallback(
    async (target: string) => {
      setAddress(target)
      try {
        await api('/browser/act', { method: 'POST', json: { action: { type: 'navigate', url: target }, read: false } })
        void syncState(3)
      } catch {
        // The address bar keeps the target so it can be retried.
      }
    },
    [syncState],
  )

  const open = useCallback(async (target: string) => {
    setStatus('starting')
    setError('')
    // A first-frame measurement returns zero, which is how the viewer ended up
    // letterboxed; let the pane lay out before it decides the screen size.
    if (!viewportForPane(stage.current)) await nextFrame()
    const viewport = viewportForPane(stage.current)
    try {
      const next = await api<BrowserSessionResponse>('/browser/session', {
        method: 'POST',
        json: { url: target, ...(viewport ? { viewport } : {}) },
      })
      setSession(next)
      setView(next.state)
      setAddress(next.state.url || target)
      setStatus('ready')
    } catch (cause) {
      setStatus('error')
      setError(cause instanceof ApiError ? cause.message : 'The browser could not start.')
    }
  }, [])

  // Attach to the session the account already has. A first visit starts one at
  // Google instead of showing a launcher, because this page *is* the browser.
  useEffect(() => {
    let live = true
    const named = requestedSite(params)
    const requested = named ? addressTarget(named) : ''
    const current = (url?: string) => !url || /^about:blank$/i.test(url)
    api<BrowserSessionResponse>('/browser/session')
      .then((next) => {
        if (!live) return
        setSession(next)
        setView(next.state)
        setAddress(next.state.url || HOME)
        setStatus('ready')
        // A link that names a site opens it. Without this an Apps tile or the
        // Unblocker shortcut landed on whatever page the session was already
        // showing, which looks like the tile did nothing.
        if (requested && requested !== next.state.url) {
          void navigate(requested)
          return
        }
        // A cloud browser that was never asked to go anywhere sits on
        // about:blank. Land it on Google so this page opens as a browser.
        if (current(next.state.url)) void navigate(HOME)
      })
      .catch((cause) => {
        if (!live) return
        if (cause instanceof ApiError && cause.status === 404) {
          void open(addressTarget(requestedSite(params) || HOME))
          return
        }
        setStatus('error')
        setError(cause instanceof ApiError ? cause.message : 'The browser is not available.')
      })
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // An idle session expires, so keep it warm while this page is open and read
  // the real address back from the remote Chrome.
  useEffect(() => {
    if (!session) return
    let cancelled = false
    const check = async () => {
      if (document.visibilityState === 'hidden') return
      try {
        const next = await api<BrowserSessionResponse>('/browser/session?light=1')
        if (cancelled) return
        if (next.sessionId !== session.sessionId) {
          setSession(next)
          setLiveReady(false)
          setNonce((value) => value + 1)
        }
        // A keep-alive read carries no page state on purpose: reading the DOM
        // every thirty seconds stalled the remote browser and showed up in the
        // stream as a stutter.
        if (next.state) {
          setView(next.state)
          if (next.state.url) setAddress(next.state.url)
        }
      } catch (cause) {
        // The provider reaps idle and expired sessions. Start a fresh one at the
        // address on screen instead of leaving a dead "Session ended" pane that
        // only a reload could clear.
        if (cause instanceof ApiError && (cause.status === 404 || cause.status === 410)) void open(address)
      }
    }
    const timer = window.setInterval(() => void check(), KEEP_ALIVE_MS)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, address])

  // The iframe is the streamed screen, so it has to keep the stream's own shape.
  // Stretched to the pane, the provider draws the screen centred with black
  // bars and every pointer coordinate lands somewhere else.
  useEffect(() => {
    const element = stage.current
    if (!element) return
    const viewport = view?.snapshot?.viewport
    // The stream is the window, chrome and all. When the server says how big
    // that window is, its shape wins: sizing the frame to the page's viewport
    // instead left black bars and moved every pointer off its target.
    const windowSize = session?.window
    const aspect =
      windowSize && windowSize.width > 0 && windowSize.height > 0
        ? windowSize.width / windowSize.height
        : viewport && viewport.width > 0 && viewport.height > 0
          ? viewport.width / viewport.height
          : DEFAULT_ASPECT
    const update = () => {
      const rect = element.getBoundingClientRect()
      if (rect.width < 1 || rect.height < 1) return
      const width = Math.min(rect.width, rect.height * aspect)
      const height = width / aspect
      setFrame((current) =>
        current && Math.abs(current.width - width) < 1 && Math.abs(current.height - height) < 1
          ? current
          : { width, height },
      )
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [view?.snapshot?.viewport?.width, view?.snapshot?.viewport?.height, session?.window?.width, session?.window?.height])

  const run = useCallback(
    async (action: BrowserAction) => {
      if (!session || pending.current) return
      pending.current = true
      setError('')
      if (action.type === 'navigate') setAddress(action.url)
      try {
        await api('/browser/act', { method: 'POST', json: { action, read: false } })
        // The player follows the remote page on its own. Remounting it here
        // used to reconnect the stream on every click and show a second cursor
        // while it did, so only the address is read back.
        void syncState(action.type === 'navigate' ? 3 : 2)
      } catch (cause) {
        setError(cause instanceof ApiError ? cause.message : 'That action did not go through.')
      } finally {
        pending.current = false
      }
    },
    [session, syncState],
  )

  const liveSrc = session?.liveUrl ? interactiveLiveUrl(session.liveUrl) : null

  return (
    <main className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-bg" aria-label="Browser">
      <div className="flex h-12 shrink-0 items-center gap-1.5 border-b border-line bg-surface px-2.5">
        <Link
          to="/"
          className="inline-flex h-8 items-center gap-1.5 rounded-control px-2 text-[12px] font-medium text-muted transition-colors hover:bg-bg hover:text-fg"
          aria-label="Back to Ink"
          title="Back to Ink"
        >
          <ArrowLeft className="size-3.5" />
          Ink
        </Link>
        <button
          type="button"
          onClick={() => void run({ type: 'back' })}
          className="grid size-8 place-items-center rounded-control text-muted transition-colors hover:bg-bg hover:text-fg"
          aria-label="Back"
          title="Back"
        >
          <ArrowLeft className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => void run({ type: 'forward' })}
          className="grid size-8 place-items-center rounded-control text-muted transition-colors hover:bg-bg hover:text-fg"
          aria-label="Forward"
          title="Forward"
        >
          <ArrowRight className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => void run({ type: 'reload' })}
          className="grid size-8 place-items-center rounded-control text-muted transition-colors hover:bg-bg hover:text-fg"
          aria-label="Reload"
          title="Reload"
        >
          <RotateCw className="size-4" />
        </button>
        <form
          className="flex min-w-0 flex-1 items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            void run({ type: 'navigate', url: addressTarget(address) })
          }}
        >
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-line bg-bg px-3 py-1.5 focus-within:border-accent">
            <Globe className="size-4 shrink-0 text-faint" />
            <input
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="Search Google or enter an address"
              className="min-w-0 flex-1 bg-transparent text-[13px] text-fg outline-none placeholder:text-faint"
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="off"
              aria-label="Address"
            />
          </label>
          <Button type="submit" variant="secondary" disabled={status === 'starting' && !session}>
            Go
          </Button>
        </form>
      </div>

      {error ? (
        <div className="shrink-0 border-b border-line bg-surface px-3 py-2 text-[12px] text-muted">{error}</div>
      ) : null}

      <div ref={stage} className="relative grid min-h-0 flex-1 place-items-center overflow-hidden bg-black">
        {liveSrc ? (
          <iframe
            key={`${liveSrc}:${nonce}`}
            src={liveSrc}
            title={`Live view of ${view?.title || view?.url || 'the cloud browser'}`}
            className="block border-0 bg-white"
            style={frame ? { width: frame.width, height: frame.height } : { width: '100%', height: '100%' }}
            allow="clipboard-read; clipboard-write; fullscreen"
            onLoad={() => setLiveReady(true)}
            onError={() => setLiveReady(false)}
          />
        ) : (
          <div className="grid h-full place-items-center px-6 text-center">
            {status === 'error' ? (
              <div className="flex flex-col items-center gap-3">
                <p className="max-w-[380px] text-[13px] leading-relaxed text-muted">
                  {error || 'The cloud browser is not available right now.'}
                </p>
                <Button type="button" variant="secondary" onClick={() => void open(addressTarget(address) || HOME)}>
                  <RotateCw />
                  Try again
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 text-muted">
                <Loader2 className="size-4 animate-spin text-faint" />
                <p className="text-[13px]">Starting the browser…</p>
              </div>
            )}
          </div>
        )}
        {liveSrc && !liveReady ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center p-2">
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-[12px] text-muted shadow-card">
              <Loader2 className="size-4 animate-spin text-accent" />
              Connecting live view…
            </p>
          </div>
        ) : null}
      </div>
    </main>
  )
}
