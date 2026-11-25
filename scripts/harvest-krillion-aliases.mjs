#!/usr/bin/env node
/**
 * Harvest the aliases Krillion's answer sheet accepts, while that sheet is public.
 *
 *   node scripts/harvest-krillion-aliases.mjs            # take what is public now
 *   node scripts/harvest-krillion-aliases.mjs --dry-run  # report, write nothing
 *
 * Their sheet is public only for the dive that is currently live: the day it
 * closes (05:00 UTC) every earlier date starts answering
 * `403 That answer sheet is not publicly available.` So this is the one moment
 * the aliases exist at all, and the job that calls it has to land inside that
 * window. `.github/workflows/krillion-aliases.yml` runs it just before the roll
 * and once again just after.
 *
 * What it does with a sheet, per prompt:
 *
 *  - a prompt the bank already has: add the sheet's aliases to that card, so
 *    "central africa" scores Central African Republic instead of being refused.
 *    Only aliases the card can pay out are added — an alias for an answer our
 *    copy of the card does not carry has nothing to point at.
 *  - a prompt that is new (every dive brings seven): become a card. The full
 *    list goes to `public/puffer/cards/`, which the worker fetches on deal, and
 *    a sample goes to `src/worker/butter-cards-daily.ts`, which is what lets the
 *    party deal the prompt at all without putting a hundred thousand answers in
 *    the worker bundle.
 *
 * Both caps exist for size, not for taste: a single dive's sheet can run to
 * 195k answers on one prompt and 13 MB of JSON, and the repo takes one of these
 * every day. The trim keeps every answer outside the deep cut, then the deep
 * cuts with the most accepted spellings (more spellings, more ways a player
 * lands on it), shorter names first, so a run is deterministic.
 */
import fs from 'node:fs'
import path from 'node:path'

const SOURCE = 'https://krillion.io'
const CARDS = process.env.ALIAS_CARDS_DIR || path.join('public', 'puffer', 'cards')
const DAILY = process.env.ALIAS_DAILY_FILE || path.join('src', 'worker', 'butter-cards-daily.ts')
const CACHE = process.env.ALIAS_CACHE_DIR || path.join('tmp', 'puffer')
const INDEX = path.join(CACHE, 'alias-index.json')

/** Answers kept in a card's own file, and in the bundled sample of it. */
const CARD_CAP = Number(process.env.ALIAS_CARD_CAP) || 8000
const SAMPLE_CAP = Number(process.env.ALIAS_SAMPLE_CAP) || 600

const dry = process.argv.includes('--dry-run')

/**
 * Take the sheet whole: every answer, not just the trimmed card.
 *
 * Aliases hang off answers, so a card trimmed to 8000 of 195,000 can only pay
 * out the aliases of the answers it kept. `--full` keeps all of them for the
 * sheet in hand. It is a deliberate, per-run choice: one dive's sheet is 18 MB
 * of JSON here, and the biggest card of it fetches at 13 MB over the wire.
 */
const uncapped = process.argv.includes('--full') || process.env.ALIAS_FULL === '1'
const cardCap = uncapped ? Number.POSITIVE_INFINITY : CARD_CAP

/** The worker's tier code → digit, the order the card files are written in. */
const DIGITS = { krillion: '5', deepcut: '4', rare: '3', schooler: '2', tooclever: '1', plankton: '0' }

/** The same flattening the worker grades with. Keep the two in step. */
const flatAnswer = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(a|an|the) /, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/s$/, '')

/** The file name for a prompt — `cardSlug()` in `butter-cards-full.ts`. */
function cardSlug(prompt) {
  const words = String(prompt)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  let hash = 5381
  for (const character of String(prompt)) hash = ((hash * 33) ^ character.charCodeAt(0)) >>> 0
  return `${words}-${hash.toString(36)}`
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function getJson(url, tries = 3) {
  for (let attempt = 1; attempt <= tries; attempt += 1) {
    try {
      const res = await fetch(url, {
        headers: { accept: 'application/json', 'user-agent': 'Ink-Butter/1.0 (+alias harvest)' },
      })
      if (res.status !== 200) return { status: res.status }
      return { status: 200, body: await res.json() }
    } catch (error) {
      if (attempt === tries) return { status: 0, error }
      await sleep(5000)
    }
  }
  return { status: 0 }
}

/* ------------------------------------------------------------------ cards */

/** prompt → { file, body } for every card already on disk. */
function readCards() {
  const cards = new Map()
  if (!fs.existsSync(CARDS)) return cards
  for (const name of fs.readdirSync(CARDS)) {
    if (!name.endsWith('.json')) continue
    const file = path.join(CARDS, name)
    let body
    try {
      body = JSON.parse(fs.readFileSync(file, 'utf8'))
    } catch {
      console.warn(`skip unreadable card ${name}`)
      continue
    }
    if (!body || typeof body.prompt !== 'string' || !Array.isArray(body.a)) continue
    cards.set(body.prompt, { file, body })
  }
  return cards
}

/** The daily sample list already committed, read back out of its module. */
function readDaily() {
  if (!fs.existsSync(DAILY)) return []
  const text = fs.readFileSync(DAILY, 'utf8')
  const start = text.indexOf('= [')
  const end = text.lastIndexOf(']')
  if (start < 0 || end <= start) {
    throw new Error(`${DAILY} does not hold the generated list; refusing to overwrite it`)
  }
  try {
    const parsed = JSON.parse(text.slice(start + 2, end + 1))
    if (!Array.isArray(parsed)) throw new Error('not an array')
    return parsed
  } catch (error) {
    // Starting fresh here would silently delete every card harvested so far.
    throw new Error(`${DAILY} could not be read (${error.message}); refusing to overwrite it`)
  }
}

/** The prompts the bundled bank already deals, so a sample is never duplicated. */
function bundledPrompts() {
  const file = process.env.ALIAS_BANK_FILE || path.join('src', 'worker', 'butter-cards.ts')
  const prompts = new Set()
  if (!fs.existsSync(file)) return prompts
  const text = fs.readFileSync(file, 'utf8')
  for (const match of text.matchAll(/\{ prompt: ("(?:[^"\\]|\\.)*")/g)) {
    try {
      prompts.add(JSON.parse(match[1]))
    } catch {
      /* a prompt string we cannot read is not one we can reason about */
    }
  }
  return prompts
}

/**
 * Trim a sheet prompt down to a card that fits.
 *
 * Answers outside the deep cut go first — those are the ones a table types, so
 * they earn their space. The deep cut then fills whatever is left, longest-list
 * of accepted spellings first (a spelling people keep getting wrong is a name
 * people keep reaching for), and a run stays deterministic.
 */
function trim(entries, cap) {
  const shallow = entries.filter((entry) => entry.tier !== 'deepcut')
  const deep = entries
    .filter((entry) => entry.tier === 'deepcut')
    .sort(
      (left, right) =>
        (right.aliases?.length ?? 0) - (left.aliases?.length ?? 0) ||
        String(left.answer).length - String(right.answer).length ||
        String(left.answer).localeCompare(String(right.answer)),
    )
  const head = shallow.slice(0, cap)
  return [...head, ...deep.slice(0, Math.max(0, cap - head.length))]
}

/** A card file body for a trimmed answer list: answers, tier digits, aliases. */
function cardBody(prompt, kept) {
  const answers = kept.map((entry) => String(entry.answer))
  const tiers = kept.map((entry) => DIGITS[entry.tier] ?? '2').join('')
  const bySpelling = new Map(answers.map((answer, index) => [flatAnswer(answer), index]))
  const aliases = {}
  for (const [index, entry] of kept.entries()) {
    for (const alias of entry.aliases ?? []) {
      const key = flatAnswer(alias)
      // A spelling already held as an answer needs no alias, and two aliases that
      // flatten to the same key cannot both be stored.
      if (!key || bySpelling.has(key) || aliases[key] !== undefined) continue
      aliases[key] = index
    }
  }
  return {
    prompt,
    answers,
    tiers,
    body: Object.keys(aliases).length ? { prompt, a: answers, t: tiers, x: aliases } : { prompt, a: answers, t: tiers },
  }
}

/* ------------------------------------------------------------------- main */

const cards = readCards()
const today = await getJson(`${SOURCE}/api/today`)
const liveDate = typeof today.body?.date === 'string' ? today.body.date : ''

/** The newest date whose sheet is still public, starting from the live dive. */
async function findSheet() {
  const starts = []
  if (/^\d{4}-\d{2}-\d{2}$/.test(liveDate)) starts.push(liveDate)
  for (let offset = 0; offset < 3; offset += 1) {
    const date = new Date()
    date.setUTCDate(date.getUTCDate() - offset)
    starts.push(date.toISOString().slice(0, 10))
  }
  const seen = new Set()
  for (const date of starts) {
    if (seen.has(date)) continue
    seen.add(date)
    const cached = path.join(CACHE, `reveal-${date}.json`)
    if (fs.existsSync(cached)) {
      try {
        console.log(`sheet ${date} (cached)`)
        return { date, body: JSON.parse(fs.readFileSync(cached, 'utf8')) }
      } catch {
        /* fall through to the network */
      }
    }
    const sheet = await getJson(`${SOURCE}/api/reveal?date=${date}`)
    if (sheet.status === 200 && Array.isArray(sheet.body?.prompts)) {
      console.log(`sheet ${date} (${(JSON.stringify(sheet.body).length / 1e6).toFixed(1)}MB)`)
      if (!dry) {
        fs.mkdirSync(CACHE, { recursive: true })
        fs.writeFileSync(cached, JSON.stringify(sheet.body))
      }
      return { date, body: sheet.body }
    }
    console.log(`sheet ${date} — ${sheet.status === 0 ? 'no answer' : sheet.status}`)
  }
  return null
}

const sheet = await findSheet()
if (!sheet) {
  // Nothing public means nothing to harvest — not a failure of ours. The dive
  // that just closed is gone, and the next run gets the next one.
  console.log('no public sheet right now; nothing to harvest')
  process.exit(0)
}

const daily = readDaily()
const takenPrompts = new Set(daily.map((card) => card.prompt))
const bundled = bundledPrompts()
/** Cards built this run, so their sample does not need the file read back. */
const fresh = new Map()
const report = { newCards: 0, updated: 0, aliases: 0, answers: 0, skipped: 0, appended: 0 }
const writes = []
/** Per-card before/after, so a run reports what it actually bought. */
const touched = []

for (const prompt of sheet.body.prompts ?? []) {
  const text = String(prompt.text ?? '')
  const entries = (prompt.answers ?? []).filter((entry) => entry && typeof entry.answer === 'string')
  if (!text || !entries.length) continue
  const existing = cards.get(text)

  if (existing) {
    const body = existing.body
    const answers = body.a.map(String)
    const tiers = [...String(body.t ?? '')]
    const bySpelling = new Map(answers.map((answer, index) => [flatAnswer(answer), index]))
    const aliases = body.x && typeof body.x === 'object' && !Array.isArray(body.x) ? body.x : {}
    const before = { answers: answers.length, aliases: Object.keys(aliases).length }
    let appended = 0
    for (const entry of entries) {
      let at = bySpelling.get(flatAnswer(entry.answer))
      // The sheet accepts this answer but our copy of the card was trimmed and
      // does not carry it. Capped runs skip it (no payout for the alias to point
      // at); `--full` puts the answer back so the alias has somewhere to land.
      if (at === undefined) {
        if (!uncapped) {
          report.skipped += 1
          continue
        }
        answers.push(String(entry.answer))
        tiers.push(DIGITS[entry.tier] ?? '2')
        at = answers.length - 1
        bySpelling.set(flatAnswer(entry.answer), at)
        appended += 1
        report.appended += 1
      }
      for (const alias of entry.aliases ?? []) {
        const key = flatAnswer(alias)
        if (!key || bySpelling.has(key) || aliases[key] !== undefined) continue
        aliases[key] = at
      }
    }
    const added = Object.keys(aliases).length - before.aliases
    if (added || appended) {
      report.aliases += added
      report.updated += 1
      if (Object.keys(aliases).length) body.x = aliases
      if (appended) {
        body.a = answers
        body.t = tiers.join('')
      }
      writes.push({ file: existing.file, text: JSON.stringify(body) })
      touched.push({ prompt: text, from: before, to: { answers: answers.length, aliases: Object.keys(aliases).length }, added, appended })
      console.log(`  +${String(appended).padStart(6)} answers  +${String(added).padStart(6)} aliases  ${text}`)
    }
    // A card file without a sample cannot be dealt: `nextTopic` picks from the
    // bundled list. Repair that here, so a lost or hand-cleaned sample heals on
    // the next run instead of quietly removing the prompt from the party.
    if (!takenPrompts.has(text) && !bundled.has(text)) {
      const sample = trim(entries, SAMPLE_CAP)
      daily.push({
        prompt: text,
        answers: sample.map((entry) => String(entry.answer)),
        tiers: sample.map((entry) => entry.tier),
      })
      takenPrompts.add(text)
    }
    continue
  }

  // A prompt the bank has never held: this dive is where its card comes from.
  const kept = trim(entries, cardCap)
  if (!kept.length) continue
  const built = cardBody(text, kept)
  fresh.set(text, built)
  const file = path.join(CARDS, `${cardSlug(text)}.json`)
  writes.push({ file, text: JSON.stringify(built.body) })
  report.newCards += 1
  report.answers += built.answers.length
  report.aliases += Object.keys(built.body.x ?? {}).length
  touched.push({
    prompt: text,
    from: { answers: 0, aliases: 0 },
    to: { answers: built.answers.length, aliases: Object.keys(built.body.x ?? {}).length },
    added: Object.keys(built.body.x ?? {}).length,
    appended: built.answers.length,
  })
  if (!takenPrompts.has(text) && !bundled.has(text)) {
    const sample = trim(kept, SAMPLE_CAP)
    daily.push({
      prompt: text,
      answers: sample.map((entry) => String(entry.answer)),
      tiers: sample.map((entry) => entry.tier),
    })
    takenPrompts.add(text)
  }
  console.log(
    `  new card  ${String(built.answers.length).padStart(6)} answers  ${String(Object.keys(built.body.x ?? {}).length).padStart(6)} aliases  ${text}`,
  )
}

/* ------------------------------------------------------------------ write */

/** The bundled sample of an existing card always tracks the caps above. */
const TIER_BY_DIGIT = ['plankton', 'tooclever', 'schooler', 'rare', 'deepcut', 'krillion']
for (const card of daily) {
  const source = fresh.get(card.prompt) ?? (cards.has(card.prompt) ? cards.get(card.prompt).body : null)
  if (!source) continue
  card.answers = source.a.slice(0, SAMPLE_CAP).map(String)
  card.tiers = [...String(source.t)].slice(0, SAMPLE_CAP).map((digit) => TIER_BY_DIGIT[Number(digit)] ?? 'schooler')
}

const header = `/**
 * Cards harvested from Krillion's own answer sheets, one closed dive at a time.
 *
 * Written by \`scripts/harvest-krillion-aliases.mjs\` — do not edit by hand.
 *
 * Each entry is a *sample* of its card, exactly like \`butter-cards.ts\`: the full
 * list lives in \`public/puffer/cards/\`, and the party fetches that file when it
 * deals the prompt. The sample exists only so the prompt can be dealt at all
 * (\`nextTopic\` picks from this list) without carrying a hundred thousand answers
 * in the worker bundle, which is already close to its 25 MB ceiling.
 */
import type { BankCard } from './butter-cards'

export const DAILY_CARDS: BankCard[] = `

const dailyText = `${header}${JSON.stringify(daily)};\n`

if (dry) {
  console.log('\ndry run: nothing written')
} else {
  for (const write of writes) {
    fs.mkdirSync(path.dirname(write.file), { recursive: true })
    fs.writeFileSync(write.file, write.text)
  }
  if (fs.existsSync(DAILY) ? fs.readFileSync(DAILY, 'utf8') !== dailyText : daily.length > 0) {
    fs.writeFileSync(DAILY, dailyText)
    console.log(`wrote ${DAILY}`)
  }
  // The alias index that `tmp/puffer/split-cards.mjs` merges when it rebuilds a
  // card from the bank, so a full regeneration keeps what this run learned.
  const index = {}
  for (const [, card] of cards) {
    const aliases = card.body.x
    if (aliases && Object.keys(aliases).length) index[card.body.prompt] = aliases
  }
  for (const write of writes) {
    try {
      const body = JSON.parse(write.text)
      if (body.x && Object.keys(body.x).length) index[body.prompt] = body.x
    } catch {
      /* a write we just built is valid JSON or nothing */
    }
  }
  fs.mkdirSync(CACHE, { recursive: true })
  fs.writeFileSync(INDEX, JSON.stringify(index))
}

if (touched.length) {
  console.log('')
  for (const row of touched) {
    console.log(
      `  ${String(row.from.answers).padStart(7)} -> ${String(row.to.answers).padStart(7)} answers  ` +
        `${String(row.from.aliases).padStart(7)} -> ${String(row.to.aliases).padStart(7)} aliases  ${row.prompt.slice(0, 44)}`,
    )
  }
}
console.log(
  `\n${sheet.date}: ${report.newCards} new cards, ${report.updated} cards changed, ` +
    `${report.aliases} aliases, ${report.answers} answers, ${report.appended} answers restored, ` +
    `${report.skipped} answers we do not carry`,
)
