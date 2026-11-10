// A small, conservative learning loop for the free-lane and depth routers. The
// hand-written heuristic still decides the cold start; this only nudges it after
// the owner has several observed outcomes. Nothing here stores prompt or answer
// text: Proof rows contribute model labels and a pass/fail, ratings contribute
// the private route metadata (lane keys, depth and context) saved with the reply.
//
// This is deliberately not a neural router. With a small number of free replies,
// a simple smoothed pass rate is more stable, auditable and cheap to run in a
// Worker than a model that would need its own training and deployment pipeline.

import type { ProofKind } from '../shared/types'
import { laneKey, type PublicLane } from './public-ai'

export type LaneRecord = { wins: number; losses: number }
export type LaneDepth = 'quick' | 'standard' | 'deep'

/** The internal keys behind one blended reply, for later rating attribution. */
export type LaneRoute = {
  depth: LaneDepth
  drafters: string[]
  referee?: string
  verifier?: string
}

/** What is stored with a reply: the route plus the context a later rating needs. */
export type StoredLaneRoute = LaneRoute & {
  kind: ProofKind
  bucket: string
}

const LOOKBACK = 180 * 24 * 60 * 60_000
const MAX_ROWS = 240

/**
 * A Beta-style posterior. No evidence is neutral; fewer than three observations
 * cannot move the score at all. A lane needs a real streak before it can take
 * the referee chair from a stronger model.
 */
export function laneQuality(record?: LaneRecord): number {
  const wins = Math.max(0, record?.wins ?? 0)
  const losses = Math.max(0, record?.losses ?? 0)
  const total = wins + losses
  if (total < 3) return 0.5
  return (wins + 1) / (total + 2)
}

/** A measured nudge of at most 15 points on top of the static capability prior. */
export function routingScore(base: number, record?: LaneRecord): number {
  const total = Math.max(0, record?.wins ?? 0) + Math.max(0, record?.losses ?? 0)
  const confidence = Math.min(1, total / 8)
  return base + (laneQuality(record) - 0.5) * 30 * confidence
}

const DEPTHS: LaneDepth[] = ['quick', 'standard', 'deep']
const MIN_DEPTH_SAMPLES = 3
const EXPLORE_EVERY = 12

/** A length band keeps a one-line quick reply from deciding a longer task. */
export function depthBucket(text: string): string {
  const length = text.trim().length
  return length <= 200 ? 'short' : length <= 320 ? 'medium' : 'long'
}

function depthTotal(record?: LaneRecord): number {
  return Math.max(0, record?.wins ?? 0) + Math.max(0, record?.losses ?? 0)
}

function depthHash(text: string): number {
  let hash = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function adjacentDepth(baseline: LaneDepth, missing: LaneDepth[]): LaneDepth | undefined {
  if (baseline === 'quick' || baseline === 'deep') {
    return missing.includes('standard') ? 'standard' : undefined
  }
  return missing.includes('quick') ? 'quick' : missing.includes('deep') ? 'deep' : undefined
}

/**
 * The regex heuristic is the cold-start prior. Once one depth has three rated
 * outcomes in the same task family and length band, its measured quality can
 * replace the prior. A small deterministic exploration slice collects a
 * missing arm; without it the baseline would be the only depth ever tried.
 *
 * Faster depths win ties within five quality points, and a depth with a poor
 * record never replaces the baseline just because it has a sample.
 */
export function chooseDepth(
  text: string,
  baseline: LaneDepth,
  records: ReadonlyMap<LaneDepth, LaneRecord>,
  explore = true,
): LaneDepth {
  // Do not turn greetings and one-line factual questions into an expensive
  // team pass just because the user happened to rate a longer reply well.
  if (text.trim().length <= 40) return baseline

  const missing = DEPTHS.filter((depth) => depthTotal(records.get(depth)) < MIN_DEPTH_SAMPLES)
  const sampled = DEPTHS.some((depth) => depthTotal(records.get(depth)) >= MIN_DEPTH_SAMPLES)
  if (explore && sampled && missing.length && depthHash(text) % EXPLORE_EVERY === 0) {
    const alternate = adjacentDepth(baseline, missing)
    if (alternate) return alternate
  }

  const eligible = DEPTHS.filter((depth) => depthTotal(records.get(depth)) >= MIN_DEPTH_SAMPLES)
  if (!eligible.length) return baseline
  const quality = (depth: LaneDepth) => laneQuality(records.get(depth))
  const positive = eligible.filter((depth) => quality(depth) >= 0.6)
  if (!positive.length) return baseline
  const best = Math.max(...positive.map((depth) => quality(depth)))
  const close = positive.filter((depth) => quality(depth) >= best - 0.05)
  return DEPTHS.find((depth) => close.includes(depth)) ?? baseline
}

function add<K extends string>(records: Map<K, LaneRecord>, keys: Iterable<K>, win: boolean, weight: number): void {
  if (weight <= 0) return
  for (const key of new Set(keys)) {
    const current = records.get(key) ?? { wins: 0, losses: 0 }
    if (win) current.wins += weight
    else current.losses += weight
    records.set(key, current)
  }
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
    .map((item) => item.trim())
}

/**
 * Reads outcome labels and private lane keys only. Proof results are the strong
 * signal because tests, arithmetic and citations are checked deterministically.
 * Ratings are weaker but cover ordinary chat, where Proof does not run.
 *
 * Every query is best-effort: a missing table or an old row must never block a
 * reply. The caller can pass an empty map and the blend behaves exactly as it
 * did before this feature existed.
 */
export async function loadLaneQuality(
  db: D1Database,
  owner: string,
  lanes: PublicLane[],
  kind: ProofKind,
): Promise<Map<string, LaneRecord>> {
  const records = new Map<string, LaneRecord>()
  const byLabel = new Map<string, string[]>()
  for (const lane of lanes) {
    const keys = byLabel.get(lane.label) ?? []
    keys.push(laneKey(lane))
    byLabel.set(lane.label, keys)
  }
  const since = Date.now() - LOOKBACK

  try {
    const rows = await db
      .prepare(
        `SELECT kind, outcome, models FROM proof_runs
         WHERE owner_sub = ? AND created_at >= ?
         ORDER BY created_at DESC LIMIT ?`,
      )
      .bind(owner, since, MAX_ROWS)
      .all<{ kind: string; outcome: string; models: string }>()
    for (const row of rows.results) {
      // A warning or unverified result means the checker could not decide, not
      // that the model was wrong. Only a real pass or a real failure teaches us.
      if (row.outcome !== 'verified' && row.outcome !== 'failed') continue
      let labels: unknown
      try {
        labels = JSON.parse(row.models)
      } catch {
        continue
      }
      const keys = stringArray(labels).flatMap((label) => byLabel.get(label) ?? [])
      // The same task family is stronger evidence than a pass in another mode.
      add(records, keys, row.outcome === 'verified', row.kind === kind ? 1 : 0.25)
    }
  } catch {
    // Routing is an enhancement, not a dependency of answering.
  }

  try {
    const rows = await db
      .prepare(
        `SELECT f.rating, r.content AS route
         FROM message_feedback f
         JOIN message_lane_routes r ON r.message_id = f.message_id AND r.owner_sub = f.owner_sub
         WHERE f.owner_sub = ? AND f.created_at >= ?
         ORDER BY f.created_at DESC LIMIT ?`,
      )
      .bind(owner, since, MAX_ROWS)
      .all<{ rating: string; route: string }>()
    for (const row of rows.results) {
      if (row.rating !== 'up' && row.rating !== 'down') continue
      let route: { drafters?: unknown; referee?: unknown; verifier?: unknown }
      try {
        const parsed = JSON.parse(row.route) as unknown
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue
        route = parsed as typeof route
      } catch {
        continue
      }
      const keys = [
        ...stringArray(route.drafters),
        ...(typeof route.referee === 'string' ? [route.referee] : []),
        ...(typeof route.verifier === 'string' ? [route.verifier] : []),
      ]
      add(records, keys, row.rating === 'up', 1)
    }
  } catch {
    // Ratings are optional and older replies have no route row.
  }

  return records
}

/**
 * How each depth performed for the same task family and request length. Only
 * ratings are used here because Proof checks a separate path; with fewer than
 * three observations the caller keeps the regex prior.
 */
export async function loadDepthQuality(
  db: D1Database,
  owner: string,
  kind: ProofKind,
  bucket: string,
): Promise<Map<LaneDepth, LaneRecord>> {
  const records = new Map<LaneDepth, LaneRecord>()
  try {
    const rows = await db
      .prepare(
        `SELECT f.rating, r.content AS route
         FROM message_feedback f
         JOIN message_lane_routes r ON r.message_id = f.message_id AND r.owner_sub = f.owner_sub
         WHERE f.owner_sub = ? AND f.created_at >= ?
         ORDER BY f.created_at DESC LIMIT ?`,
      )
      .bind(owner, Date.now() - LOOKBACK, MAX_ROWS)
      .all<{ rating: string; route: string }>()
    for (const row of rows.results) {
      if (row.rating !== 'up' && row.rating !== 'down') continue
      let route: { depth?: unknown; kind?: unknown; bucket?: unknown }
      try {
        const parsed = JSON.parse(row.route) as unknown
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue
        route = parsed as typeof route
      } catch {
        continue
      }
      if (route.kind !== kind || route.bucket !== bucket) continue
      const depth = route.depth
      if (depth !== 'quick' && depth !== 'standard' && depth !== 'deep') continue
      add(records, [depth], row.rating === 'up', 1)
    }
  } catch {
    // No rating history means the caller keeps the heuristic.
  }
  return records
}
