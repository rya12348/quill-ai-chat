// Ink's service worker. __STET_VERSION__ is replaced at build time by
// scripts/postbuild.mjs with a hash of the build, so each deploy uses fresh
// caches and old ones are removed on activate.
//
// Strategy:
// - navigations: network first, then the cached page or the cached shell. A
//   fresh online load always gets the current HTML, so a redeploy cannot leave
//   anyone on a dead shell.
// - API GETs: network only. API responses can contain another account's
//   conversations or images on a shared browser profile, so they are never
//   written into the origin-wide Cache Storage. Synthetic offline responses
//   carry x-stet-offline: 1 so the app can show its offline indicator.
// - API writes (including the chat stream): pass through untouched online. If
//   the network is down they get a JSON 503, so the composer can keep the draft
//   and show a non-fatal message instead of a browser network error.
// - static assets: cache first (they are content-hashed), fetched and stored
//   on first use.
//
// The install step precaches the complete built shell, including every hashed
// JS/CSS/font file referenced by index.html. Without those assets an offline
// page would have the HTML but no app to render it.
const VERSION = '__STET_VERSION__'
const SHELL = `stet-shell-${VERSION}`
const ASSETS = `stet-assets-${VERSION}`
const OFFLINE_HEADER = 'x-stet-offline'
// Replaced by scripts/postbuild.mjs with the emitted shell and asset URLs.
const SHELL_URLS = __STET_PRECACHE__

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL)
      await Promise.all(
        SHELL_URLS.map(async (url) => {
          try {
            const response = await fetch(url, { cache: 'reload' })
            if (response.ok) await cache.put(url, response)
          } catch {
            /* one missing shell file must not block the install */
          }
        }),
      )
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL, ASSETS])
      const names = await caches.keys()
      await Promise.all(names.filter((name) => name.startsWith('stet-') && !keep.has(name)).map((name) => caches.delete(name)))
      await self.clients.claim()
    })(),
  )
})

const isApi = (url) => url.pathname.startsWith('/api/')
const isStatic = (url) => url.pathname.startsWith('/assets/') || /\.(?:css|js|mjs|woff2?|ttf|png|svg|ico|webmanifest|json)$/i.test(url.pathname)

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** A network handoff can fail the first request while the browser is online. */
async function fetchWithRetry(request) {
  try {
    return await fetch(request)
  } catch {
    await wait(350)
    return fetch(request)
  }
}

function offlineJson(message) {
  return new Response(JSON.stringify({ error: 'offline', message }), {
    status: 503,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', [OFFLINE_HEADER]: '1' },
  })
}

function fromCache(response) {
  const headers = new Headers(response.headers)
  headers.set(OFFLINE_HEADER, '1')
  headers.set('cache-control', 'no-store')
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}

async function networkOnlyApi(request) {
  try {
    return await fetchWithRetry(request)
  } catch {
    return offlineJson('Not available offline.')
  }
}

// The health probe is the one API request that must reflect the network right
// now. Do not let a successful response cached before a handoff keep answering
// while the network is down, or vice versa.
async function networkOnlyHealth(request) {
  try {
    return await fetchWithRetry(request)
  } catch {
    return offlineJson('Not available offline.')
  }
}

async function networkFirstNavigation(request) {
  try {
    const response = await fetchWithRetry(request)
    if (response.ok) {
      const cache = await caches.open(SHELL)
      await cache.put(request, response.clone()).catch(() => {})
    }
    return response
  } catch {
    const cached = await caches.match(request)
    if (cached) return fromCache(cached)
    const shell = await caches.match('/')
    if (shell) return fromCache(shell)
    return new Response('Offline', { status: 503, headers: { 'content-type': 'text/plain' } })
  }
}

async function cacheFirstAsset(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) {
    const cache = await caches.open(ASSETS)
    await cache.put(request, response.clone()).catch(() => {})
  }
  return response
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname === '/sw.js') return
  // The proxied site space belongs to the /service/ worker. A frame inside a
  // proxied page can end up seen by this worker instead, and answering a
  // site's own request from the app's cache — or with the app's 404 for
  // /service/ paths — leaves the frame empty. Never touch it here.
  if (
    url.pathname.startsWith('/service/') ||
    url.pathname.startsWith('/api/web-proxy/') ||
    url.pathname.startsWith('/api/poki-')
  )
    return

  if (request.method !== 'GET') {
    if (!isApi(url)) return
    // A chat send carries a client message id, so replaying it after a failed
    // handoff cannot create a duplicate turn. Other writes are never retried
    // because they do not all have an idempotency key.
    const retryable = url.pathname === '/api/chat' && request.headers.get('x-stet-idempotent') === '1'
    const retry = retryable ? request.clone() : null
    event.respondWith(
      (async () => {
        try {
          return await fetch(request)
        } catch (error) {
          if (error && error.name === 'AbortError') throw error
          if (retry) {
            await wait(400)
            try {
              return await fetch(retry)
            } catch (retryError) {
              if (retryError && retryError.name === 'AbortError') throw retryError
            }
          }
          return offlineJson(
            url.pathname === '/api/proxy/session'
              ? 'Could not reach Ink to start the proxy. Check your connection and try again.'
              : "Couldn't send that message. Check your connection and try again.",
          )
        }
      })(),
    )
    return
  }

  if (isApi(url)) {
    event.respondWith(url.pathname === '/api/health' ? networkOnlyHealth(request) : networkOnlyApi(request))
    return
  }
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request))
    return
  }
  if (isStatic(url)) {
    event.respondWith(cacheFirstAsset(request))
  }
})
