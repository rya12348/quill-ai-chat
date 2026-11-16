// Deploy the built app to the Cloudflare Pages project behind
// ink.7394.jo3.org. Pages only reads a Wrangler config from the directory it
// runs in, so pages/wrangler.jsonc is the persistent project config and this
// script supplies the one file Pages needs beside the static assets.
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const pagesDir = join(root, 'pages')
const worker = join(root, 'dist', 'ai_chat', 'index.js')
const assets = join(root, 'dist', 'client')
const pagesWorker = join(assets, '_worker.js')
const wrangler = join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js')
const project = process.env.PAGES_PROJECT?.trim() || 'ink-jo3'
const branch = process.env.PAGES_BRANCH?.trim() || 'main'

function git(args, fallback) {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim() || fallback
  } catch {
    return fallback
  }
}

const commitHash = process.env.PAGES_COMMIT_HASH?.trim() || git(['rev-parse', 'HEAD'], 'unknown')
const commitMessage = process.env.PAGES_COMMIT_MESSAGE?.trim() || git(['log', '-1', '--pretty=%s'], 'Deploy')
const commitDirty = process.env.PAGES_COMMIT_DIRTY?.trim() || (git(['status', '--porcelain'], '') ? 'true' : 'false')

for (const path of [worker, assets, wrangler]) {
  if (!existsSync(path)) {
    console.error(`Missing ${path}. Run \`npm run build\` first.`)
    process.exit(1)
  }
}

function runDeploy() {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        wrangler,
        'pages',
        'deploy',
        '--project-name',
        project,
        '--branch',
        branch,
        '--commit-hash',
        commitHash,
        '--commit-message',
        commitMessage.slice(0, 200),
        `--commit-dirty=${commitDirty}`,
      ],
      { cwd: pagesDir },
    )
    let output = ''
    for (const stream of [child.stdout, child.stderr]) {
      stream.on('data', (chunk) => {
        output += chunk
        process.stdout.write(chunk)
      })
    }
    child.on('error', reject)
    child.on('close', (code) => resolve({ code: code ?? 1, output }))
  })
}

async function requestJson(url, init) {
  const response = await fetch(url, {
    ...init,
    cache: 'no-store',
    signal: AbortSignal.timeout(30_000),
  })
  const text = await response.text()
  let body
  try {
    body = JSON.parse(text)
  } catch {
    body = undefined
  }
  return { response, text, body }
}

async function smoke(url) {
  // Pages can answer from the previous deployment for a few seconds after the
  // upload. Retry the first health request instead of failing a good deploy.
  let health
  let healthError
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      health = await requestJson(`${url}/api/health`)
      if (health.response.status === 200 && health.body?.ok === true) break
      healthError = `health check failed (${health.response.status}): ${health.text.slice(0, 200)}`
    } catch (error) {
      healthError = error instanceof Error ? error.message : String(error)
    }
    if (attempt < 9) await new Promise((resolve) => setTimeout(resolve, 1_500))
  }
  if (!health || health.response.status !== 200 || health.body?.ok !== true) {
    throw new Error(healthError ?? 'health check failed')
  }

  const ready = await requestJson(`${url}/api/ready`)
  if (ready.response.status !== 200 || ready.body?.ok !== true) {
    throw new Error(`readiness check failed (${ready.response.status}): ${ready.text.slice(0, 400)}`)
  }

  // A guest cookie proves D1, the schema and the auth middleware work. The
  // chat turn proves at least one model lane can answer end to end.
  const guest = await fetch(`${url}/api/auth/guest`, {
    method: 'POST',
    headers: { origin: url, 'content-type': 'application/x-www-form-urlencoded' },
    body: 'returnTo=%2F',
    redirect: 'manual',
    signal: AbortSignal.timeout(20_000),
  })
  if (guest.status !== 303 && guest.status !== 200) {
    throw new Error(`guest sign-in failed (${guest.status})`)
  }
  const setCookie = guest.headers.getSetCookie?.() ?? (guest.headers.get('set-cookie') ? [guest.headers.get('set-cookie')] : [])
  const cookie = setCookie.map((value) => value.split(';')[0]).filter(Boolean).join('; ')
  if (!cookie) throw new Error('guest sign-in returned no cookie')

  const chat = await fetch(`${url}/api/chat`, {
    method: 'POST',
    headers: { origin: url, 'content-type': 'application/json', cookie },
    body: JSON.stringify({ content: 'Reply with exactly: ready', strategy: 'fast' }),
    signal: AbortSignal.timeout(60_000),
  })
  const stream = await chat.text()
  if (chat.status !== 200 || !/"type":"done"/.test(stream) || !/"content":"(?:[^"\\]|\\.)+"/.test(stream)) {
    throw new Error(`guest chat failed (${chat.status}): ${stream.slice(0, 400)}`)
  }

  console.log(`smoke: health, readiness, and guest chat passed at ${url}`)
}

async function main() {
  copyFileSync(worker, pagesWorker)
  try {
    // The Vite plugin leaves a redirect to dist/ai_chat/wrangler.json here.
    // Pages rejects two competing configs, so remove the generated redirect.
    rmSync(join(root, '.wrangler', 'deploy', 'config.json'), { force: true })
    if (branch === 'main') {
      const backup = spawnSync(process.execPath, [join(root, 'scripts', 'db-backup.mjs')], { cwd: root, stdio: 'inherit' })
      if (backup.error) throw backup.error
      if (backup.status !== 0) throw new Error('Production backup failed; deployment stopped.')
    }
    const result = await runDeploy()
    if (result.code !== 0) throw new Error(`wrangler pages deploy exited ${result.code}`)

    const escaped = project.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const matches = [...result.output.matchAll(new RegExp(`https://[a-z0-9-]+\\.${escaped}\\.pages\\.dev`, 'g'))]
    const deploymentUrl = matches.at(-1)?.[0]
    const smokeUrl = process.env.PAGES_SMOKE_URL?.trim() || deploymentUrl || (branch === 'main' ? `https://${project}.pages.dev` : '')
    if (!smokeUrl) throw new Error('Could not determine the deployment URL for the smoke test.')
    await smoke(smokeUrl)
  } finally {
    rmSync(pagesWorker, { force: true })
  }
}

try {
  await main()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
