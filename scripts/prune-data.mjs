// Housekeeping for short-lived operational data. User conversations are never
// touched here; they are removed by the owner from Settings.
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

if (!process.argv.includes('--production')) {
  console.error('Refusing to prune without --production. Run: npm run db:prune -- --production')
  process.exit(1)
}

const root = fileURLToPath(new URL('..', import.meta.url))
const wrangler = join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js')
const database = process.env.D1_DATABASE?.trim() || 'ink-live'
const now = Date.now()
const day = 24 * 60 * 60 * 1000
const sql = [
  `DELETE FROM rate_limits WHERE reset_at < ${now}`,
  `DELETE FROM auth_sessions WHERE expires_at < ${now}`,
  `DELETE FROM guest_daily_usage WHERE day_start < ${now - 2 * day}`,
  `DELETE FROM site_visits WHERE last_seen < ${now - 90 * day}`,
  `DELETE FROM http_errors WHERE created_at < ${now - 30 * day}`,
].join('; ')

const result = spawnSync(
  process.execPath,
  [wrangler, 'd1', 'execute', database, '--remote', '--command', sql],
  { cwd: root, stdio: 'inherit' },
)
if (result.error) throw result.error
process.exit(result.status ?? 1)
