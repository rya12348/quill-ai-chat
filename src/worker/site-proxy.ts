import { rewritePokiUrls } from './poki-game'
import { attachSessionCookies, captureSessionCookies } from './proxy-session'

// Live-site builds are fetched on the server and shown from Ink's origin.
// This is a real proxy, not a screenshot or replay: the page's own HTML and
// scripts run, isolated in a sandboxed iframe with no cookies or same-origin
// access. Only the HTML document is proxied; relative and root-relative assets
// are pointed back at the original site so they load from the real CDN.

const MAX_PAGE_BYTES = 3_000_000
const MAX_ASSET_BYTES = 40_000_000
const MAX_REDIRECTS = 5
const FETCH_TIMEOUT = 20_000
const PROXY_TOKEN = /^[a-f0-9]{48}$/
const HTML_TYPE = /text\/html|application\/xhtml\+xml/i
const PRIVATE_HOST = /^(?:localhost|.*\.localhost|.*\.local|.*\.internal|.*\.home\.arpa|.*\.lan|.*\.intranet)$/i
// Wildcard DNS services can resolve a public-looking name to loopback/private
// space. The Worker cannot inspect the DNS answer, so refuse the known helpers.
const PRIVATE_DNS_SUFFIX = /(?:^|\.)(?:nip\.io|sslip\.io|xip\.io|localtest\.me|lvh\.me|vcap\.me)$/i
const TRANSIENT_REDIRECTS = new Set([301, 302, 303, 307, 308])
const SITE_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'

export class SiteError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'SiteError'
  }
}

const HTTP_REASON: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  407: 'Proxy Authentication Required',
  408: 'Request Timeout',
  410: 'Gone',
  429: 'Too Many Requests',
  451: 'Unavailable For Legal Reasons',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
}

function httpReason(status: number): string {
  return HTTP_REASON[status] ?? ''
}

function isSecurlyHost(hostname: string): boolean {
  const host = hostname.replace(/^www\./i, '').toLowerCase()
  return host === 'securly.com' || host.endsWith('.securly.com')
}

function isSecurlyBlockPage(html: string): boolean {
  const head = html.slice(0, 20_000)
  return /\bsecurly\b/i.test(titleFrom(html)) || /(?:blocked\.)?securly\.com/i.test(head)
}

function siteFailureStatus(status: number): number {
  return status === 403 || status === 407 || status === 429 || status === 451 ? status : 502
}

function describeSiteFailure(status: number, target: string): string {
  let host = 'The target site'
  try {
    host = new URL(target).hostname.replace(/^www\./i, '')
  } catch {
    /* keep the generic label */
  }
  const code = `HTTP ${status}${httpReason(status) ? ` ${httpReason(status)}` : ''}`
  if (status === 451) return `${host} returned ${code}. A network filter or policy blocked this page.`
  if (status === 407) return `${host} returned ${code}. A filtering proxy refused the request.`
  if (status === 403) return `${host} returned ${code}. The site refused the proxy; this can be bot protection or a network filter.`
  if (status === 429) return `${host} returned ${code}. The proxy is being rate-limited; retry later.`
  if (status >= 500) return `${host} returned ${code}. The target server failed.`
  return `${host} returned ${code}.`
}

/** A readable diagnostic shown inside the live frame when the server sees a failure. */
export function renderProxyErrorPage(error: SiteError, target: string): string {
  let display = target
  try {
    const url = new URL(target)
    display = `${url.hostname}${url.pathname}`.slice(0, 180)
  } catch {
    /* use the raw target in the diagnostic */
  }
  const blocked =
    error.status === 403 || error.status === 407 || error.status === 451 || /securly/i.test(error.message)
  const title = blocked ? 'Preview blocked' : 'Preview unavailable'
  const meaning = blocked
    ? 'A network filter or filtering proxy refused this request. A 451 response, a 407 proxy error or a redirect to a Securly page is a direct filter signal; a 403 can also be the site’s bot protection.'
    : 'The target site or network could not return a readable page. This is not proof of a filter block.'
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title><style>
body{margin:0;font:16px/1.6 system-ui,-apple-system,Segoe UI,sans-serif;background:#f6f4ef;color:#24221d}main{max-width:680px;margin:12vh auto;padding:0 28px}.eyebrow{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#817b70;margin:0 0 10px}h1{font-size:clamp(2rem,6vw,3.2rem);line-height:1.05;letter-spacing:-.04em;margin:0 0 16px}.reason{font-size:17px;color:#4f4a42;margin:0 0 22px}.grid{display:grid;grid-template-columns:max-content minmax(0,1fr);gap:8px 18px;border:1px solid #e4ded2;border-radius:14px;background:#fffdf8;padding:16px 18px}.grid dt{color:#817b70;font-size:12px;text-transform:uppercase;letter-spacing:.06em}.grid dd{margin:0;min-width:0;overflow-wrap:anywhere}code{font:12px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace}.note{margin-top:22px;border-left:3px solid #c9a227;padding:2px 0 2px 14px;color:#676157}.note h2{font-size:14px;margin:0 0 6px;color:#24221d}.note p{margin:0 0 8px}.note p:last-child{margin-bottom:0}.limit{color:#817b70;font-size:13px}
</style></head><body><main><p class="eyebrow">Live proxy diagnostic</p><h1>${title}</h1><p class="reason">${escapeHtml(error.message)}</p><dl class="grid"><dt>HTTP status</dt><dd><code>${error.status}${httpReason(error.status) ? ` ${httpReason(error.status)}` : ''}</code></dd><dt>Target</dt><dd><code>${escapeHtml(display)}</code></dd></dl><section class="note"><h2>What this means</h2><p>${meaning}</p><p>If your browser shows Securly’s own block page or a blank frame instead of this diagnostic, the filter blocked the proxy origin before Ink received a response. Ink cannot report a status for a request it never received.</p><p class="limit">Ink reports blocking; it does not bypass network filters.</p></section></main></body></html>`
}

export type SitePage = {
  html: string
  /** The URL after redirects; this is the origin later navigations stay on. */
  finalUrl: string
  title: string
}

/** A random, unguessable capability used in the public preview URL. */
export function webProxyToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function webProxyPath(token: string): string {
  return `/api/web-proxy/${token}`
}

export function isWebProxyToken(value: string): boolean {
  return PROXY_TOKEN.test(value)
}

export type SearchResultLink = { title: string; url: string; snippet: string }

/** The query for a Google search URL, if this is one. */
export function googleSearchQuery(raw: string): string | undefined {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return undefined
  }
  const host = url.hostname.replace(/^www\./i, '').toLowerCase()
  if (!/^google\.[a-z.]+$/i.test(host) || url.pathname !== '/search') return undefined
  const query = (url.searchParams.get('q') ?? '').replace(/\s+/g, ' ').trim()
  return query ? query.slice(0, 200) : undefined
}

/** The query for a search-engine results URL, if this is one. */
export function searchQueryFor(raw: string): string | undefined {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return undefined
  }
  const host = url.hostname.replace(/^www\./i, '').toLowerCase()
  const google = /^google\.[a-z.]+$/i.test(host)
  const bing = host === 'bing.com' || host.endsWith('.bing.com')
  const duck = host === 'duckduckgo.com' || host.endsWith('.duckduckgo.com')
  if (google && url.pathname !== '/search') return undefined
  if (bing && url.pathname !== '/search') return undefined
  if (duck && url.pathname !== '/' && url.pathname !== '/html/') return undefined
  if (!google && !bing && !duck) return undefined
  const query = (url.searchParams.get('q') ?? '').replace(/\s+/g, ' ').trim()
  return query ? query.slice(0, 200) : undefined
}

/** A readable results page for a search engine that will not render in a sandbox. */
export function renderSearchResults(query: string, searchUrl: string, results: SearchResultLink[]): string {
  let action = 'https://www.google.com/search'
  try {
    const url = new URL(searchUrl)
    action = `${url.origin}${url.pathname}`
  } catch {
    /* keep the defaults */
  }
  const items = results.length
    ? results
        .map((result, index) => {
          let host = ''
          try {
            host = new URL(result.url).hostname.replace(/^www\./i, '')
          } catch {
            /* the URL is already validated by the search source */
          }
          const snippet = result.snippet.replace(/\s+/g, ' ').trim()
          return `<li><p class="meta">${index + 1} · ${escapeHtml(host)}</p><h2><a href="${escapeHtml(result.url)}">${escapeHtml(result.title)}</a></h2><p>${escapeHtml(snippet.length > 300 ? `${snippet.slice(0, 297).trimEnd()}…` : snippet)}</p></li>`
        })
        .join('')
    : '<li><p>No live results were returned. Try another search.</p></li>'
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(query)} · Web results</title><style>
body{margin:0;font:16px/1.6 system-ui,-apple-system,Segoe UI,sans-serif;background:#f6f4ef;color:#24221d}
main{max-width:760px;margin:0 auto;padding:38px 24px 64px}.eyebrow{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#817b70;margin:0 0 10px}
h1{font-size:clamp(2rem,6vw,3.4rem);line-height:1.02;letter-spacing:-.04em;margin:0 0 12px}.lede{max-width:620px;color:#6f695f;margin:0 0 18px}
form{display:flex;gap:8px;max-width:580px;margin:0 0 28px}input{flex:1;min-width:0;border:1px solid #d8d1c4;border-radius:10px;padding:10px 12px;font:inherit;background:#fffdf8;color:inherit}button{border:0;border-radius:10px;padding:10px 16px;font:inherit;font-weight:600;background:#24221d;color:#fffdf8;cursor:pointer}
ol{list-style:none;margin:0;padding:0;display:grid;gap:12px}li{border:1px solid #e4ded2;border-radius:14px;background:#fffdf8;padding:16px 18px}li p{margin:0 0 6px;color:#6f695f;font-size:14px}li p.meta{color:#9a9386;font-size:11px;letter-spacing:.04em;text-transform:uppercase}
li h2{font-size:18px;line-height:1.25;margin:0 0 6px;letter-spacing:-.01em}a{color:#157a55;text-decoration-thickness:1px;text-underline-offset:2px}.escape{margin:26px 0 0;font-size:13px;color:#817b70}
</style></head><body><main><header><p class="eyebrow">Web results</p><h1>${escapeHtml(query)}</h1>${results.length ? '' : '<p class="lede">The live search returned no results. Try another search.</p>'}</header><form action="${escapeHtml(action)}" method="get"><input name="q" value="${escapeHtml(query)}" aria-label="Search again"><button type="submit">Search</button></form><ol>${items}</ol></main></body></html>`
}

function privateHost(hostname: string): boolean {
  let host = hostname.toLowerCase().replace(/\.$/, '')
  if (host.startsWith('[') && host.endsWith(']')) host = host.slice(1, -1)
  if (!host || PRIVATE_HOST.test(host) || PRIVATE_DNS_SUFFIX.test(host)) return true
  if (host.includes(':')) {
    if (host === '::' || host === '::1') return true
    if (/^f[cd][0-9a-f]{0,2}:/.test(host)) return true // fc00::/7 unique local
    if (/^fe[89ab][0-9a-f]?:/.test(host)) return true // fe80::/10 link local
    if (/^ff[0-9a-f]{0,2}:/.test(host)) return true // ff00::/8 multicast
    if (host.startsWith('::ffff:')) return true // IPv4-mapped
    if (host.startsWith('64:ff9b:')) return true // NAT64 back to IPv4
    if (host.startsWith('2002:')) return true // 6to4 wraps an IPv4 address
    return false
  }
  if (/^[0-9.]+$/.test(host)) {
    const parts = host.split('.')
    if (parts.length !== 4 || parts.some((part) => !/^\d+$/.test(part) || Number(part) > 255)) return true
    const [first, second, third] = parts.map(Number)
    // Every reserved, private or special-use IPv4 range. URL parsing already
    // normalises decimal, octal and hex forms (2130706433, 0x7f.0.0.1) to dots,
    // so this list is the complete check rather than an approximation.
    return (
      first === 0 || // this network
      first === 10 || // private
      first === 127 || // loopback
      first >= 224 || // multicast, reserved, broadcast
      (first === 100 && second >= 64 && second <= 127) || // carrier-grade NAT
      (first === 169 && second === 254) || // link local, cloud metadata
      (first === 172 && second >= 16 && second <= 31) || // private
      (first === 192 && second === 0 && (third === 0 || third === 2)) || // IETF, TEST-NET-1
      (first === 192 && second === 168) || // private
      (first === 192 && second === 88 && third === 99) || // 6to4 relay anycast
      (first === 198 && (second === 18 || second === 19)) || // benchmarking
      (first === 198 && second === 51 && third === 100) || // TEST-NET-2
      (first === 203 && second === 0 && third === 113) // TEST-NET-3
    )
  }
  // A single-label host can be an intranet name; public sites use a dot.
  return !host.includes('.')
}

export function normalizeSiteUrl(raw: string): string | undefined {
  let value = raw.trim()
  if (!value || /\s/.test(value)) return undefined
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) value = `https://${value}`
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return undefined
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined
  if (!url.hostname) return undefined
  if (url.username || url.password) return undefined
  if (url.port && url.port !== '80' && url.port !== '443') return undefined
  if (privateHost(url.hostname)) return undefined
  url.hash = ''
  return url.href
}

/**
 * A build token can follow public links and GET forms across sites, so one
 * preview can act as a browser rather than being pinned to a single origin.
 * The token remains the capability; private hosts and non-HTML responses are
 * still refused by normalizeSiteUrl and fetchSitePage.
 */
export function resolveProxyTarget(storedUrl: string, requested?: string): string | undefined {
  const stored = normalizeSiteUrl(storedUrl)
  if (!stored) return undefined
  if (!requested) return stored
  return normalizeSiteUrl(requested)
}

/**
 * Scripts, stylesheets and module chunks cannot be loaded from the original
 * origin from a sandboxed document: modules and CSS use CORS, and an opaque
 * origin has no credentials there. Serve those files through the same
 * capability, with a path that preserves their directory so relative imports
 * and CSS url() references keep working.
 */
export function assetProxyPath(proxyUrl: string, raw: string): string | undefined {
  let candidate: URL
  try {
    candidate = new URL(raw)
  } catch {
    return undefined
  }
  if (candidate.protocol !== 'http:' && candidate.protocol !== 'https:') return undefined
  const normalized = normalizeSiteUrl(candidate.href)
  if (!normalized) return undefined
  const url = new URL(normalized)
  const base = proxyUrl.replace(/\/$/, '')
  return `${base}/p/${url.protocol.slice(0, -1)}/${url.host}${url.pathname}${url.search ? `?q=${encodeURIComponent(url.search.slice(1))}` : ''}`
}

export type SiteAsset = {
  body: ArrayBuffer
  contentType: string
}

export async function fetchSiteAsset(
  target: string,
  abort?: AbortSignal,
  token?: string,
): Promise<SiteAsset> {
  let current = normalizeSiteUrl(target)
  if (!current) throw new SiteError(400, 'That asset is not on a public website.')
  const signal = abort ? AbortSignal.any([abort, AbortSignal.timeout(FETCH_TIMEOUT)]) : AbortSignal.timeout(FETCH_TIMEOUT)
  try {
    for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
      const headers = new Headers({
        accept: '*/*',
        'accept-language': 'en-US,en;q=0.9',
        'user-agent': SITE_USER_AGENT,
      })
      // An asset that the site serves only to a signed-in visitor (a session
      // token in a cookie, a consent flag) needs the same jar the page uses.
      if (token) attachSessionCookies(token, new URL(current), headers)
      const response = await fetch(current, { redirect: 'manual', signal, headers })
      if (token) captureSessionCookies(token, new URL(current), response)
      if (TRANSIENT_REDIRECTS.has(response.status)) {
        const location = response.headers.get('location')
        await response.body?.cancel()
        if (!location) throw new SiteError(502, 'The asset sent an incomplete redirect.')
        const next = normalizeSiteUrl(new URL(location, current).href)
        if (!next) throw new SiteError(400, 'The asset redirected to a non-public address.')
        current = next
        continue
      }
      if (!response.ok) {
        await response.body?.cancel()
        throw new SiteError(502, `The asset returned ${response.status}.`)
      }
      const type = response.headers.get('content-type') ?? 'application/octet-stream'
      const length = Number(response.headers.get('content-length') ?? '0')
      if (length > MAX_ASSET_BYTES) throw new SiteError(413, 'That asset is too large to preview.')
      const body = await response.arrayBuffer()
      if (body.byteLength > MAX_ASSET_BYTES) throw new SiteError(413, 'That asset is too large to preview.')
      return { body, contentType: type }
    }
    throw new SiteError(502, 'The asset redirected too many times.')
  } catch (error) {
    if (error instanceof SiteError) throw error
    if (signal.aborted) throw new SiteError(504, 'The asset took too long to respond.')
    throw new SiteError(502, 'The asset could not be reached.')
  }
}

/**
 * A site's own scripts load data from its API at runtime. From the preview
 * those calls are cross-origin, so browsers block them unless the API allows
 * CORS. Forward same-site requests through the capability instead, keeping the
 * method, body and useful headers. Cookies, Origin and Referer are dropped so a
 * preview host's session can never leak to a browsed site.
 */
export type SiteResponse = {
  body: ArrayBuffer
  status: number
  contentType: string
}

const BLOCKED_REQUEST_HEADERS = new Set([
  'accept-encoding',
  'connection',
  'content-length',
  'cookie',
  'forwarded',
  'host',
  'keep-alive',
  'origin',
  'proxy-authorization',
  'proxy-connection',
  'referer',
  'te',
  'trailer',
  'via',
  'x-forwarded-for',
  'x-forwarded-host',
  'x-forwarded-proto',
  'x-real-ip',
  'transfer-encoding',
  'upgrade',
])

export async function fetchSiteRequest(
  target: string,
  request: Request,
  token?: string,
): Promise<SiteResponse> {
  const next = normalizeSiteUrl(target)
  if (!next) throw new SiteError(400, 'That address is not on a public website.')
  let method = request.method.toUpperCase()
  if (!['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'].includes(method)) {
    throw new SiteError(405, 'That request method is not allowed.')
  }
  const headers = new Headers()
  request.headers.forEach((value, name) => {
    const key = name.toLowerCase()
    if (BLOCKED_REQUEST_HEADERS.has(key) || key.startsWith('sec-')) return
    headers.set(key, value)
  })
  if (!headers.has('user-agent')) {
    headers.set(
      'user-agent',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    )
  }
  let body = method === 'GET' || method === 'HEAD' ? undefined : await request.arrayBuffer()
  if (body && body.byteLength > MAX_ASSET_BYTES) throw new SiteError(413, 'That request is too large to preview.')
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(FETCH_TIMEOUT)])
  let current = next
  try {
    // Redirects are followed manually so a public URL cannot bounce the Worker
    // into loopback, metadata or private address space.
    for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
      // Present the site its own origin as the Referer. Hotlink protection then
      // treats the preview as a normal visitor instead of a hotlink, and no part
      // of Ink's address reaches the target.
      headers.set('referer', new URL(current).origin + '/')
      // The browser labels a page's own request with its origin, and a site that
      // checks it refuses anything else: krillion's quota API answers 403 to a
      // request with no origin at all, which surfaced to the reader as "access
      // beacon offline" and no game. Supply the site's own origin, exactly what
      // the browser would have sent without the preview in between.
      if (method !== 'GET' && method !== 'HEAD') headers.set('origin', new URL(current).origin)
      else headers.delete('origin')
      if (token) attachSessionCookies(token, new URL(current), headers)
      const response = await fetch(current, { method, headers, body, redirect: 'manual', signal })
      if (token) captureSessionCookies(token, new URL(current), response)
      if (TRANSIENT_REDIRECTS.has(response.status)) {
        const location = response.headers.get('location')
        await response.body?.cancel()
        if (!location) throw new SiteError(502, 'The site sent an incomplete redirect.')
        let redirectUrl: URL
        try {
          redirectUrl = new URL(location, current)
        } catch {
          throw new SiteError(502, 'The site sent an invalid redirect.')
        }
        const target = normalizeSiteUrl(redirectUrl.href)
        if (!target) throw new SiteError(400, 'The site redirected to a non-public address.')
        if (response.status === 303) {
          method = 'GET'
          body = undefined
        }
        current = target
        continue
      }
      const length = Number(response.headers.get('content-length') ?? '0')
      if (length > MAX_ASSET_BYTES) {
        await response.body?.cancel()
        throw new SiteError(413, 'That response is too large to preview.')
      }
      const buffer = await response.arrayBuffer()
      if (buffer.byteLength > MAX_ASSET_BYTES) throw new SiteError(413, 'That response is too large to preview.')
      return {
        body: buffer,
        status: response.status,
        contentType: response.headers.get('content-type') ?? 'application/octet-stream',
      }
    }
    throw new SiteError(502, 'The site redirected too many times.')
  } catch (error) {
    if (error instanceof SiteError) throw error
    if (signal.aborted) throw new SiteError(504, 'That request took too long.')
    throw new SiteError(502, 'That request could not be completed.')
  }
}

/**
 * The same request, unanswered until the body is read. Games, video, Wasm and
 * large downloads cannot be buffered: the Worker has a 128 MB memory ceiling
 * and the reader waits for the whole file before seeing a frame. This path
 * forwards Range, keeps 206 and its validators, and hands the upstream stream
 * straight back, so a media element can seek and a Unity build can start on its
 * first bytes.
 */
export type SiteStream = {
  stream: ReadableStream<Uint8Array> | null
  status: number
  headers: Headers
  contentType: string
}

export async function fetchSiteStream(target: string, request: Request, token?: string): Promise<SiteStream> {
  const next = normalizeSiteUrl(target)
  if (!next) throw new SiteError(400, 'That address is not on a public website.')
  const method = request.method.toUpperCase()
  if (!['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'].includes(method)) {
    throw new SiteError(405, 'That request method is not allowed.')
  }
  const headers = new Headers()
  request.headers.forEach((value, name) => {
    const key = name.toLowerCase()
    if (BLOCKED_REQUEST_HEADERS.has(key) || key.startsWith('sec-')) return
    headers.set(key, value)
  })
  if (!headers.has('user-agent')) headers.set('user-agent', SITE_USER_AGENT)
  const body =
    method === 'GET' || method === 'HEAD' ? undefined : await request.arrayBuffer()
  if (body && body.byteLength > MAX_ASSET_BYTES) throw new SiteError(413, 'That request is too large to preview.')
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(FETCH_TIMEOUT)])
  let current = next
  try {
    for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
      headers.set('referer', new URL(current).origin + '/')
      if (method === 'GET' || method === 'HEAD') headers.delete('origin')
      else headers.set('origin', new URL(current).origin)
      if (token) attachSessionCookies(token, new URL(current), headers)
      const response = await fetch(current, { method, headers, body, redirect: 'manual', signal })
      if (token) captureSessionCookies(token, new URL(current), response)
      if (TRANSIENT_REDIRECTS.has(response.status)) {
        const location = response.headers.get('location')
        await response.body?.cancel()
        if (!location) throw new SiteError(502, 'The site sent an incomplete redirect.')
        let redirectUrl: URL
        try {
          redirectUrl = new URL(location, current)
        } catch {
          throw new SiteError(502, 'The site sent an invalid redirect.')
        }
        const redirected = normalizeSiteUrl(redirectUrl.href)
        if (!redirected) throw new SiteError(400, 'The site redirected to a non-public address.')
        current = redirected
        continue
      }
      const empty = method === 'HEAD' || response.status === 204 || response.status === 304
      return {
        stream: empty ? null : response.body,
        status: response.status,
        headers: response.headers,
        contentType: response.headers.get('content-type') ?? 'application/octet-stream',
      }
    }
    throw new SiteError(502, 'The site redirected too many times.')
  } catch (error) {
    if (error instanceof SiteError) throw error
    if (signal.aborted) throw new SiteError(504, 'That request took too long.')
    throw new SiteError(502, 'That request could not be completed.')
  }
}

function encodeText(text: string): ArrayBuffer {
  const bytes = new TextEncoder().encode(text)
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

/**
 * CSS root-relative url() references would otherwise resolve against Ink's
 * origin. Vite's preload map stores asset paths as "assets/...", and its
 * helper prepends a slash, so those entries are made proxy-relative too.
 */
export function rewriteAssetContent(
  body: ArrayBuffer,
  contentType: string,
  targetUrl: string,
  proxyUrl: string,
): ArrayBuffer {
  const type = contentType.toLowerCase()
  const decoder = new TextDecoder()
  let target: URL
  try {
    target = new URL(targetUrl)
  } catch {
    return body
  }
  if (type.includes('text/css')) {
    const css = rewritePokiUrls(decoder.decode(body), new URL(proxyUrl).origin)
    const rewriteUrl = (raw: string): string => {
      try {
        return assetProxyPath(proxyUrl, new URL(raw, target).href) ?? raw
      } catch {
        return raw
      }
    }
    const rewritten = css
      .replace(/url\(\s*(["']?)(\/(?!\/)[^)"']*)\1\s*\)/gi, (_match, quote: string, path: string) => `url(${quote}${rewriteUrl(path)}${quote})`)
      .replace(/(@import\s+)(["'])(\/(?!\/)[^"']+)\2/gi, (_match, prefix: string, quote: string, path: string) => `${prefix}${quote}${rewriteUrl(path)}${quote}`)
    return encodeText(rewritten)
  }
  if (type.includes('javascript') || type.includes('ecmascript')) {
    // Game pages embed a promo overlay for framed sessions. It is not part of
    // the game, so serve an empty script instead of letting it cover Unity.
    if (/\/assets\/promo\//i.test(target.pathname)) return encodeText('')
    const assetBase = `${proxyUrl.replace(/\/$/, '')}/p/${target.protocol.slice(0, -1)}/${target.host}/`
    // Vite's preload helper turns its map entries ("assets/...") into URLs
    // with `"/" + dep`. That resolves against the page's original <base>, so
    // patch the helper to make the URL absolute on the proxy origin instead.
    let js = rewritePokiUrls(decoder.decode(body), new URL(proxyUrl).origin)
    // FreezeNova's game.js sends an embedded frame to its ad wrapper. Keep the
    // leaderboard helpers, but drop the redirect so the game itself stays up.
    if (/\/assets\/scripts\/game\.js$/i.test(target.pathname)) {
      js = js.replace(/window\.location\.href\s*=\s*(['"])\.\/pre(?:-gg)?\.html\1/g, 'void 0')
    }
    js = js.replace(
      /(function\([A-Za-z_$][\w$]*\)\s*\{\s*return|\([A-Za-z_$][\w$]*\)\s*=>)\s*(["'])\/\2\s*\+\s*([A-Za-z_$][\w$]*)/g,
      (_match, prefix: string, _quote: string, depArg: string) => `${prefix}${JSON.stringify(assetBase)} + ${depArg}`,
    )
    return encodeText(js)
  }
  return body
}

function hasEmbedIntent(question: string): boolean {
  return (
    /\b(?:show|display|embed|open|load|view|browse|preview|visit|run|launch|play|access|try|inside|include|includes|including|contain|contains|containing|live|sandbox)\b/i.test(
      question,
    ) ||
    /\b(?:go|navigate)\s+to\b/i.test(question) ||
    /\b(?:website|site|page)\b[\s\S]{0,60}\b(?:with|has|having)\b/i.test(question)
  )
}

/**
 * A URL in a Build request means "show this live" only when the wording asks
 * for an embed. "Build a site like poki" remains an original generated site.
 */
export function findSiteTarget(question: string): string | undefined {
  const explicit = question.match(/https?:\/\/[^\s<>"'`]+/i)?.[0]
  const bare = question.match(
    /(?:^|[\s(])((?:www\.)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}(?::\d{2,5})?(?:\/[^\s<>"'`]*)?)/i,
  )?.[1]
  const candidate = explicit ?? bare ?? (/\bpoki\b/i.test(question) ? 'https://poki.com/' : undefined)
  if (!candidate) return undefined
  const cleaned = candidate.replace(/[.,!?;:]+$/, '').replace(/[)\]}]+$/, '')
  const normalized = normalizeSiteUrl(cleaned)
  if (!normalized) return undefined
  const onlySite = /^(?:https?:\/\/|www\.)?[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(?:\/\S*)?$/i.test(
    question.trim().replace(/[.!?]+$/, ''),
  )
  if (!hasEmbedIntent(question) && !onlySite) return undefined
  return normalized
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function titleFrom(html: string): string {
  const raw = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? ''
  return raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
}

export function parseGoogleLuckyRedirect(location: string | null, base = 'https://www.google.com/'): string | undefined {
  if (!location) return undefined
  let next: URL
  try {
    next = new URL(location, base)
  } catch {
    return undefined
  }
  const host = next.hostname.replace(/^www\./i, '').toLowerCase()
  if (/^google\.[a-z.]+$/i.test(host)) {
    if (next.pathname !== '/url') return undefined
    const value = (next.searchParams.get('q') ?? next.searchParams.get('url') ?? '').trim()
    if (!value) return undefined
    return normalizeSiteUrl(value)
  }
  const result = normalizeSiteUrl(next.href)
  if (!result) return undefined
  const resultUrl = new URL(result)
  if (/^google\.[a-z.]+$/i.test(resultUrl.hostname.replace(/^www\./i, '')) && resultUrl.pathname === '/search') return undefined
  return result
}

/**
 * Google no longer serves a readable results page to a server-side fetch. Its
 * lucky endpoint still resolves a query to the top indexed result, which lets
 * the live preview stay inside the sandbox instead of opening google.com.
 */
export async function googleTopResult(query: string, abort?: AbortSignal): Promise<string | undefined> {
  const url = new URL('https://www.google.com/search')
  url.searchParams.set('q', query)
  url.searchParams.set('btnI', '1')
  url.searchParams.set('sourceid', 'navclient')
  url.searchParams.set('gfns', '1')
  url.searchParams.set('hl', 'en')
  url.searchParams.set('gl', 'us')
  const timeout = AbortSignal.timeout(8_000)
  const signal = abort ? AbortSignal.any([abort, timeout]) : timeout
  try {
    const response = await fetch(url, {
      redirect: 'manual',
      signal,
      headers: {
        accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1',
        'accept-language': 'en-US,en;q=0.9',
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      },
    })
    if (!TRANSIENT_REDIRECTS.has(response.status)) {
      await response.body?.cancel()
      return undefined
    }
    const location = response.headers.get('location')
    await response.body?.cancel()
    return parseGoogleLuckyRedirect(location)
  } catch {
    return undefined
  }
}

/**
 * Google's result HTML is a JavaScript challenge for a server-side fetch. Use
 * DuckDuckGo's lightweight HTML endpoint as a live result source instead of
 * returning an empty "top result" page. Result links are decoded back to the
 * destination before they are handed to the proxy.
 */
async function fetchDuckDuckGoSearchResults(query: string, abort?: AbortSignal): Promise<SearchResultLink[]> {
  const url = new URL('https://html.duckduckgo.com/html/')
  url.searchParams.set('q', query)
  const timeout = AbortSignal.timeout(8_000)
  const signal = abort ? AbortSignal.any([abort, timeout]) : timeout
  try {
    const response = await fetch(url, {
      signal,
      headers: {
        accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1',
        'accept-language': 'en-US,en;q=0.9',
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      },
    })
    if (!response.ok) {
      await response.body?.cancel()
      return []
    }
    const html = await response.text()
    const results: SearchResultLink[] = []
    const seen = new Set<string>()
    const anchors = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)]
    for (const anchor of anchors) {
      const attributes = anchor[1] ?? ''
      if (!/class="[^"]*result__a[^"]*"/i.test(attributes)) continue
      const rawHref = /\bhref="([^"]+)"/i.exec(attributes)?.[1]
      if (!rawHref) continue
      let destination: URL
      try {
        destination = new URL(rawHref.replace(/&amp;/g, '&'), 'https://duckduckgo.com')
        if (/(^|\.)duckduckgo\.com$/i.test(destination.hostname)) {
          const encoded = destination.searchParams.get('uddg')
          if (!encoded) continue
          destination = new URL(encoded)
        }
      } catch {
        continue
      }
      const normalized = normalizeSiteUrl(destination.href)
      if (!normalized) continue
      const resultUrl = new URL(normalized)
      if (/(^|\.)duckduckgo\.com$/i.test(resultUrl.hostname) || seen.has(normalized)) continue
      const title = decodeSearchText(anchor[2] ?? '') || resultUrl.hostname
      const after = html.slice((anchor.index ?? 0) + anchor[0].length)
      const rawSnippet = /<a\b[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/i.exec(after)?.[1] ?? ''
      results.push({ title, url: normalized, snippet: decodeSearchText(rawSnippet) })
      seen.add(normalized)
      if (results.length >= 8) break
    }
    return results
  } catch {
    return []
  }
}

/** The exported search used by the Google proxy: try Bing first, then DuckDuckGo. */
export async function fetchWebSearchResults(query: string, abort?: AbortSignal): Promise<SearchResultLink[]> {
  const bing = await fetchBingSearchResults(query, abort)
  if (bing.length) return bing
  return fetchDuckDuckGoSearchResults(query, abort)
}

/** Bing's lightweight RSS result feed avoids its HTML redirect URLs. */
async function fetchBingSearchResults(query: string, abort?: AbortSignal): Promise<SearchResultLink[]> {
  const url = new URL('https://www.bing.com/search')
  url.searchParams.set('format', 'rss')
  url.searchParams.set('q', query)
  url.searchParams.set('setlang', 'en')
  url.searchParams.set('cc', 'us')
  const timeout = AbortSignal.timeout(8_000)
  const signal = abort ? AbortSignal.any([abort, timeout]) : timeout
  try {
    const response = await fetch(url, {
      signal,
      headers: {
        accept: 'application/rss+xml,application/xml,text/xml,text/html;q=0.9,*/*;q=0.1',
        'accept-language': 'en-US,en;q=0.9',
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      },
    })
    if (!response.ok) {
      await response.body?.cancel()
      return []
    }
    const xml = await response.text()
    const results: SearchResultLink[] = []
    const seen = new Set<string>()
    for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
      const block = match[1] ?? ''
      const normalized = normalizeSiteUrl(decodeSearchText(rssField(block, 'link')))
      if (!normalized) continue
      const host = new URL(normalized).hostname.replace(/^www\./i, '').toLowerCase()
      if (/(^|\.)bing\.com$/i.test(host) || seen.has(normalized)) continue
      const title = cleanRssText(rssField(block, 'title')) || host
      const snippet = cleanRssText(rssField(block, 'description'))
      results.push({ title, url: normalized, snippet })
      seen.add(normalized)
      if (results.length >= 8) break
    }
    return results
  } catch {
    return []
  }
}

function rssField(block: string, tag: string): string {
  return new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(block)?.[1] ?? ''
}

function cleanRssText(value: string): string {
  return decodeSearchText(value.replace(/^<!\[CDATA\[/i, '').replace(/\]\]>$/, ''))
}

function decodeSearchText(value: string): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex: string) => {
      try {
        return String.fromCodePoint(Number.parseInt(hex, 16))
      } catch {
        return ''
      }
    })
    .replace(/&#(\d+);/g, (_match, decimal: string) => {
      try {
        return String.fromCodePoint(Number.parseInt(decimal, 10))
      } catch {
        return ''
      }
    })
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Google rejects Worker fetches of its landing page with 429. The home page is
 * almost entirely a search box, so render a local landing page without making
 * the whole Build fail. The form and any links still navigate through the
 * capability proxy; only the initial document is local.
 */
function googleLandingFallback(raw: string): string | undefined {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return undefined
  }
  const host = url.hostname.replace(/^www\./i, '').toLowerCase()
  if (!/^google\.[a-z.]+$/i.test(host)) return undefined
  if (url.pathname !== '/' && url.pathname !== '/webhp') return undefined
  if (url.searchParams.has('q')) return undefined
  // The capability URL is only known to the route that serves this page, so the
  // form posts to a placeholder it fills in. Without it the search form would
  // submit straight to google.com and leave the proxy.
  const search = '__ink_proxy_search__'
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Google</title><style>
html,body{height:100%}body{margin:0;background:#fff;color:#202124;font:16px/1.5 Arial,Helvetica,sans-serif}main{min-height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;box-sizing:border-box;padding:48px 20px;text-align:center}.logo{font-size:clamp(4rem,14vw,6.5rem);font-weight:500;letter-spacing:-.09em;line-height:1;user-select:none}.logo span:nth-child(1){color:#4285f4}.logo span:nth-child(2){color:#ea4335}.logo span:nth-child(3){color:#fbbc05}.logo span:nth-child(4){color:#4285f4}.logo span:nth-child(5){color:#34a853}.logo span:nth-child(6){color:#ea4335}form{width:min(100%,584px);margin-top:34px}.search{display:flex;align-items:center;gap:12px;border:1px solid #dfe1e5;border-radius:999px;padding:8px 18px;background:#fff;box-shadow:0 1px 6px rgba(32,33,36,.15)}.search:focus-within{box-shadow:0 1px 8px rgba(32,33,36,.22)}.search svg{flex:none;color:#9aa0a6}input{flex:1;min-width:0;border:0;outline:0;padding:10px 0;background:transparent;color:inherit;font:16px Arial,Helvetica,sans-serif}.buttons{display:flex;justify-content:center;gap:11px;margin-top:30px}button,.buttons a{border:1px solid #f8f9fa;border-radius:4px;background:#f8f9fa;color:#3c4043;padding:10px 16px;font:14px Arial,Helvetica,sans-serif;cursor:pointer;text-decoration:none;display:inline-block}button:hover,.buttons a:hover{border-color:#dadce0;box-shadow:0 1px 1px rgba(0,0,0,.1)}
</style></head><body data-ink-landing><main><div class="logo" aria-label="Google"><span>G</span><span>o</span><span>o</span><span>g</span><span>l</span><span>e</span></div><form action="${escapeHtml(search)}" method="get" role="search"><label class="search"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-4-4"></path></svg><input name="q" type="search" placeholder="Search Google" aria-label="Search Google" autocomplete="off" autofocus></label><div class="buttons"><button type="submit">Google Search</button></div></form></main></body></html>`
}

export async function fetchSitePage(target: string, abort?: AbortSignal): Promise<SitePage> {
  let current = normalizeSiteUrl(target)
  if (!current) throw new SiteError(400, 'That address is not a public website.')
  // Google's home page is a script app. The preview strips its scripts (they
  // fight the proxied location), which leaves a Google page whose search box
  // does nothing. Serve the preview's own Google page instead, so a search from
  // it opens the preview's result list.
  const googleHome = googleLandingFallback(current)
  if (googleHome) return { html: googleHome, finalUrl: 'https://www.google.com/', title: 'Google' }
  const signal = abort ? AbortSignal.any([abort, AbortSignal.timeout(FETCH_TIMEOUT)]) : AbortSignal.timeout(FETCH_TIMEOUT)
  try {
    for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
      const response = await fetch(current, {
        redirect: 'manual',
        signal,
        headers: {
          accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1',
          'accept-language': 'en-US,en;q=0.9',
          referer: new URL(current).origin + '/',
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        },
      })
      if (TRANSIENT_REDIRECTS.has(response.status)) {
        const location = response.headers.get('location')
        await response.body?.cancel()
        if (!location) throw new SiteError(502, 'The site sent an incomplete redirect.')
        let redirect: URL
        try {
          redirect = new URL(location, current)
        } catch {
          throw new SiteError(502, 'The site sent an invalid redirect.')
        }
        if (isSecurlyHost(redirect.hostname)) {
          throw new SiteError(
            451,
            `Securly redirected the proxy to its block page (${redirect.hostname}). The network filter is blocking this site.`,
          )
        }
        const next = normalizeSiteUrl(redirect.href)
        if (!next) throw new SiteError(400, 'The site redirected to a non-public address.')
        current = next
        continue
      }
      if (!response.ok) {
        await response.body?.cancel()
        // Google returns 429 to some worker egress ranges. Only fall back to
        // the local landing page when the real page is unavailable; otherwise
        // the proxy would be showing a mock even when Google is reachable.
        if (response.status === 429) {
          // Google can redirect the home page to /sorry/index before returning
          // 429. Use the original target so the local landing page still opens
          // in production, where Google rate-limits Worker egress.
          const googleLanding = googleLandingFallback(target) ?? googleLandingFallback(current)
          if (googleLanding) return { html: googleLanding, finalUrl: 'https://www.google.com/', title: 'Google' }
        }
        throw new SiteError(
          siteFailureStatus(response.status),
          describeSiteFailure(response.status, current),
        )
      }
      const type = response.headers.get('content-type') ?? ''
      if (type && !HTML_TYPE.test(type)) {
        await response.body?.cancel()
        throw new SiteError(415, 'That address is not an HTML page.')
      }
      const length = Number(response.headers.get('content-length') ?? '0')
      if (length > MAX_PAGE_BYTES) throw new SiteError(413, 'That page is too large to preview.')
      const buffer = await response.arrayBuffer()
      if (buffer.byteLength > MAX_PAGE_BYTES) throw new SiteError(413, 'That page is too large to preview.')
      const html = new TextDecoder().decode(buffer)
      if (!html.trim()) throw new SiteError(502, 'The site returned an empty page.')
      if (isSecurlyBlockPage(html)) {
        throw new SiteError(
          451,
          `Securly returned a block page for ${new URL(current).hostname}. The network filter is blocking this site.`,
        )
      }
      return {
        html,
        finalUrl: current,
        title: titleFrom(html) || new URL(current).hostname.replace(/^www\./, ''),
      }
    }
    throw new SiteError(502, 'The site redirected too many times.')
  } catch (error) {
    if (error instanceof SiteError) throw error
    if (signal.aborted) throw new SiteError(504, 'The site took too long to respond.')
    throw new SiteError(502, 'The site could not be reached.')
  }
}

function rootRelative(markup: string, origin: string): string {
  let out = markup.replace(
    /(\b(?:src|href|poster|action|data-src)\s*=\s*)(["'])\/(?!\/)/gi,
    (_match, attribute: string, quote: string) => `${attribute}${quote}${origin}/`,
  )
  out = out.replace(
    /(\b(?:src|href|poster|action|data-src)\s*=\s*)\/(?!\/)/gi,
    (_match, attribute: string) => `${attribute}${origin}/`,
  )
  out = out.replace(/url\(\s*(["']?)\/(?!\/)/gi, (_match, quote: string) => `url(${quote}${origin}/`)
  // Leave srcset alone. CDN image URLs can contain commas (Poki's resize
  // path does), and splitting on every comma corrupts them into 404s. The
  // injected <base> already resolves any root-relative candidates.
  return out
}

// These are buffered by the asset proxy. Media files are deliberately left
// direct until the proxy can forward Range requests without loading the whole
// file into memory.
const RESOURCE_ATTRIBUTES: Record<string, string[]> = {
  script: ['src'],
  link: ['href'],
  img: ['src'],
  source: ['src'],
  video: ['src', 'poster'],
  audio: ['src'],
  track: ['src'],
  embed: ['src'],
  input: ['src'],
}

/**
 * A srcset holds several comma-separated candidates. Only a comma followed by
 * whitespace is a separator here: a CDN resize path can contain a comma inside
 * the URL itself, and splitting on it turns one working image into two 404s.
 */
function proxySrcset(
  value: string,
  finalUrl: string,
  proxyUrl: string,
  appOrigin: string,
): string {
  return value
    .split(/,(\s+)/)
    .map((part) => {
      if (!part || /^\s+$/.test(part)) return part
      const match = /^(\s*)(\S+)([\s\S]*)$/.exec(part)
      if (!match) return part
      const [, lead, raw, descriptor] = match
      if (!raw || /^(?:data:|blob:|javascript:|#)/i.test(raw)) return part
      let target: URL
      try {
        target = new URL(raw, finalUrl)
      } catch {
        return part
      }
      if (target.protocol !== 'http:' && target.protocol !== 'https:') return part
      if (appOrigin && target.origin === appOrigin) return part
      const proxied = assetProxyPath(proxyUrl, target.href)
      return proxied ? `${lead}${escapeHtml(proxied)}${descriptor}` : part
    })
    .join('')
}

/**
 * Static resources are fetched by the preview's browser, so they must use the
 * proxy origin too. Otherwise a network filter sees the original CDN host even
 * though the document itself was proxied, and a sandboxed document may be
 * blocked by CORS for fonts, images and media as well as scripts and CSS.
 */
/**
 * Verification widgets (Cloudflare Turnstile, hCaptcha, reCAPTCHA) and Cloudflare's
 * own /cdn-cgi/ challenge runtime can only work on the origin that issued them.
 * Their frame carries its own scripts, storage and postMessage handshake, and the
 * sitekey is bound to a hostname; served through Ink's proxy the frame becomes an
 * Ink document that fails its own origin check, which is what "the captcha will
 * not load" looks like. These URLs are therefore left exactly as the site wrote
 * them: the proxy passes the page through, it does not get to re-home a challenge.
 */
function isChallengeUrl(raw: string, base: string): boolean {
  let url: URL
  try {
    url = new URL(raw, base)
  } catch {
    return false
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
  const host = url.hostname.toLowerCase()
  const path = url.pathname.toLowerCase()
  if (path.startsWith('/cdn-cgi/')) return true
  if (host === 'challenges.cloudflare.com') return true
  if (host === 'hcaptcha.com' || host.endsWith('.hcaptcha.com')) return true
  if (host === 'recaptcha.net' || host.endsWith('.recaptcha.net')) return true
  if (host === 'recaptcha.google.com') return true
  if ((host === 'www.google.com' || host === 'www.gstatic.com') && path.startsWith('/recaptcha')) return true
  return false
}

function proxyAssetTags(html: string, finalUrl: string, proxyUrl: string): string {
  // An asset that is already on this origin (a Poki CDN URL rewritten a moment
  // ago, for instance) must be left alone. Wrapping it again produced a
  // `/p/https/<app>/api/poki-cdn/…` URL that the fetch route then rejected.
  const appOrigin = (() => {
    try {
      return new URL(proxyUrl).origin
    } catch {
      return ''
    }
  })()
  // A nested frame is a whole document, not an asset: it must come back through
  // the same token's proxy so its own scripts, styles and cookie jar match the
  // page around it. Left alone, `./index.html` inside an ad wrapper resolves
  // against the real host and the frame never joins the session.
  const withFrames = html.replace(/<(iframe|frame)\b[^>]*>/gi, (tag: string) =>
    tag.replace(/(\bsrc\s*=\s*)(["'])([^"']*)\2/i, (match: string, prefix: string, quote: string, raw: string) => {
      if (!raw || /^(?:about:|data:|blob:|javascript:|#)/i.test(raw)) return match
      let target: URL
      try {
        target = new URL(raw, finalUrl)
      } catch {
        return match
      }
      if (target.protocol !== 'http:' && target.protocol !== 'https:') return match
      if (appOrigin && target.origin === appOrigin) return match
      // A verification frame is not an asset of this page: re-homing it breaks it.
      if (isChallengeUrl(raw, finalUrl)) return match
      return `${prefix}${quote}${escapeHtml(`${proxyUrl}?url=${encodeURIComponent(target.href)}`)}${quote}`
    }),
  )
  return withFrames.replace(/<(script|link|img|source|video|audio|track|embed|input)\b[^>]*>/gi, (tag: string, tagName: string) => {
    const name = tagName.toLowerCase()
    // A prefetched or preloaded alternate must keep its own rewrite path.
    if (name === 'input') {
      const typeMatch = /\btype\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag)
      const type = (typeMatch?.[1] ?? typeMatch?.[2] ?? typeMatch?.[3] ?? '').toLowerCase()
      if (type !== 'image') return tag
    }
    if (name === 'link') {
      const relMatch = /\brel\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag)
      const rel = (relMatch?.[1] ?? relMatch?.[2] ?? relMatch?.[3] ?? '').toLowerCase()
      if (!/(?:^|\s)(?:stylesheet|modulepreload|preload)(?:\s|$)/.test(rel)) return tag
    }
    const withSrcset = /\bsrcset\s*=/i.test(tag)
      ? tag.replace(/(\bsrcset\s*=\s*)(["'])([^"']*)\2/i, (_match: string, prefix: string, quote: string, raw: string) =>
          `${prefix}${quote}${proxySrcset(raw, finalUrl, proxyUrl, appOrigin)}${quote}`,
        )
      : tag
    return (RESOURCE_ATTRIBUTES[name] ?? []).reduce((out, attribute) => {
      const pattern = new RegExp(`(\\b${attribute}\\s*=\\s*)(["'])([^"']*)\\2`, 'i')
      return out.replace(pattern, (match: string, prefix: string, quote: string, raw: string) => {
        if (!raw || /^(?:data:|blob:|javascript:|#)/i.test(raw)) return match
        let target: URL
        try {
          target = new URL(raw, finalUrl)
        } catch {
          return match
        }
        if (target.protocol !== 'http:' && target.protocol !== 'https:') return match
        if (appOrigin && target.origin === appOrigin) return match
        const proxied = assetProxyPath(proxyUrl, target.href)
        return proxied ? `${prefix}${quote}${escapeHtml(proxied)}${quote}` : match
      })
    }, withSrcset)
  })
}

function addBase(html: string, base: string): string {
  const tag = `<base href="${escapeHtml(base)}">`
  if (/<head(?:\s[^>]*)?>/i.test(html)) return html.replace(/<head(?:\s[^>]*)?>/i, (head) => `${head}${tag}`)
  if (/<html(?:\s[^>]*)?>/i.test(html)) return html.replace(/<html(?:\s[^>]*)?>/i, (root) => `${root}<head>${tag}</head>`)
  return `${tag}${html}`
}

/**
 * Sandboxed documents cannot touch cookies or Web Storage, and many sites
 * (Poki included) crash or wait forever when that access throws. Give those
 * APIs a document-local memory implementation before the site's own scripts
 * run. Nothing is shared with Ink or with another proxied page.
 */
function addSandboxShims(html: string, historyUrl: string): string {
  const shim = `<script>(function(){
var cookies=new Map();
function readCookies(){var out=[];cookies.forEach(function(value,name){out.push(name+'='+value)});return out.join('; ')}
function writeCookie(value){var text=String(value);var pair=text.split(';')[0];var at=pair.indexOf('=');if(at<1)return;var name=pair.slice(0,at).trim();var data=pair.slice(at+1);var maxAge=/;\\s*max-age=(-?\\d+)/i.exec(text);var expires=/;\\s*expires=([^;]+)/i.exec(text);var expired=maxAge?Number(maxAge[1])<=0:expires?Date.parse(expires[1])<Date.now():false;if(!name)return;if(expired)cookies.delete(name);else cookies.set(name,data)}
try{Object.defineProperty(Document.prototype,'cookie',{configurable:true,enumerable:true,get:readCookies,set:writeCookie})}catch(error){}
function memoryStorage(){var values=new Map();return{getItem:function(key){key=String(key);return values.has(key)?values.get(key):null},setItem:function(key,value){values.set(String(key),String(value))},removeItem:function(key){values.delete(String(key))},clear:function(){values.clear()},key:function(index){var keys=Array.from(values.keys());return index>=0&&index<keys.length?keys[index]:null},get length(){return values.size}}}
try{Object.defineProperty(window,'localStorage',{configurable:true,value:memoryStorage()});Object.defineProperty(window,'sessionStorage',{configurable:true,value:memoryStorage()})}catch(error){}
function memoryCacheStorage(){
var cache={match:function(){return Promise.resolve(undefined)},matchAll:function(){return Promise.resolve([])},put:function(){return Promise.resolve()},add:function(){return Promise.resolve()},addAll:function(){return Promise.resolve()},delete:function(){return Promise.resolve(false)},keys:function(){return Promise.resolve([])}};
return{open:function(){return Promise.resolve(cache)},has:function(){return Promise.resolve(false)},delete:function(){return Promise.resolve(false)},keys:function(){return Promise.resolve([])},match:function(){return Promise.resolve(undefined)}}
}
try{Object.defineProperty(window,'caches',{configurable:true,value:memoryCacheStorage()})}catch(error){}
function memoryIndexedDB(){
var databases=new Map();
function request(value){var req={result:value,error:null};setTimeout(function(){if(req.onsuccess)req.onsuccess({target:req})},0);return req}
function createStore(data,keyPath){
return{createIndex:function(){},put:function(value){var key=keyPath&&value?value[keyPath]:value;data.set(String(key),value);return request(key)},get:function(key){return request(data.get(String(key)))},delete:function(key){data.delete(String(key));return request(undefined)},clear:function(){data.clear();return request(undefined)},openCursor:function(){return request(null)},openKeyCursor:function(){return request(null)}}
}
function open(name,version){
var stores=new Map();
var db={objectStoreNames:{contains:function(storeName){return stores.has(storeName)}},createObjectStore:function(storeName,options){var data=new Map();var keyPath=options&&options.keyPath;var store=createStore(data,keyPath);stores.set(storeName,{data:data,keyPath:keyPath,store:store});return store},deleteObjectStore:function(storeName){stores.delete(storeName)},close:function(){},transaction:function(names,mode){var tx={objectStore:function(storeName){var record=stores.get(storeName);if(!record){var data=new Map();record={data:data,keyPath:null,store:createStore(data,null)};stores.set(storeName,record)}return record.store},oncomplete:null,onerror:null};setTimeout(function(){if(tx.oncomplete)tx.oncomplete({target:tx})},0);return tx}};
var req={result:db,error:null};
req.target=req;
req.transaction=db.transaction([]);
var event={target:req,currentTarget:req};
setTimeout(function(){try{if(req.onupgradeneeded)req.onupgradeneeded.call(req,event)}catch(error){}if(req.onsuccess)req.onsuccess(event)},0);
return req
}
return{open:open}
}
try{Object.defineProperty(window,'indexedDB',{configurable:true,value:memoryIndexedDB()})}catch(error){}
try{history.replaceState(history.state,'',${JSON.stringify(historyUrl)})}catch(error){}
})()</script>`
  if (/<head(?:\s[^>]*)?>/i.test(html)) return html.replace(/<head(?:\s[^>]*)?>/i, (head) => `${head}${shim}`)
  if (/<html(?:\s[^>]*)?>/i.test(html)) return html.replace(/<html(?:\s[^>]*)?>/i, (root) => `${root}<head>${shim}</head>`)
  return `${shim}${html}`
}

export type FrameBridgeOptions = {
  /** Absolute token-scoped URL that renders another public HTML page. */
  proxyUrl: string
  /** Optional wrapper resolver for sites whose games need their own referrer. */
  gameStartUrl?: string
  /** Hosts that need the wrapper resolver instead of the ordinary page proxy. */
  gameHosts?: string[]
  /** Let the parent page start game navigations for an embedded preview. */
  parentNavigation?: boolean
}

/**
 * Every embedded page is a public address that would otherwise load outside
 * the sandbox. Keep iframes behind the same capability proxy, including frames
 * a site creates after its scripts boot. A frame that needs a game wrapper
 * resolver can use it, but ordinary sites do not need a site-specific branch.
 */
export function installFrameBridge(html: string, options: FrameBridgeOptions): string {
  const script = `<script>(function(){
var proxy=${JSON.stringify(options.proxyUrl)};
var gameStart=${JSON.stringify(options.gameStartUrl ?? '')};
var gameHosts=${JSON.stringify(options.gameHosts ?? [])};
var parentNav=${options.parentNavigation ? 'true' : 'false'};
var appOrigin=new URL(proxy).origin;
var moved=false;
// Diagnostics. A sandboxed frame is invisible to the page that shows it, so a
// frame that stalls leaves nothing to read: no console, no DOM, no status. That
// is what a Unity game does when its loader never runs. Report every failure
// and the engine's state a few seconds in, to the parent, which can show it.
var diagToken=(function(){try{return new URL(proxy).pathname.split('/')[3]||''}catch(error){return ''}})();
function diag(kind,detail){
  var payload={type:'stet:preview-diagnostic',kind:kind,href:location.href,detail:detail,at:Date.now()};
  // A game frame can block its own main thread, so the message channel and the
  // console may both be unreadable. The Worker keeps the last reports per token
  // and answers them over GET, which works even then.
  try{
    if(diagToken&&navigator.sendBeacon){
      navigator.sendBeacon(appOrigin+'/api/web-proxy/'+diagToken+'/diag',new Blob([JSON.stringify(payload)],{type:'text/plain'}));
    }
  }catch(error){}
  try{console.warn('[ink-diag]',kind,JSON.stringify(detail))}catch(error){}
  try{if(window.parent!==window)window.parent.postMessage(payload,'*')}catch(error){}
  // A game frame is a grandchild of the page that shows it, so one level up
  // stops at the wrapper. The top window is where the Browser page listens.
  try{if(window.top&&window.top!==window&&window.top!==window.parent)window.top.postMessage(payload,'*')}catch(error){}
}
try{
  diag('frame-ready',{frames:document.querySelectorAll('iframe').length,scripts:document.querySelectorAll('script[src]').length});
}catch(error){}
window.addEventListener('error',function(event){
  var el=event.target;
  if(el&&el!==window&&el.tagName){
    var src='';
    try{src=el.currentSrc||el.src||el.href||''}catch(error){}
    diag('resource-error',{tag:String(el.tagName),src:String(src).slice(-120)});
    return;
  }
  diag('uncaught-error',{message:String(event.message||'').slice(0,160),file:String(event.filename||'').slice(-90),line:event.lineno||0});
},true);
try{
  var nativeFetchDiag=window.fetch;
  if(typeof nativeFetchDiag==='function')window.fetch=function(input,init){
    var label=typeof input==='string'?input:(input&&input.url)||'';
    return nativeFetchDiag.apply(this,arguments).then(function(response){
      if(response&&!response.ok)diag('fetch-status',{url:String(label).slice(-120),status:response.status});
      return response;
    },function(error){
      diag('fetch-failed',{url:String(label).slice(-120),error:String((error&&error.message)||error).slice(0,90)});
      throw error;
    });
  }
}catch(error){}
try{
  var nativeOpenDiag=XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open=function(method,url){
    var result=nativeOpenDiag.apply(this,arguments);
    try{
      this.addEventListener('loadend',function(){
        if(this.status>=400||this.status===0)diag('xhr-status',{url:String(url).slice(-120),status:this.status});
      });
    }catch(error){}
    return result;
  };
}catch(error){}
function unityState(){
  var canvas=null;
  try{canvas=document.getElementById('unity-canvas')}catch(error){return null}
  if(!canvas)return null;
  var scripts=[];
  try{
    var list=document.querySelectorAll('script[src]');
    for(var i=0;i<list.length&&i<8;i++)scripts.push(String(list[i].getAttribute('src')).slice(-46));
  }catch(error){}
  return {canvas:[canvas.width,canvas.height],engine:typeof window.createUnityInstance,scripts:scripts,ready:document.readyState};
}
setTimeout(function(){
  var state=unityState();
  if(state)diag(state.engine==='undefined'?'unity-stall':'unity-engine',state);
},6000);
setTimeout(function(){
  var state=unityState();
  if(state)diag('unity-late',state);
},14000);
function isProxy(url){if(url.origin!==appOrigin)return false;var path=url.pathname;return path.indexOf('/api/web-proxy/')===0||path.indexOf('/api/poki-game/')===0||path.indexOf('/api/poki-play/')===0||path.indexOf('/api/poki-cdn/')===0}
function isGame(url){for(var i=0;i<gameHosts.length;i++)if(url.hostname===gameHosts[i])return true;return false}
// A game's address in the service worker's proxy. A game belongs there: the
// capability frame gives its document an opaque origin, and a page it copies
// into a frame resolves its own build scripts against the portal instead of
// the game, so the engine never starts.
function servicePath(href){
  var encoded='';
  for(var i=0;i<href.length;i++){encoded+=(i%2)?String.fromCharCode(href.charCodeAt(i)^2):href.charAt(i)}
  return '/service/'+encodeURIComponent(encoded)
}
// A frame holding a copied game document names its real address in its own
// base tag and loader. Replace the copy with a real load of that address.
function rescue(frame){
  var doc=null;
  try{doc=frame.contentWindow&&frame.contentWindow.document}catch(error){return}
  if(!doc)return;
  try{if(typeof frame.contentWindow.createUnityInstance!=='undefined')return}catch(error){}
  var canvas=null;
  try{canvas=doc.getElementById('unity-canvas')}catch(error){return}
  if(!canvas)return;
  var base=doc.querySelector('base[href]');
  if(!base||!base.getAttribute('href'))return;
  var loader=null;
  var list=doc.querySelectorAll('script[src]');
  for(var i=0;i<list.length;i++){if(/game\.loader\.js/.test(list[i].getAttribute('src')||'')){loader=list[i];break}}
  if(!loader)return;
  var href=base.getAttribute('href');
  if(href.charAt(href.length-1)!=='/')href+='/'
  var rel=loader.getAttribute('src')||'';
  while(rel.slice(0,2)==='./')rel=rel.slice(2);
  while(rel.charAt(0)==='/')rel=rel.slice(1);
  var address=href+rel;
  var path=servicePath(address);
  if(frame.getAttribute('src')===path)return;
  frame.setAttribute('src',path);
}
function play(url){
  if(!parentNav||moved)return false;
  moved=true;
  try{if(window.parent!==window){window.parent.postMessage({type:'stet:preview-navigate',url:url},'*');return true}}catch(error){moved=false;return false}
  window.location.href=url;return true;
}
function allowFrame(frame){
  if(!frame.hasAttribute('allowfullscreen'))frame.setAttribute('allowfullscreen','');
  var existingAllow=frame.getAttribute('allow')||'';
  var allowParts=existingAllow.split(';').map(function(part){return part.trim()}).filter(Boolean);
  var allowText=allowParts.join(';').toLowerCase();
  if(allowText.indexOf('fullscreen')<0)allowParts.push('fullscreen');
  if(allowText.indexOf('pointer-lock')<0)allowParts.push('pointer-lock');
  if(allowParts.join('; ')!==existingAllow)frame.setAttribute('allow',allowParts.join('; '));
  if(!frame.hasAttribute('sandbox'))return;
  // An opaque (sandboxed) document has Ink's own origin behind it, so the
  // allow-same-origin flag would hand the child a real origin it must not have,
  // and it is always dropped there. A document that already has a real origin
  // (the content host) is isolated from the app, and a child keeping the flag
  // shares only that origin. Camera-chat sites put their client in a sandboxed
  // child frame, and without this the child stays opaque, where every
  // getUserMedia call dies with an invalid security origin.
  var opaque=window.origin==='null';
  var needed=['allow-scripts','allow-forms','allow-pointer-lock','allow-popups','allow-modals','allow-downloads'];
  var flags=(frame.getAttribute('sandbox')||'').split(/\\s+/).filter(function(flag){return flag&&flag!=='allow-popups-to-escape-sandbox'&&(flag!=='allow-same-origin'||!opaque)});
  for(var i=0;i<needed.length;i++)if(flags.indexOf(needed[i])<0)flags.push(needed[i]);
  var nextSandbox=flags.join(' ');
  if(frame.getAttribute('sandbox')!==nextSandbox)frame.setAttribute('sandbox',nextSandbox);
}
function fix(frame){
  if(!frame||frame.tagName!=='IFRAME')return;
  allowFrame(frame);
  var raw=frame.getAttribute('src')||'';
  if(!raw||/^(?:about:|data:|blob:|javascript:)/i.test(raw))return;
  var url;try{url=new URL(raw,document.baseURI)}catch(error){return}
  if(url.protocol!=='http:'&&url.protocol!=='https:')return;
  if(isProxy(url))return;
  // FreezeNova's pre.html is an ad wrapper; its sibling index.html is the
  // actual game. Start the game without waiting for the ad callback, and load
  // that real address through the service worker's proxy rather than the
  // capability frame, so the game document is the document the browser runs.
  var wrapper=url.pathname.slice(-9)==='/pre.html';
  if(wrapper)url.pathname=url.pathname.slice(0,-9)+'/index.html';
  var game=isGame(url);
  var target=(game&&gameStart?gameStart:proxy)+'?url='+encodeURIComponent(url.href);
  if(wrapper)target=servicePath(url.href);
  if(frame.getAttribute('src')===target)return;
  allowFrame(frame);
  if(game&&play(target))return;
  frame.setAttribute('src',target);
}
function scan(root){
  if(!root||root.nodeType!==1)return;
  if(root.tagName==='IFRAME')fix(root);
  if(root.querySelectorAll){var frames=root.querySelectorAll('iframe');for(var i=0;i<frames.length;i++)fix(frames[i]);}
}
try{new MutationObserver(function(records){
  for(var i=0;i<records.length;i++){
    var record=records[i];
    if(record.type==='attributes')fix(record.target);
    else for(var j=0;j<record.addedNodes.length;j++)scan(record.addedNodes[j]);
  }
}).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['src','sandbox']})}catch(error){}
document.addEventListener('DOMContentLoaded',function(){scan(document.documentElement)},{once:true});
scan(document.documentElement);
// A player that copied a game's HTML into its frame leaves an inert document:
// point the frame at the game's real address through the service worker.
setTimeout(function(){
  var frames=document.querySelectorAll('iframe');
  for(var i=0;i<frames.length;i++){try{rescue(frames[i])}catch(error){}}
},6000);
setTimeout(function(){
  var frames=document.querySelectorAll('iframe');
  for(var i=0;i<frames.length;i++){try{rescue(frames[i])}catch(error){}}
},11000);
// Some game wrappers keep a deferred iframe empty while an ad callback is
// outstanding. Start the real frame if the site has not done so in time.
setTimeout(function(){
  var frames=document.querySelectorAll('iframe[data-src]');
  for(var i=0;i<frames.length;i++){
    var frame=frames[i];
    if(frame.getAttribute('src'))continue;
    var raw=frame.getAttribute('data-src')||'';
    if(!raw||/^(?:about:|data:|blob:|javascript:)/i.test(raw))continue;
    var deferred;try{deferred=new URL(raw,document.baseURI)}catch(error){continue}
    if(deferred.protocol!=='http:'&&deferred.protocol!=='https:')continue;
    var wasWrapper=deferred.pathname.slice(-9)==='/pre.html';
    if(wasWrapper)deferred.pathname=deferred.pathname.slice(0,-9)+'/index.html';
    var deferredTarget=(isGame(deferred)&&gameStart?gameStart:proxy)+'?url='+encodeURIComponent(deferred.href);
    if(wasWrapper)deferredTarget=servicePath(deferred.href);
    frame.setAttribute('src',deferredTarget);
    frame.style.pointerEvents='auto';
    allowFrame(frame);
  }
},4500);
})()</script>`
  if (/<head(?:\s[^>]*)?>/i.test(html)) return html.replace(/<head(?:\s[^>]*)?>/i, (head) => `${head}${script}`)
  if (/<html(?:\s[^>]*)?>/i.test(html)) return html.replace(/<html(?:\s[^>]*)?>/i, (root) => `${root}<head>${script}</head>`)
  return `${script}${html}`
}

/**
 * Keep links inside the site on the proxy so the preview does not navigate to
 * an address that refuses to be framed. Cross-origin links still leave the
 * preview; forms are disabled because this route is read-only.
 */
function addNavigation(html: string, origin: string, proxyUrl: string, parentNavigation = false): string {
  // Use the absolute proxy URL: the document path is made to look like the
  // original site so client-side routers do not treat the preview as their 404.
  // Embedded previews let the parent page change the frame's src, which keeps
  // sandboxed frame navigation and Codespaces-forwarded ports from swallowing
  // link and game clicks. Direct previews keep navigating themselves.
  const navigate = parentNavigation
    ? `function go(url){try{if(window.parent!==window){window.parent.postMessage({type:'stet:preview-navigate',url:url},'*');return}}catch(error){}window.location.href=url}`
    : `function go(url){window.location.href=url}`
  const script = `<script>(function(){
var proxy=${JSON.stringify(proxyUrl)};
var origin=${JSON.stringify(origin)};
var appOrigin=new URL(proxy).origin;
var nativeOpen=window.open;
// The parent focuses this frame after load, but a cross-origin frame's inner
// document does not automatically focus its own search box. Let the parent ask
// the page to focus the obvious search field so typing works immediately.
window.addEventListener('message',function(event){
  if(!event.data||event.data.type!=='stet:focus-search')return;
  var field=document.querySelector('input[name="q"],textarea[name="q"],input[type="search"],input[role="combobox"],textarea[role="combobox"]');
  if(!field)return;
  try{field.focus();if(typeof field.select==='function')field.select()}catch(error){}
});
${navigate}
function isHttp(url){return url.protocol==='http:'||url.protocol==='https:'}
function isProxy(url){return url.href===proxy||url.href.indexOf(proxy+'?')===0}
// Everything a page loads has to come back through the capability route. The
// document's own tags are rewritten on the server, but ad loaders, analytics
// and anti-block probes build fresh <script>/<img>/<link> elements at runtime
// with absolute addresses; those used to leave the browser and reach the site's
// real domain, which is exactly what a network filter sees and blocks.
var proxyPath=new URL(proxy).pathname;
function rewriteAsset(value){
  var url;try{url=new URL(String(value),document.baseURI)}catch(error){return null}
  if(url.protocol!=='http:'&&url.protocol!=='https:')return null;
  if(url.pathname.indexOf(proxyPath)===0)return null;
  if(url.origin===appOrigin)url=new URL(url.pathname+url.search,origin);
  return proxy+'/p/'+url.protocol.slice(0,-1)+'/'+url.host+url.pathname+(url.search?'?q='+encodeURIComponent(url.search.slice(1)):'');
}
function patchProperty(ctor,prop){
  try{
    var desc=Object.getOwnPropertyDescriptor(ctor.prototype,prop);
    if(!desc||!desc.set)return;
    Object.defineProperty(ctor.prototype,prop,{configurable:true,enumerable:desc.enumerable,get:desc.get,set:function(value){
      var next=rewriteAsset(value);
      return desc.set.call(this,next==null?value:next);
    }});
  }catch(error){}
}
patchProperty(window.HTMLScriptElement,'src');
patchProperty(window.HTMLImageElement,'src');
patchProperty(window.HTMLIFrameElement,'src');
patchProperty(window.HTMLMediaElement,'src');
patchProperty(window.HTMLSourceElement,'src');
patchProperty(window.HTMLEmbedElement,'src');
patchProperty(window.HTMLLinkElement,'href');
try{
  var nativeSetAttribute=Element.prototype.setAttribute;
  Element.prototype.setAttribute=function(name,value){
    if(/^(?:src|href|data-src)$/i.test(name)&&typeof value==='string'){
      var next=rewriteAsset(value);
      if(next!=null)value=next;
    }
    return nativeSetAttribute.call(this,name,value);
  };
}catch(error){}
// Markup the page renders through innerHTML is parsed by the browser, which sets
// src attributes without going through the setters above. Sweep what lands in
// the document so those requests stay inside the proxy too.
function rewriteTree(node){
  if(!node||node.nodeType!==1)return;
  if(/^(?:IMG|SCRIPT|LINK|VIDEO|AUDIO|SOURCE|EMBED|IFRAME)$/.test(node.tagName)){
    ['src','href','data-src'].forEach(function(attr){
      if(!node.hasAttribute||!node.hasAttribute(attr))return;
      var next=rewriteAsset(node.getAttribute(attr));
      if(next!=null)nativeSetAttribute.call(node,attr,next);
    });
  }
  if(node.querySelectorAll){
    var list=node.querySelectorAll('img[src],script[src],link[href],video[src],audio[src],source[src],embed[src],iframe[src],[data-src]');
    for(var i=0;i<list.length;i++)rewriteTree(list[i]);
  }
}
try{
  new MutationObserver(function(records){
    for(var i=0;i<records.length;i++){
      var record=records[i];
      if(record.type==='attributes')rewriteTree(record.target);
      else for(var j=0;j<record.addedNodes.length;j++)rewriteTree(record.addedNodes[j]);
    }
  }).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['src','href','data-src']});
}catch(error){}
// A socket the page opens at its own host is addressed to the content host here,
// so it has to be pointed back at the site and tunnelled: a chat client that
// connects to wss://<site>/ws cannot otherwise reach its server from the proxy.
var NativeWebSocket=window.WebSocket;
if(NativeWebSocket){
  var wsProxy=proxy.replace(/^http/,'ws')+'/ws?url=';
  function rewriteSocket(value){
    var url;try{url=new URL(String(value),document.baseURI)}catch(error){return value}
    if(url.protocol!=='ws:'&&url.protocol!=='wss:')return value;
    if(url.pathname.indexOf(proxyPath)===0)return value;
    if(url.host===location.host){
      var base=origin.replace(/^https:/,'wss:').replace(/^http:/,'ws:');
      try{url=new URL(url.pathname+url.search,base)}catch(error){return value}
    }
    return wsProxy+encodeURIComponent(url.href);
  }
  var ProxyWebSocket=function(url,protocols){
    var target=rewriteSocket(url);
    if(protocols===undefined)return new NativeWebSocket(target);
    return new NativeWebSocket(target,protocols);
  };
  ProxyWebSocket.prototype=NativeWebSocket.prototype;
  ['CONNECTING','OPEN','CLOSING','CLOSED'].forEach(function(key){ProxyWebSocket[key]=NativeWebSocket[key]});
  window.WebSocket=ProxyWebSocket;
}
function open(url){
  if(!isHttp(url))return;
  // A capability URL is already inside the preview: go there. Returning here
  // used to swallow the preview's own search form, whose action is exactly
  // such a URL, so submitting it looked like nothing happened.
  if(isProxy(url)){go(url.href);return}
  var target=url;
  // A page that navigates to its own relative path resolves against the
  // preview's origin. Map that path back to the original site before proxying.
  if(target.origin===appOrigin)target=new URL(target.pathname+target.search+target.hash,origin);
  // Every public HTTP(S) destination stays behind the proxy, including a
  // Google search. The server resolves a Google query to its top result and
  // shows a sandboxed result card, so a search can never open a real tab.
  go(proxy+'?url='+encodeURIComponent(target.href));
}
// Poki and other sites launch games with window.open. Keep scripted popups on
// the proxy too, instead of letting the site escape to its own origin.
window.open=function(url){
  if(!url)return nativeOpen.apply(window,arguments);
  var next;try{next=new URL(url,document.baseURI)}catch(_){return nativeOpen.apply(window,arguments)}
  if(!isHttp(next)||isProxy(next))return nativeOpen.apply(window,arguments);
  open(next);
  return null;
};
window.addEventListener('click',function(event){
  var node=event.target;
  var link=node&&node.closest?node.closest('a[href]'):null;
  if(!link)return;
  var href=link.getAttribute('href');
  if(!href||href.charAt(0)==='#'||link.hasAttribute('download')||link.hasAttribute('data-stet-external'))return;
  var url;try{url=new URL(href,document.baseURI)}catch(_){return}
  if(!isHttp(url))return;
  event.preventDefault();event.stopPropagation();open(url);
},true);
window.addEventListener('click',function(event){
  var node=event.target;
  var button=node&&node.closest?node.closest('input[type="submit"],input[type="button"],button'):null;
  if(!button)return;
  var label=button.getAttribute('aria-label')||button.value||button.textContent||'';
  var isSearch=/^(?:google\s+)?search$/i.test(label.trim());
  var isSubmit=button.matches('input[type="submit"],button[type="submit"],button:not([type])');
  if(!isSubmit&&!isSearch)return;
  var form=button.form;
  if(!form&&isSearch){
    var forms=document.querySelectorAll('form');
    for(var i=0;i<forms.length;i++){
      if(forms[i].querySelector('input[name="q"],textarea[name="q"],input[type="search"]')){form=forms[i];break}
    }
  }
  if(form&&submit(form,button)){event.preventDefault();event.stopPropagation();}
},true);
window.addEventListener('keydown',function(event){
  if(event.key!=='Enter'||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;
  var node=event.target;
  var form=node&&(node.form||(node.closest&&node.closest('form')));
  if(!form)return;
  if(submit(form,node)){event.preventDefault();event.stopPropagation();}
},true);
function submit(form,submitter){
  if(!form)return false;
  var method=(form.getAttribute('method')||'get').toLowerCase();
  if(method!=='get')return false;
  var action;try{action=new URL(form.getAttribute('action')||document.URL,document.baseURI)}catch(_){return false}
  var data;try{data=new FormData(form,submitter)}catch(_){data=new FormData(form)}
  data.forEach(function(value,key){if(typeof value==='string')action.searchParams.append(key,value)});
  open(action);
  return true;
}
window.addEventListener('submit',function(event){
  event.preventDefault();event.stopPropagation();
  if(event.target&&event.target.tagName==='FORM')submit(event.target,event.submitter);
},true);
try{HTMLFormElement.prototype.submit=function(){submit(this,null)}}catch(error){}
function findSearchField(){
  var fields=document.querySelectorAll('input[name="q"],textarea[name="q"],input[type="search"],input[role="combobox"],textarea[role="combobox"]');
  for(var i=0;i<fields.length;i++){var value=fields[i].value;if(typeof value==='string'&&value.trim())return fields[i]}
  return null;
}
function openSiteSearch(field){
  if(!field)return false;
  var value=String(field.value||'').trim();
  if(!value)return false;
  var host;try{host=new URL(origin).hostname.replace(/^www\./i,'').toLowerCase()}catch(error){return false}
  if(!/^google\.[a-z.]+$/i.test(host))return false;
  var target;try{target=new URL('/search?q='+encodeURIComponent(value),origin)}catch(error){return false}
  open(target);return true;
}
// Google's search control is not a normal form submit; without this fallback
// its button appears to work but the query never reaches the proxy.
window.addEventListener('click',function(event){
  var node=event.target;
  var button=node&&node.closest?node.closest('button,input[type="button"],input[type="submit"]'):null;
  if(!button)return;
  var label=button.getAttribute('aria-label')||button.value||button.textContent||'';
  if(!/^(?:google\s+)?search$/i.test(label.trim()))return;
  if(button.form)return;
  if(openSiteSearch(findSearchField())){event.preventDefault();event.stopPropagation();}
},true);
window.addEventListener('keydown',function(event){
  if(event.key!=='Enter'||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;
  var node=event.target;
  var form=node&&(node.form||(node.closest&&node.closest('form')));
  if(form)return;
  if(openSiteSearch(findSearchField()||node)){event.preventDefault();event.stopPropagation();}
},true);
// Catch scripted location changes before
// the frame leaves the proxy. Chromium supports the Navigation API; the click
// and submit handlers above remain the fallback elsewhere.
if(window.navigation&&window.navigation.addEventListener){
  window.navigation.addEventListener('navigate',function(event){
    if(event.destination.sameDocument||event.downloadRequest||event.formData)return;
    var url;try{url=new URL(event.destination.url)}catch(_){return}
    if(!isHttp(url)||isProxy(url)||!event.cancelable)return;
    event.preventDefault();open(url);
  });
}
})()</script>`
  if (/<head(?:\s[^>]*)?>/i.test(html)) return html.replace(/<head(?:\s[^>]*)?>/i, (head) => `${head}${script}`)
  if (/<html(?:\s[^>]*)?>/i.test(html)) return html.replace(/<html(?:\s[^>]*)?>/i, (root) => `${root}<head>${script}</head>`)
  return `${script}${html}`
}

/**
 * Fullscreen is unreliable inside the preview's layered sandbox: some browsers
 * leave requestFullscreen() pending forever instead of rejecting it. Sites then
 * keep their game behind a button that looks dead. Keep the native request, but
 * if it does not settle, expand the target in the preview instead.
 */
function addFullscreenFallback(html: string): string {
  const script = `<script>(function(){
if(window.__stetFullscreenFallback)return;
window.__stetFullscreenFallback=true;
var active=null,saved='',savedOverflow=null,exitButton=null,timer=null;
function removeExitButton(){if(exitButton&&exitButton.parentNode)exitButton.parentNode.removeChild(exitButton);exitButton=null}
function clearFaux(){
  if(!active)return;
  active.style.cssText=saved;
  if(savedOverflow!==null)document.documentElement.style.overflow=savedOverflow;
  active=null;saved='';removeExitButton();
}
function cleanup(){if(timer){clearTimeout(timer);timer=null}clearFaux()}
function exitFullscreen(){
  if(document.fullscreenElement&&document.exitFullscreen)try{document.exitFullscreen().catch(function(){})}catch(error){}
  cleanup();
}
function enter(element){
  if(active===element)return;
  clearFaux();
  active=element;saved=element.style.cssText;
  savedOverflow=document.documentElement.style.overflow;
  document.documentElement.style.overflow='hidden';
  element.style.cssText=saved+';position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;max-width:none!important;max-height:none!important;margin:0!important;z-index:2147483646!important;background:#000!important;';
  exitButton=document.createElement('button');
  exitButton.type='button';exitButton.textContent='Exit fullscreen';
  exitButton.setAttribute('aria-label','Exit fullscreen');
  exitButton.style.cssText='position:fixed;top:10px;right:10px;z-index:2147483647;padding:8px 10px;background:rgba(0,0,0,.72);color:#fff;border:1px solid rgba(255,255,255,.55);border-radius:6px;font:13px system-ui;cursor:pointer';
  exitButton.addEventListener('click',exitFullscreen);
  document.body.appendChild(exitButton);
  if(!window.__stetFullscreenEscape){
    window.__stetFullscreenEscape=true;
    document.addEventListener('keydown',function(event){if(event.key==='Escape')exitFullscreen()},true);
  }
}
var nativeRequest=Element.prototype.requestFullscreen||Element.prototype.webkitRequestFullscreen;
if(nativeRequest){
  Element.prototype.requestFullscreen=function(){
    var element=this,result;
    try{result=nativeRequest.call(element)}catch(error){enter(element);return Promise.resolve()}
    if(!result||typeof result.then!=='function')return result;
    return new Promise(function(resolve){
      var settled=false;
      function done(ok){if(settled)return;settled=true;if(timer){clearTimeout(timer);timer=null}if(!ok)enter(element);resolve()}
      result.then(function(){done(true)},function(){done(false)});
      timer=setTimeout(function(){if(!settled){if(document.fullscreenElement)done(true);else done(false)}},700);
    });
  };
  if(Element.prototype.webkitRequestFullscreen)Element.prototype.webkitRequestFullscreen=function(){return Element.prototype.requestFullscreen.call(this)};
}else{
  Element.prototype.requestFullscreen=function(){enter(this);return Promise.resolve()};
}
var nativeExit=document.exitFullscreen;
if(nativeExit)document.exitFullscreen=function(){
  cleanup();
  try{var result=nativeExit.apply(document,arguments);return result&&typeof result.catch==='function'?result.catch(function(){}):result}catch(error){return Promise.resolve()}
};
document.addEventListener('fullscreenchange',function(){if(document.fullscreenElement)clearFaux()});
})()</script>`
  if (/<head(?:\s[^>]*)?>/i.test(html)) return html.replace(/<head(?:\s[^>]*)?>/i, (head) => `${head}${script}`)
  if (/<html(?:\s[^>]*)?>/i.test(html)) return html.replace(/<html(?:\s[^>]*)?>/i, (root) => `${root}<head>${script}</head>`)
  return `${script}${html}`
}

/**
 * A live site can spend several seconds booting its own scripts, and until it
 * paints the sandboxed frame is blank. Show a quiet placeholder from the first
 * paint and remove it once the page has loaded (or after a cap, so a stalled ad
 * script cannot hide the site forever).
 */
function addLoadingState(html: string, host: string): string {
  const overlay = `<div id="stet-live-loading" role="status" aria-live="polite"><span class="stet-live-spinner" aria-hidden="true"></span><p>Loading <strong>${escapeHtml(host)}</strong>…</p></div>`
  const style = `<style>#stet-live-loading{position:fixed;inset:0;z-index:2147483647;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:#f6f4ef;color:#6f695f;font:14px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;transition:opacity .25s ease;pointer-events:none}#stet-live-loading p{margin:0}#stet-live-loading strong{color:#24221d;font-weight:600}#stet-live-loading.stet-live-done{opacity:0}#stet-live-loading.stet-live-done .stet-live-spinner{animation:none}.stet-live-spinner{width:22px;height:22px;border-radius:50%;border:2px solid #ddd6ca;border-top-color:#817b70;animation:stet-live-spin .8s linear infinite}@keyframes stet-live-spin{to{transform:rotate(360deg)}}</style>`
  const script = `<script>(function(){var done=false;function hide(){if(done)return;done=true;var el=document.getElementById('stet-live-loading');if(!el)return;el.classList.add('stet-live-done');setTimeout(function(){el.remove()},300)}window.addEventListener('load',function(){setTimeout(hide,350)},{once:true});setTimeout(hide,12000)})()</script>`
  let out = html
  if (/<body(?:\s[^>]*)?>/i.test(out)) out = out.replace(/<body(?:\s[^>]*)?>/i, (body) => `${body}${style}${overlay}`)
  else out = `${style}${overlay}${out}`
  if (/<\/body>/i.test(out)) return out.replace(/<\/body>/i, `${script}</body>`)
  return `${out}${script}`
}

/**
 * A proxied page's ad and tracker machinery is the one part that has no business
 * running here. It is what a network filter blocks by name, what turns a proxy
 * request into a retry loop, and what leaves a game shell spinning on its own
 * loader while fifteen ad frames fight over the main thread. The tags are
 * dropped before the page is rewritten; the page's own scripts are untouched.
 */
const AD_HOSTS = /(?:^|\.)(?:googlesyndication\.com|doubleclick\.net|googleadservices\.com|googletagmanager\.com|google-analytics\.com|adtrafficquality\.google|5gvci\.com|rtmark\.net|usrpubtrck\.com|rapidexchange\.com|bmwguide\.org)$/i

function isAdSource(src: string): boolean {
  try {
    return AD_HOSTS.test(new URL(src, 'https://ink.invalid').hostname)
  } catch {
    return false
  }
}

function stripAdMarkup(html: string): string {
  return html
    .replace(/<(script|iframe)\b[^>]*\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>[\s\S]*?<\/\1\s*>/gi, (tag, _name, dq, sq, bare) => {
      const src = dq ?? sq ?? bare ?? ''
      return isAdSource(src) ? '' : tag
    })
    .replace(/<(script|iframe)\b[^>]*\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*\/?>/gi, (tag, _name, dq, sq, bare) => {
      const src = dq ?? sq ?? bare ?? ''
      return isAdSource(src) ? '' : tag
    })
}

/**
 * FreezeNova's game pages inject a promo ad overlay while they are embedded.
 * The game is the page itself, so drop the ad loader and its wgplayer tag
 * without touching the Unity loader or canvas.
 */
function stripGameAdScripts(html: string): string {
  return html
    .replace(/<script\b[^>]*\bsrc\s*=\s*(?:"[^"]*\/assets\/promo\/[^"]*\.js[^"]*"|'[^']*\/assets\/promo\/[^']*\.js[^']*')[^>]*>\s*<\/script>/gi, '')
    .replace(/<script\b[^>]*>(?:(?!<\/script>)[\s\S])*universal\.wgplayer\.com(?:(?!<\/script>)[\s\S])*<\/script>/gi, '')
}

/**
 * Google's result page keeps reloading itself against the proxied location
 * when its scripts run, which turns one click into a navigation loop. The
 * basic results markup and its links are already in the document, so render
 * that and let the injected navigation shim handle clicks and the search form.
 */
function stripSearchScripts(html: string): string {
  // Google's own scripts fight the proxied location, so they go. The locally
  // served landing page's search wiring is marked and has to survive: without
  // it the search box is inert.
  return html
    .replace(/<script\b(?![^>]*data-ink-search)[^>]*>[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<script\b(?![^>]*data-ink-search)[^>]*\/>/gi, '')
}

/**
 * A page's own scripts fetch APIs and assets at runtime. Those requests carry
 * the site's real origin, so from the preview they are cross-origin and fail
 * CORS. Route every public HTTP(S) request through the capability proxy, not
 * just same-site calls, so third-party game and API hosts stay behind the
 * preview origin as well.
 */
function addNetworkShim(html: string, proxyUrl: string, siteOrigin: string): string {
  const script = `<script>(function(){
var proxy=${JSON.stringify(proxyUrl)};
var siteOrigin=${JSON.stringify(siteOrigin)};
var appOrigin=new URL(proxy).origin;
function proxied(raw){
  var url;try{url=new URL(raw,document.baseURI)}catch(error){return raw}
  if(url.protocol!=='http:'&&url.protocol!=='https:')return raw;
  // Cloudflare's /cdn-cgi/ runtime and the challenge vendors' own endpoints stay
  // on their real origin. Routed through the gateway they arrive with Ink's
  // Origin and no credentials, which is exactly what a challenge refuses.
  var ch=url.hostname.toLowerCase(),cp=url.pathname.toLowerCase();
  if(cp.indexOf('/cdn-cgi/')===0)return raw;
  if(ch==='challenges.cloudflare.com')return raw;
  if(ch==='hcaptcha.com'||ch.slice(-12)==='.hcaptcha.com')return raw;
  if(ch==='recaptcha.net'||ch.slice(-12)==='.recaptcha.net')return raw;
  if(ch==='recaptcha.google.com')return raw;
  if((ch==='www.google.com'||ch==='www.gstatic.com')&&cp.indexOf('/recaptcha')===0)return raw;
  if(url.origin===appOrigin&&(url.pathname.indexOf('/api/web-proxy/')===0||url.pathname.indexOf('/api/poki-game/')===0||url.pathname.indexOf('/api/poki-play/')===0||url.pathname.indexOf('/api/poki-cdn/')===0))return raw;
  if(url.origin===appOrigin)url=new URL(url.pathname+url.search+url.hash,siteOrigin);
  return proxy+'/net?url='+encodeURIComponent(url.href);
}
// This document runs in a sandbox, so its origin is opaque ("null") and even a
// call to the gateway is cross-origin. A credentialed cross-origin request
// cannot be answered with 'access-control-allow-origin: *', so one failure in
// the site's own auth check broke its boot, leaving games on their loader.
// Browser credentials are pointless here: this token's cookies are kept in a
// server-side jar and the gateway attaches them to each upstream request.
function uncredentialed(init){
  var next={};
  if(init)for(var key in init)next[key]=init[key];
  next.credentials='omit';
  return next;
}
var nativeFetch=window.fetch;
if(typeof nativeFetch==='function'){
  window.fetch=function(input,init){
    try{
      if(typeof input==='string'||input instanceof URL)return nativeFetch.call(this,proxied(String(input)),uncredentialed(init));
      if(input&&typeof input.url==='string'){
        var next=proxied(input.url);
        if(next!==input.url)return nativeFetch.call(this,new Request(next,input),uncredentialed(init));
      }
    }catch(error){}
    return nativeFetch.apply(this,arguments);
  };
}
try{
  var nativeOpen=XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open=function(method,url){
    var args=Array.prototype.slice.call(arguments);
    args[1]=proxied(url);
    var result=nativeOpen.apply(this,args);
    try{this.withCredentials=false}catch(error){}
    return result;
  };
}catch(error){}
try{
  var nativeBeacon=navigator.sendBeacon;
  if(typeof nativeBeacon==='function')navigator.sendBeacon=function(url,data){return nativeBeacon.call(navigator,proxied(url),data)};
}catch(error){}
// Poki's thumbnails, fonts and SDK files load from Poki hostnames, and its app
// builds most of those tags at runtime. A filtered network blocks them by name
// even though the page itself is proxied, so every Poki-family URL is pointed
// at this origin's asset route as the element appears.
var pokiHost=/(^|\.)poki\.(?:com|io)$|(^|\.)poki-cdn\.com$/i;
function pokiAsset(raw){
  var url;try{url=new URL(raw,document.baseURI)}catch(error){return raw}
  if(url.protocol!=='http:'&&url.protocol!=='https:')return raw;
  if(!pokiHost.test(url.hostname))return raw;
  if(url.origin===appOrigin&&url.pathname.indexOf('/api/poki-cdn/')===0)return raw;
  // Absolute on the app origin: the page's own <base> would otherwise send a
  // root-relative path back to the site's host and the rewrite would repeat.
  return appOrigin+'/api/poki-cdn/'+url.hostname+url.pathname+url.search;
}
function rewritePokiNode(root){
  if(!root||root.nodeType!==1)return;
  var list=[root];
  try{if(root.querySelectorAll)list=list.concat(Array.prototype.slice.call(root.querySelectorAll('img,source,link'))) }catch(error){}
  for(var i=0;i<list.length;i++){
    var el=list[i];
    if(!el.getAttribute)continue;
    var src=el.getAttribute('src');
    if(src){var next=pokiAsset(src);if(next!==src)el.setAttribute('src',next)}
    if(el.tagName==='LINK'){var href=el.getAttribute('href');if(href){var out=pokiAsset(href);if(out!==href)el.setAttribute('href',out)}}
    var srcset=el.getAttribute('srcset');
    if(srcset){
      var parts=srcset.split(',');
      for(var j=0;j<parts.length;j++){var bits=parts[j].trim().split(/\\s+/);if(bits[0])bits[0]=pokiAsset(bits[0]);parts[j]=bits.join(' ')}
      var joined=parts.join(', ');
      if(joined!==srcset)el.setAttribute('srcset',joined);
    }
  }
}
try{
  new MutationObserver(function(records){
    for(var i=0;i<records.length;i++){
      var record=records[i];
      if(record.type==='attributes')rewritePokiNode(record.target);
      else for(var j=0;j<record.addedNodes.length;j++)rewritePokiNode(record.addedNodes[j]);
    }
  }).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['src','srcset','href']});
  document.addEventListener('DOMContentLoaded',function(){rewritePokiNode(document.documentElement)},{once:true});
  rewritePokiNode(document.documentElement);
}catch(error){}
})()</script>`
  if (/<head(?:\s[^>]*)?>/i.test(html)) return html.replace(/<head(?:\s[^>]*)?>/i, (head) => `${head}${script}`)
  if (/<html(?:\s[^>]*)?>/i.test(html)) return html.replace(/<html(?:\s[^>]*)?>/i, (root) => `${root}<head>${script}</head>`)
  return `${script}${html}`
}

/** Keep the site's path on the proxy origin without shadowing native storage. */
function addHistoryShim(html: string, historyUrl: string): string {
  const shim = `<script>try{history.replaceState(history.state,'',${JSON.stringify(historyUrl)})}catch(error){}</script>`
  if (/<head(?:\s[^>]*)?>/i.test(html)) return html.replace(/<head(?:\s[^>]*)?>/i, (head) => `${head}${shim}`)
  if (/<html(?:\s[^>]*)?>/i.test(html)) return html.replace(/<html(?:\s[^>]*)?>/i, (root) => `${root}<head>${shim}</head>`)
  return `${shim}${html}`
}

/**
 * A bot-check interstitial (Cloudflare's "Just a moment…", an hCaptcha or
 * reCAPTCHA challenge page) is not a page the proxy can render past: the check is
 * bound to the site's own hostname and to a cookie/nonce set on it, while the
 * proxied document is sandboxed with an opaque origin and none of that site's
 * storage. Detect it so the frame can explain itself instead of spinning on a
 * widget that can never complete here.
 */
export function isChallengeWall(html: string): boolean {
  const head = html.slice(0, 80_000)
  if (/\/cdn-cgi\/challenge-platform|__cf_chl|cf_chl_opt|cf_chl_jschl_tk/i.test(head)) return true
  if (/\bid=["']challenge-(form|stage|body|running)["']/i.test(head)) return true
  if (/Just a moment\.\.\./i.test(head) && /cloudflare|challenge|verify you are human/i.test(head)) return true
  // Turnstile embedded in a normal page (api.js plus a widget div) is not a wall:
  // the page itself is fine and only the widget is origin-bound.
  return false
}

export function renderChallengePage(target: string): string {
  let display = target
  try { display = new URL(target).host } catch { /* keep the raw string */ }
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Verification wall</title><style>
:root{color-scheme:light}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f6f4ef;color:#24221d;font:15px/1.6 system-ui,-apple-system,Segoe UI,sans-serif;padding:32px}
main{max-width:640px}h1{font-size:22px;line-height:1.3;margin:0 0 12px}.eyebrow{margin:0 0 6px;font-size:12px;letter-spacing:.09em;text-transform:uppercase;color:#817b70}
p{margin:0 0 12px}.host{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:#eae6dc;padding:2px 6px;border-radius:4px}
.note{margin-top:18px;padding:12px 14px;border-left:3px solid #c9b98a;background:#fbf9f3;border-radius:0 6px 6px 0;color:#4a463e;font-size:14px}
</style></head><body><main><p class="eyebrow">Verification wall</p><h1>This page needs a human check that a proxy cannot pass</h1><p><span class="host">${escapeHtml(display)}</span> answered with a bot check (Cloudflare Turnstile, hCaptcha or reCAPTCHA) instead of the page.</p><p>That check is bound to the site's own address and to a cookie set on it. Ink shows the page from its own origin, sandboxed, with none of that site's storage - so the challenge can never complete here. It spins, or leaves an empty box.</p><div class="note"><p><strong>What works:</strong> open the site in a normal browser tab, where the check has the origin and cookie it expects. Ink passes pages through; it does not complete site verifications, and working around one would be defeating the site's own bot control.</p><p>This is not a network block and not a bug in the proxy.</p></div></main></body></html>`
}

export function renderProxyPage(
  html: string,
  finalUrl: string,
  proxyUrl: string,
  parentNavigation = false,
  nativeStorage = false,
): string {
  const target = new URL(finalUrl)
  const origin = target.origin
  const base = new URL('.', finalUrl).href
  const app = new URL(proxyUrl)
  // Give the page the path it expects while keeping its real location on the
  // proxy origin. A router that reads window.location.pathname then resolves
  // the right route instead of showing its own not-found page.
  const historyUrl = new URL(`${target.pathname}${target.search}`, app.origin).href
  const searchPage = Boolean(googleSearchQuery(finalUrl))
  // Google's home/search scripts fight the proxied location and are not needed
  // for the server-rendered search form. Other sites keep their own scripts.
  const googleHost = /^google\.[a-z.]+$/i.test(target.hostname.replace(/^www\./i, ''))
  const googleHome = googleHost && (target.pathname === '/' || target.pathname === '/webhp')
  const stripGoogleScripts = searchPage || googleHome
  const cleaned = stripAdMarkup(stripGameAdScripts(rootRelative(
    (stripGoogleScripts ? stripSearchScripts(html) : html)
      .replace(/<meta\b[^>]*http-equiv\s*=\s*["']?(?:content-security-policy|refresh)["']?[^>]*>/gi, '')
      .replace(/<base\b[^>]*>/gi, ''),
    origin,
  )))
  const withAssets = proxyAssetTags(cleaned, finalUrl, app.href)
  const based = addBase(withAssets, base)
  const withFullscreen = addFullscreenFallback(based)
  // The isolated preview origin has real storage, cookies and same-origin
  // frames. Keep them native instead of shadowing them with memory shims.
  const withStorage = nativeStorage ? addHistoryShim(withFullscreen, historyUrl) : addSandboxShims(withFullscreen, historyUrl)
  const withNetwork = addNetworkShim(withStorage, proxyUrl, origin)
  const withNav = addNavigation(withNetwork, origin, app.href, parentNavigation)
  return addLoadingState(withNav, target.hostname.replace(/^www\./, ''))
}
