import { Hono } from 'hono'

import { privateJson } from '../auth'
import type { AppContext } from '../env'
import { normalizeSiteUrl } from '../site-proxy'

/**
 * The network gateway behind Ink's browser.
 *
 * The browser itself runs in this app's service worker (Ultraviolet), which
 * rewrites pages client-side. That is the part that makes it work for arbitrary
 * games: relative URLs, module imports, inline scripts, runtime API calls and
 * cookies are all handled the way a browser handles them, with no per-site
 * rule. A page still cannot reach another origin, so the service worker sends
 * each request here.
 *
 * This is a relay, not a rewriter. It forwards the method, headers and body to
 * a public address and returns the response untouched, including 3xx responses
 * (Ultraviolet resolves those itself) and streaming bodies.
 */

const MAX_REQUEST_BYTES = 40_000_000
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
const ALLOWED_METHODS = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'])

// Headers that describe this hop rather than the destination. `accept-encoding`
// is dropped so the runtime and the destination negotiate compression between
// themselves; the body leaves here already decoded.
const REQUEST_SKIP = new Set([
  'accept-encoding',
  'connection',
  'content-length',
  'host',
  'keep-alive',
  'proxy-authorization',
  'proxy-connection',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
])

// The body is streamed decoded, so an inherited length or encoding would be a
// lie. `connection`-scoped headers never apply to the next hop.
const RESPONSE_SKIP = new Set([
  'connection',
  'content-encoding',
  'content-length',
  'keep-alive',
  'proxy-authenticate',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  // Policies that describe the site's own origin, not the page this response is
  // rendered on. Relayed unchanged they break the proxied page: a CSP stops the
  // runtime's injected scripts (so no hooks are installed at all), a
  // `permissions-policy` or `feature-policy` can turn off fullscreen and the
  // gamepad, and `x-frame-options` stops a proxied game from loading in the
  // frame its portal builds. The page is served from Ink's origin, so the
  // origin's own policy is the one that should apply.
  'content-security-policy',
  'content-security-policy-report-only',
  'permissions-policy',
  'feature-policy',
  'x-frame-options',
  'cross-origin-embedder-policy',
  'cross-origin-embedder-policy-report-only',
  'cross-origin-opener-policy',
  'cross-origin-opener-policy-report-only',
  'cross-origin-resource-policy',
])

type BareHeaders = Record<string, string | string[]>

export const browserGateway = new Hono<AppContext>()

function readHeaderMap(raw: string | undefined): BareHeaders {
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(raw))
    return parsed && typeof parsed === 'object' ? (parsed as BareHeaders) : {}
  } catch {
    return {}
  }
}

function encodeHeaderMap(headers: BareHeaders): string {
  return encodeURIComponent(JSON.stringify(headers))
}

/**
 * A proxied page runs on Ink's origin, so the browser labels every request it
 * makes with Ink's own `origin` and a `/service/` `referer`. A site that checks
 * either one refuses a request its own page made: krillion's quota API answers
 * 403 to a foreign origin, which surfaced as "access beacon offline" and no
 * game. Rewrite those two headers to the address the browser would have sent
 * without the proxy; anything else is left alone.
 */
function useSiteOrigin(headers: Headers, target: string, appOrigin: string): void {
  const siteOrigin = new URL(target).origin
  const origin = headers.get('origin')
  if (origin && origin !== siteOrigin) headers.set('origin', siteOrigin)
  const referer = headers.get('referer')
  if (!referer) return
  try {
    if (new URL(referer).origin === appOrigin) headers.set('referer', `${siteOrigin}/`)
  } catch {
    headers.delete('referer')
  }
}

/** Copies one side's headers onto the other, dropping hop-by-hop fields. */
function forwardHeaders(source: BareHeaders, skip: Set<string>, extraSkip?: (name: string) => boolean): Headers {
  const headers = new Headers()
  for (const [name, value] of Object.entries(source)) {
    const key = name.toLowerCase()
    if (skip.has(key) || extraSkip?.(key)) continue
    if (Array.isArray(value)) {
      if (!value.length) continue
      headers.set(key, value.join(', '))
    } else if (typeof value === 'string') {
      headers.set(key, value)
    }
  }
  return headers
}

browserGateway.post('/request', async (c) => {
  const target = normalizeSiteUrl(c.req.header('x-ink-url') ?? '')
  if (!target) {
    return privateJson(c, { error: 'invalid_url', message: 'That address cannot be opened.' }, 400)
  }
  const method = (c.req.header('x-ink-method') ?? 'GET').toUpperCase()
  if (!ALLOWED_METHODS.has(method)) {
    return privateJson(c, { error: 'invalid_method', message: 'That request is not allowed.' }, 405)
  }

  const headers = forwardHeaders(readHeaderMap(c.req.header('x-ink-headers')), REQUEST_SKIP, (name) =>
    name.startsWith('x-ink-'),
  )
  // The browser's own User-Agent describes Chrome; keep it when the page sent
  // one, because sites sniff it, but never send Ink's.
  if (!headers.has('user-agent')) headers.set('user-agent', USER_AGENT)
  useSiteOrigin(headers, target, new URL(c.req.url).origin)
  // `origin` is a forbidden request header, so a service worker cannot read the
  // one the browser put on the page's request and never relays it. Supply the
  // site's own origin for a mutation, which is what the browser would have
  // sent without the proxy; krillion's quota API answers 403 without it.
  if (method !== 'GET' && method !== 'HEAD' && !headers.has('origin')) {
    headers.set('origin', new URL(target).origin)
  }

  const hasBody = method !== 'GET' && method !== 'HEAD'
  const length = Number(c.req.header('content-length') ?? '0')
  if (hasBody && length > MAX_REQUEST_BYTES) {
    return privateJson(c, { error: 'too_large', message: 'That upload is too large.' }, 413)
  }

  const init: RequestInit = {
    method,
    headers,
    redirect: 'manual',
    signal: c.req.raw.signal,
  }
  if (hasBody) {
    // Read the body first: forwarding a stream needs a length the runtime can
    // vouch for, and a form post here is small. The cap above bounds it.
    const body = await c.req.arrayBuffer()
    if (body.byteLength > MAX_REQUEST_BYTES) {
      return privateJson(c, { error: 'too_large', message: 'That upload is too large.' }, 413)
    }
    init.body = body
  }

  let response: Response
  try {
    response = await fetch(target, init)
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return privateJson(c, { error: 'aborted', message: 'That request was cancelled.' }, 499)
    }
    console.error('browser gateway:', error)
    return privateJson(c, { error: 'unreachable', message: `${new URL(target).hostname} could not be reached.` }, 502)
  }

  const returned: BareHeaders = {}
  for (const [name, value] of response.headers) {
    const key = name.toLowerCase()
    if (RESPONSE_SKIP.has(key) || key.startsWith('x-ink-')) continue
    returned[key] = value
  }
  // Cookies must stay separate: a joined Set-Cookie header is not parseable.
  const cookies = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : []
  if (cookies.length) returned['set-cookie'] = cookies

  const outgoing = new Headers({
    'content-type': 'application/octet-stream',
    'cache-control': 'no-store',
    'x-ink-status': String(response.status),
    'x-ink-status-text': response.statusText,
    'x-ink-headers': encodeHeaderMap(returned),
    // Redirects are not followed here (Ultraviolet resolves them), so this is
    // the address that was actually requested. A browser response always has
    // one, and the rewriter reads it when it names a download.
    'x-ink-final-url': encodeURIComponent(target),
  })
  return new Response(response.body, { status: 200, headers: outgoing })
})

/**
 * A proxied WebSocket. The worker opens the real connection to the destination
 * and pipes frames both ways, so a game's own socket server keeps working.
 *
 * The control frame carries the destination and its headers; everything after
 * that is opaque bytes. The destination's negotiated subprotocol is reported
 * back in the open frame, because the browser-side hop deliberately negotiates
 * none of its own.
 */
browserGateway.get('/socket', async (c) => {
  if (c.req.header('upgrade')?.toLowerCase() !== 'websocket') {
    return privateJson(c, { error: 'upgrade_required', message: 'This endpoint only accepts a WebSocket.' }, 426)
  }

  const pair = new WebSocketPair()
  const client = pair[0]
  const server = pair[1]
  server.accept()

  let upstream: WebSocket | null = null
  let released = false

  const fail = (message: string) => {
    try {
      server.send(JSON.stringify({ type: 'error', message }))
    } catch {
      /* the client is already gone */
    }
    try {
      server.close(1011, 'Proxy socket failed')
    } catch {
      /* already closed */
    }
  }

  const release = (code: number, reason: string) => {
    if (released) return
    released = true
    try {
      server.send(JSON.stringify({ type: 'close', code, reason }))
    } catch {
      /* the client is already gone */
    }
    try {
      upstream?.close(code, reason)
    } catch {
      /* already closed */
    }
  }

  const open = async (payload: Record<string, unknown>) => {
    if (upstream) return
    // A page asks for ws:// or wss://. The runtime opens sockets with a plain
    // fetch plus an Upgrade header, so the scheme has to be the HTTP one; the
    // address is still checked by the same guard as every other request.
    let socket = typeof payload.url === 'string' ? payload.url : ''
    try {
      const parsed = new URL(socket)
      if (parsed.protocol === 'wss:') parsed.protocol = 'https:'
      else if (parsed.protocol === 'ws:') parsed.protocol = 'http:'
      socket = parsed.href
    } catch {
      socket = ''
    }
    const target = normalizeSiteUrl(socket)
    if (!target) return fail('That socket address cannot be opened.')

    const headers = forwardHeaders(
      payload.headers && typeof payload.headers === 'object' ? (payload.headers as BareHeaders) : {},
      REQUEST_SKIP,
      (name) => name.startsWith('sec-websocket') || name.startsWith('x-ink-'),
    )
    headers.set('upgrade', 'websocket')
    headers.set('connection', 'Upgrade')
    if (!headers.has('user-agent')) headers.set('user-agent', USER_AGENT)
    useSiteOrigin(headers, target, new URL(c.req.url).origin)
    if (!headers.has('origin')) headers.set('origin', new URL(target).origin)
    if (Array.isArray(payload.protocols) && payload.protocols.length) {
      headers.set(
        'sec-websocket-protocol',
        payload.protocols.filter((value): value is string => typeof value === 'string').join(', '),
      )
    }

    let response: Response
    try {
      response = await fetch(target, { method: 'GET', headers, redirect: 'manual' })
    } catch (error) {
      console.error('browser gateway socket:', error)
      return fail(`${new URL(target).hostname} could not be reached.`)
    }

    const remote = response.webSocket
    if (!remote) return fail(`${new URL(target).hostname} refused the socket.`)
    remote.accept()
    upstream = remote

    remote.addEventListener('message', (event: MessageEvent) => {
      try {
        server.send((event as MessageEvent & { data: string | ArrayBuffer }).data)
      } catch {
        release(1011, 'Client closed')
      }
    })
    remote.addEventListener('close', (event: CloseEvent) => release(event.code || 1000, event.reason || ''))
    remote.addEventListener('error', () => fail('The socket closed unexpectedly.'))

    try {
      server.send(JSON.stringify({ type: 'open', protocol: response.headers.get('sec-websocket-protocol') ?? '' }))
    } catch {
      release(1000, '')
    }
  }

  server.addEventListener('message', (event: MessageEvent) => {
    const data = (event as MessageEvent & { data: string | ArrayBuffer }).data
    if (typeof data === 'string') {
      let message: { type?: unknown } & Record<string, unknown>
      try {
        message = JSON.parse(data) as { type?: unknown } & Record<string, unknown>
      } catch {
        return
      }
      if (message.type === 'open') void open(message)
      return
    }
    try {
      upstream?.send(data)
    } catch {
      release(1011, 'Upstream closed')
    }
  })

  server.addEventListener('close', () => release(1000, ''))

  return new Response(null, { status: 101, webSocket: client })
})
