// Search planning: when a question needs current facts, one small planning
// call turns it into a few focused searches instead of one blind query. The
// first round is merged and deduplicated; a single refinement round runs only
// when that round was thin. Every part is optional and bounded: a slow, broken
// or empty search never fails the reply, it only adds a notice.
//
// Budgets (per turn):
// - at most 2 planning/refinement model calls, 3 + 2 queries, 5 searches
// - 6s per planning call, 4s per search, 12s overall
// - refinement only while the deadline has room and the first round found < 3

import { completeText, type ChatMessage } from './ai'
import type { Env } from './env'
import { activeLanes, laneText, type LaneResult, type PublicLane } from './public-ai'
import { fetchSearch, type SearchResult } from './search'
import type { ModelId } from '../shared/config'

const MAX_QUERIES = 3
const MAX_REFINED_QUERIES = 2
const MAX_SEARCHES = 5
const MAX_RESULTS = 8
const PLAN_TIMEOUT = 6_000
const SEARCH_TIMEOUT = 4_000
const PLANNING_DEADLINE = 12_000

const PLANNER = `You are the search planner for a chat assistant. Today is ${new Date().toISOString().slice(0, 10)} (UTC). Decide which web searches, if any, would let the assistant answer my last message well. Write focused keyword queries, not full sentences, and at most ${MAX_QUERIES} of them. For "latest", "current", price, release or news questions, put the current year (${new Date().getUTCFullYear()}) in at least one query and prefer official sources. Do not answer the question yourself.
Respond with JSON only, no prose and no code fence: {"queries":["first query","second query"]}`

const REFINER = `You are refining web searches for a chat assistant. Today is ${new Date().toISOString().slice(0, 10)} (UTC). The first round was thin. Look at what came back and write up to ${MAX_REFINED_QUERIES} new queries that fill the gaps. For current-product/current-event questions, include the current year (${new Date().getUTCFullYear()}) and prefer newer official sources. Do not repeat a query that already ran. Do not answer the question.
Respond with JSON only, no prose and no code fence: {"queries":["new query"]}`

export type RetrievalOutcome = {
  results: SearchResult[]
  /** Every query actually sent, in order, for logs and tests. */
  queries: string[]
  /** A non-fatal message for the reader when nothing usable came back. */
  notice: string | null
}

/** Pulls {"queries":[...]} out of a small model reply, tolerating prose. */
export function parseQueries(text: string, max: number): string[] {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) return []
  let body: unknown
  try {
    body = JSON.parse(text.slice(start, end + 1))
  } catch {
    return []
  }
  const list = body && typeof body === 'object' ? (body as { queries?: unknown }).queries : null
  if (!Array.isArray(list)) return []
  const queries: string[] = []
  const seen = new Set<string>()
  for (const item of list) {
    if (typeof item !== 'string') continue
    const query = item.replace(/\s+/g, ' ').trim().slice(0, 120)
    const key = query.toLowerCase()
    if (!query || seen.has(key)) continue
    seen.add(key)
    queries.push(query)
    if (queries.length === max) break
  }
  return queries
}

type PlannerInput = {
  env: Env
  model: ModelId
  usingApi: boolean
  lanes: PublicLane[]
  messages: ChatMessage[]
  signal: AbortSignal
  onLaneResult?: (result: LaneResult) => void
}

/** One planning call, API or free lane. Any failure yields no queries. */
async function askPlanner(input: PlannerInput, max: number): Promise<string[]> {
  const call = AbortSignal.any([input.signal, AbortSignal.timeout(PLAN_TIMEOUT)])
  if (input.usingApi) {
    try {
      const text = await completeText(input.env, { model: input.model, messages: input.messages, signal: call, maxTokens: 180 })
      return parseQueries(text, max)
    } catch {
      return []
    }
  }
  // The free lanes take turns; two attempts keep the stage short.
  for (const lane of activeLanes(input.lanes).slice(0, 2)) {
    if (call.aborted) return []
    try {
      const text = await laneText(lane, {
        messages: input.messages,
        signal: call,
        temperature: 0,
        maxTokens: 180,
        onLaneResult: input.onLaneResult,
      })
      return parseQueries(text, max)
    } catch {
      /* next lane */
    }
  }
  return []
}

/**
 * Plans and runs searches for one question. Never throws: the caller always
 * gets results (possibly none) and a notice to show when nothing was usable.
 */
export async function planAndRetrieve(input: {
  env: Env
  model: ModelId
  usingApi: boolean
  lanes: PublicLane[]
  question: string
  signal?: AbortSignal
  onLaneResult?: (result: LaneResult) => void
  onStatus?: (text: string) => Promise<unknown> | unknown
}): Promise<RetrievalOutcome> {
  const deadline = AbortSignal.timeout(PLANNING_DEADLINE)
  const signal = input.signal ? AbortSignal.any([input.signal, deadline]) : deadline
  const say = async (text: string) => {
    if (signal.aborted) return
    try {
      await input.onStatus?.(text)
    } catch {
      /* the reader is gone; the caller notices on its next write */
    }
  }
  const queries: string[] = []
  const results: SearchResult[] = []
  const seenUrls = new Set<string>()
  const seenTitles = new Set<string>()
  let attempts = 0
  let succeeded = 0
  let failed = 0

  const add = (items: SearchResult[]) => {
    for (const item of items) {
      const urlKey = item.url.replace(/\/$/, '').toLowerCase()
      const titleKey = item.title.toLowerCase().replace(/\s+/g, ' ').slice(0, 100)
      if (seenUrls.has(urlKey) || seenTitles.has(titleKey)) continue
      seenUrls.add(urlKey)
      seenTitles.add(titleKey)
      results.push(item)
      if (results.length === MAX_RESULTS) return
    }
  }

  const runRound = async (roundQueries: string[]) => {
    const allowed = roundQueries.slice(0, Math.min(MAX_QUERIES, MAX_SEARCHES - attempts))
    if (!allowed.length) return
    for (let i = 0; i < allowed.length; i += 1) {
      await say(allowed.length > 1 ? `Searching: ${allowed[i]} (${i + 1} of ${allowed.length})` : `Searching: ${allowed[i]}`)
    }
    const settled = await Promise.allSettled(
      allowed.map((query) => {
        attempts += 1
        queries.push(query)
        const budget = AbortSignal.any([signal, AbortSignal.timeout(SEARCH_TIMEOUT)])
        return fetchSearch(input.env, query, budget)
      }),
    )
    for (const outcome of settled) {
      if (outcome.status !== 'fulfilled') {
        failed += 1
        continue
      }
      if (outcome.value.ok) succeeded += 1
      else failed += 1
      add(outcome.value.results)
    }
  }

  try {
    await say('Planning a search…')
    const planned = await askPlanner(
      {
        env: input.env,
        model: input.model,
        usingApi: input.usingApi,
        lanes: input.lanes,
        messages: [
          { role: 'system', content: PLANNER },
          { role: 'user', content: input.question.slice(0, 2_000) },
        ],
        signal,
        onLaneResult: input.onLaneResult,
      },
      MAX_QUERIES,
    )
    // A planner that fails or answers in prose still gets one honest query.
    const first = planned.length ? planned : [input.question.replace(/\s+/g, ' ').trim().slice(0, 120)]
    await say(`Plan: ${first.join(' · ')}`)
    await runRound(first)

    // One refinement round, only when the first found little and time remains.
    if (!signal.aborted && succeeded > 0 && results.length < 3 && attempts < MAX_SEARCHES) {
      await say('Refining the search…')
      const evidence =
        results
          .slice(0, 4)
          .map((result) => `- ${result.title}: ${result.snippet.slice(0, 160)}`)
          .join('\n') || '- nothing useful'
      const refined = await askPlanner(
        {
          env: input.env,
          model: input.model,
          usingApi: input.usingApi,
          lanes: input.lanes,
          messages: [
            { role: 'system', content: REFINER },
            {
              role: 'user',
              content: `Question: ${input.question.slice(0, 1_500)}\nQueries already run: ${queries.join(' | ')}\nWhat came back:\n${evidence}`,
            },
          ],
          signal,
          onLaneResult: input.onLaneResult,
        },
        MAX_REFINED_QUERIES,
      )
      if (refined.length && !signal.aborted) {
        await say(`Refined queries: ${refined.join(' · ')}`)
        await runRound(refined)
      }
    }
  } catch {
    /* planning is optional; fall through with whatever was gathered */
  }

  const notice = results.length
    ? null
    : failed > 0 && succeeded === 0
      ? 'Search is unavailable right now — answering without fresh sources.'
      : 'Search came back empty — answering from what I know.'
  return { results, queries, notice }
}
