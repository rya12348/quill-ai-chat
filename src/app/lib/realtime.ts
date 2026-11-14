// A small typed client for the managed Sites realtime room protocol. The
// browser only opens a socket with a short-lived, one-use ticket. Messages are
// written through the same-origin HTTP API and arrive back as trusted server
// broadcasts, so the browser never gets publish permission.
export type RoomRealtimeStatus =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'unauthorized'
  | 'closed'

export type RoomPresenceMember = {
  connectionId: string
  data: unknown
}

export type RoomRealtimeEvent =
  | { type: 'ready'; connectionId: string; expiresAt: number; expiresInMs: number }
  | { type: 'presence'; members: RoomPresenceMember[] }
  | { type: 'broadcast'; event: string; data: unknown }

type Options = {
  room: string
  onEvent: (event: RoomRealtimeEvent) => void
  onStatus: (status: RoomRealtimeStatus) => void
  ticketUrl?: string
}

function member(value: unknown): RoomPresenceMember | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as { connectionId?: unknown; data?: unknown }
  return typeof record.connectionId === 'string'
    ? { connectionId: record.connectionId, data: record.data }
    : null
}

export function connectRoom({
  room,
  onEvent,
  onStatus,
  ticketUrl = '/api/realtime/ticket',
}: Options): { close: () => void } {
  const endpoint = new URL(ticketUrl, window.location.href)
  if (endpoint.origin !== window.location.origin) {
    throw new Error('The realtime ticket endpoint must be same-origin.')
  }

  let socket: WebSocket | undefined
  let pending: AbortController | undefined
  let renewal: number | undefined
  let reconnect: number | undefined
  let retry = 0
  let stopped = false
  const members = new Map<string, RoomPresenceMember>()

  const emit = (event: RoomRealtimeEvent) => {
    try {
      onEvent(event)
    } catch {
      /* a rendering error must not break the socket */
    }
  }
  const status = (next: RoomRealtimeStatus) => {
    try {
      onStatus(next)
    } catch {
      /* the callback is best-effort */
    }
  }
  const retire = (connection: WebSocket | undefined) => {
    window.clearTimeout(renewal)
    renewal = undefined
    if (!connection) return
    connection.onmessage = connection.onclose = connection.onerror = null
    if (socket === connection) socket = undefined
    try {
      connection.close(1000, 'Authorization renewal')
    } catch {
      /* already closed */
    }
  }
  const schedule = () => {
    window.clearTimeout(reconnect)
    if (stopped) return
    const delay = Math.min(30_000, 600 * 2 ** Math.min(retry++, 6)) * (0.5 + Math.random())
    reconnect = window.setTimeout(() => {
      reconnect = undefined
      void open()
    }, delay)
  }

  async function open(): Promise<void> {
    if (stopped || pending) return
    status('connecting')
    const controller = new AbortController()
    pending = controller
    const timeout = window.setTimeout(() => controller.abort(), 20_000)
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ room }),
        signal: controller.signal,
      })
      if (stopped) return
      if (response.status === 401 || response.status === 403) {
        stopped = true
        status('unauthorized')
        return
      }
      if (!response.ok) throw new Error('Ticket request failed.')
      const ticket = (await response.json()) as { websocketUrl?: unknown }
      if (typeof ticket.websocketUrl !== 'string') throw new Error('Ticket response was invalid.')
      if (stopped) return
      const connection = new WebSocket(ticket.websocketUrl)
      socket = connection
      connection.onmessage = ({ data }) => {
        if (stopped || socket !== connection) return
        let message: unknown
        try {
          message = JSON.parse(data)
        } catch {
          return
        }
        if (!message || typeof message !== 'object' || Array.isArray(message)) return
        const value = message as { type?: unknown; event?: unknown; data?: unknown; members?: unknown; member?: unknown }
        if (value.type === 'ready') {
          retry = 0
          window.clearTimeout(renewal)
          const expiresInMs = Number.isFinite(Number((message as { expiresInMs?: unknown }).expiresInMs))
            ? Number((message as { expiresInMs?: unknown }).expiresInMs)
            : 300_000
          const lifetime = Math.max(1_000, Math.min(300_000, expiresInMs))
          const expiresAt = Number.isFinite(Number((message as { expiresAt?: unknown }).expiresAt))
            ? Number((message as { expiresAt?: unknown }).expiresAt)
            : Date.now() + lifetime
          emit({
            type: 'ready',
            connectionId: String((message as { connectionId?: unknown }).connectionId ?? ''),
            expiresAt,
            expiresInMs: lifetime,
          })
          renewal = window.setTimeout(() => {
            if (stopped || socket !== connection) return
            retire(connection)
            void open()
          }, Math.max(250, lifetime - 1_000 - Math.random() * 1_000))
          return
        }
        if (value.type === 'presence') {
          members.clear()
          if (Array.isArray(value.members)) {
            for (const item of value.members) {
              const entry = member(item)
              if (entry) members.set(entry.connectionId, entry)
            }
          }
          emit({ type: 'presence', members: [...members.values()] })
          return
        }
        if (value.type === 'presence_update') {
          const entry = member(value.member)
          if (!entry) return
          members.set(entry.connectionId, entry)
          emit({ type: 'presence', members: [...members.values()] })
          return
        }
        if (value.type === 'broadcast' && typeof value.event === 'string') {
          emit({ type: 'broadcast', event: value.event, data: value.data })
        }
      }
      connection.onclose = () => {
        if (stopped || socket !== connection) return
        retire(connection)
        status('disconnected')
        schedule()
      }
      connection.onerror = () => {
        if (stopped || socket !== connection) return
        retire(connection)
        status('disconnected')
        schedule()
      }
      status('connected')
    } catch {
      if (!stopped) {
        status('disconnected')
        schedule()
      }
    } finally {
      window.clearTimeout(timeout)
      if (pending === controller) pending = undefined
    }
  }

  void open()

  return {
    close() {
      stopped = true
      window.clearTimeout(reconnect)
      pending?.abort()
      retire(socket)
      status('closed')
    },
  }
}
