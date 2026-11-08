import { WifiOff } from 'lucide-react'

import { useOffline } from '../lib/offline'

/** A quiet, non-blocking reminder that this page is running from the cache. */
export function OfflineBanner() {
  const offline = useOffline()
  if (!offline) return null
  return (
    <div
      role="status"
      className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-[12.5px] font-medium text-muted shadow-pop"
    >
      <WifiOff className="size-3.5 text-warning" aria-hidden />
      Offline — showing saved chats. New messages are saved as drafts.
    </div>
  )
}
