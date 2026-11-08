// Drives the sandboxed Analyze runner. One fresh iframe per job: a timed-out or
// runaway program cannot leave a runner behind, and the CSV never leaves the
// browser's memory.

import type { AnalysisRunResult } from '../../shared/types'

const TIMEOUT = 90_000

export function runAnalysisJob(code: string, csv: string): Promise<AnalysisRunResult> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve({ ok: false, loadError: 'code runner unavailable' })
  }
  const frame = document.createElement('iframe')
  frame.setAttribute('sandbox', 'allow-scripts')
  frame.setAttribute('aria-hidden', 'true')
  frame.title = 'Analyze code runner'
  frame.src = '/analysis-runner.html'
  frame.style.display = 'none'
  document.body.appendChild(frame)

  const id = crypto.randomUUID()
  return new Promise<AnalysisRunResult>((resolve) => {
    let settled = false
    const finish = (result: AnalysisRunResult) => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      window.removeEventListener('message', onMessage)
      frame.remove()
      resolve(result)
    }
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.contentWindow) return
      const data = event.data as { type?: unknown; id?: unknown; result?: AnalysisRunResult }
      if (!data || typeof data !== 'object') return
      if (data.type === 'ready') {
        frame.contentWindow?.postMessage({ type: 'run', id, job: { code, csv } }, '*')
        return
      }
      if (data.type === 'result' && data.id === id) finish(data.result ?? { ok: false, error: 'The runner returned no result.' })
    }
    window.addEventListener('message', onMessage)
    const timer = window.setTimeout(() => finish({ ok: false, loadError: 'Python analysis timed out.' }), TIMEOUT)
  })
}
