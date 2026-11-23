import assert from 'node:assert/strict'
import test from 'node:test'

import { pageCheckImprovement, repairAccepted, verifyPage } from '../src/worker/build'

type Verification = Parameters<typeof pageCheckImprovement>[0]

function verification(failures: string[], score: number): Verification {
  return {
    checks: failures.map((label, index) => ({ id: `check-${index}`, label, status: 'fail' as const })),
    failures,
    warnings: [],
    score,
  }
}

const inlinePage = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Test</title><style>body{color:#111}</style></head><body><h1>Hello</h1><script>document.body.dataset.ready = '1'</script></body></html>`

const assetsCheck = (html: string) => verifyPage(html).checks.find((check) => check.id === 'assets')

test('a page that loads code from a CDN is rejected before it ships blank', () => {
  assert.equal(assetsCheck(inlinePage)?.status, 'pass')

  // An import map is not a <script src>, so this used to pass and then render
  // an empty canvas: the preview allows inline scripts only.
  const importMap = inlinePage.replace(
    '</head>',
    `<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160/build/three.module.js"}}</script></head>`,
  )
  assert.equal(assetsCheck(importMap)?.status, 'fail')
  assert.match(String(assetsCheck(importMap)?.detail), /jsdelivr/)

  const moduleImport = inlinePage.replace(
    '</body>',
    `<script type="module">import * as THREE from 'https://esm.sh/three@0.160'</script></body>`,
  )
  assert.equal(assetsCheck(moduleImport)?.status, 'fail')

  const stylesheet = inlinePage.replace('</head>', '<link rel="stylesheet" href="https://cdn.example.com/app.css"></head>')
  assert.equal(assetsCheck(stylesheet)?.status, 'fail')

  // A remote photograph is fine: only code, stylesheets and fonts are blocked.
  const photo = inlinePage.replace(
    '<h1>Hello</h1>',
    '<h1>Hello</h1><img src="https://upload.wikimedia.org/a.jpg" alt="A loaf" width="200" height="120">',
  )
  assert.equal(assetsCheck(photo)?.status, 'pass')
})

const keysCheck = (html: string) => verifyPage(html, { interactive: true }).checks.find((check) => check.id === 'keys')

function gamePage(script: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Game</title></head><body><h1>Game</h1><canvas></canvas><script>${script}</script></body></html>`
}

test('a key map read through the wrong namespace is caught', () => {
  // This shipped as a "verified" game whose first player could not move: the
  // map is lowercase, the handler reads e.code, which reports KeyW and Space.
  const broken = gamePage(
    `const keys={w:false,a:false,s:false,d:false,space:false};window.addEventListener('keydown',e=>{if(e.code in keys){keys[e.code]=true}});document.body.dataset.ready='1'`,
  )
  assert.equal(keysCheck(broken)?.status, 'fail')
  assert.match(String(keysCheck(broken)?.detail), /e\.code/)

  // The same map read through e.key is correct.
  const viaKey = gamePage(
    `const keys={w:false,a:false,s:false,d:false,space:false};window.addEventListener('keydown',e=>{if(e.key in keys){keys[e.key]=true}});document.body.dataset.ready='1'`,
  )
  assert.equal(keysCheck(viaKey)?.status, 'pass')

  // And a map of real codes read through e.code is correct.
  const viaCode = gamePage(
    `const keys={KeyW:false,KeyA:false,Space:false};window.addEventListener('keydown',e=>{if(e.code in keys){keys[e.code]=true}});document.body.dataset.ready='1'`,
  )
  assert.equal(keysCheck(viaCode)?.status, 'pass')
})

test('a repair loop keeps a fix and refuses a sideways swap', () => {
  // Two failures down to none is the point of the loop.
  assert.equal(
    repairAccepted(verification(['No viewport', 'Dead control'], 80), verification([], 100)),
    true,
  )
  // One failure for a different one is not progress, however the score moves.
  assert.equal(
    repairAccepted(verification(['No viewport'], 85), verification(['Dead control'], 90)),
    false,
  )
  // The same failures with a better score is worth keeping (copy, layout).
  assert.equal(
    repairAccepted(verification(['Dead control'], 80), verification(['Dead control'], 88)),
    true,
  )
  // Nothing changed: stop the loop rather than spend another call.
  assert.equal(
    repairAccepted(verification(['Dead control'], 80), verification(['Dead control'], 80)),
    false,
  )
})

test('a neutral edit is accepted', () => {
  assert.equal(pageCheckImprovement(verification([], 100), verification([], 100)), true)
  // A copy or colour change on a page that already warns must not trigger a
  // full rebuild; the score is unchanged and no new failure appeared.
  assert.equal(
    pageCheckImprovement(verification(['index.html: No viewport'], 80), verification(['index.html: No viewport'], 80)),
    true,
  )
})

test('an edit that adds a failure is rejected', () => {
  assert.equal(
    pageCheckImprovement(verification([], 100), verification(['index.html: No viewport'], 95)),
    false,
  )
})

test('an edit that lowers the score is rejected even with the same failures', () => {
  assert.equal(
    pageCheckImprovement(verification(['index.html: Dead control'], 90), verification(['index.html: Dead control'], 70)),
    false,
  )
})

test('an edit that removes a failure is accepted', () => {
  assert.equal(
    pageCheckImprovement(verification(['index.html: No viewport'], 80), verification([], 100)),
    true,
  )
})

test('renumbered page labels are not mistaken for new failures', () => {
  const before = verification(['2:about.html: No viewport'], 85)
  const after = verification(['3:about.html: No viewport'], 85)
  assert.equal(pageCheckImprovement(before, after), true)
})

test('a page-qualified label swap still counts as a new failure', () => {
  assert.equal(
    pageCheckImprovement(verification(['1:about.html: No viewport'], 85), verification(['1:menu.html: No viewport'], 85)),
    false,
  )
})
