import assert from 'node:assert/strict'
import test from 'node:test'

import { renderProxyPage } from '../src/worker/site-proxy'

const PAGE = '<!doctype html><html><head><title>Poki</title></head><body><main>Games</main></body></html>'
const PROXY = 'https://quill.example/api/web-proxy/' + 'a'.repeat(48)

test('a live page carries a loading state from its first paint', () => {
  const html = renderProxyPage(PAGE, 'https://poki.com/', PROXY)
  assert.match(html, /id="quill-live-loading"/)
  assert.match(html, /Loading <strong>poki\.com<\/strong>/)
  assert.match(html, /role="status"/)
  // The placeholder must sit after the opening body tag so it shows while the
  // site's own scripts boot, and must never capture clicks.
  const body = html.indexOf('<body>')
  const overlay = html.indexOf('id="quill-live-loading"')
  assert.ok(body >= 0 && overlay > body)
  assert.match(html, /pointer-events:none/)
})

test('the loading state hides on load and is capped when a page never finishes', () => {
  const html = renderProxyPage(PAGE, 'https://www.poki.com/', PROXY)
  assert.match(html, /addEventListener\('load'/)
  assert.match(html, /setTimeout\(hide,12000\)/)
  assert.match(html, /quill-live-done/)
  // The www prefix is dropped from the visible label.
  assert.match(html, /Loading <strong>poki\.com<\/strong>/)
})

test('the loading state is added even without a body element', () => {
  const html = renderProxyPage('<main>bare</main>', 'https://example.com/', PROXY)
  assert.match(html, /^<style>#quill-live-loading/)
  assert.match(html, /setTimeout\(hide,12000\)/)
})
