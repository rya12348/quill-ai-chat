import assert from 'node:assert/strict'
import test from 'node:test'

import { ThinkingSplitter, splitThinking } from '../src/shared/thinking'

test('moves inline thinking blocks out of the visible answer', () => {
  assert.deepEqual(splitThinking('Before <thinking>private</thinking> after'), {
    text: 'Before  after',
    reasoning: 'private',
  })
  assert.deepEqual(splitThinking('<thought>plan</thought>Answer'), {
    text: 'Answer',
    reasoning: 'plan',
  })
})

test('holds a thinking tag that straddles stream chunks', () => {
  const splitter = new ThinkingSplitter()
  let text = ''
  let reasoning = ''
  for (const chunk of ['A <thi', 'nk>private</thi', 'nk> B']) {
    const part = splitter.push(chunk)
    text += part.text
    reasoning += part.reasoning
  }
  const tail = splitter.flush()
  text += tail.text
  reasoning += tail.reasoning

  assert.equal(text, 'A  B')
  assert.equal(reasoning, 'private')
})

test('keeps an unclosed thinking block as reasoning instead of losing it', () => {
  assert.deepEqual(splitThinking('Before <thinking>still going'), {
    text: 'Before ',
    reasoning: 'still going',
  })
})

test('plain angle brackets stay in the visible answer', () => {
  assert.deepEqual(splitThinking('Use <div> here'), {
    text: 'Use <div> here',
    reasoning: '',
  })
})
