import { Check, Copy, Globe2, Link2, Lock, Menu as MenuIcon, Monitor, Paperclip, Pencil, Plus, Search, Send, Star, Trash2, UserPlus, Users, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'

import {
  CHAT_REACTIONS,
  cleanReactionEmoji,
  ROOM_DISPLAY_NAME_CHARS,
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
import type { MessageAttachment, RoomMessage, RoomPerson, RoomReaction, RoomSummary, RoomVisibility } from '../../shared/types'
import { AttachmentFile, AttachmentLightbox, AttachmentThumbnail } from '../components/AttachmentViews'
import { announceRoomMessages } from '../components/RoomNotifications'
import { useMobileNav } from '../components/Shell'
import { Avatar, Button, Dialog, Input, Spinner, useToast } from '../components/ui'
import {
  ApiError,
  useAcceptRoomInvite,
  useCreateRoom,
  useCreateRoomInvite,
  useDeleteRoom,
  useInviteRoomPeople,
  useMe,
  useRenameRoomPerson,
  useRoomPeople,
  useSaveRoomPerson,
  useRoom,
  useRooms,
  useSendRoomMessage,
  useSetRoomMessageReaction,
  useUnlockRoom,
  useUpdateRoomProfile,
} from '../lib/api'
import { clearAttention } from '../lib/attention'
import { cx } from '../lib/cx'
import {
  ATTACHMENT_ACCEPT,
  AttachmentError,
  clipboardFiles,
  readAttachment,
  type PendingAttachment,
} from '../lib/attachments'
import { connectRoom, type RoomRealtimeStatus } from '../lib/realtime'

const timeFormatter = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })
const fullTimeFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

function roomMessageIsCurrent(message: RoomMessage, at = Date.now()): boolean {
  return message.createdAt + ROOM_MESSAGE_TTL_MS > at
}

/** A quiet marker for the owner's name; it should not compete with the message. */
function OwnerBadge() {
  return (
    <span
      role="img"
      aria-label="Owner"
      title="Owner"
      className="inline-grid size-3.5 shrink-0 place-items-center rounded-full bg-accent-soft text-[8px] leading-none text-accent"
    >
      ✦
    </span>
  )
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

const ROOM_REACTION_NAMES: Record<string, string> = {
  '❤️': 'Love',
  '😂': 'Laugh',
  '👍': 'Like',
  '🔥': 'Fire',
  '😮': 'Wow',
  '🎉': 'Celebrate',
}

/** A pasted link to a GIF shows the animation itself instead of a link chip. */
function gifLinkUrl(attachment: MessageAttachment): string | null {
  if (attachment.mime !== 'text/uri-list' || !attachment.url) return null
  try {
    const url = new URL(attachment.url)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return /\.gif$/i.test(url.pathname) ? url.toString() : null
  } catch {
    return null
  }
}

function RoomReactionBar({
  reactions,
  onReact,
  side,
}: {
  reactions?: RoomReaction[]
  onReact: (reaction: string | null) => void
  side: 'left' | 'right'
}) {
  const mine = reactions?.find((item) => item.mine)?.reaction ?? null
  const [pickerOpen, setPickerOpen] = useState(false)
  const [draft, setDraft] = useState('')

  const pick = (value: string) => {
    onReact(mine === value ? null : value)
    setDraft('')
    setPickerOpen(false)
  }

  return (
    <div
      className={cx(
        'pointer-events-none absolute top-full z-20 mt-1 flex translate-y-1 scale-95 items-center gap-px rounded-full border border-line/80 bg-surface/95 p-0.5 opacity-0 shadow-[0_3px_10px_-5px_rgb(27_26_23/0.3)] backdrop-blur-sm transition-[opacity,translate,scale] duration-150 delay-0 ease-out',
        'group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100 group-hover:delay-100',
        'group-focus-within:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:scale-100 group-focus-within:opacity-100',
        side === 'right' ? 'right-0' : 'left-0',
      )}
    >
      {CHAT_REACTIONS.map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => onReact(mine === value ? null : value)}
          aria-label={`${mine === value ? 'Remove' : 'React with'} ${ROOM_REACTION_NAMES[value] ?? value}`}
          aria-pressed={mine === value}
          title={`${value} ${ROOM_REACTION_NAMES[value] ?? 'React'}`}
          className={cx(
            'grid size-5 place-items-center rounded-full text-[12px] leading-none transition-colors hover:bg-surface-2',
            mine === value && 'bg-accent-soft',
          )}
        >
          <span aria-hidden="true">{value}</span>
        </button>
      ))}
      {pickerOpen ? (
        <input
          autoFocus
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value)
            // The system emoji picker types into this field; the first complete
            // emoji it leaves behind is applied straight away.
            const reaction = cleanReactionEmoji(event.target.value)
            if (reaction) pick(reaction)
          }}
          onBlur={() => {
            if (!draft.trim()) setPickerOpen(false)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setDraft('')
              setPickerOpen(false)
            }
          }}
          aria-label="React with any emoji"
          placeholder="Any emoji"
          className="h-5 w-[70px] rounded-full border border-line bg-surface px-1.5 text-center text-[11.5px] text-fg outline-none placeholder:text-[10px] placeholder:text-faint focus:border-accent/50"
        />
      ) : (
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          aria-label="React with any emoji"
          title="Any emoji"
          className="grid h-5 min-w-5 place-items-center rounded-full px-0.5 text-[13px] font-semibold leading-none text-muted transition-colors hover:bg-surface-2 hover:text-fg"
        >
          +
        </button>
      )}
    </div>
  )
}

function roomAttachmentPreview(attachments: PendingAttachment[]): MessageAttachment[] {
  return attachments.map((attachment) => ({
    id: attachment.id,
    name: attachment.name,
    mime: attachment.mime,
    size: attachment.size,
    kind: attachment.kind,
    ...(attachment.kind === 'image'
      ? { url: attachment.data, thumbnailUrl: attachment.thumbnail ?? attachment.data }
      : attachment.mime === 'text/uri-list'
        ? { url: attachment.data }
        : {}),
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
  const setReaction = useSetRoomMessageReaction(selectedId)
  const acceptInvite = useAcceptRoomInvite()
  const [messages, setMessages] = useState<RoomMessage[]>([])
  const [viewerId, setViewerId] = useState('')
  const [viewerName, setViewerName] = useState('')
  const [viewerOwner, setViewerOwner] = useState(false)
  const [viewerRoom, setViewerRoom] = useState('')
  const [draft, setDraft] = useState('')
  const [attachments, setAttachments] = useState<PendingAttachment[]>([])
  const [attachmentError, setAttachmentError] = useState('')
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkDraft, setLinkDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [nameOpen, setNameOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState<{ authorId: string; name: string } | null>(null)
  const [unlockTarget, setUnlockTarget] = useState<RoomSummary | null>(null)
  const [lightbox, setLightbox] = useState<MessageAttachment | null>(null)
  const toast = useToast()
  const scroller = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const atBottom = useRef(true)
  const activeRoomRef = useRef(selectedId)
  const sendingRef = useRef(false)
  const seenMessagesRef = useRef<Set<string>>(new Set())
  const initialSnapshotRef = useRef(true)
  const inviteAttemptRef = useRef('')

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

  // An invite link lands on the room route with a token. Redeem it once, then
  // remove the token from the address bar so a refresh cannot replay it.
  useEffect(() => {
    const invite = params.get('invite')?.trim()
    if (!invite) return
    const attempt = `${selectedId}:${invite}`
    if (inviteAttemptRef.current === attempt) return
    inviteAttemptRef.current = attempt
    acceptInvite.mutate(
      { roomId: selectedId, invite },
      {
        onSuccess: ({ room }) => {
          toast(`Joined ${room.name}`)
          setParams((current) => {
            const next = new URLSearchParams(current)
            next.delete('invite')
            next.set('room', room.id)
            return next
          })
        },
        onError: (failure) => {
          toast(failure instanceof Error ? failure.message : 'Could not use that invite.', 'danger')
          setParams((current) => {
            const next = new URLSearchParams(current)
            next.delete('invite')
            return next
          })
        },
      },
    )
  }, [params, selectedId])

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
    setViewerOwner(false)
    setViewerRoom('')
    setStatus('connecting')
    setDraft('')
    setAttachments([])
    setAttachmentError('')
    setLinkOpen(false)
    setLinkDraft('')
    setLightbox(null)
    setRenameTarget(null)
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
    if (data.viewerName) setViewerName(data.viewerName)
    setViewerOwner(data.viewerOwner === true)
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
        if (event.type === 'broadcast' && event.event === 'room_deleted') {
          const deleted = event.data as { roomId?: unknown }
          if (deleted.roomId === selectedId) {
            setMessages([])
            void roomsQuery.refetch()
            selectRoom(roomsQuery.data?.defaultRoomId ?? ROOM_ID)
          }
          return
        }
        if (event.type === 'broadcast' && event.event === 'room_reaction') {
          void refetchRoom()
          return
        }
        if (event.type === 'broadcast' && event.event === 'room_profile') {
          const profile = event.data as { authorId?: unknown; authorName?: unknown }
          if (typeof profile.authorId === 'string' && typeof profile.authorName === 'string') {
            if (profile.authorId === viewerId) setViewerName(profile.authorName)
            setMessages((current) =>
              current.map((message) =>
                message.authorId === profile.authorId
                  ? { ...message, authorName: profile.authorName as string }
                  : message,
              ),
            )
          }
          return
        }
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
  }, [appendForRoom, noteIncoming, refetchRoom, roomsQuery.data?.defaultRoomId, roomsQuery.refetch, selectRoom, selectedId, selectedName, viewerId, viewerRoom])

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
      authorName: viewerName || me?.user.name || 'You',
      authorId: viewerId || 'pending-self',
      ...(viewerOwner ? { authorOwner: true } : {}),
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

  const reactToMessage = (message: RoomMessage, next: string | null) => {
    setReaction.mutate(
      { messageId: message.id, reaction: next },
      {
        onSuccess: (result) => {
          if (activeRoomRef.current !== message.room) return
          setMessages((current) =>
            current.map((item) =>
              item.id === result.messageId ? { ...item, reactions: result.reactions } : item,
            ),
          )
        },
        onError: (failure) =>
          toast(failure instanceof Error ? failure.message : 'Could not save the reaction.', 'danger'),
      },
    )
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
  const canInvite = selectedVisibility === 'private' && Boolean(roomQuery.data?.createdByMe ?? activeRoom?.createdByMe)
  const canDelete = canInvite
  const displayName = viewerName || me?.user.name || 'You'

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
          <div className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-line px-4 md:px-6">
            <h2 className="min-w-0 truncate text-[14px] font-semibold">{selectedName}</h2>
            {canInvite || canDelete ? (
              <div className="flex shrink-0 items-center gap-1">
                {canInvite ? (
                  <Button variant="secondary" size="sm" onClick={() => setInviteOpen(true)}>
                    <UserPlus className="size-3.5" />
                    Invite
                  </Button>
                ) : null}
                {canDelete ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Delete room"
                    title="Delete room"
                    onClick={() => setDeleteOpen(true)}
                  >
                    <Trash2 className="text-danger" />
                  </Button>
                ) : null}
              </div>
            ) : null}
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
                      ? 'Only people with the password or an invite link can read and send messages here.'
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
                      const owner = message.authorOwner === true || (mine && viewerOwner)
                      const author = mine ? 'You' : message.authorName
                      return (
                        <article key={message.id} className={cx('group flex items-start gap-2.5', mine && 'flex-row-reverse', pending && 'opacity-70')}>
                          <Avatar
                            name={mine ? displayName : message.authorName}
                            src={mine ? me?.user.picture : undefined}
                            size={28}
                          />
                          <div className={cx('relative min-w-0 max-w-[82%]', mine && 'text-right')}>
                            <div className={cx('mb-1 flex items-center gap-2 text-[11px] text-faint', mine && 'justify-end')}>
                              <span className="inline-flex items-center gap-1">
                                {mine ? (
                                  <span className="font-medium text-muted">{author}</span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setRenameTarget({ authorId: message.authorId, name: message.authorName })}
                                    aria-label={`Change the name shown for ${message.authorName}`}
                                    title="Change name"
                                    className="group/name inline-flex items-center gap-1 font-medium text-muted transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                                  >
                                    {author}
                                    <Pencil className="size-2.5 opacity-30 transition-opacity group-hover/name:opacity-60 group-focus-visible/name:opacity-60" />
                                  </button>
                                )}
                                {owner ? <OwnerBadge /> : null}
                              </span>
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
                              tabIndex={pending ? undefined : 0}
                              className={cx(
                                'rounded-bubble px-4 py-3 text-left text-[14.5px] leading-relaxed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
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
                                    const gif = gifLinkUrl(attachment)
                                    const image =
                                      attachment.kind === 'image'
                                        ? attachment
                                        : gif
                                          ? { ...attachment, kind: 'image' as const, url: gif, thumbnailUrl: gif }
                                          : null
                                    return image ? (
                                      <AttachmentThumbnail
                                        key={attachment.id}
                                        attachment={image}
                                        onOpen={() => setLightbox(image)}
                                        className="h-28 w-40"
                                      />
                                    ) : (
                                      <AttachmentFile key={attachment.id} attachment={attachment} />
                                    )
                                  })}
                                </div>
                              ) : null}
                            </div>
                            {!pending ? (
                              <div className={cx('mt-1 flex flex-wrap items-center gap-1', mine && 'justify-end')}>
                                {message.reactions?.length
                                  ? message.reactions.map((item) => (
                                      <button
                                        key={item.reaction}
                                        type="button"
                                        onClick={() => reactToMessage(message, item.mine ? null : item.reaction)}
                                        aria-label={`${item.reaction} reaction, ${item.count} ${item.count === 1 ? 'person' : 'people'}`}
                                        aria-pressed={item.mine}
                                        title={item.mine ? 'Remove your reaction' : 'Add this reaction'}
                                        className={cx(
                                          'inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[12px] leading-none transition-colors',
                                          item.mine
                                            ? 'border-accent/40 bg-accent-soft text-fg'
                                            : 'border-line bg-surface text-muted hover:text-fg',
                                        )}
                                      >
                                        <span aria-hidden="true">{item.reaction}</span>
                                        <span>{item.count}</span>
                                      </button>
                                    ))
                                  : null}
                              </div>
                            ) : null}
                            {!pending ? (
                              <RoomReactionBar
                                reactions={message.reactions}
                                onReact={(reaction) => reactToMessage(message, reaction)}
                                side={mine ? 'right' : 'left'}
                              />
                            ) : null}
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
                <div className="mb-1.5 flex items-center justify-between gap-3 px-1 text-[12px] leading-relaxed text-faint">
                  <button
                    type="button"
                    onClick={() => setNameOpen(true)}
                    aria-label="Change your chat name"
                    className="inline-flex shrink-0 items-center gap-1 font-medium text-accent transition-opacity hover:opacity-80"
                  >
                    <Pencil className="size-3" />
                    Change name
                  </button>
                  <span className="inline-flex min-w-0 items-center justify-end gap-1 truncate text-right">
                    Chatting as <span className="font-medium text-muted">{displayName}</span>
                    {viewerOwner ? <OwnerBadge /> : null}
                  </span>
                </div>
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
                              src={attachment.thumbnail ?? attachment.data}
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
                          <span key={attachment.id} className="inline-flex max-w-[260px] items-center gap-1">
                            <AttachmentFile
                              attachment={{
                                id: attachment.id,
                                name: attachment.name,
                                mime: attachment.mime,
                                size: attachment.size,
                                kind: attachment.kind,
                                ...(attachment.mime === 'text/uri-list' ? { url: attachment.data } : {}),
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))}
                              aria-label={`Remove ${attachment.name}`}
                              className="grid size-5 shrink-0 place-items-center rounded-full text-faint transition-colors hover:bg-surface-2 hover:text-fg"
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
                        title="Attach images or GIFs, PDFs, documents or text files"
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

      <AttachmentLightbox attachment={lightbox} onClose={() => setLightbox(null)} />
      <InviteRoomDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        roomId={selectedId}
        roomName={selectedName}
      />
      <ChangeNameDialog
        open={nameOpen || renameTarget !== null}
        onClose={() => {
          setNameOpen(false)
          setRenameTarget(null)
        }}
        roomId={selectedId}
        currentName={renameTarget?.name ?? displayName}
        target={renameTarget}
        onChanged={(name) => {
          if (renameTarget) {
            setMessages((current) =>
              current.map((message) =>
                message.authorId === renameTarget.authorId ? { ...message, authorName: name } : message,
              ),
            )
            if (renameTarget.authorId === viewerId) setViewerName(name)
            return
          }
          setViewerName(name)
          setMessages((current) =>
            current.map((message) =>
              message.authorId === viewerId ? { ...message, authorName: name } : message,
            ),
          )
        }}
      />
      <CreateRoomDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={selectRoom} />
      <DeleteRoomDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        roomId={selectedId}
        roomName={selectedName}
        onDeleted={() => {
          setDeleteOpen(false)
          selectRoom(ROOM_ID)
          toast('Room deleted')
        }}
      />
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
                {room.invited ? (
                  <span
                    title="You joined this room through an invite"
                    className="shrink-0 text-[9.5px] font-semibold uppercase tracking-[0.08em] text-accent"
                  >
                    Invited
                  </span>
                ) : null}
              </button>
            )
          })
        )}
      </div>
    </section>
  )
}

/**
 * A private name for one person in the viewer's own list. A guest tag like
 * #a1b2c3 is hard to remember, so this turns it into "Sam from class" without
 * changing the name anyone else sees.
 */
function PersonRenameForm({
  person,
  onDone,
  onRename,
}: {
  person: RoomPerson
  onDone: () => void
  onRename: (label: string | null) => void
}) {
  const [draft, setDraft] = useState(person.name)
  useEffect(() => setDraft(person.name), [person.name])
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const label = draft.trim()
    const own = person.originalName ?? person.name
    // Saving their own name clears the nickname instead of storing a copy of it.
    onRename(!label || label === own ? null : label)
    onDone()
  }
  return (
    <form onSubmit={submit} className="flex min-w-0 items-center gap-1.5 rounded-control bg-surface-2 px-2 py-1.5">
      <Avatar name={draft.trim() || person.name} size={26} />
      <Input
        autoFocus
        aria-label={`Name for ${person.originalName ?? person.name}`}
        value={draft}
        maxLength={ROOM_DISPLAY_NAME_CHARS}
        placeholder={person.originalName ?? person.name}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onDone()
        }}
        className="h-8 min-w-0 flex-1 text-[12.5px]"
      />
      <button
        type="submit"
        aria-label="Save name"
        className="grid size-7 shrink-0 place-items-center rounded-tile text-accent transition-colors hover:bg-accent-soft"
      >
        <Check className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={onDone}
        aria-label="Cancel rename"
        className="grid size-7 shrink-0 place-items-center rounded-tile text-faint transition-colors hover:bg-surface hover:text-fg"
      >
        <X className="size-3.5" />
      </button>
    </form>
  )
}

function PersonCheckRow({
  person,
  checked,
  onToggle,
  onSave,
  onRename,
}: {
  person: RoomPerson
  checked: boolean
  onToggle: () => void
  onSave: () => void
  onRename: (label: string | null) => void
}) {
  const [renaming, setRenaming] = useState(false)
  if (renaming) {
    return <PersonRenameForm person={person} onDone={() => setRenaming(false)} onRename={onRename} />
  }
  return (
    <div className="flex items-center gap-1 rounded-control pr-1 transition-colors hover:bg-surface-2/70">
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={onToggle}
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-control px-2 py-2 text-left"
      >
        <Avatar name={person.name} size={30} />
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-[13px] font-medium text-fg">{person.name}</span>
            {person.online ? (
              <span className="size-1.5 shrink-0 rounded-full bg-success" title="Online now" aria-label="Online now" />
            ) : null}
          </span>
          <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] text-faint">
            <span className="font-mono tracking-tight">#{person.id}</span>
            <span aria-hidden>·</span>
            <span>{person.guest ? 'Guest' : 'Signed in'}</span>
            {person.renamed && person.originalName ? (
              <>
                <span aria-hidden>·</span>
                <span className="truncate">was {person.originalName}</span>
              </>
            ) : null}
            {!person.online ? (
              <>
                <span aria-hidden>·</span>
                <span>Offline</span>
              </>
            ) : null}
          </span>
        </span>
        <span
          className={cx(
            'grid size-5 shrink-0 place-items-center rounded-[6px] border transition-colors',
            checked ? 'border-accent bg-accent text-bg' : 'border-line-strong bg-surface text-transparent',
          )}
          aria-hidden
        >
          <Check className="size-3.5" />
        </span>
      </button>
      <button
        type="button"
        onClick={() => setRenaming(true)}
        aria-label={`Rename ${person.name}`}
        title="Give them a name you'll remember"
        className="grid size-8 shrink-0 place-items-center rounded-tile text-faint transition-colors hover:bg-surface-2 hover:text-fg"
      >
        <Pencil className={cx('size-3.5', person.renamed && 'text-accent')} />
      </button>
      <button
        type="button"
        onClick={onSave}
        aria-label={person.saved ? `Remove ${person.name} from saved people` : `Save ${person.name}`}
        title={person.saved ? 'Saved for quick add' : 'Save for quick add'}
        className={cx(
          'grid size-8 shrink-0 place-items-center rounded-tile transition-colors',
          person.saved ? 'text-accent hover:bg-accent-soft' : 'text-faint hover:bg-surface-2 hover:text-fg',
        )}
      >
        <Star className={cx('size-3.5', person.saved && 'fill-current')} />
      </button>
    </div>
  )
}

/** Match a people search against the viewer's nickname, their own name and their #id. */
function filterPeople(people: RoomPerson[], query: string): RoomPerson[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return people
  const id = needle.replace(/^#/, '')
  return people.filter(
    (person) =>
      person.name.toLowerCase().includes(needle) ||
      person.originalName?.toLowerCase().includes(needle) ||
      person.id.includes(id),
  )
}

/**
 * Everyone in the directory, grouped so saved people stay on top and offline
 * people are still pickable. Inviting works while they are away.
 */
function PersonSections({
  people,
  selected,
  onToggle,
  onSave,
  onRename,
  showOffline = true,
}: {
  people: RoomPerson[]
  selected: Set<string>
  onToggle: (id: string) => void
  onSave: (person: RoomPerson) => void
  onRename: (person: RoomPerson, label: string | null) => void
  showOffline?: boolean
}) {
  const row = (person: RoomPerson) => (
    <PersonCheckRow
      key={person.id}
      person={person}
      checked={selected.has(person.id)}
      onToggle={() => onToggle(person.id)}
      onSave={() => onSave(person)}
      onRename={(label) => onRename(person, label)}
    />
  )
  const saved = people.filter((person) => person.saved)
  const online = people.filter((person) => !person.saved && person.online)
  const offline = people.filter((person) => !person.saved && !person.online)
  return (
    <>
      {saved.length ? (
        <section>
          <p className="px-2 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-faint">Saved people</p>
          <div className="space-y-0.5">{saved.map(row)}</div>
        </section>
      ) : null}
      {online.length ? (
        <section>
          <p className="px-2 pb-1 pt-1 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-faint">
            Online now · {online.length}
          </p>
          <div className="space-y-0.5">{online.map(row)}</div>
        </section>
      ) : null}
      {showOffline && offline.length ? (
        <section>
          <p className="px-2 pb-1 pt-1 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-faint">
            Offline · {offline.length}
          </p>
          <div className="space-y-0.5">{offline.map(row)}</div>
        </section>
      ) : null}
    </>
  )
}

function InviteRoomDialog({
  open,
  onClose,
  roomId,
  roomName,
}: {
  open: boolean
  onClose: () => void
  roomId: string
  roomName: string
}) {
  const peopleQuery = useRoomPeople(open)
  const savePerson = useSaveRoomPerson()
  const renamePerson = useRenameRoomPerson()
  const invite = useInviteRoomPeople()
  const link = useCreateRoomInvite()
  const toast = useToast()
  const [query, setQuery] = useState('')
  // Everyone is shown by default: the point of this list is inviting people
  // who are away, so an online-only default hid the whole directory.
  const [onlineOnly, setOnlineOnly] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [url, setUrl] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setOnlineOnly(false)
    setSelected(new Set())
    setUrl('')
    setFormError(null)
  }, [open, roomId])

  const copy = async () => {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      toast('Invite link copied')
    } catch {
      toast('Could not copy the link. Select it and copy it manually.', 'danger')
    }
  }

  const toggle = (id: string) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const save = async () => {
    if (!selected.size) return
    setFormError(null)
    try {
      const result = await invite.mutateAsync({ roomId, personIds: [...selected] })
      toast(result.invited === 1 ? 'Invitation sent' : `${result.invited} invitations sent`)
      onClose()
    } catch (failure) {
      setFormError(failure instanceof Error ? failure.message : 'Could not send those invitations.')
    }
  }

  const needle = query.trim()
  const matched = filterPeople(peopleQuery.data?.items ?? [], query)
  const savedPeople = matched.filter((person) => person.saved)
  const onlinePeople = matched.filter((person) => !person.saved && person.online)
  const shown = onlineOnly ? [...savedPeople, ...onlinePeople] : matched
  const onlineCount = matched.filter((person) => person.online).length

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Invite to ${roomName}`}
      description="Choose people by name or Ink id. They do not need to be online; the invitation waits for them."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={invite.isPending} disabled={!selected.size} onClick={() => void save()}>
            <UserPlus className="size-3.5" />
            Invite {selected.size || ''}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-faint" />
          <Input
            aria-label="Search people"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name or #id"
            className="pl-9"
          />
        </div>

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            aria-pressed={onlineOnly}
            onClick={() => setOnlineOnly((current) => !current)}
            className={cx(
              'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11.5px] font-medium transition-colors',
              onlineOnly
                ? 'border-success/30 bg-success-soft text-success'
                : 'border-line-strong bg-surface text-muted hover:bg-surface-2 hover:text-fg',
            )}
          >
            <span className={cx('size-1.5 rounded-full', onlineOnly ? 'bg-success' : 'bg-faint')} />
            Online only
          </button>
          <span className="text-[11px] text-faint">
            {onlineCount} {onlineCount === 1 ? 'person' : 'people'} online
          </span>
        </div>

        {peopleQuery.isLoading ? (
          <div className="flex items-center gap-2 rounded-control bg-surface-2 px-3 py-3 text-[13px] text-muted">
            <Spinner className="size-4" />
            Loading everyone on Ink…
          </div>
        ) : peopleQuery.error ? (
          <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-[12.5px] leading-relaxed text-danger">
            Could not load the people list. Close and try again.
          </p>
        ) : !shown.length ? (
          <p className="rounded-control bg-surface-2 px-3 py-4 text-center text-[12.5px] text-muted">
            {needle
              ? 'No one matches that search.'
              : onlineOnly
                ? 'No one is online right now. Turn off Online only to see everyone.'
                : 'No one has opened Ink yet.'}
          </p>
        ) : (
          <div className="scrollbar-thin max-h-[320px] space-y-2 overflow-y-auto pr-1">
            <PersonSections
              people={shown}
              selected={selected}
              onToggle={toggle}
              onSave={(person) => savePerson.mutate({ personId: person.id, saved: !person.saved })}
              onRename={(person, label) => renamePerson.mutate({ personId: person.id, label })}
              showOffline={!onlineOnly}
            />
          </div>
        )}

        <p className="text-[11.5px] leading-relaxed text-faint">
          Tap the star to save someone for quick adding when you make a private room. Tap the pencil to give
          them a name only you see.
        </p>

        <div className="rounded-control border border-line bg-surface-2/60 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[12.5px] font-medium text-fg">Shareable link</p>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-faint">Anyone with the link can join.</p>
            </div>
            {!url ? (
              <Button
                variant="ghost"
                size="sm"
                loading={link.isPending}
                onClick={() =>
                  link.mutate(roomId, {
                    onSuccess: (result) => setUrl(result.url),
                    onError: (failure) =>
                      setFormError(
                        failure instanceof Error ? failure.message : 'Could not create an invite link.',
                      ),
                  })
                }
              >
                <Link2 className="size-3.5" />
                Create link
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => void copy()}>
                <Copy className="size-3.5" />
                Copy
              </Button>
            )}
          </div>
          {url ? (
            <Input
              aria-label="Invite link"
              readOnly
              value={url}
              onFocus={(event) => event.currentTarget.select()}
              className="mt-2"
            />
          ) : null}
        </div>

        {formError ? (
          <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-[12.5px] leading-relaxed text-danger">
            {formError}
          </p>
        ) : null}
      </div>
    </Dialog>
  )
}

function ChangeNameDialog({
  open,
  onClose,
  roomId,
  currentName,
  target,
  onChanged,
}: {
  open: boolean
  onClose: () => void
  roomId: string
  currentName: string
  target?: { authorId: string; name: string } | null
  onChanged: (name: string) => void
}) {
  const update = useUpdateRoomProfile()
  const toast = useToast()
  const [name, setName] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setName(currentName)
    setFormError(null)
  }, [currentName, open])

  const save = async () => {
    const value = name.replace(/\s+/g, ' ').trim()
    if (!value) {
      setFormError('Enter the name you want people to see.')
      return
    }
    if (value.length > ROOM_DISPLAY_NAME_CHARS) {
      setFormError(
        target
          ? `Keep their chat name to ${ROOM_DISPLAY_NAME_CHARS} characters.`
          : `Keep your display name to ${ROOM_DISPLAY_NAME_CHARS} characters.`,
      )
      return
    }
    setFormError(null)
    try {
      const result = await update.mutateAsync({
        name: value,
        room: roomId,
        ...(target ? { targetId: target.authorId } : {}),
      })
      toast(
        target
          ? `Name in this room changed to “${result.name}”`
          : `Display name changed to “${result.name}”`,
      )
      onChanged(result.name)
      onClose()
    } catch (failure) {
      setFormError(
        failure instanceof Error
          ? failure.message
          : target
            ? 'Could not change that chat name.'
            : 'Could not change your display name.',
      )
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={target ? 'Change their name' : 'Display name'}
      description={
        target
          ? `Choose the name everyone in this room sees beside ${target.name}’s messages.`
          : 'This name appears across Ink, including Settings and every room.'
      }
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            loading={update.isPending}
            disabled={!name.trim()}
            onClick={() => void save()}
          >
            Save name
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
        <label htmlFor="room-display-name" className="text-[13.5px] font-medium text-fg">
          {target ? 'Name in this room' : 'Display name'}
        </label>
        <Input
          id="room-display-name"
          data-autofocus
          value={name}
          maxLength={ROOM_DISPLAY_NAME_CHARS}
          onChange={(event) => setName(event.target.value)}
          placeholder="How should people see you?"
          className="mt-2"
        />
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-faint">
          Up to {ROOM_DISPLAY_NAME_CHARS} characters.{' '}
          {target
            ? 'This changes their name in this room only.'
            : 'This updates Settings, your sidebar, and existing room messages everywhere.'}
        </p>
        {formError ? (
          <p role="alert" className="mt-3 rounded-control bg-danger-soft px-3 py-2 text-[12.5px] leading-relaxed text-danger">
            {formError}
          </p>
        ) : null}
      </form>
    </Dialog>
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
  const savePerson = useSaveRoomPerson()
  const renamePerson = useRenameRoomPerson()
  const [name, setName] = useState('')
  const [visibility, setVisibility] = useState<RoomVisibility>('public')
  const peopleQuery = useRoomPeople(open && visibility === 'private')
  const [password, setPassword] = useState('')
  const [search, setSearch] = useState('')
  const [inviteIds, setInviteIds] = useState<Set<string>>(() => new Set())
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setName('')
    setVisibility('public')
    setPassword('')
    setSearch('')
    setInviteIds(new Set())
    setFormError(null)
  }, [open])

  const matchedPeople = filterPeople(peopleQuery.data?.items ?? [], search)
  const onlineCount = matchedPeople.filter((person) => person.online).length
  const toggleInvite = (id: string) => {
    setInviteIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

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
        ...(visibility === 'private'
          ? { password, ...(inviteIds.size ? { inviteIds: [...inviteIds] } : {}) }
          : {}),
      })
      toast(
        result.invited
          ? `Room “${result.room.name}” created · ${result.invited} invited`
          : `Room “${result.room.name}” created`,
      )
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
      description="Private rooms are password protected. Public rooms are open to everyone. A room stays until its creator deletes it."
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
                onChange={() => {
                  setVisibility('public')
                  setInviteIds(new Set())
                }}
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

        {visibility === 'private' ? (
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13.5px] font-medium text-fg">Invite people</p>
              {inviteIds.size ? (
                <span className="text-[11.5px] text-accent">{inviteIds.size} selected</span>
              ) : null}
            </div>
            <p className="mt-1 text-[11.5px] leading-relaxed text-faint">
              Pick anyone Ink has seen, online or not. They are invited the moment the room is created.
            </p>
            <div className="relative mt-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-faint" />
              <Input
                aria-label="Search people to invite"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name or #id"
                className="pl-9"
              />
            </div>
            {peopleQuery.isLoading ? (
              <div className="mt-2 flex items-center gap-2 text-[12px] text-muted">
                <Spinner className="size-3.5" /> Loading everyone on Ink…
              </div>
            ) : peopleQuery.error ? (
              <p
                role="alert"
                className="mt-2 rounded-control bg-danger-soft px-3 py-2 text-[12px] leading-relaxed text-danger"
              >
                Could not load the people list. Close and try again.
              </p>
            ) : !matchedPeople.length ? (
              <p className="mt-2 rounded-control bg-surface-2 px-3 py-3 text-center text-[12px] text-muted">
                {search.trim() ? 'No one matches that search.' : 'No one else has opened Ink yet.'}
              </p>
            ) : (
              <div className="scrollbar-thin mt-2 max-h-[260px] space-y-2 overflow-y-auto rounded-control border border-line p-1">
                <PersonSections
                  people={matchedPeople}
                  selected={inviteIds}
                  onToggle={toggleInvite}
                  onSave={(person) => savePerson.mutate({ personId: person.id, saved: !person.saved })}
                  onRename={(person, label) => renamePerson.mutate({ personId: person.id, label })}
                />
              </div>
            )}
            <p className="mt-1.5 text-[11px] text-faint">
              {onlineCount} {onlineCount === 1 ? 'person' : 'people'} online right now · star someone to keep them at
              the top next time.
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

function DeleteRoomDialog({
  open,
  onClose,
  roomId,
  roomName,
  onDeleted,
}: {
  open: boolean
  onClose: () => void
  roomId: string
  roomName: string
  onDeleted: () => void
}) {
  const remove = useDeleteRoom()
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setFormError(null)
  }, [open, roomId])

  const save = async () => {
    setFormError(null)
    try {
      await remove.mutateAsync(roomId)
      onDeleted()
    } catch (failure) {
      setFormError(failure instanceof Error ? failure.message : 'Could not delete that room.')
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Delete “${roomName}”?`}
      description="This permanently removes the room, its messages and its attachments. No one will be able to reopen it."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="danger" loading={remove.isPending} onClick={() => void save()}>
            Delete room
          </Button>
        </>
      }
    >
      {formError ? (
        <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-[12.5px] leading-relaxed text-danger">
          {formError}
        </p>
      ) : null}
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
