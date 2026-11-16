// DuckDuckGo's free chat has no API key, but it does require a short VQD proof
// that its own page computes in the browser. This runs that proof inside a
// hidden same-origin frame and returns the opaque proof for the Worker to send
// upstream. No prompt or cookie ever leaves through a third party here.

export const DUCK_MODELS = ['gpt-6-luna', 'claude-haiku-5-5'] as const
export type DuckModel = (typeof DUCK_MODELS)[number]

export const DUCK_MODEL_LABELS: Record<DuckModel, { name: string; detail: string }> = {
  'gpt-6-luna': { name: 'ChatGPT', detail: 'GPT-6 Luna' },
  'claude-haiku-5-5': { name: 'Claude', detail: 'Haiku 5.5' },
}

export type DuckChallenge = {
  challenge: string
  feVersion: string
  cookies: string
}

export type DuckTurn = {
  proof: string
  feVersion: string
  cookies: string
  model: DuckModel
}

type Solved = {
  client_hashes?: unknown[]
  server_hashes?: unknown
  signals?: unknown
  meta?: Record<string, unknown>
}

const SOLVE_TIMEOUT_MS = 12_000

function base64(bytes: Uint8Array): string {
  let text = ''
  for (const byte of bytes) text += String.fromCharCode(byte)
  return btoa(text)
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return base64(new Uint8Array(digest))
}

/**
 * Runs the challenge source as a plain inline script. Using an inline script
 * instead of eval keeps the production CSP unchanged (it has no unsafe-eval).
 */
export async function solveDuckChallenge(
  session: DuckChallenge,
  model: DuckModel,
  signal?: AbortSignal,
): Promise<DuckTurn | null> {
  if (!session?.challenge || !session.feVersion) return null
  let source: string
  try {
    source = atob(session.challenge).replace(/<\/script/gi, '<\\/script')
  } catch {
    return null
  }

  const script = [
    '(async function(){',
    '  const host = window.parent;',
    '  try {',
    '    window.__DDG_FE_CHAT_HASH__ = "dummy";',
    '    window.__DDG_BE_VERSION__ = "dummy";',
    '    try { Object.defineProperty(window, "parent", { value: window, configurable: true }); } catch {}',
    '    try { Object.defineProperty(window, "top", { value: window, configurable: true }); } catch {}',
    '    window.get = () => undefined;',
    '    const mockCspMeta = { getAttribute: () => "default-src \'none\'; script-src \'unsafe-inline\';" };',
    '    const mockContentDoc = { querySelector: () => mockCspMeta };',
    '    const jsa = document.createElement("div");',
    '    jsa.id = "jsa";',
    '    jsa.setAttribute("__DDG_BE_VERSION__", "dummy");',
    '    Object.defineProperty(jsa, "contentDocument", { get: () => mockContentDoc, configurable: true });',
    '    Object.defineProperty(jsa, "contentWindow", { get: () => ({ document: mockContentDoc, get: () => undefined }), configurable: true });',
    '    document.body.appendChild(jsa);',
    `    const result = await (${source});`,
    '    host.postMessage({ type: "duck-solved", result }, "*");',
    '  } catch (error) {',
    '    host.postMessage({ type: "duck-error", error: String(error && (error.stack || error)) }, "*");',
    '  }',
    '})();',
  ].join('\n')

  const frame = document.createElement('iframe')
  frame.title = 'Free model challenge'
  frame.setAttribute('aria-hidden', 'true')
  frame.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;border:0;visibility:hidden'
  frame.srcdoc = '<!doctype html><body><script>' + script + '</script>'

  const solved = await new Promise<Solved>((resolve, reject) => {
    let timer = 0
    const cleanup = () => {
      window.clearTimeout(timer)
      window.removeEventListener('message', onMessage)
      signal?.removeEventListener('abort', onAbort)
      frame.remove()
    }
    const onAbort = () => {
      cleanup()
      reject(new DOMException('Aborted', 'AbortError'))
    }
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.contentWindow) return
      const data = event.data as { type?: string; result?: unknown; error?: unknown } | null
      if (data?.type === 'duck-solved' && data.result && typeof data.result === 'object') {
        cleanup()
        resolve(data.result as Solved)
      } else if (data?.type === 'duck-error') {
        cleanup()
        reject(new Error(typeof data.error === 'string' ? data.error : 'The free model challenge failed.'))
      }
    }
    timer = window.setTimeout(() => {
      cleanup()
      reject(new Error('The free model challenge timed out.'))
    }, SOLVE_TIMEOUT_MS)
    window.addEventListener('message', onMessage)
    if (signal?.aborted) {
      onAbort()
      return
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    document.body.appendChild(frame)
  })

  if (!Array.isArray(solved.client_hashes) || !solved.client_hashes.length || !solved.meta) return null
  const clientHashes = await Promise.all(solved.client_hashes.map((value) => sha256(String(value))))
  const meta = {
    ...solved.meta,
    origin: 'https://duck.ai',
    stack:
      'Error\nat l (https://duck.ai/dist/duckai-dist/entry.duckai.js:2:2129171)\nat async https://duck.ai/dist/duckai-dist/entry.duckai.js:2:1859809',
    duration: '58',
  }
  const proof = btoa(
    JSON.stringify({
      ...solved,
      client_hashes: clientHashes,
      meta,
    }),
  )
  return { proof, feVersion: session.feVersion, cookies: session.cookies ?? '', model }
}

/** Fetches a fresh challenge and solves it; any failure returns null so the page can use fallbacks. */
export async function requestDuckTurn(model: DuckModel, signal?: AbortSignal): Promise<DuckTurn | null> {
  const response = await fetch('/api/buffy/duck/challenge', {
    headers: { accept: 'application/json' },
    signal,
  })
  if (!response.ok) return null
  const session = (await response.json().catch(() => null)) as DuckChallenge | null
  if (!session?.challenge) return null
  return solveDuckChallenge(session, model, signal)
}
