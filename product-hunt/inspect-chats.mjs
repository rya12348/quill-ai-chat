import playwright from '../.tmp-video/node_modules/playwright-core/index.js'
const { chromium } = playwright

const ids = {
  research: '15ee0a7a-5703-4595-8306-8ee9b9aee953',
  ember: '227b70ab-a13b-4fa2-9a26-195297ab7175',
  tip: 'b5fc225d-aa16-41b4-aab6-f31ed6d20881',
  snake: '3643c65c-0b6f-4d02-a319-8aec4ae59664',
  cat: '3ba6fd3e-e2bd-462c-83fa-07da07c352a7',
}

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  args: ['--hide-scrollbars'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
await page.goto('http://127.0.0.1:5180/', { waitUntil: 'networkidle' })

for (const [name, id] of Object.entries(ids)) {
  const data = await page.evaluate(async (id) => fetch(`/api/conversations/${id}`, { credentials: 'same-origin' }).then((r) => r.json()), id)
  const messages = data.messages ?? []
  console.log(`\n=== ${name} ${id} ===`)
  console.log('conversation:', JSON.stringify(data.conversation))
  for (const m of messages) {
    console.log(`- ${m.role} ${m.content?.length ?? 0} chars`, {
      build: Boolean(m.build), buildPages: m.build?.pages?.length, canvas: Boolean(m.canvas), research: Boolean(m.research), sources: m.sources?.length,
    })
    if (m.role === 'assistant') console.log(m.content.slice(0, 700).replace(/\n/g, ' '))
  }
  await page.goto(`http://127.0.0.1:5180/c/${id}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  await page.screenshot({ path: `product-hunt/output/chat-${name}.png` })
}
await browser.close()
