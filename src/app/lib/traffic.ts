import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router'

import { trafficPath } from '../../shared/traffic'

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
      body: JSON.stringify({ path }),
      keepalive: true,
    }).catch(() => {
      // Traffic is best-effort; a failed count must never interrupt the page.
    })
  }, [location.pathname])
}
