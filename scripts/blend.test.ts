import assert from 'node:assert/strict'
import test from 'node:test'

import { depthFor } from '../src/worker/blend'

test('short chat questions use one lane instead of drafts and a merge', () => {
  assert.equal(depthFor('hello', 3), 'quick')
  assert.equal(depthFor('What is the capital of France?', 3), 'quick')
  assert.equal(depthFor('Why does my React effect run twice?', 3), 'quick')
  assert.equal(depthFor('Summarize Hamlet in two sentences.', 3), 'quick')
  assert.equal(depthFor('Compare tea and coffee.', 3), 'quick')
  // One available lane is always the quick path.
  assert.equal(depthFor('What is a monad?', 1), 'quick')
})

test('a code request keeps the deep pass even when it is short', () => {
  assert.equal(depthFor('```js\nconsole.log(1)\n```\nWhy is this wrong?', 3), 'deep')
})

test('long and multi-part questions keep the team pass', () => {
  assert.equal(depthFor(`${'word '.repeat(70)}?`, 3), 'deep')
  assert.equal(depthFor(`${'a'.repeat(210)}? And ${'b'.repeat(40)}?`, 3), 'deep')

  const medium = 'Explain how a browser turns HTML and CSS into pixels, including layout and painting. '.repeat(3).slice(0, 260)
  assert.equal(medium.length > 200 && medium.length <= 320, true)
  assert.equal(depthFor(medium, 3), 'standard')
})
