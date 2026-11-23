// A capability preview is a browsing session, so it needs the one thing a
// sandboxed document cannot keep: a cookie jar. The page runs in an opaque
// origin where document.cookie, localStorage and IndexedDB are either absent or
// per-frame memory, so a site that logs in, dismisses a consent dialog or starts
// a game from a session cookie sees a different session in every frame.
//
// The jar lives here, keyed by the capability token: one browsing session, one
// jar, shared by the page and every frame it creates, and never visible to
// another token. Cookies are attached on the way out and captured on the way
// back, so they behave like a browser's own store for the target site.

export type ProxyCookie = {
  name: string
  value: string
  /** The domain the cookie was scoped to, without a leading dot. */
  domain: string
  /** A cookie with no Domain attribute only matches its exact host. */
  hostOnly: boolean
  path: string
  secure: boolean
  httpOnly: boolean
  /** Epoch milliseconds; Infinity for a session cookie. */
  expiresAt: number
  createdAt: number
}

type Jar = {
  touchedAt: number
  cookies: Map<string, ProxyCookie>
}

/** A session that has not been used for this long is forgotten entirely. */
const SESSION_IDLE_MS = 30 * 60_000
/** A runaway site cannot grow one preview's jar without bound. */
const MAX_COOKIES_PER_SESSION = 240
const MAX_COOKIE_VALUE_CHARS = 4_096

const jars = new Map<string, Jar>()

function jarFor(token: string): Jar {
  const now = Date.now()
  // Cheap sweep: a preview that ended leaves its jar behind otherwise.
  if (jars.size > 64) {
    for (const [key, jar] of jars) {
      if (now - jar.touchedAt > SESSION_IDLE_MS) jars.delete(key)
    }
  }
  const existing = jars.get(token)
  if (existing) {
    existing.touchedAt = now
    return existing
  }
  const jar: Jar = { touchedAt: now, cookies: new Map() }
  jars.set(token, jar)
  return jar
}

function cookieKey(cookie: Pick<ProxyCookie, 'name' | 'domain' | 'path'>): string {
  return `${cookie.name}|${cookie.domain}|${cookie.path}`
}

function defaultPath(pathname: string): string {
  if (!pathname.startsWith('/')) return '/'
  const cut = pathname.lastIndexOf('/')
  return cut <= 0 ? '/' : pathname.slice(0, cut)
}

function pathMatches(requestPath: string, cookiePath: string): boolean {
  if (cookiePath === '/' || requestPath === cookiePath) return true
  const prefix = cookiePath.endsWith('/') ? cookiePath : `${cookiePath}/`
  return requestPath.startsWith(prefix)
}

function hostMatches(host: string, cookie: ProxyCookie): boolean {
  if (cookie.hostOnly) return host === cookie.domain
  return host === cookie.domain || host.endsWith(`.${cookie.domain}`)
}

/**
 * Parses one Set-Cookie line. Attributes are honoured the way a browser honours
 * them for a server-side jar: Domain widens the scope, Path widens the request
 * paths, Max-Age/Expires set or end the lifetime, and Secure keeps the value off
 * plain HTTP. SameSite is a browser/protection concern and is not applied here.
 */
export function parseSetCookie(raw: string, requestUrl: URL): ProxyCookie | null {
  const segments = raw.split(';')
  const pair = (segments.shift() ?? '').trim()
  const equals = pair.indexOf('=')
  if (equals <= 0) return null
  const name = pair.slice(0, equals).trim()
  const value = pair.slice(equals + 1).trim().slice(0, MAX_COOKIE_VALUE_CHARS)
  if (!name) return null

  const host = requestUrl.hostname.toLowerCase()
  let domain = host
  let hostOnly = true
  let path = defaultPath(requestUrl.pathname)
  let secure = false
  let httpOnly = false
  let expiresAt = Number.POSITIVE_INFINITY
  let deleted = false

  for (const segment of segments) {
    const at = segment.indexOf('=')
    const key = (at === -1 ? segment : segment.slice(0, at)).trim().toLowerCase()
    const attribute = at === -1 ? '' : segment.slice(at + 1).trim()
    if (key === 'domain' && attribute) {
      const next = attribute.replace(/^\./, '').toLowerCase()
      // A cookie may only widen to its own host or a parent of it.
      if (next && (host === next || host.endsWith(`.${next}`))) {
        domain = next
        hostOnly = false
      }
    } else if (key === 'path' && attribute.startsWith('/')) {
      path = attribute
    } else if (key === 'secure') {
      secure = true
    } else if (key === 'httponly') {
      httpOnly = true
    } else if (key === 'max-age') {
      const seconds = Number(attribute)
      if (Number.isFinite(seconds)) {
        deleted = seconds <= 0
        expiresAt = deleted ? 0 : Date.now() + seconds * 1_000
      }
    } else if (key === 'expires') {
      const at = Date.parse(attribute)
      if (Number.isFinite(at) && expiresAt === Number.POSITIVE_INFINITY) {
        deleted = at <= Date.now()
        expiresAt = at
      }
    }
  }

  return { name, value, domain, hostOnly, path, secure, httpOnly, expiresAt, createdAt: deleted ? 0 : Date.now() }
}

/** Records every Set-Cookie from an upstream response in the token's jar. */
export function captureSessionCookies(token: string, requestUrl: URL, response: Response): void {
  const lines =
    typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : (() => {
          const raw = response.headers.get('set-cookie')
          return raw ? raw.split(/,(?=[^;,]+=)/) : []
        })()
  if (!lines.length) return
  const jar = jarFor(token)
  for (const line of lines) {
    const cookie = parseSetCookie(line, requestUrl)
    if (!cookie) continue
    const key = cookieKey(cookie)
    if (cookie.expiresAt <= Date.now()) jar.cookies.delete(key)
    else jar.cookies.set(key, cookie)
  }
  if (jar.cookies.size > MAX_COOKIES_PER_SESSION) {
    const ordered = [...jar.cookies.entries()].sort((a, b) => a[1].createdAt - b[1].createdAt)
    for (const [key] of ordered.slice(0, jar.cookies.size - MAX_COOKIES_PER_SESSION)) jar.cookies.delete(key)
  }
}

/** Adds the cookies that apply to a request, like a browser would. */
export function attachSessionCookies(token: string, requestUrl: URL, headers: Headers): void {
  const jar = jars.get(token)
  if (!jar) return
  if (Date.now() - jar.touchedAt > SESSION_IDLE_MS) {
    jars.delete(token)
    return
  }
  jar.touchedAt = Date.now()
  const host = requestUrl.hostname.toLowerCase()
  const https = requestUrl.protocol === 'https:'
  const kept: string[] = []
  for (const [key, cookie] of jar.cookies) {
    if (cookie.expiresAt <= Date.now()) {
      jar.cookies.delete(key)
      continue
    }
    if (cookie.secure && !https) continue
    if (!hostMatches(host, cookie)) continue
    if (!pathMatches(requestUrl.pathname, cookie.path)) continue
    kept.push(`${cookie.name}=${cookie.value}`)
  }
  if (!kept.length) return
  // Longest path first, as a browser orders them, so a site's own precedence
  // rules still pick the same cookie.
  kept.sort((a, b) => b.length - a.length)
  const existing = headers.get('cookie')
  headers.set('cookie', existing ? `${existing}; ${kept.join('; ')}` : kept.join('; '))
}

/** Drops a session's jar when its preview ends. */
export function clearSessionCookies(token: string): void {
  jars.delete(token)
}

/** How many cookies a session is holding, for diagnostics only. */
export function sessionCookieCount(token: string): number {
  return jars.get(token)?.cookies.size ?? 0
}
