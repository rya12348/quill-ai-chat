const HTML_TYPE = /text\/html|application\/xhtml\+xml/i
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
const POKI_REFERER = 'https://poki.com/'
const MAX_WRAPPER_CHARS = 400_000
// Modern engine bundles (Unity, Godot, Defold) routinely pass 10 MB, and Poki
// serves them as one file; its largest game document is about 17 MB. A cap
// below that turned working games into 413s, so the limit sits where a Worker
// can still hold the text and its rewritten copy.
const MAX_GAME_HTML_CHARS = 24_000_000
// Every host a Poki game pulls from: the page shell, the game CDN, the SDK,
// the ad-free fonts and the telemetry endpoint. A network filter blocks these
// by name, so each one is served from this origin instead.
const POKI_HOST = /^(?:[a-z0-9-]+\.)*(?:poki\.(?:com|io)|poki-cdn\.com)$/i
const TEXTUAL_TYPE = /^(?:text\/|application\/(?:javascript|ecmascript|x-javascript|json|xml|xhtml\+xml)|image\/svg\+xml)/i
const TEXTUAL_PATH = /\.(?:html?|js|mjs|css|json|map|svg|xml|txt|webmanifest)$/i

type GameTarget = {
  gameId: string
  version: string
  path: string
  search: string
}

export function isPokiGameId(value: string): boolean {
  return UUID.test(value)
}

/**
 * A path segment inside a game wrapper or its asset host.
 *
 * Poki's image CDN encodes its options in the path
 * (`cdn-cgi/image/q=78,width=94,fit=cover/…`), so commas, equals signs and
 * colons are ordinary here. A segment only has to be free of control
 * characters, whitespace, backslashes and dot-dot traversal.
 */
export function isSafeGameSegment(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= 200 &&
    value !== '.' &&
    value !== '..' &&
    !/[\\\s?#\x00-\x1f\x7f]/.test(value)
  )
}

/** A Poki-controlled host whose content a game may need. */
export function isPokiAssetHost(host: string): boolean {
  return POKI_HOST.test(host)
}

/**
 * Point every absolute Poki URL inside a game file at this origin. Games fetch
 * their bundles, fonts, SDK and telemetry by absolute hostname, so rewriting
 * the files as they are served is what keeps a filtered network from seeing
 * Poki at all. Only the host is replaced; the path stays exactly as written.
 */
export function rewritePokiUrls(text: string, base = ''): string {
  if (!/poki\.(?:com|io)|poki-cdn\.com/i.test(text)) return text
  return text.replace(
    /(?:https?:)?\/\/((?:[a-z0-9-]+\.)*(?:poki\.(?:com|io)|poki-cdn\.com))(?![-\w.])/gi,
    // A proxied page carries its own <base>, so a root-relative path would
    // resolve back onto the site's origin. Pass the app origin where one is
    // needed and leave game assets root-relative.
    (_match, host: string) => `${base}/api/poki-cdn/${host.toLowerCase()}`,
  )
}

function isTextualAsset(type: string, path: string): boolean {
  if (TEXTUAL_TYPE.test(type)) return true
  return type === 'application/octet-stream' && TEXTUAL_PATH.test(path)
}

export function isPokiPage(finalUrl: string): boolean {
  try {
    const url = new URL(finalUrl)
    return url.protocol === 'https:' && (url.hostname === 'poki.com' || url.hostname.endsWith('.poki.com'))
  } catch {
    return false
  }
}

export function isPokiGameWrapperUrl(value: string): boolean {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.hostname !== 'games.poki.com') return false
    const path = url.pathname.replace(/^\/+|\/+$/g, '')
    if (!path || path.length > 300) return false
    const parts = path.split('/')
    // Poki has used both /<uuid> and /<content-id>/<game-slug> wrappers.
    // Keep the shape exact and reject traversal or encoded separators.
    return parts.length > 0 && parts.length <= 3 && parts.every(isSafeGameSegment)
  } catch {
    return false
  }
}

function isSafeGamePath(path: string): boolean {
  if (!path || path.length > 2_000) return false
  const parts = path.split('/')
  // Engine loaders ask for directory-style URLs (`lang/`, `assets/`) whose last
  // segment is empty; only interior emptiness is traversal.
  if (parts.length > 1 && parts[parts.length - 1] === '') parts.pop()
  return (
    parts.length > 0 &&
    parts.every((part) => part.length > 0 && part !== '.' && part !== '..' && !/[\\?#]/.test(part))
  )
}

function gameTarget(value: string): GameTarget | undefined {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return undefined
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return undefined
  const host = /^([0-9a-f-]{36})\.gdn\.poki\.com$/i.exec(url.hostname)
  if (!host || !isPokiGameId(host[1])) return undefined
  const parts = url.pathname.split('/').filter(Boolean)
  if (parts.length < 2 || !isSafeGameSegment(parts[0])) return undefined
  const path = parts.slice(1).join('/')
  if (!isSafeGamePath(path)) return undefined
  return { gameId: host[1], version: parts[0], path, search: url.search }
}

export function pokiGameProxyPath(token: string, gameUrl: string): string | undefined {
  const target = gameTarget(gameUrl)
  if (!target) return undefined
  return `/api/poki-game/${token}/${target.gameId}/${target.version}/${target.path}${target.search}`
}

/** The public, capability-free path used by the Apps browser. */
export function pokiGamePublicPath(gameUrl: string): string | undefined {
  const target = gameTarget(gameUrl)
  if (!target) return undefined
  return `/api/poki-play/${target.gameId}/${target.version}/${target.path}${target.search}`
}

function signalWithTimeout(signal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs)
  return signal ? AbortSignal.any([signal, timeout]) : timeout
}

async function fetchPokiPage(pageUrl: string, signal?: AbortSignal): Promise<string | undefined> {
  try {
    const response = await fetch(pageUrl, {
      redirect: 'follow',
      signal: signalWithTimeout(signal, 10_000),
      headers: {
        accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1',
        'accept-language': 'en-US,en;q=0.9',
        referer: POKI_REFERER,
        'user-agent': USER_AGENT,
      },
    })
    if (!response.ok) {
      await response.body?.cancel()
      return undefined
    }
    const type = response.headers.get('content-type') ?? ''
    if (type && !HTML_TYPE.test(type)) {
      await response.body?.cancel()
      return undefined
    }
    const html = await response.text()
    return html.length > MAX_GAME_HTML_CHARS ? undefined : html
  } catch {
    return undefined
  }
}

async function fetchPokiWrapper(wrapperUrl: string, signal?: AbortSignal): Promise<string | undefined> {
  try {
    const response = await fetch(wrapperUrl, {
      redirect: 'manual',
      signal: signalWithTimeout(signal, 8_000),
      headers: {
        accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1',
        'accept-language': 'en-US,en;q=0.9',
        referer: POKI_REFERER,
        'user-agent': USER_AGENT,
      },
    })
    if (!response.ok) {
      await response.body?.cancel()
      return undefined
    }
    const type = response.headers.get('content-type') ?? ''
    if (type && !HTML_TYPE.test(type)) {
      await response.body?.cancel()
      return undefined
    }
    const html = await response.text()
    return html.length > MAX_WRAPPER_CHARS ? undefined : html
  } catch {
    return undefined
  }
}

function extractPokiParams(html: string): Record<string, unknown> | undefined {
  const marker = html.indexOf('window.PARAMS')
  if (marker < 0) return undefined
  const start = html.indexOf('{', marker)
  if (start < 0) return undefined
  let depth = 0
  let inString = false
  let escaped = false
  let quote = ''
  for (let index = start; index < html.length; index++) {
    const character = html[index]
    if (inString) {
      if (escaped) escaped = false
      else if (character === '\\') escaped = true
      else if (character === quote) inString = false
      continue
    }
    if (character === '"' || character === "'") {
      inString = true
      quote = character
      continue
    }
    if (character === '{') depth++
    else if (character === '}') {
      depth--
      if (depth === 0) {
        try {
          const parsed: unknown = JSON.parse(html.slice(start, index + 1))
          return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : undefined
        } catch {
          return undefined
        }
      }
    }
  }
  return undefined
}

function addGameShims(html: string): string {
  const cleaned = html
    .replace(/<meta\b[^>]*http-equiv\s*=\s*["']?\s*(?:content-security-policy|refresh)\s*["']?[^>]*>/gi, '')
    .replace(/<base\b[^>]*>/gi, '')
    .replace(
      /<script\b[^>]*\bsrc\s*=\s*(["'])(?:https?:)?\/\/game-cdn\.poki\.com\/scripts\/[^"']*poki-sdk[^"']*\1[^>]*>\s*<\/script>/gi,
      '',
    )
  const shim = `<script>(function(){
var cookies=new Map();
function readCookies(){var out=[];cookies.forEach(function(value,name){out.push(name+'='+value)});return out.join('; ')}
function writeCookie(value){var text=String(value);var pair=text.split(';')[0];var at=pair.indexOf('=');if(at<1)return;var name=pair.slice(0,at).trim();if(!name)return;if(/max-age=0|expires=thu, 01 jan 1970/i.test(text))cookies.delete(name);else cookies.set(name,pair.slice(at+1))}
try{Object.defineProperty(Document.prototype,'cookie',{configurable:true,enumerable:true,get:readCookies,set:writeCookie})}catch(error){}
function memoryStorage(){var values=new Map();return{getItem:function(key){key=String(key);return values.has(key)?values.get(key):null},setItem:function(key,value){values.set(String(key),String(value))},removeItem:function(key){values.delete(String(key))},clear:function(){values.clear()},key:function(index){var keys=Array.from(values.keys());return index>=0&&index<keys.length?keys[index]:null},get length(){return values.size}}}
try{Object.defineProperty(window,'localStorage',{configurable:true,value:memoryStorage()});Object.defineProperty(window,'sessionStorage',{configurable:true,value:memoryStorage()})}catch(error){}
try{Object.defineProperty(window,'pokiDebug',{configurable:true,get:function(){return true},set:function(){}})}catch(error){window.pokiDebug=true}
// A sandboxed iframe (no allow-same-origin) makes reading navigator.serviceWorker
// throw a SecurityError, and Poki's loader calls it while booting: the throw
// aborted the loader and left games sitting at part-loaded. Report no worker
// instead, which is what a browser without one does.
try{Object.defineProperty(Navigator.prototype,'serviceWorker',{configurable:true,get:function(){return undefined}})}catch(error){try{Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:undefined})}catch(inner){}}
try{
// Games call SDK methods the stub does not list (movePill, gameLoadingProgress
// and others, added by Poki over time). A missing method threw inside the
// game's boot sequence and left it on a black screen, so anything unknown
// resolves like an unanswered SDK call instead of raising.
var sdk={init:function(){return Promise.resolve()},getURLParam:function(name){try{var value=new URLSearchParams(window.location.search).get(String(name));return value===null?undefined:value}catch(error){return undefined}},gameLoadingStart:function(){},gameLoadingFinished:function(){},gameLoadingProgress:function(){},gameplayStart:function(){},gameplayStop:function(){},commercialBreak:function(){return Promise.resolve()},rewardedBreak:function(){return Promise.resolve(true)},showLeaderboard:function(){return Promise.resolve()},measure:function(){},setDebug:function(){},movePill:function(){},shareableURL:function(){try{return location.href}catch(error){return ''}},isAdBlocked:function(){return false}};
var quiet=function(){return Promise.resolve()};
window.PokiSDK=typeof Proxy==='function'?new Proxy(sdk,{get:function(target,key){if(key in target)return target[key];if(typeof key==='symbol')return undefined;return quiet}}):sdk;
}catch(error){}
})()</script>`
  const late = `<script>try{pokiDebug=true}catch(error){window.pokiDebug=true}</script>`
  let out = cleaned
  if (/<head(?:\s[^>]*)?>/i.test(out)) out = out.replace(/<head(?:\s[^>]*)?>/i, (head) => `${head}${shim}`)
  else if (/<html(?:\s[^>]*)?>/i.test(out)) out = out.replace(/<html(?:\s[^>]*)?>/i, (root) => `${root}<head>${shim}</head>`)
  else out = `${shim}${out}`
  if (/<\/body>/i.test(out)) return out.replace(/<\/body>/i, `${late}</body>`)
  return `${out}${late}`
}

function findGameWrapper(html: string): string | undefined {
  // The game page embeds its wrapper as a normal URL, sometimes with escaped
  // slashes in the server-rendered JSON. Normalise both forms before matching.
  const normalised = html.replace(/\\u002f/gi, '/').replace(/\\\//g, '/')
  // Poki embeds the wrapper both as `https://games.poki.com/…` and as the
  // protocol-relative `//games.poki.com/…` (older content ids). Missing the
  // second form made roughly one game in seven unresolvable.
  const match = /(?:https?:)?\/\/games\.poki\.com\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]+/.exec(normalised)
  if (!match) return undefined
  const candidate = match[0].startsWith('//') ? `https:${match[0]}` : match[0]
  if (!isPokiGameWrapperUrl(candidate)) return undefined
  return candidate
}

/**
 * The Poki game page can be served in Poki's bot "playground" mode, where the
 * page renders but never creates its game frame. Resolve the same game through
 * its wrapper so the Apps browser can play it without that shell.
 */
export async function pokiGameFromPage(pageUrl: string, signal?: AbortSignal): Promise<string | undefined> {
  if (!isPokiPage(pageUrl)) return undefined
  const page = await fetchPokiPage(pageUrl, signal)
  if (!page) return undefined
  const wrapperUrl = findGameWrapper(page)
  if (!wrapperUrl) return undefined
  const wrapper = await fetchPokiWrapper(wrapperUrl, signal)
  if (!wrapper) return undefined
  const gameUri = extractPokiParams(wrapper)?.gameUri
  return typeof gameUri === 'string' ? gameUri : undefined
}

export async function pokiGameStartUrl(
  wrapperUrl: string,
  token: string,
  appOrigin: string,
  signal?: AbortSignal,
): Promise<string | undefined> {
  if (!isPokiGameWrapperUrl(wrapperUrl)) return undefined
  const wrapper = await fetchPokiWrapper(wrapperUrl, signal)
  if (!wrapper) return undefined
  const gameUri = extractPokiParams(wrapper)?.gameUri
  if (typeof gameUri !== 'string') return undefined
  const proxyPath = pokiGameProxyPath(token, gameUri)
  if (!proxyPath) return undefined
  return new URL(proxyPath, appOrigin).href
}

const GAME_URI_FIELD = /"gameUri"\s*:\s*"((?:https?:)?\/\/[0-9a-f-]{36}\.gdn\.poki\.com\/[^"]*)"/gi

/**
 * The wrapper is what Poki itself embeds: it holds the game session, posts the
 * handshake the game waits for and only then loads the game frame. Loading the
 * game file directly (the old behaviour) left the game on a black screen because
 * it never received that handshake, so the wrapper's own game address is
 * rewritten to this origin instead.
 */
export function rewriteWrapperGameUri(html: string, token: string, appOrigin: string): string {
  return html.replace(GAME_URI_FIELD, (match, raw: string) => {
    const url = raw.replace(/&amp;/g, '&').replace(/\\u002f/gi, '/').replace(/\\\//g, '/')
    const path = pokiGameProxyPath(token, url)
    return path ? `"gameUri":"${appOrigin}${path}"` : match
  })
}

/** The Poki wrapper document, served from this origin with its game on the proxy. */
export async function pokiGameWrapperResponse(
  wrapperUrl: string,
  token: string,
  appOrigin: string,
  signal?: AbortSignal,
): Promise<Response> {
  if (!isPokiGameWrapperUrl(wrapperUrl)) return new Response('Game not found.', { status: 400, headers: textHeaders() })
  const source = await fetchPokiWrapper(wrapperUrl, signal)
  if (!source) return new Response('Game unavailable.', { status: 502, headers: textHeaders() })
  const html = rewritePokiUrls(rewriteWrapperGameUri(source, token, appOrigin), appOrigin)
  return new Response(html, { status: 200, headers: gameHeaders('text/html; charset=utf-8', 'private, no-store') })
}

/** The wrapper address a Poki game page embeds, found in its own markup. */
export function findPokiGameWrapper(html: string): string | undefined {
  return findGameWrapper(html)
}

/**
 * Poki only creates its game frame after its ad scripts answer. When they never
 * do, the page sits at "Preparing..." forever with no frame at all, so open the
 * same game through the wrapper that performs the handshake itself.
 */
export function installPokiAutostart(html: string, startUrl: string): string {
  const script = `<script>(function(){
var target=${JSON.stringify(startUrl)};
var done=false;
function started(){
  var frames=document.querySelectorAll('iframe');
  for(var i=0;i<frames.length;i++){if((frames[i].src||'').indexOf('/api/poki-game/')>=0)return true}
  return false;
}
function go(){
  if(done||started())return;
  done=true;
  try{window.location.href=target}catch(error){}
}
setTimeout(go,4500);
document.addEventListener('DOMContentLoaded',function(){setTimeout(go,4500)},{once:true});
})()</script>`
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${script}</body>`)
  return `${html}${script}`
}

/**
 * Poki renders its game iframe from client-side data, after the document has
 * loaded. Watch for that frame and route it through the server proxy before it
 * can load the hotlink-protected original.
 */
export function installPokiGameBridge(html: string, token: string, appOrigin: string, parentNavigation = false): string {
  const startUrl = new URL(`/api/poki-game/start/${token}`, appOrigin).href
  const script = `<script>(function(){
var start=${JSON.stringify(startUrl)};
var parentNav=${parentNavigation ? 'true' : 'false'};
var moved=false;
function play(url){
  if(!parentNav||moved)return false;
  moved=true;
  if(window.parent!==window){
    try{window.parent.postMessage({type:'stet:preview-navigate',url:url},'*');return true}catch(error){moved=false;return false}
  }
  window.location.href=url;
  return true;
}
function fix(frame){
  if(!frame||frame.tagName!=='IFRAME')return;
  if(frame.id!=='game-element'&&!(frame.closest&&frame.closest('#game-player')))return;
  var src=frame.src||frame.getAttribute('src')||'';
  if(src.indexOf('https://games.poki.com/')!==0)return;
  var target=start+'?url='+encodeURIComponent(src);
  if(play(target))return;
  if(frame.hasAttribute('sandbox')){
    var flags=(frame.getAttribute('sandbox')||'').split(/\\s+/).filter(function(flag){return flag&&flag!=='allow-same-origin'});
    frame.setAttribute('sandbox',flags.join(' '));
  }
  // Poki creates the game frame with fullscreen and pointer lock only. Unity
  // builds stop at their title screen without an unlocked AudioContext ("mounted
  // system wasn't synchronized"), so let this frame start audio and gamepads.
  try{frame.setAttribute('allow','fullscreen; pointer-lock; autoplay; gamepad; clipboard-write')}catch(error){}
  frame.setAttribute('src',target);
}
function scan(root){
  if(!root||root.nodeType!==1)return;
  if(root.tagName==='IFRAME')fix(root);
  if(root.querySelectorAll){var frames=root.querySelectorAll('iframe');for(var i=0;i<frames.length;i++)fix(frames[i]);}
}
try{
  new MutationObserver(function(records){
    for(var i=0;i<records.length;i++){
      var record=records[i];
      if(record.type==='attributes')fix(record.target);
      else for(var j=0;j<record.addedNodes.length;j++)scan(record.addedNodes[j]);
    }
  }).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['src','sandbox']});
}catch(error){}
document.addEventListener('DOMContentLoaded',function(){scan(document.documentElement)},{once:true});
scan(document.documentElement);
})()</script>`
  if (/<head(?:\s[^>]*)?>/i.test(html)) return html.replace(/<head(?:\s[^>]*)?>/i, (head) => `${head}${script}`)
  if (/<html(?:\s[^>]*)?>/i.test(html)) return html.replace(/<html(?:\s[^>]*)?>/i, (root) => `${root}<head>${script}</head>`)
  return `${script}${html}`
}

function textHeaders(): Record<string, string> {
  return {
    'content-type': 'text/plain; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
    'x-content-type-options': 'nosniff',
  }
}

function gameHeaders(type: string, cache: string): Record<string, string> {
  return {
    'content-type': type,
    'cache-control': cache,
    'access-control-allow-origin': '*',
    'cross-origin-resource-policy': 'cross-origin',
    'referrer-policy': 'no-referrer',
    'x-content-type-options': 'nosniff',
  }
}

export async function proxyPokiGameAsset(
  gameId: string,
  version: string,
  path: string,
  search: string,
  accept: string | undefined,
  signal?: AbortSignal,
  appOrigin = '',
): Promise<Response> {
  if (!isPokiGameId(gameId) || !isSafeGameSegment(version) || !isSafeGamePath(path)) {
    return new Response('Game not found.', { status: 400, headers: textHeaders() })
  }
  const upstream = new URL(`https://${gameId}.gdn.poki.com/${version}/${path}`)
  if (search) upstream.search = search
  let response: Response
  try {
    response = await fetch(upstream.href, {
      redirect: 'follow',
      signal: signalWithTimeout(signal, 30_000),
      headers: {
        accept: accept && accept.length <= 200 ? accept : '*/*',
        'accept-language': 'en-US,en;q=0.9',
        referer: POKI_REFERER,
        'user-agent': USER_AGENT,
      },
    })
  } catch {
    return new Response('Game asset unavailable.', { status: 502, headers: textHeaders() })
  }
  if (!response.ok) {
    await response.body?.cancel()
    return new Response('Game asset unavailable.', {
      status: response.status >= 400 && response.status < 600 ? response.status : 502,
      headers: textHeaders(),
    })
  }
  const type = response.headers.get('content-type') ?? 'application/octet-stream'
  if (HTML_TYPE.test(type)) {
    const html = await response.text()
    // A document past the cap is served as-is rather than refused: the game
    // still loads, and a 413 left it unusable. The largest Poki document is
    // about 17 MB, so this only covers a future growth case.
    if (html.length > MAX_GAME_HTML_CHARS) {
      return new Response(html, { status: 200, headers: gameHeaders('text/html; charset=utf-8', 'private, no-store') })
    }
    return new Response(rewritePokiUrls(addGameShims(html), appOrigin), {
      status: 200,
      headers: gameHeaders('text/html; charset=utf-8', 'private, no-store'),
    })
  }
  if (isTextualAsset(type, path)) {
    const text = await response.text()
    // One Poki bundle is 40 MB. Refusing it broke the whole game, and a
    // Worker cannot hold two rewritten copies of it, so oversized files are
    // streamed back untouched: their own assets resolve relative to this path.
    if (text.length > MAX_GAME_HTML_CHARS) {
      return new Response(text, { status: 200, headers: gameHeaders(type, 'public, max-age=300') })
    }
    return new Response(rewritePokiUrls(text, appOrigin), {
      status: 200,
      headers: gameHeaders(type, 'public, max-age=300'),
    })
  }
  return new Response(response.body, { status: 200, headers: gameHeaders(type, 'public, max-age=300') })
}

/**
 * Serve a Poki asset from this origin. The page shell, game CDN, SDK, fonts and
 * telemetry all live on Poki hostnames, so a filter that blocks Poki blocks the
 * game even when its document is proxied. Their files are rewritten to this
 * route, and the fetch here carries the Poki referer those hosts require.
 */
export async function proxyPokiCdnAsset(
  host: string,
  path: string,
  search: string,
  accept: string | undefined,
  signal?: AbortSignal,
  appOrigin = '',
  request?: { method: string; body?: ArrayBuffer; contentType?: string },
): Promise<Response> {
  if (!isPokiAssetHost(host) || !isSafeGamePath(path)) {
    return new Response('Asset not found.', { status: 400, headers: textHeaders() })
  }
  // Games ping their telemetry endpoints with a POST (and sometimes a body).
  // Forwarding the method is what keeps those from turning into a 404.
  const method = (request?.method ?? 'GET').toUpperCase()
  const body = method === 'GET' || method === 'HEAD' ? undefined : request?.body
  let response: Response
  try {
    response = await fetch(`https://${host.toLowerCase()}/${path}${search}`, {
      method,
      body,
      redirect: 'follow',
      signal: signalWithTimeout(signal, 30_000),
      headers: {
        accept: accept && accept.length <= 200 ? accept : '*/*',
        'accept-language': 'en-US,en;q=0.9',
        referer: POKI_REFERER,
        'user-agent': USER_AGENT,
        ...(body && request?.contentType ? { 'content-type': request.contentType } : {}),
      },
    })
  } catch {
    return new Response('Asset unavailable.', { status: 502, headers: textHeaders() })
  }
  if (!response.ok) {
    await response.body?.cancel()
    return new Response('Asset unavailable.', {
      status: response.status >= 400 && response.status < 600 ? response.status : 502,
      headers: textHeaders(),
    })
  }
  const type = response.headers.get('content-type') ?? 'application/octet-stream'
  if (isTextualAsset(type, path)) {
    const text = await response.text()
    if (text.length > MAX_GAME_HTML_CHARS) {
      return new Response(text, { status: 200, headers: gameHeaders(type, 'public, max-age=300') })
    }
    return new Response(rewritePokiUrls(text, appOrigin), { status: 200, headers: gameHeaders(type, 'public, max-age=300') })
  }
  return new Response(response.body, { status: 200, headers: gameHeaders(type, 'public, max-age=300') })
}
