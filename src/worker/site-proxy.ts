// Live-site builds are fetched on the server and shown from Quill's origin.
// This is a real proxy, not a screenshot or replay: the page's own HTML and
// scripts run, isolated in a sandboxed iframe with no cookies or same-origin
// access. Only the HTML document is proxied; relative and root-relative assets
// are pointed back at the original site so they load from the real CDN.

const MAX_PAGE_BYTES = 3_000_000
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
    /(?:^|[\s(])((?:www\.)?(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+(?:com|org|net|io|dev|app|ai|co|gg|games|tv|xyz|site|online|store|shop|me|to|fm|us|uk|ca|de|fr|jp|au|in|edu|gov)(?:\/[^\s<>"'`]*)?)/i,
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
          'user-agent': 'Mozilla/5.0 (compatible; QuillLivePreview/1.0)',
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

/**
 * Keep links inside the site on the proxy so the preview does not navigate to
 * an address that refuses to be framed. Cross-origin links still leave the
 * preview; forms are disabled because this route is read-only.
 */
function addNavigation(html: string, origin: string, proxyUrl: string): string {
  // Use the absolute proxy URL: the document path is made to look like the
  // original site so client-side routers do not treat the preview as their 404.
  const script = `<script>(function(){var proxy=${JSON.stringify(proxyUrl)};var origin=${JSON.stringify(origin)};document.addEventListener('click',function(event){var node=event.target;var link=node&&node.closest?node.closest('a[href]'):null;if(!link)return;var href=link.getAttribute('href');if(!href||href.charAt(0)==='#')return;var url;try{url=new URL(href,document.baseURI)}catch(_){return}if(url.origin!==origin)return;event.preventDefault();event.stopPropagation();window.location.href=proxy+'?url='+encodeURIComponent(url.href)},true);document.addEventListener('submit',function(event){event.preventDefault()},true)})()</script>`
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${script}</body>`)
  return `${html}${script}`
}

export function renderProxyPage(html: string, finalUrl: string, proxyUrl: string): string {
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
      .replace(/<meta\b[^>]*http-equiv\s*=\s*["']?\s*(?:content-security-policy|refresh)\s*["']?[^>]*>/gi, '')
      .replace(/<base\b[^>]*>/gi, ''),
    origin,
  )
  return addNavigation(addSandboxShims(addBase(cleaned, base), historyUrl), origin, app.href)
}
