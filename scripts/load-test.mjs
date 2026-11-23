// Small production load probe. It only hits cache-safe health and shell routes;
// it never starts a chat or spends a model request.
const base = (process.env.PRODUCTION_URL?.trim() || 'https://www.inkbrowser.dpdns.org').replace(/\/$/, '')
const total = Math.max(4, Math.min(240, Number(process.env.LOAD_REQUESTS || 40)))
const concurrency = Math.max(1, Math.min(12, Number(process.env.LOAD_CONCURRENCY || 4)))
const p95Limit = Number(process.env.LOAD_P95_MS || 2000)
const paths = ['/', '/api/health', '/api/ready', '/api/health/errors']
const results = []
let next = 0

async function one() {
  while (next < total) {
    const path = paths[next % paths.length]
    next += 1
    const started = Date.now()
    try {
      const response = await fetch(base + path, { cache: 'no-store', signal: AbortSignal.timeout(15_000) })
      await response.arrayBuffer()
      results.push({ path, status: response.status, ms: Date.now() - started })
    } catch (error) {
      results.push({ path, status: 0, ms: Date.now() - started, error: error instanceof Error ? error.message : String(error) })
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, one))
const times = results.map((result) => result.ms).sort((a, b) => a - b)
const percentile = (value) => times[Math.min(times.length - 1, Math.floor((value / 100) * times.length))] ?? 0
const failures = results.filter((result) => result.status === 0 || result.status >= 500)
const slow = results.filter((result) => result.ms > p95Limit)
const summary = {
  ok: failures.length === 0 && percentile(95) <= p95Limit,
  base,
  requests: total,
  concurrency,
  p50: percentile(50),
  p95: percentile(95),
  p99: percentile(99),
  max: times.at(-1) ?? 0,
  failures: failures.length,
  overP95Limit: slow.length,
  p95Limit,
}
console.log(JSON.stringify(summary, null, 2))
if (!summary.ok) process.exitCode = 1
