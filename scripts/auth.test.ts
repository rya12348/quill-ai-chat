import assert from 'node:assert/strict'
import test from 'node:test'

import { isSameOriginRequest } from '@freebuff/auth'

import { allowsMutation, analyzeEnabledFor, appOrigin, authMode, buildEnabledFor, currentUser, isCodespacesRequest, researchEnabledFor } from '../src/worker/auth'
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

test('auth mode accepts a Codespaces public host', () => {
  const request = new Request('https://bright-otter-5180.app.github.dev/api/me')
  assert.equal(authMode(development, request), 'development')
})

test('auth mode accepts a forwarded Codespaces host', () => {
  const request = new Request('http://quill.internal:5180/api/me', {
    headers: {
      'x-forwarded-host': 'bright-otter-5180.app.github.dev',
      'x-forwarded-proto': 'https',
    },
  })
  assert.equal(authMode(development, request), 'development')
})

test('auth mode stays off on an ordinary public host', () => {
  assert.equal(authMode(development, new Request('https://quill.example/api/me')), 'off')
})

test('auth mode still requires sign in when Freebuff auth is configured', () => {
  const request = new Request('https://bright-otter-5180.app.github.dev/api/me')
  assert.equal(
    authMode({ FREEBUFF_CLIENT_ID: 'client-id', APP_ORIGIN: 'https://quill.example' } as Env, request),
    'freebuff',
  )
})

test('a Codespace with the loopback auth example uses the development identity', async () => {
  const request = codespacesRequest()
  const env = { FREEBUFF_CLIENT_ID: 'client-id', APP_ORIGIN: 'http://127.0.0.1:5180' } as Env
  assert.equal(authMode(env, request), 'development')
  assert.equal(appOrigin(env, request), 'https://bright-otter-5180.app.github.dev')
  assert.equal(isCodespacesRequest(env, request), true)
  assert.equal((await currentUser(env, request))?.sub, 'dev-user')
})

test('all free-only modes default on for a Codespaces development origin', () => {
  const codespaces = new Request('https://bright-otter-5180.app.github.dev/api/me')
  assert.equal(researchEnabledFor(development, codespaces), true)
  assert.equal(analyzeEnabledFor(development, codespaces), true)
  assert.equal(buildEnabledFor(development, codespaces), true)

  const ordinary = new Request('https://quill.example/api/me')
  assert.equal(researchEnabledFor(development, ordinary), false)
  assert.equal(analyzeEnabledFor(development, ordinary), false)
  assert.equal(buildEnabledFor(development, ordinary), false)

  assert.equal(researchEnabledFor({ RESEARCH_ENABLED: '0' } as Env, codespaces), false)
  assert.equal(analyzeEnabledFor({ ANALYZE_ENABLED: '0' } as Env, codespaces), false)
  assert.equal(buildEnabledFor({ BUILD_ENABLED: '0' } as Env, codespaces), false)
  assert.equal(researchEnabledFor({ RESEARCH_ENABLED: '1' } as Env, ordinary), true)
  assert.equal(analyzeEnabledFor({ ANALYZE_ENABLED: '1' } as Env, ordinary), true)
  assert.equal(buildEnabledFor({ BUILD_ENABLED: '1' } as Env, ordinary), true)
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

test('enables Build automatically on a Codespaces development origin', () => {
  const request = new Request('https://bright-otter-5180.app.github.dev/api/me')
  assert.equal(isCodespacesRequest(development, request), true)
  assert.equal(buildEnabledFor(development, request), true)
  assert.equal(buildEnabledFor({ BUILD_ENABLED: '1' } as Env, new Request('https://quill.example/api/me')), true)
  assert.equal(buildEnabledFor({ BUILD_ENABLED: '0' } as Env, request), false)
})

test('does not enable Build automatically on an ordinary origin', () => {
  assert.equal(buildEnabledFor(development, new Request('https://quill.example/api/me')), false)
})

test('accepts a proxied development mutation marked same-origin by the browser', () => {
  const request = new Request('http://127.0.0.1:5180/api/chat', {
    method: 'POST',
    headers: {
      origin: 'https://bright-otter-5180.app.github.dev',
      'sec-fetch-site': 'same-origin',
    },
  })
  assert.equal(allowsMutation(development, request), true)
})

test('still rejects a foreign development mutation', () => {
  const request = new Request('http://127.0.0.1:5180/api/chat', {
    method: 'POST',
    headers: {
      origin: 'https://evil.example',
      'sec-fetch-site': 'cross-site',
    },
  })
  assert.equal(allowsMutation(development, request), false)
})
