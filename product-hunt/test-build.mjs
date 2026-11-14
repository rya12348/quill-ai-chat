import playwright from '../.tmp-video/node_modules/playwright-core/index.js'
const { chromium } = playwright

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  args: ['--hide-scrollbars'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
await page.goto('http://127.0.0.1:5180/', { waitUntil: 'networkidle' })
await page.getByRole('button', { name: /Make a page or small app/i }).click()
await page.locator('textarea[aria-label="Message"]').fill('Build a polished tip calculator for a restaurant bill. Bill amount, 15/18/20% tip buttons, split between 1–8 people, and a clear total. Warm cream and editorial, one page.')
await page.locator('button[aria-label="Send"]').click()

const start = Date.now()
let last = ''
for (let i = 0; i < 24; i += 1) {
  await page.waitForTimeout(5000)
  const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 400)
  if (text !== last) {
    console.log(`${Math.round((Date.now() - start) / 1000)}s: ${text}`)
    last = text
  }
  const frame = page.locator('iframe[title^="Preview of"]')
  if (await frame.count()) {
    console.log(`PREVIEW READY at ${Math.round((Date.now() - start) / 1000)}s`)
    break
  }
}
console.log('URL:', page.url())
console.log('BODY:', (await page.locator('body').innerText()).slice(0, 3000))
await page.screenshot({ path: 'product-hunt/output/live-build-test.png' })
await browser.close()
