import { createFreebuffAuth, isSameOriginRequest } from '@freebuff/auth'
import type { FreebuffAuth, FreebuffUser } from '@freebuff/auth'
import { getCookie } from 'hono/cookie'
import type { Context, MiddlewareHandler } from 'hono'

import type { AppContext, Env } from './env'

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]'])
const CODESPACES_HOST = /\.(?:app\.github\.dev|githubpreview\.dev)$/i

/** Whether a configured origin points back at this machine. */
function isLoopbackOrigin(value: string): boolean {
  try {
    return LOOPBACK.has(new URL(value).hostname)
  } catch {
    return false
  }
}

function isCodespacesOrigin(value: string): boolean {
  try {
    return CODESPACES_HOST.test(new URL(value).hostname)
  } catch {
    return false
  }
}

/**
 * Codespaces terminates TLS at its proxy and forwards the request to the
 * loopback dev server. Use the public host the browser actually visited so
 * same-origin mutation checks and generated preview URLs do not point at
 * 127.0.0.1.
 */
function forwardedCodespacesOrigin(request: Request): string | undefined {
  const host = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
  if (!host) return undefined
  let url: URL
  try {
    url = new URL(`https://${host}`)
  } catch {
    return undefined
  }
  if (!CODESPACES_HOST.test(url.hostname)) return undefined
  const proto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase()
  if (proto && proto !== 'https') return undefined
  return url.origin
}

function isCodespacesHost(request: Request): boolean {
  return CODESPACES_HOST.test(new URL(request.url).hostname) || Boolean(forwardedCodespacesOrigin(request))
}

// Public addresses that are allowed to reach this deployment. These stay
// fixed so a custom domain keeps working even if a stale APP_ORIGIN is
// deployed by another process.
const PUBLIC_ORIGINS = new Set([
  'https://ink.7394.jo3.org',
  'https://www.7394.jo3.org',
  'https://7394.jo3.org',
  'https://ink-jo3.pages.dev',
  // The same deployment on a hostname that is not under jo3.org. A network
  // filter that blocks the jo3.org domain cannot reach the custom domain, so
  // this origin has to be able to sign in and accept its own mutations.
  'https://ink-harbor-2f9.pages.dev',
  // The public .org address the app moved to (a CNAME to the Pages project).
  'https://www.inkbrowser.dpdns.org',
  'https://inkbrowser.dpdns.org',
])

function publicForwardedOrigin(request: Request): string | undefined {
  const host = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
  if (!host) return undefined
  const origin = `https://${host}`
  return PUBLIC_ORIGINS.has(origin) ? origin : undefined
}

/**
 * Codespaces is a development origin. Use the development identity when no
 * client ID is configured, or when the auth config still points at loopback
 * (the usual local `.env.local` auth example). A deliberately public
 * `APP_ORIGIN` with a client ID stays real auth.
 */
function codespacesDevelopment(env: Env, request: Request): boolean {
  if (!isCodespacesHost(request)) return false
  if (!env.FREEBUFF_CLIENT_ID) return true
  const configured = env.APP_ORIGIN?.trim()
  return !configured || isLoopbackOrigin(configured) || isCodespacesOrigin(configured)
}

// One development identity, honoured only on loopback or a GitHub Codespaces
// preview origin. That includes a Codespace carrying the local loopback auth
// example, but never a normal deployed origin or a public APP_ORIGIN.
export const DEV_USER: FreebuffUser = {
  sub: 'dev-user',
  name: 'Alex Morgan',
  email: 'alex@example.com',
  email_verified: true,
}

/** Cookie that scopes a signed-out visitor to one anonymous browser session. */
export const GUEST_COOKIE = 'stet_guest'

/** First-party email/password session cookie. */
export const ACCOUNT_COOKIE = 'stet_account'
const ACCOUNT_SESSION_TTL = 60 * 60 * 24 * 30
// workerd caps PBKDF2 at 100,000 iterations, so use the strongest supported count.
const PBKDF2_ITERATIONS = 100_000

const GUEST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isGuestId(value: string | undefined): value is string {
  return Boolean(value && GUEST_ID.test(value))
}

export function guestUser(id: string): FreebuffUser {
  return { sub: `guest:${id}`, name: 'Guest', email_verified: false }
}

export function isGuestUser(user: FreebuffUser): boolean {
  return user.sub.startsWith('guest:') && isGuestId(user.sub.slice('guest:'.length))
}

export function isAccountUser(user: FreebuffUser): boolean {
  return user.sub.startsWith('account:')
}

function cookieValue(header: string | undefined, name: string): string | undefined {
  for (const part of (header ?? '').split(';')) {
    const separator = part.indexOf('=')
    if (separator < 0) continue
    if (part.slice(0, separator).trim() === name) return part.slice(separator + 1).trim()
  }
  return undefined
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(value: string): Uint8Array {
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

async function tokenHash(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return toBase64Url(new Uint8Array(digest))
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index]
  return difference === 0
}

/** PBKDF2 password hash; the plaintext password is never stored or logged. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    key,
    256,
  )
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toBase64Url(salt)}$${toBase64Url(new Uint8Array(bits))}`
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [scheme, iterationsRaw, saltRaw, hashRaw] = encoded.split('$')
  if (scheme !== 'pbkdf2' || !iterationsRaw || !saltRaw || !hashRaw) return false
  const iterations = Number(iterationsRaw)
  if (!Number.isInteger(iterations) || iterations < 10_000 || iterations > 500_000) return false
  try {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
    const decodedSalt = fromBase64Url(saltRaw)
    const salt = new Uint8Array(decodedSalt.length)
    salt.set(decodedSalt)
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
      key,
      256,
    )
    return sameBytes(new Uint8Array(bits), fromBase64Url(hashRaw))
  } catch {
    return false
  }
}

/** Create a random session and return the token that goes in the browser cookie. */
export async function createAccountSession(db: D1Database, userId: string): Promise<string> {
  const token = toBase64Url(crypto.getRandomValues(new Uint8Array(32)))
  const createdAt = Date.now()
  await db
    .prepare(`INSERT INTO auth_sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)`)
    .bind(await tokenHash(token), userId, createdAt, createdAt + ACCOUNT_SESSION_TTL * 1_000)
    .run()
  // Keep the session table from growing forever. This is housekeeping; a
  // failed cleanup must never turn a successful sign-in into an error.
  if (Math.random() < 0.02) {
    await db
      .prepare('DELETE FROM auth_sessions WHERE expires_at < ?')
      .bind(createdAt)
      .run()
      .catch(() => undefined)
  }
  return token
}

export async function deleteAccountSession(db: D1Database, token: string): Promise<void> {
  await db.prepare(`DELETE FROM auth_sessions WHERE token_hash = ?`).bind(await tokenHash(token)).run()
}

/** Resolve an email/password session cookie to the same user shape as the app. */
export async function accountUser(db: D1Database, request: Request): Promise<FreebuffUser | null> {
  const token = cookieValue(request.headers.get('cookie') ?? undefined, ACCOUNT_COOKIE)
  if (!token) return null
  const row = await db
    .prepare(
      `SELECT u.id, u.email, u.name
         FROM auth_sessions s
         JOIN auth_users u ON u.id = s.user_id
        WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .bind(await tokenHash(token), Date.now())
    .first<{ id: string; email: string; name: string }>()
  if (!row) return null
  return {
    sub: `account:${row.id}`,
    name: row.name || row.email.split('@')[0] || row.email,
    email: row.email,
    email_verified: true,
  }
}

export function isLoopback(request: Request): boolean {
  return LOOPBACK.has(new URL(request.url).hostname)
}

export function authMode(env: Env, request: Request): 'freebuff' | 'development' | 'off' {
  if (codespacesDevelopment(env, request)) return 'development'
  if (env.FREEBUFF_CLIENT_ID) return 'freebuff'
  if (isLoopback(request)) return 'development'
  return 'off'
}

/**
 * Owner-only perks: the locally running development identity, or one pinned
 * Freebuff account on a deployed copy. Always evaluated on the server.
 */
export function isOwner(env: Env, user: FreebuffUser, request: Request): boolean {
  const configured = env.OWNER_SUB?.trim()
  if (configured) return user.sub === configured
  return authMode(env, request) === 'development' && user.sub === DEV_USER.sub
}

/** The address the request came from, as Cloudflare reports it. */
export function callerAddress(request: Request): string {
  return (request.headers.get('cf-connecting-ip') || '').trim()
}

/**
 * Whether this request belongs to the person who runs the deployment.
 *
 * Two ways to be that person, because the deployment may not have accounts at
 * all: the owner account (OWNER_SUB) when auth is on, or the address in
 * AGENT_OWNER_IPS when it is not. With neither configured nobody matches, which
 * is the safe default for a switch that removes spending limits.
 */
export function isDeploymentOwner(env: Env, user: FreebuffUser, request: Request): boolean {
  if (isOwner(env, user, request)) return true
  const address = callerAddress(request)
  if (!address) return false
  const allowed = (env.AGENT_OWNER_IPS ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
  return allowed.includes(address)
}

let cached: { key: string; auth: FreebuffAuth } | undefined

/** One auth instance per isolate; recreated only if the config changes. */
export function getAuth(env: Env, request: Request): FreebuffAuth | null {
  if (!env.FREEBUFF_CLIENT_ID || authMode(env, request) !== 'freebuff') return null
  const baseUrl = appOrigin(env, request)
  const key = `${env.FREEBUFF_CLIENT_ID}|${env.FREEBUFF_ISSUER ?? ''}|${baseUrl}`
  if (cached?.key !== key) {
    cached = {
      key,
      auth: createFreebuffAuth({
        clientId: env.FREEBUFF_CLIENT_ID,
        issuer: env.FREEBUFF_ISSUER || undefined,
        baseUrl,
        allowInsecureLocalhost: new URL(baseUrl).protocol === 'http:' && LOOPBACK.has(new URL(baseUrl).hostname),
      }),
    }
  }
  return cached.auth
}

export async function currentUser(env: Env, request: Request): Promise<FreebuffUser | null> {
  const mode = authMode(env, request)
  if (mode === 'development') return DEV_USER
  if (mode !== 'freebuff') return null
  const auth = getAuth(env, request)
  return auth ? auth.getUser(request) : null
}

export function appOrigin(env: Env, request: Request): string {
  const configured = env.APP_ORIGIN?.trim()
  const forwarded = forwardedCodespacesOrigin(request)
  // A loopback origin is what the auth example writes locally. In Codespaces
  // the browser is on the forwarded HTTPS origin, so use that instead. A
  // configured public APP_ORIGIN stays authoritative.
  if (forwarded && (!configured || isLoopbackOrigin(configured))) return forwarded
  // Pages forwards the original host. Keep the custom domain canonical even
  // when an older APP_ORIGIN is still deployed.
  const publicForwarded = publicForwardedOrigin(request)
  if (publicForwarded) return publicForwarded
  const requestOrigin = new URL(request.url).origin
  if (PUBLIC_ORIGINS.has(requestOrigin)) return requestOrigin
  if (configured) return configured
  return requestOrigin
}

/** True for the public or forwarded host of a GitHub Codespace. */
export function isCodespacesRequest(env: Env, request: Request): boolean {
  if (CODESPACES_HOST.test(new URL(request.url).hostname)) return true
  try {
    return CODESPACES_HOST.test(new URL(appOrigin(env, request)).hostname)
  } catch {
    return false
  }
}

function featureFlag(value: string | undefined): boolean | undefined {
  if (value === '1' || value === 'true') return true
  if (value === '0' || value === 'false') return false
  return undefined
}

/** Free-only modes are on by default in the Codespaces development preview. */
export function researchEnabledFor(env: Env, request: Request): boolean {
  return featureFlag(env.RESEARCH_ENABLED) ?? isCodespacesRequest(env, request)
}

export function analyzeEnabledFor(env: Env, request: Request): boolean {
  return featureFlag(env.ANALYZE_ENABLED) ?? isCodespacesRequest(env, request)
}

/** Build is opt-in, except on the Codespaces development preview. */
export function buildEnabledFor(env: Env, request: Request): boolean {
  return featureFlag(env.BUILD_ENABLED) ?? isCodespacesRequest(env, request)
}

/**
 * Browser-set Sec-Fetch-Site is a same-origin signal even when a local proxy
 * rewrites the Host and the Origin header uses the public address. Keep this
 * fallback to development only; authenticated deployments use the exact
 * configured APP_ORIGIN.
 */
export function allowsMutation(env: Env, request: Request): boolean {
  const origin = request.headers.get('origin')?.trim()
  if (origin && PUBLIC_ORIGINS.has(origin)) return true
  // A stale APP_ORIGIN must not break the origin that is actually serving the
  // app. The browser's Origin header matching the request URL is the same
  // same-origin signal, independent of deployment configuration.
  try {
    if (isSameOriginRequest(request, new URL(request.url).origin)) return true
  } catch {
    // Fall through to the configured origin check.
  }
  if (isSameOriginRequest(request, appOrigin(env, request))) return true
  return authMode(env, request) === 'development' && request.headers.get('sec-fetch-site') === 'same-origin'
}

/** Requires a signed-in user and, for mutations, a same-origin request. */
export const requireUser: MiddlewareHandler<AppContext> = async (c, next) => {
  const request = c.req.raw
  if (request.method !== 'GET' && request.method !== 'HEAD' && !allowsMutation(c.env, request)) {
    return c.json({ error: 'Cross-origin request refused.' }, 403)
  }
  // A first-party email/password session takes precedence over the hosted
  // identity and over an anonymous guest cookie. requireDb runs first, so the
  // auth tables are already created here.
  const account = await accountUser(c.get('db'), request)
  if (account) {
    c.set('user', account)
    await next()
    return
  }
  const user = await currentUser(c.env, request)
  if (user) {
    c.set('user', user)
    await next()
    return
  }
  const guestId = getCookie(c, GUEST_COOKIE)
  if (isGuestId(guestId)) {
    c.set('user', guestUser(guestId))
    await next()
    return
  }
  return c.json({ error: 'Sign in required.' }, 401)
}

export function privateJson<T>(c: Context<AppContext>, body: T, status = 200) {
  c.header('Cache-Control', 'private, no-store')
  return c.json(body as never, status as never)
}
