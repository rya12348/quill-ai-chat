import { Hono } from 'hono'

import { ANALYZE_DAILY_LIMIT, BUILD_DAILY_LIMIT, DAILY_MESSAGE_LIMIT, MODELS, RESEARCH_DAILY_LIMIT } from '../../shared/config'
import type { Me, ModelInfo } from '../../shared/types'
import { aiConfigured, availableModels } from '../ai'
import { analyzeEnabledFor, authMode, buildEnabledFor, isOwner, privateJson, researchEnabledFor } from '../auth'
import { now, utcDay, usageToday } from '../db'
import type { AppContext } from '../env'
import { pickPickerFamilies, publicLanes } from '../public-ai'
import { healthRows } from '../provider-health'
import { searchConfigured } from '../search'
import { seedStatements } from '../seed'

export const account = new Hono<AppContext>()

account.get('/me', async (c) => {
  const user = c.get('user')
  const db = c.get('db')
  const mode = authMode(c.env, c.req.raw)
  const unlimitedBuilds = isOwner(c.env, user, c.req.raw)
  const known = await db.prepare(`SELECT 1 FROM users WHERE owner_sub = ?`).bind(user.sub).first()
  if (!known) {
    const statements = [db.prepare(`INSERT INTO users (owner_sub, created_at) VALUES (?, ?)`).bind(user.sub, now())]
    // Only the development identity gets a sample conversation.
    if (mode === 'development') statements.push(...seedStatements(db, user.sub))
    await db.batch(statements)
  }
  const lanes = aiConfigured(c.env) ? [] : publicLanes(c.env)
  const counts = await usageToday(db, user.sub)
  const body: Me = {
    user: { sub: user.sub, name: user.name, email: user.email, picture: user.picture },
    capabilities: {
      ai: true,
      mode: aiConfigured(c.env) ? 'api' : 'public',
      model: lanes[0]?.label,
      search: searchConfigured(c.env),
      // The free chain can expose reasoning when a lane supports it.
      reasoning: lanes.length > 1,
      research: !aiConfigured(c.env) && researchEnabledFor(c.env, c.req.raw),
      analyze: !aiConfigured(c.env) && analyzeEnabledFor(c.env, c.req.raw),
      build: !aiConfigured(c.env) && buildEnabledFor(c.env, c.req.raw),
      // Canvas uses one free-lane completion, so it needs no extra flag.
      canvas: !aiConfigured(c.env),
      // Agent orchestrates the free-mode engines, so it needs at least one lane.
      agent: !aiConfigured(c.env) && lanes.length > 0,
      database: true,
      auth: mode === 'freebuff' ? 'freebuff' : 'development',
    },
    usage: {
      used: counts.replies,
      limit: DAILY_MESSAGE_LIMIT,
      resetsAt: utcDay().end,
      modes: {
        research: { used: counts.research, limit: RESEARCH_DAILY_LIMIT },
        analyze: { used: counts.analyze, limit: ANALYZE_DAILY_LIMIT },
        build: { used: counts.build, limit: BUILD_DAILY_LIMIT, ...(unlimitedBuilds ? { unlimited: true } : {}) },
      },
    },
  }
  return privateJson(c, body)
})

account.get('/models', async (c) => {
  if (aiConfigured(c.env)) {
    const offered = await availableModels(c.env)
    const items: ModelInfo[] = MODELS.map((model) => ({
      id: model.id,
      name: model.name,
      description: model.description,
      available: offered ? offered.has(model.id) : true,
    }))
    c.header('Cache-Control', 'private, max-age=60')
    return c.json({ items })
  }
  // No key: five rows, one per model family, named just "Nemotron", "GPT" and
  // so on. Each family is represented by its best currently working lane —
  // healthy before merely strong — so the picker stays short and the site
  // chooses the variant instead of making people compare provider suffixes.
  let statuses = new Map<string, string>()
  try {
    statuses = new Map((await healthRows(c.get('db'), c.get('user').sub)).map((row) => [row.provider_id, row.status]))
  } catch {
    // A fresh deployment has no health rows yet; strength alone still works.
  }
  const items: ModelInfo[] = pickPickerFamilies(publicLanes(c.env), statuses).map(({ family, lane }) => ({
    id: lane.model,
    name: family,
    description: lane.description,
    available: true,
    family,
  }))
  c.header('Cache-Control', 'private, no-store')
  return c.json({ items })
})

account.delete('/account/conversations', async (c) => {
  const db = c.get('db')
  const owner = c.get('user').sub
  await db.batch([
    db.prepare(`DELETE FROM message_reasoning WHERE owner_sub = ?`).bind(owner),
    db.prepare(`DELETE FROM message_sources WHERE owner_sub = ?`).bind(owner),
    db.prepare(`DELETE FROM message_feedback WHERE owner_sub = ?`).bind(owner),
    db.prepare(`DELETE FROM message_team WHERE owner_sub = ?`).bind(owner),
    db.prepare(`DELETE FROM message_lane_routes WHERE owner_sub = ?`).bind(owner),
    db.prepare(`DELETE FROM message_proof WHERE owner_sub = ?`).bind(owner),
    db.prepare(`DELETE FROM message_research WHERE owner_sub = ?`).bind(owner),
    db.prepare(`DELETE FROM message_analysis WHERE owner_sub = ?`).bind(owner),
    db.prepare(`DELETE FROM message_build WHERE owner_sub = ?`).bind(owner),
    db.prepare(`DELETE FROM message_canvas WHERE owner_sub = ?`).bind(owner),
    db.prepare(`DELETE FROM message_agent WHERE owner_sub = ?`).bind(owner),
    db.prepare(`DELETE FROM canvas_reviews WHERE owner_sub = ?`).bind(owner),
    db.prepare(`DELETE FROM build_embeds WHERE owner_sub = ?`).bind(owner),
    db.prepare(`DELETE FROM message_attachments WHERE owner_sub = ?`).bind(owner),
    db.prepare(`DELETE FROM proof_runs WHERE owner_sub = ?`).bind(owner),
    db.prepare(`DELETE FROM research_runs WHERE owner_sub = ?`).bind(owner),
    db.prepare(`DELETE FROM proof_library WHERE owner_sub = ?`).bind(owner),
    db.prepare(`DELETE FROM user_settings WHERE owner_sub = ?`).bind(owner),
    db.prepare(`DELETE FROM conversation_shares WHERE owner_sub = ?`).bind(owner),
    db.prepare(`DELETE FROM conversation_summaries WHERE owner_sub = ?`).bind(owner),
    db.prepare(`DELETE FROM project_conversations WHERE owner_sub = ?`).bind(owner),
    db.prepare(`DELETE FROM messages WHERE owner_sub = ?`).bind(owner),
    db.prepare(`DELETE FROM conversations WHERE owner_sub = ?`).bind(owner),
  ])
  return privateJson(c, { ok: true })
})
