import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './app/App'
import { initTheme } from './app/lib/theme'
import './styles.css'

initTheme()

const codespaces = /\.(?:app\.github\.dev|githubpreview\.dev)$/i.test(window.location.hostname)
const canUseServiceWorker = 'serviceWorker' in navigator

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// A service worker from an earlier production preview can outlive the dev
// server and serve a stale shell or API cache. Drop it and Quill's caches
// whenever Vite is running in development or the page is on Codespaces.
if ((import.meta.env.DEV || codespaces) && canUseServiceWorker) {
  void (async () => {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registrations.map((registration) => registration.unregister()))
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.filter((key) => key.startsWith('quill-')).map((key) => caches.delete(key)))
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
    void navigator.serviceWorker.register('/sw.js').catch(() => {
      /* offline on a first visit: the page still works without it */
    })
  })
}
