// Export the production D1 database to a timestamped SQL dump plus a checksum.
// Backups are written under backups/ (git-ignored). Run before schema changes
// and on a schedule you control.
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const wrangler = join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js')
const database = process.env.D1_DATABASE?.trim() || 'ink-live'
const backupDir = join(root, 'backups')
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const output = join(backupDir, `${database}-${stamp}.sql`)

if (!existsSync(wrangler)) {
  console.error('Wrangler is not installed. Run `npm install` first.')
  process.exit(1)
}

mkdirSync(backupDir, { recursive: true })
// A generated redirect from the Vite plugin can shadow the root config.
rmSync(join(root, '.wrangler', 'deploy', 'config.json'), { force: true })

const result = spawnSync(
  process.execPath,
  [wrangler, 'd1', 'export', database, '--remote', '--skip-confirmation', `--output=${output}`],
  { encoding: 'utf8' },
)
if (result.error) throw result.error
// Wrangler prints a temporary pre-signed R2 URL. Keep it out of deploy logs
// and CI output; the checksum and local file are the useful artifacts.
for (const line of (result.stdout ?? '').split('\n')) {
  if (!line.includes('.r2.cloudflarestorage.com')) console.log(line)
}
if (result.stderr) process.stderr.write(result.stderr)
if (result.status !== 0) process.exit(result.status ?? 1)

const digest = createHash('sha256').update(readFileSync(output)).digest('hex')
writeFileSync(`${output}.sha256`, `${digest}  ${basename(output)}\n`)
console.log(`backup: ${output}`)
console.log(`sha256: ${digest}`)
