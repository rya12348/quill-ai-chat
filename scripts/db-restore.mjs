// Restore a SQL dump into D1. The default target is the isolated preview
// database, so a restore can be rehearsed without touching production.
// Production requires the explicit --production flag.
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const wrangler = join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js')
const args = process.argv.slice(2)
const file = args.find((arg) => !arg.startsWith('-'))
const production = args.includes('--production')
const database = process.env.D1_RESTORE_DATABASE?.trim() || (production ? 'ink-live' : 'ink-live-preview')

if (!file || !existsSync(file)) {
  console.error('Usage: npm run db:restore -- <backup.sql> [--production]')
  process.exit(1)
}
if (!existsSync(wrangler)) {
  console.error('Wrangler is not installed. Run `npm install` first.')
  process.exit(1)
}

console.log(`restore: ${file} -> ${database}${production ? ' (PRODUCTION)' : ' (preview)'}`)
const result = spawnSync(
  process.execPath,
  [wrangler, 'd1', 'execute', database, '--remote', '--yes', `--file=${file}`],
  { stdio: 'inherit' },
)
if (result.error) throw result.error
if (result.status !== 0) process.exit(result.status ?? 1)
