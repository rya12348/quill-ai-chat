/*
 * Re-asserts the transport on a proxied page.
 *
 * bare-mux holds the transport in a SharedWorker, so a fresh document can find
 * it unset if the worker was reclaimed since the last navigation. This runs
 * from <head> before the proxied site's own scripts, and the call is idempotent
 * when the transport is already set.
 */
;(function () {
  if (!window.BareMux || !window.SharedWorker) return
  try {
    var connection = new window.BareMux.BareMuxConnection('/baremux/worker.js')
    connection.setTransport('/browser/transport.mjs', []).catch(function () {})
  } catch (error) {
    // A page without a transport still renders; individual requests fail and
    // Ultraviolet shows its own error page for the navigation itself.
  }
})()
