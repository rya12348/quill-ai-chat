// POST /api/proof/:messageId/result: the browser reports what its sandboxed
// runner executed. This route never executes code. It validates ownership and
// payload size, applies the verdict, picks the passing candidate, and asks for
// at most one repair round.

import { Hono } from 'hono'

import type { ProofInfo, ProofJob } from '../../shared/types'
import { id, now } from '../db'
import type { AppContext } from '../env'
import { judgeReport, proofSignature, repairCode, sanitizeReport } from '../proof'
import { laneKey, orderLanes, publicLanes, type LaneResult } from '../public-ai'
import { recordProviderResult } from '../provider-health'

export const proof = new Hono<AppContext>()

type Stored = { info: ProofInfo; job?: ProofJob }

const isInfo = (value: unknown): value is ProofInfo => {
  const row = value as ProofInfo | null
  return Boolean(
    row &&
      typeof row === 'object' &&
      ['checking', 'verified', 'warning', 'failed', 'unverified'].includes(row.status) &&
      ['code', 'math', 'research', 'structured', 'general'].includes(row.kind) &&
      Array.isArray(row.checks),
  )
}

const isJob = (value: unknown): value is ProofJob => {
  const job = value as ProofJob | null
  return Boolean(
    job &&
      typeof job === 'object' &&
      typeof job.messageId === 'string' &&
      typeof job.question === 'string' &&
      typeof job.tests === 'string' &&
      Number.isFinite(job.round) &&
      Array.isArray(job.models) &&
      Array.isArray(job.mutants) &&
      job.mutants.every((mutant) => typeof mutant === 'string') &&
      Array.isArray(job.candidates) &&
      job.candidates.length > 0 &&
      job.candidates.every(
        (candidate) => candidate && typeof candidate.label === 'string' && typeof candidate.code === 'string' && typeof candidate.text === 'string',
      ),
  )
}

function parseStored(value: unknown): Stored | null {
  if (typeof value !== 'string' || !value) return null
  try {
    const parsed = JSON.parse(value) as { info?: unknown; job?: unknown }
    if (!isInfo(parsed.info)) return null
    return { info: parsed.info, ...(isJob(parsed.job) ? { job: parsed.job } : {}) }
  } catch {
    return null
  }
}

proof.post('/:messageId/result', async (c) => {
  c.header('Cache-Control', 'private, no-store')
  const db = c.get('db')
  const owner = c.get('user').sub
  const messageId = c.req.param('messageId')
  const body = (await c.req.json().catch(() => ({}))) as { round?: unknown; report?: unknown }

  const row = await db
    .prepare(
      `SELECT m.id, m.content, mp.content AS proof
       FROM messages m
       LEFT JOIN message_proof mp ON mp.message_id = m.id AND mp.owner_sub = m.owner_sub
       WHERE m.owner_sub = ? AND m.id = ? AND m.role = 'assistant'`,
    )
    .bind(owner, messageId)
    .first<{ id: string; content: string; proof: string | null }>()
  if (!row) return c.json({ error: 'not_found', message: 'That reply no longer exists.' }, 404)
  const stored = parseStored(row.proof)
  if (!stored?.job) return c.json({ done: true, proof: stored?.info ?? null })
  const job = stored.job
  if (job.messageId !== messageId) return c.json({ error: 'mismatch', message: 'This check belongs to another reply.' }, 409)
  // The round makes a replayed or concurrent post harmless: only the job the
  // browser was actually given can be judged.
  if (body.round !== job.round) {
    console.log('proof.stale', { messageId, sent: String(body.round), expected: job.round })
    return c.json({ error: 'stale', message: 'That check has already moved on.' }, 409)
  }
  if (job.round > 2) return c.json({ done: true, proof: stored.info })

  const report = sanitizeReport(body.report)
  const judged = judgeReport(job, report)
  let info = judged.info
  let content = row.content
  let next: ProofJob | undefined

  if (!report.loadError && judged.suiteTrusted) {
    if (judged.passing.length) {
      // Present the artifact that passed, not a merge of candidates.
      content = job.candidates[judged.passing[0]!]!.text
    } else if (job.round < 2) {
      const failures = report.runs
        .filter((run) => run.target === 'candidate' && !run.ok && run.error)
        .map((run) => run.error!)
      const repaired = await repairCode({
        lanes: orderLanes(publicLanes(c.env)),
        question: job.question,
        candidate: job.candidates[0]!.text,
        failures,
        signal: c.req.raw.signal,
        onLaneResult: (result: LaneResult) => {
          void recordProviderResult(db, owner, laneKey(result.lane), result).catch(() => {})
        },
      })
      if (repaired) {
        next = {
          ...job,
          round: job.round + 1,
          candidates: [{ label: 'Repaired candidate', code: repaired.code, text: repaired.text }],
          models: [...new Set([...job.models, 'Repair pass'])],
        }
        content = row.content
        info = {
          ...judged.info,
          status: 'checking',
          reason: undefined,
          checks: judged.info.checks.map((item) => ({ ...item, status: 'unknown', detail: 'Waiting for the repaired program to run.' })),
        }
      }
    }
  }

  const done = !next
  const statements = [
    db.prepare(`UPDATE messages SET content = ? WHERE owner_sub = ? AND id = ?`).bind(content, owner, messageId),
    db
      .prepare(`INSERT OR REPLACE INTO message_proof (message_id, owner_sub, content, created_at) VALUES (?, ?, ?, ?)`)
      .bind(messageId, owner, JSON.stringify({ info, ...(next ? { job: next } : {}) }), now()),
  ]

  if (done) {
    statements.push(
      db
        .prepare(
          `INSERT INTO proof_runs (id, owner_sub, kind, outcome, models, checks, mutants_killed, mutants_total, attempts, latency_ms, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          id(),
          owner,
          info.kind,
          info.status,
          JSON.stringify(info.models),
          JSON.stringify(info.checks.map((item) => ({ id: item.id, status: item.status }))),
          info.mutants?.killed ?? 0,
          info.mutants?.total ?? 0,
          info.attempts,
          0,
          now(),
        ),
    )
    if (info.status === 'verified') {
      statements.push(
        db
          .prepare(
            `INSERT INTO proof_library (id, owner_sub, signature, kind, content, successes, failures, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, 1, 0, ?, ?)`,
          )
          .bind(id(), owner, proofSignature(job.question), info.kind, content.slice(0, 4_000), now(), now()),
      )
    }
    console.log('proof.result', { messageId, outcome: info.status, killed: info.mutants?.killed, total: info.mutants?.total, round: job.round })
  }

  await db.batch(statements)
  return c.json({ done, proof: info, ...(next ? { job: next } : {}) })
})
