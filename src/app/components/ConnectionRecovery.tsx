import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { checkConnection, setOffline, useOffline } from '../lib/offline'

const PROBE_INTERVAL = 5_000

/**
 * Chromebooks can briefly report a page as offline around sleep, resume or a
 * Wi-Fi handoff. The browser's online event is not guaranteed in those cases,
 * so while the app is offline, probe the small health route and refetch what is
 * on screen as soon as the server answers.
 */
export function ConnectionRecovery() {
  const offline = useOffline()
  const client = useQueryClient()

  // A tab resuming with a failed query should not stay on the offline error
  // until the person reloads. These events are cheap and only retry failures
  // outside the offline polling loop.
  useEffect(() => {
    const retryFailed = () => {
      void client.refetchQueries({
        type: 'active',
        predicate: (query) => query.state.status === 'error',
      })
    }
    const onOnline = () => {
      setOffline(false)
      retryFailed()
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') retryFailed()
    }
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [client])

  useEffect(() => {
    if (!offline) return
    let stopped = false
    let probing = false
    const probe = async () => {
      if (stopped || probing) return
      probing = true
      try {
        const reachable = await checkConnection()
        if (stopped || !reachable) return
        await client.refetchQueries({ type: 'active' })
      } finally {
        probing = false
      }
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible') void probe()
    }
    const timer = window.setInterval(() => void probe(), PROBE_INTERVAL)
    document.addEventListener('visibilitychange', onVisible)
    void probe()
    return () => {
      stopped = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [client, offline])

  return null
}
