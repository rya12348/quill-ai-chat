import { Hono } from 'hono'

import { privateJson } from '../auth'
import type { AppContext } from '../env'
import { healthRows, mergeHealth, probeProviders, providerDescriptors } from '../provider-health'

export const providers = new Hono<AppContext>()

// The last known status of every provider this deployment can use. Reading is
// cheap and never probes: a fresh page load renders what D1 remembers.
providers.get('/', async (c) => {
  const env = c.env
  const owner = c.get('user').sub
  const [rows, descriptors] = [await healthRows(c.get('db'), owner), providerDescriptors(env)]
  return privateJson(c, {
    mode: descriptors.some((descriptor) => descriptor.id === 'freebuff-api') ? 'api' : 'public',
    items: mergeHealth(descriptors, rows),
  })
})

// Refresh one named provider, a couple that are due, or every provider that is
// not already healthy. A failed provider keeps its backoff unless force is set.
providers.post('/probe', async (c) => {
  const input = await c.req
    .json<{ id?: unknown; force?: unknown; all?: unknown }>()
    .catch(() => ({}) as { id?: unknown; force?: unknown; all?: unknown })
  if (input.id !== undefined && typeof input.id !== 'string') return c.json({ error: 'Invalid provider.' }, 400)
  const db = c.get('db')
  const owner = c.get('user').sub
  const result = await probeProviders(db, owner, c.env, {
    ...(typeof input.id === 'string' ? { id: input.id } : {}),
    force: input.force === true,
    all: input.all === true,
  })
  if (input.id !== undefined && result.probed.length === 0) return c.json({ error: 'Provider not found.' }, 404)
  const rows = await healthRows(db, owner)
  return privateJson(c, {
    mode: providerDescriptors(c.env).some((descriptor) => descriptor.id === 'freebuff-api') ? 'api' : 'public',
    items: mergeHealth(providerDescriptors(c.env), rows),
    probed: result.probed,
    backedOff: result.backedOff,
  })
})
