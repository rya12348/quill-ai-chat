import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router'

import { ROOM_ID, ROOM_MESSAGE_TTL_MS } from '../../shared/config'
import type { RoomActivity, RoomActivityItem, RoomMessage } from '../../shared/types'
import { api } from '../lib/api'
import { addAttention, clearAttention, setAttentionCount } from '../lib/attention'
import { cx } from '../lib/cx'
import { ensureBrowserNotificationPermission, getNotificationSettings, useNotificationSettings } from '../lib/notifications'
import { startNotificationTabs, waitForVisibleNotificationTab, withNotificationClaim } from '../lib/notification-tabs'

const INCOMING_EVENT = 'ink:room:incoming'
const POLL_INTERVAL_MS = 10_000
const NOTICE_LIFETIME_MS = 7_000

type IncomingDetail = {
  messages: RoomMessage[]
  roomName?: string
}

/** Lets the open room deliver a live message to the app-wide notifier. */
export function announceRoomMessages(messages: RoomMessage[], roomName?: string): void {
  if (!messages.length) return
  window.dispatchEvent(new CustomEvent<IncomingDetail>(INCOMING_EVENT, { detail: { messages, roomName } }))
}

type Notice = {
  messageId: string
  room: string
  roomName: string
  authorName: string
  body: string
  createdAt: number
}

function roomFromLocation(location: { pathname: string; search: string }): string | null {
  if (location.pathname !== '/room') return null
  return new URLSearchParams(location.search).get('room')?.trim() || ROOM_ID
}

function messagePreview(message: RoomMessage): string {
  const body = message.body.replace(/\s+/g, ' ').trim()
  if (body) return body.length > 140 ? `${body.slice(0, 139)}…` : body
  return message.attachments?.length ? 'Sent an attachment' : 'New message'
}

function latestPerRoom(items: { message: RoomMessage; roomName?: string }[]): { message: RoomMessage; roomName?: string }[] {
  const latest = new Map<string, { message: RoomMessage; roomName?: string }>()
  for (const item of items) {
    const current = latest.get(item.message.room)
    if (!current || item.message.createdAt >= current.message.createdAt) latest.set(item.message.room, item)
  }
  return [...latest.values()]
}

export function RoomNotifications() {
  const location = useLocation()
  const settings = useNotificationSettings()
  const [notices, setNotices] = useState<Notice[]>([])
  const seen = useRef(new Set<string>())
  const timers = useRef(new Map<string, number>())
  const locationRef = useRef(location)

  useEffect(() => {
    startNotificationTabs()
  }, [])

  useEffect(() => {
    locationRef.current = location
  }, [location])

  const dismiss = useCallback((messageId: string) => {
    setNotices((current) => current.filter((notice) => notice.messageId !== messageId))
    const timer = timers.current.get(messageId)
    if (timer) window.clearTimeout(timer)
    timers.current.delete(messageId)
  }, [])

  const deliver = useCallback(
    async (messages: RoomMessage[], fallbackRoomName?: string) => {
      const now = Date.now()
      const fresh = messages.filter((message) => {
        if (!message || typeof message.id !== 'string' || !message.room) return false
        if (message.createdAt + ROOM_MESSAGE_TTL_MS <= now) return false
        if (seen.current.has(message.id)) return false
        seen.current.add(message.id)
        window.setTimeout(() => seen.current.delete(message.id), ROOM_MESSAGE_TTL_MS + 60_000)
        return true
      })
      if (!fresh.length) return

      const currentRoom = roomFromLocation(locationRef.current)
      const visible = document.visibilityState === 'visible'
      const preferences = getNotificationSettings()
      // The tab title and app badge are the built-in fallback. Count every
      // room here when website notifications are enabled.
      if (!visible && preferences.inApp) {
        const unreadByRoom = new Map<string, number>()
        for (const message of fresh) {
          unreadByRoom.set(message.room, (unreadByRoom.get(message.room) ?? 0) + 1)
        }
        for (const [room, unread] of unreadByRoom) addAttention(unread, room)
      }

      for (const { message, roomName } of latestPerRoom(
        fresh.map((message) => ({
          message,
          roomName: (message as RoomActivityItem).roomName ?? fallbackRoomName,
        })),
      )) {
        const name = roomName || (message.room === ROOM_ID ? 'General' : 'Chat')
        if (visible) {
          // A visible tab gets the in-app notice only. Do not also fire a
          // browser notification for the same message.
          if (!preferences.inApp) continue
          if (currentRoom === message.room) continue
          const notice: Notice = {
            messageId: message.id,
            room: message.room,
            roomName: name,
            authorName: message.authorName,
            body: messagePreview(message),
            createdAt: message.createdAt,
          }
          // Several visible Ink tabs may all see this message. One wins the
          // shared claim and shows the notice; the rest stay silent.
          await withNotificationClaim(message.id, () => {
            setNotices((current) => [...current.filter((item) => item.room !== notice.room), notice].slice(-3))
            const existing = timers.current.get(notice.messageId)
            if (existing) window.clearTimeout(existing)
            timers.current.set(
              notice.messageId,
              window.setTimeout(() => {
                setNotices((current) => current.filter((item) => item.messageId !== notice.messageId))
                timers.current.delete(notice.messageId)
              }, NOTICE_LIFETIME_MS),
            )
          })
          continue
        }

        // A hidden tab uses the browser notification, if the person enabled it
        // and the browser has granted permission. Defer when any Ink tab is
        // visible so the alert is the in-app notice, not a native one.
        if (!preferences.browser) continue
        if (typeof Notification === 'undefined' || Notification.permission !== 'granted') continue
        if (await waitForVisibleNotificationTab()) continue
        await withNotificationClaim(message.id, () => {
          try {
            const native = new Notification(`New message in ${name}`, {
              body: `${message.authorName}: ${messagePreview(message)}`.slice(0, 180),
              tag: `ink-room-${message.room}`,
              icon: '/icons/icon-192.png',
            })
            native.onclick = () => {
              window.focus()
              native.close()
              window.location.assign(`/room?room=${encodeURIComponent(message.room)}`)
            }
          } catch {
            /* permission and platform support can change at runtime */
          }
        })
      }
    },
    [],
  )

  useEffect(() => {
    const incoming = (event: Event) => {
      const detail = (event as CustomEvent<IncomingDetail>).detail
      if (!detail?.messages?.length) return
      void deliver(detail.messages, detail.roomName)
    }
    window.addEventListener(INCOMING_EVENT, incoming)
    return () => window.removeEventListener(INCOMING_EVENT, incoming)
  }, [deliver])

  useEffect(() => {
    // Settings owns the switch; do not interrupt turning it off with a prompt.
    if (location.pathname === '/settings') return
    return ensureBrowserNotificationPermission()
  }, [location.pathname])

  useEffect(() => {
    if (!settings.inApp) clearAttention()
  }, [settings.inApp])

  useEffect(() => {
    if (!settings.inApp && !settings.browser) return
    let cancelled = false
    let inFlight = false
    // Start at now: old room history is not a new notification.
    let cursor = Date.now()

    const poll = async () => {
      if (cancelled || inFlight) return
      inFlight = true
      try {
        const activity = await api<RoomActivity>(`/rooms/activity?after=${cursor}`)
        if (cancelled) return
        // Keep a small overlap so a message committed just after the snapshot
        // is still picked up. Seen ids make the repeat harmless.
        const last = activity.items.at(-1)
        cursor = Math.max(
          cursor,
          activity.items.length >= 50 && last ? last.createdAt : activity.asOf - 2_000,
        )
        await deliver(activity.items)
      } catch {
        /* a dropped poll recovers on the next interval */
      } finally {
        inFlight = false
      }
    }

    const first = window.setTimeout(() => void poll(), 1_200)
    const interval = window.setInterval(() => void poll(), POLL_INTERVAL_MS)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void poll()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelled = true
      window.clearTimeout(first)
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [deliver, settings.browser, settings.inApp])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') setAttentionCount(0)
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [])

  useEffect(
    () => () => {
      for (const timer of timers.current.values()) window.clearTimeout(timer)
      timers.current.clear()
      clearAttention()
    },
    [],
  )

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed bottom-4 right-4 z-[70] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2"
    >
      <AnimatePresence initial={false}>
        {notices.map((notice) => (
          <motion.div
            key={notice.messageId}
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className={cx(
              'pointer-events-auto relative overflow-hidden rounded-card border border-line bg-surface shadow-pop',
              'before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-accent',
            )}
          >
            <Link
              to={`/room?room=${encodeURIComponent(notice.room)}`}
              onClick={() => dismiss(notice.messageId)}
              className="block py-3 pl-4 pr-10 transition-colors hover:bg-surface-2/70"
            >
              <span className="block text-[12.5px] font-semibold text-accent">New message in {notice.roomName}</span>
              <span className="mt-0.5 block truncate text-[13.5px] font-medium text-fg">{notice.authorName}</span>
              <span className="mt-0.5 line-clamp-2 block text-[13px] leading-relaxed text-muted">{notice.body}</span>
            </Link>
            <button
              type="button"
              onClick={() => dismiss(notice.messageId)}
              aria-label="Dismiss notification"
              className="absolute right-2 top-2 grid size-7 place-items-center rounded-tile text-faint transition-colors hover:bg-surface-2 hover:text-fg"
            >
              <X className="size-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
