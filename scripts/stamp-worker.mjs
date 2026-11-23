// Copy the built worker to dist/client/_worker.js with the build stamp filled
// in, so the deployed site can answer /api/version with the commit it is running.
//
// The deploy script does the same thing inline before every upload; this entry
// point exists for the second host (ink-harbor-2f9), which is deployed by hand
// with wrangler. Deploying an unstamped worker there would leave /api/version
// answering `dev` and defeat the check.
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const source = join(root, 'dist', 'ai_chat', 'index.js')
const target = join(root, 'dist', 'client', '_worker.js')

function git(args, fallback) {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim() || fallback
  } catch {
    return fallback
  }
}

const commit = `${process.env.PAGES_COMMIT_HASH?.trim() || git(['rev-parse', 'HEAD'], 'unknown')}${
  git(['status', '--porcelain'], '') ? '-dirty' : ''
}`
const builtAt = new Date().toISOString()

// Escaped quotes so this works whether the bundle emitted the placeholder in
// single or double quotes; a JS string turns `\"` back into `"` either way.
const stamp = JSON.stringify({ commit, builtAt }).replaceAll('"', '\\"')
writeFileSync(target, readFileSync(source, 'utf8').replaceAll('__INK_STAMP__', stamp))
console.log(`stamped ${target} with ${commit} at ${builtAt}`)
