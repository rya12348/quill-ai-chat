import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './app/App'
import { clearAttention } from './app/lib/attention'
import { initTheme } from './app/lib/theme'
import './styles.css'
import './retro.css'
import './butter-party.css'
import './butter-modes.css'
import './dive.css'

initTheme()
// A reload starts with no unread room messages, so never keep the previous
// tab count or app badge from an earlier session.
clearAttention()

const codespaces = /\.(?:app\.github\.dev|githubpreview\.dev)$/i.test(window.location.hostname)
const canUseServiceWorker = 'serviceWorker' in navigator

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// A service worker from an earlier production preview can outlive the dev
// server and serve a stale shell or API cache. Drop it and Ink's caches
// whenever Vite is running in development or the page is on Codespaces.
if ((import.meta.env.DEV || codespaces) && canUseServiceWorker) {
  void (async () => {
    // The in-app browser is served by the worker now, so an Ultraviolet worker
    // left under /service/ only serves stale assets; remove it with the rest.
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registrations.map((registration) => registration.unregister()))
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.filter((key) => key.startsWith('stet-')).map((key) => caches.delete(key)))
    }
  })().catch(() => {
    /* a locked-down browser can refuse worker or cache access */
  })
}

// The service worker makes the built app installable and readable offline. It
// is production-only and never runs on the Codespaces preview: that origin is
// a dev server, and a cached shell there would hide source edits.
if (import.meta.env.PROD && !codespaces && canUseServiceWorker) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {
      /* offline on a first visit: the page still works without it */
    })
    // The in-app browser renders every real site through its own worker under
    // /service/. Without this registration each proxied address answers 404 and
    // a shortcut opens on a blank frame, so it is registered on every load.
    void navigator.serviceWorker
      .register('/service/sw.js', { scope: '/service/', updateViaCache: 'none' })
      .catch(() => {
        /* the browser refuses a nested worker: the proxy reports it instead */
      })
  })
}
