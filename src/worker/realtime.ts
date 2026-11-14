import type { Env } from './env'

// The Sites realtime binding is one managed Durable Object. Server code may
// mint a short-lived, one-use ticket and publish trusted room events. Browser
// clients never receive either capability.
export interface RealtimeTicket {
  ticket: string
  expiresAt: number
  websocketUrl: string
}

function hub(env: Env) {
  if (!env.REALTIME) {
    throw new Error('Realtime is not enabled for this deployment.')
  }
  return env.REALTIME.get(env.REALTIME.idFromName('hub'))
}

async function call(env: Env, path: string, body: unknown): Promise<Response> {
  const response = await hub(env).fetch(
    new Request(`https://realtime${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  if (!response.ok) throw new Error(`Realtime request failed (${response.status}).`)
  return response
}

export async function createRealtimeTicket(
  env: Env,
  input: {
    room: string
    userId: string
    origin: string
    publish?: boolean
    presence?: boolean
  },
): Promise<RealtimeTicket> {
  const response = await call(env, '/ticket', {
    room: input.room,
    userId: input.userId,
    origin: input.origin,
    publish: input.publish === true,
    presence: input.presence === true,
  })
  return (await response.json()) as RealtimeTicket
}

/** Publish only after the authoritative D1 write succeeds. */
export async function publishRealtime(
  env: Env,
  input: { room: string; event: string; data: unknown },
): Promise<void> {
  // A cold or briefly overloaded realtime object should not make a saved
  // message look delayed to the sender. Retrying is safe because clients merge
  // broadcasts by message id, so a duplicate event is ignored.
  for (let attempt = 0; ; attempt++) {
    try {
      await call(env, '/publish', {
        room: input.room,
        event: input.event,
        data: input.data,
      })
      return
    } catch (error) {
      if (attempt >= 2) throw error
      await new Promise((resolve) => setTimeout(resolve, 100 * 2 ** attempt))
    }
  }
}
