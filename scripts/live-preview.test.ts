import assert from 'node:assert/strict'
import test from 'node:test'

import { installPokiGameBridge, isPokiGameWrapperUrl } from '../src/worker/poki-game'
import { findSiteTarget, renderProxyPage, renderSearchResults, resolveProxyTarget, searchQueryFor } from '../src/worker/site-proxy'

const TOKEN = '0123456789abcdef0123456789abcdef0123456789abcdef'
const ORIGIN = 'https://quill-5180.app.github.dev'
const PROXY_URL = `${ORIGIN}/api/web-proxy/${TOKEN}`
const PAGE = '<!doctype html><html><head><title>Poki</title></head><body><a href="/game">Game</a></body></html>'

test('live proxy delegates navigation to the parent when Codespaces needs it', () => {
  const html = renderProxyPage(PAGE, 'https://poki.com/', PROXY_URL, true)
  assert.match(html, /window\.parent!==window/)
  assert.match(html, /quill:preview-navigate/)
  assert.match(html, /go\(proxy\+'\?url='\+encodeURIComponent\(target\.href\)\)/)
})

test('live proxy keeps direct navigation outside Codespaces', () => {
  const html = renderProxyPage(PAGE, 'https://poki.com/', PROXY_URL)
  assert.match(html, /function go\(url\)\{window\.location\.href=url\}/)
  assert.doesNotMatch(html, /quill:preview-navigate/)
})

test('live proxy follows cross-origin links and scripted location changes', () => {
  const html = renderProxyPage(PAGE, 'https://poki.com/', PROXY_URL)
  assert.match(html, /protocol==='http:'/)
  assert.doesNotMatch(html, /url\.origin!==origin/)
  assert.match(html, /window\.navigation/)
  assert.match(html, /event\.destination\.sameDocument/)
})

test('live proxy turns GET forms into proxied navigation and leaves POST forms blocked', () => {
  const html = renderProxyPage('<form action="/search" method="get"><input name="q"></form>', 'https://www.google.com/', PROXY_URL)
  assert.match(html, /new FormData/)
  assert.match(html, /method!=='get'/)
  assert.match(html, /HTMLFormElement\.prototype\.submit/)
  assert.match(html, /searchParams\.append/)
  assert.match(html, /event\.key!=='Enter'/)
  assert.match(html, /node\.closest\('form'\)/)
  assert.match(html, /input\[type="submit"\]/)
  assert.match(html, /button\.value/)
  assert.match(html, /input\[name="q"\],textarea\[name="q"\]/)
})

test('a token can browse to another public site but never a private host', () => {
  assert.equal(
    resolveProxyTarget('https://www.google.com/', 'https://www.google.com/search?q=quill'),
    'https://www.google.com/search?q=quill',
  )
  assert.equal(resolveProxyTarget('https://www.google.com/', 'https://example.com/'), 'https://example.com/')
  assert.equal(resolveProxyTarget('https://www.google.com/', 'http://127.0.0.1:5180/'), undefined)
  assert.equal(resolveProxyTarget('https://www.google.com/', 'file:///etc/passwd'), undefined)
})

test('show google.com is detected as a live site', () => {
  assert.equal(findSiteTarget('show google.com'), 'https://google.com/')
})

test('Google searches open in a new tab instead of the proxy', () => {
  const html = renderProxyPage(PAGE, 'https://www.google.com/', PROXY_URL)
  assert.match(html, /nativeOpen\(target\.href,'_blank','noopener,noreferrer'\)/)
  assert.match(html, /pathname==='\/search'/)
})

test('scripted popups stay in the live proxy', () => {
  const html = renderProxyPage(PAGE, 'https://poki.com/', PROXY_URL)
  assert.match(html, /window\.open=function/)
  assert.match(html, /nativeOpen\.apply/)
})

test('Google pages keep the search form but drop Google scripts', () => {
  const html = renderProxyPage(
    '<html><head></head><body><form action="/search" method="get"><input name="q"></form><script>googleNoise()</script></body></html>',
    'https://www.google.com/',
    'http://localhost/api/web-proxy/token',
  )
  assert.match(html, /<form\b[^>]*\btarget="_blank"[^>]*>/)
  assert.doesNotMatch(html, /googleNoise/)
})

test('search query extraction recognises search engines only', () => {
  assert.equal(searchQueryFor('https://www.google.com/search?q=poki'), 'poki')
  assert.equal(searchQueryFor('https://www.google.co.uk/search?q=quill%20docs'), 'quill docs')
  assert.equal(searchQueryFor('https://www.bing.com/search?q=snake'), 'snake')
  assert.equal(searchQueryFor('https://html.duckduckgo.com/html/?q=games'), 'games')
  assert.equal(searchQueryFor('https://www.google.com/'), undefined)
  assert.equal(searchQueryFor('https://example.com/search?q=poki'), undefined)
})

test('search results escape markup and provide a search-again form', () => {
  const html = renderSearchResults('poki <script>', 'https://www.google.com/search?q=poki', [
    { title: 'Poki <b>', url: 'https://poki.com/', snippet: 'Free games & fun' },
  ])
  assert.match(html, /Search results/)
  assert.match(html, /Poki &lt;b&gt;/)
  assert.match(html, /href="https:\/\/poki\.com\/"/)
  assert.match(html, /action="https:\/\/www\.google\.com\/search"/)
  assert.match(html, /name="q"/)
  assert.match(html, /data-quill-external/)
  assert.doesNotMatch(html, /<script>/i)
})

test('Poki wrapper URLs accept current and legacy shapes', () => {
  assert.equal(
    isPokiGameWrapperUrl('https://games.poki.com/5dd312fa-015f-11ea-ad56-9cb6d0d995f7?tag=x'),
    true,
  )
  assert.equal(isPokiGameWrapperUrl('https://games.poki.com/123/5dd312fa-015f-11ea-ad56-9cb6d0d995f7'), true)
  assert.equal(isPokiGameWrapperUrl('https://evil.example/5dd312fa-015f-11ea-ad56-9cb6d0d995f7'), false)
})

test('Poki game bridge hands off to the parent only in Codespaces', () => {
  const direct = installPokiGameBridge(PAGE, TOKEN, ORIGIN)
  assert.match(direct, /var parentNav=false;/)
  const delegated = installPokiGameBridge(PAGE, TOKEN, ORIGIN, true)
  assert.match(delegated, /var parentNav=true;/)
  assert.match(delegated, /quill:preview-navigate/)
})
