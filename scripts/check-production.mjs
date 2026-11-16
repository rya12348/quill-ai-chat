// External synthetic check for the custom domain. Run from CI or any network
// that is not behind the owner's local content filter.
const base = (process.env.PRODUCTION_URL?.trim() || 'https://ink.7394.jo3.org').replace(/\/$/, '')
const slowMs = Number(process.env.PRODUCTION_SLOW_MS || 5000)
const errorLimit = Number(process.env.PRODUCTION_ERROR_LIMIT || 10)
const checks = []

async function probe(path, validate) {
  const started = Date.now()
  let response
  let text
  try {
    response = await fetch(base + path, {
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    })
    text = await response.text()
  } catch (error) {
    checks.push({ path, ms: Date.now() - started, ok: false, error: error instanceof Error ? error.message : String(error) })
    throw error
  }
  const ms = Date.now() - started
  let valid = false
  let detail
  try {
    valid = response.ok && validate(response, text)
  } catch (error) {
    detail = error instanceof Error ? error.message : String(error)
  }
  const ok = valid && ms <= slowMs
  const reason = detail ?? (valid ? `${path} took ${ms}ms (limit ${slowMs}ms)` : `${path} returned ${response.status}`)
  checks.push({ path, status: response.status, ms, ok, ...(ok ? {} : { error: reason }) })
  if (!ok) throw new Error(reason)
}

try {
  await probe('/', (response, text) => response.headers.get('content-type')?.includes('text/html') && /<title>Ink<\/title>/.test(text))
  await probe('/api/health', (response, text) => {
    const body = JSON.parse(text)
    return body?.ok === true
  })
  await probe('/api/ready', (response, text) => {
    const body = JSON.parse(text)
    return body?.ok === true && body.checks?.database === true && body.checks?.schema === true && body.checks?.models === true
  })
  await probe('/api/health/errors', (response, text) => {
    const body = JSON.parse(text)
    if (body?.ok !== true) return false
    const errors = Number(body.errors ?? 0)
    if (errors > errorLimit) throw new Error(`${errors} API errors in the last hour (limit ${errorLimit})`)
    return true
  })
  console.log(JSON.stringify({ ok: true, base, slowMs, errorLimit, checks }, null, 2))
} catch (error) {
  console.error(JSON.stringify({ ok: false, base, slowMs, errorLimit, checks, error: error instanceof Error ? error.message : String(error) }, null, 2))
  process.exitCode = 1
}
