import assert from 'node:assert/strict'
import test from 'node:test'

import { installPokiGameBridge } from '../src/worker/poki-game'
import { renderProxyPage } from '../src/worker/site-proxy'

const TOKEN = '0123456789abcdef0123456789abcdef0123456789abcdef'
const ORIGIN = 'https://quill-5180.app.github.dev'
const PROXY_URL = `${ORIGIN}/api/web-proxy/${TOKEN}`
const PAGE = '<!doctype html><html><head><title>Poki</title></head><body><a href="/game">Game</a></body></html>'

test('live proxy delegates navigation to the parent when Codespaces needs it', () => {
  const html = renderProxyPage(PAGE, 'https://poki.com/', PROXY_URL, true)
  assert.match(html, /window\.parent!==window/)
  assert.match(html, /quill:preview-navigate/)
  assert.match(html, /go\(proxy\+'\?url='\+encodeURIComponent\(url\.href\)\)/)
})

test('live proxy keeps direct navigation outside Codespaces', () => {
  const html = renderProxyPage(PAGE, 'https://poki.com/', PROXY_URL)
  assert.match(html, /function go\(url\)\{window\.location\.href=url\}/)
  assert.doesNotMatch(html, /quill:preview-navigate/)
})

test('Poki game bridge hands off to the parent only in Codespaces', () => {
  const direct = installPokiGameBridge(PAGE, TOKEN, ORIGIN)
  assert.match(direct, /var parentNav=false;/)
  const delegated = installPokiGameBridge(PAGE, TOKEN, ORIGIN, true)
  assert.match(delegated, /var parentNav=true;/)
  assert.match(delegated, /quill:preview-navigate/)
})
