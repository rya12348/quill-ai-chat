import playwright from '../.tmp-video/node_modules/playwright-core/index.js'
const { chromium } = playwright

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  args: ['--hide-scrollbars'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
await page.goto('http://127.0.0.1:5180/', { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
console.log('URL:', page.url())
console.log('TITLE:', await page.title())
console.log('BODY:', (await page.locator('body').innerText()).slice(0, 1800))
const data = await page.evaluate(async () => {
  const me = await fetch('/api/me', { credentials: 'same-origin' }).then((r) => r.json()).catch((e) => String(e))
  const chats = await fetch('/api/conversations', { credentials: 'same-origin' }).then((r) => r.json()).catch((e) => String(e))
  return { me, chats }
})
console.log('DATA:', JSON.stringify(data).slice(0, 5000))
await page.screenshot({ path: 'product-hunt/output/app-home.png' })
await browser.close()
