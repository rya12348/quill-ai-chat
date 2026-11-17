import assert from 'node:assert/strict'
import test from 'node:test'

import { MAX_CONTEXT_MESSAGES } from '../src/shared/config'
import { hasConversationOverflow, shouldRefreshMemory, withPendingTurns } from '../src/worker/memory'

test('a chat just past the verbatim window keeps the dropped turn in the prompt', () => {
  const codeWord = 'TANGERINE'
  const history = Array.from({ length: MAX_CONTEXT_MESSAGES + 1 }, (_, index) => ({
    role: index % 2 === 0 ? 'user' : 'assistant',
    content: index === 0 ? `Remember the launch code: ${codeWord}.` : `turn ${index}`,
  }))
  const recent = history.slice(-MAX_CONTEXT_MESSAGES)
  const dropped = history.slice(0, history.length - MAX_CONTEXT_MESSAGES)

  // The first turn is outside the 24-message window, but one uncovered turn is
  // below the eight-message refresh batch. It must still reach the model.
  assert.equal(hasConversationOverflow(history.length), true)
  assert.equal(shouldRefreshMemory(dropped.length), false)
  assert.equal(recent.some((turn) => turn.content.includes(codeWord)), false)

  const prompt = withPendingTurns(dropped, recent)
  assert.equal(prompt.length, history.length)
  assert.equal(prompt[0]?.content, `Remember the launch code: ${codeWord}.`)
  assert.ok(prompt.some((turn) => turn.content.includes(codeWord)))
})
