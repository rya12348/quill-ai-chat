// First-party, aggregate-only traffic counts. A visitor is identified by a
// one-way hash of the address and user agent; the raw address is never stored,
// and no query string or share token is kept.

import { ensureSchema } from './db'
import { clientAddress } from './rate-limit'

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

async function visitorHash(request: Request): Promise<string> {
  // The hash is stable so "all time visitors" means people, not page loads.
  // It contains no readable address or browser string.
  const source = `${clientAddress(request)}\n${request.headers.get('user-agent') ?? ''}\nstet-traffic-v1`
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source))
  return base64Url(new Uint8Array(digest)).slice(0, 32)
}

/** Record one anonymous page view from the app's beacon. Failures are non-fatal. */
export async function recordTrafficVisit(db: D1Database, request: Request, path: string): Promise<void> {
  if (isBot(request)) return
  // The beacon can be the first request after a cold start, so make sure the
  // schema exists before the first insert.
  await ensureSchema(db)
  const visitor = await visitorHash(request)
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
