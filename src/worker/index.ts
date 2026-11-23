import { Hono } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'

import { aiConfigured } from './ai'
import { migrateAttachmentObjects } from './attachment-storage'
import {
  allowsMutation,
  appOrigin,
  authMode,
  getAuth,
  GUEST_COOKIE,
  isCodespacesRequest,
  isDeploymentOwner,
  isGuestId,
  requireUser,
} from './auth'
import { ensureSchema, requireDb } from './db'
import { publicLanes } from './public-ai'
import { RATE_WINDOWS, rateLimit, tooManyRequests } from './rate-limit'
import { sandboxConfigured } from './sandbox'
import { BUILD_STAMP } from '../shared/build-stamp'
import type { AppContext, Env } from './env'
import { findPokiGameWrapper, installPokiAutostart, isPokiAssetHost, isPokiGameId, isPokiGameWrapperUrl, isPokiPage, isSafeGameSegment, pokiGameFromPage, pokiGamePublicPath, pokiGameWrapperResponse, proxyPokiCdnAsset, proxyPokiGameAsset, rewritePokiUrls } from './poki-game'
import { serviceFallbackResponse } from './service-fallback'
import { fetchSitePage, fetchSiteStream, fetchWebSearchResults, googleSearchQuery, googleTopResult, installFrameBridge, isChallengeWall, isWebProxyToken, normalizeSiteUrl, renderChallengePage, renderProxyErrorPage, renderProxyPage, renderSearchResults, resolveProxyTarget, rewriteAssetContent, SiteError, webProxyPath } from './site-proxy'
import { account } from './routes/account'
import { analytics } from './routes/analytics'
import { analysis } from './routes/analysis'
import { artifacts } from './routes/artifacts'
import { attachments } from './routes/attachments'
import { browser } from './routes/browser'
import { browserGateway } from './routes/browser-gateway'
import { buffy } from './routes/buffy'
import { butter } from './routes/butter'
import { butterDive } from './routes/butter-dive'
import { chat } from './routes/chat'
import { humanizer } from './routes/humanizer'
import { localAuth } from './routes/local-auth'
import { conversations } from './routes/conversations'
import { messages } from './routes/messages'
import { proof } from './routes/proof'
import { projects } from './routes/projects'
import { proxy as proxyTool } from './routes/proxy'
import { providers } from './routes/providers'
import { review } from './routes/review'
import { room } from './routes/room'
import { settings } from './routes/settings'
import { shares } from './routes/shares'
import { traffic } from './routes/traffic'

const app = new Hono<AppContext>()

const APP_CSP = [
  "default-src 'self'",
  // The generated page previews use srcdoc and may include inline scripts and
  // remote libraries. They stay inside a sandboxed frame; the app shell itself
  // is React-rendered and never injects untrusted HTML.
  // 'unsafe-eval' is required by the Browser page: Ultraviolet's runtime
  // compiles rewritten scripts with eval/new Function, and without it the
  // proxy refuses to start and every proxied site fails to open.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
  "style-src 'self' 'unsafe-inline' https:",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https:",
  "connect-src 'self' https: wss: ws:",
  "media-src 'self' data: blob: https:",
  "worker-src 'self' blob:",
  "frame-src 'self' blob: https:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self' https:",
  "frame-ancestors 'none'",
  "manifest-src 'self'",
].join('; ')

// These responses are intentionally embeddable or need their own policy:
// live-site previews, Poki assets, and the Pyodide runner pages.
const SECURITY_EXEMPT_PREFIXES = ['/api/web-proxy/', '/api/poki-game/', '/api/poki-play/', '/api/poki-cdn/', '/analysis-runner.html', '/proof-runner.html']

app.use('*', async (c, next) => {
  const url = new URL(c.req.url)
  const path = url.pathname
  const baseHeaders: Record<string, string> = {
    'X-Content-Type-Options': 'nosniff',
    'X-Permitted-Cross-Domain-Policies': 'none',
    'X-Download-Options': 'noopen',
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    ...(url.protocol === 'https:' ? { 'Strict-Transport-Security': 'max-age=31536000' } : {}),
  }
  // Vite's development client uses its own inline bootstrap and HMR sockets;
  // keep the local loopback preview usable and apply the hardened document
  // policy to deployed origins.
  const appDocument = !SECURITY_EXEMPT_PREFIXES.some((prefix) => path.startsWith(prefix)) && authMode(c.env, c.req.raw) !== 'development'
  const documentHeaders: Record<string, string> = appDocument
    ? {
        'Content-Security-Policy': APP_CSP,
        'X-Frame-Options': 'DENY',
        'Cross-Origin-Resource-Policy': 'same-origin',
        // The shell is a private application document: it should never be
        // indexed, and no other origin should be able to read it.
        'X-Robots-Tag': 'noindex, nofollow',
      }
    : {}
  for (const [name, value] of Object.entries({ ...baseHeaders, ...documentHeaders })) c.header(name, value)
  await next()
  const policy = { ...baseHeaders, ...documentHeaders }
  // Static-asset responses from the ASSETS binding often have immutable header
  // guards, so mutate a clone instead of relying on c.header surviving the
  // fetcher's response. API and SSE responses already carry the context headers
  // and are left untouched.
  if (!path.startsWith('/api/')) {
    try {
      const current = c.res
      const headers = new Headers(current.headers)
      for (const [name, value] of Object.entries(policy)) headers.set(name, value)
      // Static assets come back from Pages with a wildcard CORS grant. The app
      // shell is nobody's cross-origin asset, so drop the grant on documents
      // and keep it only on the routes that legitimately serve other origins.
      if (appDocument) headers.delete('access-control-allow-origin')
      c.res = new Response(current.body, {
        status: current.status,
        statusText: current.statusText,
        headers,
      })
    } catch {
      /* a locked or already-consumed stream keeps its context headers */
    }
  } else {
    try {
      for (const [name, value] of Object.entries(policy)) c.res.headers.set(name, value)
    } catch {
      /* SSE streams already carry the context headers */
    }
  }
})

// The loopback preview hostname exists only to isolate browsed sites from the
// app origin. It must not serve Ink itself: development auth does not require
// a cookie, so exposing app APIs there would defeat the isolation.
app.use('*', async (c, next) => {
  if (!isIsolatedPreviewRequest(c.req.raw)) return next()
  const path = new URL(c.req.url).pathname
  if (path.startsWith('/api/web-proxy/') || path.startsWith('/api/poki-game/')) return next()
  return c.notFound()
})

// Ink moved off the jo3.org address. That host is kept only to tell visitors
// where the app lives now; it serves neither the shell nor its APIs, so the old
// link can never be mistaken for a working copy.
const MOVED_ORIGIN = 'https://www.inkbrowser.dpdns.org'

function isMovedHost(hostname: string): boolean {
  return /(^|\.)jo3\.org$/i.test(hostname)
}

function movedPage(): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Ink has moved</title><style>html,body{margin:0;height:100%}body{display:flex;align-items:center;justify-content:center;background:#0b0c10;color:#e8e8ea;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;padding:24px}.card{max-width:34rem;text-align:center}h1{font-size:1.75rem;font-weight:600;margin:0 0 .75rem}p{margin:0 0 1.25rem;color:#a7a9b1;line-height:1.6}a{display:inline-block;background:#e8e8ea;color:#0b0c10;text-decoration:none;font-weight:600;padding:.7rem 1.2rem;border-radius:.6rem}code{color:#a7a9b1}</style></head><body><div class="card"><h1>Ink has moved</h1><p>This address no longer serves Ink. The site now lives at:</p><a href="${MOVED_ORIGIN}">${MOVED_ORIGIN}</a></div></body></html>`
}

app.use('*', async (c, next) => {
  if (!isMovedHost(new URL(c.req.url).hostname)) return next()
  c.header('Cache-Control', 'public, max-age=300')
  if (new URL(c.req.url).pathname.startsWith('/api/')) {
    return c.json({ error: 'moved', to: MOVED_ORIGIN }, 410)
  }
  return c.html(movedPage())
})

app.get('/api/auth/status', (c) => {
  c.header('Cache-Control', 'private, no-store')
  return c.json({ mode: authMode(c.env, c.req.raw), database: Boolean(c.env.DB), ai: aiConfigured(c.env) })
})
app.post('/api/auth/guest', requireDb, async (c) => {
  if (!allowsMutation(c.env, c.req.raw)) return c.json({ error: 'Cross-origin request refused.' }, 403)
  const limit = await rateLimit(c.get('db'), 'auth:guest', c.req.raw, 20, RATE_WINDOWS.guest)
  if (!limit.allowed) return tooManyRequests(c, limit)
  const form = (await c.req.parseBody().catch(() => ({}))) as Record<string, string | File>
  const requested = typeof form.returnTo === 'string' ? form.returnTo : '/'
  const returnTo = requested.startsWith('/') && !requested.startsWith('//') && !/[\r\n]/.test(requested) ? requested.slice(0, 2048) : '/'
  const secure = new URL(appOrigin(c.env, c.req.raw)).protocol === 'https:'
  // Reuse an existing guest identity so repeated guest entries count as one
  // person, and create the analytics-visible user row now rather than waiting
  // for the app shell to call /api/me.
  const existingGuest = getCookie(c, GUEST_COOKIE)
  const guestId = isGuestId(existingGuest) ? existingGuest : crypto.randomUUID()
  await c
    .get('db')
    .prepare(`INSERT OR IGNORE INTO users (owner_sub, created_at) VALUES (?, ?)`)
    .bind(`guest:${guestId}`, Date.now())
    .run()
    .catch(() => undefined)
  setCookie(c, GUEST_COOKIE, guestId, {
    httpOnly: true,
    secure,
    sameSite: 'Lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })
  return c.redirect(returnTo, 303)
})
// Invite links are public entry points: a first-time visitor gets a guest
// identity here, then the room page redeems the token without a password.
app.get('/join', requireDb, async (c) => {
  const roomId = (c.req.query('room') ?? '').trim()
  const invite = (c.req.query('invite') ?? '').trim().toLowerCase()
  if (!roomId || roomId.length > 64 || !/^[a-f0-9]{32}$/.test(invite)) {
    return c.redirect('/room', 303)
  }

  const existingGuest = getCookie(c, GUEST_COOKIE)
  if (!isGuestId(existingGuest)) {
    const limit = await rateLimit(c.get('db'), 'auth:guest', c.req.raw, 20, RATE_WINDOWS.guest)
    if (!limit.allowed) return tooManyRequests(c, limit)
    const guestId = crypto.randomUUID()
    await c
      .get('db')
      .prepare(`INSERT OR IGNORE INTO users (owner_sub, created_at) VALUES (?, ?)`)
      .bind(`guest:${guestId}`, Date.now())
      .run()
      .catch(() => undefined)
    const secure = new URL(appOrigin(c.env, c.req.raw)).protocol === 'https:'
    setCookie(c, GUEST_COOKIE, guestId, {
      httpOnly: true,
      secure,
      sameSite: 'Lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    })
  }

  const target = new URL('/room', appOrigin(c.env, c.req.raw))
  target.searchParams.set('room', roomId)
  target.searchParams.set('invite', invite)
  return c.redirect(`${target.pathname}${target.search}`, 303)
})
app.route('/api/auth', localAuth)
app.get('/api/health', (c) => {
  c.header('Cache-Control', 'private, no-store')
  return c.json({ ok: true })
})
// Which commit is serving. Public and uncached on purpose: an editor or agent
// that can only see the repository can compare `git rev-parse origin/main` with
// this answer and know whether the site is the code it is reading. The stamp is
// filled in at upload (scripts/stamp-worker.mjs), so a local build says `dev`.
app.get('/api/version', (c) => {
  c.header('Cache-Control', 'no-store')
  let stamp: { commit?: unknown; builtAt?: unknown } = {}
  try {
    stamp = JSON.parse(BUILD_STAMP) as { commit?: unknown; builtAt?: unknown }
  } catch {
    // Unstamped build (local dev, or an upload that skipped the stamp step).
  }
  return c.json({
    ok: true,
    site: 'ink',
    commit: typeof stamp.commit === 'string' ? stamp.commit : 'dev',
    builtAt: typeof stamp.builtAt === 'string' ? stamp.builtAt : null,
  })
})
// Aggregate 5xx count for the external monitor. It contains route names and
// counts only; no user, query string, or body is stored.
app.get('/api/health/errors', requireDb, async (c) => {
  c.header('Cache-Control', 'private, no-store')
  const since = Date.now() - 60 * 60 * 1000
  const total = await c
    .get('db')
    .prepare(`SELECT COUNT(*) AS n FROM http_errors WHERE created_at >= ?`)
    .bind(since)
    .first<{ n: number }>()
  const rows = await c
    .get('db')
    .prepare(`SELECT path, COUNT(*) AS count FROM http_errors WHERE created_at >= ? GROUP BY path ORDER BY count DESC LIMIT 5`)
    .bind(since)
    .all<{ path: string; count: number }>()
  return c.json({ ok: true, windowMinutes: 60, errors: Number(total?.n ?? 0), paths: rows.results })
})
// Liveness above stays cheap. Readiness is for deploys and monitors: it
// proves the database schema exists and that at least one model lane can run.
app.get('/api/ready', async (c) => {
  c.header('Cache-Control', 'private, no-store')
  const checks = { database: false, schema: false, models: false }
  let detail: string | undefined
  if (c.env.DB) {
    checks.database = true
    try {
      await ensureSchema(c.env.DB)
      const row = await c.env.DB.prepare(
        `SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name IN ('users', 'conversations', 'messages', 'auth_users', 'auth_sessions', 'guest_daily_usage')`,
      ).first<{ n: number }>()
      checks.schema = Number(row?.n) === 6
      if (!checks.schema) detail = 'The database schema is incomplete.'
    } catch {
      detail = 'The database schema could not be verified.'
    }
  } else {
    detail = 'No DB binding is attached.'
  }
  // Only the deployment owner may spend a probe: it is reachable from the open
  // internet otherwise, and every call costs allowance.
  let aiProbe: { status: number; body: string } | undefined
  if (c.req.query('probe') === 'ai' && c.env.CLOUDFLARE_AI_TOKEN && c.env.CLOUDFLARE_ACCOUNT_ID) {
    const owner = isDeploymentOwner(c.env, c.get('user') ?? ({ sub: '', name: 'Guest' } as never), c.req.raw)
    if (owner) {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${c.env.CLOUDFLARE_ACCOUNT_ID}/ai/v1/chat/completions`,
        {
          method: 'POST',
          headers: { authorization: `Bearer ${c.env.CLOUDFLARE_AI_TOKEN}`, 'content-type': 'application/json' },
          body: JSON.stringify({
            model: '@cf/openai/gpt-oss-20b',
            messages: [{ role: 'user', content: 'Reply with the single word ok.' }],
            max_tokens: 8,
          }),
        },
      ).catch(() => null)
      aiProbe = response
        ? { status: response.status, body: (await response.text()).slice(0, 220) }
        : { status: 0, body: 'network error' }
    }
  }
  const lanes = publicLanes(c.env)
  checks.models = aiConfigured(c.env) || lanes.length > 0
  if (!checks.models) detail = 'No model lane or API key is configured.'
  const ok = checks.database && checks.schema && checks.models
  return c.json(
    {
      ok,
      checks,
      auth: authMode(c.env, c.req.raw),
      models: { api: aiConfigured(c.env), freeLanes: lanes.length },
      // Whether the coding agent can drive a real Chrome. False is not an
      // outage: the agent simply has no browser tool on this deployment.
      browser: Boolean(c.env.BROWSER),
      // True while AGENT_UNLIMITED=1: the agent's caps are lifted for the owner.
      agentUnlimited: c.env.AGENT_UNLIMITED === '1',
      // Whether agent mode can start its sandbox here. A deployment with
      // VERCEL_TOKEN or VERCEL_PROJECT_ID missing answers every agent request
      // with a 503, and without this the only way to see that was to try one.
      sandbox: sandboxConfigured(c.env),
      // The caller's own address, so the owner can allowlist it. Nothing secret:
      // it is the address this very request came from.
      callerIp: c.req.header('cf-connecting-ip') ?? null,
      // ?probe=ai asks Workers AI one word and reports what came back, so a lane
      // that silently fails can be diagnosed without reading any secret. Owner
      // only: it spends a subrequest and a few neurons.
      ...(aiProbe ? { aiProbe } : {}),
      // Whether *this* caller gets the lifted caps. False for everyone except the
      // owner, which is the whole point of the gate.
      agentUnlimitedForCaller:
        c.env.AGENT_UNLIMITED === '1' &&
        isDeploymentOwner(c.env, c.get('user') ?? ({ sub: '', name: 'Guest' } as never), c.req.raw),
      ...(detail ? { detail } : {}),
    },
    ok ? 200 : 503,
  )
})

const ASSET_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS',
  'access-control-allow-headers': '*, authorization, content-type, accept, x-requested-with, x-api-key, range',
  'cross-origin-resource-policy': 'cross-origin',
  // Live preview assets can change between deploys; never let a browser keep
  // an old game script that still redirects an embedded frame to an ad wrapper.
  'cache-control': 'private, no-store',
  'x-content-type-options': 'nosniff',
}

/**
 * The capability token in the URL is the secret, so the response must not be
 * readable by other sites: `access-control-allow-origin: *` would let any page
 * that learns a token read the proxied content. Sandboxed previews identify as
 * `null`, and the app calls the gateway from its own origin; only those are
 * echoed back. Vary keeps a cache from reusing one answer for another origin.
 */
function capabilityHeaders(request: Request): Record<string, string> {
  const headers: Record<string, string> = { vary: 'origin' }
  for (const [name, value] of Object.entries(ASSET_HEADERS)) {
    if (name !== 'access-control-allow-origin') headers[name] = value
  }
  const origin = request.headers.get('origin')
  const self = new URL(request.url).origin
  const allow = !origin ? self : origin === 'null' || origin === self ? origin : ''
  if (allow) headers['access-control-allow-origin'] = allow
  return headers
}

/** Response headers that must survive a streamed pass-through. */
const STREAM_HEADERS = [
  'content-type',
  'content-range',
  'accept-ranges',
  'etag',
  'last-modified',
  'content-disposition',
  'content-language',
]

/** A rewritten asset is a small document, script or stylesheet, never a game. */
const MAX_REWRITE_BYTES = 4_000_000

function streamHeaders(upstream: Headers): Record<string, string> {
  const out: Record<string, string> = {}
  for (const name of STREAM_HEADERS) {
    const value = upstream.get(name)
    if (value) out[name] = value
  }
  return out
}

/** A short, ASCII-safe reason for the request that failed. */
function failureTag(target: string, failure: SiteError): string {
  let host = target
  try {
    host = new URL(target).host
  } catch {
    // A target that cannot be parsed still needs a label.
  }
  return `${failure.status} ${host}`.replace(/[^\x20-\x7e]/g, '')
}

const PROXY_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'private, no-store',
  'content-security-policy':
    // No frame-ancestors: the unguessable token is the capability, and a
    // sandboxed (opaque-origin) document cannot match 'self' reliably.
    // form-action used to list google.com only, which silently blocked the
    // preview's own search form: the submit went to the capability URL and the
    // browser dropped it. A sandboxed document has an opaque origin, so 'self'
    // matches nothing here and the scheme has to be allowed outright.
    // The preview navigates only through its parent: no top navigation, and the
    // frame bridge posts the address it wants instead.
    // Popups stay, because a portal launcher opens its game in a window it then
    // writes into (`let w = window.open(); w.document…`). That only works when
    // the new window leaves the sandbox: two opaque origins never match, so
    // `window.open().document` would throw. The trade-off is deliberate and
    // narrow — a popup gets Ink's origin, the frame itself stays opaque and
    // still cannot reach the app, top-navigate, or use allow-same-origin.
    "sandbox allow-scripts allow-forms allow-pointer-lock allow-modals allow-downloads allow-popups allow-popups-to-escape-sandbox; default-src * data: blob:; script-src * 'unsafe-inline' 'unsafe-eval' data: blob:; style-src * 'unsafe-inline'; img-src * data: blob:; font-src * data:; connect-src *; media-src * data: blob:; frame-src *; worker-src * blob:; object-src 'none'; base-uri *; form-action 'self' https: http:",
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'x-robots-tag': 'noindex, nofollow',
}

/**
 * Loopback development serves the same app on a second hostname so the live
 * preview is a different origin from Ink (and from its session). Only that
 * hostname may keep a real origin inside the sandbox: sites such as FreezeNova
 * write their game into an about:blank frame, which needs same-origin access,
 * and remote code there then still cannot reach the app origin.
 */
const ISOLATED_PREVIEW_HOST = 'stet-preview.localhost'

function isIsolatedPreviewRequest(request: Request): boolean {
  try {
    return new URL(request.url).hostname === ISOLATED_PREVIEW_HOST
  } catch {
    return false
  }
}

function proxyPageHeaders(request: Request): Record<string, string> {
  if (!isIsolatedPreviewRequest(request)) return PROXY_HEADERS
  // The frame keeps its own sandbox. A CSP sandbox on top of it makes Chrome
  // leave requestFullscreen() pending forever, so the game's fullscreen button
  // never completes. The isolated host is still cross-origin from Ink and the
  // iframe sandbox still blocks top navigation, popup escape and native storage
  // access outside the preview.
  return {
    ...PROXY_HEADERS,
    'content-security-policy': PROXY_HEADERS['content-security-policy'].replace(
      /^sandbox [^;]+; /,
      '',
    ),
  }
}

/** Keep every generated frame URL on the isolated host the browser visited. */
function proxyOriginFor(env: Env, request: Request): string {
  return isIsolatedPreviewRequest(request) ? new URL(request.url).origin : appOrigin(env, request)
}

/**
 * Frame diagnostics, per capability token. A proxied frame is an opaque origin:
 * the page that shows it cannot read its DOM or console, and a game that blocks
 * its own main thread cannot even post a message. Each frame therefore beacons
 * what failed here, and the Browser page (or the owner, with curl) can read the
 * last reports for that token afterwards.
 */
const MAX_PROXY_DIAGNOSTICS = 40
const PROXY_DIAGNOSTICS_TTL = 60 * 60_000

app.post('/api/web-proxy/:token/diag', requireDb, async (c) => {
  const token = c.req.param('token')
  if (!isWebProxyToken(token)) return c.body(null, 404)
  const db = c.get('db')
  const row = await db.prepare(`SELECT token FROM build_embeds WHERE token = ?`).bind(token).first<{ token: string }>()
  if (!row) return c.body(null, 404)
  const body = (await c.req.json().catch(() => null)) as
    | { kind?: unknown; href?: unknown; detail?: unknown }
    | null
  if (!body || typeof body.kind !== 'string') return c.body(null, 204)
  const at = Date.now()
  // Diagnostics outlive one isolate. A capability visit spans several, and the
  // frame that reports is rarely the one that answers the read, so the report
  // is stored rather than kept in memory.
  await db
    .prepare(`CREATE TABLE IF NOT EXISTS proxy_diagnostics (token TEXT NOT NULL, at INTEGER NOT NULL, kind TEXT NOT NULL, href TEXT NOT NULL, detail TEXT NOT NULL)`)
    .run()
    .catch(() => undefined)
  await db
    .prepare(`INSERT INTO proxy_diagnostics (token, at, kind, href, detail) VALUES (?, ?, ?, ?, ?)`)
    .bind(
      token,
      at,
      body.kind.slice(0, 40),
      String(body.href ?? '').slice(0, 200),
      // The detail is data the frame produced, never markup the server renders.
      JSON.stringify(body.detail ?? null).slice(0, 600),
    )
    .run()
    .catch(() => undefined)
  await db
    .prepare(`DELETE FROM proxy_diagnostics WHERE token = ? AND at < ?`)
    .bind(token, at - PROXY_DIAGNOSTICS_TTL)
    .run()
    .catch(() => undefined)
  return c.body(null, 204)
})

app.get('/api/web-proxy/:token/diag', requireDb, async (c) => {
  const token = c.req.param('token')
  const rows = await c
    .get('db')
    .prepare(`SELECT at, kind, href, detail FROM proxy_diagnostics WHERE token = ? ORDER BY at DESC LIMIT ?`)
    .bind(token, MAX_PROXY_DIAGNOSTICS)
    .all<{ at: number; kind: string; href: string; detail: string }>()
    .catch(() => ({ results: [] as Array<{ at: number; kind: string; href: string; detail: string }> }))
  return c.json({ entries: rows.results ?? [] }, 200, { 'cache-control': 'no-store' })
})

app.options('/api/web-proxy/:token/p/*', (c) => c.body(null, 204, capabilityHeaders(c.req.raw)))
app.options('/api/web-proxy/:token/net', (c) => c.body(null, 204, capabilityHeaders(c.req.raw)))

/**
 * Runtime network route for proxied pages. Same-site fetch/XHR calls cannot
 * reach the site directly from the preview, so the injected page shim sends
 * them here. The token is the capability; private hosts are refused and the
 * preview host's cookies are never forwarded.
 */
app.all('/api/web-proxy/:token/net', requireDb, async (c) => {
  const token = c.req.param('token')
  if (!isWebProxyToken(token)) return c.body('Live preview not found.', 404, { 'content-type': 'text/plain; charset=utf-8' })
  const row = await c.get('db').prepare(`SELECT token FROM build_embeds WHERE token = ?`).bind(token).first<{ token: string }>()
  if (!row) return c.body('Live preview not found.', 404, { 'content-type': 'text/plain; charset=utf-8' })
  const target = normalizeSiteUrl(c.req.query('url') ?? '')
  if (!target) return c.body('That address is not on a public website.', 400, { 'content-type': 'text/plain; charset=utf-8' })
  // A page loads dozens of assets at once, so this is a brake on a runaway or
  // abusive preview rather than a per-request quota. It is keyed by the token
  // so one shared address cannot exhaust another preview's budget.
  const limit = await rateLimit(c.get('db'), 'proxy:net', c.req.raw, 4_000, RATE_WINDOWS.proxy, token)
  if (!limit.allowed) return tooManyRequests(c, limit)
  try {
    // API calls, media ranges and game assets are streamed: buffering them
    // capped a game at 40 MB and made every byte arrive at the end.
    const result = await fetchSiteStream(target, c.req.raw, token)
    return new Response(result.stream, {
      status: result.status,
      headers: {
        ...capabilityHeaders(c.req.raw),
        ...streamHeaders(result.headers),
        'content-type': result.contentType,
        'cache-control': 'private, no-store',
      },
    })
  } catch (error) {
    if (!(error instanceof SiteError)) console.error(error)
    const failure = error instanceof SiteError ? error : new SiteError(502, 'That request could not be completed.')
    const wantsScript = c.req.header('sec-fetch-dest') === 'script'
    return new Response(wantsScript ? null : failure.message, {
      status: failure.status,
      headers: {
        'content-type': wantsScript ? 'text/javascript; charset=utf-8' : 'text/plain; charset=utf-8',
        'x-ink-proxy-error': failureTag(target, failure),
        ...capabilityHeaders(c.req.raw),
      },
    })
  }
})

/**
 * A path-preserving asset proxy for live pages. A module's relative imports
 * and a stylesheet's relative url() lookups stay under this path, while root
 * references are rewritten by the renderer. The response is cross-origin so a
 * sandboxed (opaque-origin) document can load its own scripts and styles.
 */
app.get('/api/web-proxy/:token/p/*', requireDb, async (c) => {
  const token = c.req.param('token')
  if (!isWebProxyToken(token)) return c.body('Live preview not found.', 404, { 'content-type': 'text/plain; charset=utf-8' })
  const requestUrl = new URL(c.req.url)
  const marker = `/api/web-proxy/${token}/p/`
  if (!requestUrl.pathname.startsWith(marker)) return c.body('That asset is not available.', 400, { 'content-type': 'text/plain; charset=utf-8' })
  let raw: string
  try {
    raw = decodeURIComponent(requestUrl.pathname.slice(marker.length))
  } catch {
    return c.body('That asset address is invalid.', 400, { 'content-type': 'text/plain; charset=utf-8' })
  }
  const firstSlash = raw.indexOf('/')
  if (firstSlash <= 0) return c.body('That asset address is invalid.', 400, { 'content-type': 'text/plain; charset=utf-8' })
  const scheme = raw.slice(0, firstSlash)
  const rest = raw.slice(firstSlash + 1)
  const hostEnd = rest.indexOf('/')
  const host = hostEnd === -1 ? rest : rest.slice(0, hostEnd)
  const assetPath = hostEnd === -1 ? '/' : rest.slice(hostEnd)
  if ((scheme !== 'http' && scheme !== 'https') || !host) return c.body('That asset address is invalid.', 400, { 'content-type': 'text/plain; charset=utf-8' })
  const assetQuery = requestUrl.searchParams.get('q')
  const target = normalizeSiteUrl(`${scheme}://${host}${assetPath}${assetQuery ? `?${assetQuery}` : ''}`)
  if (!target) return c.body('That asset is not on a public website.', 400, { 'content-type': 'text/plain; charset=utf-8' })
  const proxyOrigin = proxyOriginFor(c.env, c.req.raw)
  const proxyUrl = new URL(webProxyPath(token), proxyOrigin).href
  try {
    const result = await fetchSiteStream(target, c.req.raw, token)
    const type = result.contentType.toLowerCase()
    const length = Number(result.headers.get('content-length') ?? '0')
    // Only documents, stylesheets and scripts are rewritten. An image, font,
    // video, audio file, Wasm module or any large response is passed straight
    // through, so a game build is not held to a page-sized limit.
    const rewritable = /text\/(?:css|html)|javascript|ecmascript/.test(type)
    const ranged = Boolean(result.headers.get('content-range'))
    if (rewritable && !ranged && result.stream && (length === 0 || length <= MAX_REWRITE_BYTES)) {
      const body = await new Response(result.stream).arrayBuffer()
      return new Response(rewriteAssetContent(body, result.contentType, target, proxyUrl), {
        status: result.status,
        headers: {
          ...capabilityHeaders(c.req.raw),
          ...streamHeaders(result.headers),
          'content-type': result.contentType,
        },
      })
    }
    return new Response(result.stream, {
      status: result.status,
      headers: {
        ...capabilityHeaders(c.req.raw),
        ...streamHeaders(result.headers),
        'content-type': result.contentType,
      },
    })
  } catch (error) {
    const failure = error instanceof SiteError ? error : new SiteError(502, 'The asset could not be loaded.')
    if (!(error instanceof SiteError)) console.error(error)
    const wantsScript = c.req.header('sec-fetch-dest') === 'script' || /javascript|ecmascript/i.test(c.req.header('accept') ?? '')
    // A script request answered with an HTML error page is cached as code and
    // reported as a syntax error far from its cause. Keep the upstream status,
    // send an empty body and name the failed request in a header.
    if (wantsScript) {
      return new Response(null, {
        status: failure.status,
        headers: {
          'content-type': 'text/javascript; charset=utf-8',
          'x-ink-proxy-error': failureTag(target, failure),
          ...capabilityHeaders(c.req.raw),
        },
      })
    }
    return c.body(failure.message, failure.status === 413 ? 413 : failure.status === 504 ? 504 : failure.status === 404 ? 404 : 502, {
      'content-type': 'text/plain; charset=utf-8',
      'x-ink-proxy-error': failureTag(target, failure),
      ...capabilityHeaders(c.req.raw),
    })
  }
})

/**
 * A token-scoped live-site proxy. The token is the capability: it lets a
 * sandboxed preview load a saved site, follow its public links, load its
 * embedded frames and submit its GET forms, all without sending the signed-in
 * app's cookies. Private hosts and non-HTML responses are refused.
 */
app.get('/api/web-proxy/:token', requireDb, async (c) => {
  const token = c.req.param('token')
  if (!isWebProxyToken(token)) return c.body('Live preview not found.', 404, { 'content-type': 'text/plain; charset=utf-8' })
  const db = c.get('db')
  const row = await db.prepare(`SELECT url FROM build_embeds WHERE token = ?`).bind(token).first<{ url: string }>()
  if (!row) return c.body('Live preview not found.', 404, { 'content-type': 'text/plain; charset=utf-8' })
  const storedUrl = normalizeSiteUrl(row.url)
  if (!storedUrl) return c.body('Live preview not found.', 404, { 'content-type': 'text/plain; charset=utf-8' })
  // The token started on one saved site, but it can browse onward to any
  // public HTTP(S) page so search results and ordinary links stay inside the
  // preview. normalizeSiteUrl keeps private hosts and non-web schemes out.
  //
  // A form submitted with ?q= is a search: the locally served Google landing
  // page posts here, so it becomes a Google search instead of an unknown URL.
  const searchTerm = (c.req.query('q') ?? '').trim()
  const target = searchTerm
    ? `https://www.google.com/search?q=${encodeURIComponent(searchTerm)}`
    : resolveProxyTarget(storedUrl, c.req.query('url'))
  if (!target) return c.body('That page is not available.', 400, { 'content-type': 'text/plain; charset=utf-8' })
  const proxyOrigin = proxyOriginFor(c.env, c.req.raw)
  const proxyUrl = new URL(webProxyPath(token), proxyOrigin).href
  // Embedded frames are always driven by their parent, so a sandbox cannot
  // swallow a link or game click. Codespaces separately needs this to carry
  // its forwarded-port authorisation into the next document.
  const parentNavigation =
    isCodespacesRequest(c.env, c.req.raw) || c.req.header('sec-fetch-dest')?.toLowerCase() === 'iframe'
  try {
    // Google's result document is a redirect/challenge shell for server
    // fetches; loading it would leave the proxy on an empty page. Resolve the
    // query to Google's top result and render a usable result instead.
    const query = googleSearchQuery(target)
    if (query) {
      const results = await fetchWebSearchResults(query, c.req.raw.signal)
      if (!results.length) {
        const top = await googleTopResult(query, c.req.raw.signal)
        if (top) {
          results.push({
            title: new URL(top).hostname.replace(/^www\./, ''),
            url: top,
            snippet: `Google's top result for “${query}”. Open it inside this proxy.`,
          })
        }
      }
      return c.body(renderProxyPage(renderSearchResults(query, target, results), target, proxyUrl, parentNavigation, isIsolatedPreviewRequest(c.req.raw)), 200, proxyPageHeaders(c.req.raw))
    }
    const page = await fetchSitePage(target, c.req.raw.signal)
    // A page can name Poki hosts directly in its markup (thumbnails, fonts,
    // SDK scripts). Point those at the same-origin asset route; the page shim
    // does the same for the tags its own scripts build later.
    // A Poki game page only builds its game frame after its ad scripts answer.
    // Remember which wrapper it embeds before the rewrite below changes its
    // address, so the page can open the game itself when that never happens.
    const pokiWrapper = isPokiPage(page.finalUrl) ? findPokiGameWrapper(page.html) : undefined
    page.html = rewritePokiUrls(page.html, new URL(proxyUrl).origin)
    // The local Google landing page cannot know this capability URL. Point its
    // search button back here so the query stays inside the preview.
    if (page.html.includes('__ink_proxy_search__')) {
      page.html = page.html.split('__ink_proxy_search__').join(proxyUrl)
    }
    // Every page gets the frame bridge, not only Poki. Any iframe a site
    // creates is moved behind the same capability proxy, so a game, map,
    // video or docs frame cannot escape into a new browser tab. The wrapper
    // resolver is only used for hosts whose game assets reject our referrer.
    // The locally served landing page is a plain search form with nothing to
    // rewrite and no frames to keep in the preview. The bridge intercepts
    // submits and links, so injecting it there left the search box inert; the
    // browser submits the form to the capability URL on its own.
    const localLanding = page.html.includes('data-ink-landing')
    const bridged = localLanding
      ? page.html
      : installFrameBridge(page.html, {
          proxyUrl,
          gameStartUrl: new URL(`/api/poki-game/start/${token}`, proxyOrigin).href,
          gameHosts: ['games.poki.com'],
          parentNavigation,
        })
    const html =
      pokiWrapper && !localLanding
        ? installPokiAutostart(bridged, `${new URL(`/api/poki-game/start/${token}`, proxyOrigin).href}?url=${encodeURIComponent(pokiWrapper)}`)
        : bridged
    // A bot-check interstitial cannot be proxied past - it is bound to the site's
    // own origin and cookie. Say that, instead of framing a widget that will spin.
    if (isChallengeWall(page.html))
      return c.body(renderChallengePage(page.finalUrl), 200, proxyPageHeaders(c.req.raw))
    return c.body(renderProxyPage(html, page.finalUrl, proxyUrl, parentNavigation, isIsolatedPreviewRequest(c.req.raw)), 200, proxyPageHeaders(c.req.raw))
  } catch (error) {
    if (!(error instanceof SiteError)) console.error(error)
    const failure = error instanceof SiteError ? error : new SiteError(502, 'The site could not be loaded.')
    const html = renderProxyErrorPage(failure, target)
    const status =
      failure.status === 400
        ? 400
        : failure.status === 403
          ? 403
          : failure.status === 407
            ? 407
            : failure.status === 413
              ? 413
              : failure.status === 415
                ? 415
                : failure.status === 429
                  ? 429
                  : failure.status === 451
                    ? 451
                    : failure.status === 504
                      ? 504
                      : 502
    return c.body(html, status, { ...PROXY_HEADERS, 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'" })
  }
})

/**
 * The Apps browser opens Poki through Ultraviolet. Poki serves that page in a
 * bot "playground" mode that renders the game shell but never creates its
 * frame, so a click on a game would sit at "Preparing..." forever. Resolve the
 * same game through Poki's wrapper and load the game document directly.
 */
app.get('/api/poki-play', async (c) => {
  const target = normalizeSiteUrl(c.req.query('url') ?? '')
  if (!target) return c.body('Game not found.', 400, { 'content-type': 'text/plain; charset=utf-8' })
  const gameUri = await pokiGameFromPage(target, c.req.raw.signal)
  const path = gameUri ? pokiGamePublicPath(gameUri) : undefined
  if (!path) return c.body('That Poki game is not available through the proxy.', 502, { 'content-type': 'text/plain; charset=utf-8' })
  c.header('cache-control', 'private, no-store')
  return c.redirect(path, 302)
})

app.get('/api/poki-play/:gameId/:version/:path{.*}', async (c) => {
  const gameId = c.req.param('gameId')
  const version = c.req.param('version')
  if (!isPokiGameId(gameId) || !isSafeGameSegment(version)) {
    return c.body('Game not found.', 400, { 'content-type': 'text/plain; charset=utf-8' })
  }
  try {
    return await proxyPokiGameAsset(
      gameId,
      version,
      c.req.param('path'),
      new URL(c.req.url).search,
      c.req.header('accept'),
      c.req.raw.signal,
      new URL(c.req.url).origin,
    )
  } catch (error) {
    if (!(error instanceof Error) || error.name === 'AbortError') throw error
    console.error('poki game:', error)
    return c.body('Game asset unavailable.', 502, { 'content-type': 'text/plain; charset=utf-8' })
  }
})

/**
 * The page shell, game CDN, SDK, fonts and telemetry a Poki game needs all sit
 * on Poki hostnames, so a network filter blocks the game even when its document
 * is proxied. Game files are rewritten to this route, which fetches the asset
 * here with the Poki referer those hosts require.
 */
app.on(['GET', 'POST'], '/api/poki-cdn/:host/:path{.*}', async (c) => {
  const host = c.req.param('host')
  if (!isPokiAssetHost(host)) return c.body('Asset not found.', 400, { 'content-type': 'text/plain; charset=utf-8' })
  const path = c.req.param('path')
  if (!path) return c.body('Asset not found.', 400, { 'content-type': 'text/plain; charset=utf-8' })
  try {
    // Games post telemetry (level progress, session events) to these hosts, so
    // the method and body have to travel with the request.
    const isBodyless = c.req.method === 'GET' || c.req.method === 'HEAD'
    return await proxyPokiCdnAsset(
      host,
      path,
      new URL(c.req.url).search,
      c.req.header('accept'),
      c.req.raw.signal,
      new URL(c.req.url).origin,
      {
        method: c.req.method,
        body: isBodyless ? undefined : await c.req.arrayBuffer(),
        contentType: c.req.header('content-type'),
      },
    )
  } catch (error) {
    if (!(error instanceof Error) || error.name === 'AbortError') throw error
    console.error('poki cdn:', error)
    return c.body('Asset unavailable.', 502, { 'content-type': 'text/plain; charset=utf-8' })
  }
})

/**
 * Poki's game files reject requests whose Referer is not on poki.com, so they
 * cannot be iframed directly from a preview. Fetch the game wrapper and its
 * assets server-side with a Poki Referer, and serve them from this scoped path.
 */
app.get('/api/poki-game/start/:token', requireDb, async (c) => {
  const token = c.req.param('token')
  if (!isWebProxyToken(token)) return c.body('Game preview not found.', 404, { 'content-type': 'text/plain; charset=utf-8' })
  const wrapperUrl = c.req.query('url') ?? ''
  if (!isPokiGameWrapperUrl(wrapperUrl)) {
    return c.body('Game not found.', 400, { 'content-type': 'text/plain; charset=utf-8' })
  }
  const row = await c.get('db').prepare(`SELECT token FROM build_embeds WHERE token = ?`).bind(token).first<{ token: string }>()
  if (!row) return c.body('Game preview not found.', 404, { 'content-type': 'text/plain; charset=utf-8' })
  try {
    return await pokiGameWrapperResponse(wrapperUrl, token, proxyOriginFor(c.env, c.req.raw), c.req.raw.signal)
  } catch (error) {
    if (!(error instanceof Error) || error.name === 'AbortError') throw error
    console.error('poki wrapper:', error)
    return c.body('Game unavailable.', 502, { 'content-type': 'text/plain; charset=utf-8' })
  }
})

app.get('/api/poki-game/:token/:gameId/:version/:path{.*}', requireDb, async (c) => {
  const token = c.req.param('token')
  if (!isWebProxyToken(token)) return c.body('Game preview not found.', 404, { 'content-type': 'text/plain; charset=utf-8' })
  const gameId = c.req.param('gameId')
  const version = c.req.param('version')
  if (!isPokiGameId(gameId) || !isSafeGameSegment(version)) {
    return c.body('Game not found.', 400, { 'content-type': 'text/plain; charset=utf-8' })
  }
  const row = await c.get('db').prepare(`SELECT token FROM build_embeds WHERE token = ?`).bind(token).first<{ token: string }>()
  if (!row) return c.body('Game preview not found.', 404, { 'content-type': 'text/plain; charset=utf-8' })
  try {
    return await proxyPokiGameAsset(
      gameId,
      version,
      c.req.param('path'),
      new URL(c.req.url).search,
      c.req.header('accept'),
      c.req.raw.signal,
      new URL(c.req.url).origin,
    )
  } catch (error) {
    console.error(error)
    return c.body('Game unavailable.', 502, { 'content-type': 'text/plain; charset=utf-8' })
  }
})

const api = new Hono<AppContext>()
// The database must be ready before the session lookup. Email/password
// sessions live in D1; a guest can still use the API when no account cookie is
// present.
api.use('*', requireDb, requireUser)
// Move legacy D1 attachment blobs to R2 in the background. Reads fall back to
// D1 until each row has been copied, so this never blocks a request.
api.use('*', async (c, next) => {
  const migration = migrateAttachmentObjects(c.env.FILES, c.get('db'))
  try {
    c.executionCtx.waitUntil(migration)
  } catch {
    // Local route checks may not provide an execution context.
  }
  await next()
})
api.route('/', account)
api.route('/analytics', analytics)
api.route('/analysis', analysis)
api.route('/artifacts', artifacts)
api.route('/attachments', attachments)
api.route('/browser', browser)
// The in-app browser relays every request it makes through this gateway.
api.route('/browser-gateway', browserGateway)
api.route('/buffy', buffy)
api.route('/conversations', conversations)
api.route('/chat', chat)
api.route('/humanize', humanizer)
api.route('/messages', messages)
api.route('/proof', proof)
api.route('/projects', projects)
api.route('/proxy', proxyTool)
api.route('/providers', providers)
api.route('/review', review)
api.route('/', room)
api.route('/settings', settings)
// Public read-only links live outside the authenticated /api subapp. The
// random token is scoped to one conversation and only GET is implemented.
app.route('/api/share', shares)

/**
 * A site's icon, fetched by the Worker instead of by the page.
 *
 * The Apps page used to ask Google's favicon service for each tile, which put
 * every app's own domain (`spotify.com`, `discord.com`, …) in a request made
 * from the browser. A network filter logs those domains as sites the visitor
 * opened, so the icons travel through Ink and the page only ever talks to Ink.
 */
app.get('/api/app-icon/:host', async (c) => {
  const host = c.req.param('host').toLowerCase()
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(host) || host.length > 120) {
    return c.body(null, 404)
  }
  try {
    const response = await fetch(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`, {
      headers: { accept: 'image/*' },
      cf: { cacheTtl: 86_400, cacheEverything: true },
    })
    const type = (response.headers.get('content-type') || '').split(';')[0]
    if (!response.ok || !type.startsWith('image/')) return c.body(null, 404)
    const icon = await response.arrayBuffer()
    if (icon.byteLength === 0 || icon.byteLength > 200_000) return c.body(null, 404)
    return c.body(icon, 200, {
      'content-type': type,
      'cache-control': 'public, max-age=86400',
    })
  } catch {
    // A missing icon only costs the tile its picture; its monogram covers it.
    return c.body(null, 404)
  }
})
// The page-view beacon is public and aggregate-only; it must stay outside the
// authenticated API subapp so the sign-in screen can be counted too.
app.route('/api/traffic', traffic)
// Mounted before the party router: the dive is public and needs no database,
// and `/api/butter` would otherwise claim the whole path.
app.route('/api/butter-dive', butterDive)
app.route('/api/butter', butter)
app.route('/api', api)

/**
 * `/service/` normally belongs to the browser's proxy worker. A frame the site
 * sandboxed cannot be controlled by a service worker, so its requests land here
 * and used to get a 404 — a game's own frame stayed empty. Serve those from the
 * Worker instead. The worker's runtime files stay real static assets.
 */
app.get('/service/*', async (c) => {
  const path = c.req.path
  if (path === '/service/sw.js' || path.startsWith('/service/__uv/')) return c.env.ASSETS.fetch(c.req.raw)
  return serviceFallbackResponse(path, c.req.raw)
})

app.onError((error, c) => {
  console.error(error)
  return c.json({ error: 'Something went wrong.' }, 500)
})
app.notFound(async (c) => {
  if (c.req.path.startsWith('/api/')) return c.json({ error: 'Not found.' }, 404)
  const response = await c.env.ASSETS.fetch(c.req.raw)
  const type = response.headers.get('content-type') || ''
  if (!type.includes('text/html')) return response
  // The static host answers an unknown path with the app's own page. That is
  // right for an app route and wrong for anything else: a proxied request is
  // served by the browser's proxy worker, never by this Worker, so one that
  // arrives here means that worker is not in control. Answering with Ink's
  // HTML puts a page in a script, style or font slot, the browser refuses it
  // ("MIME type text/html is not executable") and the site's own code — a game
  // loader, typically — never runs. A plain 404 is honest and keeps the site
  // running; real static files are served above with their own type.
  const looksLikeFile = /\.[a-z\d]{2,5}$/i.test(c.req.path)
  if (c.req.path.startsWith('/service/') || looksLikeFile) {
    return new Response('Not found.', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
    })
  }
  return response
})

function recordServerError(env: Env, ctx: ExecutionContext, request: Request, response: Response): void {
  if (!env.DB || response.status < 500) return
  try {
    const path = new URL(request.url).pathname.slice(0, 200)
    const now = Date.now()
    ctx.waitUntil(
      env.DB.prepare(`INSERT INTO http_errors (path, status, created_at) VALUES (?, ?, ?)`)
        .bind(path, response.status, now)
        .run()
        .catch(() => undefined),
    )
    // Keep the table bounded without a scheduled job. Expired rows are not
    // useful to the one-hour monitor and contain no user data.
    if (Math.random() < 0.05) {
      ctx.waitUntil(
        env.DB.prepare(`DELETE FROM http_errors WHERE created_at < ?`)
          .bind(now - 30 * 24 * 60 * 60 * 1000)
          .run()
          .catch(() => undefined),
      )
    }
  } catch {
    // Error recording must never replace the original response.
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Sign in with Freebuff owns /auth/freebuff/* and keeps sessions fresh.
    // Without a client ID the app falls back to the loopback development user.
    const auth = getAuth(env, request)
    const handler = (req: Request) => Promise.resolve(app.fetch(req, env, ctx))
    const response = auth ? await auth.wrap(handler)(request) : await handler(request)
    recordServerError(env, ctx, request, response)
    return response
  },
}
