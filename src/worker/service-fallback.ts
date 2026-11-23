/**
 * A server-side stand-in for the /service/ proxy worker.
 *
 * The browser worker owns /service/ whenever it controls the document. Two
 * cases escape it: a frame the site itself sandboxed (an opaque origin cannot
 * be controlled by a service worker), and a first load before the worker has
 * taken over. Those requests used to reach this Worker and get a plain 404, so
 * a portal like FreezeNova handed its game frame a proxied address and got
 * "Not found." back — the game page painted and its game never started.
 *
 * This route answers instead: decode the address, fetch it with the same
 * hardening the rest of the proxy uses, rewrite the document's own URLs back
 * into /service/, and install the small runtime a proxied document needs to
 * keep its dynamic requests inside the proxy.
 */
import { fetchSiteRequest, normalizeSiteUrl, SiteError } from './site-proxy'

const PREFIX = '/service/'

/** The address the browser worker encodes: every other character is xored. */
export function decodeServicePath(encoded: string): string | undefined {
  let raw: string
  try {
    raw = decodeURIComponent(encoded)
  } catch {
    return undefined
  }
  let url = ''
  for (let index = 0; index < raw.length; index += 1) {
    url += index % 2 ? String.fromCharCode(raw.charCodeAt(index) ^ 2) : raw[index]
  }
  return normalizeSiteUrl(url)
}

export function encodeServicePath(url: string): string {
  let encoded = ''
  for (let index = 0; index < url.length; index += 1) {
    encoded += index % 2 ? String.fromCharCode(url.charCodeAt(index) ^ 2) : url[index]
  }
  return PREFIX + encodeURIComponent(encoded)
}

const ATTRIBUTE = /(\s(?:src|href|action|poster|data-src)\s*=\s*)(["'])(.*?)\2/gi
const CSS_URL = /url\(\s*(["']?)(?!data:|blob:|#)([^)"']+)\1\s*\)/gi

function proxied(value: string, base: string): string | undefined {
  const text = value.trim()
  if (!text) return undefined
  if (/^(?:about|blob|data|javascript|mailto|tel|chrome):/i.test(text)) return undefined
  if (text.startsWith('#')) return undefined
  if (text.startsWith(PREFIX) || text.startsWith('/api/web-proxy/') || text.startsWith('/api/poki-')) return undefined
  let absolute: URL
  try {
    absolute = new URL(text, base)
  } catch {
    return undefined
  }
  if (absolute.protocol !== 'http:' && absolute.protocol !== 'https:') return undefined
  return encodeServicePath(absolute.href)
}

/**
 * Keep the document's own resources inside the proxy. The runtime below covers
 * everything the markup does not: a frame or script a site builds in
 * JavaScript, and requests made by fetch or XMLHttpRequest.
 */
export function rewriteServiceDocument(html: string, target: string): string {
  let out = html.replace(ATTRIBUTE, (match, lead: string, quote: string, value: string) => {
    const next = proxied(value, target)
    return next ? `${lead}${quote}${next}${quote}` : match
  })
  out = out.replace(CSS_URL, (match, quote: string, value: string) => {
    const next = proxied(value, target)
    return next ? `url(${quote}${next}${quote})` : match
  })
  const runtime = `<script>(function(){
try{
  var origin=location.origin,prefix='${PREFIX}';
  // Resolve a relative address against the site's own address. The capability
  // path the browser sees (/service/<encoded>) is not a directory tree, so
  // resolving against it produced /service/<encoded>/index.html — a 404 for
  // every wrapper that starts its game frame with frame.src='./index.html'.
  function siteAddress(){
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
    try{absolute=new URL(text,siteAddress()).href}catch(error){return value}
    if(absolute.indexOf(origin+prefix)===0||absolute.indexOf(origin+'/api/web-proxy/')===0||absolute.indexOf(origin+'/api/poki-')===0)return value;
    var encoded='';
    for(var index=0;index<absolute.length;index++){encoded+=(index%2)?String.fromCharCode(absolute.charCodeAt(index)^2):absolute.charAt(index);}
    return origin+prefix+encodeURIComponent(encoded);
  }
  var nativeFetch=window.fetch;
  window.fetch=function(input,init){
    try{
      if(typeof input==='string')input=proxied(input);
      else if(input&&input.url&&input.url.indexOf(origin)===0)input=new Request(proxied(input.url),input);
    }catch(error){}
    return nativeFetch.call(this,input,init);
  };
  var nativeOpen=XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open=function(method,url){
    var args=Array.prototype.slice.call(arguments,1);
    args[0]=proxied(url);
    return nativeOpen.apply(this,[method].concat(args));
  };
  var descriptor=Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype,'src');
  if(descriptor&&descriptor.set&&descriptor.get){
    Object.defineProperty(HTMLIFrameElement.prototype,'src',{configurable:true,enumerable:descriptor.enumerable,get:descriptor.get,set:function(value){descriptor.set.call(this,proxied(value))}});
  }
  var setAttribute=Element.prototype.setAttribute;
  Element.prototype.setAttribute=function(name,value){
    var key=String(name).toLowerCase();
    if(key==='src'||key==='href')return setAttribute.call(this,name,proxied(value));
    return setAttribute.call(this,name,value);
  };
}catch(error){}
})()</script>`
  if (/<head(?:\s[^>]*)?>/i.test(out)) return out.replace(/<head(?:\s[^>]*)?>/i, (head) => `${head}${runtime}`)
  if (/<html(?:\s[^>]*)?>/i.test(out)) return out.replace(/<html(?:\s[^>]*)?>/i, (root) => `${root}<head>${runtime}</head>`)
  return runtime + out
}

/** Answer a /service/ request that reached the Worker instead of the browser. */
export async function serviceFallbackResponse(path: string, request: Request): Promise<Response> {
  const encoded = path.slice(PREFIX.length)
  const target = decodeServicePath(encoded.split('?')[0])
  if (!target) {
    return new Response('Not found.', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } })
  }
  try {
    const response = await fetchSiteRequest(target, request)
    const type = response.contentType.toLowerCase()
    if (type.includes('text/html')) {
      const html = new TextDecoder().decode(response.body)
      return new Response(rewriteServiceDocument(html, target), {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
      })
    }
    return new Response(response.body, {
      status: response.status,
      headers: { 'content-type': response.contentType, 'cache-control': 'no-store' },
    })
  } catch (error) {
    const failure = error instanceof SiteError ? error : new SiteError(502, 'That page could not be loaded.')
    return new Response(failure.message, {
      status: failure.status,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
    })
  }
}
