import { Hono } from 'hono'

import type { TrafficDay, TrafficPage, TrafficSummary } from '../../shared/types'
import { isLocalTunnelHost } from '../../shared/traffic'
import { isGuestUser, isOwner, privateJson, requireUser } from '../auth'
import { requireDb } from '../db'
import type { AppContext } from '../env'
import { dayKey } from '../traffic'

export const analytics = new Hono<AppContext>()

analytics.use('*', requireDb, requireUser)

analytics.get('/summary', async (c) => {
  const user = c.get('user')
  // Aggregate traffic is for signed-in people (email or Freebuff), including
  // the configured owner, but not anonymous guests. A local development tunnel
  // has no hosted sign-in, so its guest session may read the same aggregate
  // counts; this does not apply to a normal deployment.
  const tunnel = isLocalTunnelHost(new URL(c.req.url).hostname)
  if (isGuestUser(user) && !tunnel && !isOwner(c.env, user, c.req.raw)) {
    return privateJson(c, { error: 'forbidden', message: 'Sign in to view traffic.' }, 403)
  }

  const db = c.get('db')
  const today = dayKey()
  const weekStart = dayKey(Date.now() - 6 * 24 * 60 * 60 * 1_000)
  const monthStart = dayKey(Date.now() - 29 * 24 * 60 * 60 * 1_000)

  const [dailyResult, totalResult, weekResult, pagesResult] = await Promise.all([
    db
      .prepare(
        `SELECT day, COUNT(DISTINCT visitor_hash) AS visitors, COALESCE(SUM(hits), 0) AS views
           FROM site_visits
          WHERE day >= ?
          GROUP BY day
          ORDER BY day DESC`,
      )
      .bind(monthStart)
      .all<{ day: string; visitors: number; views: number }>(),
    db
      .prepare(
        `SELECT COUNT(DISTINCT visitor_hash) AS visitors, COALESCE(SUM(hits), 0) AS views
           FROM site_visits`,
      )
      .first<{ visitors: number; views: number }>(),
    db
      .prepare(
        `SELECT COUNT(DISTINCT visitor_hash) AS visitors, COALESCE(SUM(hits), 0) AS views
           FROM site_visits
          WHERE day >= ?`,
      )
      .bind(weekStart)
      .first<{ visitors: number; views: number }>(),
    db
      .prepare(
        `SELECT path, COUNT(DISTINCT visitor_hash) AS visitors, COALESCE(SUM(hits), 0) AS views
           FROM site_visits
          WHERE day >= ?
          GROUP BY path
          ORDER BY views DESC, path ASC
          LIMIT 8`,
      )
      .bind(monthStart)
      .all<{ path: string; visitors: number; views: number }>(),
  ])

  const days: TrafficDay[] = dailyResult.results.map((row) => ({
    day: String(row.day),
    visitors: Number(row.visitors ?? 0),
    views: Number(row.views ?? 0),
  }))
  const topPages: TrafficPage[] = pagesResult.results.map((row) => ({
    path: String(row.path),
    visitors: Number(row.visitors ?? 0),
    views: Number(row.views ?? 0),
  }))
  const todayRow = days.find((row) => row.day === today)
  const body: TrafficSummary = {
    today: { visitors: todayRow?.visitors ?? 0, views: todayRow?.views ?? 0 },
    last7Days: { visitors: Number(weekResult?.visitors ?? 0), views: Number(weekResult?.views ?? 0) },
    allTime: { visitors: Number(totalResult?.visitors ?? 0), views: Number(totalResult?.views ?? 0) },
    days,
    topPages,
    updatedAt: Date.now(),
  }
  return privateJson(c, body)
})
