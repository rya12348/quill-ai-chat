import playwright from '../.tmp-video/node_modules/playwright-core/index.js'
import { mkdir, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
const { chromium } = playwright

const output = resolve(import.meta.dirname, 'output')
const raw = resolve(output, 'demo-raw')
await rm(raw, { recursive: true, force: true })
await mkdir(raw, { recursive: true })

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  args: ['--hide-scrollbars', '--force-device-scale-factor=1'],
})
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
  recordVideo: { dir: raw, size: { width: 1920, height: 1080 } },
})
const page = await context.newPage()
const wait = (ms) => page.waitForTimeout(ms)

await page.goto('http://127.0.0.1:5192/demo.html', { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts.ready)
await wait(900)

let app = null
let calc = null
for (let i = 0; i < 30 && !app; i += 1) {
  app = page.frames().find((frame) => frame !== page.mainFrame() && frame.url().includes('127.0.0.1:5180'))
  if (!app) await wait(250)
}
if (!app) throw new Error('Ink app frame did not load')
await wait(1200)

async function injectCursor(frame) {
  await frame.evaluate(() => {
    if (document.getElementById('ink-demo-cursor')) return
    const style = document.createElement('style')
    style.textContent = `
      #ink-demo-cursor { position: fixed; left: 0; top: 0; width: 26px; height: 30px; z-index: 2147483647;
        pointer-events: none; transform: translate3d(760px, 500px, 0); transition: transform .55s cubic-bezier(.22,1,.36,1), opacity .2s ease;
        filter: drop-shadow(0 3px 3px rgba(0,0,0,.24)); }
      #ink-demo-cursor svg { width: 26px; height: 30px; display: block; }
      #ink-demo-cursor .ripple { position: absolute; left: 2px; top: 2px; width: 22px; height: 22px; border-radius: 50%;
        border: 2px solid rgba(168,73,20,.7); opacity: 0; transform: scale(.4); }
      #ink-demo-cursor.click .ripple { animation: ink-demo-ripple .45s ease-out; }
      @keyframes ink-demo-ripple { 0% { opacity: .9; transform: scale(.3); } 100% { opacity: 0; transform: scale(2.6); } }
    `
    document.head.appendChild(style)
    const cursor = document.createElement('div')
    cursor.id = 'ink-demo-cursor'
    cursor.innerHTML = `<svg viewBox="0 0 26 30"><path d="M2 2 23 15.2l-8.4 2L12 27 2 2Z" fill="#fffdf8" stroke="#211d18" stroke-width="1.4" stroke-linejoin="round"/></svg><span class="ripple"></span>`
    document.body.appendChild(cursor)
    window.__demoCursor = (x, y) => { cursor.style.transform = `translate3d(${x}px, ${y}px, 0)` }
    window.__demoClick = () => {
      cursor.classList.remove('click')
      void cursor.offsetWidth
      cursor.classList.add('click')
      setTimeout(() => cursor.classList.remove('click'), 500)
    }
    window.__demoCursorShow = (show) => { cursor.style.opacity = show ? '1' : '0' }
  })
}

async function framePoint(frame, locator) {
  await locator.scrollIntoViewIfNeeded().catch(() => {})
  const point = await locator.evaluate((el) => {
    const r = el.getBoundingClientRect()
    return { x: r.left + r.width / 2 - 2, y: r.top + r.height / 2 - 2 }
  })
  await frame.evaluate(({ x, y }) => window.__demoCursor?.(x, y), point)
  return point
}

async function point(locator, hold = 650) {
  await framePoint(app, locator)
  await wait(hold)
}

async function click(locator, hold = 800) {
  await framePoint(app, locator)
  await wait(520)
  await app.evaluate(() => window.__demoClick?.())
  await locator.click()
  await wait(hold)
}

async function moveInCalc(locator, hold = 600) {
  await framePoint(calc, locator)
  await wait(hold)
}

async function scrollChat(amount, steps = 5) {
  await app.evaluate(() => {
    if (window.__demoScroller && document.contains(window.__demoScroller)) return
    const candidates = [...document.querySelectorAll('div')].filter((el) => {
      const style = getComputedStyle(el)
      return el.scrollHeight > el.clientHeight + 80 && (style.overflowY === 'auto' || style.overflowY === 'scroll')
    })
    window.__demoScroller = candidates.sort((a, b) => b.scrollHeight - a.scrollHeight)[0] ?? null
  })
  for (let i = 0; i < steps; i += 1) {
    await app.evaluate((delta) => window.__demoScroller?.scrollBy({ top: delta, behavior: 'smooth' }), amount / steps)
    await wait(95)
  }
}

await injectCursor(app)

// Intro
await app.getByRole('heading', { name: 'What can I help with?' }).waitFor({ timeout: 15000 })
await wait(650)
await page.evaluate(() => window.hideIntro())
await wait(850)
await page.evaluate(() => window.setStep(1))

// 01 — Home
await point(app.getByRole('button', { name: /Compare two vendors and cite the sources/i }), 900)
await point(app.getByRole('button', { name: /Make a page or small app/i }), 900)
await click(app.getByRole('link', { name: 'Library' }), 1300)

// 02 — Library
await page.evaluate(() => window.setStep(2))
await wait(500)
await point(app.getByRole('button', { name: /Builds/i }), 850)
await click(app.getByRole('button', { name: /^Builds/ }), 900)
const tipCard = app.locator('article').filter({ hasText: 'Tip Calculator' }).getByRole('link').first()
await click(tipCard, 1500)
await page.screenshot({ path: resolve(output, 'demo-check-tip.png') })

// 03 — Use the build in place
await page.evaluate(() => window.setStep(3))
await page.waitForTimeout(600)
await app.locator('iframe[title^="Preview of"]').scrollIntoViewIfNeeded()
await wait(1000)

calc = page.frames().find((frame) => frame !== app && frame.url() === 'about:srcdoc')
if (!calc) throw new Error('Build preview frame did not load')
await wait(700)
await injectCursor(calc)
await calc.evaluate(() => window.__demoCursorShow?.(true))
await app.evaluate(() => window.__demoCursorShow?.(false))

const bill = calc.locator('input[type="number"]').first()
await moveInCalc(bill)
await bill.click()
await bill.fill('')
await bill.pressSequentially('240', { delay: 130 })
await wait(600)

const range = calc.locator('input[type="range"]')
await moveInCalc(range)
await range.evaluate((el) => {
  el.value = '20'
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
})
await wait(900)

const people = calc.locator('input[type="number"]').nth(1)
await moveInCalc(people)
await people.fill('')
await people.pressSequentially('3', { delay: 220 })
await wait(900)
await calc.evaluate(() => window.scrollBy({ top: 150, behavior: 'smooth' }))
await wait(1100)
await page.screenshot({ path: resolve(output, 'demo-check-calc.png') })

await calc.evaluate(() => { const c = document.getElementById('ink-demo-cursor'); if (c) c.style.opacity = '0' })
await app.evaluate(() => { const c = document.getElementById('ink-demo-cursor'); if (c) c.style.opacity = '1' })

// 04 — Cited answer
await page.evaluate(() => window.setStep(4))
await click(app.getByRole('link', { name: 'Library' }), 1100)
await wait(300)
const search = app.getByPlaceholder('Search chats')
await point(search, 400)
await search.click()
await search.pressSequentially('cat', { delay: 160 })
await wait(700)
const catLink = app.locator('aside').getByText('What should I know before adopting a cat?', { exact: true }).first()
await point(catLink, 500)
await catLink.click()
await wait(1500)
await page.screenshot({ path: resolve(output, 'demo-check-cat.png') })

const sources = app.getByRole('button', { name: /Sources/i }).first()
await point(sources, 600)
await click(sources, 900)
await wait(700)
await sources.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'smooth' }))
await wait(1200)
await search.fill('')
await wait(400)

// Home + outro
await click(app.getByRole('link', { name: 'New chat' }), 1200)
await wait(700)
await page.evaluate(() => window.scrollTo(0, 0))
await page.evaluate(() => window.showOutro())
await wait(3200)

const video = page.video()
await context.close()
await video.saveAs(resolve(output, 'ink-demo-raw.webm'))
console.log('recorded ink-demo-raw.webm')
await browser.close()
