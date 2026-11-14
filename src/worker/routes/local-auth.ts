import { Hono, type Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'

import type { AppContext } from '../env'
import {
  ACCOUNT_COOKIE,
  GUEST_COOKIE,
  allowsMutation,
  appOrigin,
  createAccountSession,
  deleteAccountSession,
  hashPassword,
  verifyPassword,
} from '../auth'
import { requireDb } from '../db'
import { RATE_WINDOWS, rateLimit, tooManyRequests } from '../rate-limit'

export const localAuth = new Hono<AppContext>()

localAuth.use('*', requireDb)

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SESSION_MAX_AGE = 60 * 60 * 24 * 30

function safeReturnTo(value: unknown): string {
  if (typeof value !== 'string') return '/'
  if (!value.startsWith('/') || value.startsWith('//') || /[\r\n]/.test(value)) return '/'
  return value.slice(0, 2048)
}

function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase().slice(0, 254) : ''
}

function acceptedPassword(value: unknown): string | null {
  if (typeof value !== 'string') return null
  if (value.length < 8 || value.length > 200) return null
  return value
}

function startSession(c: Context<AppContext>, token: string): void {
  setCookie(c, ACCOUNT_COOKIE, token, {
    httpOnly: true,
    secure: new URL(appOrigin(c.env, c.req.raw)).protocol === 'https:',
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
  // Signing into an account should not leave the visitor acting as a guest in
  // another tab or after a sign-out.
  deleteCookie(c, GUEST_COOKIE, { path: '/' })
}

localAuth.post('/register', async (c) => {
  if (!allowsMutation(c.env, c.req.raw)) return c.json({ error: 'Cross-origin request refused.' }, 403)
  const limit = await rateLimit(c.get('db'), 'auth:register', c.req.raw, 5, RATE_WINDOWS.auth)
  if (!limit.allowed) return tooManyRequests(c, limit)
  const raw = (await c.req.json<{ email?: unknown; password?: unknown; returnTo?: unknown }>().catch(() => null)) ?? {}
  const email = normalizeEmail(raw.email)
  const password = acceptedPassword(raw.password)
  if (!EMAIL.test(email)) return c.json({ error: 'invalid_email', message: 'Enter a valid email address.' }, 400)
  if (!password) return c.json({ error: 'invalid_password', message: 'Use a password with at least 8 characters.' }, 400)

  try {
    const db = c.get('db')
    const existing = await db.prepare(`SELECT id FROM auth_users WHERE email = ?`).bind(email).first<{ id: string }>()
    if (existing) return c.json({ error: 'email_taken', message: 'An account with that email already exists.' }, 409)

    const id = crypto.randomUUID()
    const passwordHash = await hashPassword(password)
    try {
      await db
        .prepare(`INSERT INTO auth_users (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)`)
        .bind(id, email, passwordHash, email.split('@')[0], Date.now())
        .run()
    } catch (error) {
      // A simultaneous registration can win the unique constraint. Other D1
      // failures should surface as a server error instead of a false conflict.
      const message = error instanceof Error ? error.message : String(error)
      if (/UNIQUE|constraint/i.test(message)) {
        return c.json({ error: 'email_taken', message: 'An account with that email already exists.' }, 409)
      }
      throw error
    }

    // Analytics and workspace features count a person as a user at account
    // creation, before the first app-shell request reaches /api/me.
    await db
      .prepare(`INSERT OR IGNORE INTO users (owner_sub, created_at) VALUES (?, ?)`)
      .bind(`account:${id}`, Date.now())
      .run()
      .catch(() => undefined)

    const token = await createAccountSession(db, id)
    startSession(c, token)
    c.header('Cache-Control', 'private, no-store')
    return c.json({ ok: true, returnTo: safeReturnTo(raw.returnTo) }, 201)
  } catch (error) {
    console.error('register failed', error)
    return c.json({ error: 'register_failed', message: 'Something went wrong. Try again.' }, 500)
  }
})

localAuth.post('/login', async (c) => {
  if (!allowsMutation(c.env, c.req.raw)) return c.json({ error: 'Cross-origin request refused.' }, 403)
  const limit = await rateLimit(c.get('db'), 'auth:login', c.req.raw, 10, RATE_WINDOWS.auth)
  if (!limit.allowed) return tooManyRequests(c, limit)
  const raw = (await c.req.json<{ email?: unknown; password?: unknown; returnTo?: unknown }>().catch(() => null)) ?? {}
  const email = normalizeEmail(raw.email)
  const password = acceptedPassword(raw.password)
  if (!EMAIL.test(email) || !password) {
    return c.json({ error: 'invalid_login', message: 'Enter your email and password.' }, 400)
  }

  const db = c.get('db')
  const row = await db
    .prepare(`SELECT id, password_hash FROM auth_users WHERE email = ?`)
    .bind(email)
    .first<{ id: string; password_hash: string }>()
  if (!row || !(await verifyPassword(password, row.password_hash))) {
    return c.json({ error: 'invalid_login', message: 'That email or password is incorrect.' }, 401)
  }

  await db
    .prepare(`INSERT OR IGNORE INTO users (owner_sub, created_at) VALUES (?, ?)`)
    .bind(`account:${row.id}`, Date.now())
    .run()
    .catch(() => undefined)

  const token = await createAccountSession(db, row.id)
  startSession(c, token)
  c.header('Cache-Control', 'private, no-store')
  return c.json({ ok: true, returnTo: safeReturnTo(raw.returnTo) })
})

localAuth.post('/logout', async (c) => {
  if (!allowsMutation(c.env, c.req.raw)) return c.json({ error: 'Cross-origin request refused.' }, 403)
  const token = getCookie(c, ACCOUNT_COOKIE)
  if (token) await deleteAccountSession(c.get('db'), token)
  deleteCookie(c, ACCOUNT_COOKIE, { path: '/' })
  c.header('Cache-Control', 'private, no-store')
  return c.json({ ok: true })
})
