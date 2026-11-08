// Quill's service worker. __QUILL_VERSION__ is replaced at build time by
// scripts/postbuild.mjs with a hash of the build, so each deploy uses fresh
// caches and old ones are removed on activate.
//
// Strategy:
// - navigations: network first, then the cached page or the cached shell. A
//   fresh online load always gets the current HTML, so a redeploy cannot leave
//   anyone on a dead shell.
// - API GETs: network first, cached only when the network fails. Online reads
//   are never stale. Cached and synthetic offline responses carry
//   x-quill-offline: 1 so the app can show its offline indicator.
// - API writes (including the chat stream): pass through untouched online. If
//   the network is down they get a JSON 503, so the composer can keep the draft
//   and show a non-fatal message instead of a browser network error.
// - static assets: cache first (they are content-hashed), fetched and stored
//   on first use.
//
// The install step precaches the complete built shell, including every hashed
// JS/CSS/font file referenced by index.html. Without those assets an offline
// page would have the HTML but no app to render it.
const VERSION = '__QUILL_VERSION__'
const SHELL = `quill-shell-${VERSION}`
const ASSETS = `quill-assets-${VERSION}`
const API = `quill-api-${VERSION}`
const OFFLINE_HEADER = 'x-quill-offline'
// Replaced by scripts/postbuild.mjs with the emitted shell and asset URLs.
const SHELL_URLS = __QUILL_PRECACHE__

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
      const keep = new Set([SHELL, ASSETS, API])
      const names = await caches.keys()
      await Promise.all(names.filter((name) => name.startsWith('quill-') && !keep.has(name)).map((name) => caches.delete(name)))
      await self.clients.claim()
    })(),
  )
})

const isApi = (url) => url.pathname.startsWith('/api/')
const isStatic = (url) => url.pathname.startsWith('/assets/') || /\.(?:css|js|mjs|woff2?|ttf|png|svg|ico|webmanifest|json)$/i.test(url.pathname)

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

async function networkFirstApi(request) {
  try {
    const response = await fetch(request)
    if (response.ok && (response.headers.get('content-type') ?? '').includes('application/json')) {
      const cache = await caches.open(API)
      await cache.put(request, response.clone()).catch(() => {})
    }
    return response
  } catch {
    const cached = await caches.match(request, { cacheName: API })
    if (cached) return fromCache(cached)
    return offlineJson('Not available offline.')
  }
}

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request)
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

  if (request.method !== 'GET') {
    if (!isApi(url)) return
    event.respondWith(
      (async () => {
        try {
          return await fetch(request)
        } catch {
          return offlineJson("You're offline — this message wasn't sent.")
        }
      })(),
    )
    return
  }

  if (isApi(url)) {
    event.respondWith(networkFirstApi(request))
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
