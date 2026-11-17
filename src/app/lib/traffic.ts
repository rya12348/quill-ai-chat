import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router'

import { isVisitorId, trafficPath } from '../../shared/traffic'

const VISITOR_KEY = 'ink:traffic-visitor:v1'
let memoryVisitorId: string | undefined

/**
 * One random browser id shared by every beacon from this tab. It is created
 * before the first request, so two effects firing together cannot claim two
 * different visitors before the server's cookie comes back. The server also
 * sets a cookie; either one keeps the visitor stable if the other is cleared.
 */
function trafficVisitorId(): string {
  if (memoryVisitorId) return memoryVisitorId
  try {
    const stored = window.localStorage.getItem(VISITOR_KEY)
    if (isVisitorId(stored)) {
      memoryVisitorId = stored
      return stored
    }
  } catch {
    // Storage can be unavailable in private or restricted contexts.
  }
  const created = crypto.randomUUID()
  memoryVisitorId = created
  try {
    window.localStorage.setItem(VISITOR_KEY, created)
  } catch {
    // The in-memory id still keeps this page stable.
  }
  return created
}

/**
 * Records page views as the SPA changes route. Static pages are served by the
 * assets binding without entering the Worker, so the Worker cannot count them
 * on its own. This sends one beacon per new normalized path and never includes
 * the query string, conversation id or share token.
 */
export function usePageTraffic() {
  const location = useLocation()
  const last = useRef<string | null>(null)

  useEffect(() => {
    const path = trafficPath(location.pathname)
    if (!path || path === last.current) return
    last.current = path
    void fetch('/api/traffic', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path, visitorId: trafficVisitorId() }),
      keepalive: true,
    }).catch(() => {
      // Traffic is best-effort; a failed count must never interrupt the page.
    })
  }, [location.pathname])
}
