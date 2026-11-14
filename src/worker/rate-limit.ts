import type { Context } from 'hono'

import type { AppContext } from './env'

const DAY_MS = 24 * 60 * 60 * 1_000

function base64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Cloudflare sets the first header; the fallbacks keep local development sane. */
export function clientAddress(request: Request): string {
  return (
    request.headers.get('cf-connecting-ip')?.trim() ||
    request.headers.get('x-real-ip')?.trim() ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  ).slice(0, 128)
}

/** Never store a raw IP or account id in the rate-limit table. */
async function bucketKey(scope: string, value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return `${scope}:${base64Url(new Uint8Array(digest)).slice(0, 24)}`
}

async function clientKey(scope: string, request: Request): Promise<string> {
  return bucketKey(scope, clientAddress(request))
}

/**
 * A stable, hashed guest-usage key. It deliberately ignores the guest cookie:
 * clearing that cookie must not reset the daily allowance. The address itself
 * is never stored.
 */
export async function guestUsageKey(request: Request): Promise<string> {
  return clientKey('guest-usage', request)
}

export type RateLimitResult = {
  allowed: boolean
  retryAfter: number
  remaining: number
}

/**
 * Fixed-window, per-IP limiter backed by D1 so it works across Worker isolates.
 * The bucket key is a hash, not an address. The SQL update is atomic, including
 * the reset branch, so simultaneous requests cannot both start a fresh window.
 */
export async function rateLimit(
  db: D1Database,
  scope: string,
  request: Request,
  limit: number,
  windowMs: number,
  subject?: string,
): Promise<RateLimitResult> {
  const now = Date.now()
  const resetAt = now + windowMs
  // Auth and public routes are limited by address. Signed-in browser sessions
  // are limited by account so one person cannot exhaust a shared network's
  // budget, and our own retries do not lock out another account on that IP.
  const bucket = subject ? await bucketKey(`${scope}:user`, subject) : await clientKey(scope, request)
  const row = await db
    .prepare(
      `INSERT INTO rate_limits (bucket, count, reset_at)
       VALUES (?, 1, ?)
       ON CONFLICT(bucket) DO UPDATE SET
         count = CASE WHEN rate_limits.reset_at <= ? THEN 1 ELSE rate_limits.count + 1 END,
         reset_at = CASE WHEN rate_limits.reset_at <= ? THEN excluded.reset_at ELSE rate_limits.reset_at END
       RETURNING count, reset_at`,
    )
    .bind(bucket, resetAt, now, now)
    .first<{ count: number; reset_at: number }>()

  if (!row) return { allowed: false, retryAfter: 60, remaining: 0 }
  // A fixed-window table would otherwise grow with every rotated address.
  // Delete long-expired buckets occasionally instead of on every request.
  if (Math.random() < 0.02) {
    await db
      .prepare('DELETE FROM rate_limits WHERE reset_at < ?')
      .bind(now - DAY_MS)
      .run()
      .catch(() => undefined)
  }

  const count = Number(row.count)
  const until = Number(row.reset_at)
  return {
    allowed: count <= limit,
    retryAfter: Math.max(1, Math.ceil((until - now) / 1_000)),
    remaining: Math.max(0, limit - count),
  }
}

export function tooManyRequests(c: Context<AppContext>, result: RateLimitResult) {
  c.header('Retry-After', String(result.retryAfter))
  return c.json(
    { error: 'rate_limited', message: 'Too many requests. Wait a moment and try again.', retryAfter: result.retryAfter },
    429,
  )
}

/** A small helper for routes that only need a boolean decision. */
export async function allowRequest(
  db: D1Database,
  scope: string,
  request: Request,
  limit: number,
  windowMs = 10 * 60_000,
): Promise<boolean> {
  return (await rateLimit(db, scope, request, limit, windowMs)).allowed
}

export const RATE_WINDOWS = {
  auth: 15 * 60_000,
  guest: 60_000,
  chat: 10 * 60_000,
  browser: 60 * 60_000,
  share: 10 * 60_000,
  proxy: 10 * 60_000,
  day: DAY_MS,
} as const
