import { ROOM_MESSAGE_TTL_MS } from '../../shared/config'

// Tabs coordinate through a BroadcastChannel for visibility and through Web
// Locks plus a small localStorage ledger for delivery. The ledger matters even
// after a lock is released: two tabs poll independently, so the second tab can
// see the same message many seconds after the first one already alerted.
const CHANNEL_NAME = 'ink:room-notifications'
const DELIVERY_PREFIX = 'ink:notification-delivered:'
const PRESENCE_TTL_MS = 4_000
const HEARTBEAT_MS = 1_500
const VISIBLE_SETTLE_MS = 140
const CLAIM_HOLD_MS = 450

type TabPresence = {
  id: string
  visible: boolean
  at: number
}

type WireMessage =
  | { type: 'presence'; tab: TabPresence }
  | { type: 'presence-request' }
  | { type: 'bye'; id: string }

const TAB_ID = crypto.randomUUID()
const peers = new Map<string, TabPresence>()
let channel: BroadcastChannel | null = null
let started = false
let selfVisible = document.visibilityState === 'visible'
let heartbeat: number | undefined

function post(message: WireMessage): void {
  try {
    channel?.postMessage(message)
  } catch {
    /* a closing tab can fail to send; its presence expires shortly */
  }
}

function presence(): TabPresence {
  return { id: TAB_ID, visible: selfVisible, at: Date.now() }
}

function broadcastPresence(): void {
  if (!started) return
  post({ type: 'presence', tab: presence() })
}

function prunePeers(): void {
  const at = Date.now()
  for (const [id, peer] of peers) {
    if (at - peer.at > PRESENCE_TTL_MS) peers.delete(id)
  }
}

function onChannelMessage(event: MessageEvent<WireMessage>): void {
  const message = event.data
  if (!message || typeof message !== 'object') return
  if (message.type === 'presence') {
    if (message.tab.id === TAB_ID) return
    peers.set(message.tab.id, message.tab)
    return
  }
  if (message.type === 'presence-request') {
    broadcastPresence()
    return
  }
  if (message.type === 'bye') {
    peers.delete(message.id)
  }
}

function onVisibilityChange(): void {
  const next = document.visibilityState === 'visible'
  if (next === selfVisible) return
  selfVisible = next
  broadcastPresence()
}

function pruneDeliveryLedger(): void {
  try {
    const at = Date.now()
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index)
      if (!key?.startsWith(DELIVERY_PREFIX)) continue
      const deliveredAt = Number(localStorage.getItem(key) ?? 0)
      if (!deliveredAt || at - deliveredAt > ROOM_MESSAGE_TTL_MS + 60_000) localStorage.removeItem(key)
    }
  } catch {
    /* storage is optional; the lock still serializes tabs that support it */
  }
}

function deliveryKey(messageId: string): string {
  return `${DELIVERY_PREFIX}${messageId}`
}

function wasDelivered(messageId: string): boolean {
  try {
    const at = Number(localStorage.getItem(deliveryKey(messageId)) ?? 0)
    return at > 0 && Date.now() - at < ROOM_MESSAGE_TTL_MS + 60_000
  } catch {
    return false
  }
}

function markDelivered(messageId: string): void {
  try {
    localStorage.setItem(deliveryKey(messageId), String(Date.now()))
  } catch {
    /* the in-memory lock is still enough for one page lifetime */
  }
}

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

/** Start presence sharing once the app shell is mounted. Idempotent per tab. */
export function startNotificationTabs(): void {
  if (started) return
  started = true
  // The page may have become visible between module import and this effect.
  selfVisible = document.visibilityState === 'visible'
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      channel = new BroadcastChannel(CHANNEL_NAME)
      channel.addEventListener('message', onChannelMessage as EventListener)
    } catch {
      channel = null
    }
  }
  document.addEventListener('visibilitychange', onVisibilityChange)
  const onPageHide = () => post({ type: 'bye', id: TAB_ID })
  const onPageShow = () => {
    selfVisible = document.visibilityState === 'visible'
    broadcastPresence()
  }
  window.addEventListener('pagehide', onPageHide)
  window.addEventListener('pageshow', onPageShow)
  broadcastPresence()
  pruneDeliveryLedger()
  heartbeat = window.setInterval(() => {
    prunePeers()
    broadcastPresence()
  }, HEARTBEAT_MS)
  // The interval is intentionally page-lifetime; the app has one notifier.
  void heartbeat
}

/** True when this tab or a fresh peer tab is visible. */
export function anyVisibleNotificationTab(): boolean {
  prunePeers()
  if (selfVisible) return true
  return [...peers.values()].some((peer) => peer.visible)
}

/**
 * Give a visible tab a moment to make itself known. A hidden tab must not fire
 * a native notification while another Ink tab is on screen, and a fresh
 * message can arrive during the brief window before presence is exchanged.
 */
export async function waitForVisibleNotificationTab(ms = VISIBLE_SETTLE_MS): Promise<boolean> {
  if (anyVisibleNotificationTab()) return true
  post({ type: 'presence-request' })
  await wait(ms)
  return anyVisibleNotificationTab()
}

/**
 * Claim one message across every Ink tab. The callback runs while the lock is
 * held, so a hidden tab that deferred cannot slip in immediately afterwards.
 * The stored ledger prevents a later poll in another tab from repeating it.
 */
export async function withNotificationClaim(messageId: string, deliver: () => void | Promise<void>): Promise<boolean> {
  if (wasDelivered(messageId)) return false

  if (typeof navigator !== 'undefined' && navigator.locks) {
    let delivered = false
    try {
      await navigator.locks.request(
        `ink:notification:${messageId}`,
        { ifAvailable: true },
        async (lock) => {
          if (!lock || wasDelivered(messageId)) return
          markDelivered(messageId)
          delivered = true
          try {
            await deliver()
          } finally {
            await wait(CLAIM_HOLD_MS)
          }
        },
      )
    } catch {
      return false
    }
    return delivered
  }

  // Older browsers without Web Locks still get the shared ledger. The check
  // and write are not perfectly atomic, but they stop the ordinary two-tab
  // duplicate this coordination is for.
  if (wasDelivered(messageId)) return false
  markDelivered(messageId)
  await deliver()
  return true
}
