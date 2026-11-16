// Guard the one production deployment config. Local Worker and legacy Sites
// files are allowed for development, but they must not become production by
// accident.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const configPath = join(root, 'pages', 'wrangler.jsonc')
if (!existsSync(configPath)) {
  console.error('Missing pages/wrangler.jsonc; production has no deployment config.')
  process.exit(1)
}

const config = JSON.parse(readFileSync(configPath, 'utf8'))
const fail = (message) => {
  console.error(`pages config: ${message}`)
  process.exit(1)
}
const d1 = (entries) => entries?.find((entry) => entry.binding === 'DB')

if (config.name !== 'ink-jo3') fail('name must be ink-jo3')
if (config.pages_build_output_dir !== '../dist/client') fail('pages_build_output_dir must be ../dist/client')
if (config.vars?.APP_ORIGIN !== 'https://ink.7394.jo3.org') fail('production APP_ORIGIN must be the custom domain')

const productionDb = d1(config.d1_databases)
if (productionDb?.database_name !== 'ink-live') fail('production DB must be ink-live')
const previewDb = d1(config.env?.preview?.d1_databases)
if (previewDb?.database_name !== 'ink-live-preview') fail('preview DB must be ink-live-preview')
if (previewDb?.database_id === productionDb?.database_id) fail('preview and production must not share a database')

console.log('pages config: ink-jo3 / ink-live (preview: ink-live-preview)')
