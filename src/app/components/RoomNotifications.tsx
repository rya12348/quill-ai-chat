import { useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router'

import { ROOM_ID, ROOM_MESSAGE_TTL_MS } from '../../shared/config'
import type { RoomActivity, RoomActivityItem, RoomInvite, RoomInvites, RoomMessage } from '../../shared/types'
import { api } from '../lib/api'
import { addAttention, clearAttention, setAttentionCount, setInviteAttention } from '../lib/attention'
import { cx } from '../lib/cx'
import { ensureBrowserNotificationPermission, getNotificationSettings, useNotificationSettings } from '../lib/notifications'
import { startNotificationTabs, waitForVisibleNotificationTab, withNotificationClaim } from '../lib/notification-tabs'

const INCOMING_EVENT = 'ink:room:incoming'
const POLL_INTERVAL_MS = 10_000

/** Routes that fill the window, where a room notice has nowhere to appear. */
const BROWSING_ROUTES = new Set(['/browser/live', '/math', '/proxy'])
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
  kind?: 'message' | 'invite'
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
  const client = useQueryClient()
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
      const fresh = messages.filter((message) => {
        if (!message || typeof message.id !== 'string' || !message.room) return false
        // The server already applies the room retention cutoff. Do not compare
        // against the browser clock here: a clock ahead of the server would
        // otherwise discard every valid message as expired.
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

  const deliverInvites = useCallback(async (invites: RoomInvite[]) => {
    if (!invites.length) return
    const visible = document.visibilityState === 'visible'
    const preferences = getNotificationSettings()
    const shown: string[] = []
    for (const invite of invites) {
      const key = `invite:${invite.roomId}:${invite.invitedAt}`
      if (seen.current.has(key)) continue
      if (visible) {
        if (!preferences.inApp) continue
        const notice: Notice = {
          messageId: key,
          kind: 'invite',
          room: invite.roomId,
          roomName: invite.roomName,
          authorName: invite.inviterName,
          body: 'Open the room to join.',
          createdAt: invite.invitedAt,
        }
        await withNotificationClaim(key, () => {
          seen.current.add(key)
          window.setTimeout(() => seen.current.delete(key), 5 * 60_000)
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
        shown.push(invite.roomId)
        continue
      }

      if (!preferences.browser) continue
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') continue
      if (await waitForVisibleNotificationTab()) continue
      await withNotificationClaim(key, () => {
        seen.current.add(key)
        window.setTimeout(() => seen.current.delete(key), 5 * 60_000)
        try {
          const native = new Notification(`Invited to ${invite.roomName}`, {
            body: `${invite.inviterName} invited you to a private room.`,
            tag: `ink-invite-${invite.roomId}`,
            icon: '/icons/icon-192.png',
          })
          native.onclick = () => {
            window.focus()
            native.close()
            window.location.assign(`/room?room=${encodeURIComponent(invite.roomId)}`)
          }
        } catch {
          /* permission and platform support can change at runtime */
        }
      })
      shown.push(invite.roomId)
    }
    if (shown.length) {
      await api('/rooms/invites/seen', { method: 'POST', json: { roomIds: shown } }).catch(() => undefined)
    }
  }, [])

  useEffect(() => {
    if (BROWSING_ROUTES.has(location.pathname)) return
    let cancelled = false
    let inFlight = false
    const poll = async () => {
      if (cancelled || inFlight) return
      inFlight = true
      try {
        const invites = await api<RoomInvites>('/rooms/invites')
        if (cancelled) return
        // The title and app badge are the fallback that works with browser
        // notifications blocked. Count only while the tab is hidden; once the
        // person returns, the in-app notice or room list takes over.
        const hidden = document.visibilityState !== 'visible'
        const preferences = getNotificationSettings()
        setInviteAttention(hidden && preferences.inApp ? invites.items.map((invite) => invite.roomId) : [])
        if (!invites.items.length) return
        void client.invalidateQueries({ queryKey: ['rooms'] })
        await deliverInvites(invites.items)
      } catch {
        /* a dropped poll recovers on the next interval */
      } finally {
        inFlight = false
      }
    }
    const first = window.setTimeout(() => void poll(), 1_800)
    const interval = window.setInterval(() => void poll(), 15_000)
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
  }, [client, deliverInvites, location.pathname])

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
    // The browser owns the whole window, so a notice could not be seen there.
    // Polling anyway spends requests and bandwidth while a game streams.
    if (BROWSING_ROUTES.has(location.pathname)) return
    let cancelled = false
    let inFlight = false
    // The browser clock may be ahead of or behind the Worker. Leave the cursor
    // unset until the first response establishes it from the server's asOf.
    let cursor: number | null = null
    let baseline = false

    const poll = async () => {
      if (cancelled || inFlight) return
      inFlight = true
      try {
        const activity = await api<RoomActivity>(`/rooms/activity?after=${cursor ?? Date.now()}`)
        if (cancelled) return
        if (!baseline) {
          // This response is only a clock baseline. Ignore its items so old
          // room history is not replayed, then continue from server time.
          baseline = true
          cursor = activity.asOf
          return
        }
        const last = activity.items.at(-1)
        // If the server returned a full page, continue from its newest message;
        // otherwise use the server timestamp for the next poll.
        cursor = activity.items.length >= 50 && last ? last.createdAt : activity.asOf
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
  }, [deliver, settings.browser, settings.inApp, location.pathname])

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
              <span className="block text-[12.5px] font-semibold text-accent">
                {notice.kind === 'invite' ? `Invited to ${notice.roomName}` : `New message in ${notice.roomName}`}
              </span>
              <span className="mt-0.5 block truncate text-[13.5px] font-medium text-fg">
                {notice.kind === 'invite' ? `${notice.authorName} invited you` : notice.authorName}
              </span>
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
