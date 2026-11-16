// A small, dependency-light Chrome DevTools Protocol client for Buffy.
//
// The bridge uses its own headless Chrome profile and debugging port. Ink's
// local-browser bridge already owns port 8765/9223 for the Browser page, so
// Buffy must not attach to that session or steal the person's tab.
//
// The client is deliberately narrow: enough CDP to navigate, read a page,
// click/type, inspect console and network failures, wait for conditions, and
// capture a screenshot. Every public method lazily starts Chrome once.

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { WebSocket } from 'ws'

const CDP_HOST = '127.0.0.1'
const CDP_PORT = Number(process.env.BUFFY_CDP_PORT || 9224)
const PROFILE = process.env.BUFFY_CHROME_PROFILE || join(tmpdir(), 'ink-buffy-chrome')
const DEFAULT_TIMEOUT_MS = 15_000
const MAX_LOGS = 240
const MAX_TEXT = 7_000

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function chromeCandidates() {
  if (process.platform === 'win32') {
    return [
      process.env.BUFFY_CHROME_PATH,
      join(process.env['PROGRAMFILES'] || '', 'Google/Chrome/Application/chrome.exe'),
      join(process.env['PROGRAMFILES(X86)'] || '', 'Google/Chrome/Application/chrome.exe'),
      join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
      join(process.env['PROGRAMFILES'] || '', 'Microsoft/Edge/Application/msedge.exe'),
      join(process.env['PROGRAMFILES(X86)'] || '', 'Microsoft/Edge/Application/msedge.exe'),
    ]
  }
  if (process.platform === 'darwin') {
    return [
      process.env.BUFFY_CHROME_PATH,
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    ]
  }
  return [
    process.env.BUFFY_CHROME_PATH,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/microsoft-edge',
  ]
}

function findChrome() {
  const found = chromeCandidates().find((candidate) => candidate && existsSync(candidate))
  if (!found) {
    throw new Error(
      'Buffy could not find Chrome or Edge. Install Chrome, or set BUFFY_CHROME_PATH to the browser executable.',
    )
  }
  return found
}

/** Local addresses get http automatically; everything else gets https. */
export function normalizePageUrl(raw) {
  const value = String(raw || '').trim()
  if (!value) throw new Error('A URL is required.')
  let candidate = value
  if (!/^[a-z][a-z0-9+.-]*:/i.test(candidate)) {
    const local = /^(?:localhost|127(?:\.\d{1,3}){3}|\[::1\]|0\.0\.0\.0)(?::\d+)?(?:[/?#]|$)/i.test(candidate)
    candidate = `${local ? 'http' : 'https'}://${candidate}`
  }
  const parsed = new URL(candidate)
  if (!['http:', 'https:', 'data:'].includes(parsed.protocol)) {
    throw new Error('Buffy only opens http, https and data pages.')
  }
  return parsed.href
}

function pageTargetFromList(pages) {
  return pages.find((page) => page?.type === 'page' && page.webSocketDebuggerUrl)
}

async function cdpJson(path, timeoutMs = 2_000) {
  const response = await fetch(`http://${CDP_HOST}:${CDP_PORT}${path}`, {
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) throw new Error(`Chrome CDP returned HTTP ${response.status}.`)
  return response.json()
}

/**
 * Runs in the page. It returns a compact accessibility-style snapshot and
 * assigns stable ids to interactive elements for later clicks and typing.
 */
function snapshotPage() {
  const clean = (value, max) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
  const readable = (value, max) =>
    String(value ?? '')
      .replace(/\r/g, '')
      .replace(/[ \t]+/g, ' ')
      .replace(/[ \t]*\n[ \t]*/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .slice(0, max)
  const visible = (element) => {
    if (!element) return false
    const rect = element.getBoundingClientRect()
    const style = getComputedStyle(element)
    return (
      rect.width > 1 &&
      rect.height > 1 &&
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      Number(style.opacity || 1) > 0.01 &&
      rect.bottom > 0 &&
      rect.top < innerHeight &&
      rect.right > 0 &&
      rect.left < innerWidth
    )
  }

  const roots = [document]
  for (let index = 0; index < roots.length; index += 1) {
    for (const host of roots[index].querySelectorAll('*')) {
      if (host.shadowRoot && !roots.includes(host.shadowRoot)) roots.push(host.shadowRoot)
    }
  }

  const ids = window.__buffyIds || (window.__buffyIds = new WeakMap())
  let nextId = window.__buffyNextId || 1
  const byId = {}
  const elements = []
  const selector =
    'a[href],button,input,textarea,select,summary,[contenteditable="true"],[role="button"],[role="link"],[role="textbox"],[role="searchbox"],[role="combobox"],[role="tab"],[role="menuitem"],[role="option"],[role="checkbox"],[role="radio"],[role="switch"],[aria-haspopup]'
  const nodes = roots.flatMap((root) => [...root.querySelectorAll(selector)])
  const seen = new Set()

  for (const element of nodes) {
    if (seen.has(element)) continue
    seen.add(element)
    if (!visible(element)) continue
    let id = ids.get(element)
    if (!id) {
      id = `e${nextId++}`
      ids.set(element, id)
    }
    element.setAttribute('data-buffy-id', id)
    byId[id] = element

    const tag = element.tagName.toLowerCase()
    const type = tag === 'input' ? clean(element.type || 'text', 30).toLowerCase() : ''
    if (type === 'hidden') continue
    const labelNode =
      (element.labels && element.labels[0]) ||
      (element.id
        ? roots.map((root) => root.querySelector?.(`label[for="${CSS.escape(element.id)}"]`)).find(Boolean)
        : null)
    const text = clean(element.innerText || element.textContent || '', 160)
    const label = clean(
      element.getAttribute('aria-label') ||
        element.getAttribute('title') ||
        (labelNode && (labelNode.innerText || labelNode.textContent)) ||
        (tag === 'a' || tag === 'button' || element.getAttribute('role')
          ? text
          : '') ||
        element.getAttribute('placeholder') ||
        text ||
        element.getAttribute('name') ||
        tag,
      160,
    )
    const value = type === 'password' ? '' : clean(element.value, 220)
    const item = {
      id,
      tag,
      role: clean(element.getAttribute('role'), 40),
      label,
      ...(value ? { value } : {}),
      ...(clean(element.getAttribute('placeholder'), 140)
        ? { placeholder: clean(element.getAttribute('placeholder'), 140) }
        : {}),
      ...(type ? { type } : {}),
      ...(tag === 'a' && element.href ? { href: String(element.href).slice(0, 320) } : {}),
      ...(typeof element.checked === 'boolean' ? { checked: element.checked } : {}),
      ...(element.getAttribute('aria-expanded') === 'true' ? { expanded: true } : {}),
      disabled: Boolean(element.disabled || element.getAttribute('aria-disabled') === 'true'),
    }
    if (tag === 'select' && element.options) {
      item.options = [...element.options].slice(0, 30).map((option) => ({
        label: clean(option.textContent, 100),
        value: clean(option.value, 120),
      }))
    }
    elements.push(item)
    if (elements.length >= 180) break
  }

  window.__buffyNextId = nextId
  window.__buffyById = byId
  window.__buffyFind = (target) => {
    if (!target) return null
    if (byId[target]) return byId[target]
    const marked = /^data-buffy-id="([^"]+)"$/.exec(target)
    if (marked && byId[marked[1]]) return byId[marked[1]]
    for (const root of roots) {
      try {
        const found = root.querySelector(target)
        if (found) return found
      } catch {
        /* an invalid selector is not a page failure */
      }
    }
    return null
  }

  const main = document.querySelector('main, [role="main"], article')
  const bodyText =
    main && (main.innerText || '').trim().length > 300
      ? main.innerText || main.textContent || ''
      : document.body
        ? document.body.innerText
        : ''
  const headings = [...document.querySelectorAll('h1,h2,h3,h4,[role="heading"]')]
    .filter(visible)
    .slice(0, 18)
    .map((element) => ({
      level: Math.max(1, Math.min(6, Number(element.getAttribute('aria-level')) || Number(element.tagName.slice(1)) || 2)),
      text: clean(element.innerText || element.textContent, 140),
    }))
    .filter((heading) => heading.text)
  const active = document.activeElement

  return {
    url: location.href,
    title: document.title,
    text: readable(bodyText, 7_000),
    headings,
    elements,
    active: active ? clean(active.getAttribute('aria-label') || active.getAttribute('placeholder') || active.tagName, 160) : '',
    viewport: {
      width: innerWidth,
      height: innerHeight,
      scrollX: Math.round(scrollX),
      scrollY: Math.round(scrollY),
      pageHeight: Math.max(innerHeight, document.documentElement?.scrollHeight || 0),
    },
    at: Date.now(),
  }
}

export class BuffyBrowser {
  constructor() {
    this.socket = null
    this.child = null
    this.ready = false
    this.connecting = null
    this.sequence = 0
    this.pending = new Map()
    this.logEntries = []
    this.requests = new Map()
    this.lastPage = { url: 'about:blank', title: 'New tab' }
    this.closed = false
  }

  status() {
    return {
      connected: Boolean(this.socket && this.socket.readyState === WebSocket.OPEN),
      port: CDP_PORT,
      page: this.lastPage,
    }
  }

  async currentPage() {
    await this.ensure()
    try {
      const value = await this.evaluate('({ url: location.href, title: document.title })')
      if (value && typeof value === 'object') {
        this.lastPage = { url: String(value.url || ''), title: String(value.title || '') }
      }
    } catch {
      /* about:blank and a navigation in progress can reject this read */
    }
    return this.lastPage
  }

  async ensure() {
    if (this.ready && this.socket?.readyState === WebSocket.OPEN) return
    if (this.connecting) return this.connecting
    this.connecting = this.startChrome()
      .catch(async (error) => {
        await this.stopChrome()
        throw error
      })
      .finally(() => {
        this.connecting = null
      })
    return this.connecting
  }

  async startChrome() {
    this.closed = false
    let version = null
    try {
      version = await cdpJson('/json/version', 700)
    } catch {
      /* Chrome is not up yet. */
    }
    if (!version) {
      const executable = findChrome()
      await mkdir(PROFILE, { recursive: true })
      this.child = spawn(
        executable,
        [
          `--remote-debugging-port=${CDP_PORT}`,
          `--remote-allow-origins=*`,
          `--user-data-dir=${PROFILE}`,
          '--headless=new',
          '--disable-gpu',
          '--hide-scrollbars',
          '--no-first-run',
          '--no-default-browser-check',
          '--disable-background-networking',
          '--disable-component-update',
          '--disable-sync',
          '--disable-features=Translate,MediaRouter',
          '--window-size=1280,900',
          'about:blank',
        ],
        { stdio: 'ignore', windowsHide: true },
      )
      this.child.once('exit', () => {
        this.child = null
        this.ready = false
        this.socket = null
      })
      const deadline = Date.now() + 15_000
      while (Date.now() < deadline) {
        try {
          version = await cdpJson('/json/version', 1_000)
          break
        } catch {
          await sleep(250)
        }
      }
      if (!version) throw new Error('Chrome started but its debugging port never became ready.')
    }

    let pages = await cdpJson('/json/list').catch(() => [])
    let target = pageTargetFromList(pages)
    if (!target) {
      const created = await fetch(`http://${CDP_HOST}:${CDP_PORT}/json/new?about:blank`, {
        method: 'PUT',
        signal: AbortSignal.timeout(3_000),
      })
        .then((response) => (response.ok ? response.json() : null))
        .catch(() => null)
      target = created || pageTargetFromList(await cdpJson('/json/list').catch(() => []))
    }
    if (!target?.webSocketDebuggerUrl) throw new Error('Chrome has no page target Buffy can drive.')

    await this.connectSocket(target.webSocketDebuggerUrl)
    await Promise.all([
      this.send('Page.enable'),
      this.send('Runtime.enable'),
      this.send('Log.enable'),
      this.send('Network.enable'),
      this.send('Emulation.setDeviceMetricsOverride', {
        width: 1280,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false,
      }).catch(() => undefined),
    ])
    this.ready = true
  }

  async connectSocket(url) {
    await new Promise((resolve, reject) => {
      const socket = new WebSocket(url, { maxPayload: 16 * 1024 * 1024 })
      const timer = setTimeout(() => {
        socket.close()
        reject(new Error('Chrome DevTools socket did not open.'))
      }, 8_000)
      socket.once('open', () => {
        clearTimeout(timer)
        this.socket = socket
        resolve()
      })
      socket.once('error', (error) => {
        clearTimeout(timer)
        reject(error instanceof Error ? error : new Error('Chrome DevTools socket failed.'))
      })
      socket.on('message', (raw) => this.onMessage(raw))
      socket.on('close', () => {
        if (this.socket === socket) {
          this.socket = null
          this.ready = false
        }
        this.rejectPending(new Error('Chrome DevTools socket closed.'))
      })
      socket.on('error', () => {
        /* the close handler reports the useful failure */
      })
    })
  }

  onMessage(raw) {
    let message
    try {
      message = JSON.parse(String(raw))
    } catch {
      return
    }
    if (message.id) {
      const pending = this.pending.get(message.id)
      if (!pending) return
      this.pending.delete(message.id)
      clearTimeout(pending.timer)
      if (message.error) pending.reject(new Error(message.error.message || `CDP error ${message.error.code || ''}`))
      else pending.resolve(message.result)
      return
    }
    this.onEvent(String(message.method || ''), message.params || {})
  }

  onEvent(method, params) {
    if (method === 'Runtime.consoleAPICalled') {
      const text = (params.args || [])
        .map((arg) => {
          if (arg.value !== undefined) {
            return typeof arg.value === 'string' ? arg.value : JSON.stringify(arg.value)
          }
          return arg.description || arg.type || ''
        })
        .filter(Boolean)
        .join(' ')
      this.addLog({
        source: 'console',
        level: String(params.type || 'log'),
        text,
        url: params.stackTrace?.callFrames?.[0]?.url || '',
      })
      return
    }
    if (method === 'Runtime.exceptionThrown') {
      const details = params.exceptionDetails || {}
      const exception = details.exception || {}
      this.addLog({
        source: 'page',
        level: 'error',
        text: exception.description || details.text || 'Uncaught page exception',
        url: details.url || '',
      })
      return
    }
    if (method === 'Log.entryAdded') {
      const entry = params.entry || {}
      this.addLog({
        source: 'log',
        level: String(entry.level || 'info'),
        text: entry.text || '',
        url: entry.url || '',
      })
      return
    }
    if (method === 'Network.requestWillBeSent') {
      this.requests.set(params.requestId, params.request?.url || '')
      return
    }
    if (method === 'Network.responseReceived') {
      const response = params.response || {}
      const status = Number(response.status || 0)
      if (status >= 400) {
        this.addLog({
          source: 'network',
          level: 'error',
          text: `${status} ${response.statusText || ''} ${response.url || ''}`.trim(),
          url: response.url || '',
        })
      }
      return
    }
    if (method === 'Network.loadingFailed') {
      const url = this.requests.get(params.requestId) || ''
      this.addLog({
        source: 'network',
        level: 'error',
        text: `${params.errorText || 'Request failed'}${params.blockedReason ? ` (${params.blockedReason})` : ''}`,
        url,
      })
    }
  }

  addLog(entry) {
    const text = String(entry.text || '').replace(/\s+/g, ' ').trim().slice(0, 2_000)
    if (!text) return
    this.logEntries.push({ ...entry, text, at: Date.now() })
    if (this.logEntries.length > MAX_LOGS) this.logEntries.splice(0, this.logEntries.length - MAX_LOGS)
  }

  rejectPending(error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer)
      pending.reject(error)
    }
    this.pending.clear()
  }

  send(method, params = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('Chrome is not connected.'))
    }
    const id = ++this.sequence
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`Chrome did not answer ${method} within ${Math.round(timeoutMs / 1_000)}s.`))
      }, timeoutMs)
      this.pending.set(id, { resolve, reject, timer })
      this.socket.send(JSON.stringify({ id, method, params }))
    })
  }

  async evaluate(expression, timeoutMs = DEFAULT_TIMEOUT_MS) {
    const result = await this.send(
      'Runtime.evaluate',
      {
        expression,
        returnByValue: true,
        awaitPromise: true,
        userGesture: true,
      },
      timeoutMs,
    )
    if (result?.exceptionDetails) {
      const detail =
        result.exceptionDetails.exception?.description?.split('\n')[0]?.trim() ||
        result.exceptionDetails.text ||
        'The page raised an exception.'
      throw new Error(detail)
    }
    return result?.result?.value
  }

  async waitReady(timeoutMs = 8_000) {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      try {
        const state = await this.evaluate('document.readyState', 2_000)
        if (state === 'complete' || state === 'interactive') return
      } catch {
        /* a navigation can replace the execution context */
      }
      await sleep(120)
    }
  }

  async navigate(rawUrl, waitUntil = 'load') {
    const url = normalizePageUrl(rawUrl)
    await this.ensure()
    this.logEntries = []
    this.requests.clear()
    await this.send('Page.navigate', { url }, 20_000)
    await sleep(160)
    await this.waitReady(waitUntil === 'networkidle0' ? 12_000 : 8_000)
    if (waitUntil === 'networkidle0') await sleep(650)
    const page = await this.currentPage()
    return { ...page, message: `Opened ${page.url}` }
  }

  async snapshot() {
    await this.ensure()
    await this.waitReady(3_000).catch(() => undefined)
    const value = await this.evaluate(`(${snapshotPage.toString()})()`, 20_000)
    if (!value || typeof value !== 'object' || !value.url) {
      throw new Error('The page did not return a readable snapshot.')
    }
    this.lastPage = { url: String(value.url), title: String(value.title || '') }
    return {
      ...value,
      text: String(value.text || '').slice(0, MAX_TEXT),
      elements: Array.isArray(value.elements) ? value.elements.slice(0, 180) : [],
    }
  }

  async logs({ clear = false } = {}) {
    await this.ensure()
    const entries = this.logEntries.slice()
    if (clear) {
      this.logEntries = []
      this.requests.clear()
    }
    return {
      entries,
      count: entries.length,
      errors: entries.filter((entry) => entry.level === 'error').length,
    }
  }

  async waitFor({ text = '', selector = '', urlContains = '', state = 'visible', timeoutMs = 10_000 } = {}) {
    await this.ensure()
    const timeout = Math.min(120_000, Math.max(250, Number(timeoutMs) || 10_000))
    const deadline = Date.now() + timeout
    if (state === 'time') {
      await sleep(timeout)
      return { ok: true, ...(await this.currentPage()), at: Date.now() }
    }
    const hidden = state === 'hidden'
    while (Date.now() < deadline) {
      const found = await this.evaluate(
        `(() => {
          const wantedText = ${JSON.stringify(String(text || '')).toLowerCase()};
          const wantedUrl = ${JSON.stringify(String(urlContains || ''))};
          const selector = ${JSON.stringify(String(selector || ''))};
          const hidden = ${hidden ? 'true' : 'false'};
          const clean = (value) => String(value ?? '').replace(/\\s+/g, ' ').trim();
          const body = document.body ? document.body.innerText : '';
          const visible = (element) => {
            if (!element) return false;
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return rect.width > 1 && rect.height > 1 && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0.01;
          };
          const find = window.__buffyFind || ((wanted) => document.querySelector(wanted));
          const checks = [];
          if (wantedText) checks.push(body.toLowerCase().includes(wantedText));
          if (wantedUrl) checks.push(location.href.includes(wantedUrl));
          if (selector) checks.push(visible(find(selector)));
          if (!checks.length) return false;
          const met = hidden ? checks.every((value) => !value) : checks.every(Boolean);
          return met;
        })()`,
        3_000,
      ).catch(() => false)
      if (found === true) return { ok: true, ...(await this.currentPage()), at: Date.now() }
      await sleep(180)
    }
    throw new Error(`The page did not reach that state within ${Math.round(timeout / 1_000)}s.`)
  }

  async click({ uid = '', selector = '', text = '' } = {}) {
    await this.ensure()
    const target = selector || (uid ? `[data-buffy-id="${String(uid).replace(/"/g, '\\"')}"]` : '')
    if (!target && !text) throw new Error('Give preview_click a uid from the latest snapshot, a selector, or visible text.')
    const result = await this.evaluate(
      `(() => {
        const find = window.__buffyFind || ((wanted) => document.querySelector(wanted));
        const visible = (element) => {
          if (!element) return false;
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return rect.width > 1 && rect.height > 1 && style.display !== 'none' && style.visibility !== 'hidden';
        };
        let element = ${JSON.stringify(target)} ? find(${JSON.stringify(target)}) : null;
        const wanted = ${JSON.stringify(String(text || '').toLowerCase())};
        if (!element && wanted) {
          const candidates = [...document.querySelectorAll('a,button,summary,[role="button"],[role="link"],[role="menuitem"],[role="tab"],[role="option"],[contenteditable="true"]')].filter(visible);
          let best = null;
          for (const candidate of candidates) {
            const label = String(candidate.innerText || candidate.textContent || candidate.getAttribute('aria-label') || '').replace(/\\s+/g, ' ').trim().toLowerCase();
            const score = label === wanted ? 0 : label.includes(wanted) ? 1 : -1;
            if (score >= 0 && (!best || score < best.score)) best = { element: candidate, score };
          }
          element = best && best.element;
        }
        if (!element) return null;
        element.scrollIntoView({ block: 'center', inline: 'center' });
        if (element.tagName === 'A' && element.target) element.removeAttribute('target');
        const label = String(element.getAttribute('aria-label') || element.innerText || element.textContent || element.getAttribute('placeholder') || element.tagName).replace(/\\s+/g, ' ').trim().slice(0, 160);
        element.focus?.();
        element.click();
        return { label, tag: element.tagName.toLowerCase() };
      })()`,
      20_000,
    )
    if (!result) throw new Error('That control is no longer on the page. Take a fresh preview_snapshot.')
    await sleep(220)
    await this.waitReady(4_000).catch(() => undefined)
    return { ...result, ...(await this.currentPage()) }
  }

  async type({ uid = '', selector = '', text = '', clear = true, pressEnter = false } = {}) {
    await this.ensure()
    const target = selector || (uid ? `[data-buffy-id="${String(uid).replace(/"/g, '\\"')}"]` : '')
    const focused = await this.evaluate(
      `(() => {
        const find = window.__buffyFind || ((wanted) => document.querySelector(wanted));
        const target = ${JSON.stringify(target)};
        const element = target ? find(target) : document.activeElement;
        if (!element) return false;
        element.scrollIntoView({ block: 'center', inline: 'center' });
        element.focus();
        if (${clear ? 'true' : 'false'}) {
          if (element.isContentEditable) {
            element.textContent = '';
          } else {
            const proto = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
            const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
            if (setter) setter.call(element, '');
            else element.value = '';
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
        if (typeof element.select === 'function') { try { element.select(); } catch {} }
        return true;
      })()`,
      10_000,
    )
    if (!focused) throw new Error('That field is no longer on the page. Take a fresh preview_snapshot.')
    if (text) await this.send('Input.insertText', { text })
    if (pressEnter) await this.press('Enter')
    return {
      typed: text.length,
      ...(pressEnter ? { submitted: true } : {}),
      ...(await this.currentPage()),
    }
  }

  async press(key, modifiers = []) {
    await this.ensure()
    const map = {
      Enter: { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 },
      Escape: { key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 },
      Tab: { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 },
      Home: { key: 'Home', code: 'Home', windowsVirtualKeyCode: 36 },
      End: { key: 'End', code: 'End', windowsVirtualKeyCode: 35 },
      Backspace: { key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 },
      Delete: { key: 'Delete', code: 'Delete', windowsVirtualKeyCode: 46 },
      Space: { key: ' ', code: 'Space', windowsVirtualKeyCode: 32 },
      ArrowUp: { key: 'ArrowUp', code: 'ArrowUp', windowsVirtualKeyCode: 38 },
      ArrowDown: { key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 },
      ArrowLeft: { key: 'ArrowLeft', code: 'ArrowLeft', windowsVirtualKeyCode: 37 },
      ArrowRight: { key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 },
      PageUp: { key: 'PageUp', code: 'PageUp', windowsVirtualKeyCode: 33 },
      PageDown: { key: 'PageDown', code: 'PageDown', windowsVirtualKeyCode: 34 },
    }
    const target = map[key] || {
      key,
      code: key.length === 1 ? `Key${key.toUpperCase()}` : key,
      windowsVirtualKeyCode: key.length === 1 ? key.toUpperCase().charCodeAt(0) : 0,
    }
    const bits = { Alt: 1, Ctrl: 2, Meta: 4, Shift: 8 }
    const modifier = (Array.isArray(modifiers) ? modifiers : []).reduce((value, name) => value | (bits[name] || 0), 0)
    const base = { ...target, modifiers: modifier, nativeVirtualKeyCode: target.windowsVirtualKeyCode }
    await this.send('Input.dispatchKeyEvent', { type: 'keyDown', ...base })
    if (['Enter', 'Tab', 'Space'].includes(key)) {
      await this.send('Input.dispatchKeyEvent', {
        type: 'char',
        ...base,
        text: key === 'Enter' ? '\r' : key === 'Tab' ? '\t' : ' ',
      })
    }
    await this.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base })
    return { key, ...(await this.currentPage()) }
  }

  async scroll(x = 0, y = 0) {
    await this.ensure()
    await this.evaluate(`window.scrollBy(${Number(x) || 0}, ${Number(y) || 0})`)
    await sleep(100)
    return { x: Number(x) || 0, y: Number(y) || 0, ...(await this.currentPage()) }
  }

  async screenshot() {
    await this.ensure()
    const page = await this.currentPage()
    const result = await this.send('Page.captureScreenshot', {
      format: 'png',
      fromSurface: true,
      captureBeyondViewport: false,
    })
    if (!result?.data) throw new Error('Chrome returned an empty screenshot.')
    return { ...page, data: Buffer.from(result.data, 'base64') }
  }

  async stopChrome() {
    try {
      this.socket?.close()
    } catch {
      /* already closed */
    }
    this.socket = null
    this.ready = false
    if (this.child) {
      const child = this.child
      this.child = null
      try {
        child.kill()
      } catch {
        /* already stopped */
      }
    }
  }

  async close() {
    this.closed = true
    await this.stopChrome()
  }
}

export const buffyBrowser = new BuffyBrowser()
