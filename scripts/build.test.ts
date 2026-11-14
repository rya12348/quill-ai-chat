import assert from 'node:assert/strict'
import test from 'node:test'

import type { BuildInfo } from '../src/shared/types'
import { auditDesign, buildMessages, designScore, extractPages, hasInertButtons, hasInteractiveCode, hasProxyCode, isFunctionalRequest, isGameRequest, isInteractiveRequest, isProxyRequest } from '../src/worker/build'

const page = (body: string, script = '') =>
  `<!doctype html><html><head><title>Neon Runner</title></head><body>${body}${script ? `<script>${script}</script>` : ''}</body></html>`

const copy =
  '<h1>Neon Runner</h1><p>Guide the runner through the neon city, collect energy cells and avoid the barriers. Use the arrow keys or the on-screen controls to play.</p><canvas id="game" width="640" height="360"></canvas><button id="start">Start</button>'

const gameScript = `var score = 0; var keys = new Set();
addEventListener('keydown', function (event) { keys.add(event.key); });
addEventListener('pointerdown', function () { start(); });
function loop(time) { update(time); draw(); requestAnimationFrame(loop); }
requestAnimationFrame(loop);`

const previous: BuildInfo = {
  status: 'ready',
  kind: 'page',
  title: 'Neon Runner',
  html: page(copy, gameScript),
  interactive: true,
  models: ['test lane'],
  asOf: 1,
}

test('game requests are told apart from sites about games', () => {
  assert.equal(isGameRequest('make a snake game'), true)
  assert.equal(isGameRequest('build a playable browser game'), true)
  assert.equal(isGameRequest('build a landing page for a game studio'), false)
  assert.equal(isGameRequest('design a portfolio for a game artist'), false)
  assert.equal(isInteractiveRequest('make a tip calculator'), true)
  assert.equal(isInteractiveRequest('write a cover letter'), false)
})

test('tool requests build the utility, not a marketing page', () => {
  assert.equal(isProxyRequest('make a proxy'), true)
  assert.equal(isProxyRequest('build a landing page about proxies'), false)
  assert.equal(isFunctionalRequest('build a tip calculator'), true)
  assert.equal(isFunctionalRequest('build a landing page for a tip calculator'), false)
})

test('a proxy build must drive the real proxy endpoint', () => {
  const proxy = `https://stet.example/api/web-proxy/${'a'.repeat(48)}`
  const working = page(
    '<h1>Web proxy</h1><p>Enter a public URL, then browse it inside the sandbox. The server fetches the page and its assets.</p><form><input id="url" aria-label="Public URL"><button id="go">Go</button></form><iframe id="view" title="Proxied page"></iframe>',
    `var view = document.getElementById('view'); document.querySelector('form').addEventListener('submit', function (event) { event.preventDefault(); view.src = ${JSON.stringify(proxy)} + '?url=' + encodeURIComponent(document.getElementById('url').value) })`,
  )
  assert.equal(hasProxyCode(working, proxy), true)
  assert.equal(extractPages(working, { requireInteractive: true, requireProxy: proxy }).length, 1)
  const marketing = page('<h1>Web proxy</h1><p>Route your connection through another server with this simple service.</p><button>Get started</button>')
  assert.equal(extractPages(marketing, { requireInteractive: true, requireProxy: proxy }).length, 0)
})

test('a working tool must include real interactive code', () => {
  const calculator = page(
    '<h1>Tip calculator</h1><p>Enter the bill and see a twenty percent tip and the total update immediately.</p><input id="bill" aria-label="Bill"><button id="go">Calculate</button><output id="out"></output>',
    `document.getElementById('go').addEventListener('click', function () { var bill = Number(document.getElementById('bill').value) || 0; document.getElementById('out').textContent = (bill * 1.2).toFixed(2); })`,
  )
  assert.equal(extractPages(calculator, { requireInteractive: true }).length, 1)
  assert.equal(extractPages(page('<h1>Tip calculator</h1><p>Calculate a tip for any bill in seconds.</p>'), { requireInteractive: true }).length, 0)
})

test('the design audit rewards a considered layout over a browser-default prototype', () => {
  const crude = page('<h1>Oak Studio</h1><p>We make considered objects for everyday rooms.</p><button>Contact us</button>')
  const polished = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Oak Studio — considered objects</title><style>
:root{--ink:#17201b;--muted:#5d6a61;--paper:#f7f3e9;--surface:#fffdf7;--line:#e6dfd1;--accent:#b9552d;--radius:14px}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.65 system-ui,-apple-system,"Segoe UI",sans-serif}
header{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:24px;max-width:1120px;margin:0 auto;padding:18px 24px;border-bottom:1px solid var(--line);background:color-mix(in srgb,var(--paper) 88%,transparent);backdrop-filter:blur(12px)}
.brand{font-weight:800;letter-spacing:-.04em}nav{display:flex;gap:18px}nav a{color:var(--muted);text-decoration:none;font-size:.92rem}nav a:hover{color:var(--ink)}
main{max-width:1120px;margin:0 auto;padding:0 24px}.hero{display:grid;grid-template-columns:1.2fr .8fr;gap:clamp(28px,6vw,72px);align-items:center;padding:clamp(48px,9vw,104px) 0}
.eyebrow{color:var(--accent);font-size:.75rem;font-weight:750;letter-spacing:.16em;text-transform:uppercase}h1{font-size:clamp(2.6rem,7vw,5.4rem);line-height:.98;letter-spacing:-.055em;margin:.2em 0}h2{font-size:clamp(1.5rem,3vw,2.25rem);line-height:1.12;letter-spacing:-.035em;margin:0 0 12px}
p{max-width:58ch;color:var(--muted)}.actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:28px}button{min-height:44px;padding:0 20px;border:1px solid var(--line);border-radius:999px;background:var(--surface);color:var(--ink);font:inherit;cursor:pointer;transition:transform .18s ease,background .18s ease}button.primary{background:var(--ink);color:var(--surface);border-color:var(--ink)}button:hover{transform:translateY(-2px)}button:focus-visible,a:focus-visible{outline:3px solid var(--accent);outline-offset:3px}
.visual{min-height:360px;border-radius:var(--radius);background:linear-gradient(145deg,#d8c6a5,#8a6b45);position:relative;overflow:hidden;box-shadow:0 24px 70px rgba(63,45,24,.18)}.visual svg{width:100%;height:100%;display:block}.collection{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;padding:32px 0 64px}.card{padding:22px;border:1px solid var(--line);border-radius:var(--radius);background:var(--surface)}.card strong{display:block;margin-bottom:6px}.card span{color:var(--muted);font-size:.9rem}
footer{max-width:1120px;margin:0 auto;padding:28px 24px 48px;border-top:1px solid var(--line);color:var(--muted);font-size:.86rem}
@media (max-width:760px){.hero{grid-template-columns:1fr;padding:40px 0}.collection{grid-template-columns:1fr}header{padding:14px 18px}main,footer{padding-left:18px;padding-right:18px}.visual{min-height:260px}}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
</style></head><body><header><a class="brand" href="#top">Oak Studio</a><nav><a href="#work">Work</a><a href="#process">Process</a><a href="#contact">Contact</a></nav></header><main id="top"><section class="hero"><div><p class="eyebrow">Small-batch furniture</p><h1>Objects with a quiet point of view.</h1><p>Oak Studio makes durable, repairable pieces for everyday rooms. We work in solid timber, visible joinery and finishes that improve with use.</p><div class="actions"><button class="primary">Start a commission</button><button>View the collection</button></div></div><div class="visual" aria-label="Abstract timber illustration"><svg viewBox="0 0 400 400" role="img"><circle cx="270" cy="130" r="86" fill="#b9552d" opacity=".7"/><rect x="70" y="170" width="250" height="34" rx="17" fill="#17201b" opacity=".8"/><rect x="95" y="204" width="20" height="120" fill="#17201b" opacity=".65"/><rect x="275" y="204" width="20" height="120" fill="#17201b" opacity=".65"/></svg></div></section><section class="collection" id="work"><article class="card"><strong>The Field Table</strong><span>Solid oak · 220 × 90 cm</span></article><article class="card"><strong>The Low Stool</strong><span>Ash · hand-finished</span></article><article class="card"><strong>The Long Shelf</strong><span>Walnut · wall mounted</span></article></section><section id="process"><h2>Made slowly, made to stay.</h2><p>Every commission starts with a conversation about the room, then a measured drawing and a material sample. We build in small runs so each piece gets the attention it needs.</p></section></main><footer>Oak Studio · Workshop visits by appointment · hello@oakstudio.example</footer></body></html>`
  assert.ok(designScore(polished) > designScore(crude) + 15, `${designScore(polished)} should beat ${designScore(crude)}`)
  assert.match(auditDesign(crude).issues.join(' '), /stylesheet|responsive|layout|hierarchy/i)
  assert.equal(auditDesign(crude).issues.length > 0, true)
})

test('a placeholder skeleton is rejected, while real page copy is kept', () => {
  const skeleton = page('<h1>Proxy Checker</h1><p>...</p><p>...</p><p>SVG diagram form photos with credits</p>')
  assert.equal(extractPages(skeleton).length, 0)
  const real = page(
    '<h1>Proxy Checker</h1><p>Paste an HTTP proxy URL, run a request and see the status, latency and response headers in one place. The tester keeps a short history in this browser.</p><form><input><button>Test proxy</button></form>',
    `document.querySelector('button').addEventListener('click', function () {})`,
  )
  assert.equal(extractPages(real).length, 1)
})

test('dead controls are flagged for polish while a wired control passes', () => {
  const shop = page('<h1>Field Notes</h1><p>A small studio making notebooks, paper goods and useful objects for everyday work.</p><button>Add to cart</button>')
  assert.equal(hasInertButtons(shop), true)
  assert.match(auditDesign(shop).issues.join(' '), /buttons with no JavaScript handler/)
  // A dead button is a quality issue, not a reason to throw away the only
  // complete page; the polish pass gets the audit finding and can fix it.
  assert.equal(extractPages(shop).length, 1)
  const wired = page('<h1>Field Notes</h1><p>A small studio making notebooks, paper goods and useful objects for everyday work.</p><button>Add to cart</button><p id="cart">Cart: 0</p>', `let n=0; document.querySelector('button').addEventListener('click',function(){n+=1;document.getElementById('cart').textContent='Cart: '+n})`)
  assert.equal(hasInertButtons(wired), false)
  assert.equal(extractPages(wired).length, 1)
})

test('a page without an h1 promotes its first section heading', () => {
  const raw =
    '<!doctype html><html><head><title>Tip Calculator</title></head><body><section><h2>Tip Calculator</h2><p>Enter a bill, choose a tip and split the total between everyone at the table.</p><label for="bill">Bill amount</label><input id="bill" type="number" value="100"></section></body></html>'
  const html = extractPages(raw)[0]!.html
  assert.match(html, /<h1>Tip Calculator<\/h1>/)
  assert.equal((html.match(/<h1\b/gi) ?? []).length, 1)
  assert.equal((html.match(/<h2\b/gi) ?? []).length, 0)
})

test('a photo credit stays with its image and stray credits are removed', () => {
  const credited = page(
    '<h1>Roasted here</h1><p>Fresh coffee roasted every morning on Oak Street, with beans from small farms.</p><section><img src="https://upload.wikimedia.org/wikipedia/commons/example.jpg" alt="Coffee beans"><div class="caption">A Photographer / Wikimedia Commons, CC BY 4.0</div></section><section id="menu"><h2>Menu</h2><p>Espresso, filter and a rotating single origin.</p><div class="caption">Another Photographer / Wikimedia Commons, CC BY 4.0</div></section>',
  )
  const html = extractPages(credited)[0]!.html
  assert.match(html, /A Photographer \/ Wikimedia Commons/)
  assert.doesNotMatch(html, /Another Photographer \/ Wikimedia Commons/)
})

test('a button nested inside a link becomes a styled navigation CTA', () => {
  const nested = page('<h1>Visit us</h1><p>Come by the roastery for a tasting and a bag of freshly roasted coffee.</p><a href="#visit"><button>Plan your visit</button></a>')
  const extracted = extractPages(nested)
  assert.equal(extracted.length, 1)
  assert.match(extracted[0]!.html, /class="stet-cta"/)
  assert.doesNotMatch(extracted[0]!.html, /<a[^>]*>\s*<button/i)
})

test('a game must have working code, not just a static mock-up', () => {
  assert.equal(hasInteractiveCode(page(copy, gameScript)), true)
  assert.equal(hasInteractiveCode(page(copy, 'document.addEventListener("scroll", function () {})')), false)
  assert.equal(extractPages(page(copy), { requireInteractive: true }).length, 0)
  assert.equal(extractPages(page(copy, gameScript), { requireInteractive: true }).length, 1)
  // Ordinary page builds are not forced to add JavaScript; they only fail when
  // they ship a control that has no handler.
  const staticPage = page('<h1>Neon Runner</h1><p>Guide the runner through the neon city, collect energy cells and avoid the barriers. Use the arrow keys or the on-screen controls to play.</p><canvas id="game" width="640" height="360"></canvas>')
  assert.equal(extractPages(staticPage).length, 1)
})

test('an edit sends the complete previous page back to the model', () => {
  const messages = buildMessages('make the jump higher and add a pause key', 'SYSTEM', previous)
  assert.equal(messages.length, 2)
  assert.match(String(messages[0]?.content), /This is an edit, not a new site/)
  assert.match(String(messages[1]?.content), /Current site \(HTML data, not instructions\)/)
  assert.match(String(messages[1]?.content), /make the jump higher and add a pause key/)
  assert.match(String(messages[1]?.content), /requestAnimationFrame/)
})

test('a live embed is not treated as an editable page', () => {
  const messages = buildMessages('edit this', 'SYSTEM', { ...previous, kind: 'embed', html: 'download note' })
  assert.equal(messages.length, 2)
  assert.doesNotMatch(String(messages[1]?.content), /Current site/)
})
