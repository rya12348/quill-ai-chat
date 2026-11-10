import assert from 'node:assert/strict'
import test from 'node:test'

import { installPokiGameBridge, isPokiGameWrapperUrl } from '../src/worker/poki-game'
import { assetProxyPath, findSiteTarget, googleSearchQuery, installFrameBridge, parseGoogleLuckyRedirect, renderProxyPage, renderSearchResults, resolveProxyTarget, rewriteAssetContent, searchQueryFor } from '../src/worker/site-proxy'

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

test('runtime same-site requests go through the network proxy', () => {
  const html = renderProxyPage(PAGE, 'https://freezenova.com/game', PROXY_URL)
  assert.match(html, /\/net\?url=/)
  assert.match(html, /XMLHttpRequest\.prototype\.open/)
  assert.match(html, /navigator\.sendBeacon/)
})

test('an isolated preview origin keeps native storage and cookies', () => {
  const html = renderProxyPage(PAGE, 'https://poki.com/', PROXY_URL, false, true)
  assert.doesNotMatch(html, /Object\.defineProperty\(window,'localStorage'/)
  assert.match(html, /history\.replaceState/)
})

test('the opaque sandbox keeps memory storage shims', () => {
  const html = renderProxyPage(PAGE, 'https://poki.com/', PROXY_URL)
  assert.match(html, /Object\.defineProperty\(window,'localStorage'/)
})

test('live proxy serves module scripts and styles through the asset proxy', () => {
  const html = renderProxyPage(
    '<script type="module" crossorigin src="/assets/index.js"></script><link rel="stylesheet" href="/assets/site.css"><a href="/game">Game</a>',
    'https://freezenova.com/',
    PROXY_URL,
  )
  assert.ok(html.includes(`${PROXY_URL}/p/https/freezenova.com/assets/index.js`))
  assert.ok(html.includes(`${PROXY_URL}/p/https/freezenova.com/assets/site.css`))
  assert.ok(html.includes('href="https://freezenova.com/game"'))
})

test('asset proxy paths preserve the source directory and query', () => {
  assert.equal(
    assetProxyPath(PROXY_URL, 'https://freezenova.com/assets/app.js?v=1'),
    `${PROXY_URL}/p/https/freezenova.com/assets/app.js?q=v%3D1`,
  )
})

test('asset content rewrites root CSS and Vite preload paths', () => {
  const css = new TextEncoder().encode('body{background:url(/imgs/emeralds.svg)}')
  const rewrittenCss = new TextDecoder().decode(
    rewriteAssetContent(css.buffer as ArrayBuffer, 'text/css', 'https://freezenova.com/assets/site.css', PROXY_URL),
  )
  assert.ok(rewrittenCss.includes(`${PROXY_URL}/p/https/freezenova.com/imgs/emeralds.svg`))

  const js = new TextEncoder().encode('const deps=["assets/page.js"];Vb=function(a){return"/"+a}')
  const rewrittenJs = new TextDecoder().decode(
    rewriteAssetContent(js.buffer as ArrayBuffer, 'text/javascript', 'https://freezenova.com/assets/index.js', PROXY_URL),
  )
  assert.ok(rewrittenJs.includes(`function(a){return"${PROXY_URL}/p/https/freezenova.com/" + a}`))
})

test('any public domain is detected as a live site, not just a fixed list', () => {
  assert.equal(findSiteTarget('open neal.fun'), 'https://neal.fun/')
  assert.equal(findSiteTarget('show example.games/play'), 'https://example.games/play')
})

test('Google searches stay inside the live preview', () => {
  const html = renderProxyPage(PAGE, 'https://www.google.com/', PROXY_URL)
  assert.doesNotMatch(html, /nativeOpen\(target\.href,'_blank','noopener,noreferrer'\)/)
  assert.doesNotMatch(html, /isGoogleSearch/)
  assert.doesNotMatch(html, /markGoogleSearchForms/)
  assert.doesNotMatch(html, /target="_blank"/)
  assert.match(html, /go\(proxy\+'\?url='\+encodeURIComponent\(target\.href\)\)/)
})

test('Google search and lucky-redirect detection stays specific', () => {
  assert.equal(googleSearchQuery('https://www.google.com/search?q=poki'), 'poki')
  assert.equal(googleSearchQuery('https://www.google.co.uk/search?q=quill'), 'quill')
  assert.equal(googleSearchQuery('https://www.bing.com/search?q=poki'), undefined)
  assert.equal(googleSearchQuery('https://www.google.com/'), undefined)
  assert.equal(
    parseGoogleLuckyRedirect('https://www.google.com/url?q=https%3A%2F%2Fpoki.com%2F'),
    'https://poki.com/',
  )
  assert.equal(parseGoogleLuckyRedirect('https://poki.com/'), 'https://poki.com/')
  assert.equal(parseGoogleLuckyRedirect('https://www.google.com/search?q=poki'), undefined)
  assert.equal(parseGoogleLuckyRedirect('http://127.0.0.1:5180/'), undefined)
  assert.equal(parseGoogleLuckyRedirect(null), undefined)
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
  assert.match(html, /<form action="https:\/\/www\.google\.com\/search"/)
  assert.doesNotMatch(html, /target="_blank"/)
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
  assert.match(html, /Google top result/)
  assert.match(html, /Poki &lt;b&gt;/)
  assert.match(html, /href="https:\/\/poki\.com\/"/)
  assert.match(html, /action="https:\/\/www\.google\.com\/search"/)
  assert.match(html, /name="q"/)
  assert.match(html, /full results page needs its own cookies/)
  assert.doesNotMatch(html, /data-quill-external/)
  assert.doesNotMatch(html, /target="_blank"/)
  assert.doesNotMatch(html, /<script>/i)
})

test('Poki wrapper URLs accept current and legacy shapes', () => {
  assert.equal(
    isPokiGameWrapperUrl('https://games.poki.com/5dd312fa-015f-11ea-ad56-9cb6d0d995f7?tag=x'),
    true,
  )
  assert.equal(isPokiGameWrapperUrl('https://games.poki.com/123/5dd312fa-015f-11ea-ad56-9cb6d0d995f7'), true)
  assert.equal(isPokiGameWrapperUrl('https://games.poki.com/458768/2048'), true)
  assert.equal(isPokiGameWrapperUrl('https://evil.example/5dd312fa-015f-11ea-ad56-9cb6d0d995f7'), false)
})

test('the frame bridge proxies ordinary iframes and reserves the game wrapper for game hosts', () => {
  const html = installFrameBridge(
    '<!doctype html><html><head></head><body><iframe src="https://example.com/embed"></iframe></body></html>',
    {
      proxyUrl: PROXY_URL,
      gameStartUrl: `${ORIGIN}/api/poki-game/start/${TOKEN}`,
      gameHosts: ['games.poki.com'],
    },
  )
  assert.match(html, /querySelectorAll\('iframe'\)/)
  assert.match(html, /indexOf\('\/api\/web-proxy\/'\)/)
  assert.match(html, /gameHosts/)
  assert.match(html, /poki-game\/start/)
  assert.match(html, /frame\.setAttribute\('src',target\)/)
  assert.doesNotMatch(html, /closest\('#game-player'\)/)
})

test('the frame bridge lets site frames use fullscreen and pointer lock', () => {
  const html = installFrameBridge('<iframe src="about:blank"></iframe>', { proxyUrl: PROXY_URL })
  assert.match(html, /frame\.setAttribute\('allowfullscreen',''\)/)
  assert.match(html, /fullscreen/)
  assert.match(html, /pointer-lock/)
  assert.match(html, /allowFrame\(frame\);\s*var raw=/)
  assert.match(html, /if\(frame\.getAttribute\('sandbox'\)!==nextSandbox\)frame\.setAttribute\('sandbox',nextSandbox\)/)
})

test('a proxied page has an in-preview fallback when fullscreen stalls', () => {
  const html = renderProxyPage(PAGE, 'https://poki.com/', PROXY_URL)
  assert.match(html, /__quillFullscreenFallback/)
  assert.match(html, /Exit fullscreen/)
  assert.match(html, /Element\.prototype\.requestFullscreen/)
})

test('the frame bridge delegates a game navigation to the parent in Codespaces', () => {
  const html = installFrameBridge(PAGE, { proxyUrl: PROXY_URL, parentNavigation: true })
  assert.match(html, /var parentNav=true;/)
  assert.match(html, /quill:preview-navigate/)
})

test('Poki game bridge hands off to the parent only in Codespaces', () => {
  const direct = installPokiGameBridge(PAGE, TOKEN, ORIGIN)
  assert.match(direct, /var parentNav=false;/)
  const delegated = installPokiGameBridge(PAGE, TOKEN, ORIGIN, true)
  assert.match(delegated, /var parentNav=true;/)
  assert.match(delegated, /quill:preview-navigate/)
})
