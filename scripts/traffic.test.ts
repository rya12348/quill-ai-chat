import assert from 'node:assert/strict'
import { test } from 'node:test'

import { isLocalTunnelHost, isVisitorId, trafficPath } from '../src/shared/traffic'

test('keeps ordinary page paths and strips query strings', () => {
  assert.equal(trafficPath('/'), '/')
  assert.equal(trafficPath('/library?tab=all'), '/library')
  assert.equal(trafficPath('/library/'), '/library')
})

test('groups chat and share ids instead of storing them', () => {
  assert.equal(trafficPath('/c/123e4567-e89b-12d3-a456-426614174000'), '/chat')
  assert.equal(trafficPath('/s/secret-token'), '/shared')
  assert.equal(trafficPath('/c/123?project=secret'), '/chat')
})

test('ignores assets, API calls and the traffic dashboard itself', () => {
  assert.equal(trafficPath('/assets/index.js'), null)
  assert.equal(trafficPath('/api/conversations'), null)
  assert.equal(trafficPath('/analytics'), null)
  assert.equal(trafficPath('/analytics/'), null)
  assert.equal(trafficPath('//evil.example/path'), null)
})

test('accepts only stable random visitor ids', () => {
  assert.equal(isVisitorId('7d3f7a3e-4c6e-4a3d-9f42-4f9d7f2a1b6c'), true)
  assert.equal(isVisitorId('not-a-visitor'), false)
  assert.equal(isVisitorId(undefined), false)
})

test('recognizes local tunnel hosts without matching lookalikes', () => {
  assert.equal(isLocalTunnelHost('usual-endorse-engaged.ngrok-free.dev'), true)
  assert.equal(isLocalTunnelHost('demo.trycloudflare.com'), true)
  assert.equal(isLocalTunnelHost('ngrok-free.dev.evil.example'), false)
  assert.equal(isLocalTunnelHost('freebuff.page'), false)
})
