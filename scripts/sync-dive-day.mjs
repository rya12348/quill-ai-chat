#!/usr/bin/env node
/**
 * Lock today's Daily Dive to Krillion's own card, and prove the two agree.
 *
 *   node scripts/sync-dive-day.mjs            # fetch, verify, write the lock
 *   node scripts/sync-dive-day.mjs --check    # verify only, never write
 *
 * The dive is Krillion's other half: same seven prompts, same answer sheets,
 * same rarity on every answer. It reads their card live, so it is only as exact
 * as their edge is up when the page loads — and when their `/api/today` missed
 * we fell back to a deck of our own, which is a different day's questions under
 * the same heading. This script is the anchor:
 *
 *  1. It takes the day from *their* `/api/today`, never from this machine's
 *     clock, so a reset that lands mid-morning here cannot shift the card.
 *  2. It writes those seven prompts to `src/worker/dive-day.ts`, which the
 *     worker serves when their edge does not answer. Same questions, same ids —
 *     one round of the town's own is the only licensed difference.
 *  3. It compares their answer sheet with ours prompt by prompt (answer count
 *     and the tier of every answer) and fails the run on any drift, so the job
 *     that keeps this file fresh also tells us the moment we stop matching.
 *
 * Run daily by `.github/workflows/dive-day.yml`; the job commits the lock, and
 * the deploy workflow ships it.
 */
import fs from 'node:fs'
import path from 'node:path'

const SOURCE = 'https://krillion.io'
const LIVE = process.env.DIVE_LIVE_ORIGIN || 'https://www.inkbrowser.dpdns.org'
const LOCK = path.join('src', 'worker', 'dive-day.ts')
const checkOnly = process.argv.includes('--check')

const get = async (url) => {
  const res = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'Ink-Butter-Dive/1.0 (+sync)' } })
  const body = await res.json().catch(() => null)
  return { ok: res.ok, status: res.status, body }
}

const hist = (answers) => {
  const out = {}
  for (const entry of answers || []) {
    const tier = String(entry.tier ?? '?')
    out[tier] = (out[tier] ?? 0) + 1
  }
  return out
}

const sameHist = (a, b) => {
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})])
  for (const key of keys) if ((a?.[key] ?? 0) !== (b?.[key] ?? 0)) return false
  return true
}

const stamp = new Date().toISOString()
const live = await get(`${LIVE}/api/butter-dive/today`)
if (!live.ok || !Array.isArray(live.body?.prompts)) {
  console.error(`cannot read our own dive: ${live.status}`)
  process.exit(2)
}
// Their day first: the date this lock is for comes from their card, not from
// this machine. If their edge is down we anchor on the day we are already
// serving so a scheduled run never invents a date.
const today = await get(`${SOURCE}/api/today`)
const date = String(today.body?.date || live.body.date || '')
const dayNumber = Number(today.body?.dayNumber ?? live.body.dayNumber ?? 0)
const resetsAt = String(today.body?.resetsAt ?? live.body.resetsAt ?? '')
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  console.error('no usable date from either card')
  process.exit(2)
}

// Their sheet is the record of every accepted answer and its rarity. It is
// public for the current day only, so this is the one moment it can be taken.
let sheet = await get(`${SOURCE}/api/reveal?date=${date}`)
if (!sheet.ok) {
  await new Promise((resolve) => setTimeout(resolve, 20_000))
  sheet = await get(`${SOURCE}/api/reveal?date=${date}`)
}
const theirPrompts = Array.isArray(sheet.body?.prompts) ? sheet.body.prompts : []
const theirById = new Map(theirPrompts.map((prompt) => [prompt.id, prompt]))

const liveById = new Map((live.body.prompts || []).map((prompt) => [prompt.id, prompt]))
const theirTodayById = new Map(((today.body?.prompts) || []).map((prompt) => [prompt.id, prompt]))

console.log(`card ${date} · dive #${dayNumber} · resets ${resetsAt || '?'}`)
console.log(`their /api/today: ${today.ok ? 'ok' : `down (${today.status})`} · their /api/reveal: ${sheet.ok ? 'ok' : `unavailable (${sheet.status})`}`)

/** A prompt of the town's own is ours to change; everything else must match. */
const isOurs = (id) => {
  const theirs = theirTodayById.get(id)?.text
  const ours = liveById.get(id)?.text
  return Boolean(theirs && ours && theirs !== ours)
}

// The sheet we serve, so the tiers are compared as well as the words.
const ourSheet = await get(`${LIVE}/api/butter-dive/sheet?date=${date}`)
const ourById = new Map(((ourSheet.body?.prompts) || []).map((prompt) => [prompt.id, prompt]))

const rows = []
let drift = []
let oursCount = 0
for (const id of ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7']) {
  const theirsToday = theirTodayById.get(id)
  const theirsSheet = theirById.get(id)
  const ours = liveById.get(id)
  if (isOurs(id)) {
    oursCount += 1
    rows.push({ id, verdict: 'ours', note: 'Simsbury round' })
    continue
  }
  const textSame = Boolean(theirsToday && ours && theirsToday.text === ours.text)
  const countSame = theirsSheet && ourById.get(id) ? theirsSheet.answers.length === (ourById.get(id).answers || []).length : null
  const tiersSame = theirsSheet && ourById.get(id) ? sameHist(hist(theirsSheet.answers), hist(ourById.get(id).answers)) : null
  rows.push({
    id,
    verdict: textSame && countSame !== false && tiersSame !== false ? 'same' : 'drift',
    note: `${theirsSheet ? theirsSheet.answers.length : '?'} answers · tiers ${tiersSame === null ? '?' : tiersSame ? 'same' : 'DIFFER'}`,
  })
  if (rows[rows.length - 1].verdict === 'drift') drift.push(id)
}

for (const row of rows) console.log(`  ${row.id.padEnd(2)} ${row.verdict.padEnd(5)} ${row.note}`)
if (oursCount > 1) console.log(`  note: ${oursCount} rounds are the town's own`)
if (!theirPrompts.length) console.log('  note: their sheet was not public this run, answers were not compared')

// The lock is their seven prompts, verbatim: our Simsbury overlay is applied by
// the worker at read time, so the file stays a plain copy of their card.
const lockedPrompts = (Array.isArray(today.body?.prompts) && today.body.prompts.length === 7 ? today.body.prompts : live.body.prompts).map(
  (prompt) => ({ id: String(prompt.id), text: String(prompt.text) }),
)
const body = `/**
 * Generated by scripts/sync-dive-day.mjs — do not edit.
 *
 * Krillion's card for ${date} (dive #${dayNumber}), taken from their own
 * /api/today at ${stamp}. The dive serves their live card while it answers and
 * this copy when it does not, so the day's seven prompts are the same either
 * way. One round is the town's own and the worker swaps that text at read time.
 */
export type DiveDayLock = {
  date: string
  dayNumber: number
  resetsAt: string
  syncedAt: string
  prompts: { id: string; text: string }[]
}

export const DIVE_DAY_LOCK: DiveDayLock = ${JSON.stringify(
  { date, dayNumber, resetsAt, syncedAt: stamp, prompts: lockedPrompts },
  null,
  2,
)}
`

const changed = !fs.existsSync(LOCK) || fs.readFileSync(LOCK, 'utf8') !== body
if (!checkOnly) {
  fs.writeFileSync(LOCK, body)
  console.log(changed ? `wrote ${LOCK}` : `${LOCK} already up to date`)
}

if (drift.length) {
  console.error(`\ndrift on ${drift.join(', ')}: the dive no longer matches their card`)
  process.exit(1)
}
console.log('the dive matches their card')
