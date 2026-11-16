import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { createServer } from 'node:http'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { WebSocket, WebSocketServer } from 'ws'

/**
 * Ink's opt-in local browser bridge.
 *
 * Ink normally drives a remote Steel browser. This bridge gives the same page
 * a fast local Chrome instead: it launches Chrome with a dedicated profile,
 * exposes one loopback WebSocket, and proxies that socket to the page target's
 * Chrome DevTools Protocol endpoint. The Ink web app only connects to
 * 127.0.0.1, so the browser never needs a public tunnel or an extension.
 *
 * Usage:
 *   node scripts/local-bridge.mjs
 *   node scripts/local-bridge.mjs --profile "C:\\path\\to\\Chrome\\User Data"
 *
 * The dedicated profile keeps its own Google sign-in. Pass your real Chrome
 * profile path only while Chrome is closed if you want the bridge to reuse an
 * existing local session. The bridge never sends the profile anywhere.
 */

const CDP_PORT = Number(process.env.INK_CDP_PORT || 9223)
const BRIDGE_PORT = Number(process.env.INK_BRIDGE_PORT || 8765)
const profileIndex = process.argv.indexOf('--profile')
const PROFILE = resolve(
  process.env.INK_CHROME_PROFILE ||
    process.argv.find((arg) => arg.startsWith('--profile='))?.slice('--profile='.length) ||
    (profileIndex >= 0 ? process.argv[profileIndex + 1] : '') ||
    join(process.cwd(), '.ink-chrome-profile'),
)

const APP_ORIGINS = new Set(
  [
    'https://site-1e57838821c04678b102909bd13e897d.freebuff.page',
    'https://site-d487210d16384bf6a8003bd3c398cc14.freebuff.page',
    // Free tunnel origins for this dev session. Exact origins only: a wildcard
    // would let any page on a tunnel provider control the local browser.
    'https://671a2877109835.app.lhr.life',
    'https://e628a74aaf5bc55c-73-159-248-190.serveousercontent.com',
    'https://s6lpo3-ip-73-159-248-190.tunnelmole.net',
    'https://ink-live.cadoffryan.workers.dev',
    'http://127.0.0.1:5180',
    'http://localhost:5180',
    process.env.INK_APP_ORIGIN,
  ].filter(Boolean),
)
// Chrome itself must only accept the bridge's origin. A wildcard would let any
// webpage reach the loopback debugging port directly and bypass Ink's bridge.
const BRIDGE_ORIGIN = `http://127.0.0.1:${BRIDGE_PORT}`

const chromeCandidates = process.platform === 'win32'
  ? [
      join(process.env['PROGRAMFILES'] || '', 'Google/Chrome/Application/chrome.exe'),
      join(process.env['PROGRAMFILES(X86)'] || '', 'Google/Chrome/Application/chrome.exe'),
      join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
      join(process.env['PROGRAMFILES'] || '', 'Microsoft/Edge/Application/msedge.exe'),
    ]
  : process.platform === 'darwin'
    ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge']
    : ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge']

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function cdpJson(path) {
  const response = await fetch(`http://127.0.0.1:${CDP_PORT}${path}`, { signal: AbortSignal.timeout(2_000) })
  if (!response.ok) throw new Error(`Chrome CDP returned HTTP ${response.status}`)
  return response.json()
}

async function waitForChrome() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const version = await cdpJson('/json/version')
      if (version?.webSocketDebuggerUrl) return version
    } catch {
      /* Chrome is still starting. */
    }
    await sleep(250)
  }
  throw new Error(`Chrome did not expose CDP on 127.0.0.1:${CDP_PORT}.`)
}

async function ensureChrome() {
  try {
    return await cdpJson('/json/version')
  } catch {
    /* Launch it below. */
  }
  const chrome = (process.env.INK_CHROME_PATH && existsSync(process.env.INK_CHROME_PATH)
    ? process.env.INK_CHROME_PATH
    : chromeCandidates.find((candidate) => candidate && existsSync(candidate)))
  if (!chrome) {
    throw new Error('Chrome or Edge was not found. Set INK_CHROME_PATH to the browser executable.')
  }
  await mkdir(PROFILE, { recursive: true })
  console.log(`[ink] launching ${chrome}`)
  console.log(`[ink] local profile: ${PROFILE}`)
  const child = spawn(
    chrome,
    [
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${PROFILE}`,
      `--remote-allow-origins=${BRIDGE_ORIGIN}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-networking',
      'about:blank',
    ],
    { detached: true, stdio: 'ignore', windowsHide: false },
  )
  child.unref()
  return waitForChrome()
}

// Ink owns one tab. Never attach to the first user tab in the profile (that
// hijacked a course page); prefer a blank tab, otherwise create one, and pin
// its target id for all later reconnects in this bridge process.
let pinnedTargetId = ''

async function pageTarget() {
  let pages = await cdpJson('/json/list')
  let page = pinnedTargetId ? pages.find((target) => target.id === pinnedTargetId && target.webSocketDebuggerUrl) : null
  const marker = `http://127.0.0.1:${BRIDGE_PORT}/blank`
  // Reuse only our own marker tab. A user's about:blank tab is not ours to
  // navigate, and reusing it was making Ink take over unrelated work.
  if (!page) page = pages.find((target) => (target.url || '').startsWith(marker))
  if (!page?.webSocketDebuggerUrl) {
    const created = await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?${marker}`, { method: 'PUT' })
      .then((response) => response.json())
      .catch(() => null)
    await sleep(200)
    pages = await cdpJson('/json/list')
    page = created?.webSocketDebuggerUrl ? pages.find((target) => target.id === created.id) : null
    if (!page) page = pages.find((target) => (target.url || '').startsWith(marker))
  }
  if (!page?.webSocketDebuggerUrl) throw new Error('Chrome has no page target yet.')
  pinnedTargetId = page.id
  return page
}

// Start Chrome before accepting targets. The listen callback can race an app
// connection; awaiting this promise makes the first click deterministic.
let chromeReady = ensureChrome()

const http = createServer((request, response) => {
  const origin = request.headers.origin || ''
  if (request.url === '/blank') {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    response.end('<!doctype html><title>Ink</title><body style="font-family:system-ui;color:#555;padding:24px">Ink owns this tab. Start a task in the Ink browser.</body>')
    return
  }
  if (request.url === '/health') {
    response.writeHead(200, {
      'content-type': 'application/json',
      // The health probe contains no page data. A wildcard lets the app tell
      // “bridge is running but this address is not allowed” apart from “bridge
      // is not running” without exposing the bridge itself.
      'access-control-allow-origin': '*',
      'access-control-allow-private-network': 'true',
    })
    response.end(JSON.stringify({ ok: true, cdpPort: CDP_PORT, bridgePort: BRIDGE_PORT }))
    return
  }
  response.writeHead(404, { 'content-type': 'text/plain' })
  response.end('Ink local bridge. Connect over WebSocket on this port.')
})

const wss = new WebSocketServer({
  server: http,
  maxPayload: 8 * 1024 * 1024,
  verifyClient(info, callback) {
    const origin = info.origin || ''
    if (APP_ORIGINS.has(origin)) return callback(true)
    console.warn(`[ink] rejected WebSocket origin: ${origin || '(none)'}`)
    callback(false, 403, 'Origin not allowed')
  },
})

// One Chrome target, one controller. Two Ink tabs used to attach at once; each
// could navigate and snapshot the same page, so a planner in one tab saw the
// other tab's page (for example, Classroom during a Wikipedia task). A newer
// local tab can take over, but a remote page must never displace the app on
// this computer: a background tab from another origin was closing live runs.
let activeApp = null
let activeOrigin = ''
const isLoopbackOrigin = (origin) => /^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/i.test(origin)

wss.on('connection', async (app, request) => {
  const origin = request.headers.origin || ''
  if (activeApp && activeApp !== app && activeApp.readyState === WebSocket.OPEN) {
    if (!isLoopbackOrigin(origin) && isLoopbackOrigin(activeOrigin)) {
      console.warn(`[ink] refused remote takeover from ${origin || '(none)'}`)
      app.close(1008, 'The local browser is already in use by this computer')
      return
    }
    console.warn('[ink] replacing the previous Ink controller')
    try {
      activeApp.close(1000, 'Another Ink tab took over the local browser')
    } catch {
      /* The old socket is already gone. */
    }
  }
  activeApp = app
  activeOrigin = origin
  app.on('close', () => {
    if (activeApp === app) {
      activeApp = null
      activeOrigin = ''
    }
  })
  console.log(`[ink] app connected from ${request.headers.origin || '(no origin)'}`)
  let target
  try {
    // A cached startup promise can outlive Chrome. Re-check (and relaunch) on
    // every new controller so pressing Run after a browser crash recovers.
    await ensureChrome()
    target = await pageTarget()
    console.log('[ink] selected page target', target.webSocketDebuggerUrl)
  } catch (error) {
    console.warn('[ink] target lookup failed:', error instanceof Error ? error.message : error)
    app.close(1011, error instanceof Error ? error.message : 'Chrome target unavailable')
    return
  }
  // Existing tabs belong to the person. Only follow page targets created after
  // this controller attached, which is how a real link with target=_blank or
  // a Google Docs create action gets its own tab.
  const knownPageIds = new Set((await cdpJson('/json/list').catch(() => [])).map((page) => page.id).filter(Boolean))
  knownPageIds.add(target.id)
  let chrome = new WebSocket(target.webSocketDebuggerUrl, {
    headers: { Origin: BRIDGE_ORIGIN },
    maxPayload: 8 * 1024 * 1024,
  })
  let currentTargetId = target.id
  // Keep the tab that started the session available when a popup or a
  // target=_blank tab closes. Previously the bridge closed that socket when it
  // followed the popup, and closing the popup then killed the whole session.
  let fallbackChrome = null
  let fallbackTargetId = null
  let switchingTarget = false
  const queued = []
  chrome.on('open', () => {
    console.log('[ink] chrome target connected')
    app.send(JSON.stringify({ type: 'bridge-ready', target: { id: target.id, url: target.url, title: target.title } }))
    // The app can send its first Runtime.evaluate as soon as its socket opens,
    // before Chrome finishes its handshake. Keep those early messages instead
    // of dropping the first action of every session.
    while (queued.length) chrome.send(queued.shift())
  })
  chrome.on('message', (data) => {
    if (app.readyState === WebSocket.OPEN) app.send(data.toString())
  })
  chrome.on('close', (code) => {
    console.warn('[ink] chrome target closed:', code)
    // This close is expected while following a new Docs tab. Do not tear down
    // the app socket that is now routed to the replacement target.
    if (switchingTarget) return
    if (app.readyState === WebSocket.OPEN) app.close(1012, 'Chrome target closed')
    // Keep the bridge useful after a Chrome crash or a closed window. The next
    // Run reconnects to this freshly launched browser.
    chromeReady = ensureChrome().catch((error) => {
      console.warn('[ink] Chrome relaunch failed:', error instanceof Error ? error.message : error)
      return null
    })
  })
  chrome.on('error', (error) => {
    console.warn('[ink] chrome socket error:', error.message)
    if (app.readyState === WebSocket.OPEN) app.close(1011, 'Chrome socket error')
  })
  chrome.on('unexpected-response', (_request, response) => {
    console.warn('[ink] chrome refused WebSocket:', response.statusCode)
    if (app.readyState === WebSocket.OPEN) app.close(1011, 'Chrome refused WebSocket')
  })
  // A link or create action can open a new tab. Follow that tab instead of
  // driving a background page while the person looks at the new one.
  const followNewTarget = async () => {
    if (switchingTarget || app.readyState !== WebSocket.OPEN) return
    try {
      const pages = await cdpJson('/json/list')
      const next = [...pages].reverse().find(
        (page) =>
          page.type === 'page' &&
          page.webSocketDebuggerUrl &&
          page.id !== currentTargetId &&
          !knownPageIds.has(page.id) &&
          !/^(?:about:blank|chrome:|devtools:|chrome-extension:)/i.test(page.url || ''),
      )
      if (!next) return
      switchingTarget = true
      knownPageIds.add(next.id)
      const replacement = new WebSocket(next.webSocketDebuggerUrl, {
        headers: { Origin: BRIDGE_ORIGIN },
        maxPayload: 8 * 1024 * 1024,
      })
      replacement.on('open', () => {
        // Hold on to the tab we came from instead of closing it. A popup is
        // temporary; the course or document tab is where the task continues.
        if (fallbackChrome && fallbackChrome !== chrome) fallbackChrome.close()
        fallbackChrome = chrome
        fallbackTargetId = currentTargetId
        chrome = replacement
        currentTargetId = next.id
        console.log('[ink] following new page target', next.id)
        while (queued.length) replacement.send(queued.shift())
        if (app.readyState === WebSocket.OPEN) {
          app.send(JSON.stringify({ type: 'bridge-ready', target: { id: next.id, url: next.url, title: next.title } }))
        }
        // Allow the next opener; the guard only protects the close event from
        // the socket we just replaced.
        setTimeout(() => { switchingTarget = false }, 800)
      })
      replacement.on('message', (data) => {
        if (app.readyState === WebSocket.OPEN) app.send(data.toString())
      })
      replacement.on('close', (code) => {
        console.warn('[ink] followed target closed:', code)
        // The popup closed. Go back to the page that opened it instead of
        // ending the session; the task is still there.
        if (fallbackChrome && fallbackChrome.readyState === WebSocket.OPEN && fallbackTargetId) {
          const previous = fallbackChrome
          chrome = previous
          currentTargetId = fallbackTargetId
          pinnedTargetId = fallbackTargetId
          fallbackChrome = null
          fallbackTargetId = null
          console.log('[ink] popup closed; returning to main target', currentTargetId)
          if (app.readyState === WebSocket.OPEN) {
            app.send(JSON.stringify({ type: 'bridge-ready', target: { id: currentTargetId } }))
          }
          return
        }
        if (app.readyState === WebSocket.OPEN) app.close(1012, 'Chrome target closed')
      })
      replacement.on('error', (error) => console.warn('[ink] followed target error:', error.message))
    } catch (error) {
      console.warn('[ink] target follow failed:', error instanceof Error ? error.message : error)
    }
  }

  app.on('message', (data) => {
    // Log only the CDP method, never page text or typed values.
    let method = ''
    let opensTab = false
    try {
      const payload = JSON.parse(data.toString())
      method = payload?.method || ''
      if (method) console.log('[ink]', method)
      if (method === 'Page.navigate' || method === 'Input.dispatchMouseEvent') opensTab = true
      if (method === 'Runtime.evaluate' && /\.click\s*\(/.test(String(payload?.params?.expression || ''))) opensTab = true
    } catch {
      /* Ignore malformed client messages. */
    }
    if (chrome.readyState === WebSocket.OPEN) chrome.send(data.toString())
    else if (chrome.readyState === WebSocket.CONNECTING) queued.push(data.toString())
    if (opensTab) setTimeout(() => { void followNewTarget() }, 1_100)
  })
  app.on('close', () => chrome.close())
})

http.listen(BRIDGE_PORT, '127.0.0.1', async () => {
  try {
    const version = await chromeReady
    console.log(`[ink] local Chrome CDP ready: ${version.Browser || 'Chrome'}`)
    console.log(`[ink] bridge listening on ws://127.0.0.1:${BRIDGE_PORT}`)
    console.log('[ink] open the Ink Browser page and choose “Use local Chrome”.')
  } catch (error) {
    console.error('[ink] local browser failed:', error instanceof Error ? error.message : error)
    process.exitCode = 1
    http.close()
  }
})
