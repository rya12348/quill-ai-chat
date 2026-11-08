// Drives the sandboxed proof runner. One fresh iframe per job: a timed-out or
// runaway program cannot leave a runner behind, and nothing it does is visible
// to the app except the report it posts back.

import type { ProofJob, ProofRunReport } from '../../shared/types'

const TIMEOUT = 60_000

export function runProofJob(job: ProofJob): Promise<ProofRunReport> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve({ runs: [], loadError: 'code runner unavailable' })
  }
  const frame = document.createElement('iframe')
  frame.setAttribute('sandbox', 'allow-scripts')
  frame.setAttribute('aria-hidden', 'true')
  frame.title = 'Proof code runner'
  frame.src = '/proof-runner.html'
  frame.style.display = 'none'
  document.body.appendChild(frame)

  const id = crypto.randomUUID()
  return new Promise<ProofRunReport>((resolve) => {
    let settled = false
    const finish = (report: ProofRunReport) => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      window.removeEventListener('message', onMessage)
      frame.remove()
      resolve(report)
    }
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.contentWindow) return
      const data = event.data as { type?: unknown; id?: unknown; report?: ProofRunReport }
      if (!data || typeof data !== 'object') return
      if (data.type === 'ready') {
        frame.contentWindow?.postMessage({ type: 'run', id, job }, '*')
        return
      }
      if (data.type === 'result' && data.id === id) finish(data.report ?? { runs: [] })
    }
    window.addEventListener('message', onMessage)
    const timer = window.setTimeout(() => finish({ runs: [], loadError: 'code runner timed out' }), TIMEOUT)
  })
}
