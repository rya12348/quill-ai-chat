#!/usr/bin/env node
/**
 * Audit every Poki game through Ink's proxy.
 *
 * For each game page this resolves Poki's wrapper, fetches the game document
 * and its main scripts through the deployed proxy, and records why anything
 * failed. Playability itself needs a browser; this catches the failures that
 * stop a game before it boots: no wrapper, missing document, dead assets.
 *
 *   node scripts/poki-audit.mjs [--limit N] [--concurrency N] [--json out.json]
 */
import { writeFile } from 'node:fs/promises'

const ORIGIN = process.env.POKI_AUDIT_ORIGIN ?? 'https://www.inkbrowser.dpdns.org'
const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const at = args.indexOf(`--${name}`)
  return at >= 0 && args[at + 1] ? args[at + 1] : fallback
}
const LIMIT = Number(flag('limit', '0')) || Infinity
const CONCURRENCY = Number(flag('concurrency', '6')) || 6
const OUT = flag('json', '')
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'

async function fetchWithTimeout(url, options = {}, ms = 45_000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, {
      redirect: 'manual',
      headers: { 'user-agent': UA, accept: '*/*', ...(options.headers ?? {}) },
      ...options,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }
}

async function catalogue() {
  const response = await fetchWithTimeout('https://poki.com/en/sitemaps/games.xml', { redirect: 'follow' }, 60_000)
  const xml = await response.text()
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]).filter((url) => url.includes('/g/'))
}

const SLUG = (url) => {
  try {
    return new URL(url).pathname.split('/').filter(Boolean).pop() ?? url
  } catch {
    return url
  }
}

function scriptsOf(html, docUrl) {
  const out = []
  for (const match of html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)) out.push(match[1])
  const resolved = []
  for (const source of out) {
    try {
      if (/^(?:data|blob|javascript):/i.test(source)) continue
      // Some engines build a script tag inside a string (`lang/'+c+'.js`);
      // that is not a URL the browser would ever request.
      if (/['"]\s*\+|\+\s*['"]/.test(source)) continue
      // A directory-only src (`lang/`) is a template placeholder, not a file
      // any browser would fetch as a script.
      if (/\/$/.test(source)) continue
      resolved.push(new URL(source, docUrl).href)
    } catch {
      /* ignore */
    }
  }
  return resolved.slice(0, 4)
}

async function auditGame(pageUrl) {
  const slug = SLUG(pageUrl)
  const started = Date.now()
  const result = { slug, page: pageUrl, stage: 'resolve', ok: false }
  try {
    const resolve = await fetchWithTimeout(`${ORIGIN}/api/poki-play?url=${encodeURIComponent(pageUrl)}`, {}, 30_000)
    if (resolve.status >= 400) {
      result.error = `resolve ${resolve.status}: ${(await resolve.text()).slice(0, 120)}`
      return result
    }
    const location = resolve.headers.get('location')
    if (!location) {
      result.error = `resolve ${resolve.status} without location`
      return result
    }
    const gameUrl = new URL(location, ORIGIN).href
    result.game = new URL(gameUrl).pathname
    result.stage = 'document'
    const doc = await fetchWithTimeout(gameUrl, {}, 45_000)
    const html = await doc.text()
    if (!doc.ok) {
      result.error = `document ${doc.status}: ${html.slice(0, 120)}`
      return result
    }
    if (html.length < 400) {
      result.error = `document too small (${html.length} bytes)`
      return result
    }
    result.bytes = html.length
    const scripts = scriptsOf(html, gameUrl)
    result.scripts = scripts.length
    result.stage = 'assets'
    if (!scripts.length) {
      result.ok = true
      result.note = 'no external scripts'
      result.ms = Date.now() - started
      return result
    }
    let loaded = 0
    let firstFailure = ''
    for (const script of scripts) {
      const response = await fetchWithTimeout(script, {}, 45_000)
      const body = response.ok ? await response.text() : ''
      // A 200 is a real file; only empty or error-shaped bodies count as dead.
      if (response.ok && body.length > 0 && !/^(?:Game|Not)\b.{0,40}(?:unavailable|found)/i.test(body)) loaded += 1
      else if (!firstFailure) firstFailure = `${response.status} ${script.slice(-80)}`
    }
    result.loadedScripts = loaded
    if (loaded === 0) {
      result.error = `no script loaded (${firstFailure})`
      return result
    }
    result.ok = true
    result.ms = Date.now() - started
    return result
  } catch (error) {
    result.error = error?.name === 'AbortError' ? 'timeout' : String(error?.message ?? error).slice(0, 160)
    return result
  }
}

async function pool(items, size, worker) {
  const results = new Array(items.length)
  let next = 0
  let done = 0
  async function run() {
    for (;;) {
      const index = next++
      if (index >= items.length) return
      results[index] = await worker(items[index], index)
      done += 1
      if (done % 25 === 0 || done === items.length) {
        const ok = results.slice(0, done).filter((entry) => entry?.ok).length
        process.stdout.write(`\r${done}/${items.length} tested, ${ok} ok`)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, run))
  process.stdout.write('\n')
  return results
}

const all = await catalogue()
const list = all.slice(0, LIMIT)
console.log(`${list.length} games from the Poki sitemap, concurrency ${CONCURRENCY}, origin ${ORIGIN}`)
const started = Date.now()
const results = await pool(list, CONCURRENCY, auditGame)
const ok = results.filter((entry) => entry.ok)
const failed = results.filter((entry) => !entry.ok)
console.log(`\npassed ${ok.length}/${results.length} in ${Math.round((Date.now() - started) / 1000)}s`)

const reasons = new Map()
for (const entry of failed) {
  const key = (entry.error ?? 'unknown').replace(/[0-9a-f]{8,}/gi, '<id>').replace(/\d+/g, 'N').slice(0, 90)
  reasons.set(key, (reasons.get(key) ?? 0) + 1)
}
console.log('\nfailure groups:')
for (const [reason, count] of [...reasons].sort((a, b) => b[1] - a[1])) console.log(`  ${count.toString().padStart(4)}  ${reason}`)
console.log('\nfirst failures:')
for (const entry of failed.slice(0, 25)) console.log(`  ${entry.slug} [${entry.stage}] ${entry.error}`)
if (OUT) {
  await writeFile(OUT, JSON.stringify({ origin: ORIGIN, at: new Date().toISOString(), total: results.length, ok: ok.length, results }, null, 2))
  console.log(`\nwrote ${OUT}`)
}
