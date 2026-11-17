// First-party, aggregate-only traffic counts. A visitor is a random browser
// id kept in a first-party cookie; only a one-way hash of that id is stored,
// and no query string or share token is kept.

import { ensureSchema } from './db'

export const VISITOR_COOKIE = 'stet_visitor'

const BOT = /(?:bot|crawler|spider|headless|monitoring|uptime|preview|facebookexternalhit|slackbot|curl|wget|python-requests)/i

function base64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function dayKey(at = Date.now()): string {
  return new Date(at).toISOString().slice(0, 10)
}

function isBot(request: Request): boolean {
  const agent = request.headers.get('user-agent') ?? ''
  return !agent || BOT.test(agent)
}

/**
 * A visitor is identified by the stable browser cookie, not by the request
 * address. IP-based hashes split one person across networks, VPNs, IPv6
 * privacy addresses and time. The cookie survives those changes; only its
 * hash is persisted.
 */
async function visitorHash(visitorId: string): Promise<string> {
  const source = `visitor:${visitorId}\nstet-traffic-v2`
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source))
  return base64Url(new Uint8Array(digest)).slice(0, 32)
}

/** Record one anonymous page view from the app's beacon. Failures are non-fatal. */
export async function recordTrafficVisit(db: D1Database, request: Request, path: string, visitorId: string): Promise<void> {
  if (isBot(request)) return
  // The beacon can be the first request after a cold start, so make sure the
  // schema exists before the first insert.
  await ensureSchema(db)
  const visitor = await visitorHash(visitorId)
  const at = Date.now()
  const day = dayKey(at)
  await db
    .prepare(
      `INSERT INTO site_visits (day, visitor_hash, path, hits, last_seen)
       VALUES (?, ?, ?, 1, ?)
       ON CONFLICT(day, visitor_hash, path) DO UPDATE SET
         hits = site_visits.hits + 1,
         last_seen = excluded.last_seen`,
    )
    .bind(day, visitor, path, at)
    .run()

  // Keep the table bounded without a scheduled job.
  if (Math.random() < 0.01) {
    const cutoff = dayKey(at - 400 * 24 * 60 * 60 * 1_000)
    await db.prepare('DELETE FROM site_visits WHERE day < ?').bind(cutoff).run().catch(() => undefined)
  }
}

export { dayKey }
