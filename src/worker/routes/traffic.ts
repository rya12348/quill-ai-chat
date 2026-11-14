import { Hono } from 'hono'

import { trafficPath } from '../../shared/traffic'
import { requireDb } from '../db'
import type { AppContext } from '../env'
import { recordTrafficVisit } from '../traffic'

export const traffic = new Hono<AppContext>()

traffic.use('*', requireDb)

/**
 * One anonymous page-view beacon from the app shell. This route is public so
 * it also counts the sign-in screen, but it stores only an aggregate day,
 * one-way visitor hash and a normalized path. No cookies, ids or query
 * strings are read or kept.
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
  const requested = body && typeof body === 'object' ? (body as Record<string, unknown>).path : null
  const path = typeof requested === 'string' ? trafficPath(requested) : null
  if (!path) return c.body(null, 204)

  const task = recordTrafficVisit(c.get('db'), c.req.raw, path).catch(() => undefined)
  try {
    c.executionCtx.waitUntil(task)
  } catch {
    await task
  }
  return c.body(null, 204)
})
