/**
 * The full answer list behind a party card.
 *
 * The bundled bank is a sample: the real cards run from a handful of answers to
 * nearly a hundred thousand, and all of them together are 1.8M answers — far
 * more than the Pages worker may carry. So each card ships as its own static
 * file under `/puffer/cards/`, written by `tmp/puffer/split-cards.mjs`, and this
 * module fetches the one card the table is playing and keeps it for the isolate.
 *
 * The shape is the same `{ prompt, answers, tiers }` the bundled bank uses, so
 * every rating path treats a full card exactly like a sampled one — with the
 * real tier of every answer.
 */

import type { ButterTier, ButterTopic } from './butter-topics'

/** Tier code → tier, the order `split-cards.mjs` writes. */
const DIGITS: ButterTier[] = ['plankton', 'tooclever', 'schooler', 'rare', 'deepcut', 'krillion']

/** How many cards one isolate keeps in memory. A table plays a few per game. */
const KEEP = 12

const cache = new Map<string, ButterTopic>()

/** The file name for a prompt: lower-case words, then a short hash of the
 *  prompt's own text, so two prompts that read alike never share a file. The
 *  generator writes exactly this. */
export function cardSlug(prompt: string): string {
  const words = String(prompt)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  let hash = 5381
  for (const character of String(prompt)) hash = ((hash * 33) ^ character.charCodeAt(0)) >>> 0
  return `${words}-${hash.toString(36)}`
}

/** A card already in this isolate, if it has been fetched before. */
export function cachedCard(prompt: string): ButterTopic | undefined {
  return cache.get(prompt)
}

/**
 * The card's full list, from the cache or from its static file. `null` means
 * "use the bundled sample": a missing file, a bad body or a network hiccup must
 * never stop a party.
 */
export async function fullCard(prompt: string, assets: Fetcher, origin: string): Promise<ButterTopic | null> {
  const hit = cache.get(prompt)
  if (hit) return hit
  try {
    const url = new URL(`/puffer/cards/${cardSlug(prompt)}.json`, origin)
    const res = await assets.fetch(url.toString())
    if (!res.ok) return null
    const body = (await res.json().catch(() => null)) as { a?: unknown; t?: unknown } | null
    const answers = Array.isArray(body?.a) ? (body?.a as unknown[]).map(String) : []
    if (!answers.length) return null
    const codes = String(body?.t ?? '')
    const tiers = answers.map((_, index) => DIGITS[Number(codes[index] ?? 2)] ?? 'schooler')
    const card: ButterTopic = { prompt, answers, tiers }
    if (cache.size >= KEEP) {
      const oldest = cache.keys().next().value
      if (oldest) cache.delete(oldest)
    }
    cache.set(prompt, card)
    return card
  } catch {
    return null
  }
}
