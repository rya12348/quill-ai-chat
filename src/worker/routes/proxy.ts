import { Hono } from 'hono'

import type { ProxySession } from '../../shared/types'
import { privateJson } from '../auth'
import { now } from '../db'
import { RATE_WINDOWS, rateLimit, tooManyRequests } from '../rate-limit'
import type { AppContext } from '../env'
import { normalizeSiteUrl, webProxyPath, webProxyToken } from '../site-proxy'

export const proxy = new Hono<AppContext>()

type SessionBody = { url?: unknown }

/**
 * The standalone Web Proxy uses the same token-scoped capability routes as a
 * live Build. build_embeds is the lookup table those routes already share, so
 * a session only needs to create one unguessable row; the fetched page, assets,
 * frames and runtime requests then work through the existing proxy.
 */
proxy.post('/session', async (c) => {
  const limit = await rateLimit(c.get('db'), 'proxy:session', c.req.raw, 30, RATE_WINDOWS.proxy)
  if (!limit.allowed) return tooManyRequests(c, limit)
  let body: SessionBody
  try {
    const value = await c.req.json<unknown>()
    body = value && typeof value === 'object' ? (value as SessionBody) : {}
  } catch {
    return privateJson(c, { error: 'invalid_request', message: 'Enter a website address.' }, 400)
  }

  const requested = typeof body.url === 'string' ? body.url.slice(0, 2_000) : ''
  const target = normalizeSiteUrl(requested)
  if (!target) {
    return privateJson(c, { error: 'invalid_url', message: 'Enter a website address.' }, 400)
  }

  // The capability route fetches the page when it is opened, so a session only
  // records the address. Google gets its own title because /proxy opens on
  // Google; every other site is named by its host.
  const host = new URL(target).hostname.replace(/^www\./i, '').toLowerCase()
  const page = { finalUrl: target, title: host === 'google.com' ? 'Google' : host }

  const db = c.get('db')
  const token = webProxyToken()
  const createdAt = now()
  await db
    .prepare(`INSERT INTO build_embeds (token, message_id, owner_sub, url, created_at) VALUES (?, ?, ?, ?, ?)`)
    .bind(token, `proxy-tool:${crypto.randomUUID()}`, c.get('user').sub, page.finalUrl, createdAt)
    .run()
  // Standalone proxy capabilities are not tied to a saved message, so expire
  // them instead of keeping every visited URL valid forever. Build tokens stay
  // attached to their message and are removed with it.
  if (Math.random() < 0.02) {
    await db
      .prepare(`DELETE FROM build_embeds WHERE message_id LIKE 'proxy-tool:%' AND created_at < ?`)
      .bind(createdAt - 7 * 24 * 60 * 60 * 1_000)
      .run()
      .catch(() => undefined)
  }

  const session: ProxySession = {
    url: page.finalUrl,
    title: page.title,
    proxyPath: webProxyPath(token),
  }
  return privateJson(c, { session }, 201)
})
