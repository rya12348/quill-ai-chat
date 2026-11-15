import { Hono } from 'hono'

import { ANALYZE_DAILY_LIMIT, BUILD_DAILY_LIMIT, DAILY_MESSAGE_LIMIT, MODELS, RESEARCH_DAILY_LIMIT } from '../../shared/config'
import type { Me, ModelInfo } from '../../shared/types'
import { aiConfigured, availableModels } from '../ai'
import { analyzeEnabledFor, authMode, buildEnabledFor, isAccountUser, isGuestUser, isOwner, privateJson, researchEnabledFor } from '../auth'
import { guestUsageToday, now, utcDay, usageToday } from '../db'
import type { AppContext } from '../env'
import { isLocalBridgeRequest, laneStrength, pickPickerFamilies, pickerModelDescription, pickerModelName, publicLanes } from '../public-ai'
import { healthRows } from '../provider-health'
import { guestUsageKey } from '../rate-limit'
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
  const lanes = aiConfigured(c.env)
    ? []
    : publicLanes(c.env).filter((lane) => isLocalBridgeRequest(c.req.raw) || !lane.model.startsWith('buffy'))
  // Guests may have cleared their cookie; show the same address-keyed
  // allowance the chat route enforces instead of a misleading fresh count.
  const counts = isGuestUser(user) ? await guestUsageToday(db, await guestUsageKey(c.req.raw)) : await usageToday(db, user.sub)
  const body: Me = {
    user: { sub: user.sub, name: user.name, email: user.email, picture: user.picture },
    capabilities: {
      ai: true,
      mode: aiConfigured(c.env) ? 'api' : 'public',
      model: pickerModelName(0),
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
      auth: isGuestUser(user) ? 'guest' : isAccountUser(user) ? 'account' : mode === 'freebuff' ? 'freebuff' : 'development',
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
  // No key: a short list of brand rows plus one row per hosted family, each
  // with a short display name. Each family is represented by its best
  // currently working lane — healthy before merely strong — so the picker stays
  // short and the site chooses the variant instead of making people compare
  // provider suffixes.
  let statuses = new Map<string, string>()
  try {
    statuses = new Map((await healthRows(c.get('db'), c.get('user').sub)).map((row) => [row.provider_id, row.status]))
  } catch {
    // A fresh deployment has no health rows yet; strength alone still works.
  }
  const lanes = publicLanes(c.env).filter(
    (lane) => isLocalBridgeRequest(c.req.raw) || !lane.model.startsWith('buffy'),
  )
  // Buffy is an extra row: keep the hosted families intact rather than letting
  // it displace one of them. The local bridge supplies Buffy Agent and Buffy;
  // a deployment without one still advertises Buffy, which the Worker runs on
  // the hosted free lanes.
  const bridgeBuffyRows = lanes
    .filter((lane) => lane.model === 'buffy' || lane.model === 'buffy-lite')
    .map((lane) => ({
      id: lane.model,
      name: lane.label,
      description: lane.description,
      available: true,
      family: lane.model === 'buffy' ? 'Buffy Agent' : 'Buffy',
      strength: laneStrength(lane.model, lane.url),
      ...(lane.billing ? { billing: lane.billing } : {}),
    }))
  const buffyRows = bridgeBuffyRows.length
    ? bridgeBuffyRows
    : lanes.length
      ? [
          {
            id: 'buffy-lite',
            name: 'Buffy',
            description: 'Free Buffy on the strongest hosted models.',
            available: true,
            family: 'Buffy',
            billing: 'free' as const,
            strength: 82,
          },
        ]
      : []
  // Stride and Prism spent the most time degraded and add little over the
  // stronger families. Retire those two rows and give their space to the
  // no-key Claude and ChatGPT lanes the Buffy page uses. The Step and GLM names
  // are kept for older lane aliases of the same models.
  const retiredFamilies = new Set(['Step', 'GLM'])
  const retiredLanes = /nemotron-3-ultra-550b|deepseek-v4\.1-flash/i
  const frontierDescriptions: Record<string, string> = {
    'stepfun-ai/step-5-preview': 'Frontier reasoning for long, hard tasks.',
    'moonshotai/kimi-k3': 'Frontier reasoning, coding and agentic work.',
    'inclusionai/ling-3.2-flash:free': 'Long-context multimodal reasoning and documents.',
    'baidu/ernie-5.5-flash-preview:free': 'Strong tool use and browsing for agent work.',
    'particle-ai/particle-1:free': 'Token-efficient coding and page edits.',
  }
  const items: ModelInfo[] = [
    ...buffyRows,
    {
      id: 'claude-haiku-5-5',
      name: 'Claude',
      description: 'Free Claude Haiku 5.5, no key or setup.',
      available: true,
      family: 'Claude',
      billing: 'free',
      strength: laneStrength('claude-haiku-5-5'),
    },
    {
      id: 'gpt-5.4-mini',
      name: 'ChatGPT',
      description: 'Free ChatGPT, no key or setup.',
      available: true,
      family: 'ChatGPT',
      billing: 'free',
      strength: laneStrength('gpt-5.4-mini'),
    },
    ...pickPickerFamilies(
      lanes.filter((lane) => !lane.model.startsWith('buffy')),
      statuses,
    )
      .filter(
        ({ family, lane }) =>
          !retiredFamilies.has(family) && !retiredLanes.test(`${lane.model} ${lane.label}`),
      )
      .map(({ family, lane }, index) => {
        // The two free frontier lanes are new enough that a borrowed alias
        // hides what they are. Show their real names and descriptions.
        const actual = /ernie-5\.5|particle-1|ling-3\.2|step-5|kimi-k3/i.test(lane.model)
        return {
          id: lane.model,
          name: actual ? lane.label.replace(/\s*\([^)]*\)\s*$/, '') : pickerModelName(index),
          description: actual ? frontierDescriptions[lane.model] ?? lane.description : pickerModelDescription(index),
          available: true,
          family,
          strength: laneStrength(lane.model, lane.url),
          ...(lane.billing ? { billing: lane.billing } : {}),
        }
      }),
  ]
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
    db.prepare(`DELETE FROM pinned_artifacts WHERE owner_sub = ?`).bind(owner),
    db.prepare(`DELETE FROM build_embeds WHERE owner_sub = ?`).bind(owner),
    db.prepare(`DELETE FROM message_attachments WHERE owner_sub = ?`).bind(owner),
    db.prepare(`DELETE FROM proof_runs WHERE owner_sub = ?`).bind(owner),
    db.prepare(`DELETE FROM research_runs WHERE owner_sub = ?`).bind(owner),
    db.prepare(`DELETE FROM proof_library WHERE owner_sub = ?`).bind(owner),
    db.prepare(`DELETE FROM user_settings WHERE owner_sub = ?`).bind(owner),
    db.prepare(`DELETE FROM room_messages WHERE author_sub = ?`).bind(owner),
    db.prepare(`DELETE FROM humanizer_runs WHERE owner_sub = ?`).bind(owner),
    db.prepare(`DELETE FROM conversation_shares WHERE owner_sub = ?`).bind(owner),
    db.prepare(`DELETE FROM conversation_summaries WHERE owner_sub = ?`).bind(owner),
    db.prepare(`DELETE FROM project_conversations WHERE owner_sub = ?`).bind(owner),
    db.prepare(`DELETE FROM messages WHERE owner_sub = ?`).bind(owner),
    db.prepare(`DELETE FROM conversations WHERE owner_sub = ?`).bind(owner),
  ])
  return privateJson(c, { ok: true })
})
