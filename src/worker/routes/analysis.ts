// POST /api/analysis/:messageId/result: the browser reports what its sandboxed
// Python runner printed or drew. This route never executes generated code; it
// validates ownership and caps, then persists the run beside the reply.

import { Hono } from 'hono'

import type { AnalysisInfo, AnalysisJob, AnalysisStatus } from '../../shared/types'
import { isUnsafeAnalysisCode } from '../analysis'
import { parseAnalysis } from '../db'
import type { AppContext } from '../env'

export const analysis = new Hono<AppContext>()

type Stored = { info: AnalysisInfo; job?: AnalysisJob }

const cleanText = (value: unknown, max: number) =>
  typeof value === 'string' ? value.replace(/\u0000/g, '').slice(0, max) : undefined

const validJob = (value: unknown): value is AnalysisJob => {
  const job = value as AnalysisJob | null
  return Boolean(
    job &&
      typeof job === 'object' &&
      typeof job.messageId === 'string' &&
      typeof job.question === 'string' &&
      typeof job.code === 'string' &&
      typeof job.datasetId === 'string' &&
      job.code.trim() &&
      job.code.length <= 8_000,
  )
}

function readStored(raw: string | null): Stored | null {
  if (!raw) return null
  const info = parseAnalysis(raw)
  if (!info) return null
  try {
    const parsed = JSON.parse(raw) as { job?: unknown }
    return { info, ...(validJob(parsed.job) ? { job: parsed.job } : {}) }
  } catch {
    return { info }
  }
}

analysis.post('/:messageId/rerun', async (c) => {
  c.header('Cache-Control', 'private, no-store')
  const db = c.get('db')
  const owner = c.get('user').sub
  const messageId = c.req.param('messageId')
  const row = await db
    .prepare(
      `SELECT m.id, ma.content AS analysis
       FROM messages m
       LEFT JOIN message_analysis ma ON ma.message_id = m.id AND ma.owner_sub = m.owner_sub
       WHERE m.owner_sub = ? AND m.id = ? AND m.role = 'assistant'`,
    )
    .bind(owner, messageId)
    .first<{ id: string; analysis: string | null }>()
  if (!row) return c.json({ error: 'not_found', message: 'That reply no longer exists.' }, 404)
  const stored = readStored(row.analysis)
  if (!stored) return c.json({ error: 'not_found', message: 'This analysis has no saved result.' }, 404)
  if (isUnsafeAnalysisCode(stored.info.code)) {
    return c.json({ error: 'unsafe', message: 'This saved program can no longer run.' }, 400)
  }
  const info: AnalysisInfo = {
    ...stored.info,
    status: 'checking',
    stdout: undefined,
    chart: undefined,
    error: undefined,
    reason: undefined,
  }
  const job: AnalysisJob = {
    messageId,
    question: info.question,
    code: info.code,
    datasetId: info.datasetId,
  }
  await db
    .prepare(`UPDATE message_analysis SET content = ? WHERE message_id = ? AND owner_sub = ?`)
    .bind(JSON.stringify({ info, job }), messageId, owner)
    .run()
  return c.json({ done: false, job, analysis: info })
})

analysis.post('/:messageId/result', async (c) => {
  c.header('Cache-Control', 'private, no-store')
  const db = c.get('db')
  const owner = c.get('user').sub
  const messageId = c.req.param('messageId')
  const body = (await c.req.json().catch(() => ({}))) as { result?: Record<string, unknown> }

  const row = await db
    .prepare(
      `SELECT m.id, ma.content AS analysis
       FROM messages m
       LEFT JOIN message_analysis ma ON ma.message_id = m.id AND ma.owner_sub = m.owner_sub
       WHERE m.owner_sub = ? AND m.id = ? AND m.role = 'assistant'`,
    )
    .bind(owner, messageId)
    .first<{ id: string; analysis: string | null }>()
  if (!row) return c.json({ error: 'not_found', message: 'That reply no longer exists.' }, 404)

  const stored = readStored(row.analysis)
  if (!stored?.job) return c.json({ done: true, analysis: stored?.info ?? null })
  if (stored.job.messageId !== messageId) {
    return c.json({ error: 'mismatch', message: 'This analysis belongs to another reply.' }, 409)
  }

  const raw = body.result && typeof body.result === 'object' ? body.result : {}
  const loadError = cleanText(raw.loadError, 300)
  const errorText = cleanText(raw.error, 500) || (raw.ok !== true && !loadError ? 'The Python runner did not complete.' : undefined)
  const stdout = cleanText(raw.stdout, 12_000)?.replace(/[ \t]+\n/g, '\n') || undefined
  const chart = typeof raw.chart === 'string' &&
    /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(raw.chart) &&
    raw.chart.length <= 180_000
    ? raw.chart
    : undefined

  let status: AnalysisStatus
  let reason: string | undefined
  let error: string | undefined
  if (loadError) {
    status = 'failed'
    reason = 'the Python runner could not start'
    error = loadError
  } else if (errorText) {
    status = 'failed'
    reason = 'the Python code failed'
    error = errorText
  } else if (stdout?.trim() || chart) {
    status = 'verified'
  } else {
    status = 'warning'
    reason = 'the code ran but printed no result'
  }

  const info: AnalysisInfo = {
    ...stored.info,
    status,
    ...(stdout ? { stdout } : {}),
    ...(chart ? { chart } : {}),
    ...(error ? { error } : {}),
    ...(reason ? { reason } : {}),
  }
  await db
    .prepare(`UPDATE message_analysis SET content = ? WHERE message_id = ? AND owner_sub = ?`)
    .bind(JSON.stringify({ info }), messageId, owner)
    .run()

  console.log('analysis.result', {
    messageId,
    outcome: status,
    stdout: Boolean(stdout),
    chart: Boolean(chart),
  })
  return c.json({ done: true, analysis: info })
})
