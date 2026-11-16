// Copy the provider and auth secrets production needs from local env files to
// the Cloudflare Pages project. Values are never printed; only names are shown.
// The Pages project is the source of truth for the deployed secret values.
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const pagesDir = join(root, 'pages')
const wrangler = join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js')
const project = process.env.PAGES_PROJECT?.trim() || 'ink-jo3'
const temp = join(root, '.tmp-pages-secrets.json')
const allowed = new Set([
  'OPENAI_API_KEY',
  'OPENAI_BASE_URL',
  'FREEBUFF_CLIENT_ID',
  'FREEBUFF_ISSUER',
  'OWNER_SUB',
  'AIHUBMIX_API_KEY',
  'COHERE_API_KEY',
  'DEEPSEEK_API_KEY',
  'DASHSCOPE_API_KEY',
  'DASHSCOPE_MODELS',
  'EXA_API_KEY',
  'GEMINI_API_KEY',
  'GROQ_API_KEY',
  'LLM7_API_KEY',
  'MISTRAL_API_KEY',
  'MODELSCOPE_API_KEY',
  'NVIDIA_API_KEY',
  'OLLAMA_API_KEY',
  'OPENROUTER_API_KEY',
  'OPENROUTER_MODELS',
  'POLLINATIONS_API_KEY',
  'SAMBANOVA_API_KEY',
  'STEEL_API_KEY',
  'ZAI_API_KEY',
  'CLOUDFLARE_ACCOUNT_ID',
  'CLOUDFLARE_AI_TOKEN',
])

function parseEnv(text) {
  const values = new Map()
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!match) continue
    let value = match[2].trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (value) values.set(match[1], value)
  }
  return values
}

const values = new Map()
for (const name of ['.env', '.env.local']) {
  const path = join(root, name)
  if (!existsSync(path)) continue
  for (const [key, value] of parseEnv(readFileSync(path, 'utf8'))) {
    if (allowed.has(key)) values.set(key, value)
  }
}
if (!values.size) {
  console.error('No provider or auth secrets found in .env or .env.local.')
  process.exit(1)
}
if (!existsSync(wrangler)) {
  console.error('Wrangler is not installed. Run `npm install` first.')
  process.exit(1)
}

writeFileSync(temp, JSON.stringify(Object.fromEntries(values)))
try {
  const result = spawnSync(
    process.execPath,
    [wrangler, 'pages', 'secret', 'bulk', temp, '--project-name', project],
    { cwd: pagesDir, stdio: 'inherit' },
  )
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
  console.log(`pages secrets: ${[...values.keys()].join(', ')}`)
  console.log('Redeploy Pages for the new secret values to take effect.')
} finally {
  rmSync(temp, { force: true })
}
