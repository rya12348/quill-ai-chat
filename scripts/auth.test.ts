import assert from 'node:assert/strict'
import test from 'node:test'

import { isSameOriginRequest } from '@freebuff/auth'

import { appOrigin } from '../src/worker/auth'
import type { Env } from '../src/worker/env'

const development = {} as Env

const codespacesRequest = () =>
  new Request('http://127.0.0.1:5180/api/chat', {
    method: 'POST',
    headers: {
      origin: 'https://bright-otter-5180.app.github.dev',
      'x-forwarded-host': 'bright-otter-5180.app.github.dev',
      'x-forwarded-proto': 'https',
    },
  })

test('uses the Codespaces public origin for development requests', () => {
  const request = codespacesRequest()
  const origin = appOrigin(development, request)
  assert.equal(origin, 'https://bright-otter-5180.app.github.dev')
  assert.equal(isSameOriginRequest(request, origin), true)
})

test('keeps the loopback origin without a forwarded host', () => {
  const request = new Request('http://127.0.0.1:5180/api/chat')
  assert.equal(appOrigin(development, request), 'http://127.0.0.1:5180')
})

test('ignores a forwarded host that is not a Codespaces host', () => {
  const request = new Request('http://127.0.0.1:5180/api/chat', {
    method: 'POST',
    headers: {
      origin: 'https://evil.example',
      'x-forwarded-host': 'evil.example',
      'x-forwarded-proto': 'https',
    },
  })
  assert.equal(appOrigin(development, request), 'http://127.0.0.1:5180')
})

test('keeps a configured public APP_ORIGIN authoritative', () => {
  const request = new Request('http://127.0.0.1:5180/api/chat', {
    headers: {
      'x-forwarded-host': 'bright-otter-5180.app.github.dev',
      'x-forwarded-proto': 'https',
    },
  })
  assert.equal(appOrigin({ APP_ORIGIN: 'https://quill.example' } as Env, request), 'https://quill.example')
})

test('replaces a loopback APP_ORIGIN with the Codespaces origin', () => {
  const request = new Request('http://127.0.0.1:5180/api/chat', {
    headers: {
      'x-forwarded-host': 'bright-otter-5180.app.github.dev',
      'x-forwarded-proto': 'https',
    },
  })
  assert.equal(appOrigin({ APP_ORIGIN: 'http://127.0.0.1:5180' } as Env, request), 'https://bright-otter-5180.app.github.dev')
})

test('does not use forwarding when Sign in with Freebuff is configured', () => {
  const request = new Request('http://127.0.0.1:5180/api/chat', {
    headers: {
      'x-forwarded-host': 'bright-otter-5180.app.github.dev',
      'x-forwarded-proto': 'https',
    },
  })
  assert.equal(
    appOrigin({ FREEBUFF_CLIENT_ID: 'client-id', APP_ORIGIN: 'https://quill.example' } as Env, request),
    'https://quill.example',
  )
})
