import assert from 'node:assert/strict'
import test from 'node:test'

import type { BuildInfo } from '../src/shared/types'
import { auditDesign, buildMessages, designScore, ensureViewport, extractPages, gameInitializationIssues, hasInertButtons, hasInteractiveCode, hasProxyCode, injectBaseControls, isFunctionalRequest, isGameRequest, isInteractiveRequest, isProxyRequest, repairGameInitialization, requestCoverage, requestedControlIssues, requestedPageLimit, singleH1, verifyPage } from '../src/worker/build'
import { applyPageShell } from '../src/worker/page-shell'
import { isBuildRequest } from '../src/shared/agent'

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

test('a 3D game that creates its WebGL canvas in JavaScript is still interactive', () => {
  const threeD = page(
    '<h1>Orbit</h1><div id="app"></div>',
    `const canvas = document.createElement('canvas'); document.getElementById('app').appendChild(canvas); const gl = canvas.getContext('webgl'); let angle = 0; addEventListener('keydown', function (event) { angle += 0.1; }); function loop() { angle += 0.01; gl.clear(gl.COLOR_BUFFER_BIT); requestAnimationFrame(loop); } requestAnimationFrame(loop);`,
  )
  assert.equal(hasInteractiveCode(threeD), true)
  assert.equal(extractPages(threeD, { requireInteractive: true }).length, 1)
})

test('a working tool must include real interactive code', () => {
  const calculator = page(
    '<h1>Tip calculator</h1><p>Enter the bill and see a twenty percent tip and the total update immediately.</p><input id="bill" aria-label="Bill"><button id="go">Calculate</button><output id="out"></output>',
    `document.getElementById('go').addEventListener('click', function () { var bill = Number(document.getElementById('bill').value) || 0; document.getElementById('out').textContent = (bill * 1.2).toFixed(2); })`,
  )
  assert.equal(extractPages(calculator, { requireInteractive: true }).length, 1)
  assert.equal(extractPages(page('<h1>Tip calculator</h1><p>Calculate a tip for any bill in seconds.</p>'), { requireInteractive: true }).length, 0)
})

test('fast drafts get one heading and usable control affordances without another model call', () => {
  const raw = page('<h1>Field Notes</h1><h1>Today’s picks</h1><p>A small studio making notebooks, paper goods and useful objects for everyday work.</p><input aria-label="Search the catalogue">')
  const tidy = injectBaseControls(ensureViewport(singleH1(raw)))
  assert.equal((tidy.match(/<h1\b/gi) ?? []).length, 1)
  assert.equal((tidy.match(/<h2\b/gi) ?? []).length, 1)
  assert.match(tidy, /name="viewport"/)
  assert.match(tidy, /:focus-visible/)
  assert.match(tidy, /:where\(input,select,textarea\)/)
  assert.doesNotMatch(auditDesign(tidy).issues.join(' '), /keyboard-focus|browser defaults|more than one h1/)
  assert.ok(designScore(tidy) >= designScore(raw))
  assert.equal(injectBaseControls(tidy), tidy)
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

test('a headingless canvas game gets one hidden accessible heading', () => {
  const raw =
    '<!doctype html><html lang="en"><head><title>Tag Arena</title></head><body><p>Two players chase each other across the platforms. Use WASD and the arrow keys to move.</p><canvas id="game" width="640" height="360"></canvas><script>addEventListener("keydown", function (e) { if (e.key === "w") move(); }); requestAnimationFrame(function loop(){ requestAnimationFrame(loop); });</script></body></html>'
  const html = extractPages(raw)[0]!.html
  assert.match(html, /<h1 style="position:absolute[^>]*>Tag Arena<\/h1>/)
  assert.equal((html.match(/<h1\b/gi) ?? []).length, 1)
  assert.equal(verifyPage(html, { interactive: true }).failures.some((failure) => /heading/i.test(failure)), false)

  // Start and game-over overlays can each carry a heading; that is a warning,
  // not a broken page.
  const twoScreens = verifyPage(
    page('<h1>Start</h1><h1>Time up</h1><button>Restart</button>', gameScript),
    { interactive: true },
  )
  assert.equal(twoScreens.failures.some((failure) => /heading/i.test(failure)), false)
  assert.equal(twoScreens.checks.find((check) => check.id === 'h1')?.status, 'warn')
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

test('a two-player game must expose the requested controls and both players', () => {
  const prompt = 'Make a two-player platformer tag game. One player uses WASD, the other uses the arrow keys.'
  const tagPage = page(
    '<h1>Tag arena</h1><p>Player 1 moves with WASD. Player 2 moves with the arrow keys. Tag the other player before the timer ends.</p><canvas id="game" width="640" height="360"></canvas><button id="start">Start</button>',
    `addEventListener('keydown', function (event) { var key = event.key; if (['w','a','s','d'].indexOf(key) >= 0) movePlayer1(key); if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].indexOf(key) >= 0) movePlayer2(key); }); requestAnimationFrame(function loop(){ requestAnimationFrame(loop); });`,
  )
  assert.deepEqual(requestedControlIssues(prompt, tagPage), [])
  assert.ok(verifyPage(tagPage, { interactive: true, question: prompt }).checks.some((check) => check.id === 'requested-controls' && check.status === 'pass'))

  const oneControlMap = page(
    '<h1>Tag arena</h1><p>Both players use the arrow keys. Tag the other player before the timer ends.</p><canvas id="game" width="640" height="360"></canvas><button id="start">Start</button>',
    `addEventListener('keydown', function (event) { if (window.keys) keys[event.key] = true; }); requestAnimationFrame(function loop(){ requestAnimationFrame(loop); });`,
  )
  assert.match(requestedControlIssues(prompt, oneControlMap).join(' '), /WASD|both players/i)
  const themed = verifyPage(oneControlMap, { interactive: true, question: prompt })
  assert.ok(themed.failures.some((failure) => /Requested controls/i.test(failure)))

  // Copy that names both schemes is not enough when the script only binds one.
  const proseOnly = page(
    '<h1>Tag arena</h1><p>Player 1 uses WASD and player 2 uses the arrow keys.</p><canvas id="game" width="640" height="360"></canvas><button id="start">Start</button>',
    `addEventListener('keydown', function (event) { if (['w','a','s','d'].includes(event.key)) movePlayer1(event.key); }); requestAnimationFrame(function loop(){ requestAnimationFrame(loop); });`,
  )
  assert.match(requestedControlIssues(prompt, proseOnly).join(' '), /arrow-key controls are not wired/i)

  // Down keys are optional in a platformer; a complete horizontal move plus
  // jump scheme should not be rejected for leaving S and ArrowDown unused.
  const noDownKeys = page(
    '<h1>Tag arena</h1><p>Player 1 moves with WASD. Player 2 moves with the arrow keys. Tag the other player before the timer ends.</p><canvas id="game" width="640" height="360"></canvas><button id="start">Start</button>',
    `addEventListener('keydown', function (event) { if (['w','a','d'].indexOf(event.key) >= 0) movePlayer1(event.key); if (['ArrowUp','ArrowLeft','ArrowRight'].indexOf(event.key) >= 0) movePlayer2(event.key); }); requestAnimationFrame(function loop(){ requestAnimationFrame(loop); });`,
  )
  assert.deepEqual(requestedControlIssues(prompt, noDownKeys), [])

  // Key maps are often object literals with unquoted keys; `event.key in keys`
  // is a complete binding, not prose.
  const keyMap = page(
    '<h1>Tag arena</h1><p>Player 1 moves with WASD. Player 2 moves with the arrow keys.</p><canvas id="game" width="640" height="360"></canvas><button id="start">Start</button>',
    `const keys = { w: false, a: false, s: false, d: false, ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false }; addEventListener('keydown', function (event) { if (event.key in keys) keys[event.key] = true; }); requestAnimationFrame(function loop(){ requestAnimationFrame(loop); });`,
  )
  assert.deepEqual(requestedControlIssues(prompt, keyMap), [])

  // A game may label its players by name or colour instead of P1/P2.
  const namedPlayers = page(
    '<h1>Tag arena</h1><p>Red moves with WASD; Blue moves with the arrow keys.</p><canvas id="game" width="640" height="360"></canvas><button id="start">Start</button>',
    `const BIND = [{ name: 'Red', l: 'KeyA', r: 'KeyD', j: 'KeyW' }, { name: 'Blue', l: 'ArrowLeft', r: 'ArrowRight', j: 'ArrowUp' }]; addEventListener('keydown', function (event) { if (BIND.some(b => [b.l,b.r,b.j].includes(event.code))) event.preventDefault(); }); requestAnimationFrame(function loop(){ requestAnimationFrame(loop); });`,
  )
  assert.deepEqual(requestedControlIssues(prompt, namedPlayers), [])

  // A tag must not flip every frame while the players stay overlapped.
  const tagScript = (guarded: string) =>
    `${guarded}addEventListener('keydown', function (event) { if (['w','a','s','d'].indexOf(event.key) >= 0) movePlayer1(event.key); if (['ArrowUp','ArrowLeft','ArrowRight'].indexOf(event.key) >= 0) movePlayer2(event.key); }); let itPlayer = 0; function checkTag(){ itPlayer = 1 - itPlayer; } requestAnimationFrame(function loop(){ checkTag(); requestAnimationFrame(loop); });`
  assert.match(requestedControlIssues(prompt, page('<h1>Tag arena</h1><p>Player 1 uses WASD. Player 2 uses the arrow keys.</p>', tagScript(''))).join(' '), /cooldown/i)
  assert.deepEqual(
    requestedControlIssues(prompt, page('<h1>Tag arena</h1><p>Player 1 uses WASD. Player 2 uses the arrow keys.</p>', tagScript('let lastTag = 0; '))),
    [],
  )
})

test('a game never draws before its players exist', () => {
  const broken = page(
    copy,
    `let p1, p2; function draw(){ ctx.fillStyle = p1.color; } function loop(){ draw(); requestAnimationFrame(loop); } requestAnimationFrame(loop);`,
  )
  assert.match(gameInitializationIssues(broken).join(' '), /before its players/i)
  const repaired = repairGameInitialization(broken)
  assert.match(repaired, /function draw\(\)\{\n  if \(!p1 \|\| !p2\) return;/)
  assert.deepEqual(gameInitializationIssues(repaired), [])

  // Inline players are safe, and a reset() call before the loop is safe too.
  assert.deepEqual(gameInitializationIssues(page(copy, `const p1 = { x: 0 }; const p2 = { x: 10 }; function draw(){ ctx.fillStyle = p1.color; } requestAnimationFrame(draw);`)), [])
  assert.deepEqual(gameInitializationIssues(page(copy, `let p1, p2; function draw(){ ctx.fillStyle = p1.color; }\nreset();\nrequestAnimationFrame(draw);`)), [])
})

test('a contact tag is checked before collision separation', () => {
  const prompt = 'Make a two-player platformer tag game. One player uses WASD, the other uses the arrow keys.'
  const controls = `addEventListener('keydown', function (event) { if (['w','a','s','d'].indexOf(event.key) >= 0) movePlayer1(event.key); if (['ArrowUp','ArrowLeft','ArrowRight'].indexOf(event.key) >= 0) movePlayer2(event.key); }); let tagCooldown = 0;`
  const unreachable = page(
    copy,
    `${controls} function update(dt){ checkPlayerCollision(); if (tagCooldown === 0) { const dx = Math.abs(p1.x - p2.x); p1.isIt = !p1.isIt; tagCooldown = 1; } } requestAnimationFrame(function loop(){ update(0); requestAnimationFrame(loop); });`,
  )
  assert.match(requestedControlIssues(prompt, unreachable).join(' '), /separated|tag can never connect/i)

  const reachable = page(
    copy,
    `${controls} function update(dt){ const dx = Math.abs(p1.x - p2.x); checkPlayerCollision(); if (tagCooldown === 0 && dx < 30) { p1.isIt = !p1.isIt; tagCooldown = 1; } } requestAnimationFrame(function loop(){ update(0); requestAnimationFrame(loop); });`,
  )
  assert.deepEqual(requestedControlIssues(prompt, reachable), [])
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

test('a start-with request carries a final seeded-content acceptance check', () => {
  const seeded = buildMessages('Build a meal planner. Start with a few realistic meals.', 'SYSTEM')
  assert.match(seeded.at(-1)!.content, /ACCEPTANCE CHECK[\s\S]*empty state/i)
  const plain = buildMessages('Build a mortgage calculator.', 'SYSTEM')
  assert.doesNotMatch(plain.at(-1)!.content, /ACCEPTANCE CHECK/)
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

test('a truncated page and an anchor to a missing section are rejected', () => {
  const truncated =
    '<!doctype html><html><head><title>Bookstore</title></head><body><h1>Paper Lantern</h1><p>A neighborhood bookstore with staff picks, events and a reading room.</p><section id="events"><div'
  assert.equal(extractPages(truncated).length, 0)
  const missingTarget =
    "<!doctype html><html lang=\"en\"><head><title>Bookstore</title></head><body><h1>Paper Lantern</h1><p>A neighborhood bookstore with staff picks, events and a reading room.</p><nav><a href=\"#events\">Events</a><a href=\"#visit\">Visit</a></nav><section id=\"events\"><h2>Events</h2><p>Poetry night and a children's story hour this week.</p></section></body></html>"
  const html = extractPages(missingTarget)[0]!.html
  assert.ok(verifyPage(html).failures.some((failure) => /No section has id: visit/i.test(failure)))
})

test('duplicate element ids fail the page check', () => {
  const html = extractPages(
    page(
      '<h1>Tip calculator</h1><p>Enter a bill, choose a tip and split the total between everyone at the table.</p><label for="roundup">Round up</label><input id="roundup" type="checkbox"><label for="roundup">Round up the total</label><input id="roundup" type="checkbox">',
    ),
  )[0]!.html
  const verification = verifyPage(html)
  assert.ok(verification.failures.some((failure) => /Element ids are unique/i.test(failure)))
  // Ids that only appear inside script strings are not live DOM ids.
  const scriptOnly = page(
    '<h1>Tip calculator</h1><p>Enter a bill, choose a tip and split the total between everyone at the table.</p><output id="out"></output>',
    `document.getElementById('out').innerHTML = '<span id="out">ready</span>'`,
  )
  const clean = verifyPage(scriptOnly).checks.find((check) => check.id === 'ids')
  assert.equal(clean?.status, 'pass')
})

test('an explicit page count is honoured', () => {
  assert.equal(requestedPageLimit('Make a one-page portfolio'), 1)
  assert.equal(requestedPageLimit('Make a landing page for a coffee shop'), 1)
  assert.equal(requestedPageLimit('Make a two-page site for a bakery'), 2)
  assert.equal(requestedPageLimit('Build a 3 page dashboard'), 3)
  assert.equal(requestedPageLimit('Build a multi-page site'), undefined)

  const pages = extractPages(
    `<!-- page: index.html -->\n${page('<h1>Home</h1><p>Welcome to the bakery. We bake bread every morning and keep a small menu of pastries and coffee for the neighborhood.</p>')}\n<!-- page: menu.html -->\n${page('<h1>Menu</h1><p>Our menu changes with the season. Today we have sourdough, rye, butter croissants and a simple filter coffee.</p>')}`,
    { maxPages: 1 },
  )
  assert.equal(pages.length, 1, 'a one-page request must not be expanded to multiple pages')
  assert.equal(pages[0]?.name, 'index.html')
})

test('page links keep real file names and preserve anchors', () => {
  const linked = extractPages(
    [
      '<!-- page: index.html -->',
      '<!doctype html><html><body><h1>Oak Street Roast</h1><p>Fresh coffee roasted on Oak Street every morning since 2019.</p><a href="./menu.html#drinks">Menu</a></body></html>',
      '<!-- page: menu.html -->',
      '<!doctype html><html><body><h1>Menu</h1><p>Espresso, flat white and a filter of the day, all under five dollars.</p></body></html>',
    ].join('\n'),
  )
  assert.match(linked[0]!.html, /href="menu\.html#drinks"/)
  assert.doesNotMatch(linked[0]!.html, /href="#page:/)
})

/**
 * The bakery run scored 85 with `<link rel="stylesheet" href="styles.css">` and
 * no styles.css in the project: a page that renders unstyled. The checks now
 * compare the page's local references with the workspace.
 */
test('a page that links a file it never wrote fails its checks', () => {
  const html =
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Bakery</title><link rel="stylesheet" href="styles.css"></head><body><h1>Bakery</h1><script src="script.js"></script></body></html>'

  const broken = verifyPage(html, { files: ['index.html'] })
  assert.ok(broken.failures.some((failure) => /styles\.css/.test(failure)), 'the dead stylesheet link is a failure')
  assert.ok(broken.score < 85, 'and it is not good enough to stop on')

  // Even when the files exist: the preview renders the document alone, so a
  // linked stylesheet or script never loads and the page arrives unstyled with
  // dead buttons.
  const resolved = verifyPage(html, { files: ['index.html', 'styles.css', 'script.js'] })
  assert.ok(
    resolved.failures.some((failure) => /does not load in the preview/.test(failure)),
    'linked code is refused even when the file exists',
  )

  // A relative image, on the other hand, resolves against the page's folder.
  const nested = verifyPage(html, {
    files: ['pages/index.html', 'pages/img/hero.jpg'],
    pagePath: 'pages/index.html',
  })
  assert.ok(nested.failures.some((failure) => /does not load in the preview/.test(failure)), 'the linked code still fails')
  const picture = nested.checks.some((check) => /linked file/i.test(check.detail ?? '') && /hero/i.test(check.detail ?? ''))
  assert.equal(picture, false, 'a missing image is not reported against an existing one')

  // Absolute URLs and anchors are not local files.
  const external = verifyPage(
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>t</title><link rel="stylesheet" href="https://cdn.example/x.css"></head><body><h1>t</h1><a href="#top">top</a></body></html>',
    { files: ['index.html'] },
  )
  assert.equal(external.failures.some((failure) => /linked file/i.test(failure)), false)
})

/**
 * The 100/100 bakery page still had a header that clipped on a phone: its
 * breakpoint changed padding and centred the nav, nothing else.
 */
test('a breakpoint that does not stack the header fails the reflow check', () => {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Bakery</title>
<style>header{display:flex;justify-content:space-between;align-items:center}.nav a{margin-left:2rem}${'.row{padding:1rem}'.repeat(60)}
@media(max-width:640px){.hero{padding:64px 0}.nav{justify-content:center}}</style></head>
<body><header><span>Sweet Crumb Bakery</span><nav class="nav"><a href="#menu">Menu</a><a href="#contact">Contact</a></nav></header><main><h1>Bakery</h1><p>${'Fresh bread every morning. '.repeat(10)}</p></main></body></html>`

  const cramped = verifyPage(html)
  assert.ok(cramped.failures.some((failure) => /Header reflows on a phone/.test(failure)), 'the cramped header fails')

  const stacked = verifyPage(html.replace('.nav{justify-content:center}', '.nav{justify-content:center}header{flex-direction:column;gap:.5rem}'))
  assert.equal(stacked.failures.some((failure) => /Header reflows/.test(failure)), false, 'a stacked header passes')
})

test('a fixed header over the content and undefined tokens are both caught', () => {
  const css = (body: string) => `<style>${body}</style>`
  const run = (style: string) =>
    verifyPage(
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Coffee</title>${css(style)}</head><body><header><nav><a href="#a">Menu</a><a href="#b">About</a></nav></header><main><section id="a"><h1>Coffee</h1><p>${'Real copy about the shop. '.repeat(8)}</p></section><section id="b"><h2>About</h2><p>${'More words here. '.repeat(10)}</p></section></main></body></html>`,
    )

  const broken = run(`header{position:fixed;top:0;left:0;right:0}.nav{display:flex;gap:var(--space-4)}.nav a{color:#333}body{font-family:system-ui}`)
  assert.ok(
    broken.failures.some((failure) => /header does not cover/.test(failure)),
    'a fixed header with no offset is reported',
  )
  assert.ok(
    broken.failures.some((failure) => /CSS variable is defined/.test(failure)),
    'an undefined var() is reported',
  )

  const fixed = run(
    `:root{--space-4:24px}body{font-family:system-ui;padding-top:72px}header{position:fixed;top:0;left:0;right:0}.nav{display:flex;gap:var(--space-4)}.nav a{color:#333}`,
  )
  assert.equal(fixed.failures.some((failure) => /header does not cover|CSS variable/.test(failure)), false)
})

/**
 * The page shell exists because quality used to depend on a free lane emitting
 * a whole stylesheet inside a ~2,400-character reply. When that reply was cut
 * off the page shipped at design 0–45 with browser-default controls. The
 * foundation is now deterministic, so the only thing the model must get right
 * is structure and copy.
 */
test('the design system is injected once, before the page’s own styles', () => {
  const page = '<!doctype html><html lang="en"><head><title>Blue Room</title><style>:root{--accent:#8a2b3c}</style></head><body><h1>Blue Room</h1></body></html>'
  const once = applyPageShell(page)
  const twice = applyPageShell(once)
  assert.equal((twice.match(/data-ink-shell/g) ?? []).length, 1, 'never two copies')
  assert.equal(twice, once, 're-injecting is idempotent')
  assert.ok(once.indexOf('data-ink-shell') < once.indexOf('--accent:#8a2b3c'), 'the page styles come last and win')
})

test('content alone clears the design bar, without the model writing a stylesheet', () => {
  const bare = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Blue Room</title></head><body>
<header><a href="#top">Blue Room</a><nav><a href="#shows">Shows</a><a href="#contact">Contact</a></nav></header>
<main id="top"><section><h1>Four nights, one room.</h1><p>Doors at seven, first set at eight, every Wednesday to Saturday. Tables are small, the sound is close and the band starts on time.</p><button id="book">Reserve a table</button></section>
<section id="shows"><h2>Upcoming shows</h2><article><h3>Marcus Hale Quartet</h3><p>Hard bop, 8:00 pm, $28.</p></article><article><h3>Ines Duarte Trio</h3><p>Brazilian standards, 9:00 pm, $34.</p></article></section>
<section id="contact"><h2>Find us</h2><address>18 Quay Street</address></section></main>
<footer><p>The Blue Room</p></footer><script>document.getElementById('book').addEventListener('click',function(){this.textContent='Held'})</script></body></html>`

  const before = designScore(bare)
  const after = designScore(applyPageShell(bare))
  assert.ok(before < 40, `an unstyled page is plainly unstyled (was ${before})`)
  assert.ok(after >= 84, `the shell brings it to the bar (was ${after})`)
  assert.deepEqual(verifyPage(applyPageShell(bare), { files: ['index.html'] }).failures, [])
})

test('a page cut off after its first section is still a designed page', () => {
  const fragment =
    '<header><nav><a href="#shows">Shows</a><a href="#contact">Contact</a></nav></header><section><h1>Four nights, one room</h1><p>Doors at seven, first set at eight, every Wednesday to Saturday.</p></section>'
  const shelled = applyPageShell(fragment)
  assert.match(shelled, /data-ink-shell/)
  assert.ok(designScore(shelled) >= 75, `a half-built page keeps its foundation (was ${designScore(shelled)})`)
  assert.ok(designScore(shelled) > designScore(fragment) + 40)
})

test('an artifact-first request is a build, not an edit of the last project', () => {
  assert.equal(isBuildRequest('A page for a jazz club: its four upcoming shows with day, time, act and price.'), true)
  assert.equal(isBuildRequest('A small bakery site with today’s bread list and a pre-order form.'), true)
  assert.equal(isBuildRequest('The page is slow on a phone.'), false, 'a complaint about the current page is not a new page')
})

/**
 * The page checks used to grade markup; they never asked whether the page did
 * what the request said. A measured jazz page passed 88/100 with two of its four
 * shows and an empty membership list. The brief is now part of the verdict.
 */
test('the brief is checked, not just the markup', () => {
  const jazz = 'A page for a jazz club: its four upcoming shows with day, time, act and price, a membership section and contact details.'
  const schedule = `<!doctype html><html lang="en"><head><title>Blue Room</title><meta name="viewport" content="width=device-width"></head><body>
<header><nav><a href="#week">This week</a><a href="#membership">Membership</a><a href="#contact">Contact</a></nav></header>
<main><section id="week"><h1>Blue Room</h1><table><tr><th>Day</th><th>Time</th><th>Act</th><th>Price</th></tr>
<tr><td>Wednesday</td><td>8:30 pm</td><td>The Midnight Set</td><td>$15</td></tr>
<tr><td>Thursday</td><td>9:00 pm</td><td>Ella and the Blue Notes</td><td>$20</td></tr>
<tr><td>Friday</td><td>9:30 pm</td><td>River City Quartet</td><td>$25</td></tr>
<tr><td>Saturday</td><td>8:00 pm</td><td>House Band</td><td>$20</td></tr></table></section>
<section id="membership"><h2>Membership</h2><p>Members get reserved seating for $60 a year.</p></section>
<section id="contact"><h2>Find us</h2><address>18 Quay Street</address><p>hello@blueroom.example</p></section></main></body></html>`
  assert.deepEqual(requestCoverage(jazz, schedule), [], 'a dated, priced run of shows is the schedule, even without the word')
  assert.deepEqual(verifyPage(applyPageShell(schedule), { question: jazz }).failures, [])

  const bakery = 'A page for a small bakery: today bread list with prices, a short about section, opening hours and a pre-order form.'
  const noHours = '<!doctype html><html lang="en"><head><title>Sweet Crumb</title><meta name="viewport" content="width=device-width"></head><body><h1>Sweet Crumb</h1><p>Sourdough $6. Croissant $4.</p><form><input aria-label="name"><button>Send</button></form></body></html>'
  const missing = requestCoverage(bakery, noHours)
  assert.ok(missing.some((item) => /opening hours/.test(item)), `hours are missing: ${missing.join('; ')}`)
  assert.ok(
    verifyPage(noHours, { question: bakery }).failures.some((failure) => /covers the brief/.test(failure)),
    'and the page cannot call itself finished without them',
  )
})

test('a page that writes its own design-system block ends with exactly one, and it is ours', () => {
  const imitation = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Blue Note</title><style data-ink-shell>:root{--ink-color:#1a1a2e}body{color:var(--ink-color)}</style></head><body><h1>Blue Note</h1><p>${'Real copy about the club. '.repeat(8)}</p></body></html>`
  const shipped = applyPageShell(imitation)
  assert.equal((shipped.match(/data-ink-shell/g) ?? []).length, 1, 'no second design system')
  assert.ok(shipped.includes('--ink-bg:#f6f4f0'), 'the runtime block is there')
  assert.ok(!shipped.includes('--ink-color:#1a1a2e'), 'and the imitation is gone rather than duplicated')
})
