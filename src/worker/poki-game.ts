const HTML_TYPE = /text\/html|application\/xhtml\+xml/i
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
const POKI_REFERER = 'https://poki.com/'
const MAX_WRAPPER_CHARS = 400_000
const MAX_GAME_HTML_CHARS = 4_000_000

type GameTarget = {
  gameId: string
  version: string
  path: string
  search: string
}

export function isPokiGameId(value: string): boolean {
  return UUID.test(value)
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
    return (
      url.protocol === 'https:' &&
      url.hostname === 'games.poki.com' &&
      /^\/(?:\d+\/)?[0-9a-f-]{36}$/i.test(url.pathname)
    )
  } catch {
    return false
  }
}

function isSafeGamePath(path: string): boolean {
  if (!path || path.length > 2_000) return false
  return path
    .split('/')
    .every((part) => part.length > 0 && part !== '.' && part !== '..' && !/[\\?#]/.test(part))
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
  if (parts.length < 2 || !isPokiGameId(parts[0])) return undefined
  const path = parts.slice(1).join('/')
  if (!isSafeGamePath(path)) return undefined
  return { gameId: host[1], version: parts[0], path, search: url.search }
}

export function pokiGameProxyPath(token: string, gameUrl: string): string | undefined {
  const target = gameTarget(gameUrl)
  if (!target) return undefined
  return `/api/poki-game/${token}/${target.gameId}/${target.version}/${target.path}${target.search}`
}

function signalWithTimeout(signal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs)
  return signal ? AbortSignal.any([signal, timeout]) : timeout
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
try{window.PokiSDK={init:function(){return Promise.resolve()},gameLoadingStart:function(){},gameLoadingFinished:function(){},gameplayStart:function(){},gameplayStop:function(){},commercialBreak:function(){return Promise.resolve()},rewardedBreak:function(){return Promise.resolve(true)},showLeaderboard:function(){return Promise.resolve()},measure:function(){},setDebug:function(){},isAdBlocked:function(){return false}}}catch(error){}
})()</script>`
  const late = `<script>try{pokiDebug=true}catch(error){window.pokiDebug=true}</script>`
  let out = cleaned
  if (/<head(?:\s[^>]*)?>/i.test(out)) out = out.replace(/<head(?:\s[^>]*)?>/i, (head) => `${head}${shim}`)
  else if (/<html(?:\s[^>]*)?>/i.test(out)) out = out.replace(/<html(?:\s[^>]*)?>/i, (root) => `${root}<head>${shim}</head>`)
  else out = `${shim}${out}`
  if (/<\/body>/i.test(out)) return out.replace(/<\/body>/i, `${late}</body>`)
  return `${out}${late}`
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
    try{window.parent.postMessage({type:'quill:preview-navigate',url:url},'*');return true}catch(error){moved=false;return false}
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
): Promise<Response> {
  if (!isPokiGameId(gameId) || !isPokiGameId(version) || !isSafeGamePath(path)) {
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
    if (html.length > MAX_GAME_HTML_CHARS) {
      return new Response('Game page is too large.', { status: 413, headers: textHeaders() })
    }
    return new Response(addGameShims(html), {
      status: 200,
      headers: gameHeaders('text/html; charset=utf-8', 'private, no-store'),
    })
  }
  return new Response(response.body, { status: 200, headers: gameHeaders(type, 'public, max-age=300') })
}
