import assert from 'node:assert/strict'
import test from 'node:test'

import type { Env } from '../src/worker/env'
import { AiError } from '../src/worker/ai'
import { buildComplete, parseBuildReview, verifyPage } from '../src/worker/build'
import { laneText, publicLanes, type PublicLane } from '../src/worker/public-ai'

const goodPage = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Field Notes</title>
<style>
:root{--ink:#20231f;--paper:#f7f4ec;--surface:#fffdf8;--line:#dfd9cb;--accent:#a4472b;--radius:12px;--space:8px}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.6 system-ui,sans-serif}
header{display:flex;align-items:center;justify-content:space-between;gap:20px;max-width:1120px;margin:0 auto;padding:16px 24px}
main{max-width:1120px;margin:0 auto;padding:0 24px}.hero{display:grid;grid-template-columns:1.1fr .9fr;gap:40px;padding:64px 0}
.eyebrow{color:var(--accent);font-size:12px;letter-spacing:.14em;text-transform:uppercase}h1{font-size:clamp(2rem,6vw,4rem);line-height:1;margin:.2em 0}
p{max-width:60ch;color:#556055}.panel{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:24px}
button{min-height:44px;padding:0 18px;border:1px solid var(--line);border-radius:9px;background:var(--surface);font:inherit;cursor:pointer}
button:focus-visible,a:focus-visible{outline:3px solid var(--accent);outline-offset:3px}.note{margin-top:16px;font-weight:600}
@media (max-width:720px){.hero{grid-template-columns:1fr;padding:36px 0}header{flex-wrap:wrap}}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
</style></head>
<body><header><strong>Field Notes</strong><nav><a href="#work">Work</a><a href="#contact">Contact</a></nav></header>
<main><section class="hero"><div><p class="eyebrow">Independent studio</p><h1>Useful things, made carefully.</h1><p>We design notebooks and small objects for people who care about how a tool feels in the hand. Every material is chosen for repair and daily use.</p><button id="cta">See the collection</button><p class="note" id="note" aria-live="polite"></p></div><div class="panel"><h2>Made to be used</h2><p>Simple forms, visible construction and paper that takes ink without bleeding through.</p></div></section>
<section id="work"><h2>Selected work</h2><p>The Field Book, the Low Desk and a small set of folders. Each piece is finished by hand in the studio.</p></section>
<section id="contact"><h2>Start a project</h2><p>Tell us what you need and we will reply with a material and timing estimate.</p></section></main>
<script>document.getElementById('cta').addEventListener('click',function(){document.getElementById('note').textContent='The collection is ready to view.'})</script>
</body></html>`

const weakPage = '<!doctype html><html><head><title>Weak</title></head><body><h1>Weak page</h1><p>Short copy.</p><button>Go</button></body></html>'

const lane: PublicLane = {
  url: 'https://example.test/v1/chat/completions',
  model: 'test-model',
  label: 'Test Lane',
  description: 'test',
}

test('the page verifier catches structural failures and accepts a finished page', () => {
  const good = verifyPage(goodPage)
  assert.equal(good.failures.length, 0)
  assert.ok(good.checks.some((check) => check.id === 'viewport' && check.status === 'pass'))
  assert.ok(good.checks.some((check) => check.id === 'controls' && check.status === 'pass'))

  const weak = verifyPage(weakPage)
  assert.ok(weak.failures.some((failure) => /viewport|stylesheet/i.test(failure)))
  assert.ok(weak.failures.some((failure) => /button|handler/i.test(failure)))
})

test('interactive requests fail when the interaction disappears', () => {
  const staticTool = goodPage.replace(/<script>[\s\S]*?<\/script>/, '')
  const result = verifyPage(staticTool, { interactive: true })
  assert.ok(result.failures.some((failure) => /interactive/i.test(failure)))
})

test('the reviewer parser accepts only clear verdicts', () => {
  assert.deepEqual(parseBuildReview('{"verdict":"pass","issues":[]}'), { verdict: 'pass', issues: [] })
  assert.deepEqual(parseBuildReview('{"verdict":"revise","issues":["The menu button has no handler."]}'), {
    verdict: 'revise',
    issues: ['The menu button has no handler.'],
  })
  assert.deepEqual(parseBuildReview('PASS'), { verdict: 'pass', issues: [] })
  assert.equal(parseBuildReview('I think it is mostly fine.'), undefined)
})

test('OpenRouter lane billing is honest about paid models', () => {
  const lanes = publicLanes({
    OPENROUTER_API_KEY: 'test',
    OPENROUTER_MODELS: 'moonshotai/kimi-k3,deepseek/deepseek-v4.1-flash,nvidia/nemotron-3-ultra-550b-a55b:free',
  } as unknown as Env)
  const kimi = lanes.find((item) => item.model === 'moonshotai/kimi-k3')
  const deepseek = lanes.find((item) => item.model === 'deepseek/deepseek-v4.1-flash')
  const free = lanes.find((item) => item.model === 'nvidia/nemotron-3-ultra-550b-a55b:free')
  assert.equal(kimi?.billing, 'paid')
  assert.match(kimi?.description ?? '', /paid/i)
  assert.equal(deepseek?.billing, 'paid')
  assert.equal(free?.billing, 'free')
})

test('a quota notice returned with HTTP 200 is a failed lane, not an answer', async () => {
  const originalFetch = globalThis.fetch
  const outcomes: Array<{ ok: boolean; code?: string }> = []
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        choices: [{
          message: {
            content: 'Sorry, to prevent abuse of free resources, accounts that have not been recharged can only try 10 times.',
          },
        }],
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )) as typeof fetch
  try {
    await assert.rejects(
      laneText(lane, {
        messages: [{ role: 'user', content: 'hello' }],
        onLaneResult: (result) => outcomes.push({ ok: result.ok, ...(result.ok ? {} : { code: result.code }) }),
      }),
      (error: unknown) => error instanceof AiError && error.code === 'quota',
    )
    assert.deepEqual(outcomes.at(-1), { ok: false, code: 'quota' })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('Build goes straight to a draft and skips optional review for a clean page', async () => {
  const style = /<style>[\s\S]*?<\/style>/.exec(goodPage)?.[0] ?? ''
  const toolPage = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tip calculator</title>${style}</head>
<body><header><strong>Quick Tip</strong><nav><a href="#tool">Tool</a></nav></header><main id="tool"><p class="eyebrow">Restaurant maths</p><h1>Tip calculator</h1><p>Enter the bill and see a twenty percent tip and the total update immediately. The result stays visible while you adjust the amount.</p><label for="bill">Bill amount</label><input id="bill" type="number" value="40" aria-label="Bill amount"><button id="go">Calculate</button><p class="note" id="out" aria-live="polite"></p></main>
<script>(function(){var bill=document.getElementById('bill');var out=document.getElementById('out');function calculate(){var value=Number(bill.value)||0;var tip=value*0.2;out.textContent='Tip '+tip.toFixed(2)+' · Total '+(value+tip).toFixed(2);}document.getElementById('go').addEventListener('click',calculate);bill.addEventListener('input',calculate);calculate();})();</script></body></html>`
  const originalFetch = globalThis.fetch
  let calls = 0
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as { messages?: Array<{ content?: string }> }
    const system = body.messages?.[0]?.content ?? ''
    // A simple utility should be written by the first lane and accepted without
    // a preceding planner, a reviewer, or a design rewrite.
    assert.match(system, /senior product engineer/i)
    calls += 1
    return new Response(JSON.stringify({ choices: [{ message: { content: toolPage } }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }) as typeof fetch
  try {
    const lanes: PublicLane[] = [
      { url: 'https://a.example/v1/chat/completions', model: 'deepseek-test', label: 'DeepSeek Test', description: 'test' },
      { url: 'https://b.example/v1/chat/completions', model: 'nemotron-test', label: 'Nemotron Test', description: 'test' },
    ]
    const outcome = await buildComplete({ lanes, question: 'build a tip calculator' })
    assert.equal(calls, 1, 'a clean draft should not spend extra model calls on planning or review')
    assert.equal(outcome.build.verification?.status, 'verified')
    assert.equal(outcome.build.verification?.spec, false)
    assert.equal(outcome.build.verification?.reviewer, undefined)
    assert.equal(outcome.route?.task, 'build')
    assert.ok(outcome.build.verification?.checks.some((check) => check.id === 'interactive' && check.status === 'pass'))
  } finally {
    globalThis.fetch = originalFetch
  }
})
