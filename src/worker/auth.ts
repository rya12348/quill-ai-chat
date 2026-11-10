import { createFreebuffAuth, isSameOriginRequest } from '@freebuff/auth'
import type { FreebuffAuth, FreebuffUser } from '@freebuff/auth'
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
// example, but never a normal deployed origin or a public APP_ORIGIN. This
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
  return configured || new URL(request.url).origin
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
  if (isSameOriginRequest(request, appOrigin(env, request))) return true
  return authMode(env, request) === 'development' && request.headers.get('sec-fetch-site') === 'same-origin'
}

/** Requires a signed-in user and, for mutations, a same-origin request. */
export const requireUser: MiddlewareHandler<AppContext> = async (c, next) => {
  const request = c.req.raw
  if (request.method !== 'GET' && request.method !== 'HEAD' && !allowsMutation(c.env, request)) {
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
