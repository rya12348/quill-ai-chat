/**
 * Ink's transport for bare-mux.
 *
 * Ultraviolet does all of the hard work in the service worker: it rewrites
 * HTML, CSS and JavaScript, keeps a per-site cookie jar, and re-points relative
 * URLs and runtime API calls. The only thing a page cannot do is talk to
 * another origin, so this module forwards each request to Ink's own gateway,
 * which is a plain relay. That is what makes the browser generic: no site needs
 * a bespoke rule, because nothing site-specific happens here.
 *
 * The gateway answers with the target's status and headers in `x-ink-*`
 * response headers and streams the target body through unchanged, including
 * 3xx responses. Ultraviolet resolves redirects itself, so they must arrive
 * unresolved.
 */

const GATEWAY = '/api/browser-gateway'

/** Header values are percent-encoded JSON so any byte survives transit. */
function readHeaderMap(value) {
  if (!value) return {}
  try {
    const parsed = JSON.parse(decodeURIComponent(value))
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

/** Statuses that must not carry a body. */
const BODYLESS = new Set([204, 205, 304])

export default class InkTransport {
  constructor() {
    this.ready = false
  }

  async init() {
    this.ready = true
  }

  meta() {
    return {}
  }

  async request(remote, method, body, headers, signal) {
    let response
    try {
      response = await fetch(`${GATEWAY}/request`, {
        method: 'POST',
        headers: {
          'content-type': 'application/octet-stream',
          'x-ink-url': remote.href,
          'x-ink-method': method,
          'x-ink-headers': encodeURIComponent(JSON.stringify(headers || {})),
        },
        body: body === undefined ? null : body,
        credentials: 'include',
        ...(signal ? { signal } : {}),
      })
    } catch (error) {
      if (error && error.name === 'AbortError') throw error
      throw new TypeError(`Ink could not reach ${remote.host}.`)
    }

    if (!response.ok) {
      // The gateway refuses a target before it contacts it (private address,
      // unsupported scheme). Surface its reason instead of an opaque 502.
      let message = `Ink refused this request (${response.status}).`
      try {
        const failure = await response.json()
        if (failure && typeof failure.message === 'string') message = failure.message
      } catch {
        // Keep the status-based message.
      }
      throw new TypeError(message)
    }

    const status = Number(response.headers.get('x-ink-status') || '502')
    const statusText = response.headers.get('x-ink-status-text') || ''
    return {
      body: BODYLESS.has(status) || method === 'HEAD' ? undefined : response.body,
      headers: readHeaderMap(response.headers.get('x-ink-headers')),
      status,
      statusText,
    }
  }

  /**
   * A proxied WebSocket. The worker opens the real socket to the destination
   * and pipes frames, so games that talk to their own servers keep working.
   *
   * No subprotocol is requested on this hop on purpose: the browser requires
   * the server to echo one, and the negotiated protocol belongs to the
   * destination. It is sent back in the first control frame instead.
   */
  connect(url, protocols, requestHeaders, onopen, onmessage, onclose, onerror) {
    const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const socket = new WebSocket(`${scheme}//${location.host}${GATEWAY}/socket`)
    socket.binaryType = 'arraybuffer'

    let established = false

    socket.onopen = () => {
      socket.send(
        JSON.stringify({
          type: 'open',
          url: url.href,
          protocols: protocols || [],
          headers: requestHeaders || {},
        }),
      )
    }

    socket.onmessage = (event) => {
      if (typeof event.data === 'string') {
        let message
        try {
          message = JSON.parse(event.data)
        } catch {
          return
        }
        if (message.type === 'open') {
          established = true
          onopen(message.protocol || '')
        } else if (message.type === 'close') {
          onclose(Number(message.code) || 1000, message.reason || '')
        } else if (message.type === 'error') {
          onerror(String(message.message || 'The proxy closed this socket.'))
        }
        return
      }
      onmessage(event.data)
    }

    socket.onclose = (event) => {
      if (established) onclose(event.code || 1000, event.reason || '')
      else onerror('Ink could not open this socket.')
    }

    socket.onerror = () => {
      if (!established) onerror('Ink could not open this socket.')
    }

    return [
      (data) => {
        if (socket.readyState === 1) socket.send(data)
      },
      (code, reason) => {
        try {
          socket.close(code, reason)
        } catch {
          socket.close()
        }
      },
    ]
  }
}
