import assert from 'node:assert/strict'
import test from 'node:test'

import { probeHealth } from '../src/app/lib/offline'

const liveResponse = (status = 200) =>
  new Response('{}', {
    status,
    headers: { 'content-type': 'application/json' },
  })

const cachedOfflineResponse = () =>
  new Response('{}', {
    status: 200,
    headers: { 'content-type': 'application/json', 'x-stet-offline': '1' },
  })

test('a live server error still means the network is reachable', async () => {
  const reachable = await probeHealth(async () => liveResponse(503), 0)
  assert.equal(reachable, true)
})

test('one transient health failure does not mark the app offline', async () => {
  let calls = 0
  const reachable = await probeHealth(async () => {
    calls += 1
    if (calls === 1) throw new TypeError('Failed to fetch')
    return liveResponse()
  }, 0)
  assert.equal(reachable, true)
  assert.equal(calls, 2)
})

test('a cached offline health response needs repeated failures before it counts', async () => {
  let calls = 0
  const reachable = await probeHealth(async () => {
    calls += 1
    return cachedOfflineResponse()
  }, 0)
  assert.equal(reachable, false)
  assert.equal(calls, 3)
})
