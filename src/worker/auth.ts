import { createFreebuffAuth, isSameOriginRequest } from '@freebuff/auth'
import type { FreebuffAuth, FreebuffUser } from '@freebuff/auth'
import type { Context, MiddlewareHandler } from 'hono'

import type { AppContext, Env } from './env'

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]'])
const CODESPACES_HOST = /\.github\.dev$/i

/** Whether a configured origin points back at this machine. */
function isLoopbackOrigin(value: string): boolean {
  try {
    return LOOPBACK.has(new URL(value).hostname)
  } catch {
    return false
  }
}

// One development identity, honoured only on a loopback origin when no client
// ID is configured. It lets the template run before auth is provisioned and
// can never activate on a deployed site (its origin is never loopback). That
// matters here: every message spends the owner's API credits, so a deployed
// app without Sign in with Freebuff answers nobody.
export const DEV_USER: FreebuffUser = {
  sub: 'dev-user',
  name: 'Alex Morgan',
  email: 'alex@example.com',
  email_verified: true,
}

export function isLoopback(request: Request): boolean {
  return LOOPBACK.has(new URL(request.url).hostname)
}

export function authMode(env: Env, request: Request): 'freebuff' | 'development' | 'off' {
  if (env.FREEBUFF_CLIENT_ID) return 'freebuff'
  return isLoopback(request) ? 'development' : 'off'
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

let cached: { key: string; auth: FreebuffAuth } | undefined

/** One auth instance per isolate; recreated only if the config changes. */
export function getAuth(env: Env, request: Request): FreebuffAuth | null {
  if (!env.FREEBUFF_CLIENT_ID) return null
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
  const auth = getAuth(env, request)
  if (auth) return auth.getUser(request)
  return authMode(env, request) === 'development' ? DEV_USER : null
}

/**
 * Codespaces terminates TLS at its proxy and forwards the request to the
 * loopback dev server. Use the public host the browser actually visited so
 * same-origin mutation checks and generated preview URLs do not point at
 * 127.0.0.1. Only trust this for the unauthenticated development server on a
 * Codespaces host; a configured public APP_ORIGIN stays authoritative.
 */
function forwardedDevelopmentOrigin(env: Env, request: Request): string | undefined {
  if (env.FREEBUFF_CLIENT_ID) return undefined
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

export function appOrigin(env: Env, request: Request): string {
  const configured = env.APP_ORIGIN?.trim()
  const forwarded = forwardedDevelopmentOrigin(env, request)
  if (forwarded && (!configured || isLoopbackOrigin(configured))) return forwarded
  return configured || new URL(request.url).origin
}

/** Requires a signed-in user and, for mutations, a same-origin request. */
export const requireUser: MiddlewareHandler<AppContext> = async (c, next) => {
  const request = c.req.raw
  if (request.method !== 'GET' && request.method !== 'HEAD' && !isSameOriginRequest(request, appOrigin(c.env, request))) {
    return c.json({ error: 'Cross-origin request refused.' }, 403)
  }
  const user = await currentUser(c.env, request)
  if (!user) return c.json({ error: 'Sign in required.' }, 401)
  c.set('user', user)
  await next()
}

export function privateJson<T>(c: Context<AppContext>, body: T, status = 200) {
  c.header('Cache-Control', 'private, no-store')
  return c.json(body as never, status as never)
}
