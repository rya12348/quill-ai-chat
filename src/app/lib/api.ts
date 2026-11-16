import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { ArtifactSummary, Conversation, ConversationMemory, FeedbackRating, HumanizerLength, HumanizerPurpose, HumanizerResult, HumanizerStrength, HumanizerTone, Me, Message, ModelInfo, Project, ProviderHealth, ProxySession, ReviewQueue, ReviewRating, ReviewRatingResult, ReviewSummary, RoomMessage, RoomSnapshot, SharedConversation, TrafficSummary, UserSettings } from '../../shared/types'
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

export const useMe = () =>
  useQuery({
    queryKey: ['me'],
    queryFn: () => api<Me>('/me'),
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  })

/** The public room's durable snapshot. Realtime broadcasts are merged on top. */
export const useRoom = () =>
  useQuery({
    queryKey: ['room'],
    queryFn: () => api<RoomSnapshot>('/room'),
    staleTime: 0,
    // A cold Worker or a dropped provider request should not leave the room on
    // an error screen. Retry before surfacing the failure.
    retry: 3,
    retryDelay: (attempt) => Math.min(4_000, 500 * 2 ** attempt),
    // A periodic snapshot keeps an open room in sync and lets the Worker purge
    // messages whose retention window has closed.
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  })

export function useSendRoomMessage() {
  return useMutation({
    mutationFn: (body: string) =>
      api<{ message: RoomMessage; live: boolean }>('/room/messages', { method: 'POST', json: { body } }),
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
export const useConversation = (id: string | undefined) =>
  useQuery({
    queryKey: ['conversation', id],
    queryFn: () => api<ConversationPage>(`/conversations/${id}`),
    enabled: Boolean(id),
    staleTime: 60_000,
    // A missing chat and an offline read are both answers, not hiccups. Retrying
    // an offline 503 leaves the page blank while the retry is pending; show the
    // explicit offline state at once instead.
    retry: false,
  })

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
