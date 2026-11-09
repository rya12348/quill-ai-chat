import assert from 'node:assert/strict'
import test from 'node:test'

import type { BuildInfo } from '../src/shared/types'
import { buildMessages, extractPages, hasInteractiveCode, isGameRequest, isInteractiveRequest } from '../src/worker/build'

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

test('a game must have working code, not just a static mock-up', () => {
  assert.equal(hasInteractiveCode(page(copy, gameScript)), true)
  assert.equal(hasInteractiveCode(page(copy, 'document.addEventListener("scroll", function () {})')), false)
  assert.equal(extractPages(page(copy), { requireInteractive: true }).length, 0)
  assert.equal(extractPages(page(copy, gameScript), { requireInteractive: true }).length, 1)
  // Ordinary page builds are not forced to add JavaScript.
  assert.equal(extractPages(page(copy)).length, 1)
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
