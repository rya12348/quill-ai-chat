// Runs one real Vercel Sandbox check against a two-file workspace, so the
// configured token, project and runtime are proven before a build relies on
// them. Values come from .env; the token is never printed.
import { existsSync, readFileSync } from 'node:fs'

import type { WorkspaceFile } from '../src/shared/workspace'
import { runWorkspaceSandbox, sandboxConfigured } from '../src/worker/sandbox'

function readEnv(): Record<string, string> {
  const values: Record<string, string> = {}
  for (const name of ['.env', '.env.local']) {
    if (!existsSync(name)) continue
    for (const line of readFileSync(name, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
      if (!match) continue
      let value = match[2]!.trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (value) values[match[1]!] = value
    }
  }
  return values
}

const env = readEnv()
if (!sandboxConfigured(env)) {
  console.error('VERCEL_TOKEN and VERCEL_PROJECT_ID must both be set in .env.')
  process.exit(1)
}

// `--broken` sends a page that references a file it does not have, which the
// checker must reject. A green run and a red run prove both halves of the loop:
// one shows the sandbox works, the other shows it can feed a repair turn.
const broken = process.argv.includes('--broken')

const files: WorkspaceFile[] = [
  {
    path: 'index.html',
    content:
      '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Smoke</title>' +
      `<link rel="stylesheet" href="${broken ? 'missing.css' : 'styles.css'}"></head>` +
      '<body><h1>Smoke</h1></body></html>',
  },
  { path: 'styles.css', content: 'body { margin: 0 }' },
]

console.log(`project ${env.VERCEL_PROJECT_ID!.slice(0, 8)}… runtime ${env.SANDBOX_RUNTIME || 'node24'}`)
const outcome = await runWorkspaceSandbox(env, files)
const { configured, ...rest } = outcome
console.log(JSON.stringify({ configured, ...rest }, null, 2))
const expected = broken ? 'fail' : 'pass'
if (outcome.status !== expected) {
  console.error(`expected ${expected}, got ${outcome.status}`)
  process.exit(1)
}
