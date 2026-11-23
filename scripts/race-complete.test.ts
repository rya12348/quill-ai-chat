import assert from 'node:assert/strict'
import test from 'node:test'

import { raceComplete, raceCompleteLadder, spreadLanesByHost, type PublicLane } from '../src/worker/public-ai'

const lane = (model: string, url: string): PublicLane => ({
  model,
  url,
  label: model,
  description: '',
})

function sseResponse(text: string, delayMs: number, close = true): Response {
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      setTimeout(() => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`))
        if (close) {
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        }
      }, delayMs)
    },
  })
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } })
}

test('a slow selected lane cannot hold the reply behind a fast backup', async () => {
  const originalFetch = globalThis.fetch
  const requested: string[] = []
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input)
    requested.push(url)
    return url.includes('slow.example')
      ? sseResponse('SLOW_LANE_ANSWER '.repeat(8), 1_800)
      : sseResponse('FAST_LANE_ANSWER '.repeat(8), 60)
  }) as typeof fetch

  try {
    const startedAt = Date.now()
    let text = ''
    for await (const piece of raceComplete(
      [
        lane('selected-slow', 'https://slow.example/chat/completions'),
        lane('measured-fast', 'https://fast.example/chat/completions'),
      ],
      { messages: [{ role: 'user', content: 'Answer anything.' }], idleMs: 5_000, timeoutMs: 10_000 },
    )) {
      if (piece.type === 'text') text += piece.text
    }
    const elapsed = Date.now() - startedAt

    assert.match(text, /FAST_LANE_ANSWER/)
    assert.doesNotMatch(text, /SLOW_LANE_ANSWER/)
    assert.ok(elapsed < 1_500, `backup should answer quickly, took ${elapsed}ms`)
    assert.equal(requested.length, 2)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('visible text is released before the model finishes the answer', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () => sseResponse('A complete opening answer that is long enough to stream.'.repeat(2), 30, false)) as typeof fetch

  try {
    const iterator = raceComplete(
      [lane('streaming', 'https://stream.example/chat/completions')],
      { messages: [{ role: 'user', content: 'Answer anything.' }], idleMs: 5_000, timeoutMs: 10_000 },
    )[Symbol.asyncIterator]()

    const first = await iterator.next()
    assert.equal(first.done, false)
    assert.equal(first.value?.type, 'text')
    assert.ok((first.value?.type === 'text' ? first.value.text.length : 0) >= 40)
    await iterator.return?.()
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('the winning lane keeps streaming after it wins', async () => {
  const originalFetch = globalThis.fetch
  const encode = (text: string) => `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('slow.example')) return sseResponse('SLOW_LANE_ANSWER '.repeat(20), 5_000)
    // Three pieces: the race is decided on the first, but the reply is all three.
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        setTimeout(() => {
          controller.enqueue(new TextEncoder().encode(encode('A'.repeat(40))))
          controller.enqueue(new TextEncoder().encode(encode('B'.repeat(40))))
          controller.enqueue(new TextEncoder().encode(encode('C'.repeat(40))))
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
          controller.close()
        }, 30)
      },
    })
    return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } })
  }) as typeof fetch

  try {
    let text = ''
    for await (const piece of raceComplete(
      [
        lane('fast-winner', 'https://fast.example/chat/completions'),
        lane('slow-backup', 'https://slow.example/chat/completions'),
      ],
      { messages: [{ role: 'user', content: 'Answer anything.' }], idleMs: 5_000, timeoutMs: 10_000 },
    )) {
      if (piece.type === 'text') text += piece.text
    }

    assert.equal(text.length, 120, `winner must not be aborted after winning, got ${text.length} chars`)
    assert.match(text, /^A{40}B{40}C{40}$/)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('lanes are spread across providers before repeating a host', () => {
  const lanes = [
    lane('a1', 'https://a.example/chat/completions'),
    lane('a2', 'https://a.example/chat/completions'),
    lane('a3', 'https://a.example/chat/completions'),
    lane('b1', 'https://b.example/chat/completions'),
  ]
  assert.deepEqual(
    spreadLanesByHost(lanes).map((item) => item.model),
    ['a1', 'b1', 'a2', 'a3'],
  )
})

test('the ladder tries the next group when a whole gateway refuses', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('busy.example')) return new Response('rate limited', { status: 429 })
    return sseResponse('LATER_GROUP_ANSWER '.repeat(6), 20)
  }) as typeof fetch

  try {
    let text = ''
    for await (const piece of raceCompleteLadder(
      [
        lane('busy-one', 'https://busy.example/chat/completions'),
        lane('busy-two', 'https://other.example/chat/completions'),
        lane('working', 'https://working.example/chat/completions'),
      ],
      { messages: [{ role: 'user', content: 'Answer anything.' }], idleMs: 2_000, timeoutMs: 5_000 },
      { batchSize: 1, maxBatches: 3 },
    )) {
      if (piece.type === 'text') text += piece.text
    }
    assert.match(text, /LATER_GROUP_ANSWER/)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('the ladder reports every model busy only after every group failed', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () => new Response('rate limited', { status: 429 })) as typeof fetch

  try {
    await assert.rejects(
      async () => {
        for await (const _ of raceCompleteLadder(
          [
            lane('busy-one', 'https://one.example/chat/completions'),
            lane('busy-two', 'https://two.example/chat/completions'),
          ],
          { messages: [{ role: 'user', content: 'Answer anything.' }], idleMs: 2_000, timeoutMs: 5_000 },
          { batchSize: 1, maxBatches: 2 },
        )) {
          // No text should be produced.
        }
      },
      (error: unknown) => error instanceof Error && /busy/i.test(error.message),
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('a browser-solved fast alternate can win after the head start', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () => sseResponse('SLOW_LANE_ANSWER '.repeat(30), 6_000)) as typeof fetch

  async function* fastAlternate() {
    await new Promise((resolve) => setTimeout(resolve, 40))
    yield { type: 'text' as const, text: 'FAST_ALTERNATE_ANSWER '.repeat(4) }
  }

  try {
    const startedAt = Date.now()
    let text = ''
    for await (const piece of raceComplete(
      [lane('selected-slow', 'https://slow.example/chat/completions')],
      { messages: [{ role: 'user', content: 'Answer anything.' }], idleMs: 10_000, timeoutMs: 20_000 },
      [fastAlternate()],
    )) {
      if (piece.type === 'text') text += piece.text
    }
    const elapsed = Date.now() - startedAt

    assert.match(text, /FAST_ALTERNATE_ANSWER/)
    assert.doesNotMatch(text, /SLOW_LANE_ANSWER/)
    assert.ok(elapsed < 1_500, `alternate should win after the head start, took ${elapsed}ms`)
  } finally {
    globalThis.fetch = originalFetch
  }
})
