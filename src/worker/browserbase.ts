import type { BrowserAction, BrowserInspectResult, BrowserScreen, BrowserSnapshot, BrowserTab, BrowserViewState } from '../shared/types'
import type { Env } from './env'

const API = 'https://api.browserbase.com/v1'
const HYPERBROWSER_API = 'https://api.hyperbrowser.ai/api'
const STEEL_API = 'https://api.steel.dev/v1'
export type BrowserViewport = { width: number; height: number }
const VIEWPORT: BrowserViewport = { width: 1280, height: 800 }
const SESSION_TIMEOUT = 3_600
const HYPERBROWSER_SESSION_MINUTES = 60
const STEEL_SESSION_TIMEOUT = 15 * 60_000

export class BrowserServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 502,
  ) {
    super(message)
    this.name = 'BrowserServiceError'
  }
}

type BrowserProvider = 'browserbase' | 'hyperbrowser' | 'steel'

type BrowserbaseSession = {
  id: string
  status: string
  expiresAt?: string
  profileId?: string
}

type HyperbrowserSession = {
  id: string
  status: string
  createdAt?: string
  liveUrl?: string
  wsEndpoint?: string
}

type BrowserbaseDebug = {
  wsUrl: string
  debuggerFullscreenUrl: string
}

type HyperbrowserSessionList = {
  sessions?: { id?: string; status?: string }[]
}

type SteelSession = {
  id: string
  status?: string
  createdAt?: string
  timeout?: number
  profileId?: string
  websocketUrl?: string
  debugUrl?: string
  sessionViewerUrl?: string
}

type SteelSessionList = {
  sessions?: { id?: string; status?: string }[]
}

type BrowserbaseContext = { id: string }
type HyperbrowserProfile = { id: string }

type CdpTarget = { targetId: string; type: string; url: string; title?: string }

export function provider(env: Env): BrowserProvider {
  const preferred = env.BROWSER_PROVIDER?.trim().toLowerCase()
  if (preferred === 'steel' && env.STEEL_API_KEY?.trim()) return 'steel'
  if (preferred === 'hyperbrowser' && env.HYPERBROWSER_API_KEY?.trim()) return 'hyperbrowser'
  if (preferred === 'browserbase' && env.BROWSERBASE_API_KEY?.trim()) return 'browserbase'
  // Browserbase is the primary path. Hyperbrowser and Steel are fallbacks.
  if (env.BROWSERBASE_API_KEY?.trim()) return 'browserbase'
  if (env.HYPERBROWSER_API_KEY?.trim()) return 'hyperbrowser'
  return 'steel'
}

export function isBrowserConfigured(env: Env): boolean {
  return Boolean(env.STEEL_API_KEY?.trim() || env.HYPERBROWSER_API_KEY?.trim() || env.BROWSERBASE_API_KEY?.trim())
}

function apiKey(env: Env): string {
  const key = env.BROWSERBASE_API_KEY?.trim()
  if (!key) {
    throw new BrowserServiceError(
      'browser_not_configured',
      'The cloud browser is not available right now. Try again in a moment.',
      503,
    )
  }
  return key
}

function hyperbrowserKey(env: Env): string {
  const key = env.HYPERBROWSER_API_KEY?.trim()
  if (!key) {
    throw new BrowserServiceError(
      'browser_not_configured',
      'The cloud browser is not available right now. Try again in a moment.',
      503,
    )
  }
  return key
}

function steelKey(env: Env): string {
  const key = env.STEEL_API_KEY?.trim()
  if (!key) {
    throw new BrowserServiceError(
      'browser_not_configured',
      'The cloud browser is not available right now. Try again in a moment.',
      503,
    )
  }
  return key
}

async function bb<T>(env: Env, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      'x-bb-api-key': apiKey(env),
      ...((init.headers as Record<string, string> | undefined) ?? {}),
    },
  })
  const body = (await response.json().catch(() => null)) as Record<string, unknown> | null
  if (!response.ok) {
    const detail =
      (typeof body?.message === 'string' && body.message) ||
      (typeof body?.error === 'string' && body.error) ||
      'The cloud browser service could not complete that request.'
    if (response.status === 402 || /free plan browser minutes limit reached|browser minutes limit|browser hours? (?:limit|quota)|usage limit|insufficient credits|out of credits/i.test(detail)) {
      throw new BrowserServiceError(
        'browser_quota',
        'The cloud browser account has used its browser-time allowance. Upgrade the provider plan or replace the server key, then retry.',
        503,
      )
    }
    if (response.status === 401 || response.status === 403) {
      throw new BrowserServiceError('browser_auth', 'The cloud browser service rejected its API key.', 503)
    }
    if (/maximum number of active sessions|concurrent session/i.test(detail)) {
      throw new BrowserServiceError(
        'browser_capacity',
        'The browser provider has no free simultaneous browser slot. Close another browser or upgrade the provider plan.',
        503,
      )
    }
    if (response.status === 429) {
      throw new BrowserServiceError(
        'browser_busy',
        detail ? `The cloud browser is busy: ${detail.slice(0, 160)}` : 'The cloud browser is busy. Try again in a moment.',
        503,
      )
    }
    throw new BrowserServiceError('browser_service_error', detail.slice(0, 180), 502)
  }
  return body as T
}

async function hb<T>(env: Env, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${HYPERBROWSER_API}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      'x-api-key': hyperbrowserKey(env),
      ...((init.headers as Record<string, string> | undefined) ?? {}),
    },
  })
  const body = (await response.json().catch(() => null)) as Record<string, unknown> | null
  if (!response.ok) {
    const detail =
      (typeof body?.message === 'string' && body.message) ||
      (typeof body?.error === 'string' && body.error) ||
      'The cloud browser service could not complete that request.'
    if (response.status === 402 || /quota|credits|browser hours?|usage limit|limit reached/i.test(detail)) {
      throw new BrowserServiceError(
        'browser_quota',
        'The cloud browser account has used its browser-time allowance. Upgrade the provider plan or replace the server key, then retry.',
        503,
      )
    }
    if (response.status === 401 || response.status === 403) {
      throw new BrowserServiceError('browser_auth', 'The cloud browser service rejected its API key.', 503)
    }
    if (/maximum number of active sessions|concurrent session/i.test(detail)) {
      throw new BrowserServiceError(
        'browser_capacity',
        'The browser provider has no free simultaneous browser slot. Close another browser or upgrade the provider plan.',
        503,
      )
    }
    if (response.status === 429) {
      throw new BrowserServiceError(
        'browser_busy',
        detail ? `The cloud browser is busy: ${detail.slice(0, 160)}` : 'The cloud browser is busy. Try again in a moment.',
        503,
      )
    }
    throw new BrowserServiceError('browser_service_error', detail.slice(0, 180), 502)
  }
  return body as T
}

async function steel<T>(env: Env, path: string, init: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${STEEL_API}${path}`, {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(12_000),
      headers: {
        'content-type': 'application/json',
        'steel-api-key': steelKey(env),
        ...((init.headers as Record<string, string> | undefined) ?? {}),
      },
    })
  } catch (error) {
    const name = (error as { name?: string } | null)?.name
    if (name === 'TimeoutError' || name === 'AbortError') {
      throw new BrowserServiceError('browser_timeout', 'The cloud browser service took too long to respond. Try again.', 504)
    }
    throw error
  }
  const body = (await response.json().catch(() => null)) as Record<string, unknown> | null
  if (!response.ok) {
    const detail =
      (typeof body?.message === 'string' && body.message) ||
      (typeof body?.error === 'string' && body.error) ||
      'The cloud browser service could not complete that request.'
    if (response.status === 401 || response.status === 403) {
      throw new BrowserServiceError('browser_auth', 'The cloud browser service rejected its API key.', 503)
    }
    if (response.status === 402 || /credits?|quota|payment|billing|usage limit/i.test(detail)) {
      throw new BrowserServiceError(
        'browser_quota',
        'The cloud browser account has used its browser-time allowance. Upgrade the provider plan or replace the server key, then retry.',
        503,
      )
    }
    const errorCode = typeof body?.code === 'string' ? body.code : ''
    if (errorCode === 'profile_not_ready' || /profile .* is not ready yet|is saved after session .* is released/i.test(detail)) {
      throw new BrowserServiceError(
        'browser_profile_busy',
        'The saved browser profile is still closing. Retrying with a fresh profile.',
        409,
      )
    }
    if (errorCode === 'profile_not_found' || /profile .* (?:not found|does not exist)|invalid profile/i.test(detail)) {
      throw new BrowserServiceError(
        'browser_profile_missing',
        'The saved browser profile is no longer available. Starting a fresh browser.',
        409,
      )
    }
    if (/maximum number of active sessions|concurrent session|too many sessions/i.test(detail)) {
      throw new BrowserServiceError(
        'browser_capacity',
        'The browser provider has no free simultaneous browser slot. Close another browser or upgrade the provider plan.',
        503,
      )
    }
    if (response.status === 429) {
      throw new BrowserServiceError(
        'browser_busy',
        detail ? `The cloud browser is busy: ${detail.slice(0, 160)}` : 'The cloud browser is busy. Try again in a moment.',
        503,
      )
    }
    throw new BrowserServiceError('browser_service_error', detail.slice(0, 180), 502)
  }
  return body as T
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function createContext(env: Env): Promise<string> {
  if (provider(env) === 'steel') {
    // Steel's saved profile setup needs a separate create-session round trip.
    // Start with a clean browser; the session still works without a profile.
    return 'default'
  }
  if (provider(env) === 'hyperbrowser') {
    const profile = await hb<HyperbrowserProfile>(env, '/profile', {
      method: 'POST',
      body: JSON.stringify({ name: 'Ink' }),
    })
    if (!profile.id) throw new BrowserServiceError('browser_context', 'The cloud browser did not create a saved profile.', 502)
    return profile.id
  }
  const context = await bb<BrowserbaseContext>(env, '/contexts', { method: 'POST', body: '{}' })
  if (!context.id) throw new BrowserServiceError('browser_context', 'The cloud browser did not create a saved profile.', 502)
  return context.id
}

export async function getSession(env: Env, sessionId: string): Promise<BrowserbaseSession> {
  if (provider(env) === 'steel') {
    const session = await steel<SteelSession>(env, `/sessions/${encodeURIComponent(sessionId)}`)
    const state = String(session.status ?? '').toLowerCase()
    const status = state === 'live' ? 'RUNNING' : state === 'released' || state === 'failed' ? 'COMPLETED' : state.toUpperCase()
    const startedAt = session.createdAt ? Date.parse(session.createdAt) : NaN
    const timeout = Number(session.timeout) || STEEL_SESSION_TIMEOUT
    return {
      id: session.id || sessionId,
      status,
      ...(Number.isFinite(startedAt) ? { expiresAt: new Date(startedAt + timeout).toISOString() } : {}),
    }
  }
  if (provider(env) === 'hyperbrowser') {
    const session = await hb<HyperbrowserSession>(env, `/session/${encodeURIComponent(sessionId)}`)
    const sessionStatus = session.status.toLowerCase()
    const status = sessionStatus === 'active' ? 'RUNNING' : sessionStatus === 'closed' || sessionStatus === 'error' || sessionStatus === 'close-error' ? 'COMPLETED' : sessionStatus.toUpperCase()
    const startedAt = session.createdAt ? Date.parse(session.createdAt) : NaN
    return {
      id: session.id,
      status,
      ...(Number.isFinite(startedAt) ? { expiresAt: new Date(startedAt + HYPERBROWSER_SESSION_MINUTES * 60_000).toISOString() } : {}),
    }
  }
  return bb<BrowserbaseSession>(env, `/sessions/${encodeURIComponent(sessionId)}`)
}

async function createSteelSession(env: Env, profileId?: string): Promise<SteelSession> {
  const created = await steel<SteelSession>(env, '/sessions', {
    method: 'POST',
    body: JSON.stringify({
      timeout: STEEL_SESSION_TIMEOUT,
      // The page is the product, not a second desktop. Fullscreen removes
      // Chrome's tabs/address bar from the stream, and the debug config hides
      // Steel's remote cursor so the person only sees their own pointer.
      fullscreen: true,
      debugConfig: { interactive: true, systemCursor: false },
      // Steel Profiles keep cookies, localStorage and the Google sign-in
      // between sessions. A first session mints one; later ones reuse it.
      persistProfile: true,
      ...(profileId ? { profileId } : {}),
    }),
  })
  if (!created.id) throw new BrowserServiceError('browser_session', 'The cloud browser did not return a session.', 502)
  return created
}

export async function createSession(env: Env, contextId: string, viewport: BrowserViewport = VIEWPORT): Promise<BrowserbaseSession> {
  if (provider(env) === 'steel') {
    const savedProfile = contextId && contextId !== 'default' ? contextId : ''
    let created: SteelSession
    if (!savedProfile) {
      created = await createSteelSession(env)
    } else {
      try {
        created = await createSteelSession(env, savedProfile)
      } catch (error) {
        if (!(error instanceof BrowserServiceError)) throw error
        if (error.code === 'browser_profile_busy') {
          // Steel asks for five seconds after a release. Retry once to preserve
          // the saved sign-in; if the profile is still wedged, mint a fresh
          // profile instead of leaving the browser permanently unstartable.
          await sleep(5_000)
          try {
            created = await createSteelSession(env, savedProfile)
          } catch (retry) {
            if (!(retry instanceof BrowserServiceError) || retry.code !== 'browser_profile_busy') throw retry
            created = await createSteelSession(env)
          }
        } else if (error.code === 'browser_profile_missing') {
          created = await createSteelSession(env)
        } else {
          throw error
        }
      }
    }
    const profileId = created.profileId
    // The create response often already says live. Use it instead of throwing
    // away that state and making an immediate status round trip; subsequent
    // polls are tighter so a cold start does not sit on a 500 ms tick.
    if (String(created.status ?? '').toLowerCase() === 'live') {
      const startedAt = created.createdAt ? Date.parse(created.createdAt) : NaN
      const timeout = Number(created.timeout) || STEEL_SESSION_TIMEOUT
      return {
        id: created.id,
        status: 'RUNNING',
        ...(Number.isFinite(startedAt) ? { expiresAt: new Date(startedAt + timeout).toISOString() } : {}),
        ...(profileId ? { profileId } : {}),
      }
    }
    for (let attempt = 0; attempt < 48; attempt += 1) {
      const current = await getSession(env, created.id)
      if (current.status === 'RUNNING') return { ...current, ...(profileId ? { profileId } : {}) }
      if (current.status === 'COMPLETED' || current.status === 'ERROR' || current.status === 'TIMED_OUT') {
        throw new BrowserServiceError('browser_session', 'The cloud browser could not start.', 502)
      }
      await sleep(250)
    }
    throw new BrowserServiceError('browser_session', 'The cloud browser took too long to start. Try again.', 504)
  }
  if (provider(env) === 'hyperbrowser') {
    const created = await hb<HyperbrowserSession>(env, '/session', {
      method: 'POST',
      body: JSON.stringify({
        timeoutMinutes: HYPERBROWSER_SESSION_MINUTES,
        screen: viewport,
        profile: { id: contextId, persistChanges: true },
      }),
    })
    if (!created.id) throw new BrowserServiceError('browser_session', 'The cloud browser did not return a session.', 502)
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const current = await getSession(env, created.id)
      if (current.status === 'RUNNING') return current
      if (current.status === 'COMPLETED' || current.status === 'ERROR' || current.status === 'TIMED_OUT') {
        throw new BrowserServiceError('browser_session', 'The cloud browser could not start.', 502)
      }
      await sleep(500)
    }
    throw new BrowserServiceError('browser_session', 'The cloud browser took too long to start. Try again.', 504)
  }
  const create = (keepAlive: boolean) =>
    bb<BrowserbaseSession>(env, '/sessions', {
      method: 'POST',
      body: JSON.stringify({
        timeout: SESSION_TIMEOUT,
        // The Worker disconnects after each step. Without keepAlive, Browserbase
        // would end the browser when that short CDP connection closes. On plans
        // where keepAlive is not included, retry without it rather than
        // reporting the whole browser as out of time.
        keepAlive,
        browserSettings: {
          viewport,
          context: { id: contextId, persist: true },
          solveCaptchas: true,
          recordSession: false,
          logSession: false,
        },
      }),
    })
  let created: BrowserbaseSession
  try {
    created = await create(true)
  } catch (error) {
    if (!(error instanceof BrowserServiceError) || error.code !== 'browser_quota') throw error
    created = await create(false)
  }
  if (!created.id) throw new BrowserServiceError('browser_session', 'The cloud browser did not return a session.', 502)

  // A new session is usually PENDING for a few seconds. Wait for the CDP
  // endpoint to become usable instead of making the first page load fail.
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const current = await getSession(env, created.id)
    if (current.status === 'RUNNING') return current
    if (current.status === 'ERROR' || current.status === 'COMPLETED' || current.status === 'TIMED_OUT') {
      throw new BrowserServiceError('browser_session', 'The cloud browser could not start.', 502)
    }
    await sleep(500)
  }
  throw new BrowserServiceError('browser_session', 'The cloud browser took too long to start. Try again.', 504)
}

// The provider session lookup is a full HTTP round trip, and Ink calls it for
// every click, action and screen frame. The endpoint is stable for a live
// session, so reuse it briefly instead of paying that latency each time.
const liveCache = new Map<string, { view: BrowserbaseDebug; expiresAt: number }>()
const LIVE_CACHE_MS = 120_000

export async function getLiveView(env: Env, sessionId: string): Promise<BrowserbaseDebug> {
  const cached = liveCache.get(sessionId)
  if (cached && cached.expiresAt > Date.now()) return cached.view
  if (cached) liveCache.delete(sessionId)
  if (provider(env) === 'steel') {
    const session = await steel<SteelSession>(env, `/sessions/${encodeURIComponent(sessionId)}`)
    const wsUrl =
      session.websocketUrl ||
      `wss://connect.steel.dev?apiKey=${encodeURIComponent(steelKey(env))}&sessionId=${encodeURIComponent(sessionId)}`
    const viewer = session.debugUrl || session.sessionViewerUrl
    if (!wsUrl || !viewer) {
      throw new BrowserServiceError('browser_session', 'The cloud browser did not return a live view.', 502)
    }
    const view = { wsUrl, debuggerFullscreenUrl: viewer }
    liveCache.set(sessionId, { view, expiresAt: Date.now() + LIVE_CACHE_MS })
    return view
  }
  if (provider(env) === 'hyperbrowser') {
    const session = await hb<HyperbrowserSession>(env, `/session/${encodeURIComponent(sessionId)}`)
    if (!session.wsEndpoint || !session.liveUrl) {
      throw new BrowserServiceError('browser_session', 'The cloud browser did not return a live view.', 502)
    }
    const view = { wsUrl: session.wsEndpoint, debuggerFullscreenUrl: session.liveUrl }
    liveCache.set(sessionId, { view, expiresAt: Date.now() + LIVE_CACHE_MS })
    return view
  }
  const debug = await bb<BrowserbaseDebug>(
    env,
    `/sessions/${encodeURIComponent(sessionId)}/debug?expiresIn=${SESSION_TIMEOUT}`,
  )
  if (!debug.wsUrl || !debug.debuggerFullscreenUrl) {
    throw new BrowserServiceError('browser_session', 'The cloud browser did not return a live view.', 502)
  }
  liveCache.set(sessionId, { view: debug, expiresAt: Date.now() + LIVE_CACHE_MS })
  return debug
}

/** Active sessions on the provider account, used to clear orphaned browsers. */
export async function listActiveSessions(env: Env): Promise<{ id: string }[]> {
  if (provider(env) === 'steel') {
    const body = await steel<SteelSessionList | { id?: string; status?: string }[]>(env, '/sessions?status=live&limit=100')
    const sessions = Array.isArray(body) ? body : (body.sessions ?? [])
    return sessions
      .filter((session): session is { id: string } => Boolean(session.id))
      .map((session) => ({ id: session.id }))
  }
  if (provider(env) === 'browserbase') {
    const sessions = await bb<{ id?: string; status?: string }[]>(env, '/sessions?status=RUNNING')
    return Array.isArray(sessions)
      ? sessions.filter((session): session is { id: string } => Boolean(session.id)).map((session) => ({ id: session.id }))
      : []
  }
  const body = await hb<HyperbrowserSessionList>(env, '/sessions?status=active&page=1')
  return (body.sessions ?? [])
    .filter((session): session is { id: string } => Boolean(session.id))
    .map((session) => ({ id: session.id }))
}

export async function releaseSession(env: Env, sessionId: string): Promise<void> {
  liveCache.delete(sessionId)
  try {
    if (provider(env) === 'steel') {
      await steel(env, `/sessions/${encodeURIComponent(sessionId)}/release`, { method: 'POST' })
    } else if (provider(env) === 'hyperbrowser') {
      await hb(env, `/session/${encodeURIComponent(sessionId)}/stop`, { method: 'PUT' })
    } else {
      await bb(env, `/sessions/${encodeURIComponent(sessionId)}`, {
        method: 'POST',
        body: JSON.stringify({ status: 'REQUEST_RELEASE' }),
      })
    }
  } catch {
    // Releasing is best-effort. An already-ended session needs no cleanup.
  }
}

type CdpPending = {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

class Cdp {
  private next = 0
  private pending = new Map<number, CdpPending>()

  constructor(private readonly socket: WebSocket) {
    socket.addEventListener('message', (event) => {
      if (typeof event.data !== 'string') return
      let message: { id?: number; result?: unknown; error?: { message?: string } }
      try {
        message = JSON.parse(event.data) as typeof message
      } catch {
        return
      }
      if (typeof message.id !== 'number') return
      const item = this.pending.get(message.id)
      if (!item) return
      this.pending.delete(message.id)
      clearTimeout(item.timer)
      if (message.error) item.reject(new Error(message.error.message || 'The cloud browser rejected that command.'))
      else item.resolve(message.result)
    })
    const fail = () => {
      for (const item of this.pending.values()) {
        clearTimeout(item.timer)
        item.reject(new Error('The cloud browser connection closed.'))
      }
      this.pending.clear()
    }
    socket.addEventListener('close', fail)
    socket.addEventListener('error', fail)
  }

  send<T>(method: string, params: Record<string, unknown> = {}, sessionId?: string): Promise<T> {
    const id = ++this.next
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`The cloud browser did not answer ${method}.`))
      }, 25_000)
      this.pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
        timer,
      })
      this.socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }))
    })
  }

  close(): void {
    try {
      this.socket.close(1000, 'done')
    } catch {
      /* already closed */
    }
  }
}

async function openCdp(env: Env, wsUrl: string): Promise<Cdp> {
  const base = wsUrl.replace(/^wss:/i, 'https:').replace(/^ws:/i, 'http:')
  // Hyperbrowser stops a session when its CDP client disconnects. Ink opens
  // one short CDP connection per action, so ask Hyperbrowser to keep the
  // browser alive between those connections. The explicit DELETE still stops it.
  const url = new URL(base)
  if (provider(env) === 'hyperbrowser') url.searchParams.set('keepAlive', 'true')
  const response = await fetch(url.toString(), {
    headers: {
      Upgrade: 'websocket',
      ...(provider(env) === 'browserbase' ? { 'x-bb-api-key': apiKey(env) } : {}),
      ...(provider(env) === 'steel' ? { 'steel-api-key': steelKey(env) } : {}),
    },
  })
  const socket = (response as Response & { webSocket?: WebSocket }).webSocket
  if (!socket) {
    throw new BrowserServiceError('browser_connection', 'The cloud browser did not open a control connection.', 502)
  }
  socket.accept()
  return new Cdp(socket)
}

async function enablePage(cdp: Cdp, sessionId: string, focus = true): Promise<void> {
  // Page.enable and Runtime.enable only turn on CDP events; every command we
  // use here works without them. Dropping those two round trips saves setup
  // latency on every action while keeping focus input reliable.
  if (!focus) return
  await Promise.all([
    // Keep the remote page focused even while the live-view shell has focus.
    // Without this, native key events can land on the provider frame instead of
    // the document the person is watching.
    cdp.send('Page.bringToFront', {}, sessionId).catch(() => undefined),
    cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true }, sessionId).catch(() => undefined),
  ])
}

async function attachTarget(cdp: Cdp, targetId: string): Promise<string> {
  const attached = await cdp.send<{ sessionId?: string }>('Target.attachToTarget', { targetId, flatten: true })
  if (!attached.sessionId) {
    throw new BrowserServiceError('browser_page', 'The cloud browser tab could not be attached.', 502)
  }
  await enablePage(cdp, attached.sessionId)
  return attached.sessionId
}

async function attachPageTarget(cdp: Cdp, focus = true): Promise<{ targetId: string; sessionId: string }> {
  const targets = await cdp.send<{ targetInfos?: CdpTarget[] }>('Target.getTargets')
  const pages = targets.targetInfos ?? []
  // A session can have more than one tab. Target.getTargets has no "active"
  // flag, and picking the first HTTP page used to control an old background
  // tab while the live view showed a different one. Attach to each page and
  // ask the document which one is actually visible/focused, then keep only
  // that attachment.
  const candidates = pages.filter((target) => target.type === 'page')
  if (!candidates.length) {
    throw new BrowserServiceError('browser_page', 'The cloud browser has no open page.', 502)
  }
  // Almost every session has one tab. Attach straight to it instead of probing
  // visibility and detaching probe sessions; the slow path below is only for a
  // real multi-tab browser.
  if (candidates.length === 1) {
    const target = candidates[0]
    const attached = await cdp.send<{ sessionId?: string }>('Target.attachToTarget', {
      targetId: target.targetId,
      flatten: true,
    })
    if (!attached.sessionId) {
      throw new BrowserServiceError('browser_page', 'The cloud browser tab could not be attached.', 502)
    }
    await enablePage(cdp, attached.sessionId, focus)
    return { targetId: target.targetId, sessionId: attached.sessionId }
  }
  let chosen: { targetId: string; sessionId: string } | null = null
  const visible: { targetId: string; sessionId: string }[] = []
  const attachedPages: { targetId: string; sessionId: string; hidden: boolean; focused: boolean }[] = []
  for (const target of candidates) {
    let attached: { sessionId?: string } | null = null
    try {
      attached = await cdp.send<{ sessionId?: string }>('Target.attachToTarget', {
        targetId: target.targetId,
        flatten: true,
      })
      if (!attached?.sessionId) continue
      const visibility = (await cdp.send<{ result?: { value?: unknown } }>(
        'Runtime.evaluate',
        { expression: `({ hidden: document.visibilityState === 'hidden', focused: document.hasFocus() })`, returnByValue: true },
        attached.sessionId,
      )) as { result?: { value?: { hidden?: boolean; focused?: boolean } } }
      const state = visibility.result?.value
      const page = {
        targetId: target.targetId,
        sessionId: attached.sessionId,
        hidden: Boolean(state?.hidden),
        focused: Boolean(state?.focused),
      }
      attachedPages.push(page)
      if (!page.hidden) visible.push(page)
      // Prefer the tab the viewer is actually showing. A background Sheets tab
      // can be non-hidden in headless Chrome; choosing the first visible page
      // used to send clicks and typing into that tab instead.
      if (page.focused) {
        chosen = { targetId: target.targetId, sessionId: attached.sessionId }
        break
      }
    } catch {
      /* A tab can disappear while it is being attached. Try the next one. */
      if (attached?.sessionId) {
        await cdp.send('Target.detachFromTarget', { sessionId: attached.sessionId }).catch(() => undefined)
      }
    }
  }
  if (!chosen) chosen = visible[0] ?? attachedPages[0] ?? null
  // Detach the extra probes; the chosen page keeps its session.
  for (const entry of attachedPages) {
    if (entry.sessionId !== chosen?.sessionId) {
      await cdp.send('Target.detachFromTarget', { sessionId: entry.sessionId }).catch(() => undefined)
    }
  }
  if (!chosen) {
    throw new BrowserServiceError('browser_page', 'The cloud browser page could not be attached.', 502)
  }
  await enablePage(cdp, chosen.sessionId, focus)
  return chosen
}

async function attachPage(cdp: Cdp): Promise<string> {
  return (await attachPageTarget(cdp)).sessionId
}

const SNAPSHOT_EXPRESSION = `(() => {
  const clean = (value, max) => String(value ?? '').replace(/\\s+/g, ' ').trim().slice(0, max);
  const readable = (value, max) => String(value ?? '').replace(/\\r/g, '').replace(/[ \\t]+/g, ' ').replace(/[ \\t]*\\n[ \\t]*/g, '\\n').replace(/\\n{3,}/g, '\\n\\n').trim().slice(0, max);
  const visible = (element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 1 && rect.height > 1 && style.visibility !== 'hidden' && style.display !== 'none' && rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth;
  };
  const nodes = document.querySelectorAll('a[href],button,input,textarea,select,summary,[contenteditable]:not([contenteditable="false"]),[role="button"],[role="link"],[role="textbox"],[role="searchbox"],[role="combobox"],[role="menuitem"],[role="menuitemcheckbox"],[role="menuitemradio"],[role="option"],[role="tab"],[role="switch"],[role="checkbox"],[role="radio"],[role="slider"],[role="treeitem"],[aria-haspopup="menu"],[aria-haspopup="listbox"],[aria-expanded]');
  const candidates = [];
  for (const element of nodes) {
    const rect = element.getBoundingClientRect();
    const onScreen = visible(element);
    // Controls below the fold stay usable so a named link or field never needs
    // a planner round trip just to be scrolled into view. Zero-size hidden
    // wrappers are still excluded.
    if (!onScreen && (rect.width <= 1 || rect.height <= 1)) continue;
    candidates.push({ element, onScreen, rect });
  }
  const ordered = [...candidates.filter((candidate) => candidate.onScreen), ...candidates.filter((candidate) => !candidate.onScreen)].slice(0, 200);
  const elements = [];
  let nextId = 0;
  for (const { element, onScreen, rect } of ordered) {
    const id = 'q' + (nextId++);
    element.setAttribute('data-stet-id', id);
    const labelFor = element.id ? document.querySelector('label[for="' + CSS.escape(element.id) + '"]') : null;
    const wrappingLabel = element.closest ? element.closest('label') : null;
    const labelledBy = (element.getAttribute('aria-labelledby') || '')
      .split(/\\s+/)
      .map((id) => (id ? document.getElementById(id)?.innerText || document.getElementById(id)?.textContent || '' : ''))
      .join(' ')
      .trim();
    const tag = element.tagName.toLowerCase();
    const role = (element.getAttribute('role') || '').toLowerCase();
    const textLabel = element.innerText || element.textContent || '';
    const isControl = tag === 'a' || tag === 'button' || role === 'link' || role === 'button' || role === 'option' || role === 'menuitem' || role === 'tab';
    const label = clean(
      element.getAttribute('aria-label') ||
        labelledBy ||
        element.getAttribute('title') ||
        (labelFor && labelFor.innerText) ||
        (wrappingLabel && wrappingLabel.innerText) ||
        (isControl ? textLabel : '') ||
        element.getAttribute('placeholder') ||
        textLabel ||
        element.getAttribute('name') ||
        element.value ||
        element.tagName,
      160,
    );
    const datalist = element.getAttribute('list') ? document.getElementById(element.getAttribute('list')) : null;
    const choices =
      tag === 'select' && element.options
        ? [...element.options]
        : datalist && datalist.options
          ? [...datalist.options]
          : [];
    elements.push({
      id,
      tag,
      role: element.getAttribute('role') || '',
      label,
      value: clean(element.value, 300),
      placeholder: clean(element.getAttribute('placeholder'), 160),
      inputType: tag === 'input' ? clean(element.type || 'text', 40).toLowerCase() : undefined,
      href: element.href ? String(element.href).slice(0, 300) : undefined,
      ...(choices.length
        ? {
            options: choices.slice(0, 60).map((option) => ({
              label: clean(option.textContent || option.label || '', 120),
              value: clean(option.value || '', 160),
            })),
          }
        : {}),
      ...(typeof element.checked === 'boolean' ? { checked: element.checked } : {}),
      ...(element.required ? { required: true } : {}),
      ...(element.getAttribute('aria-expanded') === 'true' ? { expanded: true } : {}),
      ...(element.getAttribute('aria-controls') ? { ariaControls: clean(element.getAttribute('aria-controls'), 160) } : {}),
      ...(element.getAttribute('autocomplete') ? { autocomplete: clean(element.getAttribute('autocomplete'), 80) } : {}),
      disabled: Boolean(element.disabled || element.getAttribute('aria-disabled') === 'true'),
      offscreen: !onScreen,
      rect: { x: Math.round(rect.left), y: Math.round(rect.top), width: Math.round(rect.width), height: Math.round(rect.height) },
    });
  }
  const active = document.activeElement;
  const root = document.documentElement;
  const media = [];
  for (const element of document.querySelectorAll('video,audio')) {
    if (media.length >= 4) break;
    media.push({
      kind: element.tagName.toLowerCase(),
      duration: Number.isFinite(element.duration) ? Math.round(element.duration * 10) / 10 : 0,
      currentTime: Number.isFinite(element.currentTime) ? Math.round(element.currentTime * 10) / 10 : 0,
      paused: Boolean(element.paused),
      ended: Boolean(element.ended),
    });
  }
  const frames = [];
  for (const frame of document.querySelectorAll('iframe')) {
    if (frames.length >= 8) break;
    const src = frame.src ? String(frame.src) : '';
    if (!src || /^(?:about|blob|data):/i.test(src)) continue;
    const rect = frame.getBoundingClientRect();
    frames.push({
      url: src.slice(0, 500),
      title: clean(frame.title || frame.getAttribute('title') || frame.name, 120),
      visible: rect.width > 1 && rect.height > 1 && rect.bottom > 0 && rect.top < innerHeight,
      rect: { x: Math.round(rect.left), y: Math.round(rect.top), width: Math.round(rect.width), height: Math.round(rect.height) },
    });
  }
  const headings = [];
  for (const element of document.querySelectorAll('h1,h2,h3,h4,[role="heading"]')) {
    if (headings.length >= 12) break;
    const text = clean(element.innerText || element.textContent, 120);
    if (!text || element.getBoundingClientRect().width <= 1) continue;
    const level = Number(element.getAttribute('aria-level')) || Number(element.tagName.slice(1)) || 2;
    headings.push({ level: Math.max(1, Math.min(6, level)), text });
  }
  return {
    url: location.href,
    title: document.title,
    text: readable(document.body ? document.body.innerText : '', 8000),
    viewport: {
      width: innerWidth,
      height: innerHeight,
      scrollX: Math.round(window.scrollX),
      scrollY: Math.round(window.scrollY),
      pageHeight: Math.max(innerHeight, root ? root.scrollHeight || 0 : 0),
    },
    active: active ? clean(active.getAttribute('aria-label') || active.tagName, 160) : '',
    elements,
    media,
    frames,
    headings,
    at: Date.now(),
  };
})()`

async function evaluate(cdp: Cdp, sessionId: string, expression: string): Promise<unknown> {
  const result = await cdp.send<{
    result?: { value?: unknown }
    exceptionDetails?: { text?: string; exception?: { description?: string } }
  }>(
    'Runtime.evaluate',
    {
      expression,
      returnByValue: true,
      awaitPromise: true,
      userGesture: true,
    },
    sessionId,
  )
  if (result.exceptionDetails) {
    const detail = result.exceptionDetails.exception?.description?.split('\n')[0].trim()
    const message = detail || result.exceptionDetails.text || 'The page could not be read.'
    throw new BrowserServiceError('browser_page_error', message, 502)
  }
  return result.result?.value
}

async function screenshot(cdp: Cdp, sessionId: string): Promise<string | undefined> {
  try {
    const result = await cdp.send<{ data?: string }>(
      'Page.captureScreenshot',
      { format: 'jpeg', quality: 62, fromSurface: true, captureBeyondViewport: false },
      sessionId,
    )
    return result.data ? `data:image/jpeg;base64,${result.data}` : undefined
  } catch {
    return undefined
  }
}

function inspectExpression(selector: string): string {
  return `(() => {
    const raw = ${JSON.stringify(selector)};
    let nodes;
    try {
      nodes = raw ? document.querySelectorAll(raw) : [document.documentElement];
    } catch {
      return { error: 'That CSS selector is not valid.' };
    }
    const target = nodes[0];
    if (!target) return { error: 'No element matched that selector.', matched: nodes.length };
    const computed = getComputedStyle(target);
    const properties = ['display', 'position', 'width', 'height', 'color', 'background-color', 'font-family', 'font-size', 'font-weight', 'line-height', 'padding', 'margin', 'border', 'border-radius', 'z-index'];
    return {
      selector: raw || 'html',
      tag: target.tagName.toLowerCase(),
      matched: nodes.length,
      html: String(target.outerHTML ?? '').slice(0, 16000),
      text: String(target.innerText ?? target.textContent ?? '').replace(/\\s+/g, ' ').trim().slice(0, 4000),
      styles: properties.map((property) => property + ': ' + computed.getPropertyValue(property)).join('\\n'),
    };
  })()`
}

async function readInspect(cdp: Cdp, sessionId: string, selector: string): Promise<BrowserInspectResult> {
  const result = (await evaluate(cdp, sessionId, inspectExpression(selector))) as
    | (BrowserInspectResult & { error?: string })
    | null
  if (!result || result.error || !result.tag) {
    throw new BrowserServiceError('browser_target', result?.error || 'That element could not be inspected.', 409)
  }
  return result
}

/** Read the live page's HTML, text and computed styles for the inspector and planner. */
export async function inspectPage(
  env: Env,
  sessionId: string,
  selector: string,
): Promise<{ state: BrowserViewState; inspect: BrowserInspectResult }> {
  return withPage(env, sessionId, async (cdp, page) => {
    const inspect = await readInspect(cdp, page, selector)
    const state = await readPage(cdp, page)
    return { state: { ...state, inspect }, inspect }
  })
}

async function readPage(cdp: Cdp, sessionId: string, includeScreenshot = false): Promise<BrowserViewState> {
  let lastError: unknown
  let snapshot: BrowserSnapshot | null = null
  // A submit can replace the document between Enter and this read. Retry a
  // few times instead of reporting the navigation as a failed action.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      snapshot = (await evaluate(cdp, sessionId, SNAPSHOT_EXPRESSION)) as BrowserSnapshot | null
      if (snapshot && typeof snapshot === 'object') break
      lastError = new BrowserServiceError('browser_page_error', 'The cloud browser page returned no readable state.', 502)
    } catch (error) {
      lastError = error
    }
    await sleep(180 * (attempt + 1))
  }
  if (!snapshot || typeof snapshot !== 'object') {
    throw lastError instanceof Error
      ? lastError
      : new BrowserServiceError('browser_page_error', 'The cloud browser page returned no readable state.', 502)
  }
  // Screenshots are expensive to encode and force the planner onto a slower
  // vision lane. The DOM snapshot is enough for normal control; keep the
  // capture path available for callers that explicitly need an image.
  const image = includeScreenshot ? await screenshot(cdp, sessionId) : undefined
  return {
    url: snapshot.url,
    title: snapshot.title,
    ...(image ? { screenshot: image } : {}),
    snapshot,
  }
}

async function waitReady(cdp: Cdp, sessionId: string, target: 'interactive' | 'complete' = 'complete'): Promise<void> {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    try {
      const ready = await evaluate(cdp, sessionId, 'document.readyState')
      if (ready === 'complete' || (target === 'interactive' && ready === 'interactive')) return
    } catch {
      /* navigation is still replacing the document */
    }
    await sleep(200)
  }
}

async function navigate(cdp: Cdp, sessionId: string, url: string): Promise<void> {
  const result = await cdp.send<{ errorText?: string }>('Page.navigate', { url }, sessionId)
  if (result.errorText) throw new BrowserServiceError('browser_navigation', result.errorText, 502)
  // Interactive is enough to read and operate the page. Waiting for Gmail's
  // analytics and images to reach `complete` added several seconds per open.
  await waitReady(cdp, sessionId, 'interactive')
}

async function withCdp<T>(env: Env, sessionId: string, run: (cdp: Cdp) => Promise<T>): Promise<T> {
  const live = await getLiveView(env, sessionId)
  const cdp = await openCdp(env, live.wsUrl)
  try {
    return await run(cdp)
  } catch (error) {
    // A failed command can mean the cached endpoint or connection went stale.
    // Drop the endpoint so the next request resolves a fresh one.
    liveCache.delete(sessionId)
    throw error
  } finally {
    cdp.close()
  }
}

async function withPage<T>(env: Env, sessionId: string, run: (cdp: Cdp, page: string) => Promise<T>): Promise<T> {
  return withCdp(env, sessionId, async (cdp) => {
    const page = await attachPage(cdp)
    return run(cdp, page)
  })
}

export async function readState(env: Env, sessionId: string): Promise<BrowserViewState> {
  return withPage(env, sessionId, (cdp, page) => readPage(cdp, page))
}

/** The real tabs in the cloud browser, with the one the viewer is showing marked. */
export async function readTabs(env: Env, sessionId: string): Promise<BrowserTab[]> {
  return withCdp(env, sessionId, async (cdp) => {
    const targets = await cdp.send<{ targetInfos?: CdpTarget[] }>('Target.getTargets')
    const pages = (targets.targetInfos ?? []).filter((target) => target.type === 'page')
    if (!pages.length) {
      throw new BrowserServiceError('browser_page', 'The cloud browser has no open page.', 502)
    }
    // Listing tabs must not switch the page the person is watching. Probe focus,
    // then detach without bringing any tab to the front.
    const active = await attachPageTarget(cdp, false)
    await cdp.send('Target.detachFromTarget', { sessionId: active.sessionId }).catch(() => undefined)
    const tabs = pages.map((page) => ({
      id: page.targetId,
      title: String(page.title || page.url || 'New tab').slice(0, 160),
      url: String(page.url || 'about:blank').slice(0, 500),
      active: page.targetId === active.targetId,
    }))
    if (!tabs.some((tab) => tab.active) && tabs[0]) tabs[0].active = true
    return tabs
  })
}

export async function openTab(env: Env, sessionId: string, url = 'about:blank'): Promise<BrowserViewState> {
  return withCdp(env, sessionId, async (cdp) => {
    const created = await cdp.send<{ targetId?: string }>('Target.createTarget', { url })
    if (!created.targetId) {
      throw new BrowserServiceError('browser_page', 'The cloud browser could not open a tab.', 502)
    }
    await cdp.send('Target.activateTarget', { targetId: created.targetId }).catch(() => undefined)
    const page = await attachTarget(cdp, created.targetId)
    if (url !== 'about:blank') await waitReady(cdp, page, 'interactive')
    await sleep(120)
    return readPage(cdp, page)
  })
}

export async function switchTab(env: Env, sessionId: string, targetId: string): Promise<BrowserViewState> {
  return withCdp(env, sessionId, async (cdp) => {
    const targets = await cdp.send<{ targetInfos?: CdpTarget[] }>('Target.getTargets')
    if (!(targets.targetInfos ?? []).some((target) => target.type === 'page' && target.targetId === targetId)) {
      throw new BrowserServiceError('browser_target', 'That tab is no longer open.', 409)
    }
    await cdp.send('Target.activateTarget', { targetId })
    const page = await attachTarget(cdp, targetId)
    await sleep(100)
    return readPage(cdp, page)
  })
}

export async function closeTab(env: Env, sessionId: string, targetId: string): Promise<BrowserViewState> {
  return withCdp(env, sessionId, async (cdp) => {
    const targets = await cdp.send<{ targetInfos?: CdpTarget[] }>('Target.getTargets')
    const pages = (targets.targetInfos ?? []).filter((target) => target.type === 'page')
    // A poll can leave the strip one beat behind the remote browser. Closing a
    // tab that is already gone is a no-op, not an error and not a reason to
    // claim the last tab cannot be closed.
    if (!pages.some((target) => target.targetId === targetId)) {
      const page = await attachPage(cdp)
      return readPage(cdp, page)
    }
    if (pages.length <= 1) {
      throw new BrowserServiceError('browser_target', 'The last tab cannot be closed.', 409)
    }
    await cdp.send('Target.closeTarget', { targetId })
    await sleep(180)
    const page = await attachPage(cdp)
    return readPage(cdp, page)
  })
}

/** A lightweight frame for the same-origin live screen. */
export async function readScreen(env: Env, sessionId: string): Promise<BrowserScreen> {
  return withPage(env, sessionId, async (cdp, page) => {
    const meta = (await evaluate(
      cdp,
      page,
      `({ url: location.href, title: document.title, width: innerWidth, height: innerHeight, at: Date.now() })`,
    )) as { url?: unknown; title?: unknown; width?: unknown; height?: unknown; at?: unknown } | null
    const image = await screenshot(cdp, page)
    if (!image) throw new BrowserServiceError('browser_screen', 'The cloud browser screen could not be captured.', 502)
    return {
      image,
      url: typeof meta?.url === 'string' ? meta.url : '',
      title: typeof meta?.title === 'string' ? meta.title : '',
      viewport: {
        width: Number(meta?.width) || VIEWPORT.width,
        height: Number(meta?.height) || VIEWPORT.height,
      },
      at: Number(meta?.at) || Date.now(),
    }
  })
}

export async function openUrl(env: Env, sessionId: string, url: string): Promise<BrowserViewState> {
  return withPage(env, sessionId, async (cdp, page) => {
    await navigate(cdp, page, url)
    return readPage(cdp, page)
  })
}

/**
 * Open the Docs editor and fail fast at the Google sign-in wall while the
 * document text is still generating. This overlaps the page load with the
 * model call instead of adding both waits together.
 */
export async function prepareDocument(env: Env, sessionId: string): Promise<BrowserViewState> {
  return withPage(env, sessionId, async (cdp, page) => {
    const current = String((await evaluate(cdp, page, 'location.href')) ?? '')
    if (/accounts\.google\.com|\/ServiceLogin/i.test(current)) {
      throw new BrowserServiceError('browser_signin', 'Sign in to Google in the live view, then run the task again.', 409)
    }
    if (!/^https:\/\/docs\.google\.com\/document\/d\//i.test(current)) {
      await navigate(cdp, page, 'https://docs.new/')
    }
    const landed = String((await evaluate(cdp, page, 'location.href')) ?? '')
    if (/accounts\.google\.com|\/ServiceLogin/i.test(landed)) {
      throw new BrowserServiceError('browser_signin', 'Sign in to Google in the live view, then run the task again.', 409)
    }
    return readPage(cdp, page)
  })
}

/**
 * Put a finished document into Google Docs without spending a planner call per
 * click. The document writer already generated the text; this is the fast,
 * deterministic browser half of that request.
 */
export async function writeDocument(env: Env, sessionId: string, body: string): Promise<BrowserViewState> {
  const content = body.trim().slice(0, 20_000)
  if (!content) throw new BrowserServiceError('browser_write_empty', 'The document writer returned no text.', 502)
  return withPage(env, sessionId, async (cdp, page) => {
    const current = String((await evaluate(cdp, page, 'location.href')) ?? '')
    if (/accounts\.google\.com|\/ServiceLogin/i.test(current)) {
      throw new BrowserServiceError('browser_signin', 'Sign in to Google in the live view, then run the task again.', 409)
    }
    // Only reuse an editor tab. The Docs home is also under /document/, but it
    // has no page body to type into.
    if (!/^https:\/\/docs\.google\.com\/document\/d\//i.test(current)) {
      await navigate(cdp, page, 'https://docs.new/')
    }
    const landed = String((await evaluate(cdp, page, 'location.href')) ?? '')
    if (/accounts\.google\.com|\/ServiceLogin/i.test(landed)) {
      throw new BrowserServiceError('browser_signin', 'Sign in to Google in the live view, then run the task again.', 409)
    }

    // Google Docs builds its editor after the shell loads. Wait for the editor
    // surface, then type into the real contenteditable with key events.
    let editorReady = false
    for (let attempt = 0; attempt < 40; attempt += 1) {
      editorReady = Boolean(await evaluate(cdp, page, `Boolean(document.querySelector('[contenteditable="true"]'))`))
      if (editorReady) break
      await sleep(150)
    }
    if (editorReady) {
      await clickAction(cdp, page, { type: 'click', selector: '[contenteditable="true"]' })
    } else {
      // Some Docs builds expose the editor only as a canvas. A body click still
      // focuses it, so this remains usable when there is no contenteditable.
      await clickAction(cdp, page, { type: 'click', x: 640, y: 400 })
    }
    await sleep(120)
    await pressKey(cdp, page, 'End', ['Ctrl'])
    await typeText(cdp, page, content)
    await sleep(250)
    return readPage(cdp, page)
  })
}

function sheetContent(table: string): string {
  const rows = table
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((row) => row.trimEnd())
    .filter((row) => row.length > 0)
  if (!rows.length) throw new BrowserServiceError('browser_sheet_empty', 'The table writer returned no rows.', 502)
  // Never let generated content begin a formula in the person's sheet.
  const safe = rows.map((row) =>
    row
      .split('\t')
      .map((cell) => (/^[=@+]/.test(cell.trim()) ? `'${cell}` : cell))
      .join('\t'),
  )
  return safe.join('\n').slice(0, 20_000)
}

/**
 * Fill a Google Sheet as one visible keyboard run. The table content can be a
 * promise: the model writes while the sheet is still loading, then this
 * function focuses A1 and types the TSV grid through native key events. No
 * planner round trip per cell and no clipboard paste.
 */
export async function fillSheet(env: Env, sessionId: string, table: string | Promise<string>): Promise<BrowserViewState> {
  return withPage(env, sessionId, async (cdp, page) => {
    const current = String((await evaluate(cdp, page, 'location.href')) ?? '')
    if (/accounts\.google\.com|\/ServiceLogin/i.test(current)) {
      throw new BrowserServiceError('browser_signin', 'Sign in to Google in the live view, then run the task again.', 409)
    }
    if (!/^https:\/\/docs\.google\.com\/spreadsheets\/d\//i.test(current)) {
      await navigate(cdp, page, 'https://docs.google.com/spreadsheets/create')
    }

    // The sheet shell loads before the canvas grid can accept input. Wait for
    // the name box or grid, not for every analytics request to settle.
    let ready = false
    // Sheets can take a little longer than nine seconds on a cold provider
    // page. Keep waiting instead of throwing just before the grid appears.
    for (let attempt = 0; attempt < 80; attempt += 1) {
      ready = Boolean(
        await evaluate(
          cdp,
          page,
          `Boolean(document.querySelector('input[aria-label*="Name" i], [role="grid"], #waffle-grid-container, .grid-container'))`,
        ),
      )
      if (ready) break
      await sleep(180)
    }
    const landed = String((await evaluate(cdp, page, 'location.href')) ?? '')
    if (/accounts\.google\.com|\/ServiceLogin/i.test(landed)) {
      throw new BrowserServiceError('browser_signin', 'Sign in to Google in the live view, then run the task again.', 409)
    }
    if (!ready) {
      throw new BrowserServiceError('browser_page', 'The spreadsheet did not finish loading. Try again from the live view.', 504)
    }
    // Escape leaves a cell edit without changing its value. A real click in
    // the grid gives the canvas focus, and Ctrl+Home is Sheets' own shortcut
    // for A1. This avoids the Name Box, which is slower and can leave a Sheets
    // menu open (the "Move" dialog) when the page is busy.
    await pressKey(cdp, page, 'Escape', [])
    await clickAction(cdp, page, { type: 'click', x: 100, y: 300 })
    await pressKey(cdp, page, 'Escape', [])
    await pressKey(cdp, page, 'Home', ['Ctrl'])
    await sleep(120)
    let activeCell = String(
      (await evaluate(
        cdp,
        page,
        `(() => document.querySelector('input[aria-label*="Name" i]')?.value || '')()`,
      )) ?? '',
    ).trim()
    if (activeCell !== 'A1') {
      // Fallback for layouts where the click missed the grid: use the Name Box
      // once, then verify A1 again before writing anything.
      const nameBox = (await evaluate(
        cdp,
        page,
        `(() => {
          const box = document.querySelector('input[aria-label*="Name" i]');
          if (!box) return false;
          box.scrollIntoView({ block: 'center', inline: 'center' });
          return true;
        })()`,
      )) as boolean
      if (nameBox) {
        await clickAction(cdp, page, { type: 'click', selector: 'input[aria-label*="Name" i]' })
        await pressKey(cdp, page, 'a', ['Ctrl'])
        await typeText(cdp, page, 'A1')
        await pressKey(cdp, page, 'Enter', [])
        await pressKey(cdp, page, 'Escape', [])
        await pressKey(cdp, page, 'Home', ['Ctrl'])
        await sleep(120)
        activeCell = String(
          (await evaluate(
            cdp,
            page,
            `(() => document.querySelector('input[aria-label*="Name" i]')?.value || '')()`,
          )) ?? '',
        ).trim()
      }
    }
    if (activeCell !== 'A1') {
      throw new BrowserServiceError(
        'browser_sheet_focus',
        'The spreadsheet would not focus A1, so I stopped before writing to the wrong cells. Click A1 in the live view and run the task again.',
        409,
      )
    }
    // Usually already resolved by now: generation overlapped navigation and
    // the A1 focus run instead of blocking before the sheet even opened.
    const content = sheetContent(await table)
    await typeGrid(cdp, page, content)
    await sleep(80)
    // The client only needs the destination and title after a fill. A full
    // DOM snapshot here added roughly a second and was immediately discarded.
    // at: 0 deliberately prevents this empty shell from being reused as a
    // fresh planner state on a follow-up task.
    const meta = (await evaluate(cdp, page, '({ url: location.href, title: document.title })')) as
      | { url?: string; title?: string }
      | null
    const url = String(meta?.url || landed)
    const title = String(meta?.title || 'Google Sheets')
    return {
      url,
      title,
      snapshot: {
        url,
        title,
        text: '',
        viewport: { width: VIEWPORT.width, height: VIEWPORT.height, scrollX: 0, scrollY: 0, pageHeight: 0 },
        active: '',
        elements: [],
        media: [],
        at: 0,
      },
    }
  })
}

function mouse(cdp: Cdp, page: string, type: string, x: number, y: number, extra: Record<string, unknown> = {}) {
  return cdp.send('Input.dispatchMouseEvent', { type, x, y, ...extra }, page)
}

async function elementPoint(cdp: Cdp, page: string, selector: string): Promise<{ x: number; y: number } | null> {
  const point = (await evaluate(
    cdp,
    page,
    `(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) return null;
      element.scrollIntoView({ block: 'center', inline: 'center' });
      const rect = element.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })()`,
  )) as { x?: number; y?: number } | null
  if (!point || typeof point.x !== 'number' || typeof point.y !== 'number') return null
  return { x: point.x, y: point.y }
}

async function hoverAction(cdp: Cdp, page: string, action: Extract<BrowserAction, { type: 'hover' }>): Promise<void> {
  let x = Number(action.x)
  let y = Number(action.y)
  if (action.selector) {
    const point = await elementPoint(cdp, page, action.selector)
    if (!point) throw new BrowserServiceError('browser_target', 'That element is no longer on the page.', 409)
    x = point.x
    y = point.y
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new BrowserServiceError('browser_target', 'That hover has no target.', 400)
  }
  x = Math.max(1, Math.min(VIEWPORT.width - 1, x))
  y = Math.max(1, Math.min(VIEWPORT.height - 1, y))
  await mouse(cdp, page, 'mouseMoved', x, y, { button: 'none', buttons: 0, pointerType: 'mouse' })
}

async function dragAction(cdp: Cdp, page: string, action: Extract<BrowserAction, { type: 'drag' }>): Promise<void> {
  const from = await elementPoint(cdp, page, action.fromSelector)
  const to = await elementPoint(cdp, page, action.toSelector)
  if (!from) throw new BrowserServiceError('browser_target', 'The element to drag is no longer on the page.', 409)
  if (!to) throw new BrowserServiceError('browser_target', 'The drop target is no longer on the page.', 409)
  await mouse(cdp, page, 'mouseMoved', from.x, from.y, { button: 'none', buttons: 0, pointerType: 'mouse' })
  await sleep(30)
  await mouse(cdp, page, 'mousePressed', from.x, from.y, { button: 'left', buttons: 1, clickCount: 1, pointerType: 'mouse' })
  await sleep(35)
  for (let step = 1; step <= 8; step += 1) {
    await mouse(cdp, page, 'mouseMoved', from.x + ((to.x - from.x) * step) / 8, from.y + ((to.y - from.y) * step) / 8, {
      button: 'left',
      buttons: 1,
      pointerType: 'mouse',
    })
    await sleep(18)
  }
  await mouse(cdp, page, 'mouseReleased', to.x, to.y, { button: 'left', buttons: 0, clickCount: 1, pointerType: 'mouse' })
}

async function focusAction(cdp: Cdp, page: string, selector: string): Promise<void> {
  const focused = await evaluate(
    cdp,
    page,
    `(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) return false;
      element.scrollIntoView({ block: 'center', inline: 'center' });
      element.focus();
      return true;
    })()`,
  )
  if (!focused) throw new BrowserServiceError('browser_target', 'That element is no longer on the page.', 409)
}

async function selectAction(
  cdp: Cdp,
  page: string,
  action: Extract<BrowserAction, { type: 'select' }>,
): Promise<void> {
  const first = (await evaluate(
    cdp,
    page,
    `(() => {
      const element = document.querySelector(${JSON.stringify(action.selector)});
      if (!element) return { error: 'missing' };
      element.scrollIntoView({ block: 'center', inline: 'center' });
      element.focus();
      const wanted = ${JSON.stringify(action.value)}.trim().toLowerCase();
      if (element.tagName === 'SELECT' && element.options) {
        const options = [...element.options];
        const option = options.find((item) => String(item.value).toLowerCase() === wanted || (item.textContent || '').trim().toLowerCase() === wanted) ??
          options.find((item) => (item.textContent || '').trim().toLowerCase().includes(wanted));
        if (!option) return { error: 'option', available: options.slice(0, 12).map((item) => (item.textContent || '').trim()) };
        const descriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
        if (descriptor && descriptor.set) descriptor.set.call(element, option.value);
        else element.value = option.value;
        element.selectedIndex = option.index;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        return { kind: 'native' };
      }
      if (element.getAttribute('aria-expanded') !== 'true') element.click();
      return { kind: 'custom' };
    })()`,
  )) as { kind?: string; error?: string; available?: string[] } | null
  if (first?.error === 'missing') throw new BrowserServiceError('browser_target', 'That dropdown is no longer on the page.', 409)
  if (first?.error === 'option') {
    throw new BrowserServiceError(
      'browser_option',
      `“${action.value}” is not an option. Available choices: ${(first.available || []).join(', ')}`,
      422,
    )
  }
  if (first?.kind === 'native') return
  await sleep(180)
  const findOption = async () =>
    (await evaluate(
      cdp,
      page,
      `(() => {
        const wanted = ${JSON.stringify(action.value)}.trim().toLowerCase();
        const visible = (element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return rect.width > 1 && rect.height > 1 && style.display !== 'none' && style.visibility !== 'hidden';
        };
        let best = null;
        const candidates = [...document.querySelectorAll('[role="option"],[role="menuitem"],[role="menuitemradio"],[role="menuitemcheckbox"],[role="treeitem"],[data-value]')];
        for (const element of candidates) {
          if (!visible(element)) continue;
          const text = (element.innerText || element.textContent || element.getAttribute('aria-label') || '').replace(/\\s+/g, ' ').trim();
          const value = (element.getAttribute('data-value') || element.getAttribute('value') || '').trim();
          const haystack = (text + ' ' + value).toLowerCase();
          const score = haystack === wanted ? 0 : haystack.startsWith(wanted) ? 1 : haystack.includes(wanted) ? 2 : -1;
          if (score < 0) continue;
          if (!best || score < best.score) {
            const rect = element.getBoundingClientRect();
            best = { score, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
          }
        }
        return best;
      })()`,
    )) as { x: number; y: number } | null
  let option = await findOption()
  if (!option) {
    await typeAction(cdp, page, { type: 'type', selector: action.selector, text: action.value })
    await sleep(180)
    option = await findOption()
  }
  if (option) {
    await mouse(cdp, page, 'mouseMoved', option.x, option.y, { button: 'none', buttons: 0 })
    await mouse(cdp, page, 'mousePressed', option.x, option.y, { button: 'left', buttons: 1, clickCount: 1, pointerType: 'mouse' })
    await mouse(cdp, page, 'mouseReleased', option.x, option.y, { button: 'left', buttons: 0, clickCount: 1, pointerType: 'mouse' })
    return
  }
  await pressKey(cdp, page, 'ArrowDown', [])
  await pressKey(cdp, page, 'Enter', [])
}

async function checkAction(
  cdp: Cdp,
  page: string,
  action: Extract<BrowserAction, { type: 'check' }>,
): Promise<void> {
  const changed = await evaluate(
    cdp,
    page,
    `(() => {
      const element = document.querySelector(${JSON.stringify(action.selector)});
      if (!element) return false;
      element.scrollIntoView({ block: 'center', inline: 'center' });
      element.focus();
      const current = typeof element.checked === 'boolean'
        ? element.checked
        : element.getAttribute('aria-checked') === 'true';
      if (current !== ${action.checked}) element.click();
      return true;
    })()`,
  )
  if (!changed) throw new BrowserServiceError('browser_target', 'That checkbox is no longer on the page.', 409)
}

async function clickAction(cdp: Cdp, page: string, action: Extract<BrowserAction, { type: 'click' }>): Promise<void> {
  let x = Number(action.x)
  let y = Number(action.y)
  if (action.selector) {
    const point = (await evaluate(
      cdp,
      page,
      `(() => {
        const element = document.querySelector(${JSON.stringify(action.selector)});
        if (!element) return null;
        element.scrollIntoView({ block: 'center', inline: 'center' });
        const rect = element.getBoundingClientRect();
        return {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
          link: element.tagName === 'A' && Boolean(element.href),
        };
      })()`,
    )) as { x?: number; y?: number; link?: boolean } | null
    if (!point || typeof point.x !== 'number' || typeof point.y !== 'number') {
      throw new BrowserServiceError('browser_target', 'That element is no longer on the page.', 409)
    }
    // Links are the one control where a DOM click is both deterministic and
    // much faster than a coordinate round trip. Native mouse clicks on the
    // Steel page can miss the anchor while the page is settling; clicking the
    // anchor itself cannot miss, still fires its own JS handlers, and lets the
    // browser perform the navigation normally.
    if (point.link) {
      const clicked = Boolean(
        await evaluate(
          cdp,
          page,
          `(() => {
            const element = document.querySelector(${JSON.stringify(action.selector)});
            if (!element || !element.href) return false;
            element.click();
            return true;
          })()`,
        ),
      )
      if (!clicked) throw new BrowserServiceError('browser_target', 'That link is no longer on the page.', 409)
      await sleep(100)
      return
    }
    x = point.x
    y = point.y
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new BrowserServiceError('browser_target', 'That click has no target.', 400)
  }
  const bounds = (await evaluate(cdp, page, `({ width: innerWidth, height: innerHeight })`)) as
    | { width?: number; height?: number }
    | null
  const width = Number(bounds?.width) || VIEWPORT.width
  const height = Number(bounds?.height) || VIEWPORT.height
  x = Math.max(1, Math.min(width - 1, x))
  y = Math.max(1, Math.min(height - 1, y))
  // CDP preserves message order, so the hover can be sent without waiting for
  // its acknowledgement. The press is the first command whose result matters.
  void mouse(cdp, page, 'mouseMoved', x, y, { button: 'none', buttons: 0, pointerType: 'mouse' }).catch(() => undefined)
  await sleep(8)
  await mouse(cdp, page, 'mousePressed', x, y, { button: 'left', buttons: 1, clickCount: 1, pointerType: 'mouse' })
  await sleep(6)
  await mouse(cdp, page, 'mouseReleased', x, y, { button: 'left', buttons: 0, clickCount: 1, pointerType: 'mouse' })
}

/**
 * Find a named link or button anywhere in the document, including below the
 * fold, and click it. This turns “find the Edpuzzle assignment” into one
 * deterministic DOM scan instead of a planner call and a guessed selector.
 */
async function findLinkAction(cdp: Cdp, page: string, query: string): Promise<{ label: string; count: number }> {
  const wanted = query.trim().slice(0, 200)
  if (!wanted) throw new BrowserServiceError('browser_link', 'That link lookup has no text.', 400)
  const scan = `(() => {
      const clean = (value, max) => String(value ?? '').replace(/\\s+/g, ' ').trim().slice(0, max);
      const wanted = ${JSON.stringify(wanted.toLowerCase())};
      const controls = Array.from(document.querySelectorAll('a[href],[role="link"],button,[role="button"],summary,[role="menuitem"],[role="menuitemcheckbox"],[role="menuitemradio"],[role="option"],[role="tab"],[role="switch"],[role="checkbox"],[role="radio"],[aria-haspopup="menu"],[aria-haspopup="listbox"]'));
      const matches = controls.map((element) => {
        const label = clean(element.getAttribute('aria-label') || element.getAttribute('title') || element.innerText || element.textContent, 240).toLowerCase();
        const href = String(element.href || element.getAttribute('href') || '').toLowerCase();
        const score = label === wanted ? 0 : href.includes(wanted) ? 1 : label.includes(wanted) ? 2 : 9;
        if (score === 9) return null;
        const rect = element.getBoundingClientRect();
        return {
          element,
          score,
          label: clean(element.getAttribute('aria-label') || element.innerText || element.textContent, 160),
          href: String(element.href || '').slice(0, 300),
          visible: rect.width > 1 && rect.height > 1 && rect.bottom > 0 && rect.top < innerHeight,
        };
      }).filter(Boolean);
      // Some apps render assignments as clickable cards or table rows rather
      // than anchors. Look for the smallest text-bearing element containing the
      // name, then click its nearest interactive ancestor.
      if (!matches.length) {
        const candidates = Array.from(document.querySelectorAll('main *, [role="main"] *, body *')).slice(0, 2500);
        let bestText = null;
        for (const textElement of candidates) {
          const bodyText = clean(textElement.innerText || textElement.textContent, 240).toLowerCase();
          if (!bodyText.includes(wanted) || textElement.children.length > 3) continue;
          const clickable = textElement.closest('a[href],button,[role="link"],[role="button"],summary,[role="menuitem"],[role="option"],[role="tab"],[role="switch"],[role="checkbox"],[role="radio"]') || textElement;
          if (!bestText || bodyText.length < bestText.text.length) bestText = { textElement, clickable, text: bodyText };
        }
        if (bestText) {
          const rect = bestText.clickable.getBoundingClientRect();
          matches.push({
            element: bestText.clickable,
            score: 3,
            label: clean(bestText.textElement.innerText || bestText.textElement.textContent, 160),
            href: '',
            visible: rect.width > 1 && rect.height > 1 && rect.bottom > 0 && rect.top < innerHeight,
          });
        }
      }
      if (!matches.length) return { found: false, count: 0 };
      matches.sort((a, b) => a.score - b.score || (b.visible ? 1 : 0) - (a.visible ? 1 : 0));
      const chosen = matches[0];
      chosen.element.scrollIntoView({ block: 'center', inline: 'center' });
      // A found control is usually an anchor, button or clickable card. Click
      // its DOM node directly; this is one round trip instead of a coordinate
      // mouse event that can land on a settling layout.
      chosen.element.click();
      return { found: true, count: matches.length, label: chosen.label, href: chosen.href };
    })()`
  type LinkMatch = { found?: boolean; count?: number; label?: string; href?: string }
  let result: LinkMatch | null = null
  // The matching row can be lazy-rendered below the fold. Scroll and rescan a
  // few times before concluding that the page does not expose the link.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    result = (await evaluate(cdp, page, scan)) as LinkMatch | null
    if (result?.found) break
    if (attempt < 2) {
      await evaluate(cdp, page, `window.scrollBy(0, Math.max(400, innerHeight * 0.8)); true`)
      await sleep(220)
    }
  }
  if (!result?.found) {
    throw new BrowserServiceError('browser_link', `No link matching “${wanted}” was found on this page.`, 404)
  }
  await sleep(120)
  return { label: result.label || wanted, count: result.count ?? 1 }
}

async function typeAction(
  cdp: Cdp,
  page: string,
  action: Extract<BrowserAction, { type: 'type' }>,
  instant = false,
): Promise<void> {
  if (action.selector) {
    const focused = await evaluate(
      cdp,
      page,
      `(() => {
        const element = document.querySelector(${JSON.stringify(action.selector)});
        if (!element) return false;
        try {
          element.scrollIntoView({ block: 'center', inline: 'center' });
          element.focus();
          // Some input types expose select() but reject it. Selection is only
          // an optimization here; typing into the focused field is what matters.
          if (typeof element.select === 'function') {
            try { element.select(); } catch {}
          }
        } catch {}
        return true;
      })()`,
    )
    if (!focused) throw new BrowserServiceError('browser_target', 'That input is no longer on the page.', 409)
    await sleep(35)
  }

  // The person's own fallback-view typing should stay instant. AI actions use
  // the native keyboard path and visibly type.
  if (instant) {
    await cdp.send('Input.insertText', { text: action.text.slice(0, 20_000) }, page)
  } else {
    const href = String((await evaluate(cdp, page, 'location.href')) ?? '')
    const isSheet = /docs\.google\.com\/spreadsheets\//i.test(href)
    if (!action.selector && isSheet && action.text.includes('\t')) await typeGrid(cdp, page, action.text)
    else await typeText(cdp, page, action.text, { budgetMs: 9_000 })
  }

  if (action.submit) {
    await pressKey(cdp, page, 'Enter', [])
    // Search forms usually navigate here. Give the new document a moment to
    // attach before the caller reads it back.
    await sleep(180)
    await waitReady(cdp, page, 'interactive')
  }
}

/**
 * Fill several fields as one planned step. This removes the model and snapshot
 * round trip between every field, while each value still arrives as native
 * keyboard input rather than a paste.
 */
async function fillAction(cdp: Cdp, page: string, action: Extract<BrowserAction, { type: 'fill' }>): Promise<void> {
  for (const field of action.fields) {
    if (field.value) {
      await typeAction(cdp, page, { type: 'type', selector: field.selector, text: field.value })
    } else {
      await focusAction(cdp, page, field.selector)
      await evaluate(
        cdp,
        page,
        `(() => {
          const element = document.querySelector(${JSON.stringify(field.selector)});
          if (element && typeof element.select === 'function') element.select();
        })()`,
      )
      await pressKey(cdp, page, 'Backspace', [])
    }
    await sleep(40)
  }
  if (action.submit) {
    await pressKey(cdp, page, 'Enter', [])
    await sleep(180)
    await waitReady(cdp, page, 'interactive')
  }
}

function waitForExpression(action: Extract<BrowserAction, { type: 'waitFor' }>): string {
  const state = action.state ?? 'visible'
  if (state === 'time') return 'true'
  if (state === 'ended') {
    const selector = action.selector || 'video'
    return `(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) return false;
      if (element.ended) return true;
      const duration = Number(element.duration);
      return Number.isFinite(duration) && duration > 0 && element.currentTime >= duration - 0.25;
    })()`
  }
  if (action.text) {
    const text = JSON.stringify(action.text)
    return `(() => {
      const body = document.body ? document.body.innerText : '';
      return ${state === 'hidden' ? '!' : ''}body.includes(${text});
    })()`
  }
  const selector = JSON.stringify(action.selector || '')
  return `(() => {
    const element = document.querySelector(${selector});
    if (!element) return ${state === 'hidden' ? 'true' : 'false'};
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const shown = rect.width > 1 && rect.height > 1 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    return ${state === 'hidden' ? '!shown' : 'shown'};
  })()`
}

async function waitForAction(
  cdp: Cdp,
  page: string,
  action: Extract<BrowserAction, { type: 'waitFor' }>,
): Promise<void> {
  const timeoutMs = Math.max(1_000, Math.min(600_000, action.timeoutMs ?? 120_000))
  if (action.state === 'time') {
    await sleep(timeoutMs)
    return
  }
  const expression = waitForExpression(action)
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if (await evaluate(cdp, page, expression)) return
    await sleep(1_000)
  }
  const seconds = Math.round(timeoutMs / 1_000)
  throw new BrowserServiceError(
    'browser_timeout',
    `The page did not reach that state within ${seconds} seconds. Check the live view and try again.`,
    504,
  )
}

async function styleAction(cdp: Cdp, page: string, css: string): Promise<void> {
  await evaluate(
    cdp,
    page,
    `(() => {
      const id = 'stet-style';
      let element = document.getElementById(id);
      if (!element) {
        element = document.createElement('style');
        element.id = id;
        (document.head || document.documentElement).appendChild(element);
      }
      element.textContent = ${JSON.stringify(css)};
      return true;
    })()`,
  )
}

async function evaluateAction(cdp: Cdp, page: string, expression: string): Promise<string> {
  // The planner gets general DOM access, not a handful of fixed edits. Wrap the
  // source in an async function so it can use return and await normally.
  const result = await evaluate(cdp, page, `(async () => {\n${expression}\n})()`)
  if (result === undefined || result === null) return 'The page code ran and returned no value.'
  let rendered = ''
  try {
    rendered = typeof result === 'string' ? result : JSON.stringify(result)
  } catch {
    rendered = String(result)
  }
  return (rendered || '(empty)').slice(0, 2_000)
}

async function pressKey(cdp: Cdp, page: string, key: string, modifiers: string[]): Promise<void> {
  const bits = modifiers.reduce(
    (total, modifier) => total + ({ Alt: 1, Ctrl: 2, Meta: 4, Shift: 8 }[modifier] || 0),
    0,
  )
  const known: Record<string, { code: string; keyCode: number }> = {
    Enter: { code: 'Enter', keyCode: 13 },
    Tab: { code: 'Tab', keyCode: 9 },
    Escape: { code: 'Escape', keyCode: 27 },
    Backspace: { code: 'Backspace', keyCode: 8 },
    Delete: { code: 'Delete', keyCode: 46 },
    ArrowUp: { code: 'ArrowUp', keyCode: 38 },
    ArrowDown: { code: 'ArrowDown', keyCode: 40 },
    ArrowLeft: { code: 'ArrowLeft', keyCode: 37 },
    ArrowRight: { code: 'ArrowRight', keyCode: 39 },
    Home: { code: 'Home', keyCode: 36 },
    End: { code: 'End', keyCode: 35 },
    PageUp: { code: 'PageUp', keyCode: 33 },
    PageDown: { code: 'PageDown', keyCode: 34 },
    Space: { code: 'Space', keyCode: 32 },
  }
  const info = known[key] || {
    code: key.length === 1 ? `Key${key.toUpperCase()}` : key,
    keyCode: key.length === 1 ? key.toUpperCase().charCodeAt(0) : 0,
  }
  const base = {
    key,
    code: info.code,
    windowsVirtualKeyCode: info.keyCode,
    nativeVirtualKeyCode: info.keyCode,
    modifiers: bits,
  }
  // Enter and Tab need their text payload or some forms ignore the default
  // action. This is what makes typing a query and pressing Enter submit.
  const text = key === 'Enter' ? '\r' : key === 'Tab' ? '\t' : undefined
  await cdp.send(
    'Input.dispatchKeyEvent',
    { type: 'keyDown', ...base, ...(text && !bits ? { text, unmodifiedText: text } : {}) },
    page,
  )
  if (key.length === 1 && !bits) {
    await cdp.send('Input.dispatchKeyEvent', { type: 'char', ...base, text: key, unmodifiedText: key }, page)
  }
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base }, page)
}

type TypeOptions = { budgetMs?: number; maxMs?: number; delayMs?: number; batchSize?: number }

const PUNCTUATION_KEYS: Record<string, { code: string; keyCode: number; shift: boolean }> = {
  '!': { code: 'Digit1', keyCode: 49, shift: true },
  '"': { code: 'Quote', keyCode: 222, shift: true },
  '#': { code: 'Digit3', keyCode: 51, shift: true },
  $: { code: 'Digit4', keyCode: 52, shift: true },
  '%': { code: 'Digit5', keyCode: 53, shift: true },
  '&': { code: 'Digit7', keyCode: 55, shift: true },
  "'": { code: 'Quote', keyCode: 222, shift: false },
  '(': { code: 'Digit9', keyCode: 57, shift: true },
  ')': { code: 'Digit0', keyCode: 48, shift: true },
  '*': { code: 'Digit8', keyCode: 56, shift: true },
  '+': { code: 'Equal', keyCode: 187, shift: true },
  ',': { code: 'Comma', keyCode: 188, shift: false },
  '-': { code: 'Minus', keyCode: 189, shift: false },
  '.': { code: 'Period', keyCode: 190, shift: false },
  '/': { code: 'Slash', keyCode: 191, shift: false },
  ':': { code: 'Semicolon', keyCode: 186, shift: true },
  ';': { code: 'Semicolon', keyCode: 186, shift: false },
  '<': { code: 'Comma', keyCode: 188, shift: true },
  '=': { code: 'Equal', keyCode: 187, shift: false },
  '>': { code: 'Period', keyCode: 190, shift: true },
  '?': { code: 'Slash', keyCode: 191, shift: true },
  '@': { code: 'Digit2', keyCode: 50, shift: true },
  '[': { code: 'BracketLeft', keyCode: 219, shift: false },
  '\\': { code: 'Backslash', keyCode: 220, shift: false },
  ']': { code: 'BracketRight', keyCode: 221, shift: false },
  '^': { code: 'Digit6', keyCode: 54, shift: true },
  _: { code: 'Minus', keyCode: 189, shift: true },
  '`': { code: 'Backquote', keyCode: 192, shift: false },
  '{': { code: 'BracketLeft', keyCode: 219, shift: true },
  '|': { code: 'Backslash', keyCode: 220, shift: true },
  '}': { code: 'BracketRight', keyCode: 221, shift: true },
  '~': { code: 'Backquote', keyCode: 192, shift: true },
}

function characterKey(char: string): { code: string; keyCode: number; shift: boolean } {
  if (char === ' ') return { code: 'Space', keyCode: 32, shift: false }
  if (/[a-z]/.test(char)) return { code: `Key${char.toUpperCase()}`, keyCode: char.toUpperCase().charCodeAt(0), shift: false }
  if (/[A-Z]/.test(char)) return { code: `Key${char}`, keyCode: char.charCodeAt(0), shift: true }
  if (/[0-9]/.test(char)) return { code: `Digit${char}`, keyCode: 48 + Number(char), shift: false }
  return PUNCTUATION_KEYS[char] ?? { code: '', keyCode: 0, shift: false }
}

/** One printable ASCII character through a native keyDown carrying text. */
async function typeAsciiCharacter(cdp: Cdp, page: string, char: string): Promise<void> {
  const info = characterKey(char)
  const base = {
    key: char,
    code: info.code,
    windowsVirtualKeyCode: info.keyCode,
    nativeVirtualKeyCode: info.keyCode,
    modifiers: info.shift ? 8 : 0,
  }
  // A keyDown carrying text is how Chrome receives a printable key. Sending a
  // separate char event as well doubles the input work (and made remote typing
  // feel laggy); keyUp is not needed to commit the character.
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', ...base, text: char, unmodifiedText: char }, page)
}

/**
 * Type the way a person does: one native keyDown per character, with a short
 * human cadence. Nothing printable is ever pasted in one insert, so the live
 * view shows the text arriving character by character. Long documents keep
 * the same path but use a faster cadence.
 */
async function typeText(cdp: Cdp, page: string, text: string, options: TypeOptions = {}): Promise<void> {
  const characters = Array.from(text.slice(0, 20_000))
  if (!characters.length) return
  // A CDP connection is ordered, so several keydowns can be in flight at once
  // without reordering the text. They are still individual native keyboard
  // events, not one insertText paste; only the network waits are pipelined.
  // Keep the live view visibly typed: tiny native key batches with a short
  // cadence, instead of one huge in-flight block that reads as a paste.
  // Short fields keep a visible key-by-key rhythm. Long documents use wide
  // ordered batches so the cloud round trip does not dominate every few
  // characters; every character is still a separate native key event.
  const batchSize = options.batchSize ?? (characters.length <= 80 ? 4 : characters.length <= 400 ? 8 : 16)
  const delay = options.delayMs ?? (characters.length <= 80 ? 8 : characters.length <= 400 ? 5 : 3)
  let pending: Promise<void>[] = []
  const flush = async () => {
    if (!pending.length) return
    const current = pending
    pending = []
    await Promise.all(current)
  }
  for (const char of characters) {
    if (char === '\r') continue
    if (char === '\n' || char === '\t' || char === '\b') {
      await flush()
      await pressKey(cdp, page, char === '\n' ? 'Enter' : char === '\t' ? 'Tab' : 'Backspace', [])
    } else if (char >= ' ' && char <= '~') {
      pending.push(typeAsciiCharacter(cdp, page, char))
    }
    else {
      // IME and non-Latin text cannot be represented by an ASCII key code.
      // Send one code point at a time as a character event, not a paste.
      pending.push(cdp.send('Input.dispatchKeyEvent', { type: 'char', key: char, text: char, unmodifiedText: char }, page))
    }
    if (pending.length >= batchSize) {
      await flush()
      if (delay > 0) await sleep(delay)
    }
  }
  await flush()
}

/**
 * Sheets is a canvas: a table is one contiguous typing run. Tabs move across
 * the row, Enter commits it, and Home returns to column A. This is the same
 * keyboard path a person uses, not a clipboard paste or a DOM assignment.
 */
async function typeGrid(cdp: Cdp, page: string, text: string): Promise<void> {
  const rows = text.replace(/\r\n?/g, '\n').replace(/\n+$/, '').split('\n')
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const cells = rows[rowIndex].split('\t')
    for (let cellIndex = 0; cellIndex < cells.length; cellIndex += 1) {
      // One cell is one ordered batch: every character is still a native key
      // event, but the cloud round trip no longer happens per character.
      if (cells[cellIndex]) await typeText(cdp, page, cells[cellIndex], { batchSize: 256, delayMs: 0 })
      if (cellIndex < cells.length - 1) {
        await pressKey(cdp, page, 'Tab', [])
        await sleep(10)
      }
    }
    // Commit the row and go back to column A for the next one.
    await pressKey(cdp, page, 'Enter', [])
    await sleep(12)
    await pressKey(cdp, page, 'Home', [])
    await sleep(10)
  }
}

export async function performAction(env: Env, sessionId: string, action: BrowserAction, read = true): Promise<BrowserViewState | null> {
  return withPage(env, sessionId, async (cdp, page) => {
    let activePage = page
    let observation = ''
    let capturedScreenshot: string | undefined
    // Classroom and Edpuzzle links often use target="_blank". Without noticing
    // the new target, the next snapshot (and the planner) still come from the
    // old tab, which makes it look like the browser jumped back to Sheets.
    const targetsBefore =
      action.type === 'click' || action.type === 'findLink'
        ? await cdp.send<{ targetInfos?: CdpTarget[] }>('Target.getTargets').catch(() => null)
        : null
    let inspected: BrowserInspectResult | null = null
    switch (action.type) {
      case 'click':
        await clickAction(cdp, page, action)
        await sleep(120)
        break
      case 'findLink':
        {
          const match = await findLinkAction(cdp, page, action.text)
          observation = `Opened the matching link “${match.label}”${match.count > 1 ? ` (${match.count} candidates)` : ''}.`
        }
        break
      case 'hover':
        await hoverAction(cdp, page, action)
        await sleep(80)
        break
      case 'drag':
        await dragAction(cdp, page, action)
        await sleep(120)
        break
      case 'focus':
        await focusAction(cdp, page, action.selector)
        await sleep(60)
        break
      case 'fill':
        await fillAction(cdp, page, action)
        await sleep(80)
        break
      case 'select':
        await selectAction(cdp, page, action)
        await sleep(80)
        break
      case 'check':
        await checkAction(cdp, page, action)
        await sleep(80)
        break
      case 'type':
        // read=true is an AI action, so it must visibly type. The live-view
        // fallback sends read=false for the person's own buffered keystrokes
        // and should stay instant.
        await typeAction(cdp, page, action, !read)
        await sleep(80)
        break
      case 'press':
        await pressKey(cdp, page, action.key, action.modifiers ?? [])
        await sleep(80)
        break
      case 'scroll': {
        const dx = Number.isFinite(Number(action.x)) ? Number(action.x) : 0
        const dy = Number.isFinite(Number(action.y)) ? Number(action.y) : 400
        // A real wheel event, not a scripted scroll. Lazy-loaded pages and
        // scroll containers react the same way they do to a trackpad.
        await cdp.send(
          'Input.dispatchMouseEvent',
          { type: 'mouseWheel', x: 640, y: 400, deltaX: dx, deltaY: dy, button: 'none', buttons: 0 },
          page,
        )
        await sleep(90)
        break
      }
      case 'navigate':
        if (read) {
          await navigate(cdp, page, action.url)
        } else {
          // Direct opens do not need a DOM snapshot; let the live view load
          // while the command returns immediately.
          const result = await cdp.send<{ errorText?: string }>('Page.navigate', { url: action.url }, page)
          if (result.errorText) throw new BrowserServiceError('browser_navigation', result.errorText, 502)
        }
        break
      case 'back':
      case 'forward': {
        // Native Chrome history, not a page-level script call. This is exactly
        // what the browser's own Back and Forward buttons do.
        const history = await cdp.send<{ currentIndex: number; entries: { id: number }[] }>(
          'Page.getNavigationHistory',
          {},
          page,
        )
        const entry = history.entries[history.currentIndex + (action.type === 'back' ? -1 : 1)]
        if (!entry) {
          throw new BrowserServiceError(
            'browser_history',
            action.type === 'back' ? 'There is no previous page in this tab.' : 'There is no next page in this tab.',
            409,
          )
        }
        await cdp.send('Page.navigateToHistoryEntry', { entryId: entry.id }, page)
        await sleep(120)
        break
      }
      case 'reload':
        await cdp.send('Page.reload', {}, page)
        await sleep(120)
        break
      case 'wait':
        await sleep(Math.max(100, Math.min(3_000, action.ms)))
        break
      case 'waitFor':
        await waitForAction(cdp, page, action)
        break
      case 'inspect':
        inspected = await readInspect(cdp, page, action.selector ?? '')
        observation = `Inspected ${inspected.matched} element${inspected.matched === 1 ? '' : 's'}${action.selector ? ` for ${action.selector}` : ' on the page'}.`
        await sleep(100)
        break
      case 'screenshot':
        capturedScreenshot = await screenshot(cdp, activePage)
        observation = capturedScreenshot ? 'Captured the current browser viewport.' : 'The browser could not capture a screenshot.'
        break
      case 'style':
        await styleAction(cdp, page, action.css)
        observation = 'Applied the style change.'
        await sleep(100)
        break
      case 'evaluate':
        observation = await evaluateAction(cdp, page, action.expression)
        await sleep(100)
        break
      case 'ask':
      case 'done':
        break
    }
    if (targetsBefore) {
      const targetsAfter = await cdp.send<{ targetInfos?: CdpTarget[] }>('Target.getTargets').catch(() => null)
      const before = new Set((targetsBefore.targetInfos ?? []).map((target) => target.targetId))
      const opened = (targetsAfter?.targetInfos ?? [])
        .filter((target) => target.type === 'page' && !before.has(target.targetId))
        .at(-1)
      if (opened) {
        try {
          await cdp.send('Target.activateTarget', { targetId: opened.targetId }).catch(() => undefined)
          activePage = await attachTarget(cdp, opened.targetId)
          if (activePage !== page) inspected = null
        } catch {
          // The click may open and immediately close a helper window. Keep the
          // page we were already controlling instead of failing the action.
          activePage = page
        }
      }
    }
    if (!read) return null
    const state = await readPage(cdp, activePage)
    return {
      ...state,
      ...(inspected ? { inspect: inspected } : {}),
      ...(observation ? { observation } : {}),
      ...(capturedScreenshot ? { screenshot: capturedScreenshot } : {}),
    }
  })
}
