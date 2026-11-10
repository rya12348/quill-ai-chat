import assert from 'node:assert/strict'
import test from 'node:test'

import { laneText, type PublicLane } from '../src/worker/public-ai'

const lane: PublicLane = {
  url: 'https://reasoning.example/v1/chat/completions',
  model: 'reasoner',
  label: 'Reasoner',
  description: 'test',
}

function sse(...deltas: string[]): Response {
  return new Response(deltas.map((delta) => `data: ${delta}\n\n`).join(''), {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  })
}

test('laneText streams real reasoning and returns the visible answer', async () => {
  const originalFetch = globalThis.fetch
  const seen: string[] = []
  globalThis.fetch = (async () =>
    sse(
      JSON.stringify({ choices: [{ delta: { reasoning: 'Check the constraints. ' } }] }),
      JSON.stringify({ choices: [{ delta: { reasoning: 'Then answer.' } }] }),
      JSON.stringify({ choices: [{ delta: { content: 'Answer.' } }] }),
      '[DONE]',
    )) as typeof fetch
  try {
    const text = await laneText(lane, {
      messages: [{ role: 'user', content: 'test' }],
      onReasoning: (piece) => {
        seen.push(piece)
      },
    })
    assert.equal(text, 'Answer.')
    assert.deepEqual(seen, ['Check the constraints. ', 'Then answer.'])
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('laneText keeps a reasoning-only reply instead of failing', async () => {
  const originalFetch = globalThis.fetch
  const seen: string[] = []
  globalThis.fetch = (async () =>
    sse(
      JSON.stringify({ choices: [{ delta: { reasoning: 'Only reasoning.' } }] }),
      '[DONE]',
    )) as typeof fetch
  try {
    const text = await laneText(lane, {
      messages: [{ role: 'user', content: 'test' }],
      onReasoning: (piece) => {
        seen.push(piece)
      },
    })
    assert.equal(text, 'Only reasoning.')
    assert.deepEqual(seen, ['Only reasoning.'])
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('laneText separates an inline think block from the answer', async () => {
  const originalFetch = globalThis.fetch
  const seen: string[] = []
  globalThis.fetch = (async () =>
    sse(
      JSON.stringify({ choices: [{ delta: { content: '<thi' } }] }),
      JSON.stringify({ choices: [{ delta: { content: 'nk>real ' } }] }),
      JSON.stringify({ choices: [{ delta: { content: 'thought</thi' } }] }),
      JSON.stringify({ choices: [{ delta: { content: 'nk>Answer' } }] }),
      '[DONE]',
    )) as typeof fetch
  try {
    const text = await laneText(lane, {
      messages: [{ role: 'user', content: 'test' }],
      onReasoning: (piece) => {
        seen.push(piece)
      },
    })
    assert.equal(text, 'Answer')
    assert.deepEqual(seen, ['real ', 'thought'])
  } finally {
    globalThis.fetch = originalFetch
  }
})
