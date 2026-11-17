// A selected model can be temporarily unusable because its provider's daily
// free quota is exhausted, not because the model is gone. Keep the selection
// working with a capable hosted lane until the exact route recovers.
//
// This is deliberately narrow: only the models below get an alias, and only
// when the exact lane is down or rate-limited. A paid lane is never chosen for
// a free selection, and another :free OpenRouter lane is not a fallback when
// OpenRouter itself is out of free requests for the day.

import type { HealthRow } from './provider-health'
import { laneKey, laneStrength, type PublicLane } from './public-ai'

const OPENROUTER_HOST = 'openrouter.ai'

// Earlier entries are better matches. ERNIE is a tool-use model; Particle-1 is
// a coding model post-trained on DeepSeek V4.1 Flash, so those are the first
// healthy choices for each.
const FALLBACK_PREFERENCES: Record<string, RegExp[]> = {
  'baidu/ernie-5.5-flash-preview:free': [/nemotron-3-ultra/i, /command-a-plus/i, /qwen3\.8/i],
  'particle-ai/particle-1:free': [/nemotron-3-ultra/i, /command-a-plus/i, /qwen3\.8/i],
}

// One shared replacement for the two quota-bound OpenRouter rows. The primary
// and both backups live on different providers, so one account's daily limit
// cannot take all three down at once.
export const REPLACEMENT_MODELS = [
  'nvidia/nemotron-3-ultra-550b-a55b',
  'command-a-plus-05-2026',
  'qwen/qwen3.8-27b',
] as const

const replacementPreferences: RegExp[] = [/nemotron-3-ultra/i, /command-a-plus/i, /qwen3\.8/i]

/** The first configured lane in the shared replacement ladder, regardless of health. */
export function replacementLane(lanes: PublicLane[]): PublicLane | undefined {
  for (const model of REPLACEMENT_MODELS) {
    const lane = lanes.find((candidate) => candidate.model === model && candidate.billing !== 'paid')
    if (lane) return lane
  }
  return undefined
}

/** Short names for the three rows, suitable for the picker description. */
export function replacementLabels(lanes: PublicLane[]): string[] {
  return REPLACEMENT_MODELS.map((model) => lanes.find((lane) => lane.model === model))
    .filter((lane): lane is PublicLane => Boolean(lane))
    .map((lane) => cleanLabel(lane.label))
}

export type ModelFallback = {
  lane: PublicLane
  /** A short name for the picker, without the provider suffix. */
  label: string
  /** Why the exact lane is resting, suitable for a picker row. */
  reason: string
}

const cleanLabel = (label: string) => label.replace(/\s*\([^)]*\)\s*$/, '').trim() || label
const isOpenRouter = (lane: PublicLane) => {
  try {
    return new URL(lane.url).host === OPENROUTER_HOST
  } catch {
    return false
  }
}

export function isUnavailableHealth(row: HealthRow | undefined): boolean {
  return Boolean(
    row &&
      (row.status === 'down' ||
        row.last_error_code === 'quota' ||
        row.last_error_code === 'invalid_key' ||
        row.last_error_code === 'unavailable' ||
        row.last_error_code === 'empty'),
  )
}

/**
 * Pick one healthy non-OpenRouter lane for a selected model whose exact route
 * is down. Returns undefined when the exact lane is healthy, the model has no
 * fallback policy, or no suitable lane is available.
 */
export function fallbackForUnavailableModel(
  model: string,
  lanes: PublicLane[],
  health: HealthRow[],
): ModelFallback | undefined {
  const preferences = FALLBACK_PREFERENCES[model] ?? (REPLACEMENT_MODELS.includes(model as (typeof REPLACEMENT_MODELS)[number]) ? replacementPreferences : undefined)
  if (!preferences) return undefined
  const exact = lanes.find((lane) => lane.model === model)
  if (!exact) return undefined
  const byLane = new Map(health.map((row) => [row.provider_id, row]))
  const exactHealth = byLane.get(laneKey(exact))
  if (!isUnavailableHealth(exactHealth)) return undefined

  // OpenRouter's free limit is account-wide, so another :free OpenRouter route
  // would fail in exactly the same way. A paid route must never inherit a free
  // selection.
  const candidates = lanes.filter(
    (lane) =>
      lane.model !== model &&
      lane.billing !== 'paid' &&
      !isOpenRouter(lane) &&
      !isUnavailableHealth(byLane.get(laneKey(lane))),
  )
  if (!candidates.length) return undefined

  const rank = (lane: PublicLane): number => {
    const row = byLane.get(laneKey(lane))
    const status = row?.status === 'healthy' ? 0 : row?.status === 'unknown' ? 1 : 2
    const preference = preferences.findIndex((pattern) => pattern.test(`${lane.model} ${lane.label}`))
    const choice = preference < 0 ? preferences.length : preference
    return status * 1_000_000 + choice * 10_000 + (1_000 - Math.min(1_000, laneStrength(lane.model, lane.url)))
  }
  const lane = [...candidates].sort((a, b) => rank(a) - rank(b))[0]
  if (!lane) return undefined
  return {
    lane,
    label: cleanLabel(lane.label),
    reason: exactHealth?.last_error?.trim() || `${cleanLabel(exact.label)} is temporarily rate-limited.`,
  }
}

/** A picker-facing value for the fallback, or undefined when the exact route is healthy. */
export function fallbackLabelFor(model: string, lanes: PublicLane[], health: HealthRow[]): string | undefined {
  return fallbackForUnavailableModel(model, lanes, health)?.label
}
