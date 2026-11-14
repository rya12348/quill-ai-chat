import { Menu as MenuIcon, Monitor, RefreshCw, Send, Users } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'

import { ROOM_ID, ROOM_MESSAGE_CHARS, ROOM_MESSAGE_TTL_MS, ROOM_NAME } from '../../shared/config'
import type { RoomMessage } from '../../shared/types'
import { useMobileNav } from '../components/Shell'
import { Avatar, Button, Spinner } from '../components/ui'
import { useMe, useRoom, useSendRoomMessage } from '../lib/api'
import { cx } from '../lib/cx'
import { connectRoom, type RoomRealtimeStatus } from '../lib/realtime'

const timeFormatter = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })
const fullTimeFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

function roomMessageIsCurrent(message: RoomMessage, at = Date.now()): boolean {
  return message.createdAt + ROOM_MESSAGE_TTL_MS > at
}

function mergeRoomMessages(current: RoomMessage[], incoming: RoomMessage[]): RoomMessage[] {
  const at = Date.now()
  const byId = new Map(
    current.filter((message) => roomMessageIsCurrent(message, at)).map((message) => [message.id, message]),
  )
  for (const message of incoming) {
    if (roomMessageIsCurrent(message, at)) byId.set(message.id, message)
  }
  return [...byId.values()]
    .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
    .slice(-80)
}

function isRoomMessage(value: unknown): value is RoomMessage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const message = value as Partial<RoomMessage>
  return (
    message.room === ROOM_ID &&
    typeof message.id === 'string' &&
    typeof message.body === 'string' &&
    typeof message.authorName === 'string' &&
    typeof message.authorId === 'string' &&
    Number.isFinite(message.createdAt)
  )
}

function connectionText(status: RoomRealtimeStatus, online: number | null, liveReady: boolean): string {
  if (status === 'connected') {
    return online === null ? 'Connected' : `${online} ${online === 1 ? 'person' : 'people'} here`
  }
  if (status === 'connecting') return liveReady ? 'Reconnecting…' : 'Connecting to live chat…'
  if (status === 'unauthorized') return 'Session ended'
  if (status === 'closed') return 'Offline'
  // Local previews and installations without the realtime binding can still
  // read and send through the HTTP room API. Do not imply an endless retry.
  return liveReady ? 'Reconnecting…' : 'Live updates unavailable — refresh to check messages'
}

export function Room() {
  const openMenu = useMobileNav()
  const { data: me } = useMe()
  const roomQuery = useRoom()
  const send = useSendRoomMessage()
  const [messages, setMessages] = useState<RoomMessage[]>([])
  const [viewerId, setViewerId] = useState('')
  const [status, setStatus] = useState<RoomRealtimeStatus>('connecting')
  const [liveReady, setLiveReady] = useState(false)
  const [online, setOnline] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const atBottom = useRef(true)

  const append = useCallback((incoming: RoomMessage[]) => {
    setMessages((current) => mergeRoomMessages(current, incoming))
  }, [])

  // A fetch after every ready event reconciles anything broadcast while the
  // socket was down. Merging by id keeps a slower snapshot from removing a
  // message that already arrived live.
  useEffect(() => {
    if (!roomQuery.data) return
    setMessages((current) => mergeRoomMessages(current, roomQuery.data.messages))
    setViewerId(roomQuery.data.viewerId)
  }, [roomQuery.data])

  const refetchRoom = roomQuery.refetch
  useEffect(() => {
    if (!viewerId) return
    const connection = connectRoom({
      room: ROOM_ID,
      onStatus: (next) => {
        if (next !== 'closed') setStatus(next)
      },
      onEvent: (event) => {
        if (event.type === 'ready') {
          setLiveReady(true)
          void refetchRoom()
          return
        }
        if (event.type === 'presence') {
          setOnline(event.members.length)
          return
        }
        if (event.type === 'broadcast' && event.event === 'room_message' && isRoomMessage(event.data)) {
          append([event.data])
        }
      },
    })
    return () => connection.close()
  }, [append, refetchRoom, viewerId])

  // Drop a message exactly when its retention window closes, even if no
  // snapshot or broadcast happens to arrive at that moment.
  useEffect(() => {
    if (!messages.length) return
    const at = Date.now()
    const nextExpiry = Math.min(...messages.map((message) => message.createdAt + ROOM_MESSAGE_TTL_MS))
    const timer = window.setTimeout(() => {
      setMessages((current) => current.filter((message) => roomMessageIsCurrent(message)))
      // Also hit the snapshot route once the window closes so its purge runs
      // while the room is open, not only on the next periodic refresh.
      void refetchRoom()
    }, Math.max(0, nextExpiry - at) + 25)
    return () => window.clearTimeout(timer)
  }, [messages, refetchRoom])

  // Keep the newest message in view unless the reader has scrolled up.
  useEffect(() => {
    const element = scroller.current
    if (!element || !atBottom.current) return
    element.scrollTop = element.scrollHeight
  }, [messages.length])

  const onScroll = () => {
    const element = scroller.current
    if (!element) return
    atBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 72
  }

  const sendMessage = async () => {
    const body = draft.trim()
    if (!body || send.isPending) return
    setError(null)
    setNotice(null)
    atBottom.current = true
    try {
      const result = await send.mutateAsync(body)
      append([result.message])
      setDraft('')
      if (!result.live) {
        setNotice('Saved. Live delivery is delayed, so others may see it after a refresh.')
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not send that message.')
    }
  }

  const queryError =
    roomQuery.error instanceof Error
      ? roomQuery.error.message
      : roomQuery.error
        ? 'Could not open the room.'
        : null
  // Keep a room that has already loaded usable if a later refresh or poll
  // fails. Only a first load with no snapshot should take over the page.
  const blockingError = Boolean(queryError && !roomQuery.data)
  const refreshError = Boolean(queryError && roomQuery.data)
  const statusDot =
    status === 'connected'
      ? 'bg-success'
      : status === 'connecting'
        ? 'bg-warning'
        : status === 'unauthorized'
          ? 'bg-danger'
          : 'bg-faint'

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-12 shrink-0 items-center px-3 md:h-14 md:px-5">
        <div className="mx-auto flex w-full max-w-[760px] items-center gap-2">
          <button
            type="button"
            aria-label="Open menu"
            onClick={openMenu}
            className="-ml-2 grid size-9 shrink-0 place-items-center rounded-tile text-muted transition-colors hover:bg-surface-2 hover:text-fg md:hidden"
          >
            <MenuIcon className="size-5" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <h1 className="truncate font-display text-[20px] font-semibold tracking-[-0.02em]">{ROOM_NAME}</h1>
              <span className="inline-flex h-5 shrink-0 items-center rounded-full bg-surface-2 px-2 text-[11.5px] font-medium text-muted">
                Public
              </span>
            </div>
                          <p className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-faint" role="status" aria-live="polite">
              <span className={cx('round size-1.5 shrink-0 rounded-full', statusDot)} />
              {connectionText(status, online, liveReady)}
            </p>
          </div>
          {status !== 'connected' && (
            <button
              type="button"
              onClick={() => void roomQuery.refetch()}
              aria-label="Refresh messages"
              title="Refresh messages"
              className="grid size-8 shrink-0 place-items-center rounded-tile text-faint transition-colors hover:bg-surface-2 hover:text-fg"
            >
              <RefreshCw className="size-3.5" />
            </button>
          )}
          <Link
            to="/browser"
            aria-label="Open browser"
            title="Browser"
            className="grid size-9 shrink-0 place-items-center rounded-tile text-muted transition-colors hover:bg-surface-2 hover:text-fg md:hidden"
          >
            <Monitor className="size-5" />
          </Link>
        </div>
      </header>

      <div ref={scroller} onScroll={onScroll} className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full w-full max-w-[760px] flex-col px-4 pb-6 pt-2 md:px-6">
          <div className="flex items-start gap-3 rounded-card border border-line bg-surface px-4 py-3.5 shadow-[0_1px_1px_rgb(27_26_23/0.03)]">
            <span className="grid size-8 shrink-0 place-items-center rounded-tile bg-accent-soft text-accent">
              <Users className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[14px] font-medium">Public chat</p>
              <p className="mt-0.5 text-[13.5px] leading-relaxed text-muted">
                Messages are visible to everyone using Ink. Don’t share anything private.
              </p>
            </div>
          </div>

          {roomQuery.isLoading && !roomQuery.data ? (
            <div className="grid flex-1 place-items-center py-12">
              <Spinner />
            </div>
          ) : blockingError ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6 py-14 text-center">
              <p className="text-[15px] font-medium">The chat could not be opened.</p>
              <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-muted">{queryError}</p>
              <Button size="sm" className="mt-3" onClick={() => void roomQuery.refetch()}>
                Try again
              </Button>
            </div>
          ) : messages.length === 0 && !refreshError ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6 py-14 text-center">
              <span className="grid size-11 place-items-center rounded-full bg-surface-2 text-muted">
                <Users className="size-5" />
              </span>
              <p className="mt-3 text-[14px] font-medium">The chat is quiet.</p>
              <p className="mt-1 max-w-xs text-[13px] leading-relaxed text-muted">
                No messages yet. Say hello, or share what you’re working on.
              </p>
            </div>
          ) : (
            <>
              {refreshError ? (
                <div
                  role="status"
                  className="mt-4 flex items-center justify-between gap-3 rounded-control bg-warning-soft px-3 py-2 text-[12.5px] leading-relaxed text-warning"
                >
                  <span>The room could not refresh. Existing messages are still shown.</span>
                  <button
                    type="button"
                    onClick={() => void roomQuery.refetch()}
                    className="shrink-0 font-medium underline underline-offset-2"
                  >
                    Retry
                  </button>
                </div>
              ) : null}
              <div className="mt-5 space-y-4" role="log" aria-live="polite" aria-relevant="additions">
              {messages.map((message) => {
                const mine = message.authorId === viewerId
                const author = mine ? 'You' : message.authorName
                return (
                  <article key={message.id} className={cx('flex items-start gap-2.5', mine && 'flex-row-reverse')}>
                    <Avatar
                      name={mine ? me?.user.name ?? 'You' : message.authorName}
                      src={mine ? me?.user.picture : undefined}
                      size={28}
                    />
                    <div className={cx('min-w-0 max-w-[82%]', mine && 'text-right')}>
                      <div className={cx('mb-1 flex items-center gap-2 text-[11px] text-faint', mine && 'justify-end')}>
                        <span className="font-medium text-muted">{author}</span>
                        <time
                          dateTime={new Date(message.createdAt).toISOString()}
                          title={fullTimeFormatter.format(message.createdAt)}
                        >
                          {timeFormatter.format(message.createdAt)}
                        </time>
                      </div>
                      <p
                        className={cx(
                          'whitespace-pre-wrap break-words rounded-bubble px-4 py-3 text-left text-[14.5px] leading-relaxed',
                          mine ? 'bg-accent text-bg shadow-[0_3px_12px_-5px_rgb(168_73_20/0.55)]' : 'border border-line bg-surface text-fg',
                        )}
                      >
                        {message.body}
                      </p>
                    </div>
                  </article>
                )
              })}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mx-auto w-full max-w-[760px] px-4 pb-4 md:px-6 md:pb-6">
        {notice ? (
          <p role="status" className="mb-2 rounded-control bg-warning-soft px-3 py-2 text-[12.5px] leading-relaxed text-warning">
            {notice}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="mb-2 rounded-control bg-danger-soft px-3 py-2 text-[12.5px] leading-relaxed text-danger">
            {error}
          </p>
        ) : null}
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void sendMessage()
          }}
          className="rounded-card border border-line bg-surface p-2 shadow-composer"
        >
          <label htmlFor="room-message" className="sr-only">
            Message the public chat
          </label>
          <textarea
            id="room-message"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault()
                void sendMessage()
              }
            }}
            maxLength={ROOM_MESSAGE_CHARS}
            rows={2}
            placeholder="Message the room…"
            className="max-h-40 min-h-11 w-full resize-none bg-transparent px-2.5 py-1.5 text-[14.5px] leading-relaxed text-fg outline-none placeholder:text-faint"
          />
          <div className="flex items-center justify-between gap-2 px-1 pb-0.5">
            <span className="text-[11px] text-faint">
              {draft.length > ROOM_MESSAGE_CHARS - 80
                ? `${draft.length}/${ROOM_MESSAGE_CHARS}`
                : 'Enter to send · Shift+Enter for a new line'}
            </span>
            <Button type="submit" variant="primary" size="sm" disabled={!draft.trim()} loading={send.isPending}>
              <Send className="size-3.5" />
              Send
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
