import { Hono } from 'hono'

import { aiConfigured } from './ai'
import { appOrigin, authMode, getAuth, isCodespacesRequest, requireUser } from './auth'
import { requireDb } from './db'
import type { AppContext, Env } from './env'
import { isPokiGameId, isPokiGameWrapperUrl, isSafeGameSegment, pokiGameStartUrl, proxyPokiGameAsset } from './poki-game'
import { escapeHtml, fetchSiteAsset, fetchSitePage, fetchSiteRequest, googleSearchQuery, googleTopResult, installFrameBridge, isWebProxyToken, normalizeSiteUrl, renderProxyPage, renderSearchResults, resolveProxyTarget, rewriteAssetContent, SiteError, webProxyPath } from './site-proxy'
import { account } from './routes/account'
import { analysis } from './routes/analysis'
import { artifacts } from './routes/artifacts'
import { attachments } from './routes/attachments'
import { chat } from './routes/chat'
import { conversations } from './routes/conversations'
import { messages } from './routes/messages'
import { proof } from './routes/proof'
import { projects } from './routes/projects'
import { providers } from './routes/providers'
import { review } from './routes/review'
import { settings } from './routes/settings'
import { shares } from './routes/shares'

const app = new Hono<AppContext>()

// The loopback preview hostname exists only to isolate browsed sites from the
// app origin. It must not serve Quill itself: development auth does not require
// a cookie, so exposing app APIs there would defeat the isolation.
app.use('*', async (c, next) => {
  if (!isIsolatedPreviewRequest(c.req.raw)) return next()
  const path = new URL(c.req.url).pathname
  if (path.startsWith('/api/web-proxy/') || path.startsWith('/api/poki-game/')) return next()
  return c.notFound()
})

app.get('/api/auth/status', (c) => {
  c.header('Cache-Control', 'private, no-store')
  return c.json({ mode: authMode(c.env, c.req.raw), database: Boolean(c.env.DB), ai: aiConfigured(c.env) })
})
app.get('/api/health', (c) => c.json({ ok: true }))

const ASSET_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS',
  'access-control-allow-headers': '*, authorization, content-type, accept, x-requested-with, x-api-key, range',
  'cross-origin-resource-policy': 'cross-origin',
  'cache-control': 'private, max-age=300',
  'x-content-type-options': 'nosniff',
}

const PROXY_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'private, no-store',
  'content-security-policy':
    // No frame-ancestors: the unguessable token is the capability, and a
    // sandboxed (opaque-origin) document cannot match 'self' reliably.
    "sandbox allow-scripts allow-forms allow-pointer-lock allow-popups allow-modals allow-downloads; default-src * data: blob:; script-src * 'unsafe-inline' 'unsafe-eval' data: blob:; style-src * 'unsafe-inline'; img-src * data: blob:; font-src * data:; connect-src *; media-src * data: blob:; frame-src *; worker-src * blob:; object-src 'none'; base-uri *; form-action https://*.google.com https://google.com",
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'x-robots-tag': 'noindex, nofollow',
}

/**
 * Loopback development serves the same app on a second hostname so the live
 * preview is a different origin from Quill (and from its session). Only that
 * hostname may keep a real origin inside the sandbox: sites such as FreezeNova
 * write their game into an about:blank frame, which needs same-origin access,
 * and remote code there then still cannot reach the app origin.
 */
const ISOLATED_PREVIEW_HOST = 'quill-preview.localhost'

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
  // never completes. The isolated host is still cross-origin from Quill and the
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

app.options('/api/web-proxy/:token/p/*', (c) => c.body(null, 204, ASSET_HEADERS))
app.options('/api/web-proxy/:token/net', (c) => c.body(null, 204, ASSET_HEADERS))

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
  try {
    const result = await fetchSiteRequest(target, c.req.raw)
    const noBody = c.req.method === 'HEAD' || result.status === 204 || result.status === 304
    return new Response(noBody ? null : result.body, {
      status: result.status,
      headers: {
        ...ASSET_HEADERS,
        'content-type': result.contentType,
        'cache-control': 'private, no-store',
      },
    })
  } catch (error) {
    if (!(error instanceof SiteError)) console.error(error)
    const failure = error instanceof SiteError ? error : new SiteError(502, 'That request could not be completed.')
    return new Response(failure.message, {
      status: failure.status,
      headers: { 'content-type': 'text/plain; charset=utf-8', ...ASSET_HEADERS },
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
    const asset = await fetchSiteAsset(target, c.req.raw.signal)
    return c.body(rewriteAssetContent(asset.body, asset.contentType, target, proxyUrl), 200, {
      ...ASSET_HEADERS,
      'content-type': asset.contentType,
    })
  } catch (error) {
    const failure = error instanceof SiteError ? error : new SiteError(502, 'The asset could not be loaded.')
    if (!(error instanceof SiteError)) console.error(error)
    return c.body(failure.message, failure.status === 413 ? 413 : failure.status === 504 ? 504 : 502, {
      'content-type': 'text/plain; charset=utf-8',
      ...ASSET_HEADERS,
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
  const target = resolveProxyTarget(storedUrl, c.req.query('url'))
  if (!target) return c.body('That page is not available.', 400, { 'content-type': 'text/plain; charset=utf-8' })
  const proxyOrigin = proxyOriginFor(c.env, c.req.raw)
  const proxyUrl = new URL(webProxyPath(token), proxyOrigin).href
  // Codespaces requires its own authorisation for navigations started in a
  // sandboxed frame. Let Quill's parent page perform them instead.
  const parentNavigation = isCodespacesRequest(c.env, c.req.raw)
  try {
    const query = googleSearchQuery(target)
    if (query) {
      const top = await googleTopResult(query, c.req.raw.signal)
      const results = top
        ? [
            {
              title: new URL(top).hostname.replace(/^www\./, ''),
              url: top,
              snippet: `Google's top result for “${query}”. Open it inside this preview.`,
            },
          ]
        : []
      return c.body(renderProxyPage(renderSearchResults(query, target, results), target, proxyUrl, parentNavigation, isIsolatedPreviewRequest(c.req.raw)), 200, proxyPageHeaders(c.req.raw))
    }
    const page = await fetchSitePage(target, c.req.raw.signal)
    // Every page gets the frame bridge, not only Poki. Any iframe a site
    // creates is moved behind the same capability proxy, so a game, map,
    // video or docs frame cannot escape into a new browser tab. The wrapper
    // resolver is only used for hosts whose game assets reject our referrer.
    const html = installFrameBridge(page.html, {
      proxyUrl,
      gameStartUrl: new URL(`/api/poki-game/start/${token}`, proxyOrigin).href,
      gameHosts: ['games.poki.com'],
      parentNavigation,
    })
    return c.body(renderProxyPage(html, page.finalUrl, proxyUrl, parentNavigation, isIsolatedPreviewRequest(c.req.raw)), 200, proxyPageHeaders(c.req.raw))
  } catch (error) {
    if (!(error instanceof SiteError)) console.error(error)
    const failure = error instanceof SiteError ? error : new SiteError(502, 'The site could not be loaded.')
    const message = escapeHtml(failure.message)
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Preview unavailable</title><style>body{margin:0;font:16px/1.6 system-ui,sans-serif;background:#f6f4ef;color:#24221d}main{max-width:620px;margin:14vh auto;padding:0 28px}h1{font-size:2rem;line-height:1.1;letter-spacing:-.03em;margin:0 0 .5em}p{color:#6f695f}</style></head><body><main><h1>Preview unavailable</h1><p>${message}</p></main></body></html>`
    const status = failure.status === 400 ? 400 : failure.status === 413 ? 413 : failure.status === 415 ? 415 : failure.status === 504 ? 504 : 502
    return c.body(html, status, { ...PROXY_HEADERS, 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'" })
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
  const start = await pokiGameStartUrl(wrapperUrl, token, proxyOriginFor(c.env, c.req.raw), c.req.raw.signal)
  if (!start) return c.body('Game unavailable.', 502, { 'content-type': 'text/plain; charset=utf-8' })
  c.header('cache-control', 'private, no-store')
  return c.redirect(start, 302)
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
    )
  } catch (error) {
    console.error(error)
    return c.body('Game unavailable.', 502, { 'content-type': 'text/plain; charset=utf-8' })
  }
})

const api = new Hono<AppContext>()
api.use('*', requireUser, requireDb)
api.route('/', account)
api.route('/analysis', analysis)
api.route('/artifacts', artifacts)
api.route('/attachments', attachments)
api.route('/conversations', conversations)
api.route('/chat', chat)
api.route('/messages', messages)
api.route('/proof', proof)
api.route('/projects', projects)
api.route('/providers', providers)
api.route('/review', review)
api.route('/settings', settings)
// Public read-only links live outside the authenticated /api subapp. The
// random token is scoped to one conversation and only GET is implemented.
app.route('/api/share', shares)
app.route('/api', api)

app.onError((error, c) => {
  console.error(error)
  return c.json({ error: 'Something went wrong.' }, 500)
})
app.notFound((c) => (c.req.path.startsWith('/api/') ? c.json({ error: 'Not found.' }, 404) : c.env.ASSETS.fetch(c.req.raw)))

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Sign in with Freebuff owns /auth/freebuff/* and keeps sessions fresh.
    // Without a client ID the app falls back to the loopback development user.
    const auth = getAuth(env, request)
    const handler = (req: Request) => Promise.resolve(app.fetch(req, env, ctx))
    return auth ? auth.wrap(handler)(request) : handler(request)
  },
}
