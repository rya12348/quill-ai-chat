import { Hono } from 'hono'

import { aiConfigured } from './ai'
import { authMode, getAuth, requireUser } from './auth'
import { requireDb } from './db'
import type { AppContext, Env } from './env'
import { installPokiGameBridge, isPokiGameId, isPokiGameWrapperUrl, isPokiPage, pokiGameStartUrl, proxyPokiGameAsset } from './poki-game'
import { escapeHtml, fetchSitePage, isWebProxyToken, normalizeSiteUrl, renderProxyPage, SiteError, webProxyPath } from './site-proxy'
import { account } from './routes/account'
import { analysis } from './routes/analysis'
import { attachments } from './routes/attachments'
import { chat } from './routes/chat'
import { conversations } from './routes/conversations'
import { messages } from './routes/messages'
import { proof } from './routes/proof'
import { projects } from './routes/projects'
import { providers } from './routes/providers'
import { settings } from './routes/settings'
import { shares } from './routes/shares'

const app = new Hono<AppContext>()

app.get('/api/auth/status', (c) => {
  c.header('Cache-Control', 'private, no-store')
  return c.json({ mode: authMode(c.env, c.req.raw), database: Boolean(c.env.DB), ai: aiConfigured(c.env) })
})
app.get('/api/health', (c) => c.json({ ok: true }))

const PROXY_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'private, no-store',
  'content-security-policy':
    "sandbox allow-scripts allow-popups allow-modals allow-downloads; default-src * data: blob:; script-src * 'unsafe-inline' 'unsafe-eval' data: blob:; style-src * 'unsafe-inline'; img-src * data: blob:; font-src * data:; connect-src *; media-src * data: blob:; frame-src *; worker-src * blob:; object-src 'none'; base-uri *; form-action 'none'; frame-ancestors 'self'",
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'x-robots-tag': 'noindex, nofollow',
}

/**
 * A token-scoped, read-only live-site proxy. The token is the capability: it
 * lets a sandboxed preview load one saved site without sending the signed-in
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
  let target = storedUrl
  const requested = c.req.query('url')
  if (requested) {
    const next = normalizeSiteUrl(requested)
    if (!next) return c.body('That page is not available.', 400, { 'content-type': 'text/plain; charset=utf-8' })
    if (new URL(next).origin !== new URL(storedUrl).origin) {
      return c.body('Navigation is limited to this site.', 403, { 'content-type': 'text/plain; charset=utf-8' })
    }
    target = next
  }
  try {
    const page = await fetchSitePage(target, c.req.raw.signal)
    const proxyUrl = new URL(webProxyPath(token), c.req.url).href
    let html = page.html
    if (isPokiPage(page.finalUrl)) {
      html = installPokiGameBridge(html, token, new URL(proxyUrl).origin)
    }
    return c.body(renderProxyPage(html, page.finalUrl, proxyUrl), 200, PROXY_HEADERS)
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
  const start = await pokiGameStartUrl(wrapperUrl, token, new URL(c.req.url).origin, c.req.raw.signal)
  if (!start) return c.body('Game unavailable.', 502, { 'content-type': 'text/plain; charset=utf-8' })
  c.header('cache-control', 'private, no-store')
  return c.redirect(start, 302)
})

app.get('/api/poki-game/:token/:gameId/:version/:path{.*}', requireDb, async (c) => {
  const token = c.req.param('token')
  if (!isWebProxyToken(token)) return c.body('Game preview not found.', 404, { 'content-type': 'text/plain; charset=utf-8' })
  const gameId = c.req.param('gameId')
  const version = c.req.param('version')
  if (!isPokiGameId(gameId) || !isPokiGameId(version)) {
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
api.route('/attachments', attachments)
api.route('/conversations', conversations)
api.route('/chat', chat)
api.route('/messages', messages)
api.route('/proof', proof)
api.route('/projects', projects)
api.route('/providers', providers)
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
