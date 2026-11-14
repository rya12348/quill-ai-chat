/**
 * On loopback the dev server also answers on a second `.localhost` hostname.
 * Point a proxied page there so a site that needs a real origin for its own
 * about:blank frames still cannot touch Ink's origin or its session. Deployed
 * origins keep the opaque sandbox because they have no second hostname.
 */
export const LIVE_PREVIEW_HOST = 'stet-preview.localhost'

export function isolatedLiveUrl(url: string): string {
  if (typeof window === 'undefined') return url
  const host = window.location.hostname
  if (host !== '127.0.0.1' && host !== 'localhost' && host !== '::1') return url
  try {
    const next = new URL(url, window.location.origin)
    if (next.protocol !== 'http:' && next.protocol !== 'https:') return url
    next.protocol = window.location.protocol
    next.hostname = LIVE_PREVIEW_HOST
    next.port = window.location.port
    return next.href
  } catch {
    return url
  }
}

export function isIsolatedLiveUrl(url: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    return new URL(url, window.location.origin).hostname === LIVE_PREVIEW_HOST
  } catch {
    return false
  }
}
