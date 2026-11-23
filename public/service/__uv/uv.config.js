/* global Ultraviolet */
/*
 * Ultraviolet configuration for Ink's browser.
 *
 * `prefix` is the address space the service worker owns. Runtime files sit one
 * level down in /service/__uv/ so they are never mistaken for a proxied URL.
 *
 * The client runtime is added to each proxied document by the worker itself
 * (see sw.js). Ultraviolet's own `injectHead` option is not applied by the
 * rewriter in this build, and `inject` entries are inserted before rewriting,
 * which would rewrite the runtime's own paths into proxied ones.
 */
self.__uv$config = {
  prefix: '/service/',
  encodeUrl: Ultraviolet.codec.xor.encode,
  decodeUrl: Ultraviolet.codec.xor.decode,
  handler: '/service/__uv/uv.handler.js',
  client: '/service/__uv/uv.client.js',
  bundle: '/service/__uv/uv.bundle.js',
  config: '/service/__uv/uv.config.js',
  sw: '/service/__uv/uv.sw.js',
}
