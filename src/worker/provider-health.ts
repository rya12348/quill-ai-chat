// Provider health that survives a restart. The free lanes cool down inside one
// isolate (public-ai.ts); this keeps the last known result in D1 so a fresh page
// load shows it immediately instead of "unknown" until a probe finishes. Each
// owner has their own rows: the same lane can behave differently for a
// deployment with different keys.
//
// Failures back off exponentially so a dead provider is not hammered on every
// request, and a success on the next probe clears the failure state.

import { FREEBUFF_API_URL } from '../shared/config'
import type { ProviderHealth, ProviderStatus } from '../shared/types'
import { AiError, aiConfigured } from './ai'
import type { Env } from './env'
import { familyForLane, laneKey, laneText, publicLanes, type PublicLane } from './public-ai'

/** How long a healthy result is trusted before an automatic probe may run. */
export const HEALTH_TTL = 10 * 60_000
/** A failing lane waits longer after each failure, up to half an hour. */
const BACKOFF_BASE = 30_000
const BACKOFF_MAX = 30 * 60_000
/** Providers are "down" after this many consecutive persistent failures. */
const DOWN_AFTER = 3
/** Rate limits and timeouts are temporary: keep those lanes selectable. */
const TRANSIENT_FAILURES = new Set(['busy', 'timeout', 'network', 'empty', 'probe_failed', 'aborted'])
/** A single probe cannot take longer than this. */
const PROBE_TIMEOUT = 20_000
/** Keep a full refresh from bursting every provider at once. */
const PROBE_CONCURRENCY = 8
/** At most this many providers are probed by one request. */
export const MAX_PROBES_PER_REQUEST = 2

export type ProviderDescriptor = {
  id: string
  name: string
  description: string
  /** The model id this provider serves, when it is one free lane. */
  model?: string
  /** The model family this provider belongs to, when it is one free lane. */
  family?: string
  lane?: PublicLane
}

export type HealthRow = {
  provider_id: string
  status: string
  last_success_at: number | null
  last_failure_at: number | null
  last_error: string | null
  last_error_code: string | null
  latency_ms: number | null
  consecutive_failures: number
  last_checked_at: number | null
  next_probe_at: number | null
}

export type HealthResult = { ok: true; latencyMs: number } | { ok: false; code: string; message: string; latencyMs: number }

/** The providers this deployment can actually use, in picker order. */
export function providerDescriptors(env: Env): ProviderDescriptor[] {
  if (aiConfigured(env)) {
    return [{ id: 'freebuff-api', name: 'Freebuff API', description: env.OPENAI_BASE_URL ? 'OPENAI_BASE_URL is set' : 'Your OPENAI_API_KEY' }]
  }
  const seen = new Set<string>()
  const items: ProviderDescriptor[] = []
  for (const lane of publicLanes(env)) {
    const id = laneKey(lane)
    if (seen.has(id)) continue
    seen.add(id)
    items.push({ id, name: lane.label, description: lane.description, model: lane.model, family: familyForLane(lane), lane })
  }
  return items
}

export function mergeHealth(descriptors: ProviderDescriptor[], rows: HealthRow[]): ProviderHealth[] {
  const byId = new Map(rows.map((row) => [row.provider_id, row]))
  return descriptors.map((descriptor) => {
    const row = byId.get(descriptor.id)
    return {
      id: descriptor.id,
      name: descriptor.name,
      description: descriptor.description,
      ...(descriptor.model ? { model: descriptor.model } : {}),
      ...(descriptor.family ? { family: descriptor.family } : {}),
      status: normaliseStatus(row?.status),
      lastSuccessAt: row?.last_success_at ?? null,
      lastFailureAt: row?.last_failure_at ?? null,
      lastError: row?.last_error ?? null,
      lastErrorCode: row?.last_error_code ?? null,
      latencyMs: row?.latency_ms ?? null,
      consecutiveFailures: Number(row?.consecutive_failures ?? 0),
      lastCheckedAt: row?.last_checked_at ?? null,
      nextProbeAt: row?.next_probe_at ?? null,
    }
  })
}

function normaliseStatus(value: string | undefined): ProviderStatus {
  return value === 'healthy' || value === 'degraded' || value === 'down' ? value : 'unknown'
}

export async function healthRows(db: D1Database, owner: string): Promise<HealthRow[]> {
  const rows = await db.prepare(`SELECT * FROM provider_health WHERE owner_sub = ?`).bind(owner).all()
  return rows.results as unknown as HealthRow[]
}

/**
 * Writes one observation. A success clears the failure streak and the error;
 * a failure raises the status and schedules the next allowed probe further out.
 */
export async function recordProviderResult(db: D1Database, owner: string, providerId: string, result: HealthResult): Promise<void> {
  const at = Date.now()
  const existing = await db
    .prepare(`SELECT * FROM provider_health WHERE owner_sub = ? AND provider_id = ?`)
    .bind(owner, providerId)
    .first<HealthRow>()
  let status: ProviderStatus
  let failures: number
  let lastSuccessAt = existing?.last_success_at ?? null
  let lastFailureAt = existing?.last_failure_at ?? null
  let lastError = existing?.last_error ?? null
  let lastErrorCode = existing?.last_error_code ?? null
  let nextProbeAt: number
  if (result.ok) {
    status = 'healthy'
    failures = 0
    lastSuccessAt = at
    lastError = null
    lastErrorCode = null
    nextProbeAt = at + HEALTH_TTL
  } else {
    failures = Number(existing?.consecutive_failures ?? 0) + 1
    status = failures >= DOWN_AFTER && !TRANSIENT_FAILURES.has(result.code) ? 'down' : 'degraded'
    lastFailureAt = at
    lastError = result.message.slice(0, 200)
    lastErrorCode = result.code
    nextProbeAt = at + Math.min(BACKOFF_BASE * 2 ** (failures - 1), BACKOFF_MAX)
  }
  await db
    .prepare(
      `INSERT INTO provider_health
         (owner_sub, provider_id, status, last_success_at, last_failure_at, last_error, last_error_code,
          latency_ms, consecutive_failures, last_checked_at, next_probe_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(owner_sub, provider_id) DO UPDATE SET
         status = excluded.status,
         last_success_at = excluded.last_success_at,
         last_failure_at = excluded.last_failure_at,
         last_error = excluded.last_error,
         last_error_code = excluded.last_error_code,
         latency_ms = excluded.latency_ms,
         consecutive_failures = excluded.consecutive_failures,
         last_checked_at = excluded.last_checked_at,
         next_probe_at = excluded.next_probe_at,
         updated_at = excluded.updated_at`,
    )
    .bind(owner, providerId, status, lastSuccessAt, lastFailureAt, lastError, lastErrorCode, result.latencyMs, failures, at, nextProbeAt, at)
    .run()
}

/** One bounded probe: the API's model catalog, or one short lane completion. */
export async function probeProvider(descriptor: ProviderDescriptor, env: Env): Promise<HealthResult> {
  const startedAt = Date.now()
  const timeout = AbortSignal.timeout(PROBE_TIMEOUT)
  if (!descriptor.lane) {
    const base = (env.OPENAI_BASE_URL || FREEBUFF_API_URL).replace(/\/$/, '')
    try {
      const response = await fetch(`${base}/models`, {
        headers: env.OPENAI_API_KEY ? { authorization: `Bearer ${env.OPENAI_API_KEY}` } : {},
        signal: timeout,
      })
      const latencyMs = Date.now() - startedAt
      if (!response.ok) return { ok: false, code: `http_${response.status}`, message: `The API returned ${response.status}.`, latencyMs }
      return { ok: true, latencyMs }
    } catch (error) {
      const latencyMs = Date.now() - startedAt
      return { ok: false, code: timeout.aborted ? 'timeout' : 'network', message: timeout.aborted ? 'The probe timed out.' : 'Could not reach the API.', latencyMs }
    }
  }
  try {
    await laneText(descriptor.lane, {
      messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
      maxTokens: 16,
      temperature: 0,
      signal: timeout,
    })
    return { ok: true, latencyMs: Date.now() - startedAt }
  } catch (error) {
    const latencyMs = Date.now() - startedAt
    if (error instanceof AiError) {
      // A probe timeout is reported by laneText as an abort because its caller
      // supplied the deadline signal. Keep that from looking like a user stop.
      if (timeout.aborted && error.code === 'aborted') {
        return { ok: false, code: 'timeout', message: 'The probe timed out.', latencyMs }
      }
      return { ok: false, code: error.code, message: error.message, latencyMs }
    }
    return { ok: false, code: timeout.aborted ? 'timeout' : 'probe_failed', message: timeout.aborted ? 'The probe timed out.' : 'The probe failed.', latencyMs }
  }
}

/**
 * Probes the provider the caller named, or the ones that are due. A normal
 * refresh is bounded to MAX_PROBES_PER_REQUEST; an explicit all-provider check
 * refreshes every lane that is not already healthy. A forced check bypasses the
 * backoff.
 */
export async function probeProviders(
  db: D1Database,
  owner: string,
  env: Env,
  options: { id?: string; force?: boolean; all?: boolean } = {},
): Promise<{ probed: string[]; backedOff: boolean }> {
  const descriptors = providerDescriptors(env)
  const rows = await healthRows(db, owner)
  const byId = new Map(rows.map((row) => [row.provider_id, row]))
  let targets: ProviderDescriptor[]
  if (options.id) {
    const match = descriptors.find((descriptor) => descriptor.id === options.id)
    if (!match) return { probed: [], backedOff: false }
    targets = [match]
  } else if (options.all) {
    // Only refresh what is not already known to be working. Healthy lanes keep
    // their last success, and a bulk check does not waste calls on them.
    targets = descriptors.filter((descriptor) => {
      const row = byId.get(descriptor.id)
      return !row || row.status !== 'healthy'
    })
  } else {
    const at = Date.now()
    const due = (descriptor: ProviderDescriptor) => {
      const row = byId.get(descriptor.id)
      if (!row || row.next_probe_at === null) return true
      return row.next_probe_at <= at
    }
    // A forced check is the person asking now; it still stays bounded unless
    // they explicitly asked for every unhealthy provider.
    targets = (options.force ? descriptors : descriptors.filter(due)).slice(0, MAX_PROBES_PER_REQUEST)
  }
  if (!targets.length) {
    // Everything is resting: report that instead of hammering a dead provider.
    return { probed: [], backedOff: rows.some((row) => row.next_probe_at !== null && row.next_probe_at > Date.now()) }
  }
  const queue = [...targets]
  await Promise.all(
    Array.from({ length: Math.min(PROBE_CONCURRENCY, queue.length) }, async () => {
      while (queue.length) {
        const descriptor = queue.shift()
        if (!descriptor) return
        const result = await probeProvider(descriptor, env)
        await recordProviderResult(db, owner, descriptor.id, result)
      }
    }),
  )
  return { probed: targets.map((descriptor) => descriptor.id), backedOff: false }
}
