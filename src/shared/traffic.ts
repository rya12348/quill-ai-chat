// Paths that count as page views. Kept shared so the browser beacon and the
// Worker reject the same things: assets, APIs, the analytics dashboard itself,
// query strings and raw conversation/share ids.

const SKIP_PREFIXES = [
  '/api/',
  '/assets/',
  '/icons/',
  '/analysis-runner',
  '/proof-runner',
  '/poki-game',
  '/sw.js',
  '/theme-init.js',
  '/favicon',
  '/manifest',
  '/robots.txt',
  '/sitemap',
]
const EXACT_SKIP = new Set(['/api', '/analytics'])

const VISITOR_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** A random, anonymous browser id kept in the first-party traffic cookie and local storage. */
export function isVisitorId(value: string | null | undefined): value is string {
  return Boolean(value && VISITOR_ID.test(value))
}

/** A local development tunnel. These origins have no hosted sign-in. */
export function isLocalTunnelHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  return host.endsWith('.ngrok-free.dev') || host.endsWith('.ngrok-free.app') || host.endsWith('.ngrok.io') || host.endsWith('.trycloudflare.com')
}

/** A stable, non-sensitive path to count, or null when it is not a page. */
export function trafficPath(raw: string): string | null {
  if (!raw.startsWith('/') || raw.startsWith('//')) return null
  // Never persist query strings, fragments, share tokens or conversation ids.
  const pathname = raw.split(/[?#]/, 1)[0]
  if (!pathname || /[\\\u0000-\u001f\u007f]/.test(pathname)) return null
  // Group repeated slashes before deciding whether this is a page. A trailing
  // slash must not make the traffic dashboard itself countable.
  const normalized = pathname.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/'
  if (SKIP_PREFIXES.some((prefix) => pathname.startsWith(prefix)) || EXACT_SKIP.has(pathname) || EXACT_SKIP.has(normalized)) return null
  if (normalized === '/c' || normalized.startsWith('/c/')) return '/chat'
  if (normalized === '/s' || normalized.startsWith('/s/')) return '/shared'
  return normalized.slice(0, 80)
}
