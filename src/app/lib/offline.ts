// Offline state shared across the app. The service worker marks responses it
// serves from cache (or synthesises while the network is down) with
// x-quill-offline: 1; the fetch helpers report that here. The browser's own
// online/offline events cover the case where no request was made yet.
import { useSyncExternalStore } from 'react'

let offline = typeof navigator !== 'undefined' ? !navigator.onLine : false
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((listener) => listener())
}

export function setOffline(next: boolean) {
  if (offline === next) return
  offline = next
  emit()
}

/** Called with every app response; a live server response clears the state. */
export function noteOffline(response: Response) {
  if (response.headers.get('x-quill-offline') === '1') setOffline(true)
  else if (response.ok || response.status < 500) setOffline(false)
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => setOffline(false))
  window.addEventListener('offline', () => setOffline(true))
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
