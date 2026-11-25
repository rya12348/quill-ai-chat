/**
 * The origin that serves proxied pages.
 *
 * A proxied page has to run on an origin of its own. On Ink's own origin the
 * proxy document is sandboxed with `Content-Security-Policy: sandbox` and no
 * `allow-same-origin`, which leaves it an opaque origin — and Chrome refuses
 * `navigator.mediaDevices.getUserMedia` there with `SecurityError: Invalid
 * security origin` before any permission prompt can appear. A camera or
 * microphone site can therefore never work in a frame served from the app
 * origin, however the frame is marked up.
 *
 * The Pages project behind the custom domain also answers on its `.pages.dev`
 * hostname: the same Worker, the same D1, a different origin. Proxied pages load
 * there instead, so they keep a real origin to ask for a camera from while
 * Ink's own origin, cookies and session stay out of their reach.
 *
 * A deployment without a second hostname (a preview `*.pages.dev` build, or the
 * project's own `pages.dev` address) keeps proxied pages on the app origin,
 * sandboxed, exactly as before.
 */
// The frame host is a first-party subdomain of Ink's own domain, not a free host.
// A network filter keeps `.pages.dev` and `*.workers.dev` in its proxy bucket, so
// a frame served from either is blocked as an embed even when the page around it
// loads. `pxy` is the same Pages project (same Worker, same D1) reached through a
// hostname the filter has no verdict on.
const CONTENT_ORIGINS: Record<string, string> = {
  'https://www.inkbrowser.dpdns.org': 'https://pxy.inkbrowser.dpdns.org',
  'https://inkbrowser.dpdns.org': 'https://pxy.inkbrowser.dpdns.org',
}

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]', '::1'])

/** The origin proxied pages should load from, when this deployment has one. */
export function contentOriginFor(origin: string): string | undefined {
  const fixed = CONTENT_ORIGINS[origin]
  if (fixed) return fixed
  // Loopback development already runs an isolated hostname for exactly this
  // reason (`ISOLATED_PREVIEW_HOST`); it is the same app on a different origin.
  try {
    const url = new URL(origin)
    if (LOOPBACK_HOSTS.has(url.hostname)) {
      return `${url.protocol}//stet-preview.localhost${url.port ? `:${url.port}` : ''}`
    }
  } catch {
    // A malformed origin has no content origin.
  }
  return undefined
}

/**
 * True for a request on the host that serves proxied pages.
 *
 * That host answers proxy routes only: if it served the app shell too, a
 * proxied page would share an origin with Ink's own document and could read it.
 */
export function isContentHost(hostname: string): boolean {
  return (
    hostname === 'pxy.inkbrowser.dpdns.org' ||
    // Frames opened before the move still point at these hosts.
    hostname === 'ink-live.cadoffryan.workers.dev' ||
    // Older frames (and preview deployments of this project) still point here.
    hostname === 'ink-harbor-2f9.pages.dev' ||
    hostname === 'stet-preview.localhost'
  )
}
