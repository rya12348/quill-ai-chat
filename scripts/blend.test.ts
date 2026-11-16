import assert from 'node:assert/strict'
import test from 'node:test'

import { depthFor, isFastAnswerPrompt, isTrivialPrompt, trivialReply } from '../src/worker/blend'

test('greetings never enter the planning or reasoning harness', () => {
  for (const text of ['hi', 'hello!', 'hey there', 'thanks', 'goodbye', 'what’s up?']) {
    assert.equal(isTrivialPrompt(text), true, text)
  }
  assert.equal(isTrivialPrompt('Why does my React effect run twice?'), false)
  assert.match(trivialReply('hi'), /help/i)
  assert.equal(trivialReply('thanks'), "You're welcome.")
})

test('only calculators and exact-format prompts skip reasoning on the quick path', () => {
  assert.equal(isFastAnswerPrompt('What is 2+2? Reply with just the number.'), true)
  assert.equal(isFastAnswerPrompt('17 × 23'), true)
  assert.equal(isFastAnswerPrompt('Reply with exactly OK'), true)
  assert.equal(isFastAnswerPrompt('Which is larger: 9.11 or 9.9?'), false)
  assert.equal(isFastAnswerPrompt('A bat and a ball cost $1.10. The bat costs $1 more. How much is the ball?'), false)
  assert.equal(isFastAnswerPrompt('Explain 2+2'), false)
})

test('short chat questions use one lane instead of drafts and a merge', () => {
  assert.equal(depthFor('hello', 3), 'quick')
  assert.equal(depthFor('What is the capital of France?', 3), 'quick')
  assert.equal(depthFor('Why does my React effect run twice?', 3), 'quick')
  assert.equal(depthFor('Summarize Hamlet in two sentences.', 3), 'quick')
  assert.equal(depthFor('Compare tea and coffee.', 3), 'quick')
  // One available lane is always the quick path.
  assert.equal(depthFor('What is a monad?', 1), 'quick')
})

test('a short writing or planning request gets a structured pass', () => {
  assert.equal(depthFor('Draft a polite follow-up email about a late invoice.', 3), 'standard')
  assert.equal(depthFor('Create a workout plan for a small room with no equipment.', 3), 'standard')
  assert.equal(depthFor('Compare tea and coffee.', 3), 'quick')
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
