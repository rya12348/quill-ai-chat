// Record what the production site says it is running, so a reader that only has
// the repository — an editor, an agent, a person on GitHub — can see which commit
// is live without deploying or guessing.
//
// The source of truth is the site itself: `/api/version` is stamped at upload by
// scripts/deploy-pages.mjs. This script only copies that answer into DEPLOYED.md.
// It never commits; CI does that with `[skip ci]`, and a local deploy commits it
// with the change that caused it.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const file = join(root, 'DEPLOYED.md')
const site = process.env.PAGES_URL?.trim() || 'https://www.inkbrowser.dpdns.org'
const begin = '<!-- deploy:begin -->'
const end = '<!-- deploy:end -->'

let response
let body
try {
  response = await fetch(`${site}/api/version`, {
    headers: { 'cache-control': 'no-cache', 'user-agent': 'ink-record-deploy' },
    signal: AbortSignal.timeout(20_000),
  })
  body = await response.json().catch(() => null)
} catch (error) {
  console.error(`could not read ${site}/api/version: ${error instanceof Error ? error.message : error}`)
  process.exit(1)
}

if (response.status !== 200 || body?.ok !== true || typeof body.commit !== 'string') {
  console.error(`/api/version answered ${response.status}: ${JSON.stringify(body).slice(0, 200)}`)
  process.exit(1)
}
if (body.commit === 'dev') {
  console.error('/api/version answers "dev": the deployed worker was not stamped. Check the upload step.')
  process.exit(1)
}

const block = [
  begin,
  `- live commit: \`${body.commit}\``,
  `- built: ${body.builtAt ?? 'unknown'}`,
  `- checked: ${new Date().toISOString()}`,
  `- site: ${site}`,
  end,
].join('\n')

const current = existsSync(file) ? readFileSync(file, 'utf8') : `# What is live\n\n${begin}\n${end}\n`
if (!current.includes(begin) || !current.includes(end)) {
  console.error(`${file} lost its ${begin} … ${end} markers; not writing.`)
  process.exit(1)
}

const next = current.replace(new RegExp(`${begin}[\\s\\S]*?${end}`), block)
if (next === current) {
  console.log(`DEPLOYED.md already records ${body.commit}`)
} else {
  writeFileSync(file, next)
  console.log(`DEPLOYED.md now records ${body.commit} (built ${body.builtAt ?? 'unknown'})`)
}
