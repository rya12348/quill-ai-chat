// Offline state shared across the app. The service worker marks responses it
// serves from cache (or synthesises while the network is down) with
// x-stet-offline: 1; the fetch helpers report that here. Browsers can report
// `navigator.onLine === false` while requests still work (especially around
// sleep, resume and Wi-Fi handoff), so offline is only shown after repeated
// health probes fail. A live HTTP response counts as reachable even when the
// server itself returns 5xx: that is an outage, not a missing connection.
import { useSyncExternalStore } from 'react'

let offline = false
let verification: Promise<boolean> | null = null
let generation = 0
const listeners = new Set<() => void>()

const HEALTH_ATTEMPTS = 3
const HEALTH_TIMEOUT = 3_000
const RETRY_DELAY = 350

function emit() {
  listeners.forEach((listener) => listener())
}

export function setOffline(next: boolean) {
  if (offline === next) return
  offline = next
  emit()
}

function isOfflineResponse(response: Response): boolean {
  return response.headers.get('x-stet-offline') === '1'
}

/** A synchronous signal that a request proved the network is reachable now. */
function markReachable() {
  generation += 1
  verification = null
  setOffline(false)
}

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Probe /api/health a few times before declaring the app offline. One failed
 * fetch is common during a Wi-Fi handoff, and aborted requests are retried.
 * `fetcher` and `retryDelay` are injectable for tests.
 */
export async function probeHealth(fetcher: typeof fetch = fetch, retryDelay = RETRY_DELAY): Promise<boolean> {
  for (let attempt = 0; attempt < HEALTH_ATTEMPTS; attempt += 1) {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT)
      const response = await fetcher('/api/health', {
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { accept: 'application/json' },
        signal: controller.signal,
      })
      // Any real response, including a 5xx, proves the request reached a
      // server. Only the service worker's offline marker means the network was
      // unavailable.
      if (!isOfflineResponse(response)) return true
    } catch {
      /* a handoff, timeout or service-worker failure: try again */
    } finally {
      if (timer !== undefined) clearTimeout(timer)
    }
    if (attempt < HEALTH_ATTEMPTS - 1) await wait(retryDelay)
  }
  return false
}

/**
 * Asks the server whether it is reachable before changing the offline banner.
 * A cached health response is marked by the service worker, so a truly offline
 * app still reports offline; a false browser offline flag does not.
 */
export function checkConnection(): Promise<boolean> {
  if (verification) return verification
  const sequence = ++generation
  const current = (async () => {
    const reachable = await probeHealth()
    // An `online` event or a live API response may have arrived while this
    // probe was running. Never let the older result overwrite newer evidence.
    if (sequence === generation) setOffline(!reachable)
    return reachable
  })()
  verification = current
  void current.finally(() => {
    if (verification === current) verification = null
  })
  return current
}

/** Called with every app response; a live server response clears the state. */
export function noteOffline(response: Response) {
  if (isOfflineResponse(response)) {
    // A single failed write can be a transient handoff. Confirm with the
    // health route before showing the global offline banner.
    void checkConnection()
    return
  }
  markReachable()
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => markReachable())
  window.addEventListener('offline', () => void checkConnection())
  if (!navigator.onLine) void checkConnection()
}

export function useOffline(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => offline,
    () => offline,
  )
}
