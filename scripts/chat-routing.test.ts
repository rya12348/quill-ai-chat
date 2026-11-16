import assert from 'node:assert/strict'
import test from 'node:test'

import { MAX_CONTEXT_MESSAGES } from '../src/shared/config'
import { routeBuffyChat } from '../src/worker/buffy-routing'
import { hasConversationOverflow, shouldRefreshMemory } from '../src/worker/memory'

test('greetings on Buffy, Buffy Free and Agent stay local', () => {
  const buffy = routeBuffyChat({ usingApi: false, requestedModel: 'buffy', content: 'hi' })
  assert.equal(buffy.local, true)
  assert.equal(buffy.fast, false)
  assert.equal(buffy.fullAgent, false)
  assert.equal(buffy.model, 'buffy')

  const free = routeBuffyChat({ usingApi: false, requestedModel: 'buffy-lite', content: 'hello' })
  assert.equal(free.local, true)
  assert.equal(free.fast, false)
  assert.equal(free.fullAgent, false)
  assert.equal(free.model, 'buffy-lite')

  const agentGreeting = routeBuffyChat({
    usingApi: false,
    requestedModel: 'buffy',
    content: 'hey',
    strategy: 'agent',
  })
  assert.equal(agentGreeting.local, true)
  assert.equal(agentGreeting.fast, false)
  assert.equal(agentGreeting.fullAgent, false)
  assert.equal(agentGreeting.model, 'buffy')
})

test('ordinary Buffy questions use the fast lane and keep the Buffy label', () => {
  const route = routeBuffyChat({
    usingApi: false,
    requestedModel: 'buffy',
    content: 'What is the capital of France?',
  })
  assert.equal(route.local, false)
  assert.equal(route.fast, true)
  assert.equal(route.fullAgent, false)
  assert.equal(route.model, 'buffy')
})

test('explicit tool requests still use the full Buffy agent', () => {
  const route = routeBuffyChat({
    usingApi: false,
    requestedModel: 'buffy',
    content: 'read the file src/app.ts and fix the failing test',
  })
  assert.equal(route.local, false)
  assert.equal(route.fast, false)
  assert.equal(route.fullAgent, true)
  assert.equal(route.model, 'buffy')
})

test('Agent mode uses the agent path for real work but stays Buffy', () => {
  const route = routeBuffyChat({
    usingApi: false,
    requestedModel: 'buffy',
    content: 'Compare the options and give me a recommendation.',
    strategy: 'agent',
  })
  assert.equal(route.local, false)
  assert.equal(route.fast, false)
  assert.equal(route.fullAgent, true)
  assert.equal(route.model, 'buffy')
})

test('the host API path does not claim a Buffy route', () => {
  const route = routeBuffyChat({
    usingApi: true,
    requestedModel: 'buffy',
    content: 'What is the capital of France?',
  })
  assert.deepEqual(route, { local: false, fast: false, fullAgent: false, model: null })
})

test('short chats never trigger rolling memory', () => {
  assert.equal(hasConversationOverflow(3), false)
  assert.equal(shouldRefreshMemory(7), false)
})

test('rolling memory waits for a real batch of old turns', () => {
  assert.equal(shouldRefreshMemory(8), true)
  assert.equal(shouldRefreshMemory(40), true)
})

test('rolling memory only starts after the verbatim window overflows', () => {
  assert.equal(hasConversationOverflow(MAX_CONTEXT_MESSAGES - 1), false)
  assert.equal(hasConversationOverflow(MAX_CONTEXT_MESSAGES), false)
  assert.equal(hasConversationOverflow(MAX_CONTEXT_MESSAGES + 1), true)
})
