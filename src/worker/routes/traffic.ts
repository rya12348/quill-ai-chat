import { Hono } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'

import { isVisitorId, trafficPath } from '../../shared/traffic'
import { requireDb } from '../db'
import type { AppContext } from '../env'
import { recordTrafficVisit, VISITOR_COOKIE } from '../traffic'

export const traffic = new Hono<AppContext>()

traffic.use('*', requireDb)

/**
 * One anonymous page-view beacon from the app shell. This route is public so
 * it also counts the sign-in screen, but it stores only an aggregate day,
 * one-way visitor hash and a normalized path. The first-party visitor cookie
 * is random and contains no account, address or browser details.
 */
traffic.post('/', async (c) => {
  c.header('Cache-Control', 'private, no-store')
  // A browser sets this on same-origin POSTs. Foreign pages cannot inflate
  // the counts through a normal cross-site form or fetch.
  const site = c.req.header('sec-fetch-site')
  if (site && site !== 'same-origin') return c.body(null, 204)

  const raw = await c.req.text()
  if (raw.length > 2_048) return c.body(null, 204)
  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return c.body(null, 204)
  }
  const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : null
  const requested = payload?.path
  const path = typeof requested === 'string' ? trafficPath(requested) : null
  if (!path) return c.body(null, 204)

  // The app sends the same id from every beacon, including the two effects
  // React can fire on a first load before the response cookie is stored. The
  // cookie wins once it exists; the body id is the fallback when storage is
  // restricted or the cookie was cleared.
  const existing = getCookie(c, VISITOR_COOKIE)
  const claimed = payload && typeof payload.visitorId === 'string' ? payload.visitorId : undefined
  const bodyVisitorId = isVisitorId(claimed) ? claimed : undefined
  const visitorId = isVisitorId(existing) ? existing : bodyVisitorId ?? crypto.randomUUID()
  if (existing !== visitorId) {
    setCookie(c, VISITOR_COOKIE, visitorId, {
      httpOnly: true,
      secure: new URL(c.req.url).protocol === 'https:',
      sameSite: 'Lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    })
  }

  const task = recordTrafficVisit(c.get('db'), c.req.raw, path, visitorId).catch(() => undefined)
  try {
    c.executionCtx.waitUntil(task)
  } catch {
    await task
  }
  return c.body(null, 204)
})
