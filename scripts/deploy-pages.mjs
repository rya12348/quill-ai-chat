// Deploy the built app to the Cloudflare Pages project behind
// www.inkbrowser.dpdns.org. Pages only reads a Wrangler config from the directory it
// runs in, so pages/wrangler.jsonc is the persistent project config and this
// script supplies the one file Pages needs beside the static assets.
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { closeSync, copyFileSync, existsSync, openSync, readFileSync, rmSync, unlinkSync, writeSync } from 'node:fs'
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

// Two deploys of the same checkout race over dist/client/_worker.js: each copy
// in, then deletes it in its own finally. When they overlap, one uploads a
// directory whose worker the other just removed, Pages publishes it, and the
// site answers every /api/* request with the SPA document — a site that looks
// fine and whose game cannot start. So deploys take a lock, and the worker is
// re-checked immediately before the upload.
const LOCK = join(root, 'dist', '.deploy.lock')
const LOCK_STALE_MS = 15 * 60_000
const LOCK_WAIT_MS = 5 * 60_000

async function acquireDeployLock() {
  const started = Date.now()
  for (;;) {
    try {
      const fd = openSync(LOCK, 'wx')
      writeSync(fd, String(Date.now()))
      closeSync(fd)
      return () => {
        try {
          unlinkSync(LOCK)
        } catch {}
      }
    } catch {
      let age = 0
      try {
        age = Date.now() - Number(readFileSync(LOCK, 'utf8')) || 0
      } catch {}
      if (age > LOCK_STALE_MS) {
        try {
          unlinkSync(LOCK)
        } catch {}
        continue
      }
      if (Date.now() - started > LOCK_WAIT_MS) {
        throw new Error('Another deploy has held dist/.deploy.lock for over five minutes; remove it if no deploy is running.')
      }
      await new Promise((resolve) => setTimeout(resolve, 3_000))
    }
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
  // 40 seconds, not 15: one good deploy still 404'd for longer than the old
  // window and the script reported a failure for a site that was serving fine.
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      health = await requestJson(`${url}/api/health`)
      if (health.response.status === 200 && health.body?.ok === true) break
      healthError = `health check failed (${health.response.status}): ${health.text.slice(0, 200)}`
    } catch (error) {
      healthError = error instanceof Error ? error.message : String(error)
    }
    if (attempt < 19) await new Promise((resolve) => setTimeout(resolve, 2_000))
  }
  if (!health || health.response.status !== 200 || health.body?.ok !== true) {
    throw new Error(healthError ?? 'health check failed')
  }

  // The same reasoning as the health retry above, and the same failure I hit
  // twice: for a few seconds a fresh deployment answers /api/* with the SPA
  // document and a 404. That is the edge catching up, not a broken build.
  let ready
  for (let attempt = 0; attempt < 8; attempt += 1) {
    ready = await requestJson(`${url}/api/ready`)
    if (ready.response.status === 200 && ready.body?.ok === true) break
    if (attempt < 7) await new Promise((resolve) => setTimeout(resolve, 1_500))
  }
  if (!ready || ready.response.status !== 200 || ready.body?.ok !== true) {
    throw new Error(`readiness check failed (${ready?.response.status}): ${(ready?.text ?? '').slice(0, 400)}`)
  }

  // A deploy made from the wrong directory makes Wrangler ignore the config,
  // and it still uploads and still passes health: the only symptom is that the
  // vars and bindings are gone and agent mode answers 503 until someone looks.
  // Readiness is where that shows, so a deploy that lost them is not a deploy.
  for (const [key, present] of [
    ['sandbox', ready.body?.sandbox === true],
    ['browser', ready.body?.browser === true],
    ['agentUnlimited', ready.body?.agentUnlimited === true],
  ]) {
    if (!present) {
      throw new Error(
        `readiness reports ${key}=false on ${url}: this deployment is missing its config (vars/bindings). ` +
          'Deploy from the directory whose wrangler.jsonc has pages_build_output_dir, then check /api/ready.',
      )
    }
  }

  // The whole point of this deploy: if the game API is answered by the SPA
  // document instead of the Worker, the table cannot even be opened. That is
  // exactly what a workerless upload looks like, and health alone misses it.
  let table
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const probe = await requestJson(`${url}/api/butter/rooms`)
    table = { status: probe.response.status, type: probe.response.headers.get('content-type') ?? '' }
    if (probe.response.status === 200 && table.type.includes('application/json')) break
    if (attempt < 7) await new Promise((resolve) => setTimeout(resolve, 1_500))
  }
  if (!table || table.status !== 200 || !table.type.includes('application/json')) {
    throw new Error(
      `the game API is not being served (${table?.status ?? 'no response'} ${table?.type ?? ''}): this deployment has no Worker behind /api/*`,
    )
  }
  console.log('smoke: the butter game API answers on ' + url)

  // A guest cookie proves D1, the schema and the auth middleware work. The
  // chat turn proves at least one model lane can answer end to end.
  let guest
  for (let attempt = 0; attempt < 5; attempt += 1) {
    guest = await fetch(`${url}/api/auth/guest`, {
      method: 'POST',
      headers: { origin: url, 'content-type': 'application/x-www-form-urlencoded' },
      body: 'returnTo=%2F',
      redirect: 'manual',
      signal: AbortSignal.timeout(20_000),
    })
    if (guest.status === 303 || guest.status === 200) break
    if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, 1_500))
  }
  if (!guest || (guest.status !== 303 && guest.status !== 200)) {
    throw new Error(`guest sign-in failed (${guest?.status})`)
  }
  const setCookie = guest.headers.getSetCookie?.() ?? (guest.headers.get('set-cookie') ? [guest.headers.get('set-cookie')] : [])
  const cookie = setCookie.map((value) => value.split(';')[0]).filter(Boolean).join('; ')
  if (!cookie) throw new Error('guest sign-in returned no cookie')

  // The edge can still answer from the build it had a moment ago. A stale build
  // that predates /api/chat answers health and guest sign-in fine and then 404s
  // the chat route with the SPA document, which looks like a code failure and is
  // not one. Retry once before calling it broken.
  let chat
  let stream = ''
  for (let attempt = 0; attempt < 2; attempt += 1) {
    chat = await fetch(`${url}/api/chat`, {
      method: 'POST',
      headers: { origin: url, 'content-type': 'application/json', cookie },
      body: JSON.stringify({ content: 'Reply with exactly: ready', strategy: 'fast' }),
      signal: AbortSignal.timeout(60_000),
    })
    stream = await chat.text()
    const good = chat.status === 200 && /"type":"done"/.test(stream) && /"content":"(?:[^"\\]|\\.)+"/.test(stream)
    if (good) break
    if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 4_000))
  }
  if (!chat || chat.status !== 200 || !/"type":"done"/.test(stream)) {
    throw new Error(`guest chat failed (${chat?.status}): ${stream.slice(0, 400)}`)
  }

  console.log(`smoke: health, readiness, and guest chat passed at ${url}`)
}

async function main() {
  const releaseLock = await acquireDeployLock()
  copyFileSync(worker, pagesWorker)
  try {
    if (branch === 'main') {
      const backup = spawnSync(process.execPath, [join(root, 'scripts', 'db-backup.mjs')], { cwd: root, stdio: 'inherit' })
      if (backup.error) throw backup.error
      if (backup.status !== 0) throw new Error('Production backup failed; deployment stopped.')
    }
    // The Vite plugin leaves a redirect to dist/ai_chat/wrangler.json here, and
    // the backup step above can put it back. Pages rejects two competing
    // configs, so remove it as late as possible: right before the upload.
    rmSync(join(root, '.wrangler', 'deploy', 'config.json'), { force: true })
    if (!existsSync(pagesWorker)) {
      throw new Error('dist/client/_worker.js disappeared before upload; refusing to publish a site with no API.')
    }
    const result = await runDeploy()
    if (result.code !== 0) throw new Error(`wrangler pages deploy exited ${result.code}`)

    const escaped = project.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const matches = [...result.output.matchAll(new RegExp(`https://[a-z0-9-]+\\.${escaped}\\.pages\\.dev`, 'g'))]
    const deploymentUrl = matches.at(-1)?.[0]
    const smokeUrl = process.env.PAGES_SMOKE_URL?.trim() || deploymentUrl || (branch === 'main' ? `https://${project}.pages.dev` : '')
    if (!smokeUrl) throw new Error('Could not determine the deployment URL for the smoke test.')
    console.log(`smoke target: ${smokeUrl}`)
    await smoke(smokeUrl)
  } finally {
    rmSync(pagesWorker, { force: true })
    releaseLock()
  }
}

try {
  await main()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
