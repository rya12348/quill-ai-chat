// Live-site builds are fetched on the server and shown from Quill's origin.
// This is a real proxy, not a screenshot or replay: the page's own HTML and
// scripts run, isolated in a sandboxed iframe with no cookies or same-origin
// access. Only the HTML document is proxied; relative and root-relative assets
// are pointed back at the original site so they load from the real CDN.

const MAX_PAGE_BYTES = 3_000_000
const MAX_ASSET_BYTES = 8_000_000
const MAX_REDIRECTS = 5
const FETCH_TIMEOUT = 20_000
const PROXY_TOKEN = /^[a-f0-9]{48}$/
const HTML_TYPE = /text\/html|application\/xhtml\+xml/i
const PRIVATE_HOST = /^(?:localhost|.*\.localhost|.*\.local|.*\.internal)$/i
const TRANSIENT_REDIRECTS = new Set([301, 302, 303, 307, 308])

export class SiteError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'SiteError'
  }
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
  let engine = 'the search engine'
  let action = 'https://www.google.com/search'
  try {
    const url = new URL(searchUrl)
    engine = url.hostname.replace(/^www\./i, '')
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
    : '<li><p>No top result was returned. Try another search.</p></li>'
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(query)} · Google top result</title><style>
body{margin:0;font:16px/1.6 system-ui,-apple-system,Segoe UI,sans-serif;background:#f6f4ef;color:#24221d}
main{max-width:760px;margin:0 auto;padding:38px 24px 64px}.eyebrow{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#817b70;margin:0 0 10px}
h1{font-size:clamp(2rem,6vw,3.4rem);line-height:1.02;letter-spacing:-.04em;margin:0 0 12px}.lede{max-width:620px;color:#6f695f;margin:0 0 18px}
form{display:flex;gap:8px;max-width:580px;margin:0 0 28px}input{flex:1;min-width:0;border:1px solid #d8d1c4;border-radius:10px;padding:10px 12px;font:inherit;background:#fffdf8;color:inherit}button{border:0;border-radius:10px;padding:10px 16px;font:inherit;font-weight:600;background:#24221d;color:#fffdf8;cursor:pointer}
ol{list-style:none;margin:0;padding:0;display:grid;gap:12px}li{border:1px solid #e4ded2;border-radius:14px;background:#fffdf8;padding:16px 18px}li p{margin:0 0 6px;color:#6f695f;font-size:14px}li p.meta{color:#9a9386;font-size:11px;letter-spacing:.04em;text-transform:uppercase}
li h2{font-size:18px;line-height:1.25;margin:0 0 6px;letter-spacing:-.01em}a{color:#157a55;text-decoration-thickness:1px;text-underline-offset:2px}.escape{margin:26px 0 0;font-size:13px;color:#817b70}
</style></head><body><main><header><p class="eyebrow">Google top result</p><h1>${escapeHtml(query)}</h1><p class="lede">${results.length ? `${escapeHtml(engine)} selected this top result. Google's full results page needs its own cookies and JavaScript, so this result opens inside the preview instead.` : `${escapeHtml(engine)} did not return a top result. Try another search.`}</p></header><form action="${escapeHtml(action)}" method="get"><input name="q" value="${escapeHtml(query)}" aria-label="Search again"><button type="submit">Search</button></form><ol>${items}</ol></main></body></html>`
}

function privateHost(hostname: string): boolean {
  let host = hostname.toLowerCase()
  if (host.startsWith('[') && host.endsWith(']')) host = host.slice(1, -1)
  if (!host || PRIVATE_HOST.test(host)) return true
  if (host.includes(':')) {
    return (
      host === '::' ||
      host === '::1' ||
      host.startsWith('fc') ||
      host.startsWith('fd') ||
      host.startsWith('fe8') ||
      host.startsWith('fe9') ||
      host.startsWith('fea') ||
      host.startsWith('feb') ||
      host.startsWith('::ffff:')
    )
  }
  if (/^[0-9.]+$/.test(host)) {
    const parts = host.split('.')
    if (parts.length !== 4 || parts.some((part) => !/^\d+$/.test(part) || Number(part) > 255)) return true
    const first = Number(parts[0])
    const second = Number(parts[1])
    return (
      first === 0 ||
      first === 10 ||
      first === 127 ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168)
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

export async function fetchSiteAsset(target: string, abort?: AbortSignal): Promise<SiteAsset> {
  let current = normalizeSiteUrl(target)
  if (!current) throw new SiteError(400, 'That asset is not on a public website.')
  const signal = abort ? AbortSignal.any([abort, AbortSignal.timeout(FETCH_TIMEOUT)]) : AbortSignal.timeout(FETCH_TIMEOUT)
  try {
    for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
      const response = await fetch(current, {
        redirect: 'manual',
        signal,
        headers: {
          accept: '*/*',
          'accept-language': 'en-US,en;q=0.9',
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        },
      })
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
  'host',
  'keep-alive',
  'origin',
  'proxy-authorization',
  'proxy-connection',
  'referer',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
])

export async function fetchSiteRequest(target: string, request: Request): Promise<SiteResponse> {
  const next = normalizeSiteUrl(target)
  if (!next) throw new SiteError(400, 'That address is not on a public website.')
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
  const method = request.method.toUpperCase()
  const body = method === 'GET' || method === 'HEAD' ? undefined : await request.arrayBuffer()
  if (body && body.byteLength > MAX_ASSET_BYTES) throw new SiteError(413, 'That request is too large to preview.')
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(FETCH_TIMEOUT)])
  let response: Response
  try {
    response = await fetch(next, { method, headers, body, redirect: 'follow', signal })
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') throw new SiteError(504, 'That request took too long.')
    throw new SiteError(502, 'That request could not be completed.')
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

function encodeText(text: string): ArrayBuffer {
  const bytes = new TextEncoder().encode(text)
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

/**
 * CSS root-relative url() references would otherwise resolve against Quill's
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
    const css = decoder.decode(body)
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
    const assetBase = `${proxyUrl.replace(/\/$/, '')}/p/${target.protocol.slice(0, -1)}/${target.host}/`
    // Vite's preload helper turns its map entries ("assets/...") into URLs
    // with `"/" + dep`. That resolves against the page's original <base>, so
    // patch the helper to make the URL absolute on the proxy origin instead.
    const js = decoder.decode(body).replace(
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

export async function fetchSitePage(target: string, abort?: AbortSignal): Promise<SitePage> {
  let current = normalizeSiteUrl(target)
  if (!current) throw new SiteError(400, 'That address is not a public website.')
  const signal = abort ? AbortSignal.any([abort, AbortSignal.timeout(FETCH_TIMEOUT)]) : AbortSignal.timeout(FETCH_TIMEOUT)
  try {
    for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
      const response = await fetch(current, {
        redirect: 'manual',
        signal,
        headers: {
          accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1',
          'accept-language': 'en-US,en;q=0.9',
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        },
      })
      if (TRANSIENT_REDIRECTS.has(response.status)) {
        const location = response.headers.get('location')
        await response.body?.cancel()
        if (!location) throw new SiteError(502, 'The site sent an incomplete redirect.')
        const next = normalizeSiteUrl(new URL(location, current).href)
        if (!next) throw new SiteError(400, 'The site redirected to a non-public address.')
        current = next
        continue
      }
      if (!response.ok) {
        await response.body?.cancel()
        throw new SiteError(502, `The site returned ${response.status}.`)
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

function proxyAssetTags(html: string, finalUrl: string, proxyUrl: string): string {
  return html.replace(/<(script|link)\b[^>]*>/gi, (tag: string, tagName: string) => {
    const name = tagName.toLowerCase()
    if (name === 'link') {
      const relMatch = /\brel\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag)
      const rel = (relMatch?.[1] ?? relMatch?.[2] ?? relMatch?.[3] ?? '').toLowerCase()
      if (!/(?:^|\s)(?:stylesheet|modulepreload|preload)(?:\s|$)/.test(rel)) return tag
    }
    const attribute = name === 'script' ? 'src' : 'href'
    const pattern = new RegExp(`(\\b${attribute}\\s*=\\s*)(["'])([^"']*)\\2`, 'i')
    return tag.replace(pattern, (match: string, prefix: string, quote: string, raw: string) => {
      if (!raw || /^(?:data:|blob:|javascript:|#)/i.test(raw)) return match
      let target: URL
      try {
        target = new URL(raw, finalUrl)
      } catch {
        return match
      }
      if (target.protocol !== 'http:' && target.protocol !== 'https:') return match
      const proxied = assetProxyPath(proxyUrl, target.href)
      return proxied ? `${prefix}${quote}${escapeHtml(proxied)}${quote}` : match
    })
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
 * run. Nothing is shared with Quill or with another proxied page.
 */
function addSandboxShims(html: string, historyUrl: string): string {
  const shim = `<script>(function(){
var cookies=new Map();
function readCookies(){var out=[];cookies.forEach(function(value,name){out.push(name+'='+value)});return out.join('; ')}
function writeCookie(value){var text=String(value);var pair=text.split(';')[0];var at=pair.indexOf('=');if(at<1)return;var name=pair.slice(0,at).trim();var data=pair.slice(at+1);var maxAge=/;\\s*max-age=(-?\\d+)/i.exec(text);var expires=/;\\s*expires=([^;]+)/i.exec(text);var expired=maxAge?Number(maxAge[1])<=0:expires?Date.parse(expires[1])<Date.now():false;if(!name)return;if(expired)cookies.delete(name);else cookies.set(name,data)}
try{Object.defineProperty(Document.prototype,'cookie',{configurable:true,enumerable:true,get:readCookies,set:writeCookie})}catch(error){}
function memoryStorage(){var values=new Map();return{getItem:function(key){key=String(key);return values.has(key)?values.get(key):null},setItem:function(key,value){values.set(String(key),String(value))},removeItem:function(key){values.delete(String(key))},clear:function(){values.clear()},key:function(index){var keys=Array.from(values.keys());return index>=0&&index<keys.length?keys[index]:null},get length(){return values.size}}}
try{Object.defineProperty(window,'localStorage',{configurable:true,value:memoryStorage()});Object.defineProperty(window,'sessionStorage',{configurable:true,value:memoryStorage()})}catch(error){}
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
  /** Codespaces needs the parent page to start a game navigation. */
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
function isProxy(url){return url.origin===appOrigin&&(url.pathname.indexOf('/api/web-proxy/')===0||url.pathname.indexOf('/api/poki-game/')===0)}
function isGame(url){for(var i=0;i<gameHosts.length;i++)if(url.hostname===gameHosts[i])return true;return false}
function play(url){
  if(!parentNav||moved)return false;
  moved=true;
  try{if(window.parent!==window){window.parent.postMessage({type:'quill:preview-navigate',url:url},'*');return true}}catch(error){moved=false;return false}
  window.location.href=url;return true;
}
function allowFrame(frame){
  if(!frame.hasAttribute('allowfullscreen'))frame.setAttribute('allowfullscreen','');
  var existingAllow=frame.getAttribute('allow')||'';
  var allowParts=existingAllow.split(';').map(function(part){return part.trim()}).filter(Boolean);
  var allowText=allowParts.join(';').toLowerCase();
  if(allowText.indexOf('fullscreen')<0)allowParts.push('fullscreen');
  if(allowParts.join('; ')!==existingAllow)frame.setAttribute('allow',allowParts.join('; '));
  if(!frame.hasAttribute('sandbox'))return;
  var needed=['allow-scripts','allow-forms','allow-pointer-lock','allow-popups','allow-modals','allow-downloads'];
  var flags=(frame.getAttribute('sandbox')||'').split(/\\s+/).filter(function(flag){return flag&&flag!=='allow-same-origin'&&flag!=='allow-popups-to-escape-sandbox'});
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
  var game=isGame(url);
  var target=(game&&gameStart?gameStart:proxy)+'?url='+encodeURIComponent(url.href);
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
  // A Codespaces-forwarded port will not authorise a navigation started inside
  // the preview's sandbox, so let the parent page change the frame's src with
  // the page's own credentials. Direct previews keep navigating themselves.
  const navigate = parentNavigation
    ? `function go(url){try{if(window.parent!==window){window.parent.postMessage({type:'quill:preview-navigate',url:url},'*');return}}catch(error){}window.location.href=url}`
    : `function go(url){window.location.href=url}`
  const script = `<script>(function(){
var proxy=${JSON.stringify(proxyUrl)};
var origin=${JSON.stringify(origin)};
var appOrigin=new URL(proxy).origin;
var nativeOpen=window.open;
${navigate}
function isHttp(url){return url.protocol==='http:'||url.protocol==='https:'}
function isProxy(url){return url.href===proxy||url.href.indexOf(proxy+'?')===0}
function open(url){
  if(!isHttp(url)||isProxy(url))return;
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
  if(!href||href.charAt(0)==='#'||link.hasAttribute('download')||link.hasAttribute('data-quill-external'))return;
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
if(window.__quillFullscreenFallback)return;
window.__quillFullscreenFallback=true;
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
  if(!window.__quillFullscreenEscape){
    window.__quillFullscreenEscape=true;
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
  const overlay = `<div id="quill-live-loading" role="status" aria-live="polite"><span class="quill-live-spinner" aria-hidden="true"></span><p>Loading <strong>${escapeHtml(host)}</strong>…</p></div>`
  const style = `<style>#quill-live-loading{position:fixed;inset:0;z-index:2147483647;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:#f6f4ef;color:#6f695f;font:14px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;transition:opacity .25s ease;pointer-events:none}#quill-live-loading p{margin:0}#quill-live-loading strong{color:#24221d;font-weight:600}#quill-live-loading.quill-live-done{opacity:0}#quill-live-loading.quill-live-done .quill-live-spinner{animation:none}.quill-live-spinner{width:22px;height:22px;border-radius:50%;border:2px solid #ddd6ca;border-top-color:#817b70;animation:quill-live-spin .8s linear infinite}@keyframes quill-live-spin{to{transform:rotate(360deg)}}</style>`
  const script = `<script>(function(){var done=false;function hide(){if(done)return;done=true;var el=document.getElementById('quill-live-loading');if(!el)return;el.classList.add('quill-live-done');setTimeout(function(){el.remove()},300)}window.addEventListener('load',function(){setTimeout(hide,350)},{once:true});setTimeout(hide,12000)})()</script>`
  let out = html
  if (/<body(?:\s[^>]*)?>/i.test(out)) out = out.replace(/<body(?:\s[^>]*)?>/i, (body) => `${body}${style}${overlay}`)
  else out = `${style}${overlay}${out}`
  if (/<\/body>/i.test(out)) return out.replace(/<\/body>/i, `${script}</body>`)
  return `${out}${script}`
}

/** Google's own scripts hijack search and navigate the card to a page that
 * refuses framing. Keep the static form; our injected script handles the rest. */
function stripGoogleScripts(html: string, origin: string): string {
  let host: string
  try {
    host = new URL(origin).hostname
  } catch {
    return html
  }
  if (!/(^|\.)google\.[a-z.]+$/i.test(host)) return html
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<script\b[^>]*\/>/gi, '')
}

/**
 * A page's own scripts fetch its APIs at runtime. Those requests carry the
 * site's real origin, so from the preview they are cross-origin and fail CORS.
 * Route same-site calls through the network proxy; leave third-party requests
 * untouched so their normal CORS rules still apply.
 */
function addNetworkShim(html: string, proxyUrl: string, siteOrigin: string): string {
  const script = `<script>(function(){
var proxy=${JSON.stringify(proxyUrl)};
var siteOrigin=${JSON.stringify(siteOrigin)};
var appOrigin=new URL(proxy).origin;
function proxied(raw){
  var url;try{url=new URL(raw,document.baseURI)}catch(error){return raw}
  if(url.protocol!=='http:'&&url.protocol!=='https:')return raw;
  if(url.pathname.indexOf('/api/web-proxy/')===0||url.pathname.indexOf('/api/poki-game/')===0)return raw;
  if(url.origin!==siteOrigin&&url.origin!==appOrigin)return raw;
  if(url.origin===appOrigin)url=new URL(url.pathname+url.search+url.hash,siteOrigin);
  return proxy+'/net?url='+encodeURIComponent(url.href);
}
var nativeFetch=window.fetch;
if(typeof nativeFetch==='function'){
  window.fetch=function(input,init){
    try{
      if(typeof input==='string'||input instanceof URL)return nativeFetch.call(this,proxied(String(input)),init);
      if(input&&typeof input.url==='string'){
        var next=proxied(input.url);
        if(next!==input.url)return nativeFetch.call(this,new Request(next,input),init);
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
    return nativeOpen.apply(this,args);
  };
}catch(error){}
try{
  var nativeBeacon=navigator.sendBeacon;
  if(typeof nativeBeacon==='function')navigator.sendBeacon=function(url,data){return nativeBeacon.call(navigator,proxied(url),data)};
}catch(error){}
})()</script>`
  if (/<head(?:\s[^>]*)?>/i.test(html)) return html.replace(/<head(?:\s[^>]*)?>/i, (head) => `${head}${script}`)
  if (/<html(?:\s[^>]*)?>/i.test(html)) return html.replace(/<html(?:\s[^>]*)?>/i, (root) => `${root}<head>${script}</head>`)
  return `${script}${html}`
}

/** Keep the site's path on the proxy origin without shadowing native storage. */
function addHistoryShim(html: string, historyUrl: string): string {
  const shim = `<script>try{history.replaceState(history.state,'',${JSON.stringify(historyUrl)})}catch(error){}</script>`
  if (/<head(?:s[^>]*)?>/i.test(html)) return html.replace(/<head(?:s[^>]*)?>/i, (head) => `${head}${shim}`)
  if (/<html(?:s[^>]*)?>/i.test(html)) return html.replace(/<html(?:s[^>]*)?>/i, (root) => `${root}<head>${shim}</head>`)
  return `${shim}${html}`
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
  const cleaned = rootRelative(
    html
      .replace(/<meta\b[^>]*http-equivs*=s*["']?s*(?:content-security-policy|refresh)s*["']?[^>]*>/gi, '')
      .replace(/<base\b[^>]*>/gi, ''),
    origin,
  )
  const withAssets = proxyAssetTags(stripGoogleScripts(cleaned, origin), finalUrl, app.href)
  const based = addBase(withAssets, base)
  const withFullscreen = addFullscreenFallback(based)
  // The isolated preview origin has real storage, cookies and same-origin
  // frames. Keep them native instead of shadowing them with memory shims.
  const withStorage = nativeStorage ? addHistoryShim(withFullscreen, historyUrl) : addSandboxShims(withFullscreen, historyUrl)
  const withNetwork = addNetworkShim(withStorage, proxyUrl, origin)
  return addLoadingState(
    addNavigation(withNetwork, origin, app.href, parentNavigation),
    target.hostname.replace(/^www\./, ''),
  )
}
