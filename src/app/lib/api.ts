import { type Query, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useRef } from 'react'

import type { ArtifactSummary, AttachmentInput, Conversation, ConversationMemory, FeedbackRating, HumanizerLength, HumanizerPurpose, HumanizerResult, HumanizerStrength, HumanizerTone, Me, Message, ModelInfo, Project, ProviderHealth, ProxySession, ReviewQueue, ReviewRating, ReviewRatingResult, ReviewSummary, RoomList, RoomMessage, RoomPeople, RoomProfile, RoomReaction, RoomSnapshot, RoomSummary, RoomVisibility, SharedConversation, TrafficSummary, UserSettings } from '../../shared/types'
import { localBrowser } from './local-browser'
import { noteOffline } from './offline'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public resetsAt?: number,
    public conversationId?: string,
    public provider?: string,
  ) {
    super(message)
  }
}

export async function readError(response: Response): Promise<ApiError> {
  let message = response.statusText || 'Request failed.'
  let code: string | undefined
  let resetsAt: number | undefined
  let conversationId: string | undefined
  let provider: string | undefined
  try {
    const body = (await response.json()) as { error?: string; message?: string; resetsAt?: number; conversationId?: string; provider?: string }
    message = body.message ?? body.error ?? message
    code = body.error
    resetsAt = body.resetsAt
    conversationId = body.conversationId
    provider = body.provider
  } catch {
    /* no body */
  }
  return new ApiError(response.status, message, code, resetsAt, conversationId, provider)
}

export async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {}
  // Opt-in local Chrome owns browser actions once its loopback bridge is
  // connected. Planning, drafting and every non-browser API stay on the
  // hosted Worker. This keeps the Steel fallback intact.
  // Include a local session whose socket is currently reconnecting. Routing
  // those calls to the Worker used to return no_session and erase the UI.
  if (path.startsWith('/browser/') && localBrowser.ownsSession()) {
    const local = await localBrowser.handle(path, init)
    if (local) {
      if (!local.ok) throw await readError(local)
      return (await local.json()) as T
    }
  }
  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      credentials: 'same-origin',
      ...rest,
      headers: { accept: 'application/json', ...(json !== undefined ? { 'content-type': 'application/json' } : {}), ...(rest.headers ?? {}) },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    })
  } catch (error) {
    // A dropped Wi-Fi handoff or a sleeping laptop used to surface the raw
    // “Failed to fetch” string. Keep a manual stop as-is; make a transport
    // failure something the person can act on.
    if (rest.signal?.aborted) throw error
    throw new ApiError(0, 'Ink could not be reached. Check your connection and try again.')
  }
  noteOffline(response)
  if (!response.ok) throw await readError(response)
  return (await response.json()) as T
}

export type ConversationPage = { conversation: Conversation; messages: Message[] }

export type ConditionalApiResult<T> =
  | { kind: 'data'; data: T; etag: string | null }
  | { kind: 'not-modified'; etag: string | null }

/**
 * A read that can ask the Worker to answer 304. The response body is reused
 * from the query cache, so idle polling does not decode and render an unchanged
 * conversation over and over.
 */
export async function apiConditional<T>(path: string, etag: string | null, signal?: AbortSignal): Promise<ConditionalApiResult<T>> {
  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      credentials: 'same-origin',
      headers: { accept: 'application/json', ...(etag ? { 'if-none-match': etag } : {}) },
      signal,
    })
  } catch (error) {
    if (signal?.aborted) throw error
    throw new ApiError(0, 'Ink could not be reached. Check your connection and try again.')
  }
  noteOffline(response)
  const nextEtag = response.headers.get('etag')
  if (response.status === 304) return { kind: 'not-modified', etag: nextEtag ?? etag }
  if (!response.ok) throw await readError(response)
  return { kind: 'data', data: (await response.json()) as T, etag: nextEtag }
}

export const useMe = () =>
  useQuery({
    queryKey: ['me'],
    queryFn: () => api<Me>('/me'),
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  })

/** Private rooms come first, then public rooms; General stays the main room. */
export const useRooms = () =>
  useQuery({
    queryKey: ['rooms'],
    queryFn: () => api<RoomList>('/rooms'),
    staleTime: 0,
    retry: 3,
    retryDelay: (attempt) => Math.min(4_000, 500 * 2 ** attempt),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  })

/** One room's durable snapshot. Realtime broadcasts are merged on top. */
export function useRoom(roomId: string, refetchInterval = 60_000) {
  return useQuery({
    queryKey: ['room', roomId],
    queryFn: () => api<RoomSnapshot>(`/rooms/${encodeURIComponent(roomId)}`),
    enabled: Boolean(roomId),
    staleTime: 0,
    // A locked private room is an expected 403, not a flaky request to retry.
    retry: (attempt, error) => !(error instanceof ApiError && error.status === 403) && attempt < 3,
    retryDelay: (attempt) => Math.min(4_000, 500 * 2 ** attempt),
    // A periodic snapshot keeps an open room in sync and lets the Worker purge
    // messages whose retention window has closed. The room shortens this while
    // realtime is reconnecting so no manual refresh is needed.
    refetchInterval,
    // Keep the snapshot current while the room tab is hidden so unread counts
    // and notifications still work if the realtime socket drops.
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  })
}

export function useSendRoomMessage(roomId: string) {
  return useMutation({
    mutationFn: ({ body, attachments }: { body: string; attachments?: AttachmentInput[] }) =>
      api<{ message: RoomMessage; live: boolean }>(`/rooms/${encodeURIComponent(roomId)}/messages`, {
        method: 'POST',
        json: { body, ...(attachments?.length ? { attachments } : {}) },
      }),
  })
}

export function useSetRoomMessageReaction(roomId: string) {
  return useMutation({
    mutationFn: ({ messageId, reaction }: { messageId: string; reaction: string | null }) =>
      api<{ messageId: string; reactions: RoomReaction[] }>(
        `/rooms/${encodeURIComponent(roomId)}/messages/${encodeURIComponent(messageId)}/reaction`,
        { method: 'PATCH', json: { reaction } },
      ),
  })
}

export function useUpdateRoomProfile() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ name, room, targetId }: { name: string; room?: string; targetId?: string }) =>
      api<RoomProfile>('/rooms/profile', {
        method: 'PATCH',
        json: { name, ...(room ? { room } : {}), ...(targetId ? { targetId } : {}) },
      }),
    onSuccess: () => {
      // The new name is shown beside existing messages too, so refresh open
      // room snapshots rather than updating only future sends. It is also the
      // site-wide display name shown in Settings and the sidebar.
      void client.invalidateQueries({ queryKey: ['room'] })
      void client.invalidateQueries({ queryKey: ['rooms'] })
      void client.invalidateQueries({ queryKey: ['me'] })
    },
  })
}

export function useCreateRoomInvite() {
  return useMutation({
    mutationFn: (roomId: string) =>
      api<{ url: string }>(`/rooms/${encodeURIComponent(roomId)}/invite`, { method: 'POST' }),
  })
}

/** The durable Ink directory, used by the people picker and saved quick-add. */
export function useRoomPeople(enabled = true) {
  return useQuery({
    queryKey: ['room-people'],
    queryFn: () => api<RoomPeople>('/rooms/people'),
    enabled,
    staleTime: 10_000,
    refetchInterval: enabled ? 30_000 : false,
    refetchOnWindowFocus: true,
  })
}

export function useSaveRoomPerson() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ personId, saved }: { personId: string; saved: boolean }) =>
      api<{ ok: true; personId: string; saved: boolean }>(
        `/rooms/people/${encodeURIComponent(personId)}/saved`,
        { method: 'PATCH', json: { saved } },
      ),
    onSuccess: (result) => {
      client.setQueryData<RoomPeople>(['room-people'], (current) =>
        current
          ? {
              ...current,
              items: current.items.map((person) =>
                person.id === result.personId ? { ...person, saved: result.saved } : person,
              ),
            }
          : current,
      )
      void client.invalidateQueries({ queryKey: ['room-people'] })
    },
  })
}

/**
 * Give someone a private name in your own people list. Pass null to restore the
 * name they use themselves. Other people never see this label.
 */
export function useRenameRoomPerson() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ personId, label }: { personId: string; label: string | null }) =>
      api<{ ok: true; personId: string; label: string | null }>(
        `/rooms/people/${encodeURIComponent(personId)}/label`,
        { method: 'PATCH', json: { label } },
      ),
    onSuccess: (result) => {
      client.setQueryData<RoomPeople>(['room-people'], (current) =>
        current
          ? {
              ...current,
              items: current.items.map((person) => {
                if (person.id !== result.personId) return person
                const own = person.originalName ?? person.name
                return {
                  ...person,
                  name: result.label ?? own,
                  ...(result.label
                    ? { renamed: true, originalName: own }
                    : { renamed: false, originalName: undefined }),
                }
              }),
            }
          : current,
      )
      void client.invalidateQueries({ queryKey: ['room-people'] })
    },
  })
}

export function useInviteRoomPeople() {
  return useMutation({
    mutationFn: ({ roomId, personIds }: { roomId: string; personIds: string[] }) =>
      api<{ ok: true; invited: number; people: { id: string; name: string }[] }>(
        `/rooms/${encodeURIComponent(roomId)}/invite/people`,
        { method: 'POST', json: { personIds } },
      ),
  })
}

export function useAcceptRoomInvite() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ roomId, invite }: { roomId: string; invite: string }) =>
      api<{ ok: true; room: RoomSummary }>(`/rooms/${encodeURIComponent(roomId)}/invite/accept`, {
        method: 'POST',
        json: { invite },
      }),
    onSuccess: (result, input) => {
      // Redeeming an invite is the same grant as entering the password. Mark
      // the room open immediately so a return visit cannot ask for it again.
      client.setQueryData<RoomList>(['rooms'], (current) =>
        current
          ? {
              ...current,
              items: current.items.map((item) =>
                item.id === result.room.id ? { ...item, ...result.room } : item,
              ),
            }
          : current,
      )
      void client.invalidateQueries({ queryKey: ['rooms'] })
      void client.invalidateQueries({ queryKey: ['room', input.roomId] })
    },
  })
}

export function useDeleteRoom() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (roomId: string) =>
      api<{ ok: true; roomId: string }>(`/rooms/${encodeURIComponent(roomId)}`, { method: 'DELETE' }),
    onSuccess: (_result, roomId) => {
      client.setQueryData<RoomList>(['rooms'], (current) =>
        current ? { ...current, items: current.items.filter((room) => room.id !== roomId) } : current,
      )
      client.removeQueries({ queryKey: ['room', roomId] })
      void client.invalidateQueries({ queryKey: ['rooms'] })
    },
  })
}

export function useCreateRoom() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: { name: string; visibility: RoomVisibility; password?: string; inviteIds?: string[] }) =>
      api<{ room: RoomSummary; invited?: number }>('/rooms', { method: 'POST', json: input }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['rooms'] })
    },
  })
}

export function useUnlockRoom() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ roomId, password }: { roomId: string; password: string }) =>
      api<{ ok: true; room: RoomSummary }>(`/rooms/${encodeURIComponent(roomId)}/unlock`, {
        method: 'POST',
        json: { password },
      }),
    onSuccess: async (result, input) => {
      // The server has already saved the grant. Update the rail before the
      // network refetch completes so returning to the room cannot prompt for
      // the same password again.
      client.setQueryData<RoomList>(['rooms'], (current) =>
        current
          ? {
              ...current,
              items: current.items.map((item) =>
                item.id === result.room.id
                  ? { ...item, ...result.room, ...(item.invited ? { invited: true } : {}) }
                  : item,
              ),
            }
          : current,
      )
      // Keep the dialog pending until the room and rail reflect the saved
      // grant, so the user never lands back on the locked view.
      await Promise.all([
        client.invalidateQueries({ queryKey: ['rooms'] }),
        client.invalidateQueries({ queryKey: ['room', input.roomId] }),
      ])
    },
  })
}

export const useModels = () => useQuery({ queryKey: ['models'], queryFn: () => api<{ items: ModelInfo[] }>('/models'), staleTime: 60_000 })

export type ProvidersState = { mode: 'api' | 'public'; items: ProviderHealth[]; probed?: string[]; backedOff?: boolean }

/** Persisted provider health: renders immediately, never probes on read. */
export const useProviders = () =>
  useQuery({ queryKey: ['providers'], queryFn: () => api<ProvidersState>('/providers'), staleTime: 30_000, refetchOnWindowFocus: true })

/** A bounded refresh by default; `all` checks every configured provider. */
export function useProbeProviders() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input?: { id?: string; force?: boolean; all?: boolean }) => api<ProvidersState>('/providers/probe', { method: 'POST', json: input ?? {} }),
    onSuccess: (state) => client.setQueryData(['providers'], state),
  })
}
export const useConversations = () => useQuery({ queryKey: ['conversations'], queryFn: () => api<{ items: Conversation[] }>('/conversations') })
export const useArtifacts = () =>
  useQuery({ queryKey: ['artifacts'], queryFn: () => api<{ items: ArtifactSummary[] }>('/artifacts'), staleTime: 0, refetchOnMount: 'always' })

export const useReviewSummary = () =>
  useQuery({ queryKey: ['review-summary'], queryFn: () => api<ReviewSummary>('/review/summary'), staleTime: 15_000, refetchOnWindowFocus: true })

export const useReviewQueue = (deck?: string) =>
  useQuery({
    queryKey: ['review-queue', deck ?? 'all'],
    queryFn: () => api<ReviewQueue>(`/review${deck ? `?deck=${encodeURIComponent(deck)}` : ''}`),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  })

export function useEnrollReviewDeck() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (messageId: string) =>
      api<{ deckTitle: string; cards: number; summary: ReviewSummary }>(`/review/decks/${messageId}`, { method: 'POST' }),
    onSuccess: (data) => {
      client.setQueryData(['review-summary'], data.summary)
      void client.invalidateQueries({ queryKey: ['review-queue'] })
    },
  })
}

export function useRateReview() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ messageId, cardIndex, rating }: { messageId: string; cardIndex: number; rating: ReviewRating }) =>
      api<ReviewRatingResult>(`/review/${messageId}/${cardIndex}`, { method: 'POST', json: { rating } }),
    onSuccess: (result) => client.setQueryData(['review-summary'], result.summary),
  })
}

export function usePinArtifact() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) =>
      api<{ pinned: boolean }>(`/artifacts/${id}/pin`, { method: pinned ? 'POST' : 'DELETE' }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['artifacts'] }),
  })
}

export function useDuplicateArtifact() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api<{ conversationId: string }>(`/artifacts/${id}/duplicate`, { method: 'POST' }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['conversations'] })
      void client.invalidateQueries({ queryKey: ['artifacts'] })
    },
  })
}

/**
 * A proxy session is a read-only capability, so a transient failed request can
 * safely be retried. This matters on flaky Wi-Fi and on Chromebooks that briefly
 * report themselves offline: the service worker can otherwise turn the first
 * attempt into an offline error before the network is actually usable.
 */
export async function createProxySession(url: string) {
  const open = () => api<{ session: ProxySession }>('/proxy/session', { method: 'POST', json: { url } })
  try {
    return await open()
  } catch (cause) {
    const transient = !(cause instanceof ApiError) || cause.code === 'offline' || cause.status === 0 || cause.status === 503
    if (!transient) throw cause
    await new Promise((resolve) => setTimeout(resolve, 700))
    try {
      return await open()
    } catch (retryError) {
      if (retryError instanceof ApiError) throw retryError
      throw new ApiError(0, 'Could not reach Ink. Check your connection and try again.')
    }
  }
}

export async function downloadArtifact(messageId: string): Promise<string> {
  const response = await fetch(`/api/artifacts/${messageId}/download`, { credentials: 'same-origin' })
  if (!response.ok) {
    let message = 'Could not download this artifact'
    try {
      const body = (await response.json()) as { message?: unknown }
      if (typeof body.message === 'string') message = body.message
    } catch {
      // Keep the generic message when the body is not JSON.
    }
    throw new Error(message)
  }
  const disposition = response.headers.get('content-disposition') ?? ''
  const name = /filename="?([^";]+)"?/i.exec(disposition)?.[1] ?? 'artifact'
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
  return name
}

export function useUpdateProjectInstructions() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, instructions }: { id: string; instructions: string }) =>
      api<{ project: unknown }>(`/projects/${id}/instructions`, { method: 'PATCH', json: { instructions } }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['projects'] }),
  })
}
export const useProjects = () => useQuery({ queryKey: ['projects'], queryFn: () => api<{ items: Project[] }>('/projects'), staleTime: 30_000 })

export function useCreateProject() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => api<{ project: Project }>('/projects', { method: 'POST', json: { name } }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['projects'] }),
  })
}

export function useRenameProject() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api<{ project: Project }>(`/projects/${id}`, { method: 'PATCH', json: { name } }),
    onSuccess: ({ project }) => {
      client.setQueryData<{ items: Project[] }>(['projects'], (old) => old && { items: old.items.map((p) => (p.id === project.id ? project : p)) })
    },
  })
}

export function useDeleteProject() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api(`/projects/${id}`, { method: 'DELETE' }),
    onSuccess: (_, id) => {
      client.setQueryData<{ items: Conversation[] }>(['conversations'], (old) => old && { items: old.items.map((c) => (c.projectId === id ? { ...c, projectId: null } : c)) })
      // The open chat and any artifact card can still carry the deleted project.
      void client.invalidateQueries({ queryKey: ['conversation'] })
      void client.invalidateQueries({ queryKey: ['artifacts'] })
      void client.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

export function useSetConversationProject() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, projectId }: { id: string; projectId: string | null }) =>
      api<{ conversation: Conversation }>(`/conversations/${id}`, { method: 'PATCH', json: { projectId } }),
    onSuccess: ({ conversation }) => {
      client.setQueryData<{ items: Conversation[] }>(['conversations'], (old) => old && { items: old.items.map((c) => (c.id === conversation.id ? conversation : c)) })
      client.setQueryData<ConversationPage>(['conversation', conversation.id], (old) => old && { ...old, conversation })
      void client.invalidateQueries({ queryKey: ['artifacts'] })
      void client.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}
export const useConversation = (
  id: string | undefined,
  options: { refetchInterval?: number | false; paused?: boolean } = {},
) => {
  const client = useQueryClient()
  const etags = useRef(new Map<string, string>())
  const { refetchInterval = false, paused = false } = options
  // Keep the callback stable so a render caused by typing does not restart the
  // idle timer. It still reads the latest failure count from the query.
  const refreshInterval = useMemo(() => {
    if (!refetchInterval) return false
    return (query: Query<ConversationPage, Error, ConversationPage, readonly unknown[]>) => {
      if (paused) return false
      const failures = query.state.fetchFailureCount
      if (!failures) return refetchInterval
      const error = query.state.error
      // A missing chat will not appear by refreshing it. An offline read waits
      // for the app's reconnect probe instead of retrying on the idle timer.
      if (error instanceof ApiError && (error.status === 404 || error.code === 'offline' || error.status === 0)) return false
      // Server errors back off as well, up to one request a minute.
      return Math.min(60_000, refetchInterval * 2 ** Math.min(failures, 4))
    }
  }, [paused, refetchInterval])

  return useQuery({
    queryKey: ['conversation', id],
    queryFn: async ({ signal }) => {
      if (!id) throw new ApiError(400, 'Choose a conversation first.')
      const result = await apiConditional<ConversationPage>(`/conversations/${id}`, etags.current.get(id) ?? null, signal)
      if (result.etag) etags.current.set(id, result.etag)
      if (result.kind === 'data') return result.data
      const cached = client.getQueryData<ConversationPage>(['conversation', id])
      if (cached) return cached
      // A 304 is only useful with a cached page. Fetch once without the tag if
      // this tab has no copy (for example after a cache reset).
      const retry = await apiConditional<ConversationPage>(`/conversations/${id}`, null, signal)
      if (retry.kind !== 'data') throw new ApiError(304, 'The conversation did not change.')
      if (retry.etag) etags.current.set(id, retry.etag)
      return retry.data
    },
    enabled: Boolean(id),
    // Chat is shared across tabs and devices. A fresh read whenever the page
    // opens or regains focus means a reply written elsewhere is visible without
    // a browser reload; the caller adds a short idle poll while a chat is open.
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: refreshInterval,
    // A missing chat and an offline read are both answers, not hiccups. Retrying
    // an offline 503 leaves the page blank while the retry is pending; show the
    // explicit offline state at once instead.
    retry: false,
  })
}

export type MemoryState = { memory: ConversationMemory | null }

/** The rolling memory for a chat, or null while the chat fits verbatim. */
export const useConversationMemory = (id: string | undefined) =>
  useQuery({
    queryKey: ['memory', id],
    queryFn: () => api<MemoryState>(`/conversations/${id}/memory`),
    enabled: Boolean(id),
    staleTime: 30_000,
    retry: false,
  })

export function useEditConversationMemory(id: string | undefined) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (summary: string) => api<MemoryState>(`/conversations/${id}/memory`, { method: 'PATCH', json: { summary } }),
    onSuccess: (state) => client.setQueryData(['memory', id], state),
  })
}

export function useForgetConversationMemory(id: string | undefined) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => api<MemoryState>(`/conversations/${id}/memory`, { method: 'DELETE' }),
    onSuccess: (state) => client.setQueryData(['memory', id], state),
  })
}

export function useRenameConversation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => api<{ conversation: Conversation }>(`/conversations/${id}`, { method: 'PATCH', json: { title } }),
    onSuccess: ({ conversation }) => {
      client.setQueryData<{ items: Conversation[] }>(['conversations'], (old) => old && { items: old.items.map((c) => (c.id === conversation.id ? conversation : c)) })
      client.setQueryData<ConversationPage>(['conversation', conversation.id], (old) => old && { ...old, conversation })
    },
  })
}

export function useSetConversationModel() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, model }: { id: string; model: string }) => api<{ conversation: Conversation }>(`/conversations/${id}`, { method: 'PATCH', json: { model } }),
    onMutate: ({ id, model }) => {
      client.setQueryData<ConversationPage>(['conversation', id], (old) => old && { ...old, conversation: { ...old.conversation, model } })
    },
  })
}

export function useDeleteConversation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api(`/conversations/${id}`, { method: 'DELETE' }),
    onSuccess: (_, id) => {
      client.setQueryData<{ items: Conversation[] }>(['conversations'], (old) => old && { items: old.items.filter((c) => c.id !== id) })
      client.removeQueries({ queryKey: ['conversation', id] })
      client.removeQueries({ queryKey: ['memory', id] })
      client.removeQueries({ queryKey: ['share', id] })
      void client.invalidateQueries({ queryKey: ['artifacts'] })
      void client.invalidateQueries({ queryKey: ['review-summary'] })
      void client.invalidateQueries({ queryKey: ['review-queue'] })
      void client.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

export const useSettings = () => useQuery({ queryKey: ['settings'], queryFn: () => api<UserSettings>('/settings') })

export function useUpdateSettings() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (instructions: string) => api<UserSettings>('/settings', { method: 'PATCH', json: { instructions } }),
    onSuccess: (settings) => client.setQueryData(['settings'], settings),
  })
}

export function useMessageFeedback() {
  return useMutation({
    mutationFn: ({ id, rating }: { id: string; rating: FeedbackRating }) =>
      api<{ ok: boolean; rating: FeedbackRating }>(`/messages/${id}/feedback`, { method: 'POST', json: { rating } }),
  })
}

export type ShareState = { token: string | null }

export const useConversationShare = (id: string | undefined, enabled: boolean) =>
  useQuery({
    queryKey: ['share', id],
    queryFn: () => api<ShareState>(`/conversations/${id}/share`),
    enabled: Boolean(id) && enabled,
    retry: false,
  })

export function useCreateConversationShare() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api<ShareState>(`/conversations/${id}/share`, { method: 'POST' }),
    onSuccess: (share, id) => client.setQueryData(['share', id], share),
  })
}

export function useRevokeConversationShare() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api(`/conversations/${id}/share`, { method: 'DELETE' }),
    onSuccess: (_, id) => client.setQueryData<ShareState>(['share', id], { token: null }),
  })
}

export function useHumanize() {
  return useMutation({
    mutationFn: (input: {
      text: string
      tone: HumanizerTone
      strength: HumanizerStrength
      voice?: string
      purpose?: HumanizerPurpose
      length?: HumanizerLength
    }) => api<HumanizerResult>('/humanize', { method: 'POST', json: input, signal: AbortSignal.timeout(180_000) }),
  })
}

export const useSharedConversation = (token: string | undefined) =>
  useQuery({
    queryKey: ['shared', token],
    queryFn: () => api<SharedConversation | null>(`/share/${token}`),
    enabled: Boolean(token),
    retry: false,
    staleTime: 0,
  })

export const useTraffic = () =>
  useQuery({
    queryKey: ['traffic'],
    queryFn: () => api<TrafficSummary>('/analytics/summary'),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  })

export function useDeleteAccount() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => api('/account', { method: 'DELETE' }),
    onSuccess: () => client.clear(),
  })
}

export function useDeleteAllConversations() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => api('/account/conversations', { method: 'DELETE' }),
    onSuccess: () => {
      client.setQueryData(['conversations'], { items: [] })
      client.removeQueries({ queryKey: ['conversation'] })
      client.removeQueries({ queryKey: ['memory'] })
      client.removeQueries({ queryKey: ['share'] })
      client.removeQueries({ queryKey: ['shared'] })
      client.setQueryData(['artifacts'], { items: [] })
      client.setQueryData<ReviewSummary>(['review-summary'], { due: 0, total: 0, reviewedToday: 0, nextDueAt: null })
      void client.invalidateQueries({ queryKey: ['review-queue'] })
      void client.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}
