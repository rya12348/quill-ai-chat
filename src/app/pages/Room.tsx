import { FileText, Globe2, Link2, Lock, Menu as MenuIcon, Monitor, Paperclip, Plus, Send, Users, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'

import {
  ROOM_ID,
  MAX_ATTACHMENTS,
  MAX_ATTACHMENT_TOTAL_BYTES,
  ROOM_MESSAGE_CHARS,
  ROOM_MESSAGE_TTL_MS,
  ROOM_NAME,
  ROOM_NAME_CHARS,
  ROOM_PASSWORD_MAX_CHARS,
  ROOM_PASSWORD_MIN_CHARS,
} from '../../shared/config'
import type { MessageAttachment, RoomMessage, RoomSummary, RoomVisibility } from '../../shared/types'
import { announceRoomMessages } from '../components/RoomNotifications'
import { useMobileNav } from '../components/Shell'
import { Avatar, Button, Dialog, Input, Spinner, useToast } from '../components/ui'
import {
  ApiError,
  useCreateRoom,
  useMe,
  useRoom,
  useRooms,
  useSendRoomMessage,
  useUnlockRoom,
} from '../lib/api'
import { clearAttention } from '../lib/attention'
import { cx } from '../lib/cx'
import {
  ATTACHMENT_ACCEPT,
  AttachmentError,
  clipboardFiles,
  formatFileSize,
  readAttachment,
  type PendingAttachment,
} from '../lib/attachments'
import { connectRoom, type RoomRealtimeStatus } from '../lib/realtime'

const timeFormatter = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })
const fullTimeFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

function roomMessageIsCurrent(message: RoomMessage, at = Date.now()): boolean {
  return message.createdAt + ROOM_MESSAGE_TTL_MS > at
}

function mergeRoomMessages(current: RoomMessage[], incoming: RoomMessage[], roomId: string): RoomMessage[] {
  const at = Date.now()
  const byId = new Map(
    current
      .filter((message) => message.room === roomId && roomMessageIsCurrent(message, at))
      .map((message) => [message.id, message]),
  )
  for (const message of incoming) {
    if (message.room === roomId && roomMessageIsCurrent(message, at)) byId.set(message.id, message)
  }
  return [...byId.values()]
    .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
    .slice(-80)
}

function isRoomMessage(value: unknown, roomId: string): value is RoomMessage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const message = value as Partial<RoomMessage>
  return (
    message.room === roomId &&
    typeof message.id === 'string' &&
    typeof message.body === 'string' &&
    typeof message.authorName === 'string' &&
    typeof message.authorId === 'string' &&
    Number.isFinite(message.createdAt)
  )
}

function roomLinkUrl(raw: string): string | null {
  const value = raw.trim()
  if (!value || /\s/.test(value)) return null
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `https://${value}`)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    if (!url.hostname.includes('.') && url.hostname !== 'localhost') return null
    return url.toString()
  } catch {
    return null
  }
}

function roomAttachmentPreview(attachments: PendingAttachment[]): MessageAttachment[] {
  return attachments.map((attachment) => ({
    id: attachment.id,
    name: attachment.name,
    mime: attachment.mime,
    size: attachment.size,
    kind: attachment.kind,
    ...(attachment.kind === 'image' || attachment.mime === 'text/uri-list' ? { url: attachment.data } : {}),
  }))
}

export function Room() {
  const openMenu = useMobileNav()
  const { data: me } = useMe()
  const roomsQuery = useRooms()
  const [params, setParams] = useSearchParams()
  const defaultRoomId = roomsQuery.data?.defaultRoomId ?? ROOM_ID
  const selectedId = params.get('room')?.trim() || defaultRoomId
  const activeRoom = roomsQuery.data?.items.find((room) => room.id === selectedId)
  const [status, setStatus] = useState<RoomRealtimeStatus>('connecting')
  const roomQuery = useRoom(selectedId, status === 'connected' ? 60_000 : 8_000)
  const selectedName = roomQuery.data?.name ?? activeRoom?.name ?? (selectedId === ROOM_ID ? ROOM_NAME : 'Room')
  const send = useSendRoomMessage(selectedId)
  const [messages, setMessages] = useState<RoomMessage[]>([])
  const [viewerId, setViewerId] = useState('')
  const [viewerRoom, setViewerRoom] = useState('')
  const [draft, setDraft] = useState('')
  const [attachments, setAttachments] = useState<PendingAttachment[]>([])
  const [attachmentError, setAttachmentError] = useState('')
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkDraft, setLinkDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [unlockTarget, setUnlockTarget] = useState<RoomSummary | null>(null)
  const toast = useToast()
  const scroller = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const atBottom = useRef(true)
  const activeRoomRef = useRef(selectedId)
  const sendingRef = useRef(false)
  const seenMessagesRef = useRef<Set<string>>(new Set())
  const initialSnapshotRef = useRef(true)

  const selectRoom = useCallback(
    (roomId: string) => {
      setParams((current) => {
        const next = new URLSearchParams(current)
        next.set('room', roomId)
        return next
      })
    },
    [setParams],
  )

  const appendForRoom = useCallback((roomId: string, incoming: RoomMessage[]) => {
    if (activeRoomRef.current !== roomId) return
    setMessages((current) => mergeRoomMessages(current, incoming, roomId))
  }, [])

  const noteIncoming = useCallback(
    (incoming: RoomMessage[], ownId: string, roomName: string) => {
      const fresh = incoming.filter((message) => message.authorId !== ownId && roomMessageIsCurrent(message))
      if (!fresh.length) return
      // The app-wide notifier chooses exactly one channel: the built-in notice
      // while the site is visible, or a browser notification while it is not.
      announceRoomMessages(fresh, roomName)
    },
    [],
  )

  // A room switch starts from a clean view; otherwise a slow response from the
  // previous room could land in the new one.
  useEffect(() => {
    activeRoomRef.current = selectedId
    setMessages([])
    setViewerId('')
    setViewerRoom('')
    setStatus('connecting')
    setDraft('')
    setAttachments([])
    setAttachmentError('')
    setLinkOpen(false)
    setLinkDraft('')
    setError(null)
    seenMessagesRef.current = new Set()
    initialSnapshotRef.current = true
    // Opening a room reads its messages without wiping unread rooms elsewhere.
    clearAttention(selectedId)
  }, [selectedId])

  // A fetch after every ready event reconciles anything broadcast while the
  // socket was down. Merging by id keeps a slower snapshot from removing a
  // message that already arrived live.
  useEffect(() => {
    const data = roomQuery.data
    if (!data || activeRoomRef.current !== data.room) return
    setMessages((current) => mergeRoomMessages(current, data.messages, data.room))
    setViewerId(data.viewerId)
    setViewerRoom(data.room)
    const previouslySeen = seenMessagesRef.current
    const unseen = data.messages.filter((message) => !previouslySeen.has(message.id))
    for (const message of data.messages) previouslySeen.add(message.id)
    if (initialSnapshotRef.current) {
      initialSnapshotRef.current = false
      return
    }
    noteIncoming(unseen, data.viewerId, data.name)
  }, [noteIncoming, roomQuery.data])

  // If a room link points at a room that disappeared, fall back to General.
  useEffect(() => {
    if (!roomsQuery.data) return
    if (roomsQuery.data.items.some((room) => room.id === selectedId)) return
    selectRoom(roomsQuery.data.defaultRoomId)
  }, [roomsQuery.data, selectedId, selectRoom])

  const refetchRoom = roomQuery.refetch
  useEffect(() => {
    if (!viewerId || viewerRoom !== selectedId) return
    const connection = connectRoom({
      room: selectedId,
      onStatus: (next) => {
        if (next !== 'closed') setStatus(next)
      },
      onEvent: (event) => {
        if (event.type === 'ready') {
          void refetchRoom()
          return
        }
        if (event.type === 'presence') return
        if (event.type === 'broadcast' && event.event === 'room_message' && isRoomMessage(event.data, selectedId)) {
          if (!seenMessagesRef.current.has(event.data.id)) {
            seenMessagesRef.current.add(event.data.id)
            noteIncoming([event.data], viewerId, selectedName)
          }
          appendForRoom(selectedId, [event.data])
        }
      },
    })
    return () => connection.close()
  }, [appendForRoom, noteIncoming, refetchRoom, selectedId, selectedName, viewerId, viewerRoom])

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

  // Returning to the tab should reconcile the room immediately. The global
  // notifier owns the unread count across every room.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void refetchRoom()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onVisibility)
    }
  }, [refetchRoom])

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

  const addRoomFiles = (files: File[]) => {
    if (!files.length) return
    const slots = MAX_ATTACHMENTS - attachments.length
    if (slots <= 0) {
      toast(`You can attach up to ${MAX_ATTACHMENTS} items.`, 'danger')
      return
    }
    if (files.length > slots) toast(`Only ${slots} more ${slots === 1 ? 'item fits' : 'items fit'}.`)
    void (async () => {
      const next = [...attachments]
      let failure: string | null = null
      let notice: string | null = null
      for (const file of files.slice(0, slots)) {
        try {
          const attachment = await readAttachment(file)
          if (attachment.notice) notice ??= attachment.notice
          const total = next.reduce((sum, item) => sum + item.size, 0) + attachment.size
          if (total > MAX_ATTACHMENT_TOTAL_BYTES) {
            failure = 'Those attachments are too large together. Try fewer or smaller files.'
            break
          }
          next.push(attachment)
        } catch (error) {
          failure = error instanceof AttachmentError ? error.message : 'Could not read that file.'
          break
        }
      }
      if (next.length > attachments.length) setAttachments(next)
      setAttachmentError(failure ?? '')
      if (failure) toast(failure, 'danger')
      else if (notice) toast(notice)
    })()
  }

  const addRoomLink = () => {
    const url = roomLinkUrl(linkDraft)
    if (!url) {
      setAttachmentError('Enter a web address without spaces, such as example.com/article.')
      return
    }
    if (attachments.length >= MAX_ATTACHMENTS) {
      setAttachmentError(`Attach up to ${MAX_ATTACHMENTS} items.`)
      return
    }
    let host = url
    try {
      host = new URL(url).hostname.replace(/^www\./i, '') || 'link'
    } catch {
      /* roomLinkUrl already checked the address */
    }
    setAttachments((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        name: host,
        mime: 'text/uri-list',
        size: new TextEncoder().encode(url).byteLength,
        kind: 'text',
        data: url,
      },
    ])
    setAttachmentError('')
    setLinkDraft('')
    setLinkOpen(false)
  }

  const sendMessage = async () => {
    const body = draft.trim()
    if ((!body && !attachments.length) || sendingRef.current) return
    const outgoing = attachments
    sendingRef.current = true
    const roomId = selectedId
    const optimisticId = `pending:${crypto.randomUUID()}`
    const optimistic: RoomMessage = {
      id: optimisticId,
      room: roomId,
      body,
      ...(outgoing.length ? { attachments: roomAttachmentPreview(outgoing) } : {}),
      authorName: me?.user.name ?? 'You',
      authorId: viewerId || 'pending-self',
      createdAt: Date.now(),
    }
    setError(null)
    setDraft('')
    setAttachments([])
    setAttachmentError('')
    atBottom.current = true
    appendForRoom(roomId, [optimistic])
    try {
      const result = await send.mutateAsync({ body, attachments: outgoing })
      if (activeRoomRef.current === result.message.room) {
        setMessages((current) =>
          mergeRoomMessages(current.filter((message) => message.id !== optimisticId), [result.message], result.message.room),
        )
      }
    } catch (failure) {
      if (activeRoomRef.current === roomId) {
        setMessages((current) => current.filter((message) => message.id !== optimisticId))
        setDraft((current) => (current.trim() ? current : body))
        setAttachments((current) => (current.length ? current : outgoing))
        setError(failure instanceof Error ? failure.message : 'Could not send that message.')
      }
    } finally {
      sendingRef.current = false
    }
  }

  const selectedVisibility: RoomVisibility =
    roomQuery.data?.visibility ?? activeRoom?.visibility ?? 'public'
  const isGeneral = selectedId === ROOM_ID
  const locked = roomQuery.error instanceof ApiError && roomQuery.error.status === 403
  const queryError =
    roomQuery.error instanceof Error
      ? roomQuery.error.message
      : roomQuery.error
        ? 'Could not open the room.'
        : null
  // Keep a room that has already loaded usable if a later refresh or poll
  // fails. Only a first load with no snapshot should take over the page.
  const blockingError = Boolean(queryError && !roomQuery.data && !locked)
  const refreshError = Boolean(queryError && roomQuery.data)
  const privateRooms = roomsQuery.data?.items.filter((room) => room.visibility === 'private') ?? []
  const publicRooms = roomsQuery.data?.items.filter((room) => room.visibility === 'public') ?? []

  const chooseRoom = (room: RoomSummary) => {
    if (room.visibility === 'private' && !room.unlocked) {
      setUnlockTarget(room)
      return
    }
    selectRoom(room.id)
  }

  const unlockCurrentRoom = () => {
    setUnlockTarget(
      activeRoom ?? {
        id: selectedId,
        name: selectedName,
        visibility: selectedVisibility,
        createdAt: 0,
        createdByMe: Boolean(roomQuery.data?.createdByMe),
        unlocked: false,
      },
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-12 shrink-0 items-center px-3 md:h-14 md:px-5">
        <div className="mx-auto flex w-full max-w-[1120px] items-center gap-2">
          <button
            type="button"
            aria-label="Open menu"
            onClick={openMenu}
            className="-ml-2 grid size-9 shrink-0 place-items-center rounded-tile text-muted transition-colors hover:bg-surface-2 hover:text-fg md:hidden"
          >
            <MenuIcon className="size-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-[20px] font-semibold tracking-[-0.02em]">Chat</h1>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setCreateOpen(true)}
            className="shrink-0"
            aria-label="Create a room"
          >
            <Plus />
            <span className="hidden sm:inline">New room</span>
          </Button>
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

      <div className="mx-auto flex min-h-0 w-full max-w-[1120px] flex-1 flex-col md:flex-row">
        <aside className="shrink-0 border-b border-line md:w-[248px] md:border-b-0 md:border-r">
          <div className="flex items-center justify-between px-4 pb-2 pt-2 md:px-3 md:pt-3">
            <h2 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">Rooms</h2>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setCreateOpen(true)}
              aria-label="Create a room"
              title="Create a room"
            >
              <Plus />
            </Button>
          </div>
          <div className="scrollbar-thin flex gap-3 overflow-x-auto px-4 pb-3 md:block md:max-h-[calc(100vh-260px)] md:overflow-y-auto md:px-3 md:pb-4">
            {roomsQuery.isLoading ? (
              <div className="flex items-center gap-2 px-1 py-3 text-[12.5px] text-faint">
                <Spinner className="size-3.5" />
                Loading rooms…
              </div>
            ) : roomsQuery.isError ? (
              <button
                type="button"
                onClick={() => void roomsQuery.refetch()}
                className="rounded-control bg-warning-soft px-2.5 py-2 text-left text-[12px] leading-relaxed text-warning"
              >
                Rooms could not refresh. Tap to retry.
              </button>
            ) : null}
            <RoomGroup label="Private" empty="No private rooms yet" rooms={privateRooms} selectedId={selectedId} onSelect={chooseRoom} />
            <RoomGroup label="Public" empty="No public rooms yet" rooms={publicRooms} selectedId={selectedId} onSelect={chooseRoom} />
          </div>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex h-11 shrink-0 items-center gap-2 border-b border-line px-4 md:px-6">
            <h2 className="min-w-0 truncate text-[14px] font-semibold">{selectedName}</h2>
          </div>

          <div ref={scroller} onScroll={onScroll} className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto flex min-h-full w-full max-w-[760px] flex-col px-4 pb-6 pt-3 md:px-6">
              <div className="flex items-start gap-3 rounded-card border border-line bg-surface px-4 py-3.5 shadow-[0_1px_1px_rgb(27_26_23/0.03)]">
                <span className="grid size-8 shrink-0 place-items-center rounded-tile bg-accent-soft text-accent">
                  {selectedVisibility === 'private' ? <Lock className="size-4" /> : <Users className="size-4" />}
                </span>
                <div className="min-w-0">
                  <p className="text-[14px] font-medium">
                    {isGeneral ? 'General' : selectedVisibility === 'private' ? 'Private room' : 'Public room'}
                  </p>
                  <p className="mt-0.5 text-[13.5px] leading-relaxed text-muted">
                    {selectedVisibility === 'private'
                      ? 'Only people who know the password can read and send messages here.'
                      : isGeneral
                        ? 'A place for everyone using Ink to say hello or share what they’re working on.'
                        : 'Messages are visible to everyone using Ink. Don’t share anything private.'}
                  </p>
                </div>
              </div>

              {roomQuery.isLoading && !roomQuery.data ? (
                <div className="grid flex-1 place-items-center py-12">
                  <Spinner />
                </div>
              ) : locked ? (
                <div className="flex flex-1 flex-col items-center justify-center px-6 py-14 text-center">
                  <span className="grid size-11 place-items-center rounded-full bg-warning-soft text-warning">
                    <Lock className="size-5" />
                  </span>
                  <p className="mt-3 text-[14px] font-medium">This room is private.</p>
                  <p className="mt-1 max-w-xs text-[13px] leading-relaxed text-muted">
                    Enter the password the room’s creator set to read and send messages.
                  </p>
                  <Button size="sm" className="mt-3" onClick={unlockCurrentRoom}>
                    Enter password
                  </Button>
                </div>
              ) : blockingError ? (
                <div className="flex flex-1 flex-col items-center justify-center px-6 py-14 text-center">
                  <p className="text-[15px] font-medium">The room could not be opened.</p>
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
                  <p className="mt-3 text-[14px] font-medium">This room is quiet.</p>
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
                      const pending = message.id.startsWith('pending:')
                      const mine = pending || message.authorId === viewerId
                      const author = mine ? 'You' : message.authorName
                      return (
                        <article key={message.id} className={cx('flex items-start gap-2.5', mine && 'flex-row-reverse', pending && 'opacity-70')}>
                          <Avatar
                            name={mine ? me?.user.name ?? 'You' : message.authorName}
                            src={mine ? me?.user.picture : undefined}
                            size={28}
                          />
                          <div className={cx('min-w-0 max-w-[82%]', mine && 'text-right')}>
                            <div className={cx('mb-1 flex items-center gap-2 text-[11px] text-faint', mine && 'justify-end')}>
                              <span className="font-medium text-muted">{author}</span>
                              {pending ? (
                                <span>Sending…</span>
                              ) : (
                                <time
                                  dateTime={new Date(message.createdAt).toISOString()}
                                  title={fullTimeFormatter.format(message.createdAt)}
                                >
                                  {timeFormatter.format(message.createdAt)}
                                </time>
                              )}
                            </div>
                            <div
                              className={cx(
                                'rounded-bubble px-4 py-3 text-left text-[14.5px] leading-relaxed',
                                mine
                                  ? 'bg-accent text-bg shadow-[0_3px_12px_-5px_rgb(168_73_20/0.55)]'
                                  : 'border border-line bg-surface text-fg',
                              )}
                            >
                              {message.body ? (
                                <p className="whitespace-pre-wrap break-words">{message.body}</p>
                              ) : null}
                              {message.attachments?.length ? (
                                <div className={cx('flex flex-col gap-2', message.body && 'mt-2')}>
                                  {message.attachments.map((attachment) => {
                                    if (attachment.kind === 'image' && attachment.url) {
                                      return (
                                        <a
                                          key={attachment.id}
                                          href={attachment.url}
                                          target="_blank"
                                          rel="noreferrer"
                                          title={attachment.name}
                                          className="block overflow-hidden rounded-[10px] border border-black/10 bg-surface-2"
                                        >
                                          <img
                                            src={attachment.url}
                                            alt={attachment.name}
                                            className="max-h-72 w-auto max-w-full object-contain"
                                          />
                                        </a>
                                      )
                                    }
                                    const isLink = attachment.mime === 'text/uri-list'
                                    const chip = (
                                      <>
                                        {isLink ? <Link2 className="size-3.5 shrink-0" /> : <FileText className="size-3.5 shrink-0" />}
                                        <span className="truncate">{attachment.name}</span>
                                        {isLink ? null : (
                                          <span className="shrink-0 text-faint">{formatFileSize(attachment.size)}</span>
                                        )}
                                      </>
                                    )
                                    return attachment.url ? (
                                      <a
                                        key={attachment.id}
                                        href={attachment.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        title={attachment.name}
                                        className="inline-flex max-w-full items-center gap-1.5 self-start rounded-full border border-line bg-surface px-2.5 py-1 text-[12px] text-fg transition-colors hover:border-accent/40"
                                      >
                                        {chip}
                                      </a>
                                    ) : (
                                      <span
                                        key={attachment.id}
                                        className="inline-flex max-w-full items-center gap-1.5 self-start rounded-full border border-line bg-surface px-2.5 py-1 text-[12px] text-fg"
                                      >
                                        {chip}
                                      </span>
                                    )
                                  })}
                                </div>
                              ) : null}
                            </div>
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
            {error ? (
              <p role="alert" className="mb-2 rounded-control bg-danger-soft px-3 py-2 text-[12.5px] leading-relaxed text-danger">
                {error}
              </p>
            ) : null}
            {locked ? (
              <div className="rounded-card border border-line bg-surface px-4 py-3 text-center shadow-composer">
                <p className="text-[13px] text-muted">Unlock this room to join the conversation.</p>
                <Button size="sm" className="mt-2" onClick={unlockCurrentRoom}>
                  Enter password
                </Button>
              </div>
            ) : (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  accept={ATTACHMENT_ACCEPT}
                  className="hidden"
                  onChange={(event) => {
                    const files = Array.from(event.target.files ?? [])
                    event.target.value = ''
                    addRoomFiles(files)
                  }}
                />
                {linkOpen ? (
                  <div className="mb-2 flex items-center gap-2 rounded-card border border-line bg-surface p-2 shadow-card">
                    <Link2 className="ml-1 size-4 shrink-0 text-faint" />
                    <input
                      autoFocus
                      type="url"
                      inputMode="url"
                      value={linkDraft}
                      onChange={(event) => {
                        setLinkDraft(event.target.value)
                        setAttachmentError('')
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter') return
                        event.preventDefault()
                        addRoomLink()
                      }}
                      placeholder="Paste or type a web address"
                      aria-label="Web address"
                      className="min-w-0 flex-1 bg-transparent px-1 py-1.5 text-[13.5px] text-fg placeholder:text-faint focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={addRoomLink}
                      disabled={!linkDraft.trim()}
                      className="h-8 shrink-0 rounded-control bg-fg px-3 text-[12.5px] font-medium text-bg transition-opacity hover:opacity-85 disabled:opacity-30"
                    >
                      Add link
                    </button>
                    <button
                      type="button"
                      aria-label="Close link form"
                      onClick={() => {
                        setLinkOpen(false)
                        setLinkDraft('')
                        setAttachmentError('')
                      }}
                      className="grid size-8 shrink-0 place-items-center rounded-control text-faint transition-colors hover:bg-surface-2 hover:text-fg"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ) : null}
                {attachmentError ? (
                  <p role="alert" className="mb-2 rounded-control bg-warning-soft px-3 py-2 text-[12px] leading-relaxed text-warning">
                    {attachmentError}
                  </p>
                ) : null}
                <form
                  onSubmit={(event) => {
                    event.preventDefault()
                    void sendMessage()
                  }}
                  className="rounded-card border border-line bg-surface p-2 shadow-composer"
                >
                  {attachments.length ? (
                    <div className="flex flex-wrap gap-2 px-1 pb-2 pt-1" aria-label="Attachments">
                      {attachments.map((attachment) =>
                        attachment.kind === 'image' ? (
                          <div key={attachment.id} className="relative">
                            <img
                              src={attachment.data}
                              alt={attachment.name}
                              title={attachment.name}
                              className="size-14 rounded-[10px] border border-line object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))}
                              aria-label={`Remove ${attachment.name}`}
                              className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full border border-line bg-accent text-bg shadow-sm transition-transform hover:scale-105"
                            >
                              <X className="size-3" />
                            </button>
                          </div>
                        ) : (
                          <span
                            key={attachment.id}
                            className="inline-flex max-w-[230px] items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-1.5 text-[13px] text-muted"
                            title={attachment.name}
                          >
                            {attachment.mime === 'text/uri-list' ? (
                              <Link2 className="size-3.5 shrink-0" />
                            ) : (
                              <FileText className="size-3.5 shrink-0" />
                            )}
                            <span className="truncate">{attachment.name}</span>
                            {attachment.mime === 'text/uri-list' ? null : (
                              <span className="shrink-0 text-faint">{formatFileSize(attachment.size)}</span>
                            )}
                            <button
                              type="button"
                              onClick={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))}
                              aria-label={`Remove ${attachment.name}`}
                              className="ml-0.5 grid size-4 shrink-0 place-items-center rounded-full text-faint transition-colors hover:bg-surface hover:text-fg"
                            >
                              <X className="size-3" />
                            </button>
                          </span>
                        ),
                      )}
                    </div>
                  ) : null}
                  <label htmlFor="room-message" className="sr-only">
                    Message {selectedName}
                  </label>
                  <textarea
                    id="room-message"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onPaste={(event) => {
                      const files = clipboardFiles(event.clipboardData)
                      if (!files.length) return
                      event.preventDefault()
                      addRoomFiles(files)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                        event.preventDefault()
                        void sendMessage()
                      }
                    }}
                    maxLength={ROOM_MESSAGE_CHARS}
                    rows={2}
                    placeholder={`Message ${selectedName}…`}
                    className="max-h-40 min-h-11 w-full resize-none bg-transparent px-2.5 py-1.5 text-[14.5px] leading-relaxed text-fg outline-none placeholder:text-faint"
                  />
                  <div className="flex items-center justify-between gap-2 px-1 pb-0.5">
                    <div className="flex min-w-0 items-center gap-1">
                      <button
                        type="button"
                        aria-label="Attach files"
                        title="Attach images, PDFs, documents or text files"
                        onClick={() => fileRef.current?.click()}
                        className="grid size-8 shrink-0 place-items-center rounded-control text-muted transition-colors hover:bg-surface-2 hover:text-fg"
                      >
                        <Paperclip className="size-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="Attach a link"
                        title="Attach a link"
                        onClick={() => setLinkOpen((open) => !open)}
                        className="grid size-8 shrink-0 place-items-center rounded-control text-muted transition-colors hover:bg-surface-2 hover:text-fg"
                      >
                        <Link2 className="size-4" />
                      </button>
                      <span className="truncate text-[11px] text-faint">
                        {draft.length > ROOM_MESSAGE_CHARS - 80
                          ? `${draft.length}/${ROOM_MESSAGE_CHARS}`
                          : 'Enter to send · Shift+Enter for a new line'}
                      </span>
                    </div>
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      disabled={(!draft.trim() && !attachments.length) || !roomQuery.data}
                      loading={send.isPending}
                    >
                      <Send className="size-3.5" />
                      Send
                    </Button>
                  </div>
                </form>
              </>
            )}
          </div>
        </section>
      </div>

      <CreateRoomDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={selectRoom} />
      <UnlockRoomDialog
        room={unlockTarget}
        onClose={() => setUnlockTarget(null)}
        onUnlocked={(roomId) => {
          setUnlockTarget(null)
          selectRoom(roomId)
        }}
      />
    </div>
  )
}

function RoomGroup({
  label,
  empty,
  rooms,
  selectedId,
  onSelect,
}: {
  label: string
  empty: string
  rooms: RoomSummary[]
  selectedId: string
  onSelect: (room: RoomSummary) => void
}) {
  return (
    <section className="min-w-[170px] shrink-0 md:mb-4 md:min-w-0 md:shrink">
      <div className="mb-1.5 flex items-center justify-between gap-2 px-1">
        <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-faint">{label}</h3>
      </div>
      <div className="flex gap-1.5 md:flex-col">
        {rooms.length === 0 ? (
          <p className="px-1 py-1.5 text-[11.5px] leading-relaxed text-faint">{empty}</p>
        ) : (
          rooms.map((room) => {
            const active = room.id === selectedId
            const privateLocked = room.visibility === 'private' && !room.unlocked
            return (
              <button
                key={room.id}
                type="button"
                onClick={() => onSelect(room)}
                aria-current={active ? 'page' : undefined}
                title={privateLocked ? `${room.name} — password required` : room.name}
                className={cx(
                  'flex min-w-0 items-center gap-2 rounded-control border px-2.5 py-2 text-left transition-colors',
                  active
                    ? 'border-accent/30 bg-accent-soft text-fg'
                    : 'border-transparent text-muted hover:bg-surface-2 hover:text-fg',
                )}
              >
                {room.visibility === 'private' ? (
                  privateLocked ? (
                    <Lock className="size-3.5 shrink-0" />
                  ) : (
                    <Users className="size-3.5 shrink-0" />
                  )
                ) : room.id === ROOM_ID ? (
                  <Users className="size-3.5 shrink-0" />
                ) : (
                  <Globe2 className="size-3.5 shrink-0" />
                )}
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{room.name}</span>
              </button>
            )
          })
        )}
      </div>
    </section>
  )
}

function CreateRoomDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (roomId: string) => void
}) {
  const create = useCreateRoom()
  const toast = useToast()
  const [name, setName] = useState('')
  const [visibility, setVisibility] = useState<RoomVisibility>('public')
  const [password, setPassword] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setName('')
    setVisibility('public')
    setPassword('')
    setFormError(null)
  }, [open])

  const save = async () => {
    const value = name.replace(/\s+/g, ' ').trim()
    if (!value) {
      setFormError('Give the room a name.')
      return
    }
    if (visibility === 'private' && password.length < ROOM_PASSWORD_MIN_CHARS) {
      setFormError(`Use at least ${ROOM_PASSWORD_MIN_CHARS} characters for the password.`)
      return
    }
    setFormError(null)
    try {
      const result = await create.mutateAsync({
        name: value,
        visibility,
        ...(visibility === 'private' ? { password } : {}),
      })
      toast(`Room “${result.room.name}” created`)
      onCreated(result.room.id)
      onClose()
    } catch (failure) {
      setFormError(failure instanceof Error ? failure.message : 'Could not create that room.')
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New room"
      description="Private rooms are password protected. Public rooms are open to everyone."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            loading={create.isPending}
            disabled={!name.trim()}
            onClick={() => void save()}
          >
            Create room
          </Button>
        </>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void save()
        }}
        className="space-y-4"
      >
        <div>
          <label htmlFor="room-name" className="text-[13.5px] font-medium text-fg">
            Room name
          </label>
          <Input
            id="room-name"
            data-autofocus
            value={name}
            maxLength={ROOM_NAME_CHARS}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Study group"
            className="mt-2"
          />
        </div>

        <fieldset>
          <legend className="text-[13.5px] font-medium text-fg">Who can join?</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label
              className={cx(
                'cursor-pointer rounded-control border p-3 transition-colors',
                visibility === 'public'
                  ? 'border-accent/40 bg-accent-soft'
                  : 'border-line bg-surface hover:bg-surface-2',
              )}
            >
              <input
                type="radio"
                name="room-visibility"
                value="public"
                checked={visibility === 'public'}
                onChange={() => setVisibility('public')}
                className="sr-only"
              />
              <Globe2 className="size-4 text-muted" />
              <span className="mt-2 block text-[13px] font-medium">Public</span>
              <span className="mt-0.5 block text-[11.5px] leading-relaxed text-muted">Anyone can join</span>
            </label>
            <label
              className={cx(
                'cursor-pointer rounded-control border p-3 transition-colors',
                visibility === 'private'
                  ? 'border-accent/40 bg-accent-soft'
                  : 'border-line bg-surface hover:bg-surface-2',
              )}
            >
              <input
                type="radio"
                name="room-visibility"
                value="private"
                checked={visibility === 'private'}
                onChange={() => setVisibility('private')}
                className="sr-only"
              />
              <Lock className="size-4 text-muted" />
              <span className="mt-2 block text-[13px] font-medium">Private</span>
              <span className="mt-0.5 block text-[11.5px] leading-relaxed text-muted">Password protected</span>
            </label>
          </div>
        </fieldset>

        {visibility === 'private' ? (
          <div>
            <label htmlFor="room-password" className="text-[13.5px] font-medium text-fg">
              Password
            </label>
            <Input
              id="room-password"
              type="password"
              autoComplete="new-password"
              value={password}
              maxLength={ROOM_PASSWORD_MAX_CHARS}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={`${ROOM_PASSWORD_MIN_CHARS}–${ROOM_PASSWORD_MAX_CHARS} characters`}
              className="mt-2"
            />
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-faint">
              Share it with the people you want in the room. There is no password reset.
            </p>
          </div>
        ) : null}

        {formError ? (
          <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-[12.5px] leading-relaxed text-danger">
            {formError}
          </p>
        ) : null}
      </form>
    </Dialog>
  )
}

function UnlockRoomDialog({
  room,
  onClose,
  onUnlocked,
}: {
  room: RoomSummary | null
  onClose: () => void
  onUnlocked: (roomId: string) => void
}) {
  const unlock = useUnlockRoom()
  const toast = useToast()
  const [password, setPassword] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!room) return
    setPassword('')
    setFormError(null)
  }, [room?.id])

  const save = async () => {
    if (!room) return
    if (!password) {
      setFormError('Enter the room password.')
      return
    }
    setFormError(null)
    try {
      const result = await unlock.mutateAsync({ roomId: room.id, password })
      toast(`Joined ${result.room.name}`)
      onUnlocked(result.room.id)
    } catch (failure) {
      setFormError(failure instanceof Error ? failure.message : 'Could not unlock that room.')
    }
  }

  return (
    <Dialog
      open={Boolean(room)}
      onClose={onClose}
      title={room ? `Join ${room.name}` : 'Join private room'}
      description="Enter the password the room’s creator set."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={unlock.isPending} disabled={!password} onClick={() => void save()}>
            Unlock room
          </Button>
        </>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void save()
        }}
      >
        <label htmlFor="room-unlock-password" className="text-[13.5px] font-medium text-fg">
          Password
        </label>
        <Input
          id="room-unlock-password"
          data-autofocus
          type="password"
          autoComplete="current-password"
          value={password}
          maxLength={ROOM_PASSWORD_MAX_CHARS}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Room password"
          className="mt-2"
        />
        {formError ? (
          <p role="alert" className="mt-3 rounded-control bg-danger-soft px-3 py-2 text-[12.5px] leading-relaxed text-danger">
            {formError}
          </p>
        ) : null}
      </form>
    </Dialog>
  )
}
