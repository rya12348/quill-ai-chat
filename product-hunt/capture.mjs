import playwright from '../.tmp-video/node_modules/playwright-core/index.js'
const { chromium } = playwright
import { mkdir, rm } from 'node:fs/promises'
import { resolve } from 'node:path'

const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const base = 'http://127.0.0.1:5192'
const output = resolve(import.meta.dirname, 'output')
const raw = resolve(output, 'raw')

await mkdir(output, { recursive: true })
await rm(raw, { recursive: true, force: true })
await mkdir(raw, { recursive: true })

const browser = await chromium.launch({
  headless: true,
  executablePath: chrome,
  args: ['--hide-scrollbars', '--force-device-scale-factor=1'],
})

async function shot(file, name) {
  const context = await browser.newContext({
    viewport: { width: 1270, height: 760 },
    deviceScaleFactor: 2,
  })
  const page = await context.newPage()
  await page.goto(`${base}/${file}`, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(350)
  await page.screenshot({ path: resolve(output, name), type: 'png', scale: 'css' })
  await context.close()
  console.log(`captured ${name}`)
}

await shot('gallery-01.html', 'ink-gallery-01.png')
await shot('gallery-02.html', 'ink-gallery-02.png')

const videoContext = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
  recordVideo: { dir: raw, size: { width: 1920, height: 1080 } },
})
const videoPage = await videoContext.newPage()
await videoPage.goto(`${base}/video.html`, { waitUntil: 'networkidle' })
await videoPage.evaluate(() => document.fonts.ready)
await videoPage.waitForTimeout(350)
await videoPage.evaluate(() => window.startReel())
await videoPage.waitForTimeout(22900)
const video = videoPage.video()
await videoContext.close()
await video.saveAs(resolve(output, 'ink-product-tour.webm'))
console.log('recorded ink-product-tour.webm')
await browser.close()
