import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { Conversation, FeedbackRating, Me, Message, ModelInfo, Project, ProviderHealth, SharedConversation, UserSettings } from '../../shared/types'
import { noteOffline } from './offline'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public resetsAt?: number,
    public conversationId?: string,
  ) {
    super(message)
  }
}

export async function readError(response: Response): Promise<ApiError> {
  let message = response.statusText || 'Request failed.'
  let code: string | undefined
  let resetsAt: number | undefined
  let conversationId: string | undefined
  try {
    const body = (await response.json()) as { error?: string; message?: string; resetsAt?: number; conversationId?: string }
    message = body.message ?? body.error ?? message
    code = body.error
    resetsAt = body.resetsAt
    conversationId = body.conversationId
  } catch {
    /* no body */
  }
  return new ApiError(response.status, message, code, resetsAt, conversationId)
}

export async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {}
  const response = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    ...rest,
    headers: { accept: 'application/json', ...(json !== undefined ? { 'content-type': 'application/json' } : {}), ...(rest.headers ?? {}) },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  })
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

export const useSharedConversation = (token: string | undefined) =>
  useQuery({
    queryKey: ['shared', token],
    queryFn: () => api<SharedConversation | null>(`/share/${token}`),
    enabled: Boolean(token),
    retry: false,
    staleTime: 0,
  })

export function useDeleteAllConversations() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => api('/account/conversations', { method: 'DELETE' }),
    onSuccess: () => {
      client.setQueryData(['conversations'], { items: [] })
      client.removeQueries({ queryKey: ['conversation'] })
      void client.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}
