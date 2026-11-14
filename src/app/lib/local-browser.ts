import type {
  BrowserAction,
  BrowserInspectResult,
  BrowserScreen,
  BrowserSessionResponse,
  BrowserSnapshot,
  BrowserViewState,
} from '../../shared/types'

/**
 * Opt-in local Chrome transport.
 *
 * The local bridge (scripts/local-bridge.mjs) launches Chrome with remote
 * debugging and exposes one loopback WebSocket. This module is the browser
 * half of that connection: it speaks CDP, produces the same snapshot shape as
 * the Steel path, and keeps the browser on the visitor's computer.
 */

const BRIDGE_URL = 'ws://127.0.0.1:8765'
const REQUEST_TIMEOUT_MS = 20_000

class LocalBrowserError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message)
    this.name = 'LocalBrowserError'
  }
}

type Pending = {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timer: number
}

type LocalTab = { id: string; title: string; url: string; active: boolean }

const SNAPSHOT_EXPRESSION = `(() => {
  const clean = (value, max) => String(value ?? '').replace(/\\s+/g, ' ').trim().slice(0, max);
  const readable = (value, max) => String(value ?? '').replace(/\\r/g, '').replace(/[ \\t]+/g, ' ').replace(/[ \\t]*\\n[ \\t]*/g, '\\n').replace(/\\n{3,}/g, '\\n\\n').trim().slice(0, max);
  const visible = (element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 1 && rect.height > 1 && style.visibility !== 'hidden' && style.display !== 'none' && rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth;
  };
  // Modern apps put real controls inside open shadow roots. A plain
  // document.querySelectorAll missed them entirely, so the planner saw a page
  // with no usable fields. Walk open roots as well.
  const roots = [document];
  for (let index = 0; index < roots.length; index += 1) {
    for (const host of roots[index].querySelectorAll('*')) {
      if (host.shadowRoot && !roots.includes(host.shadowRoot)) roots.push(host.shadowRoot);
    }
  }
  const byId = (id) => {
    if (!id) return null;
    for (const root of roots) {
      const found = root.getElementById ? root.getElementById(id) : root.querySelector('#' + CSS.escape(id));
      if (found) return found;
    }
    return null;
  };
  const labelForControl = (element) => {
    if (element.labels && element.labels.length) return element.labels[0];
    if (!element.id) return null;
    for (const root of roots) {
      const label = root.querySelector('label[for="' + CSS.escape(element.id) + '"]');
      if (label) return label;
    }
    return null;
  };
  const selector = 'a[href],button,input,textarea,select,summary,[contenteditable]:not([contenteditable="false"]),[role="button"],[role="link"],[role="textbox"],[role="searchbox"],[role="combobox"],[role="menuitem"],[role="menuitemcheckbox"],[role="menuitemradio"],[role="option"],[role="tab"],[role="switch"],[role="checkbox"],[role="radio"],[role="slider"],[role="treeitem"],[aria-haspopup="menu"],[aria-haspopup="listbox"],[aria-expanded]';
  const nodes = roots.flatMap((root) => [...root.querySelectorAll(selector)]);
  const candidates = [];
  for (const element of nodes) {
    const rect = element.getBoundingClientRect();
    const onScreen = visible(element);
    if (!onScreen && (rect.width <= 1 || rect.height <= 1)) continue;
    candidates.push({ element, onScreen, rect });
  }
  const ordered = [...candidates.filter((candidate) => candidate.onScreen), ...candidates.filter((candidate) => !candidate.onScreen)].slice(0, 200);
  const elements = [];
  const current = {};
  // Reuse one id per DOM node across snapshots. Google's autocomplete (and
  // most menus) reorder nodes; renumbering every snapshot made a planner's
  // q9 point at a suggestion instead of the Search button on the next step.
  const ids = window.__inkElementIds || (window.__inkElementIds = new WeakMap());
  let nextId = window.__inkNextId || 0;
  for (const { element, onScreen, rect } of ordered) {
    let id = ids.get(element);
    if (!id) {
      id = 'q' + (nextId++);
      ids.set(element, id);
    }
    element.setAttribute('data-stet-id', id);
    current[id] = element;
    const labelNode = labelForControl(element);
    const wrappingLabel = element.closest ? element.closest('label') : null;
    const labelledBy = (element.getAttribute('aria-labelledby') || '')
      .split(/\\s+/)
      .map((part) => byId(part))
      .filter(Boolean)
      .map((node) => node.innerText || node.textContent || '')
      .join(' ')
      .trim();
    const tag = element.tagName.toLowerCase();
    const role = (element.getAttribute('role') || '').toLowerCase();
    const textLabel = element.innerText || element.textContent || '';
    // Visible button/link/option text is the label a person sees. An internal
    // name="commit" must not outrank “Sign in” on an arbitrary site.
    const isControl = tag === 'a' || tag === 'button' || role === 'link' || role === 'button' || role === 'option' || role === 'menuitem' || role === 'tab';
    const label = clean(
      element.getAttribute('aria-label') ||
        labelledBy ||
        element.getAttribute('title') ||
        (labelNode && labelNode.innerText) ||
        (wrappingLabel && wrappingLabel.innerText) ||
        (isControl ? textLabel : '') ||
        element.getAttribute('placeholder') ||
        textLabel ||
        element.getAttribute('name') ||
        element.value ||
        element.tagName,
      160,
    );
    const datalist = element.getAttribute('list') ? byId(element.getAttribute('list')) : null;
    const choices =
      tag === 'select' && element.options
        ? [...element.options]
        : datalist && datalist.options
          ? [...datalist.options]
          : [];
    elements.push({
      id,
      tag,
      role: element.getAttribute('role') || '',
      label,
      value: clean(element.value, 300),
      placeholder: clean(element.getAttribute('placeholder'), 160),
      inputType: tag === 'input' ? clean(element.type || 'text', 40).toLowerCase() : undefined,
      href: element.href ? String(element.href).slice(0, 300) : undefined,
      ...(choices.length
        ? {
            options: choices.slice(0, 60).map((option) => ({
              label: clean(option.textContent || option.label || '', 120),
              value: clean(option.value || '', 160),
            })),
          }
        : {}),
      ...(typeof element.checked === 'boolean' ? { checked: element.checked } : {}),
      ...(element.required ? { required: true } : {}),
      ...(element.getAttribute('aria-expanded') === 'true' ? { expanded: true } : {}),
      ...(element.getAttribute('aria-controls') ? { ariaControls: clean(element.getAttribute('aria-controls'), 160) } : {}),
      ...(element.getAttribute('autocomplete') ? { autocomplete: clean(element.getAttribute('autocomplete'), 80) } : {}),
      disabled: Boolean(element.disabled || element.getAttribute('aria-disabled') === 'true'),
      offscreen: !onScreen,
      rect: { x: Math.round(rect.left), y: Math.round(rect.top), width: Math.round(rect.width), height: Math.round(rect.height) },
    });
  }
  window.__inkNextId = nextId;
  window.__inkRoots = roots;
  window.__inkById = current;
  window.__inkFind = (wanted) => {
    if (!wanted) return null;
    const id = /data-stet-id="([^"]+)"/.exec(wanted);
    if (id && current[id[1]]) return current[id[1]];
    for (const root of roots) {
      const found = root.querySelector(wanted);
      if (found) return found;
    }
    return null;
  };
  const active = document.activeElement;
  const root = document.documentElement;
  // Read the content column when a page exposes one. A full body.innerText on
  // an app or news site can spend the text budget on navigation, cookie
  // notices and footer links before the answer appears.
  const contentRoot = document.querySelector('main, [role="main"], article');
  const bodyText = contentRoot && (contentRoot.innerText || contentRoot.textContent || '').trim().length > 400
    ? contentRoot.innerText || contentRoot.textContent || ''
    : document.body ? document.body.innerText : '';
  const media = [];
  for (const element of document.querySelectorAll('video,audio')) {
    if (media.length >= 4) break;
    media.push({
      kind: element.tagName.toLowerCase(),
      duration: Number.isFinite(element.duration) ? Math.round(element.duration * 10) / 10 : 0,
      currentTime: Number.isFinite(element.currentTime) ? Math.round(element.currentTime * 10) / 10 : 0,
      paused: Boolean(element.paused),
      ended: Boolean(element.ended),
    });
  }
  const frames = [];
  for (const frame of document.querySelectorAll('iframe')) {
    if (frames.length >= 8) break;
    const src = frame.src ? String(frame.src) : '';
    if (!src || /^(?:about|blob|data):/i.test(src)) continue;
    const rect = frame.getBoundingClientRect();
    frames.push({
      url: src.slice(0, 500),
      title: clean(frame.title || frame.getAttribute('title') || frame.name, 120),
      visible: rect.width > 1 && rect.height > 1 && rect.bottom > 0 && rect.top < innerHeight,
      rect: { x: Math.round(rect.left), y: Math.round(rect.top), width: Math.round(rect.width), height: Math.round(rect.height) },
    });
  }
  const headings = [];
  for (const element of document.querySelectorAll('h1,h2,h3,h4,[role="heading"]')) {
    if (headings.length >= 12) break;
    const text = clean(element.innerText || element.textContent, 120);
    if (!text || element.getBoundingClientRect().width <= 1) continue;
    const level = Number(element.getAttribute('aria-level')) || Number(element.tagName.slice(1)) || 2;
    headings.push({ level: Math.max(1, Math.min(6, level)), text });
  }
  return {
    url: location.href,
    title: document.title,
    text: readable(bodyText, 8000),
    viewport: {
      width: innerWidth,
      height: innerHeight,
      scrollX: Math.round(window.scrollX),
      scrollY: Math.round(window.scrollY),
      pageHeight: Math.max(innerHeight, root ? root.scrollHeight || 0 : 0),
    },
    active: active ? clean(active.getAttribute('aria-label') || active.getAttribute('placeholder') || active.tagName, 160) : '',
    elements,
    media,
    frames,
    headings,
    at: Date.now(),
  };
})()`

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

class LocalBrowser {
  private socket: WebSocket | null = null
  private pending = new Map<number, Pending>()
  private sequence = 0
  private connecting: Promise<boolean> | null = null
  // Once local Chrome has owned a session, a dropped loopback socket must be
  // retried here. Falling through to the Worker would return no_session and
  // wipe the still-open local session in the UI.
  private used = false
  private lastTab: LocalTab = { id: 'local', title: 'Local Chrome', url: 'about:blank', active: true }
  // The field that just received text, so a later Enter can restore focus
  // after a click or autocomplete moved it to the document body.
  private lastTypedSelector: string | null = null

  connected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN
  }

  /** Whether local Chrome owns the browser session, even while its socket is
   * reconnecting. api() must keep routing browser calls here in that window;
   * falling through to the Worker returns no_session and wipes the UI. */
  ownsSession(): boolean {
    return this.used || this.connected()
  }

  async connect(): Promise<boolean> {
    if (this.connected()) return true
    if (this.connecting) return this.connecting
    const attempt = new Promise<boolean>((resolve) => {
      let settled = false
      const finish = (value: boolean) => {
        if (settled) return
        settled = true
        this.connecting = null
        resolve(value)
      }
      try {
        const socket = new WebSocket(BRIDGE_URL)
        this.socket = socket
        socket.onopen = () => {
          // Do not resolve until Chrome's page target is attached. The bridge
          // sends this event right before it starts forwarding CDP replies.
        }
        socket.onerror = () => finish(false)
        socket.onclose = () => {
          this.rejectPending(new Error('Local Chrome disconnected.'))
          if (this.socket === socket) this.socket = null
          finish(false)
        }
        socket.onmessage = (event) => {
          let message: Record<string, unknown>
          try {
            message = JSON.parse(String(event.data)) as Record<string, unknown>
          } catch {
            return
          }
          if (message.type === 'bridge-ready') {
            const target = message.target as { id?: string; url?: string; title?: string } | undefined
            this.lastTab = {
              id: String(target?.id || 'local'),
              url: String(target?.url || 'about:blank'),
              title: String(target?.title || 'Local Chrome'),
              active: true,
            }
            this.used = true
            finish(true)
            return
          }
          const id = Number(message.id)
          if (!Number.isFinite(id)) return
          const pending = this.pending.get(id)
          if (!pending) return
          this.pending.delete(id)
          window.clearTimeout(pending.timer)
          if (message.error) {
            const error = message.error as { message?: string; code?: number }
            pending.reject(new LocalBrowserError(502, 'local_cdp_error', error.message || `CDP error ${error.code || ''}`))
          } else {
            pending.resolve(message.result)
          }
        }
      } catch {
        finish(false)
      }
      window.setTimeout(() => finish(false), 4_000)
    })
    this.connecting = attempt
    return attempt
  }

  disconnect(): void {
    this.used = false
    this.socket?.close()
    this.socket = null
    this.rejectPending(new Error('Local Chrome disconnected.'))
  }

  private rejectPending(error: Error): void {
    for (const pending of this.pending.values()) {
      window.clearTimeout(pending.timer)
      pending.reject(error)
    }
    this.pending.clear()
  }

  private send<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    if (!this.connected()) throw new LocalBrowserError(409, 'local_disconnected', 'Local Chrome is not connected.')
    const id = ++this.sequence
    return new Promise<T>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.pending.delete(id)
        reject(new LocalBrowserError(504, 'local_timeout', `Local Chrome did not answer ${method}.`))
      }, REQUEST_TIMEOUT_MS)
      this.pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
        timer,
      })
      this.socket?.send(JSON.stringify({ id, method, params }))
    })
  }

  private async evaluate(expression: string): Promise<unknown> {
    // Planner page actions often arrive as a statement block ending in
    // `return ...`. Runtime.evaluate rejects a top-level return with
    // “SyntaxError: Illegal return statement”, which made every such action
    // fail in local mode. Wrap only those blocks in an IIFE.
    const source = expression.trim()
    const wrapped =
      /\breturn\b/.test(source) && !/^(?:\(|async\b|function\b|class\b)/.test(source)
        ? `(() => {\n${source}\n})()`
        : expression
    const result = await this.send<{
      result?: { value?: unknown }
      exceptionDetails?: { text?: string; exception?: { description?: string } }
    }>('Runtime.evaluate', {
      expression: wrapped,
      returnByValue: true,
      awaitPromise: true,
      userGesture: true,
    })
    if (result.exceptionDetails) {
      const detail = result.exceptionDetails.exception?.description?.split('\n')[0]?.trim()
      throw new LocalBrowserError(502, 'local_page_error', detail || result.exceptionDetails.text || 'The page could not be read.')
    }
    return result.result?.value
  }

  private async waitReady(timeoutMs = 8_000): Promise<void> {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      try {
        const ready = await this.evaluate('document.readyState')
        if (ready === 'complete' || ready === 'interactive') return
      } catch {
        /* Navigation can replace the execution context. */
      }
      await sleep(100)
    }
  }

  private async snapshot(): Promise<BrowserSnapshot> {
    await this.waitReady(3_000).catch(() => undefined)
    const value = (await this.evaluate(SNAPSHOT_EXPRESSION)) as BrowserSnapshot | null
    if (!value || typeof value !== 'object' || !value.url) {
      throw new LocalBrowserError(502, 'local_page_error', 'Local Chrome did not return a readable page.')
    }
    this.lastTab = { id: 'local', title: value.title || 'Local Chrome', url: value.url, active: true }
    return value
  }

  private async state(): Promise<BrowserViewState> {
    const snapshot = await this.snapshot()
    return { url: snapshot.url, title: snapshot.title, snapshot }
  }

  private async capture(): Promise<BrowserScreen> {
    const snapshot = await this.snapshot()
    let image = ''
    try {
      // Background windows can return a stale or empty surface. Foreground the
      // controlled Chrome tab before composing the live-screen image.
      const shot = async () => {
        // After following a new Docs tab, Page.bringToFront can still leave the
        // new target as a hidden background tab and return a white surface.
        // Activate the exact target before requesting pixels.
        if (this.lastTab.id && this.lastTab.id !== 'local') {
          await this.send('Target.activateTarget', { targetId: this.lastTab.id }).catch(() => undefined)
        }
        await this.wakePage()
        await this.send('Page.bringToFront').catch(() => undefined)
        await sleep(300)
        return this.send<{ data?: string }>('Page.captureScreenshot', {
          format: 'jpeg',
          quality: 64,
          fromSurface: true,
          captureBeyondViewport: false,
        })
      }
      let result = await shot()
      // A newly followed Docs tab can be focusable before it has a composited
      // surface. Retry once instead of returning an empty frame.
      if (!result.data) {
        await sleep(450)
        result = await shot()
      }
      if (result.data) image = `data:image/jpeg;base64,${result.data}`
    } catch {
      /* The snapshot is still useful when a surface cannot be captured. */
    }
    return {
      image,
      url: snapshot.url,
      title: snapshot.title,
      viewport: snapshot.viewport,
      at: Date.now(),
    }
  }

  private async tabs(): Promise<LocalTab[]> {
    try {
      const snapshot = await this.snapshot()
      return [{ id: 'local', title: snapshot.title || 'Local Chrome', url: snapshot.url, active: true }]
    } catch {
      return [this.lastTab]
    }
  }

  private async mouse(x: number, y: number): Promise<void> {
    await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none', buttons: 0 })
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 })
    await sleep(8)
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 })
  }

  private async focus(selector?: string): Promise<void> {
    if (!selector) return
    await this.evaluate(`(() => {
      const find = window.__inkFind || ((wanted) => document.querySelector(wanted));
      const element = find(${JSON.stringify(selector)});
      if (!element) return false;
      element.scrollIntoView({ block: 'center', inline: 'center' });
      element.focus();
      // Replace the field's current text instead of appending to it. The
      // planner often re-types the same search box on the next step; without
      // selection that produced queries like “Ada Lovelace WikipediaAda
      // Lovelace”. Steel's native type action already does this.
      if (typeof element.select === 'function') {
        try { element.select(); } catch {}
      }
      return true;
    })()`)
  }

  private async insert(text: string): Promise<void> {
    await this.send('Input.insertText', { text })
  }

  /** Submit the form that contains the field; Wikipedia ignores plain Enter. */
  private async submitField(selector?: string): Promise<boolean> {
    if (selector) {
      const clicked = (await this.evaluate(`(() => {
        const find = window.__inkFind || ((wanted) => document.querySelector(wanted));
        const field = find(${JSON.stringify(selector)});
        const form = field && field.form;
        if (!form) return false;
        const button =
          form.querySelector('button[type="submit"], input[type="submit"]') ||
          [...form.querySelectorAll('button')].find((item) => /search|go|submit/i.test(item.innerText || item.getAttribute('aria-label') || '')) ||
          null;
        if (!button) return false;
        button.click();
        return true;
      })()`)) as boolean
      if (clicked) {
        await sleep(180)
        await this.waitReady().catch(() => undefined)
        return true
      }
    }
    await this.press('Enter')
    // Some custom search boxes start a client-side results render after the
    // key event. Give that render a beat before the caller reads the page;
    // without it the first snapshot can still say “type to search”.
    await sleep(350)
    await this.waitReady().catch(() => undefined)
    return false
  }

  private async press(key: string, modifiers: string[] = []): Promise<void> {
    if (key === 'Enter' && this.lastTypedSelector) {
      const editable = (await this.evaluate(`(() => {
        const active = document.activeElement;
        return Boolean(active && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT' || active.isContentEditable));
      })()`)) as boolean
      if (!editable) await this.focus(this.lastTypedSelector).catch(() => undefined)
    }
    const map: Record<string, { key: string; code: string; windowsVirtualKeyCode: number }> = {
      Enter: { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 },
      Escape: { key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 },
      Tab: { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 },
      Home: { key: 'Home', code: 'Home', windowsVirtualKeyCode: 36 },
      F2: { key: 'F2', code: 'F2', windowsVirtualKeyCode: 113 },
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
      Insert: { key: 'Insert', code: 'Insert', windowsVirtualKeyCode: 45 },
      F5: { key: 'F5', code: 'F5', windowsVirtualKeyCode: 116 },
    }
    const target = map[key] ?? { key, code: key, windowsVirtualKeyCode: key.toUpperCase().charCodeAt(0) }
    const bits: Record<string, number> = { Alt: 1, Ctrl: 2, Meta: 4, Shift: 8 }
    const bit = modifiers.reduce((value, modifier) => value | (bits[modifier] ?? 0), 0)
    const base = { ...target, modifiers: bit, nativeVirtualKeyCode: target.windowsVirtualKeyCode }
    await this.send('Input.dispatchKeyEvent', { type: 'keyDown', ...base })
    if (key === 'Enter' || key === 'Tab' || key === ' ') {
      const text = key === 'Tab' ? '\t' : key === 'Enter' ? '\r' : ' '
      await this.send('Input.dispatchKeyEvent', { type: 'char', ...base, text })
    }
    await this.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base })
  }

  private async click(action: Extract<BrowserAction, { type: 'click' }>): Promise<void> {
    if (action.selector) {
      const point = (await this.evaluate(`(() => {
        const find = window.__inkFind || ((wanted) => document.querySelector(wanted));
        const element = find(${JSON.stringify(action.selector)});
        if (!element) return null;
        element.scrollIntoView({ block: 'center', inline: 'center' });
        if (element.tagName === 'A' && element.href) {
          // Keep a target=_blank link in the controlled tab. Otherwise the
          // bridge would stay on the old page while Chrome opened a new one.
          element.removeAttribute('target');
          element.click();
          return { clicked: true };
        }
        const rect = element.getBoundingClientRect();
        const submit =
          (element.tagName === 'BUTTON' && (element.type === 'submit' || element.form)) ||
          (element.tagName === 'INPUT' && element.type === 'submit');
        // Submitting through the form avoids CDP waiting for the navigation
        // frame before it acknowledges the mouse event. Validation still runs.
        if (submit && element.form) {
          if (typeof element.form.checkValidity === 'function' && !element.form.checkValidity()) {
            const invalid = [...element.form.elements].find(
              (field) => field.willValidate && !field.checkValidity(),
            );
            element.form.reportValidity?.();
            return {
              validation: true,
              field: invalid?.getAttribute('aria-label') || invalid?.name || invalid?.placeholder || 'a required field',
            };
          }
          element.form.requestSubmit(element);
          return { clicked: true, submit: true };
        }
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, submit };
      })()`)) as { clicked?: boolean; x?: number; y?: number; submit?: boolean; validation?: boolean; field?: string } | null
      if (!point) throw new LocalBrowserError(409, 'local_target', 'That element is no longer on the page.')
      if (point.validation) {
        throw new LocalBrowserError(
          422,
          'local_validation',
          `The form is not ready: ${point.field || 'a required field'} still needs a value`,
        )
      }
      if (point.clicked) {
        if (!point.submit) await sleep(120)
        return
      }
      if (typeof point.x === 'number' && typeof point.y === 'number') {
        const before = await this.evaluate('location.href')
        await this.mouse(point.x, point.y)
        // A submit navigates immediately. Reading location.href here waits for
        // the new execution context and adds one to three seconds to a form
        // that has already been sent. The caller opted out of the snapshot for
        // terminal submits, so return as soon as the native click is dispatched.
        if (point.submit) return
        await sleep(220)
        const after = await this.evaluate('location.href')
        if (after === before) {
          // A fixed overlay or an autocomplete row can sit over the real
          // button. If this was a submit control, submit its form directly
          // instead of reporting a click that did nothing.
          await this.evaluate(`(() => {
            const find = window.__inkFind || ((wanted) => document.querySelector(wanted));
            const element = find(${JSON.stringify(action.selector)});
            if (!element) return false;
            const submit = element.form && (element.type === 'submit' || element.getAttribute('type') === 'submit');
            if (!submit) return false;
            element.form.requestSubmit(element);
            return true;
          })()`)
          await sleep(120)
        }
        return
      }
    }
    if (typeof action.x === 'number' && typeof action.y === 'number') {
      await this.mouse(action.x, action.y)
      await sleep(120)
      return
    }
    throw new LocalBrowserError(400, 'local_target', 'That click has no target.')
  }

  private async drag(fromSelector: string, toSelector: string): Promise<void> {
    const points = (await this.evaluate(`(() => {
      const find = window.__inkFind || ((wanted) => document.querySelector(wanted));
      const source = find(${JSON.stringify(fromSelector)});
      const target = find(${JSON.stringify(toSelector)});
      if (!source || !target) return null;
      source.scrollIntoView({ block: 'center', inline: 'center' });
      const a = source.getBoundingClientRect();
      const from = { x: a.left + a.width / 2, y: a.top + a.height / 2 };
      target.scrollIntoView({ block: 'center', inline: 'center' });
      const b = target.getBoundingClientRect();
      return { from, to: { x: b.left + b.width / 2, y: b.top + b.height / 2 }, draggable: source.draggable === true || source.getAttribute('draggable') === 'true' };
    })()`)) as { from: { x: number; y: number }; to: { x: number; y: number }; draggable: boolean } | null
    if (!points) throw new LocalBrowserError(409, 'local_target', 'A drag target is no longer on the page.')
    if (points.draggable) {
      const dropped = (await this.evaluate(`(() => {
        const find = window.__inkFind || ((wanted) => document.querySelector(wanted));
        const source = find(${JSON.stringify(fromSelector)});
        const target = find(${JSON.stringify(toSelector)});
        if (!source || !target) return false;
        const data = new DataTransfer();
        const fire = (element, type) => element.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: data }));
        fire(source, 'dragstart');
        fire(target, 'dragenter');
        fire(target, 'dragover');
        fire(target, 'drop');
        fire(source, 'dragend');
        return true;
      })()`)) as boolean
      if (dropped) return
    }
    await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: points.from.x, y: points.from.y, button: 'none', buttons: 0 })
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: points.from.x, y: points.from.y, button: 'left', buttons: 1, clickCount: 1 })
    for (let step = 1; step <= 8; step += 1) {
      const ratio = step / 8
      await this.send('Input.dispatchMouseEvent', {
        type: 'mouseMoved',
        x: Math.round(points.from.x + (points.to.x - points.from.x) * ratio),
        y: Math.round(points.from.y + (points.to.y - points.from.y) * ratio),
        button: 'left',
        buttons: 1,
      })
      await sleep(24)
    }
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: points.to.x, y: points.to.y, button: 'left', buttons: 0, clickCount: 1 })
    await sleep(120)
  }

  private async findLink(text: string): Promise<string> {
    const query = text.trim().toLowerCase().slice(0, 200)
    if (!query) throw new LocalBrowserError(400, 'local_target', 'That link lookup has no text.')
    const result = (await this.evaluate(`(() => {
      const clean = (value) => String(value ?? '').replace(/\\s+/g, ' ').trim().toLowerCase();
      const roots = window.__inkRoots || [document];
      const candidates = roots.flatMap((root) => [...root.querySelectorAll('a[href],button,summary,[role="link"],[role="button"],[role="menuitem"],[role="menuitemcheckbox"],[role="menuitemradio"],[role="option"],[role="tab"],[role="switch"],[role="checkbox"],[role="radio"],[aria-haspopup="menu"],[aria-haspopup="listbox"]')]);
      let best = null;
      for (const element of candidates) {
        const text = clean(element.innerText || element.textContent);
        const label = clean(element.getAttribute('aria-label') || element.getAttribute('title') || text);
        const href = clean(element.href || '');
        const score = label === ${JSON.stringify(query)} ? 0 : label.includes(${JSON.stringify(query)}) ? 1 : text.includes(${JSON.stringify(query)}) ? 2 : href.includes(${JSON.stringify(query)}) ? 3 : -1;
        if (score < 0) continue;
        if (!best || score < best.score) best = { element, score, label: (element.getAttribute('aria-label') || text || '').slice(0, 160) };
      }
      if (!best) {
        // Modern menus and cards are often divs with a click handler, not a
        // button or anchor. Match the smallest text element and click its
        // nearest interactive surface, or the text node itself (the click
        // bubbles to the app's handler).
        const textNodes = roots.flatMap((root) => [...root.querySelectorAll('main *, [role="main"] *, body *')]).slice(0, 2500);
        for (const element of textNodes) {
          const text = clean(element.innerText || element.textContent);
          if (!text.includes(${JSON.stringify(query)}) || element.children.length > 3) continue;
          const clickable = element.closest('a[href],button,summary,[role="link"],[role="button"],[role="menuitem"],[role="option"],[role="tab"]') || element;
          if (!best || text.length < best.score) best = { element: clickable, score: text.length, label: (element.innerText || element.textContent || '').trim().slice(0, 160) };
        }
      }
      if (!best) return null;
      best.element.scrollIntoView({ block: 'center', inline: 'center' });
      if (best.element.tagName === 'A') best.element.removeAttribute('target');
      best.element.click();
      return { label: best.label };
    })()`)) as { label?: string } | null
    if (!result) throw new LocalBrowserError(404, 'local_link', `No link matching “${text}” was found on this page.`)
    await sleep(150)
    return result.label || text
  }

  private async act(action: BrowserAction): Promise<string> {
    switch (action.type) {
      case 'navigate':
        await this.send('Page.navigate', { url: action.url })
        await this.waitReady()
        return action.url
      case 'click':
        await this.click(action)
        return 'click'
      case 'findLink': {
        const label = await this.findLink(action.text)
        return `Opened ${label}`
      }
      case 'type':
      case 'fill': {
        if (action.type === 'fill') {
          for (const field of action.fields) {
            await this.focus(field.selector)
            await this.insert(field.value)
            this.lastTypedSelector = field.selector
          }
          if (action.submit) await this.submitField(action.fields.at(-1)?.selector)
          return `Filled ${action.fields.length} fields`
        }
        if (action.selector) {
          await this.focus(action.selector)
          // Remember the field for a separate Enter action. A click between
          // type and Enter often leaves body focused on real sites.
          this.lastTypedSelector = action.selector
        }
        await this.insert(action.text)
        if (action.submit) await this.submitField(action.selector)
        return 'typed'
      }
      case 'press':
        await this.press(action.key, action.modifiers || [])
        return `Pressed ${action.key}`
      case 'scroll':
        await this.evaluate(`window.scrollBy(${Number(action.x) || 0}, ${Number(action.y) || 0})`)
        return 'scrolled'
      case 'back':
        await this.evaluate('history.back()')
        await this.waitReady()
        return 'back'
      case 'forward':
        await this.evaluate('history.forward()')
        await this.waitReady()
        return 'forward'
      case 'reload':
        await this.evaluate('location.reload()')
        await this.waitReady()
        return 'reload'
      case 'wait':
        await sleep(Math.min(30_000, Math.max(0, Number(action.ms) || 500)))
        return 'waited'
      case 'waitFor': {
        const deadline = Date.now() + Math.min(120_000, Math.max(500, Number(action.timeoutMs) || 10_000))
        if (action.state === 'time') {
          await sleep(Math.min(120_000, Math.max(100, Number(action.timeoutMs) || 1_000)))
          return 'waited'
        }
        const hidden = action.state === 'hidden'
        while (Date.now() < deadline) {
          const found = await this.evaluate(`(() => {
            const find = window.__inkFind || ((wanted) => document.querySelector(wanted));
            const roots = window.__inkRoots || [document];
            const visible = (element) => {
              if (!element) return false;
              const rect = element.getBoundingClientRect();
              const style = getComputedStyle(element);
              return rect.width > 1 && rect.height > 1 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
            };
            ${action.text ? `const bodyText = roots.map((root) => root.body?.innerText || root.host?.innerText || '').join('\\n'); const hasText = bodyText.includes(${JSON.stringify(action.text)}); if (${hidden ? '!hasText' : 'hasText'}) return true;` : ''}
            ${action.selector ? `const element = find(${JSON.stringify(action.selector)}); const shown = visible(element); if (${hidden ? '!shown' : 'shown'}) return true;` : ''}
            ${action.state === 'ended' ? `const media = ${action.selector ? `[...roots.flatMap((root) => [...root.querySelectorAll(${JSON.stringify(action.selector)})])]` : `[...document.querySelectorAll('video,audio')]`}; if (media.some((item) => item.ended)) return true;` : ''}
            return false;
          })()`)
          if (found === true) return 'found'
          await sleep(180)
        }
        throw new LocalBrowserError(504, 'local_timeout', `The page did not reach that state within ${Math.round((Number(action.timeoutMs) || 10_000) / 1_000)} seconds.`)
      }
      case 'evaluate': {
        const value = await this.evaluate(action.expression)
        return typeof value === 'string' ? value.slice(0, 2000) : JSON.stringify(value ?? null).slice(0, 2000)
      }
      case 'style':
        await this.evaluate(`(() => { const style = document.createElement('style'); style.textContent = ${JSON.stringify(action.css)}; document.head.appendChild(style); return true; })()`)
        return 'styled'
      case 'inspect':
      case 'screenshot':
        return 'inspected'
      case 'hover':
        if (action.selector) {
          const point = (await this.evaluate(`(() => {
            const find = window.__inkFind || ((wanted) => document.querySelector(wanted));
            const element = find(${JSON.stringify(action.selector)});
            if (!element) return null;
            element.scrollIntoView({ block: 'center', inline: 'center' });
            const rect = element.getBoundingClientRect();
            return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
          })()`)) as { x: number; y: number } | null
          if (point) await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y })
        } else if (typeof action.x === 'number' && typeof action.y === 'number') {
          await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: action.x, y: action.y })
        }
        return 'hovered'
      case 'select': {
        // Native <select> is one deterministic value assignment. ARIA
        // comboboxes and custom menus need an open, a listbox lookup and a real
        // click; setting .value on them does nothing. Handle both here so the
        // same select action works on ordinary and component-library forms.
        const first = (await this.evaluate(`(() => {
          const find = window.__inkFind || ((wanted) => document.querySelector(wanted));
          const element = find(${JSON.stringify(action.selector)});
          if (!element) return { error: 'missing' };
          element.scrollIntoView({ block: 'center', inline: 'center' });
          element.focus();
          const wanted = ${JSON.stringify(action.value)}.trim().toLowerCase();
          if (element.tagName === 'SELECT' && element.options) {
            const options = [...element.options];
            const option = options.find((item) => String(item.value).toLowerCase() === wanted || (item.textContent || '').trim().toLowerCase() === wanted) ??
              options.find((item) => (item.textContent || '').trim().toLowerCase().includes(wanted));
            if (!option) return { error: 'option', available: options.slice(0, 12).map((item) => (item.textContent || '').trim()) };
            const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
            if (setter) setter.call(element, option.value); else element.value = option.value;
            element.selectedIndex = option.index;
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
            return { kind: 'native', label: (option.textContent || option.value || '').trim() };
          }
          if (element.getAttribute('aria-expanded') !== 'true') element.click();
          return { kind: 'custom' };
        })()`)) as { kind?: string; label?: string; error?: string; available?: string[] } | null
        if (first?.error === 'missing') throw new LocalBrowserError(409, 'local_target', 'That dropdown is no longer on the page.')
        if (first?.error === 'option') {
          throw new LocalBrowserError(422, 'local_option', `“${action.value}” is not an option. Available choices: ${(first.available || []).join(', ')}`)
        }
        if (first?.kind === 'native') return 'selected'
        await sleep(180)
        const choose = async () => (await this.evaluate(`(() => {
          const roots = window.__inkRoots || [document];
          const wanted = ${JSON.stringify(action.value)}.trim().toLowerCase();
          const visible = (element) => {
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return rect.width > 1 && rect.height > 1 && style.display !== 'none' && style.visibility !== 'hidden';
          };
          let best = null;
          const candidates = roots.flatMap((root) => [...root.querySelectorAll('[role="option"],[role="menuitem"],[role="menuitemradio"],[role="menuitemcheckbox"],[role="treeitem"],[data-value]')]);
          for (const element of candidates) {
            if (!visible(element)) continue;
            const text = (element.innerText || element.textContent || element.getAttribute('aria-label') || '').replace(/\\s+/g, ' ').trim();
            const value = (element.getAttribute('data-value') || element.getAttribute('value') || '').trim();
            const haystack = (text + ' ' + value).toLowerCase();
            const score = haystack === wanted ? 0 : haystack.startsWith(wanted) ? 1 : haystack.includes(wanted) ? 2 : -1;
            if (score < 0) continue;
            if (!best || score < best.score) {
              const rect = element.getBoundingClientRect();
              best = { score, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, label: text.slice(0, 120) };
            }
          }
          return best;
        })()`)) as { x: number; y: number; label: string } | null
        const option = await choose()
        if (option) {
          await this.mouse(option.x, option.y)
          await sleep(120)
          return 'selected'
        }
        // Some comboboxes only accept text, and only commit on ArrowDown/Enter.
        // Typing first is still better than reporting a successful no-op.
        await this.focus(action.selector)
        await this.insert(action.value)
        await sleep(180)
        const typed = await choose()
        if (typed) {
          await this.mouse(typed.x, typed.y)
          await sleep(120)
          return 'selected'
        }
        await this.press('ArrowDown')
        await this.press('Enter')
        return 'selected'
      }
      case 'focus':
        await this.focus(action.selector)
        return 'focused'
      case 'check': {
        const changed = (await this.evaluate(`(() => {
          const find = window.__inkFind || ((wanted) => document.querySelector(wanted));
          const element = find(${JSON.stringify(action.selector)});
          if (!element) return false;
          element.scrollIntoView({ block: 'center', inline: 'center' });
          element.focus();
          const current = typeof element.checked === 'boolean'
            ? element.checked
            : element.getAttribute('aria-checked') === 'true';
          if (current !== ${action.checked}) element.click();
          return true;
        })()`)) as boolean
        if (!changed) throw new LocalBrowserError(409, 'local_target', 'That checkbox is no longer on the page.')
        return 'checked'
      }
      case 'drag':
        await this.drag(action.fromSelector, action.toSelector)
        return 'dragged'
      case 'ask':
      case 'done':
        return action.type
      default:
        return 'ignored'
    }
  }

  async inspect(selector: string): Promise<{ state: BrowserViewState; inspect: BrowserInspectResult }> {
    const inspect = (await this.evaluate(`(() => {
      const raw = ${JSON.stringify(selector)};
      const find = window.__inkFind || ((wanted) => document.querySelector(wanted));
      const roots = window.__inkRoots || [document];
      const nodes = raw ? roots.flatMap((root) => [...root.querySelectorAll(raw)]) : [document.documentElement];
      const target = raw ? find(raw) : nodes[0];
      if (!target) return { error: 'No element matched that selector.', matched: nodes.length };
      const computed = getComputedStyle(target);
      const properties = ['display','position','width','height','color','background-color','font-family','font-size','font-weight','line-height','padding','margin','border','border-radius','z-index'];
      return {
        selector: raw || 'html',
        tag: target.tagName.toLowerCase(),
        matched: nodes.length,
        html: String(target.outerHTML ?? '').slice(0, 16000),
        text: String(target.innerText ?? target.textContent ?? '').replace(/\\s+/g, ' ').trim().slice(0, 4000),
        styles: properties.map((property) => property + ': ' + computed.getPropertyValue(property)).join('\\n'),
      };
    })()`)) as BrowserInspectResult & { error?: string }
    if (!inspect || inspect.error) throw new LocalBrowserError(409, 'local_target', inspect?.error || 'That element could not be inspected.')
    return { state: { ...(await this.state()), inspect }, inspect }
  }

  private async model<T>(path: 'draft' | 'table', task: string): Promise<T> {
    const response = await fetch(`/api/browser/${path}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({ task }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    const body = (await response.json().catch(() => null)) as
      | (T & { error?: string; message?: string })
      | null
    if (!response.ok) {
      throw new LocalBrowserError(response.status, body?.error || 'local_model', body?.message || 'The writer could not finish.')
    }
    if (!body) throw new LocalBrowserError(502, 'local_model', 'The writer returned an empty response.')
    return body
  }

  private async checkSignIn(): Promise<void> {
    const current = await this.snapshot()
    const body = current.text.slice(0, 3_000)
    if (/accounts\.google\.com/i.test(current.url) || /\bSign in\b/i.test(body) && /\bto continue\b/i.test(body)) {
      // The sign-in page is in the real local Chrome window, not in the
      // screenshot. Bring that window forward so the person knows where to
      // type, instead of leaving it behind the Ink tab.
      await this.send('Page.bringToFront').catch(() => undefined)
      throw new LocalBrowserError(
        409,
        'browser_signin',
        'Google is asking you to sign in. Sign in once in the local Chrome window, then press Run again.',
      )
    }
  }

  private async waitForEditor(selector: string, timeoutMs = 15_000): Promise<void> {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      await this.checkSignIn()
      const found = await this.evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`)
      if (found === true) return
      await sleep(250)
    }
    throw new LocalBrowserError(504, 'local_editor', 'Google Docs did not finish opening. Check the local Chrome window and try again.')
  }

  /** Insert a chart from the filled range without a planner/menu hunt. */
  private async createChart(range: string): Promise<boolean> {
    try {
      if (!(await this.focusSheetRange(range))) return false
      // Google's menu controls open on a native mousedown, not a DOM click.
      await this.click({ type: 'click', selector: '#docs-insert-menu' }).catch(() => undefined)
      await sleep(350)
      const point = (await this.evaluate(`(() => {
        const visible = (el) => {
          const rect = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
        };
        const menus = [...document.querySelectorAll('.goog-menu')].filter(visible);
        for (const menu of menus) {
          const item = [...menu.querySelectorAll('.goog-menuitem')].find((el) => (el.innerText || '').trim() === 'Chart');
          if (item && visible(item)) {
            const rect = item.getBoundingClientRect();
            return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
          }
        }
        return null;
      })()`)) as { x: number; y: number } | null
      if (!point) return false
      await this.mouse(point.x, point.y)
      for (let attempt = 0; attempt < 10; attempt += 1) {
        await sleep(350)
        const editor = (await this.evaluate(
          `Boolean(document.querySelector('.docs-chart-editor, #chart-editor')) || /chart editor/i.test(document.body.innerText)`,
        )) as boolean
        if (editor) return true
      }
      return false
    } catch {
      return false
    }
  }

  private async waitForDocument(timeoutMs = 20_000): Promise<void> {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      await this.checkSignIn()
      const value = (await this.evaluate(
        `({
          url: location.href,
          title: document.title,
          templateGallery: /template gallery/i.test(document.body?.innerText || ''),
          hasEditor: Boolean(document.querySelector('.kix-appview-editor, iframe.docs-texteventtarget-iframe, [contenteditable="true"]')),
        })`,
      )) as { url?: string; title?: string; templateGallery?: boolean; hasEditor?: boolean } | null
      if (value && /docs\.google\.com\/document\/d\//i.test(value.url || '') && !value.templateGallery) {
        // The URL changes before the canvas first paints. Let the editor attach
        // its input frame before typing into it. `docs.new` can redirect to the
        // template gallery, so a URL match alone is not enough.
        await sleep(value.hasEditor ? 900 : 1_400)
        return
      }
      await sleep(250)
    }
    throw new LocalBrowserError(504, 'local_editor', 'Google Docs did not finish opening. Check the local Chrome window and try again.')
  }

  private async writeDocument(task: string): Promise<{ state: BrowserViewState; words: number; lane?: string }> {
    // Navigate before starting the writer. If the writer request stalls, the
    // document is still opened instead of leaving the previous sheet on screen
    // while the whole task waits behind a network call.
    await this.send('Page.navigate', { url: 'https://docs.google.com/document/create' })
    const draftPromise = this.model<{ text: string; lane?: string }>('draft', task)
    draftPromise.catch(() => undefined)
    await this.waitReady(8_000).catch(() => undefined)
    // A contenteditable selector is unreliable for Docs: the real editor is
    // inside an iframe. Wait for the document URL, bring the local window to
    // the front, click the page canvas, then type. That is the same path a
    // person uses and it does not depend on Docs' internal DOM.
    await this.waitForDocument()
    const draft = await draftPromise
    let text = draft.text.trim()
    if (!text) throw new LocalBrowserError(502, 'browser_write_empty', 'The writer returned an empty document.')
    // The writer sometimes returns a long article for “a three-sentence
    // paragraph”. Honor the requested length before it reaches the editor.
    const sentenceCount = /\b(one|two|three|four|five|six|\d+)[-\s]sentences?\b/i.exec(task)?.[1]
    const wanted = sentenceCount
      ? ({ one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 } as Record<string, number>)[sentenceCount.toLowerCase()] ?? Number(sentenceCount)
      : 0
    if (wanted > 0) {
      const sentences = text.match(/[^.!?]+[.!?]+(?:\s|$)/g)
      if (sentences && sentences.length > wanted) text = sentences.slice(0, wanted).join(' ').trim()
    }
    await this.wakePage()
    await this.send('Page.bringToFront').catch(() => undefined)
    await this.mouse(640, 380)
    await sleep(150)
    await this.insert(text)
    await sleep(500)
    // Clicking the page again can hit a spelling suggestion and open the
    // personal-dictionary dialog over the document. Type once, then let the
    // editor settle instead of performing an unnecessary second click.
    await this.press('Escape').catch(() => undefined)
    const state = await this.state()
    return { state, words: text.split(/\s+/).filter(Boolean).length, lane: draft.lane }
  }

  /** Select a cell or range through Sheets' name box, which works before the canvas is focused. */
  private async focusSheetRange(address: string): Promise<boolean> {
    const focused = (await this.evaluate(`(() => {
      const box = document.querySelector('input[aria-label="Name box"], #t-name-box');
      if (!box) return false;
      box.focus();
      if (typeof box.select === 'function') box.select();
      return true;
    })()`)) as boolean
    if (!focused) return false
    await this.insert(address)
    await this.press('Enter')
    await sleep(180)
    // Sheets keeps the name-box input focused after Enter in some states. If
    // it stays focused, Ctrl+V and typed TSV go into “A1” instead of the grid.
    // Return focus to the sheet without changing the selected range.
    await this.evaluate(`(() => {
      const active = document.activeElement;
      if (active && (active.id === 't-name-box' || active.getAttribute('aria-label') === 'Name box')) {
        active.blur();
        return true;
      }
      return false;
    })()`)
    await sleep(80)
    return true
  }

  /** A followed target can be left hidden even when it is the active tab. */
  private async wakePage(): Promise<void> {
    await this.send('Page.setWebLifecycleState', { state: 'active' }).catch(() => undefined)
  }

  /** Put keyboard focus back on the sheet grid after using the name/formula bars. */
  private async activateSheetGrid(): Promise<void> {
    const rect = (await this.evaluate(`(() => {
      const grid = document.querySelector('.grid-container');
      if (!grid) return null;
      const r = grid.getBoundingClientRect();
      return { x: r.left + 120, y: r.top + 50 };
    })()`)) as { x: number; y: number } | null
    if (!rect) return
    await this.mouse(rect.x, rect.y)
    await sleep(120)
    // A single click only selects a cell; Ctrl+Home makes that cell A1.
    await this.press('Home', ['Ctrl'])
    await sleep(120)
  }

  /** Read the selected cell from Sheets' formula bar; this is the cheap post-fill proof. */
  private async readSheetCell(address = 'A1'): Promise<string> {
    if (!(await this.focusSheetRange(address))) return ''
    await sleep(120)
    return (await this.evaluate(`(() => {
      const cell = document.querySelector('#t-formula-bar-input .cell-input, #t-formula-bar-input');
      return (cell?.innerText || cell?.textContent || '').replace(/\u00a0/g, ' ').trim();
    })()`)) as string || ''
  }

  private async fillSheet(task: string): Promise<{ state: BrowserViewState; rows: number; columns: number; lane?: string; chart?: boolean }> {
    const tablePromise = this.model<{ text: string; rows: number; columns: number; lane?: string }>('table', task)
    tablePromise.catch(() => undefined)
    await this.send('Page.navigate', { url: 'https://sheets.new/' })
    await this.waitReady(8_000).catch(() => undefined)
    await this.waitForEditor('[role="grid"], .grid-container, canvas')
    // Sheets' grid editor only receives synthetic key events while its window
    // is foregrounded; without this the fill returns success and leaves a
    // blank sheet.
    await this.wakePage()
    await this.send('Page.bringToFront').catch(() => undefined)
    await this.send('Emulation.setFocusEmulationEnabled', { enabled: true }).catch(() => undefined)
    await sleep(150)
    const table = await tablePromise
    const grid = table.text.trim()
    if (!grid) throw new LocalBrowserError(502, 'browser_sheet_empty', 'The table writer returned nothing.')
    // Select A1 through the name box, paste the whole TSV, then verify A1 in
    // the formula bar. Clipboard writes can be refused or ignored; the typed
    // fallback runs only when the verified paste did not land.
    try {
      if (!(await this.focusSheetRange('A1'))) {
        throw new LocalBrowserError(409, 'browser_sheet', 'Google Sheets did not expose its name box.')
      }
      await this.activateSheetGrid()
      let pasted = false
      try {
        await this.send('Browser.grantPermissions', {
          origin: 'https://docs.google.com',
          permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'],
        })
        await this.evaluate(`navigator.clipboard.writeText(${JSON.stringify(grid)})`)
        await this.press('v', ['Ctrl'])
        await sleep(900)
        pasted = (await this.readSheetCell('A1')).length > 0
      } catch {
        pasted = false
      }
      if (!pasted) {
        await this.focusSheetRange('A1')
        await this.activateSheetGrid()
        const rows = grid.split('\n').map((line) => line.split('\t'))
        for (const row of rows.slice(0, 200)) {
          for (let column = 0; column < row.length; column += 1) {
            // F2 enters the cell editor, where one insert-text command writes
            // the whole value. Typing every character through the grid is the
            // slow path that made small tables take twenty seconds.
            await this.press('F2')
            await this.insert(row[column] || '')
            await this.press('Tab')
          }
          // Back to column A on this row, then down to the next row.
          await this.press('Home')
          await this.press('ArrowDown')
        }
        await sleep(250)
        if (!(await this.readSheetCell('A1'))) {
          throw new LocalBrowserError(502, 'browser_sheet', 'The sheet did not accept the table at A1.')
        }
      }
    } catch (error) {
      if (error instanceof LocalBrowserError) throw error
      throw new LocalBrowserError(502, 'browser_sheet', error instanceof Error ? error.message : 'The local sheet could not be filled.')
    }
    await sleep(350)
    const wantsChart = /\b(?:chart|graph|plot)\b/i.test(task)
    // The writer's row count is data rows; the typed grid also has its header
    // row. The chart range must include June/header, not stop at the previous
    // data row.
    // /table and localSalesTable both report total rows including the header.
    const typedRows = Math.max(table.rows, grid.split('\n').length)
    const lastColumn = String.fromCharCode(64 + Math.max(1, Math.min(26, table.columns)))
    // A successful paste can be truncated at the last row. Verify the bottom-
    // right value, not only A1, before reporting the sheet as complete.
    if (!(await this.readSheetCell(`${lastColumn}${typedRows}`))) {
      throw new LocalBrowserError(502, 'browser_sheet', `The sheet is missing its last cell (${lastColumn}${typedRows}).`)
    }
    const range = `A1:${lastColumn}${typedRows}`
    const chart = wantsChart ? await this.createChart(range) : false
    return { state: await this.state(), rows: typedRows, columns: table.columns, lane: table.lane, ...(chart ? { chart: true } : {}) }
  }

  async session(): Promise<BrowserSessionResponse> {
    return { sessionId: 'local', state: await this.state(), expiresAt: Date.now() + 60 * 60_000 }
  }

  /**
   * A small response router used by api(). Returning null sends the request to
   * the normal Worker path, which keeps local mode additive and reversible.
   */
  async handle(path: string, init?: RequestInit & { json?: unknown }): Promise<Response | null> {
    if (path === '/browser/plan') return null
    if (!this.connected()) {
      if (!this.used) return null
      // One bounded reconnect keeps a live local session alive instead of
      // letting the remote Worker answer with a misleading no_session.
      if (!(await this.connect())) {
        return jsonResponse(
          { error: 'local_disconnected', message: 'Local Chrome disconnected. Choose “Use local Chrome” to reconnect.' },
          503,
        )
      }
    }
    const method = (init?.method || 'GET').toUpperCase()
    const json = init?.json as Record<string, unknown> | undefined
    try {
      if (path === '/browser/session') {
        if (method === 'DELETE') {
          this.disconnect()
          return jsonResponse({ ok: true })
        }
        // The start form carries the address the person asked for. A fresh
        // bridge normally sits on about:blank, so open that address once here
        // instead of showing a blank page under a Google URL.
        const requested = typeof json?.url === 'string' ? json.url : ''
        if (method === 'POST' && /^https?:\/\//i.test(requested)) {
          await this.send('Page.navigate', { url: requested })
          await this.waitReady(8_000).catch(() => undefined)
        }
        return jsonResponse(await this.session())
      }
      if (path === '/browser/state') return jsonResponse(await this.state())
      if (path === '/browser/screen') return jsonResponse(await this.capture())
      if (path === '/browser/tabs') {
        if (method === 'POST') {
          const tabJson = json ?? {}
          const action = typeof tabJson.action === 'string' ? tabJson.action : ''
          if (action === 'open' && typeof tabJson.url === 'string') {
            await this.send('Page.navigate', { url: tabJson.url })
            await this.waitReady()
          } else if (action === 'new') {
            await this.send('Page.navigate', { url: typeof tabJson.url === 'string' ? tabJson.url : 'about:blank' })
            await this.waitReady()
          } else if (action === 'close') {
            await this.send('Page.navigate', { url: 'about:blank' })
            await this.waitReady()
          }
          // The bridge controls one page target; switch/open/new all return to
          // that same live tab instead of pretending to have a second window.
          return jsonResponse({ state: await this.state() })
        }
        return jsonResponse({ tabs: await this.tabs() })
      }
      if (path === '/browser/inspect') {
        const next = await this.inspect(typeof json?.selector === 'string' ? json.selector : '')
        return jsonResponse(next)
      }
      if (path === '/browser/write') {
        const task = typeof json?.task === 'string' ? json.task : ''
        if (!task) return jsonResponse({ error: 'invalid_request', message: 'A document request is required.' }, 400)
        return jsonResponse(await this.writeDocument(task))
      }
      if (path === '/browser/sheet') {
        const task = typeof json?.task === 'string' ? json.task : ''
        if (!task) return jsonResponse({ error: 'invalid_request', message: 'A spreadsheet data request is required.' }, 400)
        return jsonResponse(await this.fillSheet(task))
      }
      if (path === '/browser/act') {
        const action = json?.action as BrowserAction | undefined
        if (!action) return jsonResponse({ error: 'invalid_action', message: 'A browser action is required.' }, 400)
        const observation = await this.act(action)
        // The planner expects an act response to be a full browser view. A
        // local { ok, observation } response left the address bar undefined
        // and crashed the next render. Honor read:false only when a caller
        // explicitly opts out of the snapshot.
        if (json?.read === false) return jsonResponse({ ok: true, observation })
        return jsonResponse({ ...(await this.state()), observation })
      }
      return null
    } catch (error) {
      const failure = error instanceof LocalBrowserError ? error : new LocalBrowserError(502, 'local_browser_error', error instanceof Error ? error.message : 'Local Chrome could not complete that step.')
      return jsonResponse({ error: failure.code, message: failure.message }, failure.status)
    }
  }
}

export const localBrowser = new LocalBrowser()
