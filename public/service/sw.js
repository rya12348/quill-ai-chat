/* global UVServiceWorker, __uv$config */
/*
 * Ink's browser service worker.
 *
 * Registered under /service/ so it only ever sees proxied navigation. Every
 * other request on this origin keeps using the app's own service worker at /,
 * because a registration only handles requests inside its own scope.
 *
 * Ultraviolet normally reaches the network through bare-mux, which lives in a
 * SharedWorker that a page owns and the worker has to ask for over a port. That
 * handshake deadlocks the first navigation: the page that would answer it is
 * the proxied document, whose own scripts are still being fetched through this
 * worker. So the worker gets its own client instead and relays straight to the
 * app's gateway. The page keeps its bare-mux transport for WebSockets, which a
 * service worker cannot proxy.
 */
importScripts('/service/__uv/uv.bundle.js')

const RUNTIME_PREFIX = '/service/__uv/'

/** Statuses whose Response may not carry a body. */
const BODYLESS = new Set([204, 205, 304])

// Every proxied asset is a request to Ink's own gateway, and hosting counts
// them. A single game page can ask for a few hundred files, so a set of files
// that never changes (content-hashed bundles, fonts, images) is kept here and
// answered without touching the network again. Navigations are never cached:
// those carry the session and must stay fresh.
const ASSET_CACHE = 'ink-proxy-assets-v1'
// Code, styles, fonts and images only. Media is left out on purpose: a single
// video would fill the browser's storage allowance for every other file.
const CACHEABLE_FILE = /\.(?:js|mjs|css|woff2?|ttf|otf|eot|png|jpe?g|gif|svg|webp|avif|ico)$/i

/** The real address behind a proxied request, when it has one. */
function targetOf(url) {
  const prefix = location.origin + __uv$config.prefix
  if (!url.startsWith(prefix)) return undefined
  try {
    return new URL(__uv$config.decodeUrl(url.slice(prefix.length).split('?')[0]))
  } catch (error) {
    return undefined
  }
}

// How much of a page's traffic the gateway actually sees. Hosting bills every
// one of those requests, so these counters are the measure of whether the cache
// and the tracker block are doing their job. Read back at /service/__stats.
const stats = { gateway: 0, cached: 0, blocked: 0 }

function readHeaderMap(value) {
  if (!value) return {}
  try {
    const parsed = JSON.parse(decodeURIComponent(value))
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch (error) {
    return {}
  }
}

/**
 * The shape `UVServiceWorker` expects from `bareClient.fetch`: a Response for
 * its `.text()`/`.arrayBuffer()` calls, plus the target's raw headers, which
 * Ultraviolet reads case-insensitively and may hold as arrays, and the address
 * the request ended on, which it reads when naming a download.
 */
class GatewayClient {
  async fetch(url, init) {
    const options = init || {}
    stats.gateway += 1
    let response
    try {
      response = await fetch(new URL('/api/browser-gateway/request', self.location.origin).href, {
        method: 'POST',
        headers: {
          'content-type': 'application/octet-stream',
          'x-ink-url': String(url),
          'x-ink-method': String(options.method || 'GET').toUpperCase(),
          'x-ink-headers': encodeURIComponent(JSON.stringify(options.headers || {})),
        },
        body: options.body === undefined ? null : options.body,
        credentials: 'include',
      })
    } catch (error) {
      throw new TypeError('Ink could not reach its proxy gateway.')
    }

    if (!response.ok) {
      let message = `Ink refused this request (${response.status}).`
      try {
        const failure = await response.json()
        if (failure && typeof failure.message === 'string') message = failure.message
      } catch (error) {
        // Keep the status-based message.
      }
      throw new TypeError(message)
    }

    const status = Number(response.headers.get('x-ink-status') || '502')
    const relayed = new Response(BODYLESS.has(status) ? null : response.body, {
      status,
      statusText: response.headers.get('x-ink-status-text') || '',
    })
    relayed.rawHeaders = readHeaderMap(response.headers.get('x-ink-headers'))
    const finalUrl = response.headers.get('x-ink-final-url')
    relayed.finalURL = finalUrl ? decodeURIComponent(finalUrl) : String(url)
    return relayed
  }
}

self.Ultraviolet.BareClient = GatewayClient

importScripts('/service/__uv/uv.config.js')
importScripts(__uv$config.sw || '/service/__uv/uv.sw.js')

// bare-mux and its bootstrap: the page-side transport is what makes a game's
// own WebSocket reach its server.
const TRANSPORT_TAGS =
  '<script src="/baremux/index.js"></script><script src="/service/__uv/boot.js"></script>'

/** Where bare-mux keeps its SharedWorker. */
const BARE_WORKER = '/baremux/worker.js'

/**
 * Ultraviolet's client runtime, written the way its own injector writes it:
 * cookies and referrer first, then bundle, client, config and handler.
 *
 * These are the hooks that make a proxied page behave. `uv.handler.js` installs
 * them, and without them a page's JavaScript keeps building the site's real
 * addresses: `fetch('/api/x')` reaches Ink's own origin, gets the app's HTML
 * back, and the page dies parsing it. `uv.client.js` must be present before the
 * handler, which reads `self.UVClient`, and the cookie preamble must come
 * first because the handler refuses to start unless `self.__uv$cookies` is a
 * string.
 *
 * They are added here, after rewriting, because the rewriter in this build does
 * not apply the injection it is given, and tags inserted before it would have
 * their own paths rewritten into proxied ones.
 */
function runtimeTags(referrer) {
  const source = (name) => `<script __uv-script="1" src="${RUNTIME_PREFIX}${name}"></script>`
  const cookies = JSON.stringify('')
  const from = JSON.stringify(referrer || '')
  // The handler builds its bare client the moment it loads, and that client
  // reads the bare-mux worker path out of localStorage. Without the path it
  // throws during setup and installs none of the page hooks, so the preamble
  // records it before anything else runs.
  const preamble =
    `self.__uv$cookies = ${cookies};self.__uv$referrer = ${from};` +
    `try { localStorage.setItem('bare-mux-path', ${JSON.stringify(BARE_WORKER)}) } catch (error) {}`
  // SvelteKit sites call rewriteImport(base, module) with strings, but this UV
  // build only rewrites `URL` objects and silently turns a string into the base
  // page. Normalise both argument orders and hand it a real URL.
  const importFix = `<script __uv-script="1">(function(){try{
var uv=window.__uv;
if(!uv||typeof uv.rewriteImport!=='function'||typeof uv.rewriteUrl!=='function')return;
var native=uv.rewriteImport.bind(uv);
uv.rewriteImport=function(first,second,meta){
  try{
    var target;
    var firstIsAbsolute=typeof first==='string'&&(first.indexOf('http://')===0||first.indexOf('https://')===0);
    var secondIsPath=typeof second==='string'&&second.indexOf('://')<0;
    if(firstIsAbsolute&&secondIsPath){
      target=new URL(second,first);
    }else{
      target=new URL(String(first),typeof second==='string'?second:String(uv.meta.url));
    }
    return uv.rewriteUrl(target);
  }catch(error){return native(first,second,meta)}
};
}catch(error){}})()</script>`
  // A site that builds its game frame in JavaScript (`frame.src = url`) never
  // touches the HTML the rewriter saw, so the frame kept the site's real
  // address: a portal like FreezeNova handed its game to the real domain, the
  // request bypassed Ink entirely, and the frame stayed empty. Route any
  // http(s) address assigned to a frame back through the proxy prefix.
  const frameFix = `<script __uv-script="1">(function(){try{
var prefix='/service/';
var origin=location.origin;
// A relative address in a proxied document must resolve against the address
// the site thinks it is on, not against the capability URL the browser sees.
// Frame.src='./index.html' on a game wrapper otherwise became
// '/service/<encoded>/index.html', which decodes to a path one level below the
// real one and answers 404 — a game frame that stays blank forever.
function decodedAddress(){
  var href=document.baseURI||location.href;
  var at=href.indexOf(prefix);
  if(at<0)return href;
  var encoded=href.slice(at+prefix.length);
  var cut=encoded.search(/[?#]/);
  if(cut>=0)encoded=encoded.slice(0,cut);
  try{
    var raw=decodeURIComponent(encoded);
    var url='';
    for(var index=0;index<raw.length;index++)url+=(index%2)?String.fromCharCode(raw.charCodeAt(index)^2):raw.charAt(index);
    return url||href;
  }catch(error){return href}
}
function proxied(value){
  if(typeof value!=='string')return value;
  var text=value.trim();
  if(!text||/^(?:about|blob|data|javascript|mailto|tel|chrome):/i.test(text))return value;
  if(text.charAt(0)==='#')return value;
  var absolute;
  try{absolute=new URL(text,decodedAddress()).href}catch(error){return value}
  if(absolute.indexOf(origin+prefix)===0)return value;
  if(absolute.indexOf(origin+'/api/web-proxy/')===0)return value;
  if(absolute.indexOf(origin+'/api/poki-game/')===0)return value;
  if(absolute.indexOf(origin+'/api/poki-play/')===0)return value;
  var encoded='';
  for(var index=0;index<absolute.length;index++){
    encoded+=(index%2)?String.fromCharCode(absolute.charCodeAt(index)^2):absolute.charAt(index);
  }
  return origin+prefix+encodeURIComponent(encoded);
}
var descriptor=Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype,'src');
if(descriptor&&descriptor.set&&descriptor.get){
  Object.defineProperty(HTMLIFrameElement.prototype,'src',{
    configurable:true,
    enumerable:descriptor.enumerable,
    get:descriptor.get,
    set:function(value){descriptor.set.call(this,proxied(value))}
  });
}
var setAttribute=Element.prototype.setAttribute;
Element.prototype.setAttribute=function(name,value){
  if(String(name).toLowerCase()==='src'&&this instanceof HTMLIFrameElement){
    return setAttribute.call(this,name,proxied(value));
  }
  return setAttribute.call(this,name,value);
};
// A player that copies a game's HTML into its frame leaves a document whose
// scripts never ran: the engine's loader resolves against the portal and the
// canvas keeps its placeholder size. Two jobs fix that, in whichever document
// this runtime runs: load the frame from the game's real address instead of a
// copy, then run the page's own boot script once the engine is there.
function inkTrim(text){
  var out=String(text||'');
  while(out.slice(0,2)==='./')out=out.slice(2);
  while(out.charAt(0)==='/')out=out.slice(1);
  return out;
}
function inkRunUnityBoot(win,doc){
  if(typeof win.createUnityInstance!=='function')return;
  var scope=null;
  try{scope=doc.getElementById('gameContainer')}catch(error){return}
  if(!scope||scope.getAttribute('data-ink-started'))return;
  var scripts=scope.querySelectorAll('script');
  for(var index=0;index<scripts.length;index++){
    var el=scripts[index];
    if(el.getAttribute('src'))continue;
    var text=el.textContent||'';
    if(text.length<40||text.indexOf('createUnityInstance')<0)continue;
    scope.setAttribute('data-ink-started','1');
    try{
      var runner=doc.createElement('script');
      runner.text=text;
      (doc.body||doc.head).appendChild(runner);
    }catch(error){}
    return;
  }
}
function inkSteerGameFrames(){
  inkRunUnityBoot(window,document);
  var frames=document.querySelectorAll('iframe');
  for(var index=0;index<frames.length;index++){
    var frame=frames[index];
    var win=null;
    var doc=null;
    try{win=frame.contentWindow;doc=win&&win.document}catch(error){continue}
    if(!doc)continue;
    try{
      if(typeof win.createUnityInstance!=='undefined'){inkRunUnityBoot(win,doc);continue}
    }catch(error){continue}
    var canvas=null;
    try{canvas=doc.getElementById('unity-canvas')}catch(error){continue}
    if(!canvas)continue;
    var base=null;
    try{base=doc.querySelector('base[href]')}catch(error){continue}
    if(!base||!base.getAttribute('href'))continue;
    var loader=null;
    var list=doc.querySelectorAll('script[src]');
    for(var scan=0;scan<list.length;scan++){
      if((list[scan].getAttribute('src')||'').indexOf('game.loader.js')>=0){loader=list[scan].getAttribute('src');break}
    }
    if(!loader)continue;
    var href=base.getAttribute('href');
    if(href.charAt(href.length-1)!=='/')href+='/';
    var target=proxied(href+'index.html');
    if(!target)continue;
    if(frame.getAttribute('data-ink-game')===target)continue;
    frame.setAttribute('data-ink-game',target);
    // Assign through the setter captured before Ultraviolet replaced it. The
    // live hooks encode a frame address again, and an address that is already
    // proxied becomes a path one level too deep.
    var nativeSet=window.__inkSetAttr;
    if(nativeSet){
      try{nativeSet.call(frame,'src',target);continue}catch(error){}
    }
    frame.setAttribute('src',target);
  }
}
function startUnityWatch(){
  var ticks=0;
  function tick(){try{inkSteerGameFrames()}catch(error){}}
  tick();
  var timer=setInterval(function(){
    ticks++;
    tick();
    if(ticks>30)clearInterval(timer);
  },1000);
}
try{setTimeout(startUnityWatch,1200)}catch(error){}
}catch(error){try{window.__inkFrameError=String(error)}catch(inner){}}
try{window.__inkFrameFix=1}catch(inner){}
})()</script>`
  // Ultraviolet replaces URL.createObjectURL so a blob looks like it belongs to
  // the site, and then routes the blob through the proxy prefix. A blob belongs
  // to the document that made it, so the proxy can never fetch it: workers and
  // scripts a game builds from a Blob stop existing, which is fatal for Unity
  // and WebGL games. Keep the real function and put it back after the hooks.
  const keepBlobs = `window.__inkBlob = URL.createObjectURL; window.__inkRevoke = URL.revokeObjectURL; window.__inkSetAttr = Element.prototype.setAttribute; window.__inkScriptSrc = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype,'src');`
  const restoreBlobs = `try { URL.createObjectURL = window.__inkBlob; URL.revokeObjectURL = window.__inkRevoke } catch (error) {}`
  return (
    `<script __uv-script="1">${keepBlobs}${preamble}</script>` +
    source('uv.bundle.js') +
    source('uv.client.js') +
    source('uv.config.js') +
    // bare-mux has to be live before the handler asks it for a client.
    TRANSPORT_TAGS +
    source('uv.handler.js') +
    frameFix +
    importFix +
    `<script __uv-script="1">${restoreBlobs}</script>`
  )
}

const uv = new UVServiceWorker()

function isRuntimeFile(url) {
  try {
    return new URL(url).pathname.startsWith(RUNTIME_PREFIX)
  } catch (error) {
    return false
  }
}

/** Adds the client runtime to a proxied document, after it has been rewritten. */
/**
 * A script slot must never receive HTML.
 *
 * When a target answers a script request with a page — a 404 page, an ad
 * interstitial, or a failure surface — the browser refuses it outright ("MIME
 * type ('text/html') is not executable") and the page loses that script, which
 * is enough to stop a whole app from booting. An empty script keeps the page
 * running, which is what a missing script should do.
 */
function guardScript(request, response) {
  if (request.destination !== 'script') return response
  const type = (response.headers.get('content-type') || '').toLowerCase()
  if (type.includes('javascript') || type.includes('ecmascript')) return response
  return new Response('', {
    status: 200,
    headers: { 'content-type': 'application/javascript; charset=utf-8' },
  })
}

/**
 * A proxied game usually runs in a frame the portal built for it, and a frame
 * without allowfullscreen is not allowed to go fullscreen no matter what the
 * game asks for. Give every frame in a rewritten document that permission.
 */
function allowFullscreenFrames(html) {
  return html.replace(/<iframe\b[^>]*>/gi, (tag) => {
    let out = tag
    if (!/allowfullscreen/i.test(out)) out = out.replace(/\s*\/?>$/, (end) => ` allowfullscreen${end}`)
    if (!/\ballow\s*=/i.test(out)) {
      out = out.replace(/\s*\/?>$/, (end) => ` allow="fullscreen; autoplay"${end}`)
    } else if (!/allow\s*=\s*"[^"]*fullscreen/i.test(out)) {
      out = out.replace(/allow\s*=\s*"([^"]*)"/i, (_match, value) => `allow="${value}; fullscreen"`)
    }
    return out
  })
}

/**
 * A portal that builds its game frame by writing a fetched document into it
 * (`frame.document.write(html)` on an `about:blank` frame) hands that document
 * the portal's own address. The game then resolves its own relative scripts
 * against the portal (`freezenova.com/class/Build/game.loader.js`) instead of
 * its CDN, gets a 404, and never defines its engine entry point.
 *
 * The written document is this proxied document, so give it back the address it
 * was served from: a framed copy that is not sitting on its own proxied URL
 * navigates itself there. The real navigation goes through the proxy, the frame
 * gets its own address, and every relative URL in the game resolves correctly.
 * A top-level document is untouched, so the portal page itself never moves.
 */
/**
 * A document a portal writes into a frame (`frame.document.write(html)`) is
 * fetched from the game's own address, and it carries a `<base>` pointing back
 * there. Its relative script (`Build/game.loader.js`) is left untouched by the
 * rewriter because the base already makes it absolute — but that absolute
 * address is the real CDN, outside the proxy, so the loader never arrives and
 * the engine entry point is never defined.
 *
 * Resolve those relative addresses against the document's own base and send
 * them through the proxy, so the document's own code loads where the proxy can
 * answer it. A document with no base is left alone: the rewriter already
 * handled it.
 */
function proxyDocumentRelativeUrls(html, address) {
  if (!address) return html
  const declared = /<base[^>]+href\s*=\s*["']([^"']+)["']/i.exec(html)
  if (!declared) return html
  let base
  try {
    base = new URL(declared[1], address).href
  } catch (error) {
    return html
  }
  const prefix = location.origin + __uv$config.prefix
  return html.replace(
    /(\s(?:src|href|poster|data-src)\s*=\s*)(["'])(.*?)\2/gi,
    (match, lead, quote, value) => {
      const text = String(value).trim()
      if (!text || /^(?:[a-z][a-z\d+.-]*:|\/\/|\/|#)/i.test(text)) return match
      let absolute
      try {
        absolute = new URL(text, base).href
      } catch (error) {
        return match
      }
      if (!/^https?:/i.test(absolute)) return match
      return `${lead}${quote}${prefix}${__uv$config.encodeUrl(absolute)}${quote}`
    },
  )
}

async function withRuntime(response, referrer, address) {
  const type = response.headers.get('content-type') || ''
  if (!type.startsWith('text/html')) return response
  let html
  try {
    html = await response.text()
  } catch (error) {
    return response
  }
  html = allowFullscreenFrames(html)
  html = proxyDocumentRelativeUrls(html, address)
  const tags = runtimeTags(referrer)
  const head = /<head[^>]*>/i
  const body = head.test(html)
    ? html.replace(head, (tag) => `${tag}${tags}`)
    : `${tags}${html}`
  return new Response(body, response)
}

function describe(error) {
  const text = String((error && error.message) || 'The page could not be loaded.').replace(/[<>&]/g, '')
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Could not load</title>` +
      `<style>body{margin:0;font:16px/1.6 system-ui,sans-serif;background:#f6f4ef;color:#24221d}` +
      `main{max-width:640px;margin:14vh auto;padding:0 28px}h1{font-size:2rem;letter-spacing:-.03em;margin:0 0 12px}` +
      `p{margin:0 0 10px;color:#4f4a42}</style></head>` +
      `<body><main><h1>Could not load this page</h1><p>${text}</p></main></body></html>`,
    { status: 502, headers: { 'content-type': 'text/html; charset=utf-8' } },
  )
}

/**
 * Ultraviolet treats any same-origin referrer as one of its own proxied URLs
 * and decodes it. A navigation that starts on an app page (the browser itself)
 * has a same-origin referrer that is not in the prefix, so decoding it produces
 * a broken URL and the whole navigation dies with "Invalid URL". Hide that one
 * referrer and leave proxied referrers alone, since those carry the real site
 * address a game expects.
 */
function withoutForeignReferrer(event) {
  const referrer = event.request.referrer
  if (!referrer) return event
  let source
  try {
    source = new URL(referrer)
  } catch (error) {
    return event
  }
  if (source.origin !== location.origin || source.pathname.startsWith(__uv$config.prefix)) return event
  const request = event.request
  const clean = new Proxy(request, {
    get(target, property) {
      if (property === 'referrer') return ''
      const value = Reflect.get(target, property, target)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
  return { request: clean }
}

/**
 * Poki's game pages are served to the proxy in a bot "playground" shell that
 * paints the page but never creates the game frame. Catch a navigation to one
 * of those pages and send it to the app's wrapper-backed player instead.
 */
function pokiGamePage(request) {
  if (request.mode !== 'navigate') return undefined
  const prefix = location.origin + __uv$config.prefix
  if (!request.url.startsWith(prefix)) return undefined
  let target
  try {
    target = new URL(__uv$config.decodeUrl(request.url.slice(prefix.length).split('?')[0]))
  } catch (error) {
    return undefined
  }
  if (target.protocol !== 'https:' || target.hostname !== 'poki.com') return undefined
  const parts = target.pathname.split('/').filter(Boolean)
  const gameIndex = parts.indexOf('g')
  if (gameIndex < 0 || gameIndex > 1 || parts.length <= gameIndex + 1) return undefined
  return target.href
}

/**
 * The game's own script sends a framed page back to the ad wrapper when the
 * parent is another domain — which is exactly what a proxy looks like. Without
 * this the redirect and the wrapper rewrite above would loop forever.
 */
async function keepGameFrame(response, request) {
  const target = targetOf(request.url)
  if (!target || !/\/assets\/scripts\/game\.js$/i.test(target.pathname)) return response
  const type = (response.headers.get('content-type') || '').toLowerCase()
  if (!type.includes('javascript')) return response
  let source
  try {
    source = await response.text()
  } catch (error) {
    return response
  }
  const next = source.replace(/window\.location\.href\s*=\s*(['"])\.\/pre(?:-gg)?\.html\1/g, 'void 0')
  return new Response(next, response)
}

async function handleRequest(event) {
  if (new URL(event.request.url).pathname === '/service/__stats') {
    return new Response(JSON.stringify(stats), { headers: { 'content-type': 'application/json' } })
  }
  if (isRuntimeFile(event.request.url)) return fetch(event.request)
  const game = pokiGamePage(event.request)
  if (game) {
    return Response.redirect(
      new URL(`/api/poki-play?url=${encodeURIComponent(game)}`, location.origin).href,
      302,
    )
  }

  if (!uv.route(event)) return fetch(event.request)
  const target = targetOf(event.request.url)
  const cacheable =
    target &&
    event.request.method === 'GET' &&
    event.request.mode !== 'navigate' &&
    CACHEABLE_FILE.test(target.pathname)
  if (cacheable) {
    const cached = await caches.match(event.request, { cacheName: ASSET_CACHE })
    if (cached) {
      stats.cached += 1
      return cached
    }
  }
  // A proxied navigation that never settles would leave the tab loading
  // forever with no way back, so surface the failure instead.
  try {
    const response = await Promise.race([
      uv.fetch(withoutForeignReferrer(event)),
      new Promise((resolve, reject) => {
        setTimeout(() => reject(new Error('The site did not respond in time.')), 45_000)
      }),
    ])
    const patched = await keepGameFrame(response, event.request)
    const final = await withRuntime(
      guardScript(event.request, patched),
      event.request.referrer,
      event.request.url,
    )
    if (cacheable && final.ok && !(final.headers.get('content-type') || '').startsWith('text/html')) {
      const copy = final.clone()
      event.waitUntil(
        caches
          .open(ASSET_CACHE)
          .then((cache) => cache.put(event.request, copy))
          .catch(() => undefined),
      )
    }
    return final
  } catch (error) {
    // A failed script request still has to answer as JavaScript. An HTML error
    // page in a script slot is refused by the browser, and on a game page that
    // means the engine's loader never defines itself and the page sits on a
    // black canvas with nothing to click.
    return guardScript(event.request, describe(error))
  }
}

// A stale proxy worker is a correctness bug: it would keep rewriting pages
// with an old rewriter after a deploy, so new versions take over immediately.
self.addEventListener('install', () => {
  void self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // A cache written by an older worker is as stale as the worker itself.
      const names = await caches.keys()
      await Promise.all(
        names.filter((name) => name.startsWith('ink-proxy-assets-') && name !== ASSET_CACHE).map((name) => caches.delete(name)),
      )
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event))
})
