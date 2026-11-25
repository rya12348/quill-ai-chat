import { Hono, type Context } from 'hono'

import type { AppContext } from '../env'

/**
 * The themed packs and the endless dive.
 *
 * Krillion's client walks a pack by number: `/api/packs/<pack>/<game>` deals the
 * seven rounds, `.../submit` rates one answer against that exact card,
 * `.../reveal` is the answer sheet behind it, and `.../complete` is the score
 * histogram. The original endless dive lives on the same shape under
 * `/api/unlimited/<game>`. Butter's packs are their packs, so every one of those
 * calls is forwarded with the body untouched: the version string, the receipts
 * and the tier verdicts are theirs, and a local copy would be a different game.
 */

const SOURCE = 'https://krillion.io'

/** The shipped pack ids. `classic` is the endless dive, which lives elsewhere. */
const PACKS = new Set(['classic', 'movies', 'sports', 'geography', 'lexicon'])

export const butterPacks = new Hono<AppContext>()

function crossSite(c: Context<AppContext>): boolean {
  const origin = c.req.header('origin')
  if (!origin) return false
  try {
    return new URL(origin).host !== new URL(c.req.url).host
  } catch {
    return true
  }
}

/** `/api/packs/movies/12` — or `/api/unlimited/12` for the endless dive. */
function pathFor(pack: string, game: string, tail = ''): string | null {
  if (!PACKS.has(pack) || !/^\d{1,4}$/.test(game)) return null
  const head = pack === 'classic' ? `/api/unlimited/${game}` : `/api/packs/${pack}/${game}`
  return `${head}${tail}`
}

async function upstream(path: string, init: RequestInit = {}): Promise<Response | null> {
  try {
    return await fetch(`${SOURCE}${path}`, {
      ...init,
      cache: 'no-store',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'user-agent': 'Ink-Butter-Packs/1.0 (+https://www.inkbrowser.dpdns.org/butter)',
        ...((init.headers as Record<string, string> | undefined) ?? {}),
      },
    })
  } catch {
    return null
  }
}

/** Hand their reply back as it arrived: a 404 carrying `lastGame` is how the
 *  client learns a pack has run out, and a 409 is a card that changed mid-run. */
async function pass(c: Context<AppContext>, res: Response | null) {
  if (!res) return c.json({ error: 'The packs are out of reach right now.' }, 502, { 'cache-control': 'no-store' })
  const body = await res.text()
  return new Response(body, {
    status: res.status,
    headers: {
      'content-type': res.headers.get('content-type') ?? 'application/json',
      'cache-control': 'no-store',
    },
  })
}

/** The seven rounds of one pack, with `lastGame` and the card's `version`. */
butterPacks.get('/:pack/:game', async (c) => {
  const path = pathFor(c.req.param('pack'), c.req.param('game'))
  if (!path) return c.json({ error: 'Bad pack' }, 400)
  return pass(c, await upstream(path))
})

/** The answer sheet behind a played pack: every answer, tier and quip. */
butterPacks.get('/:pack/:game/reveal', async (c) => {
  const path = pathFor(c.req.param('pack'), c.req.param('game'), '/reveal')
  if (!path) return c.json({ error: 'Bad pack' }, 400)
  return pass(c, await upstream(path))
})

/** Rate one answer. Their `{ round, answer, previewCorrection, version,
 *  playerId, runId }` goes through as sent; the receipt that comes back is what
 *  the completion call counts, so it is never rebuilt here. */
butterPacks.post('/:pack/:game/submit', async (c) => {
  if (crossSite(c)) return c.json({ error: 'Cross-site request refused.' }, 403)
  const path = pathFor(c.req.param('pack'), c.req.param('game'), '/submit')
  if (!path) return c.json({ error: 'Bad pack' }, 400)
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body || typeof body.round !== 'string' || typeof body.answer !== 'string') {
    return c.json({ error: 'Bad request' }, 400)
  }
  return pass(
    c,
    await upstream(path, {
      method: 'POST',
      body: JSON.stringify({
        round: body.round,
        answer: String(body.answer).slice(0, 256),
        previewCorrection: Boolean(body.previewCorrection),
        version: String(body.version ?? ''),
        playerId: String(body.playerId ?? ''),
        runId: String(body.runId ?? ''),
      }),
    }),
  )
})

/** Where this run landed among everyone's first runs on the same pack. */
butterPacks.post('/:pack/:game/complete', async (c) => {
  if (crossSite(c)) return c.json({ error: 'Cross-site request refused.' }, 403)
  const path = pathFor(c.req.param('pack'), c.req.param('game'), '/complete')
  if (!path) return c.json({ error: 'Bad pack' }, 400)
  const body = (await c.req.json().catch(() => null)) as
    | { playerId?: string; score?: number; receipts?: unknown; runId?: string; version?: string }
    | null
  const receipts = Array.isArray(body?.receipts) ? body.receipts.filter((item) => typeof item === 'string') : []
  if (!body || typeof body.score !== 'number' || receipts.length !== 7) {
    return c.json({ error: 'Bad request' }, 400)
  }
  return pass(
    c,
    await upstream(path, {
      method: 'POST',
      body: JSON.stringify({
        playerId: String(body.playerId ?? ''),
        score: Math.round(body.score),
        receipts,
        ...(body.runId ? { runId: String(body.runId) } : {}),
        ...(body.version ? { version: String(body.version) } : {}),
      }),
    }),
  )
})
