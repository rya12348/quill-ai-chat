import assert from 'node:assert/strict'
import test from 'node:test'

import { cleanGeneratedTitle } from '../src/shared/titles'
import { generateConversationTitle } from '../src/worker/title'
import type { Env } from '../src/worker/env'

test('cleans wrappers and punctuation from a generated title', () => {
  assert.equal(cleanGeneratedTitle('**Title:** "Cold brew at home."\nIgnored line'), 'Cold brew at home')
  assert.equal(cleanGeneratedTitle('  Planning a cat adoption  '), 'Planning a cat adoption')
  assert.equal(cleanGeneratedTitle('New chat'), undefined)
  assert.equal(cleanGeneratedTitle('   '), undefined)
})

test('rejects rate-limit text instead of using it as a title', () => {
  assert.equal(cleanGeneratedTitle('Sorry, to prevent abuse of free resources, accounts that have'), undefined)
  assert.equal(cleanGeneratedTitle('Rate limit reached. Try again later.'), undefined)
  assert.equal(cleanGeneratedTitle('Unable to generate a title'), undefined)
})

test('asks the configured model for a title and keeps it short', async () => {
  const originalFetch = globalThis.fetch
  let request: { messages?: { role: string; content: string }[]; max_tokens?: number } | undefined
  globalThis.fetch = (async (_input, init) => {
    request = JSON.parse(String(init?.body)) as typeof request
    return new Response(JSON.stringify({ choices: [{ message: { content: '"Cold brew basics."' } }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }) as typeof fetch
  try {
    const title = await generateConversationTitle({
      env: { OPENAI_API_KEY: 'test' } as Env,
      model: 'deepseek-v4.1-flash',
      user: 'How do I make cold brew?',
      assistant: 'Use coarse grounds and steep for 12 hours.',
    })
    assert.equal(title, 'Cold brew basics')
    assert.equal(request?.messages?.[0]?.role, 'system')
    assert.match(request?.messages?.[1]?.content ?? '', /12 hours/)
    assert.equal(request?.max_tokens, 40)
  } finally {
    globalThis.fetch = originalFetch
  }
})
