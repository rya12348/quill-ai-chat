import { WebSocket } from 'ws'

const APP = 'http://127.0.0.1:5180'
const LAB = new URL('./fixtures/coding-lab.html', import.meta.url).href
const CDP = 'http://127.0.0.1:9223'
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

class Session {
  constructor(socket) {
    this.socket = socket
    this.nextId = 1
    this.pending = new Map()
    socket.on('message', (raw) => {
      const message = JSON.parse(raw.toString())
      if (!message.id) return
      const waiter = this.pending.get(message.id)
      if (!waiter) return
      this.pending.delete(message.id)
      if (message.error) waiter.reject(new Error(message.error.message || 'CDP error'))
      else waiter.resolve(message.result)
    })
  }

  send(method, params = {}) {
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.socket.send(JSON.stringify({ id, method, params }))
      setTimeout(() => {
        if (!this.pending.has(id)) return
        this.pending.delete(id)
        reject(new Error(`CDP ${method} timed out`))
      }, 30_000)
    })
  }

  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
      userGesture: true,
    })
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'page evaluation failed')
    }
    return result.result?.value
  }
}

async function connect() {
  const targets = await fetch(`${CDP}/json/list`).then((response) => response.json())
  const target = targets.find((item) => item.type === 'page' && item.url === 'about:blank') ?? targets.find((item) => item.type === 'page')
  if (!target?.webSocketDebuggerUrl) throw new Error('No Chrome page target is available.')
  const socket = new WebSocket(target.webSocketDebuggerUrl, { headers: { Origin: 'http://127.0.0.1:8765' } })
  await new Promise((resolve, reject) => {
    socket.once('open', resolve)
    socket.once('error', reject)
  })
  return new Session(socket)
}

async function openLab(session, nonce) {
  await session.send('Page.navigate', { url: `${LAB}?run=${nonce}` })
  await sleep(900)
  return session.evaluate(`(() => {
    const result = document.querySelector('#result-1')
    return result ? document.body.innerText.slice(0, 500) : ''
  })()`)
}

async function pageState(session) {
  return session.evaluate(`(() => {
    const elements = Array.from(document.querySelectorAll('input,select,textarea,button,a,[role="button"]')).map((element, index) => {
      const rect = element.getBoundingClientRect()
      const label = (element.getAttribute('aria-label') || element.innerText || element.value || element.placeholder || element.name || element.id || '').trim()
      return {
        id: 'q' + index,
        tag: element.tagName.toLowerCase(),
        role: element.getAttribute('role') || '',
        label,
        ...(element.value ? { value: String(element.value).slice(0, 120) } : {}),
        ...(element.type ? { inputType: element.type } : {}),
        ...(element.type === 'checkbox' || element.type === 'radio' ? { checked: Boolean(element.checked) } : {}),
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      }
    })
    return {
      url: location.href,
      title: document.title,
      text: document.body.innerText.slice(0, 8_000),
      html: document.body.innerHTML.slice(0, 20_000),
      viewport: { width: innerWidth, height: innerHeight, scrollX, scrollY, pageHeight: document.documentElement.scrollHeight },
      active: document.activeElement && (document.activeElement.id || document.activeElement.tagName),
      elements,
      at: Date.now(),
    }
  })()`)
}

async function generateCode(task, state) {
  const started = Date.now()
  const response = await fetch(`${APP}/api/browser/code`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: APP },
    signal: AbortSignal.timeout(75_000),
    body: JSON.stringify({
      task,
      snapshot: {
        url: state.url,
        title: state.title,
        text: state.text,
        viewport: state.viewport,
        active: state.active,
        elements: state.elements,
        media: [],
        frames: [],
        headings: [],
        at: state.at,
      },
      html: state.html,
    }),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok || !body.code) {
    throw new Error(`${response.status} ${body.message || body.error || 'no code'} (${Date.now() - started}ms)`)
  }
  return { ...body, ms: Date.now() - started }
}

async function runCode(session, code) {
  const expression = `(async () => {
    try {
      const value = await (async () => {
${code}
      })()
      return JSON.stringify({ ok: true, value: value === undefined ? null : value })
    } catch (error) {
      return JSON.stringify({ ok: false, error: String(error && error.stack || error) })
    }
  })()`
  const raw = await session.evaluate(expression)
  const parsed = JSON.parse(raw)
  if (!parsed.ok) throw new Error(parsed.error || 'code threw')
  return parsed.value
}

async function resultText(session, selector) {
  return session.evaluate(`(() => {
    const element = document.querySelector(${JSON.stringify(selector)})
    return element ? element.textContent.trim().replace(/\\s+/g, ' ') : null
  })()`)
}

const tests = [
  {
    name: '1 · price aggregation',
    task: 'Use JavaScript to read every .price element, sum its data-cents value, and write exactly "Total: $<sum formatted with two decimals>" into #result-1. Return the total in your result.',
    check: async (session) => {
      const text = await resultText(session, '#result-1')
      if (text !== 'Total: $59.97') throw new Error(`#result-1 was ${JSON.stringify(text)}`)
    },
  },
  {
    name: '2 · filter and sort',
    task: 'Use JavaScript to collect the text of every .card whose data-stock is "yes", sort those names alphabetically, and write them into #result-2 joined by ", ". Return the joined string.',
    check: async (session) => {
      const text = await resultText(session, '#result-2')
      if (text !== 'Beta Device, Delta Unit, Zeta Widget') throw new Error(`#result-2 was ${JSON.stringify(text)}`)
    },
  },
  {
    name: '3 · async wait',
    task: 'Use JavaScript to click #load-items, then wait until all 3 .item elements exist. Write their text into #result-3 joined by " | " and return how many items you saw.',
    check: async (session) => {
      const text = await resultText(session, '#result-3')
      const count = await session.evaluate(`document.querySelectorAll('#items .item').length`)
      if (text !== 'First | Second | Third' || count !== 3) throw new Error(`#result-3 was ${JSON.stringify(text)} with ${count} items`)
    },
  },
  {
    name: '4 · form events',
    task: 'Use JavaScript to fill #name with "Ada Lovelace", #email with "ada@example.com", and select the "pro" option in #plan. Dispatch input and change events for each field, then write exactly "Form ready: Ada Lovelace|ada@example.com|Pro" into #result-4. Return the field values.',
    check: async (session) => {
      const text = await resultText(session, '#result-4')
      const values = await session.evaluate(`(() => ({ name: document.querySelector('#name').value, email: document.querySelector('#email').value, plan: document.querySelector('#plan').value }))()`)
      if (text !== 'Form ready: Ada Lovelace|ada@example.com|Pro' || values.name !== 'Ada Lovelace' || values.email !== 'ada@example.com' || values.plan !== 'pro') {
        throw new Error(`result=${JSON.stringify(text)} values=${JSON.stringify(values)}`)
      }
    },
  },
  {
    name: '5 · loop over controls',
    task: 'Use JavaScript to check every unchecked .task-box, then write exactly "Checked N of M" into #result-5 where N is how many checkboxes you changed and M is the total number of .task-box elements. Return the counts.',
    check: async (session) => {
      const text = await resultText(session, '#result-5')
      const boxes = await session.evaluate(`Array.from(document.querySelectorAll('.task-box'), (box) => box.checked)`)
      if (text !== 'Checked 3 of 5' || boxes.length !== 5 || boxes.some((checked) => !checked)) {
        throw new Error(`#result-5 was ${JSON.stringify(text)}, checked=${JSON.stringify(boxes)}`)
      }
    },
  },
]

const session = await connect()
let failures = 0
for (const [index, test] of tests.entries()) {
  const started = Date.now()
  try {
    await openLab(session, index)
    const state = await pageState(session)
    const generated = await generateCode(test.task, state)
    await runCode(session, generated.code)
    await test.check(session)
    // The page program must be safe to run again. The checkbox task is
    // intentionally excluded: its correct second result is “Checked 0 of 5”.
    if (index < 4) {
      await runCode(session, generated.code)
      await test.check(session)
    }
    console.log(`PASS ${test.name} · ${generated.lane} · code ${generated.ms}ms · total ${Date.now() - started}ms`)
    console.log(`  code: ${generated.code.replace(/\s+/g, ' ').slice(0, 220)}`)
  } catch (error) {
    failures += 1
    console.log(`FAIL ${test.name} · ${error instanceof Error ? error.message : error}`)
  }
}
console.log(`\n${tests.length - failures}/${tests.length} coding tests passed`)
if (failures) process.exitCode = 1
session.socket.close()
