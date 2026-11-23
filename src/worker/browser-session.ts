import puppeteer from '@cloudflare/puppeteer'

/**
 * A real Chrome the coding agent can drive, through Cloudflare's Browser
 * Rendering binding.
 *
 * This is the same kind of browser the assistant uses on a person's own
 * machine: a page loads, it has buttons, clicking one changes what happens
 * next. It is not the Steel session behind `/api/browser/*` — AGENTS.md gives
 * that one to the AI Agent alone, and it is billed by the hour.
 *
 * Everything here is deliberately small: text, the labels of things that can be
 * clicked, and one action at a time. A model that can see the page and press
 * one thing per step can hold a conversation with a site, which is the whole
 * point — reading the HTML is not the same as using the page.
 */

export type BrowserSnapshot = { url: string; title: string; text: string }

/** What to do to the page's video. Everything is optional. */
export type VideoCommand = {
  play?: boolean
  mute?: boolean
  /** 1, 1.5, 2 … a lesson can be watched at double speed. */
  rate?: number
  /** Jump to this many seconds. */
  seek?: number
  /** Jump to the end, which is how a "watch the whole thing" wall is cleared. */
  end?: boolean
}

/**
 * A timed run of prompts on one page: a daily quiz, a ladder, a pack of rounds.
 *
 * The model supplies the knowledge (keywords and the answers it believes are true
 * and rare); the page supplies the clock. One action plays the whole run, because
 * a prompt that appears for 25 seconds cannot wait for a model call between every
 * round — that is what turned a 7-prompt dive into twenty actions and a timeout.
 */
export type QuizPlan = {
  /** `match` is a regular expression (or plain words) tested against the prompt. */
  answers?: { match: string; picks: string[] }[]
  fallback?: string[]
  /** How many prompts to play. Default 7. */
  rounds?: number
  /** How long the whole run may hold the page. Default 120 s, capped at 240 s. */
  budgetMs?: number
}

export type QuizResult = {
  ok: boolean
  detail: string
  /** The page itself said the run was over (not just the round count). */
  complete: boolean
  page: BrowserSnapshot
}

/** What the page's runner reports back, before it is written for the model. */
export type QuizPlayed = {
  steps?: { prompt?: string; answer?: string; tier?: string; pts?: number }[]
  complete?: boolean
  ended?: string
  done?: boolean
}

/** One transcript line per prompt, and whether the run finished. */
export function quizSummary(raw: QuizPlayed): { ok: boolean; complete: boolean; detail: string } {
  const steps = raw.steps ?? []
  const total = steps.reduce((sum, step) => sum + (Number(step.pts) || 0), 0)
  const lines = steps.map((step, index) => {
    const score = step.tier && step.tier !== 'missed' ? ` (${step.tier}, ${Number(step.pts) || 0} pts)` : ' (not scored)'
    return `${index + 1}. "${(step.prompt || '').slice(0, 70)}" → ${step.answer || '?'}${score}`
  })
  const outcome = raw.complete
    ? 'the run is complete'
    : raw.ended === 'timeout'
      ? 'it stopped at the time budget'
      : `it stopped at ${raw.ended || 'the next screen'}`
  return {
    ok: steps.length > 0,
    complete: Boolean(raw.complete),
    detail: `${steps.length} prompt${steps.length === 1 ? '' : 's'} played · ${total} pts · ${outcome}.${
      lines.length ? `\n${lines.join('\n')}` : ''
    }`,
  }
}

export type BrowserSessionLike = {
  open(url: string): Promise<BrowserSnapshot>
  read(): Promise<BrowserSnapshot>
  click(target: string): Promise<{ ok: boolean; detail: string; page: BrowserSnapshot }>
  type(text: string): Promise<{ ok: boolean; detail: string; page: BrowserSnapshot }>
  press(key: string): Promise<{ ok: boolean; detail: string; page: BrowserSnapshot }>
  /** Sits still for a timer or animation, then looks again. */
  wait(seconds: number): Promise<{ ok: boolean; detail: string; page: BrowserSnapshot }>
  /** Waits until the page says something, instead of guessing how long to sleep. */
  waitFor(target: string, seconds: number): Promise<{ ok: boolean; detail: string; page: BrowserSnapshot }>
  /** Reads and drives the page's video: play, mute, speed, jump. */
  video(command: VideoCommand): Promise<{ ok: boolean; detail: string; page: BrowserSnapshot }>
  /** Plays a whole timed run of prompts on one page, and returns its transcript. */
  autoplay(plan: QuizPlan): Promise<QuizResult>
  /** Moves the page: to a named thing, or by a number of pixels. */
  scroll(by: number, target: string): Promise<{ ok: boolean; detail: string; page: BrowserSnapshot }>
  back(): Promise<{ ok: boolean; detail: string; page: BrowserSnapshot }>
  /** A JPEG of the viewport, as a data URL, so the person can watch. */
  screenshot(): Promise<string>
  close(): Promise<void>
}

/** Characters of page text handed to the model in one look. */
export const BROWSER_TEXT_CHARS = 6_000
const NAV_TIMEOUT = 25_000
/** The longest a single wait may hold the turn. Long enough for a 25s clock. */
export const BROWSER_WAIT_MAX = 26

/**
 * Pulls the visible text and the labels of everything that looks clickable.
 * Both are done with string scripts so this file needs no DOM types: the Worker
 * has no `document`, only the page does.
 */
function snapshotScript(limit: number): string {
  return `(() => {
    const body = document.body
    const text = (body && body.innerText ? body.innerText : '').replace(/\\n{3,}/g, '\\n\\n').slice(0, ${limit})
    const nodes = Array.from(document.querySelectorAll('button, a, [role="button"], [onclick], input[type="submit"], input[type="button"], summary, label'))
    const labels = []
    for (const node of nodes) {
      const label = (node.innerText || node.value || node.getAttribute('aria-label') || node.getAttribute('title') || '').replace(/\\s+/g, ' ').trim()
      if (label && label.length <= 80 && labels.indexOf(label) === -1) labels.push(label)
      if (labels.length >= 40) break
    }
    const fields = Array.from(document.querySelectorAll('input:not([type="submit"]):not([type="button"]), textarea, [contenteditable="true"]'))
      .map((node) => node.getAttribute('placeholder') || node.getAttribute('name') || node.getAttribute('aria-label') || node.type || '')
      .filter(Boolean)
      .slice(0, 10)
    const passwords = document.querySelectorAll('input[type="password"]').length
    return JSON.stringify({ title: document.title, text, labels, fields, passwords })
  })()`
}

/**
 * The in-page runner for a timed sequence of prompts.
 *
 * It is deliberately page-agnostic: the prompt is read from the line above the
 * game's "rarer answers" rule (Krillion's measured shape) or, failing that, the
 * line above the answer field; the submit control is whatever says SUBMIT, DIVE,
 * DESCEND, GO or SEND; a "corrects to" step is answered again; and the run ends
 * at a completion banner, the round count or the time budget. The model supplies
 * the answers, this supplies the reflexes.
 */
/**
 * Measured deep-cut answers, one row per kind of prompt.
 *
 * These are the answers from the dive that scored 545 / 5,450 m
 * (scripts/krillion-deep-cuts.js), kept as the fallback behind whatever the
 * model sends: a prompt shape the model did not foresee still gets a rare, true
 * answer instead of one generic guess. Model rows are tried first, so a better
 * answer always wins; these only fill the gaps.
 */
const QUIZ_BANK: { match: string; picks: string[] }[] = [
  {
    match: 'fictional place|(star wars|tolkien|lord of the rings|fortnite|spongebob|disney|pixar).*place',
    picks: ['Henneth Annûn', 'Derndingle', 'Nan Dungortheb'],
  },
  { match: 'stick to your skin|peel (it )?off|peel-off', picks: ['corn pad', 'liquid bandage', 'peel-off base coat'] },
  { match: 'direct(ed|or).*(movie|film)|(movie|film).*director', picks: ['Piotr Szulkin', 'Juraj Herz', 'Kaneto Shindo'] },
  { match: "country.*(soccer|football).*(not|isn't)|soccer isn't", picks: ['Nauru', 'Marshall Islands', 'Palau'] },
  { match: 'tv show.*(five|5).*season|at least five seasons', picks: ['Pobol y Cwm', 'Take the High Road', 'Rownd a Rownd'] },
  { match: 'animal.*(bigger|heavier)|bigger or heavier than a human', picks: ['giant grouper', 'ocean sunfish'] },
  { match: 'permission.*(phone|app)|access on your phone', picks: ['body sensors', 'usage access', 'draw over other apps'] },
  { match: 'type of cloud|cloud', picks: ['nacreous', 'mammatus'] },
  { match: 'fish|sea creature', picks: ['sarcastic fringehead', 'barreleye'] },
  { match: 'bird', picks: ['oilbird', 'kagu'] },
  { match: 'flower|plant|tree', picks: ['welwitschia', 'ghost orchid'] },
  { match: 'fruit', picks: ['jabuticaba', 'bael'] },
  { match: 'vegetable', picks: ['salsify', 'celtuce'] },
  { match: 'cheese', picks: ['brânză de burduf', 'stinking bishop'] },
  { match: 'pasta|noodle', picks: ['strozzapreti', 'malloreddus'] },
  { match: 'cocktail|drink', picks: ['remember the maine', 'corpse reviver'] },
  { match: 'cereal', picks: ['product 19', 'cracklin oat bran'] },
  { match: 'candy|sweet', picks: ['zagnut', 'salmiakki'] },
  { match: 'car (brand|make)|automobile', picks: ['wartburg', 'tatra'] },
  { match: 'dog breed', picks: ['catalburun', 'chinook'] },
  { match: 'moon|planet', picks: ['telesto', 'ymir'] },
  { match: 'element', picks: ['praseodymium', 'holmium'] },
  { match: 'language', picks: ['rotokas', 'paamese'] },
  { match: 'holiday|festival', picks: ['up helly aa', 'tynwald day'] },
  { match: 'disney character', picks: ['humphrey the bear', 'clarabelle cow'] },
  { match: 'star wars character', picks: ['willrow hood', 'dexter jettster'] },
  { match: 'pok[eé]mon', picks: ['cryogonal', 'finneon'] },
  { match: 'song|band|artist|musician', picks: ['nurse with wound', 'this heat'] },
  { match: 'book|novel', picks: ['a void', 'the recognitions'] },
  { match: 'movie|film|rom-com|romcom', picks: ['the hourglass sanatorium', 'marketa lazarova', 'sátántangó'] },
  { match: 'city|town|capital', picks: ['ngerulmud', 'tristan da cunha', 'rabbit hash, kentucky'] },
  { match: 'country|nation', picks: ['nauru', 'tuvalu', 'kiribati'] },
  { match: 'scoop', picks: ['scoopula', 'spud', 'bench scraper'] },
  { match: 'tool', picks: ['spokeshave', 'drawknife'] },
  { match: 'instrument', picks: ['ondes martenot', 'nyckelharpa'] },
  { match: 'multiple balls|more than one ball|several balls', picks: ['croquet', 'billiards', 'bowling'] },
  { match: 'sport', picks: ['sepak takraw', 'buzkashi'] },
  { match: 'colou?r', picks: ['falu red', 'sinopia'] },
  { match: 'job|profession|occupation', picks: ['luthier', 'farrier'] },
  { match: 'phobia', picks: ['omphalophobia', 'turophobia'] },
  { match: 'dinosaur', picks: ['cryolophosaurus', 'sinosauropteryx'] },
  { match: 'unit of measurement|measurement', picks: ['smoot', 'siriometer'] },
  { match: 'board game', picks: ["tzolk'in", 'hive'] },
  { match: 'battle royale', picks: ['bloodhunt', 'naraka bladepoint', 'spellbreak'] },
  { match: 'video game', picks: ['pathologic', 'kentucky route zero'] },
  { match: 'kitchen', picks: ['cherry pitter', 'bench scraper'] },
  { match: 'hospital|doctor|medical', picks: ['otoscope', 'sphygmomanometer'] },
  { match: 'rhyme', picks: ['cusp', 'opus'] },
  { match: 'smell|scent', picks: ['geosmin', 'petrichor'] },
  { match: 'number', picks: ["skewes' number", "graham's number"] },
  // Broadest last: the runner takes the first row that matches, so a specific
  // shape (a battle-royale game, a scoop) has to come before the wide one it is
  // also an instance of (a video game, a tool), or it never gets asked.
  { match: 'one-word animal|animal', picks: ['chinook', 'shrew', 'saiga', 'quoll', 'numbat'] },
]

export function quizPlan(value: unknown): QuizPlan {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
  const rows = Array.isArray(source['answers']) ? (source['answers'] as unknown[]) : []
  const answers = rows
    .flatMap((row) => {
      if (!row || typeof row !== 'object') return []
      const item = row as Record<string, unknown>
      const match =
        typeof item['match'] === 'string' ? item['match'] : typeof item['pattern'] === 'string' ? (item['pattern'] as string) : ''
      const raw = Array.isArray(item['picks'])
        ? (item['picks'] as unknown[])
        : Array.isArray(item['answers'])
          ? (item['answers'] as unknown[])
          : typeof item['pick'] === 'string'
            ? [item['pick']]
            : []
      const picks = raw.filter((pick): pick is string => typeof pick === 'string' && pick.trim().length > 0).map((pick) => pick.trim())
      return match.trim() && picks.length ? [{ match: match.trim(), picks: picks.slice(0, 5) }] : []
    })
    .slice(0, 20)
  const fallback = (Array.isArray(source['fallback']) ? (source['fallback'] as unknown[]) : [])
    .filter((pick): pick is string => typeof pick === 'string' && pick.trim().length > 0)
    .map((pick) => pick.trim())
    .slice(0, 6)
  return {
    // The model's own rows first, then the measured bank for every shape it did
    // not think of: the runner tries them in order, so a better answer wins and
    // a shape nobody named still scores something rarer than a guess.
    answers: [...answers, ...QUIZ_BANK],
    fallback: fallback.length ? fallback : ['Graham’s number'],
    rounds: Math.max(1, Math.min(20, Math.floor(Number(source['rounds']) || 7))),
    budgetMs: Math.max(10_000, Math.min(240_000, Math.floor(Number(source['budgetMs']) || 120_000))),
  }
}

export function quizScript(plan: QuizPlan): string {
  const spec = JSON.stringify({
    answers: (plan.answers ?? []).slice(0, 80),
    fallback: plan.fallback ?? [],
    rounds: Math.max(1, Math.min(20, Math.floor(plan.rounds ?? 7))),
    budgetMs: Math.max(10_000, Math.min(240_000, Math.floor(plan.budgetMs ?? 120_000))),
  })
  return `(() => {
    const plan = ${spec}
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
    const norm = (value) => String(value || '').replace(/\\s+/g, ' ').trim()
    const body = () => (document.body && document.body.innerText) || ''
    const vis = (el) => !!el && el.getClientRects().length > 0
    const complete = () => /DIVE (?:#\\d+ )?COMPLETE|RUN COMPLETE|DIVE COMPLETE/i.test(body())
    const field = () => Array.from(document.querySelectorAll('input[type=text], input:not([type]), textarea, [contenteditable="true"]')).find(vis) || null
    const button = (re) => Array.from(document.querySelectorAll('button, [role="button"], input[type="submit"]')).find((b) => vis(b) && !b.disabled && re.test(norm(b.innerText || b.value || ''))) || null
    const promptText = () => {
      const m = body().match(/(?:^|\\n)([^\\n]{8,400})\\n\\s*[▼▶]\\s*rarer answers[^\\n]*/i)
      if (m) return norm(m[1])
      const el = field()
      if (!el) return ''
      let node = el
      for (let i = 0; i < 6 && node; i += 1, node = node.parentElement) {
        const lines = String((node.parentElement && node.parentElement.innerText) || '').split('\\n').map(norm).filter(Boolean)
        if (lines.length >= 2) {
          const before = lines[lines.length - 2]
          if (before.length >= 8 && before.length <= 400 && !/^(PROMPT|SCORE|DEPTH)\\b/i.test(before)) return before
        }
      }
      return ''
    }
    const tier = () => {
      const m = body().match(/(?:^|\\n)([A-Z][A-Z ]{2,24})\\n“([^”]+)”\\n\\+(\\d+) PTS/)
      if (m) return { tier: norm(m[1]), answer: norm(m[2]), pts: Number(m[3]) }
      // A round the clock took, or one where nothing landed, is a result too:
      // without it the runner waits out the next prompt's clock on the last one.
      const miss = body().match(/(?:^|\\n)(NOTHING LANDED|[A-Z][A-Z ]{2,24})\\n—\\n\\+0 PTS/)
      return miss ? { tier: 'missed', answer: '', pts: 0 } : null
    }
    const correction = () => {
      const m = body().match(/“([^”]+)”\\ncorrects to\\n“([^”]+)”/)
      return m ? { typed: norm(m[1]), canonical: norm(m[2]) } : null
    }
    const waitFor = async (fn, ms, step) => {
      const end = Date.now() + ms
      while (Date.now() < end) {
        const value = fn()
        if (value) return value
        await sleep(step || 120)
      }
      return null
    }
    const choose = (prompt, taken) => {
      const low = prompt.toLowerCase()
      for (const row of plan.answers || []) {
        let hit = false
        try { hit = new RegExp(row.match, 'i').test(low) } catch (e) { hit = low.indexOf(String(row.match).toLowerCase()) >= 0 }
        if (!hit) continue
        const fresh = (row.picks || []).filter((pick) => !taken.has(pick.toLowerCase()))
        if (fresh.length) return fresh
      }
      const rest = (plan.fallback || []).filter((pick) => !taken.has(pick.toLowerCase()))
      return rest.length ? rest : ['Graham’s number']
    }
    const setAnswer = async (text) => {
      const el = field()
      if (!el) return false
      el.focus()
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : el.tagName === 'INPUT' ? HTMLInputElement.prototype : null
      const descriptor = proto && Object.getOwnPropertyDescriptor(proto, 'value')
      if (descriptor && descriptor.set) descriptor.set.call(el, text)
      else el.textContent = text
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
      await sleep(140)
      return true
    }
    const submit = async () => {
      const go = button(/^(SUBMIT|DIVE|DESCEND|ENTER|GO|SEND)\\b/i)
      if (go) go.click()
      else {
        const el = field()
        if (el) el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }))
      }
      await sleep(180)
    }

    // The runner is published on the page and driven from outside: a single
    // evaluate that runs for a minute is one CDP call a proxy can time out, and
    // a timed run has to outlive that. The window keeps the progress instead.
    const q = window.__autoplay = { steps: [], phase: 'start', done: false }
    ;(async () => {
    const steps = q.steps
    const taken = new Set()
    const end = Date.now() + plan.budgetMs
    let phase = 'start'

    for (const b of document.querySelectorAll('button')) {
      if (vis(b) && /AnnouncementGate/.test(String(b.className))) b.click()
    }
    if (!field() && !complete()) {
      const start = button(/BEGIN DESCENT|START THE DRIVE|START|PLAY|^DIVE$/i)
      if (start) {
        start.click()
        await sleep(900)
      }
    }

    while (steps.length < plan.rounds && Date.now() < end && !complete()) {
      phase = 'prompt'
      // The prompt prints a few seconds before the answer field exists (the page
      // is still descending, or its clock is counting in), so the round is not
      // ready when the text is — waiting for the field is what stops the clock
      // from beating the runner to the first prompt.
      const prompt = await waitFor(() => {
        const text = promptText()
        return text && field() ? text : null
      }, 28000, 150)
      if (!prompt) { phase = 'no-prompt'; break }
      const picks = choose(prompt, taken)
      let accepted = ''
      for (let i = 0; i < picks.length; i += 1) {
        const pick = picks[i]
        phase = 'answer'
        if (!(await setAnswer(pick))) { phase = 'no-field'; break }
        await submit()
        phase = 'outcome'
        const outcome = await waitFor(() => tier() || correction(), 6000, 100)
        if (outcome && typeof outcome.pts === 'number') { accepted = outcome.answer; break }
        if (i < picks.length - 1) continue
        if (outcome && outcome.canonical) {
          await submit()
          const settled = await waitFor(() => tier(), 8000, 100)
          accepted = settled ? settled.answer : outcome.canonical
        } else {
          accepted = pick
        }
        break
      }
      const result = await waitFor(() => tier(), 12000, 120)
      const answer = (result && result.answer) || accepted || picks[0] || '?'
      taken.add(answer.toLowerCase())
      steps.push({ prompt: prompt.slice(0, 80), answer, tier: (result && result.tier) || 'missed', pts: (result && result.pts) || 0 })
      phase = 'next'
      const next = button(/^(DESCEND|NEXT|CONTINUE|DRIVE ON|GO ON|NEXT PROMPT)\\b/i)
      if (next) {
        next.click()
        await sleep(600)
      }
      await waitFor(() => !field() || !tier() || promptText() !== prompt, 4000, 120)
    }

    q.complete = complete()
    q.ended = Date.now() >= end ? 'timeout' : phase
    q.done = true
    })()
    return 'started'
  })()`
}

/** The runner's progress, read without waiting for it. */
export function quizPollScript(): string {
  return `(() => {
    const q = window.__autoplay
    if (!q) return JSON.stringify(null)
    return JSON.stringify({ steps: q.steps || [], done: !!q.done, complete: !!q.complete, ended: q.ended || q.phase })
  })()`
}

/**
 * Drives a started run to its end, reading the page's progress every few seconds.
 *
 * Starting and polling are separate so no single browser call has to survive the
 * whole run: a provider with a request timeout would otherwise cut a dive short
 * at the moment it was winning.
 */
export async function playQuiz(
  start: () => Promise<unknown>,
  poll: () => Promise<QuizPlayed | null>,
  budgetMs: number,
): Promise<QuizPlayed> {
  await start()
  const end = Date.now() + Math.min(240_000, Math.max(10_000, budgetMs)) + 15_000
  let last: QuizPlayed | null = null
  while (Date.now() < end) {
    await new Promise((resolve) => setTimeout(resolve, 2_500))
    const state = await poll().catch(() => null)
    if (!state) continue
    last = state
    if (state.done) break
  }
  return last ?? { steps: [], ended: 'the page never reported a prompt' }
}

type RawSnapshot = { title?: string; text?: string; labels?: string[]; fields?: string[]; passwords?: number }

/**
 * A page asking for an account the agent does not have. Typing a guess into it
 * locks the account or trips a CAPTCHA, so the honest move is to stop and say
 * what is missing. This is the difference between "it could not do it" and it
 * scribbling a made-up email into a stranger's login form.
 */
export function authWallNotice(url: string, passwordFields: number, text: string): string {
  const asksForPassword = passwordFields > 0
  const looksLikeSignIn = /accounts\.google\.com|\/(?:signin|sign-in|login|auth)\b/i.test(url)
  if (asksForPassword || (looksLikeSignIn && /sign in|log in|password|email address/i.test(text))) {
    return 'AUTH WALL: this is a sign-in page. You have no account or password for it and must not invent one — a guessed email, a fake password or a "mock account" will fail and can lock the real account. Stop here, finish with status "blocked", and say plainly that the site needs an account the person must sign in to first.'
  }
  return ''
}

function render(raw: RawSnapshot, url: string): BrowserSnapshot {
  const parts = [`URL: ${url}`, `Title: ${raw.title || '(none)'}`]
  const wall = authWallNotice(url, raw.passwords ?? 0, raw.text ?? '')
  if (wall) parts.push(wall)
  if (raw.text?.trim()) parts.push(`Page text:\n${raw.text.trim()}`)
  else parts.push('Page text: (nothing readable — it may be a canvas or still loading)')
  if (raw.labels?.length) parts.push(`Clickable: ${raw.labels.join(' | ')}`)
  if (raw.fields?.length) parts.push(`Text fields: ${raw.fields.join(' | ')}`)
  return { url, title: raw.title || '', text: parts.join('\n') }
}

/**
 * Opens one Chrome session for the turn. Returns null when the deployment has
 * no browser binding, so callers can degrade instead of failing.
 */
export async function openBrowserSession(
  env: { BROWSER?: unknown },
  signal?: AbortSignal,
): Promise<BrowserSessionLike | null> {
  if (!env.BROWSER) return null
  const browser = await puppeteer.launch(env.BROWSER as never)
  // A turn that is stopped must not leave a Chrome running against the daily
  // browser-minutes allowance.
  signal?.addEventListener('abort', () => void browser.close().catch(() => undefined), { once: true })
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 800 }).catch(() => undefined)

  const read = async (): Promise<BrowserSnapshot> => {
    const raw = JSON.parse((await page.evaluate(snapshotScript(BROWSER_TEXT_CHARS))) as string) as RawSnapshot
    return render(raw, page.url())
  }

  const settle = async () => {
    // A click that starts a request should not hand back the old page — but a
    // game animates continuously, so waiting the full four seconds for "network
    // idle" made every single action feel broken. Wait briefly, then look.
    await page.waitForNetworkIdle({ idleTime: 250, timeout: 1_200 }).catch(() => undefined)
  }

  /**
   * The picture the person watches in the workspace. Small on purpose: this
   * travels down the same stream as the chat text on every action.
   */
  const screenshot = async (): Promise<string> => {
    const bytes = (await page.screenshot({ type: 'jpeg', quality: 68 })) as Uint8Array
    let binary = ''
    for (let index = 0; index < bytes.length; index += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
    }
    return `data:image/jpeg;base64,${btoa(binary)}`
  }

  return {
    async open(url: string) {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT })
      await settle()
      return read()
    },
    read,
    async click(target: string) {
      const before = await read()
      // Only things that are meant to be pressed, and the *most specific* one:
      // a page-wide container also "contains" the words on its button, and
      // clicking the container does nothing at all. Exact match beats prefix,
      // prefix beats substring, and the shortest label wins a tie.
      const script = `(() => {
        // Compare words, not decoration: "DESCEND ▼" and "descend" are the same
        // control, and so are "DIVE!" and "Dive".
        const squash = (value) => (value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
        const wanted = squash(${JSON.stringify(target)})
        if (!wanted) return ''
        const known = 'button, a, [role="button"], [role="link"], [onclick], input[type="submit"], input[type="button"], summary, label, [tabindex]:not([tabindex="-1"])'
        const nodes = new Set(document.querySelectorAll(known))
        // Plenty of sites — krillion among them — draw their buttons as plain
        // divs and make them clickable with CSS alone. A cursor of "pointer" is
        // the honest signal that something is meant to be pressed.
        let scanned = 0
        for (const node of document.querySelectorAll('body *')) {
          if (++scanned > 5000) break
          if (nodes.has(node)) continue
          const text = (node.textContent || '').trim()
          if (!text || text.length > 80) continue
          const cursor = getComputedStyle(node).cursor
          if (cursor !== 'pointer') continue
          nodes.add(node)
        }
        let best = null
        let bestScore = 99
        let bestLength = 1e9
        for (const node of nodes) {
          const label = (node.innerText || node.value || node.getAttribute('aria-label') || node.getAttribute('title') || '').replace(/\\s+/g, ' ').trim()
          if (!label) continue
          const flat = squash(label)
          if (!flat) continue
          let score = 99
          if (flat === wanted) score = 0
          else if (flat.startsWith(wanted)) score = 1
          else if (flat.includes(wanted)) score = 2
          else if (wanted.includes(flat) && flat.length > 3) score = 3
          else continue
          if (score < bestScore || (score === bestScore && label.length < bestLength)) {
            best = node
            bestScore = score
            bestLength = label.length
          }
        }
        if (!best) return ''
        best.scrollIntoView({ block: 'center' })
        best.click()
        return (best.innerText || best.value || ${JSON.stringify(target)}).replace(/\\s+/g, ' ').trim().slice(0, 80)
      })()`
      const label = (await page.evaluate(script)) as string
      if (!label) {
        // A canvas game has no buttons to find; the middle of the page is the
        // "next" target in almost every one of them. But say what the page does
        // offer, or the model will invent the same wrong label again.
        const offered = (await page
          .evaluate(
            `(() => {
              const out = []
              for (const node of document.querySelectorAll('button, a, [role="button"], input[type="submit"], [tabindex]:not([tabindex="-1"])')) {
                const text = (node.innerText || node.value || node.getAttribute('aria-label') || '').replace(/\\s+/g, ' ').trim()
                if (text && text.length <= 40 && !out.includes(text)) out.push(text)
                if (out.length >= 6) break
              }
              return out
            })()`,
          )
          .catch(() => [])) as string[]
        // A page with real buttons is a page where a blind click in the middle is
        // a lie — on a form it can submit, and on a real site it does something
        // nobody asked for. Only a page with nothing clickable (a canvas game)
        // gets the centre click, because there the centre *is* the control.
        if (offered?.length) {
          return {
            ok: false,
            detail: `There is no control matching "${target}". Nothing was clicked. The controls here are: ${offered
              .map((item) => `"${item}"`)
              .join(', ')}. Use one of those.`,
            page: await read(),
          }
        }
        await page.mouse.click(640, 400)
        await settle()
        return {
          ok: true,
          detail: `No control matching "${target}" and nothing on the page is clickable, so clicked the middle — which is how a canvas game takes input.`,
          page: await read(),
        }
      }
      await settle()
      const after = await read()
      const unchanged = after.url === before.url && after.text === before.text
      return {
        ok: true,
        // Silence is a fact worth reporting: a model that clicked the wrong
        // thing four times needs to be told, not left to guess.
        detail: unchanged
          ? `Clicked "${label}", but nothing changed. That control may do nothing — look for a different one.`
          : `Clicked "${label}".`,
        page: after,
      }
    },
    async type(text: string) {
      // Select what is already there first: typing means "this is the answer",
      // not "add these words to the last ones". Without the select a model that
      // typed twice produced "PeruPeru" and could not tell, because a page's
      // text never includes the value of its inputs.
      const focused = (await page.evaluate(
        `(() => { const el = document.querySelector('input:not([type="submit"]):not([type="button"]), textarea, [contenteditable="true"]'); if (!el) return ''; el.focus(); if (el.select) el.select(); return el.getAttribute('placeholder') || el.getAttribute('name') || 'field' })()`,
      )) as string
      if (!focused) return { ok: false, detail: 'There is no text field on this page.', page: await read() }
      await page.keyboard.type(text, { delay: 12 })
      await settle()
      const held = (await page
        .evaluate(
          `(() => { const el = document.activeElement; if (!el) return ''; return String(('value' in el) ? el.value : el.textContent || '').slice(0, 120) })()`,
        )
        .catch(() => '')) as string
      return {
        ok: true,
        detail: `Typed into ${focused}; the field now says "${held}". Press Enter or the page's submit control to send it.`,
        page: await read(),
      }
    },
    async press(key: string) {
      await page.keyboard.press(key as Parameters<typeof page.keyboard.press>[0])
      await settle()
      return { ok: true, detail: `Pressed ${key}.`, page: await read() }
    },
    async waitFor(target: string, seconds: number) {
      // A lesson's "next question" appears when it appears. Sleeping a fixed
      // amount either wastes the turn or misses it, so poll for the actual text.
      const wanted = target.trim()
      if (!wanted) return { ok: false, detail: 'waitFor needs the text to wait for.', page: await read() }
      const selector = wanted.startsWith('css:') ? wanted.slice(4).trim() : ''
      const limit = Math.min(40, Math.max(3, Math.round(seconds) || 15))
      const deadline = Date.now() + limit * 1_000
      let found = false
      while (Date.now() < deadline) {
        found = Boolean(
          await page
            .evaluate(
              selector
                ? `(() => Boolean(document.querySelector(${JSON.stringify(selector)})))()`
                : `(() => document.body.innerText.toLowerCase().includes(${JSON.stringify(wanted.toLowerCase())}))()`,
            )
            .catch(() => false),
        )
        if (found) break
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
      await settle()
      return {
        ok: found,
        detail: found
          ? `"${wanted.slice(0, 60)}" appeared.`
          : `"${wanted.slice(0, 60)}" did not appear within ${limit}s. The page may need something else first.`,
        page: await read(),
      }
    },
    async scroll(by: number, target: string) {
      const wanted = target.trim()
      const moved = (await page
        .evaluate(
          wanted
            ? `(() => {
                const wanted = ${JSON.stringify(wanted)}.toLowerCase()
                const nodes = Array.from(document.querySelectorAll('body *')).filter((n) => {
                  const own = (n.textContent || '').trim()
                  return own && own.length <= 120 && own.toLowerCase().includes(wanted)
                })
                const node = nodes.sort((a, b) => (a.textContent || '').length - (b.textContent || '').length)[0]
                if (!node) return 'notfound'
                node.scrollIntoView({ block: 'center' })
                return 'found'
              })()`
            : `(() => { const before = window.scrollY; window.scrollBy(0, ${Math.round(by)}); return window.scrollY === before ? 'nomove' : 'moved' })()`,
        )
        .catch(() => 'error')) as string
      await settle()
      const detail =
        moved === 'found'
          ? `Scrolled to "${wanted.slice(0, 50)}".`
          : moved === 'notfound'
            ? `Nothing on this page says "${wanted.slice(0, 50)}".`
            : moved === 'moved'
              ? `Scrolled ${by > 0 ? 'down' : 'up'} by ${Math.abs(Math.round(by))}px.`
              : moved === 'nomove'
                ? 'The page cannot scroll further in that direction.'
                : 'The page could not be scrolled.'
      return { ok: moved === 'found' || moved === 'moved', detail, page: await read() }
    },
    async autoplay(plan: QuizPlan) {
      const raw = await playQuiz(
        () => page.evaluate(quizScript(plan)),
        async () => {
          const text = (await page.evaluate(quizPollScript())) as string
          return JSON.parse(text) as QuizPlayed | null
        },
        plan.budgetMs ?? 120_000,
      )
      await settle()
      return { ...quizSummary(raw), page: await read() }
    },
    async video(command: VideoCommand) {
      const script = `(() => {
        const videos = Array.from(document.querySelectorAll('video'))
        if (!videos.length) return JSON.stringify({ found: false })
        // The lesson player is the big one; a page can also hold a thumbnail clip.
        videos.sort((a, b) => (b.clientWidth * b.clientHeight) - (a.clientWidth * a.clientHeight))
        const v = videos[0]
        if (${command.mute === true}) v.muted = true
        if (${typeof command.rate === 'number'}) v.playbackRate = ${Number(command.rate) || 1}
        const duration = Number.isFinite(v.duration) ? v.duration : 0
        if (${command.end === true} && duration > 0) v.currentTime = Math.max(0, duration - 0.4)
        else if (${typeof command.seek === 'number'}) v.currentTime = Math.max(0, ${Number(command.seek) || 0})
        if (${command.play !== false}) { try { v.play() } catch (e) {} }
        else { try { v.pause() } catch (e) {} }
        return JSON.stringify({ found: true, duration, currentTime: v.currentTime, paused: v.paused, rate: v.playbackRate })
      })()`
      const raw = JSON.parse((await page.evaluate(script)) as string) as {
        found?: boolean
        duration?: number
        currentTime?: number
        paused?: boolean
        rate?: number
      }
      if (!raw.found) {
        return { ok: false, detail: 'There is no video on this page.', page: await read() }
      }
      const clock = (seconds: number) => {
        const total = Math.max(0, Math.round(seconds))
        return `${Math.floor(total / 60)}m ${String(total % 60).padStart(2, '0')}s`
      }
      await settle()
      return {
        ok: true,
        detail: `Video is ${clock(raw.duration ?? 0)} long, now at ${clock(raw.currentTime ?? 0)}, ${
          raw.paused ? 'paused' : 'playing'
        } at ${raw.rate ?? 1}×.`,
        page: await read(),
      }
    },
    async wait(seconds: number) {
      // Plenty of pages run a clock between steps — krillion gives 25 seconds per
      // question. Without this the agent gave up on an unchanged page while the
      // timer was still running, which looks exactly like "it only did the first
      // one".
      const capped = Math.max(1, Math.min(BROWSER_WAIT_MAX, Math.round(seconds) || 5))
      const before = await read()
      await new Promise((resolve) => setTimeout(resolve, capped * 1_000))
      await settle()
      const after = await read()
      return {
        ok: true,
        detail:
          after.text === before.text
            ? `Waited ${capped}s; nothing on the page has changed yet. If a clock is counting, wait again; if it is already your turn, act.`
            : `Waited ${capped}s; the page moved on.`,
        page: after,
      }
    },
    async back() {
      await page.goBack({ waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT }).catch(() => undefined)
      await settle()
      return { ok: true, detail: 'Went back.', page: await read() }
    },
    screenshot,
    async close() {
      await browser.close().catch(() => undefined)
    },
  }
}
