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
  if (SKIP_PREFIXES.some((prefix) => pathname.startsWith(prefix)) || EXACT_SKIP.has(pathname)) return null
  if (pathname === '/c' || pathname.startsWith('/c/')) return '/chat'
  if (pathname === '/s' || pathname.startsWith('/s/')) return '/shared'
  // Group repeated slashes so they cannot create separate rows.
  const normalized = pathname.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/'
  return normalized.slice(0, 80)
}
