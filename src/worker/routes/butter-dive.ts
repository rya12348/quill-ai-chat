import { Hono, type Context } from 'hono'

import type { AppContext } from '../env'
import { diveDay, rateDiveAnswer } from '../butter-dive-bank'

/**
 * The Daily Dive — Butter's seven-prompt dive.
 *
 * The dive is Krillion's other half, so its questions have to be *today's*
 * questions and its rarity verdicts the shipped ones. `/today` reads the real
 * card and `/answer` rates against the same card, which is what makes "Name a
 * movie that's at least two and a half hours long" score the same way here as
 * it does there.
 *
 * The local deck in `butter-dive-bank.ts` is the fallback: if krillion.io is
 * unreachable the dive still deals seven cards of its own rather than a dead
 * screen. A response carries `source` so the answer that follows is rated
 * against the deck it was dealt from.
 */

const SOURCE = 'https://krillion.io'

export const butterDive = new Hono<AppContext>()

function crossSite(c: Context<AppContext>): boolean {
  const origin = c.req.header('origin')
  if (!origin) return false
  try {
    return new URL(origin).host !== new URL(c.req.url).host
  } catch {
    return true
  }
}

async function upstream(path: string, init: RequestInit = {}): Promise<Response | null> {
  try {
    return await fetch(`${SOURCE}${path}`, {
      ...init,
      cache: 'no-store',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        // Their edge answers a bare request; naming ourselves keeps the call
        // legible in their logs rather than looking like a browser.
        'user-agent': 'Ink-Butter-Dive/1.0 (+https://www.inkbrowser.dpdns.org/butter)',
        ...((init.headers as Record<string, string> | undefined) ?? {}),
      },
    })
  } catch {
    return null
  }
}

/** Today's seven prompts: the real card first, the local deck if it is down. */
butterDive.get('/today', async (c) => {
  const res = await upstream('/api/today')
  if (res?.ok) {
    const body = (await res.json().catch(() => null)) as
      | { date?: string; dayNumber?: number; resetsAt?: string; prompts?: { id: string; text: string }[] }
      | null
    if (body && Array.isArray(body.prompts) && body.prompts.length === 7) {
      return c.json({ ...body, source: 'live' }, 200, { 'cache-control': 'no-store' })
    }
  }
  return c.json({ ...diveDay(), source: 'local' }, 200, { 'cache-control': 'no-store' })
})

/**
 * Rate one answer against one prompt. The reply is the shape the dive draws:
 * `accepted` + `tier` + `score`, a `correction` when the word is a near miss,
 * or a `rejectionReason` when it is not on the card at all.
 */
butterDive.post('/answer', async (c) => {
  if (crossSite(c)) return c.json({ error: 'Cross-site request refused.' }, 403)
  const body = (await c.req.json().catch(() => ({}))) as {
    date?: string
    promptId?: string
    answer?: string
    playerId?: string
    runId?: string
    via?: string
  }
  const promptId = String(body.promptId ?? '')
  const answer = String(body.answer ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40)
  if (!/^p[1-7]$/.test(promptId)) return c.json({ error: 'Bad prompt' }, 400)
  if (!answer) return c.json({ error: 'Type an answer first.' }, 400)

  if (body.via !== 'local') {
    const date = String(body.date ?? '')
    const playerId = String(body.playerId ?? '')
    const runId = String(body.runId ?? '')
    // The live card only scores a dated, player-tagged run.
    if (/^\d{4}-\d{2}-\d{2}$/.test(date) && playerId && runId) {
      const res = await upstream('/api/submit', {
        method: 'POST',
        body: JSON.stringify({ date, promptId, answer, playerId, runId }),
      })
      if (res?.ok) {
        const rating = await res.json().catch(() => null)
        if (rating) return c.json(rating, 200, { 'cache-control': 'no-store' })
      }
      // The card came from the real game, so a local verdict would be a verdict
      // on a different prompt. Better to say the signal was lost.
      return c.json({ error: 'The dive is not taking answers right now.' }, 502)
    }
  }
  return c.json(rateDiveAnswer(promptId, answer), 200, { 'cache-control': 'no-store' })
})
