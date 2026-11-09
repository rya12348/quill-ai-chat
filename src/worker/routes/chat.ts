// POST /api/chat: one user turn in, one streamed reply out. The reply is a
// server-sent event stream of ChatEvent JSON (shared/types.ts). The browser
// never talks to the Freebuff API; this route does, with the Worker's key.

import { Hono } from 'hono'
import { streamSSE, type SSEStreamingApi } from 'hono/streaming'

import { ANALYZE_DAILY_LIMIT, BUILD_DAILY_LIMIT, DAILY_MESSAGE_LIMIT, DEFAULT_MODEL, MAX_CONTEXT_MESSAGES, MAX_INSTRUCTIONS_CHARS, MAX_MESSAGE_CHARS, RESEARCH_DAILY_LIMIT, SYSTEM_PROMPT, type ModelId } from '../../shared/config'
import type { AnalysisInfo, AnalysisJob, BuildInfo, CanvasInfo, ChatEvent, Message, ProofInfo, ProofJob, ResearchInfo } from '../../shared/types'
import { AiError, aiConfigured, complete, isModelId, type ChatMessage } from '../ai'
import { AttachmentValidationError, attachmentMeta, loadAttachmentsForMessages, messageWithAttachments, parseAttachments, type StoredAttachment } from '../attachments'
import { buildEnabledFor, isOwner } from '../auth'
import { blendComplete } from '../blend'
import { analysisComplete, parseDataset } from '../analysis'
import { buildComplete, buildEmbed } from '../build'
import { canvasComplete } from '../canvas'
import { kindFor, proofComplete, proofSignature, streamChunks } from '../proof'
import { analysisToday, buildToday, id, mapConversation, mapMessage, now, repliesToday, researchToday, titleFrom, usageToday, utcDay } from '../db'
import { refreshConversationSummary } from '../memory'
import { laneKey, orderLanes, publicComplete, publicLanes, type LaneResult } from '../public-ai'
import { healthRows, recordProviderResult } from '../provider-health'
import { planAndRetrieve } from '../plan'
import { researchComplete } from '../research'
import { findSiteTarget, webProxyPath, webProxyToken } from '../site-proxy'
import { searchConfigured, searchPrompt, shouldSearch, type SearchResult } from '../search'
import type { AppContext } from '../env'

export const chat = new Hono<AppContext>()

type Input = { conversationId?: unknown; content?: unknown; attachments?: unknown; dataset?: unknown; model?: unknown; regenerate?: unknown; strategy?: unknown; reasoning?: unknown; effort?: unknown; projectId?: unknown; clientMessageId?: unknown }

// Replies in flight per user in this isolate (start times, so a slot that was
// never released still expires). A cheap brake on a tab that fires requests
// in parallel; the daily limit and the key's own spend limits are the real
// ceilings.
const inflight = new Map<string, number[]>()
const MAX_INFLIGHT = 2
const INFLIGHT_TTL = 5 * 60_000
// A client-generated user-message id makes an offline retry idempotent: the
// same send can be repeated after a reload without creating a second turn.
const CLIENT_MESSAGE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const inflightCount = (owner: string) => {
  const live = (inflight.get(owner) ?? []).filter((at) => Date.now() - at < INFLIGHT_TTL)
  if (live.length) inflight.set(owner, live)
  else inflight.delete(owner)
  return live.length
}

// A write that does not complete in this long means the reader is gone:
// runtimes do not all report a closed connection, and a blocked write would
// otherwise hold the upstream request (and the credits it spends) open.
const WRITE_TIMEOUT = 10_000

chat.post('/', async (c) => {
  const db = c.get('db')
  const user = c.get('user')
  const owner = user.sub
  const unlimitedBuilds = isOwner(c.env, user, c.req.raw)
  const input = await c.req.json<Input>().catch(() => ({}) as Input)
  let incomingAttachments: StoredAttachment[] = []
  try {
    incomingAttachments = parseAttachments(input.attachments)
  } catch (error) {
    if (error instanceof AttachmentValidationError) return c.json({ error: 'attachment', message: error.message }, 400)
    throw error
  }
  // Which engine answers: the Freebuff API when a key is set, otherwise the free
  // hosted lane. Neither needs a key from the person chatting.
  const usingApi = aiConfigured(c.env)
  const allLanes = usingApi ? [] : publicLanes(c.env)
  // Low skips the extra reasoning pass; Default and Max turn it on at medium
  // and high effort where the lane supports fine-grained control.
  const effort = input.effort === 'low' || input.effort === 'default' || input.effort === 'max' ? input.effort : null
  const wantReasoning = effort ? effort !== 'low' : input.reasoning === true
  // Raw chain-of-thought is an advanced-mode detail. A Fast reply may still let
  // the model reason internally, but nothing is streamed or persisted for it.
  const exposeReasoning = input.strategy !== 'fast'
  const reasoningEffort = effort === 'low' ? 'low' : effort === 'max' ? 'high' : effort === 'default' ? 'medium' : 'high'
  const regenerate = input.regenerate === true
  const attachments = regenerate ? [] : incomingAttachments
  const content = typeof input.content === 'string' ? input.content.replace(/\r\n?/g, '\n').trim() : ''
  if (!regenerate && !content && !attachments.length) return c.json({ error: 'empty', message: 'Write a message or attach a file first.' }, 400)
  if (content.length > MAX_MESSAGE_CHARS) return c.json({ error: 'too_long', message: `Messages can be up to ${MAX_MESSAGE_CHARS.toLocaleString()} characters.` }, 400)
  const clientMessageId = typeof input.clientMessageId === 'string' && CLIENT_MESSAGE_ID.test(input.clientMessageId) ? input.clientMessageId : undefined
  if (input.model !== undefined && !isModelId(input.model) && !allLanes.some((lane) => lane.model === input.model)) {
    return c.json({ error: 'model', message: 'Unknown model.' }, 400)
  }
  if (input.conversationId !== undefined && typeof input.conversationId !== 'string') return c.json({ error: 'conversation', message: 'Invalid conversation.' }, 400)
  let projectId: string | null = null
  if (input.projectId !== undefined) {
    if (input.projectId === null || input.projectId === '') {
      projectId = null
    } else if (typeof input.projectId === 'string') {
      const project = await db.prepare(`SELECT id FROM projects WHERE owner_sub = ? AND id = ?`).bind(owner, input.projectId).first()
      if (!project) return c.json({ error: 'project', message: 'This project no longer exists.' }, 400)
      projectId = input.projectId
    } else {
      return c.json({ error: 'project', message: 'Invalid project.' }, 400)
    }
  }

  if (clientMessageId && !regenerate) {
    const alreadySent = await db.prepare(`SELECT conversation_id FROM messages WHERE owner_sub = ? AND id = ?`).bind(owner, clientMessageId).first<{ conversation_id: string }>()
    if (alreadySent) {
      return c.json({ error: 'duplicate', message: 'This message was already sent.', conversationId: alreadySent.conversation_id }, 409)
    }
  }

  if (inflightCount(owner) >= MAX_INFLIGHT) return c.json({ error: 'busy', message: 'Wait for the current reply to finish.' }, 429)
  const used = await repliesToday(db, owner)
  if (used >= DAILY_MESSAGE_LIMIT) {
    return c.json({ error: 'limit', message: `You have reached today's limit of ${DAILY_MESSAGE_LIMIT} replies.`, resetsAt: utcDay().end }, 429)
  }
  // The conversation: existing, or created from this first message.
  const t = now()
  let conversationRow = input.conversationId
    ? await db
        .prepare(
          `SELECT c.*, pc.project_id FROM conversations c
           LEFT JOIN project_conversations pc ON pc.conversation_id = c.id AND pc.owner_sub = c.owner_sub
           WHERE c.owner_sub = ? AND c.id = ?`,
        )
        .bind(owner, input.conversationId)
        .first<Record<string, unknown>>()
    : null
  if (input.conversationId && !conversationRow) return c.json({ error: 'not_found', message: 'This chat no longer exists.' }, 404)
  if (regenerate && !conversationRow) return c.json({ error: 'conversation', message: 'Nothing to regenerate.' }, 400)
  // An image anywhere in the conversation keeps follow-up turns on a model that
  // can still see it. Without this, a later text question could fail when the
  // history contains image parts.
  const priorImage = conversationRow
    ? await db
        .prepare(`SELECT 1 FROM message_attachments WHERE owner_sub = ? AND conversation_id = ? AND kind = 'image' LIMIT 1`)
        .bind(owner, conversationRow.id)
        .first()
    : null
  const wantsResearch = input.strategy === 'research'
  const wantsAnalysis = input.strategy === 'analyze'
  const wantsBuild = input.strategy === 'build'
  const wantsCanvas = input.strategy === 'canvas'
  const analyzeDataset = wantsAnalysis ? parseDataset(input.dataset) : undefined
  const researchEnabled = !usingApi && (c.env.RESEARCH_ENABLED === '1' || c.env.RESEARCH_ENABLED === 'true')
  const analyzeEnabled = !usingApi && (c.env.ANALYZE_ENABLED === '1' || c.env.ANALYZE_ENABLED === 'true')
  const buildEnabled = !usingApi && buildEnabledFor(c.env, c.req.raw)
  if (wantsResearch && (usingApi || !researchEnabled)) {
    return c.json({ error: 'research_unavailable', message: 'Research is not enabled on this deployment.' }, 503)
  }
  if (wantsResearch && attachments.length) {
    return c.json({ error: 'attachment', message: 'Research is web-only in this version. Ask a text question without attachments.' }, 400)
  }
  if (wantsAnalysis && (usingApi || !analyzeEnabled)) {
    return c.json({ error: 'analyze_unavailable', message: 'Analyze is not enabled on this deployment.' }, 503)
  }
  if (wantsAnalysis) {
    if (regenerate || attachments.length || !analyzeDataset) {
      return c.json({ error: 'attachment', message: 'Analyze needs one CSV, TSV or XLSX dataset. Attach it and ask a question.' }, 400)
    }
  }
  if (wantsBuild && (usingApi || !buildEnabled)) {
    return c.json({ error: 'build_unavailable', message: 'Build is not enabled on this deployment.' }, 503)
  }
  if (wantsBuild && (attachments.length || input.dataset)) {
    return c.json({ error: 'attachment', message: 'Build is text-only in this version. Describe the page without attachments.' }, 400)
  }
  if (wantsCanvas && usingApi) {
    return c.json({ error: 'canvas_unavailable', message: 'Canvas needs the free hosted models.' }, 503)
  }
  if (wantsCanvas && (attachments.length || input.dataset)) {
    return c.json({ error: 'attachment', message: 'Canvas is text-only. Describe the topic without attachments.' }, 400)
  }
  if (wantsCanvas && !regenerate && !content) {
    return c.json({ error: 'empty', message: 'Describe what the flashcards or quiz should cover.' }, 400)
  }
  if (wantsBuild && !regenerate && !content) {
    return c.json({ error: 'empty', message: 'Describe the page you want to build.' }, 400)
  }
  const needsVision = attachments.some((attachment) => attachment.kind === 'image') || Boolean(priorImage)
  const lanes = usingApi ? [] : needsVision && !wantsResearch && !wantsAnalysis ? allLanes.filter((lane) => lane.vision) : allLanes
  if (!usingApi && needsVision && !wantsResearch && !wantsAnalysis && !lanes.length) {
    return c.json({ error: 'vision_unavailable', message: 'No free image-capable model is configured right now. Add an OpenRouter or Gemini key and try again.' }, 503)
  }
  if (wantsResearch && !allLanes.length) {
    return c.json({ error: 'research_unavailable', message: 'No free model lanes are configured for Research.' }, 503)
  }
  const research = wantsResearch
  const analyze = wantsAnalysis
  const build = wantsBuild
  const canvas = wantsCanvas
  if (research) {
    const reports = await researchToday(db, owner)
    if (reports >= RESEARCH_DAILY_LIMIT) {
      return c.json({ error: 'research_limit', message: `You have reached today's limit of ${RESEARCH_DAILY_LIMIT} research reports.`, resetsAt: utcDay().end }, 429)
    }
  }
  if (analyze) {
    const analyses = await analysisToday(db, owner)
    if (analyses >= ANALYZE_DAILY_LIMIT) {
      return c.json({ error: 'analyze_limit', message: `You have reached today's limit of ${ANALYZE_DAILY_LIMIT} analyses.`, resetsAt: utcDay().end }, 429)
    }
  }
  if (build && !unlimitedBuilds) {
    const builds = await buildToday(db, owner)
    if (builds >= BUILD_DAILY_LIMIT) {
      return c.json({ error: 'build_limit', message: `You have reached today's limit of ${BUILD_DAILY_LIMIT} builds.`, resetsAt: utcDay().end }, 429)
    }
  }
  // Blend is the default: two free models draft, one merges. 'team' uses the
  // same free-lane engine with the full independent draft/review/verify pass.
  // 'fast' answers with a single model for people who want the quicker reply.
  // Proof is free-lane only: its checks depend on the lane roster, and the
  // keyed API path has no lanes to write independent tests.
  const proof = !research && !analyze && !build && !canvas && input.strategy === 'proof' && !usingApi && lanes.length > 0
  const blend = !proof && !research && !analyze && !build && !canvas && input.strategy !== 'fast' && lanes.length > 1
  const existingModel = conversationRow?.model
  const model: string = usingApi
    ? isModelId(input.model)
      ? input.model
      : isModelId(existingModel)
        ? existingModel
        : DEFAULT_MODEL
    : (lanes.find((lane) => lane.model === input.model) ?? lanes[0])?.model ?? DEFAULT_MODEL
  const statements: D1PreparedStatement[] = []
  if (!conversationRow) {
    conversationRow = { id: id(), owner_sub: owner, title: titleFrom(content || attachments[0]?.name || ''), model, created_at: t, updated_at: t, project_id: projectId }
    statements.push(
      db.prepare(`INSERT INTO conversations (id, owner_sub, title, model, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`).bind(conversationRow.id, owner, conversationRow.title, model, t, t),
    )
    if (projectId) {
      statements.push(
        db.prepare(`INSERT INTO project_conversations (conversation_id, project_id, owner_sub, updated_at) VALUES (?, ?, ?, ?)`).bind(conversationRow.id, projectId, owner, t),
      )
    }
  } else {
    conversationRow.model = model
    conversationRow.updated_at = t
    statements.push(db.prepare(`UPDATE conversations SET model = ?, updated_at = ? WHERE owner_sub = ? AND id = ?`).bind(model, t, owner, conversationRow.id))
  }
  const conversation = mapConversation(conversationRow)

  // History the model sees, oldest first, bounded.
  const historyRows = (
    await db
      .prepare(`SELECT * FROM messages WHERE owner_sub = ? AND conversation_id = ? ORDER BY created_at DESC LIMIT ?`)
      .bind(owner, conversation.id, MAX_CONTEXT_MESSAGES)
      .all()
  ).results.map((r) => mapMessage(r as Record<string, unknown>)).reverse()
  const historyAttachments = await loadAttachmentsForMessages(db, owner, historyRows.map((message) => message.id))
  const history = historyRows.map((message) => {
    const files = historyAttachments.get(message.id)
    return files?.length ? { ...message, attachments: files.map((attachment) => attachmentMeta(attachment)) } : message
  })

  let userMessage: Message
  if (regenerate) {
    // Drop everything after the last user message and answer it again.
    const lastUser = [...history].reverse().find((m) => m.role === 'user')
    if (!lastUser) return c.json({ error: 'conversation', message: 'Nothing to regenerate.' }, 400)
    userMessage = lastUser
    statements.push(
      db.prepare(`DELETE FROM message_reasoning WHERE owner_sub = ? AND message_id IN (SELECT id FROM messages WHERE owner_sub = ? AND conversation_id = ? AND created_at > ?)`).bind(owner, owner, conversation.id, lastUser.createdAt),
    )
    statements.push(
      db.prepare(`DELETE FROM message_sources WHERE owner_sub = ? AND message_id IN (SELECT id FROM messages WHERE owner_sub = ? AND conversation_id = ? AND created_at > ?)`).bind(owner, owner, conversation.id, lastUser.createdAt),
    )
    statements.push(
      db.prepare(`DELETE FROM message_feedback WHERE owner_sub = ? AND message_id IN (SELECT id FROM messages WHERE owner_sub = ? AND conversation_id = ? AND created_at > ?)`).bind(owner, owner, conversation.id, lastUser.createdAt),
    )
    statements.push(
      db.prepare(`DELETE FROM message_team WHERE owner_sub = ? AND message_id IN (SELECT id FROM messages WHERE owner_sub = ? AND conversation_id = ? AND created_at > ?)`).bind(owner, owner, conversation.id, lastUser.createdAt),
    )
    statements.push(
      db.prepare(`DELETE FROM message_proof WHERE owner_sub = ? AND message_id IN (SELECT id FROM messages WHERE owner_sub = ? AND conversation_id = ? AND created_at > ?)`).bind(owner, owner, conversation.id, lastUser.createdAt),
    )
    statements.push(
      db.prepare(`DELETE FROM message_research WHERE owner_sub = ? AND message_id IN (SELECT id FROM messages WHERE owner_sub = ? AND conversation_id = ? AND created_at > ?)`).bind(owner, owner, conversation.id, lastUser.createdAt),
    )
    statements.push(
      db.prepare(`DELETE FROM message_analysis WHERE owner_sub = ? AND message_id IN (SELECT id FROM messages WHERE owner_sub = ? AND conversation_id = ? AND created_at > ?)`).bind(owner, owner, conversation.id, lastUser.createdAt),
    )
    statements.push(
      db.prepare(`DELETE FROM message_build WHERE owner_sub = ? AND message_id IN (SELECT id FROM messages WHERE owner_sub = ? AND conversation_id = ? AND created_at > ?)`).bind(owner, owner, conversation.id, lastUser.createdAt),
    )
    statements.push(
      db.prepare(`DELETE FROM message_canvas WHERE owner_sub = ? AND message_id IN (SELECT id FROM messages WHERE owner_sub = ? AND conversation_id = ? AND created_at > ?)`).bind(owner, owner, conversation.id, lastUser.createdAt),
    )
    statements.push(
      db.prepare(`DELETE FROM canvas_reviews WHERE owner_sub = ? AND message_id IN (SELECT id FROM messages WHERE owner_sub = ? AND conversation_id = ? AND created_at > ?)`).bind(owner, owner, conversation.id, lastUser.createdAt),
    )
    statements.push(
      db.prepare(`DELETE FROM build_embeds WHERE owner_sub = ? AND message_id IN (SELECT id FROM messages WHERE owner_sub = ? AND conversation_id = ? AND created_at > ?)`).bind(owner, owner, conversation.id, lastUser.createdAt),
    )
    statements.push(db.prepare(`DELETE FROM messages WHERE owner_sub = ? AND conversation_id = ? AND created_at > ?`).bind(owner, conversation.id, lastUser.createdAt))
    history.splice(history.indexOf(lastUser) + 1)
  } else {
    userMessage = {
      id: clientMessageId ?? id(),
      conversationId: conversation.id,
      role: 'user',
      content,
      model: null,
      interrupted: false,
      createdAt: t,
      ...(attachments.length ? { attachments: attachments.map((attachment) => attachmentMeta(attachment)) } : {}),
    }
    statements.push(
      db.prepare(`INSERT INTO messages (id, owner_sub, conversation_id, role, content, model, created_at) VALUES (?, ?, ?, 'user', ?, NULL, ?)`).bind(userMessage.id, owner, conversation.id, content, t),
    )
    for (const [position, attachment] of attachments.entries()) {
      statements.push(
        db
          .prepare(
            `INSERT INTO message_attachments (id, message_id, conversation_id, owner_sub, name, mime, size, kind, data, position, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(attachment.id, userMessage.id, conversation.id, owner, attachment.name, attachment.mime, attachment.size, attachment.kind, attachment.data, position, t),
      )
    }
    if (attachments.length) historyAttachments.set(userMessage.id, attachments)
    history.push(userMessage)
  }
  // The reply's row exists from the start (empty), so it counts toward today's
  // limit while streaming and the app knows its id before the first token.
  const assistantMessageId = id()
  const replyAt = t + 1
  statements.push(
    db.prepare(`INSERT INTO messages (id, owner_sub, conversation_id, role, content, model, created_at) VALUES (?, ?, ?, 'assistant', '', ?, ?)`).bind(assistantMessageId, owner, conversation.id, model, replyAt),
  )
  await db.batch(statements)

  const startedAt = Date.now()
  inflight.set(owner, [...(inflight.get(owner) ?? []), startedAt])
  const release = () => {
    const rest = (inflight.get(owner) ?? []).filter((at) => at !== startedAt)
    if (rest.length) inflight.set(owner, rest)
    else inflight.delete(owner)
  }

  c.header('Cache-Control', 'private, no-store')
  return streamSSE(c, async (stream) => {
    // The whole reply runs under waitUntil: when the reader goes away the
    // runtime drops the request's other work, and this is what stops the
    // upstream request and records what arrived. It is registered before
    // the first byte is sent.
    const work = generate(stream)
    c.executionCtx.waitUntil(work)
    await work
  })

  async function generate(stream: SSEStreamingApi) {
    const controller = new AbortController()
    let text = ''
    let reasoning = ''
    let reasoningStartedAt: number | undefined
    let reasoningMs: number | undefined
    let results: SearchResult[] = []
    let proofInfo: ProofInfo | undefined
    let researchInfo: ResearchInfo | undefined
    let analysisInfo: AnalysisInfo | undefined
    let analysisJob: AnalysisJob | undefined
    let buildInfo: BuildInfo | undefined
    let canvasInfo: CanvasInfo | undefined
    let embedToken: string | undefined
    let embedUrl: string | undefined
    let proofJob: ProofJob | undefined
    let gone = false
    // Health writes are awaited before the turn ends: a fire-and-forget write
    // can be dropped when the stream closes, and a reload would then show the
    // previous status even though this send just succeeded.
    const healthWrites: Promise<unknown>[] = []
    // Resolves false once the reader has stopped taking data: the runtime
    // cancelled the stream, or a write sat unanswered for WRITE_TIMEOUT.
    const send = (event: ChatEvent) => {
      let timer: ReturnType<typeof setTimeout> | undefined
      return Promise.race([
        stream.writeSSE({ data: JSON.stringify(event) }).then(() => !stream.aborted),
        new Promise<boolean>((resolve) => {
          timer = setTimeout(() => resolve(false), WRITE_TIMEOUT)
        }),
      ]).finally(() => clearTimeout(timer))
    }
    const save = async (interrupted: boolean) => {
      const statements = [
        db.prepare(`UPDATE messages SET content = ?, interrupted = ? WHERE owner_sub = ? AND id = ?`).bind(text, interrupted ? 1 : 0, owner, assistantMessageId),
      ]
      if (reasoning.trim()) {
        statements.push(
          db.prepare(`INSERT OR REPLACE INTO message_reasoning (message_id, owner_sub, content, duration_ms, created_at) VALUES (?, ?, ?, ?, ?)`).bind(assistantMessageId, owner, reasoning, reasoningMs ?? null, replyAt),
        )
      }
      if (results.length) {
        statements.push(
          db.prepare(`INSERT OR REPLACE INTO message_sources (message_id, owner_sub, content, created_at) VALUES (?, ?, ?, ?)`).bind(assistantMessageId, owner, JSON.stringify(results), replyAt),
        )
      }
      if (analysisInfo) {
        statements.push(
          db.prepare(`INSERT OR REPLACE INTO message_analysis (message_id, owner_sub, content, created_at) VALUES (?, ?, ?, ?)`).bind(
            assistantMessageId,
            owner,
            JSON.stringify({ info: analysisInfo, ...(analysisJob ? { job: analysisJob } : {}) }),
            replyAt,
          ),
        )
      }
      if (buildInfo) {
        statements.push(
          db.prepare(`INSERT OR REPLACE INTO message_build (message_id, owner_sub, content, created_at) VALUES (?, ?, ?, ?)`).bind(
            assistantMessageId,
            owner,
            JSON.stringify({ info: buildInfo }),
            replyAt,
          ),
        )
        if (embedToken && embedUrl) {
          statements.push(
            db.prepare(`INSERT OR REPLACE INTO build_embeds (token, message_id, owner_sub, url, created_at) VALUES (?, ?, ?, ?, ?)`).bind(
              embedToken,
              assistantMessageId,
              owner,
              embedUrl,
              replyAt,
            ),
          )
        }
      }
      if (canvasInfo) {
        statements.push(
          db.prepare(`INSERT OR REPLACE INTO message_canvas (message_id, owner_sub, content, created_at) VALUES (?, ?, ?, ?)`).bind(
            assistantMessageId,
            owner,
            JSON.stringify({ info: canvasInfo }),
            replyAt,
          ),
        )
      }
      if (researchInfo) {
        statements.push(
          db.prepare(`INSERT OR REPLACE INTO message_research (message_id, owner_sub, content, created_at) VALUES (?, ?, ?, ?)`).bind(
            assistantMessageId,
            owner,
            JSON.stringify({ info: researchInfo }),
            replyAt,
          ),
        )
        if (!interrupted) {
          statements.push(
            db
              .prepare(
                `INSERT INTO research_runs (id, owner_sub, outcome, sources, supported, single_source, unsupported, latency_ms, models, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              )
              .bind(
                id(),
                owner,
                researchInfo.status,
                researchInfo.counts.sources,
                researchInfo.counts.supported,
                researchInfo.counts.singleSource,
                researchInfo.counts.unsupported,
                Date.now() - startedAt,
                JSON.stringify(researchInfo.models),
                now(),
              ),
          )
        }
      }
      if (proofInfo) {
        statements.push(
          db.prepare(`INSERT OR REPLACE INTO message_proof (message_id, owner_sub, content, created_at) VALUES (?, ?, ?, ?)`).bind(
            assistantMessageId,
            owner,
            JSON.stringify({ info: proofInfo, ...(proofJob ? { job: proofJob } : {}) }),
            replyAt,
          ),
        )
        if (!interrupted) {
          statements.push(
            db
              .prepare(
                `INSERT INTO proof_runs (id, owner_sub, kind, outcome, models, checks, mutants_killed, mutants_total, attempts, latency_ms, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              )
              .bind(
                id(),
                owner,
                proofInfo.kind,
                proofInfo.status,
                JSON.stringify(proofInfo.models),
                JSON.stringify(proofInfo.checks.map((item) => ({ id: item.id, status: item.status }))),
                proofInfo.mutants?.killed ?? 0,
                proofInfo.mutants?.total ?? 0,
                proofInfo.attempts,
                Date.now() - startedAt,
                now(),
              ),
          )
          if (proofInfo.status === 'verified') {
            statements.push(
              db
                .prepare(
                  `INSERT INTO proof_library (id, owner_sub, signature, kind, content, successes, failures, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, 1, 0, ?, ?)`,
                )
                .bind(id(), owner, proofSignature(userMessage.content), proofInfo.kind, text.slice(0, 4_000), now(), now()),
            )
          }
        }
      }
      await db.batch(statements)
    }
    const discard = () =>
      db.batch([
        db.prepare(`DELETE FROM message_reasoning WHERE owner_sub = ? AND message_id = ?`).bind(owner, assistantMessageId),
        db.prepare(`DELETE FROM message_sources WHERE owner_sub = ? AND message_id = ?`).bind(owner, assistantMessageId),
        db.prepare(`DELETE FROM message_team WHERE owner_sub = ? AND message_id = ?`).bind(owner, assistantMessageId),
        db.prepare(`DELETE FROM message_proof WHERE owner_sub = ? AND message_id = ?`).bind(owner, assistantMessageId),
        db.prepare(`DELETE FROM message_research WHERE owner_sub = ? AND message_id = ?`).bind(owner, assistantMessageId),
        db.prepare(`DELETE FROM message_analysis WHERE owner_sub = ? AND message_id = ?`).bind(owner, assistantMessageId),
        db.prepare(`DELETE FROM message_build WHERE owner_sub = ? AND message_id = ?`).bind(owner, assistantMessageId),
        db.prepare(`DELETE FROM message_canvas WHERE owner_sub = ? AND message_id = ?`).bind(owner, assistantMessageId),
        db.prepare(`DELETE FROM canvas_reviews WHERE owner_sub = ? AND message_id = ?`).bind(owner, assistantMessageId),
        db.prepare(`DELETE FROM build_embeds WHERE owner_sub = ? AND message_id = ?`).bind(owner, assistantMessageId),
        db.prepare(`DELETE FROM messages WHERE owner_sub = ? AND id = ?`).bind(owner, assistantMessageId),
      ])
    // The user stopped or left: stop upstream, keep what arrived (or nothing).
    const abandon = async () => {
      if (gone) return
      gone = true
      controller.abort()
      await (text ? save(true) : discard())
    }
    stream.onAbort(() => void abandon())

    try {
      if (!(await send({ type: 'start', conversation, userMessage, assistantMessageId }))) return await abandon()
      // Every lane call updates provider health, so a failure recorded here is
      // what the next page load shows and what the backoff respects.
      const recordLane = (result: LaneResult) => {
        healthWrites.push(recordProviderResult(db, owner, laneKey(result.lane), result).catch(() => {}))
      }
      // Search after `start`, so the reader sees the plan while results load.
      // Planning is bounded and optional: a slow or broken search still leaves
      // the reply to stream, with a notice instead of an error.
      if (!research && !analyze && !build && !canvas && searchConfigured(c.env) && shouldSearch(userMessage.content)) {
        const retrieval = await planAndRetrieve({
          env: c.env,
          model: model as ModelId,
          usingApi,
          lanes,
          question: userMessage.content,
          signal: controller.signal,
          onLaneResult: recordLane,
          onStatus: (text) => send({ type: 'status', text }),
        })
        results = retrieval.results
        if (retrieval.queries.length) console.log('search.plan', { queries: retrieval.queries, results: results.length, notice: retrieval.notice })
        if (retrieval.notice && !(await send({ type: 'notice', text: retrieval.notice }))) return await abandon()
      }
      if (!research && results.length && !(await send({ type: 'sources', sources: results }))) return await abandon()
      const settings = await db.prepare(`SELECT instructions FROM user_settings WHERE owner_sub = ?`).bind(owner).first<{ instructions?: string }>()
      const customInstructions = typeof settings?.instructions === 'string' ? settings.instructions.trim().slice(0, MAX_INSTRUCTIONS_CHARS) : ''
      // A chat can belong to one project; that project's instructions refine
      // every reply in it without changing the account-wide settings.
      const projectSettings = await db
        .prepare(
          `SELECT ps.instructions FROM project_conversations pc
           JOIN project_settings ps ON ps.project_id = pc.project_id AND ps.owner_sub = pc.owner_sub
           WHERE pc.owner_sub = ? AND pc.conversation_id = ?`,
        )
        .bind(owner, conversation.id)
        .first<{ instructions?: string }>()
      const projectInstructions =
        typeof projectSettings?.instructions === 'string'
          ? projectSettings.instructions.trim().slice(0, MAX_INSTRUCTIONS_CHARS)
          : ''

      // Keep the newest turns verbatim. Anything older is folded into the
      // persisted rolling memory, but only when it has just fallen outside the
      // verbatim window; an already-covered span is not summarized again.
      const recent = history.slice(-MAX_CONTEXT_MESSAGES)
      let memory = ''
      const oldestRecentAt = recent[0]?.createdAt
      if (oldestRecentAt !== undefined) {
        const saved = await db
          .prepare(`SELECT summary, covered_through FROM conversation_summaries WHERE owner_sub = ? AND conversation_id = ?`)
          .bind(owner, conversation.id)
          .first<{ summary: string; covered_through: number }>()
        memory = saved?.summary?.trim() ?? ''
        const uncovered = await db
          .prepare(
            `SELECT * FROM messages
             WHERE owner_sub = ? AND conversation_id = ? AND created_at < ? AND created_at > ?
               AND NOT (role = 'assistant' AND content = '')
             ORDER BY created_at ASC`,
          )
          .bind(owner, conversation.id, oldestRecentAt, Number(saved?.covered_through ?? 0))
          .all()
        if (uncovered.results.length) {
          if (!(await send({ type: 'status', text: 'Recalling earlier context…' }))) return await abandon()
          const condensed = await refreshConversationSummary({
            env: c.env,
            model,
            existingSummary: memory,
            messages: (uncovered.results as Record<string, unknown>[]).map(mapMessage),
            signal: controller.signal,
          })
          if (condensed) {
            memory = condensed
            const last = uncovered.results[uncovered.results.length - 1] as Record<string, unknown>
            await db
              .prepare(
                `INSERT INTO conversation_summaries (conversation_id, owner_sub, summary, covered_through, updated_at)
                 VALUES (?, ?, ?, ?, ?)
                 ON CONFLICT(conversation_id) DO UPDATE SET
                   summary = excluded.summary,
                   covered_through = excluded.covered_through,
                   updated_at = excluded.updated_at`,
              )
              .bind(conversation.id, owner, condensed, Number(last.created_at), Date.now())
              .run()
            console.log('memory.summary.updated', { conversationId: conversation.id, messages: uncovered.results.length, chars: condensed.length })
          }
        }
      }

      const system = [
        `Today is ${new Date().toISOString().slice(0, 10)} (UTC). Treat this as the current date; use it when deciding whether a fact is current, and prefer recent sources over older ones.`,
        SYSTEM_PROMPT,
        customInstructions ? `Standing instructions from the person you are helping:\n${customInstructions}` : '',
        projectInstructions ? `Instructions for this project (they refine, but never override, a safety rule or the request itself):\n${projectInstructions}` : '',
        memory ? `Rolling memory from earlier in this conversation. Use it for details that are no longer in the recent messages. Do not mention the memory or say that earlier context was condensed:\n${memory}` : '',
        searchPrompt(results),
      ]
        .filter(Boolean)
        .join('\n\n')
      const prompt: ChatMessage[] = [
        { role: 'system', content: system },
        ...recent.map((message) => messageWithAttachments(message, historyAttachments.get(message.id) ?? [])),
      ]
      // A configured key means the Freebuff API; otherwise the free hosted
      // models answer, blended when more than one is available.
      // Persisted provider health keeps a lane that just refused its key out of
      // the referee chair; the full list is still used as a fallback chain.
      let avoid: Set<string> | undefined
      if (!usingApi && blend) {
        const unhealthy = await db
          .prepare(`SELECT provider_id FROM provider_health WHERE owner_sub = ? AND status IN ('degraded', 'down')`)
          .bind(owner)
          .all<{ provider_id: string }>()
        avoid = new Set(unhealthy.results.map((row) => row.provider_id))
      }
      if (analyze) {
        const outcome = await analysisComplete({
          lanes: orderLanes(lanes, model),
          question: userMessage.content || 'Analyze this CSV.',
          dataset: analyzeDataset!,
          signal: controller.signal,
          onStatus: (status) => { void send({ type: 'status', text: status }) },
          onLaneResult: recordLane,
        })
        if (gone) return
        analysisInfo = {
          status: 'checking',
          question: userMessage.content || 'Analyze this CSV.',
          datasetId: analyzeDataset!.id,
          fileName: analyzeDataset!.name,
          code: outcome.code,
          rows: analyzeDataset!.rows,
          columns: analyzeDataset!.columns,
          models: [outcome.model],
          asOf: Date.now(),
        }
        analysisJob = { messageId: assistantMessageId, question: analysisInfo.question, code: outcome.code, datasetId: analyzeDataset!.id }
        for await (const piece of streamChunks(outcome.text, controller.signal)) {
          if (gone) return
          text += piece.text
          if (!(await send({ type: 'delta', text: piece.text }))) return await abandon()
        }
        if (!(await send({ type: 'analysis', analysis: analysisInfo, job: analysisJob }))) return await abandon()
      } else if (build) {
        const target = findSiteTarget(userMessage.content)
        if (target) embedToken = webProxyToken()
        // A follow-up in a Build chat edits the previous page instead of
        // replacing it with an unrelated design. Embeds have no editable
        // document, so only page builds qualify.
        let previous: BuildInfo | undefined
        if (!target) {
          const rows = await db
            .prepare(
              `SELECT mb.content FROM message_build mb
               JOIN messages m ON m.id = mb.message_id AND m.owner_sub = mb.owner_sub
               WHERE mb.owner_sub = ? AND m.conversation_id = ? AND m.role = 'assistant' AND m.created_at < ?
               ORDER BY m.created_at DESC LIMIT 5`,
            )
            .bind(owner, conversation.id, replyAt)
            .all<{ content: string }>()
          for (const candidate of rows.results) {
            try {
              const info = (JSON.parse(candidate.content) as { info?: BuildInfo }).info
              if (info && info.kind !== 'embed' && info.html) {
                previous = info
                break
              }
            } catch {
              /* an older or malformed row must not block a new build */
            }
          }
        }
        const outcome = target
          ? await buildEmbed({
              target,
              proxyPath: webProxyPath(embedToken!),
              signal: controller.signal,
              onStatus: (status) => { void send({ type: 'status', text: status }) },
            })
          : await buildComplete({
              lanes: orderLanes(lanes, model),
              health: new Map((await healthRows(db, owner)).map((row) => [row.provider_id, row.status])),
              question: userMessage.content,
              signal: controller.signal,
              onStatus: (status) => { void send({ type: 'status', text: status }) },
              onLaneResult: recordLane,
              previous,
            })
        if (gone) return
        buildInfo = outcome.build
        if (buildInfo.kind === 'embed') embedUrl = buildInfo.sourceUrl
        for await (const piece of streamChunks(outcome.text, controller.signal)) {
          if (gone) return
          text += piece.text
          if (!(await send({ type: 'delta', text: piece.text }))) return await abandon()
        }
        if (!(await send({ type: 'build', build: buildInfo }))) return await abandon()
      } else if (canvas) {
        const outcome = await canvasComplete({
          lanes: orderLanes(lanes, model),
          question: userMessage.content,
          signal: controller.signal,
          onStatus: (status) => { void send({ type: 'status', text: status }) },
          onLaneResult: recordLane,
        })
        if (gone) return
        canvasInfo = outcome.canvas
        for await (const piece of streamChunks(outcome.text, controller.signal)) {
          if (gone) return
          text += piece.text
          if (!(await send({ type: 'delta', text: piece.text }))) return await abandon()
        }
        if (!(await send({ type: 'canvas', canvas: canvasInfo }))) return await abandon()
      } else if (research) {
        const outcome = await researchComplete({
          lanes: orderLanes(lanes, model),
          owner,
          model,
          question: userMessage.content,
          signal: controller.signal,
          env: c.env,
          onStatus: (status) => { void send({ type: 'status', text: status }) },
          onLaneResult: recordLane,
        })
        if (gone) return
        results = outcome.sources
        researchInfo = outcome.research
        if (results.length && !(await send({ type: 'sources', sources: results }))) return await abandon()
        if (!(await send({ type: 'research', research: researchInfo }))) return await abandon()
        for await (const piece of streamChunks(outcome.text, controller.signal)) {
          if (gone) return
          text += piece.text
          if (!(await send({ type: 'delta', text: piece.text }))) return await abandon()
        }
      } else if (proof) {
        // Verified artifacts are per-owner. A read failure only skips the
        // exemplar; it never blocks the answer or the checks.
        let library: string[] = []
        try {
          const rows = await db
            .prepare(`SELECT content FROM proof_library WHERE owner_sub = ? AND kind = ? ORDER BY updated_at DESC LIMIT 8`)
            .bind(owner, kindFor(userMessage.content))
            .all<{ content: string }>()
          library = rows.results.map((row) => row.content)
        } catch {
          library = []
        }
        const outcome = await proofComplete({
          lanes: orderLanes(lanes, model),
          messages: prompt,
          question: userMessage.content,
          results,
          signal: controller.signal,
          library,
          onStatus: (status) => send({ type: 'status', text: status }),
          onLaneResult: recordLane,
        })
        if (gone) return
        if (!outcome.text.trim()) throw new AiError('unavailable', 'Proof could not get an answer from a free model. Try again.', 503)
        proofInfo = outcome.proof
        proofJob = outcome.job ? { ...outcome.job, messageId: assistantMessageId } : undefined
        if (!(await send({ type: 'proof', proof: proofInfo, ...(proofJob ? { job: proofJob } : {}) }))) return await abandon()
        for await (const piece of streamChunks(outcome.text, controller.signal)) {
          if (gone) return
          text += piece.text
          if (!(await send({ type: 'delta', text: piece.text }))) return await abandon()
        }
      } else {
        const pieces = usingApi
          ? complete(c.env, { model: model as ModelId, messages: prompt, signal: controller.signal })
          : blend
            ? blendComplete(orderLanes(lanes, model), {
                messages: prompt,
                signal: controller.signal,
                reasoning: wantReasoning,
                reasoningEffort,
                team: input.strategy === 'team',
                onTeam: (team) => send({ type: 'team', team }),
                avoid,
                onStatus: (text) => send({ type: 'status', text }),
                onLaneResult: recordLane,
              })
            : publicComplete(orderLanes(lanes, model), { messages: prompt, signal: controller.signal, reasoning: wantReasoning, reasoningEffort, onLaneResult: recordLane })
        for await (const piece of pieces) {
          if (gone) return
          if (piece.type === 'reasoning') {
            if (!exposeReasoning) continue
            reasoningStartedAt ??= Date.now()
            reasoning += piece.text
            if (!(await send({ type: 'reasoning', text: piece.text }))) return await abandon()
            continue
          }
          if (reasoningStartedAt !== undefined && reasoningMs === undefined) reasoningMs = Date.now() - reasoningStartedAt
          text += piece.text
          if (!(await send({ type: 'delta', text: piece.text }))) return await abandon()
        }
      }
      if (gone) return
      if (reasoning && reasoningMs === undefined) reasoningMs = Date.now() - (reasoningStartedAt ?? startedAt)
      await save(false)
      // The keyed API path has no lane callbacks; record and await its health
      // before `done`, so a reload immediately after sees the same state.
      if (usingApi) {
        await recordProviderResult(db, owner, 'freebuff-api', { ok: true, latencyMs: Date.now() - startedAt }).catch(() => {})
      }        await Promise.allSettled(healthWrites.splice(0))
      console.log('chat.done', { model, ms: Date.now() - startedAt, reasoningMs, chars: text.length, sources: results.length, research: researchInfo?.status, analysis: analysisInfo?.status, build: buildInfo?.status })
      const message: Message = {
        id: assistantMessageId,
        conversationId: conversation.id,
        role: 'assistant',
        content: text,
        model,
        interrupted: false,
        createdAt: replyAt,
        reasoning: reasoning || undefined,
        reasoningMs: reasoning ? reasoningMs : undefined,
        sources: results.length ? results : undefined,
        ...(proofInfo ? { proof: proofInfo } : {}),
        ...(researchInfo ? { research: researchInfo } : {}),
        ...(analysisInfo ? { analysis: analysisInfo } : {}),
        ...(buildInfo ? { build: buildInfo } : {}),
        ...(canvasInfo ? { canvas: canvasInfo } : {}),
      }
      // The mode counters are read after save(), so the reply just finished is
      // already counted and the composer shows the new allowances immediately.
      // One statement: the D1 session rejects several statements per request.
      const counts = await usageToday(db, owner)
      await send({
        type: 'done',
        message,
        usage: {
          used: used + 1,
          limit: DAILY_MESSAGE_LIMIT,
          resetsAt: utcDay().end,
          modes: {
            research: { used: counts.research, limit: RESEARCH_DAILY_LIMIT },
            analyze: { used: counts.analyze, limit: ANALYZE_DAILY_LIMIT },
            build: { used: counts.build, limit: BUILD_DAILY_LIMIT, ...(unlimitedBuilds ? { unlimited: true } : {}) },
          },
        },
      })
    } catch (error) {
      if (gone) return
      const failure = error instanceof AiError ? error : new AiError('unavailable', 'Something went wrong. Try again.', 502)
      if (usingApi) {
        await recordProviderResult(db, owner, 'freebuff-api', { ok: false, code: failure.code, message: failure.message, latencyMs: Date.now() - startedAt }).catch(() => {})
      }
      if (!(error instanceof AiError)) console.error(error)
      await (text ? save(true) : discard())
      await send({ type: 'error', code: failure.code, message: failure.message })
    } finally {
      await Promise.allSettled(healthWrites.splice(0))
      release()
    }
  }
})
