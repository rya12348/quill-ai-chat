import { Hono } from 'hono'
import { deleteCookie } from 'hono/cookie'

import { ANALYZE_DAILY_LIMIT, BUILD_DAILY_LIMIT, DAILY_MESSAGE_LIMIT, MODELS, RESEARCH_DAILY_LIMIT } from '../../shared/config'
import type { Me, ModelInfo } from '../../shared/types'
import { attachmentObjectKeys, deleteAttachmentObjects } from '../attachment-storage'
import { aiConfigured, availableModels } from '../ai'
import { ACCOUNT_COOKIE, GUEST_COOKIE, analyzeEnabledFor, authMode, buildEnabledFor, isAccountUser, isGuestUser, isOwner, privateJson, researchEnabledFor } from '../auth'
import { guestUsageToday, now, utcDay, usageToday } from '../db'
import type { AppContext } from '../env'
import { familyForLane, isLocalBridgeRequest, laneKey, laneStrength, pickPickerFamilies, pickerModelDescription, pickerModelName, publicLanes } from '../public-ai'
import { fallbackForUnavailableModel, isUnavailableHealth, replacementLane } from '../model-fallbacks'
import { healthRows, type HealthRow } from '../provider-health'
import { guestUsageKey } from '../rate-limit'
import { rememberRoomPerson } from '../room-people'
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
  await rememberRoomPerson(db, user).catch((error) => console.warn('room_people_touch_failed', error))
  const counts = isGuestUser(user) ? await guestUsageToday(db, await guestUsageKey(c.req.raw)) : await usageToday(db, user.sub)
  const profile = await db
    .prepare(`SELECT display_name FROM room_profiles WHERE user_sub = ?`)
    .bind(user.sub)
    .first<{ display_name: string }>()
  const displayName = profile?.display_name.trim() || user.name
  const body: Me = {
    user: { sub: user.sub, name: displayName, email: user.email, picture: user.picture },
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
  let health: HealthRow[] = []
  let statuses = new Map<string, string>()
  try {
    health = await healthRows(c.get('db'), c.get('user').sub)
    statuses = new Map(health.map((row) => [row.provider_id, row.status]))
  } catch {
    // A fresh deployment has no health rows yet; strength alone still works.
  }
  const lanes = publicLanes(c.env).filter(
    (lane) => isLocalBridgeRequest(c.req.raw) || !lane.model.startsWith('buffy'),
  )
  const byLane = new Map(health.map((row) => [row.provider_id, row]))
  // A lane whose last check failed must not be offered. Families are rebuilt
  // from the remaining lanes, so a healthy sibling or the next family takes the
  // dead row's place without exposing the substitution.
  const workingLanes = lanes.filter((lane) => !isUnavailableHealth(byLane.get(laneKey(lane))))
  // Buffy is an extra row: keep the hosted families intact rather than letting
  // it displace one of them. The local bridge supplies Buffy Agent and Buffy;
  // a deployment without one still advertises Buffy, which the Worker runs on
  // the hosted free lanes.
  const bridgeBuffyRows = lanes
    .filter((lane) => lane.model === 'buffy' || lane.model === 'buffy-lite')
    .map((lane) => ({
      id: lane.model,
      name: 'Buffy',
      description: lane.description,
      available: true,
      family: 'Buffy Agent',
      strength: laneStrength(lane.model, lane.url),
      ...(lane.billing ? { billing: lane.billing } : {}),
    }))
  const buffyRows = bridgeBuffyRows.length
    ? bridgeBuffyRows
    : workingLanes.length
      ? [
          {
            id: 'buffy-lite',
            name: 'Buffy',
            description: 'Buffy on the strongest hosted models — no key or setup.',
            available: true,
            family: 'Buffy Agent',
            billing: 'free' as const,
            strength: 82,
          },
        ]
      : []
  // Stride and Dent spent the most time degraded and add little over the
  // stronger families. Retire those two rows and give their space to the
  // no-key Claude and ChatGPT lanes the Buffy page uses. The Step and GLM names
  // are kept for older lane aliases of the same models.
  const retiredFamilies = new Set(['GLM'])
  const retiredLanes = /nemotron-3-ultra-550b/i
  // Provider tags, "Preview" and tier words are internal. The picker shows the
  // model's name, not its deployment details: Step 5 Preview (NVIDIA) -> Step 5.
  const cleanPickerName = (label: string) =>
    label
      .replace(/\s*\([^)]*\)\s*$/, '')
      .replace(/\s+(?:Preview|Flash)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim()
  // DeepSeek V4.1 Flash is the product's "Dent" row. Keep the upstream id for
  // routing and health, but do not leak the provider name into the picker.
  const pickerNameFor = (lane: { model: string; label: string }) =>
    /deepseek-(?:flash|v4\.1)/i.test(lane.model) ? 'Dent' : cleanPickerName(lane.label)
  const frontierDescriptions: Record<string, string> = {
    'stepfun-ai/step-5-preview': 'Frontier reasoning for long, hard tasks.',
    'deepseek-ai/deepseek-v4.1-flash': 'Strong coder; behind Opus 5.5 on long-horizon agent work.',
    'DeepSeek-V4.1-Flash-1017': 'Strong coder; behind Opus 5.5 on long-horizon agent work.',
    'deepseek-flash': 'Strong coder; behind Opus 5.5 on long-horizon agent work.',
    'moonshotai/kimi-k3': 'Frontier reasoning, coding and agentic work.',
    'inclusionai/ling-3.2-flash:free': 'Long-context multimodal reasoning and documents.',
    'baidu/ernie-5.5-flash-preview:free': 'Strong tool use and browsing for agent work.',
    'particle-ai/particle-1:free': 'Token-efficient coding and page edits.',
  }
  const configuredReplacement = replacementLane(lanes)
  const replacementFallback = configuredReplacement
    ? fallbackForUnavailableModel(configuredReplacement.model, lanes, health)
    : undefined
  const replacement = configuredReplacement && !isUnavailableHealth(byLane.get(laneKey(configuredReplacement)))
    ? configuredReplacement
    : replacementFallback?.lane
  const items: ModelInfo[] = [
    ...buffyRows,
    ...(replacement
      ? [
          {
            id: replacement.model,
            name: cleanPickerName(replacement.label),
            description: frontierDescriptions[replacement.model] ?? replacement.description,
            available: true,
            family: familyForLane(replacement),
            billing: replacement.billing ?? 'free',
            strength: laneStrength(replacement.model, replacement.url),
          },
        ]
      : []),
    {
      id: 'claude-haiku-5-5',
      name: 'Claude',
      description: 'Claude Haiku 5.5, no key or setup.',
      available: true,
      family: 'Claude',
      billing: 'free',
      strength: laneStrength('claude-haiku-5-5'),
    },
    {
      id: 'gpt-6-luna',
      name: 'ChatGPT',
      description: 'GPT-6 Luna, no key or setup.',
      available: true,
      family: 'ChatGPT',
      billing: 'free',
      strength: laneStrength('gpt-6-luna'),
    },
    ...(workingLanes.some((lane) => lane.model === 'gemini-web')
      ? [
          {
            id: 'gemini-web',
            name: 'Gemini',
            description: 'Gemini 4, no key or setup.',
            available: true,
            family: 'Gemini',
            billing: 'free' as const,
            strength: laneStrength('gemini-web'),
          },
        ]
      : []),
    ...pickPickerFamilies(
      workingLanes.filter(
        (lane) =>
          !lane.model.startsWith('buffy') &&
          lane.model !== 'gemini-web' &&
          !retiredLanes.test(`${lane.model} ${lane.label}`),
      ),
      statuses,
    )
      // Retired lanes are removed before the shortlist is built, so the pinned
      // DeepSeek row cannot displace a stronger free family only to be filtered.
      .filter(
        ({ family, lane }) =>
          !retiredFamilies.has(family) &&
          family !== 'ERNIE' &&
          family !== 'Particle' &&
          (!replacement || family !== familyForLane(replacement)) &&
          lane.model !== replacement?.model,
      )
      .map(({ family, lane }, index) => {
        // The two free frontier lanes are new enough that a borrowed alias
        // hides what they are. Show their real names and descriptions.
        const actual = /ernie-5\.5|particle-1|ling-3\.2|step-5|kimi-k3|deepseek-(?:flash|v4\.1-flash)/i.test(lane.model)
        return {
          id: lane.model,
          name: actual ? pickerNameFor(lane) : pickerModelName(index),
          description: actual ? (frontierDescriptions[lane.model] ?? lane.description) : pickerModelDescription(index),
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

account.delete('/account', async (c) => {
  const db = c.get('db')
  const user = c.get('user')
  const owner = user.sub
  const accountId = isAccountUser(user) ? user.sub.slice('account:'.length) : null
  const attachmentRows = await db
    .prepare(
      `SELECT id, 'chat' AS scope FROM message_attachments WHERE owner_sub = ?
       UNION ALL
       SELECT id, 'room' AS scope FROM room_message_attachments WHERE owner_sub = ?`,
    )
    .bind(owner, owner)
    .all<{ id: string; scope: string }>()
  const statements = [
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
    db.prepare(`DELETE FROM provider_health WHERE owner_sub = ?`).bind(owner),
    db.prepare(`DELETE FROM browser_session_slots WHERE owner_sub = ?`).bind(owner),
    db.prepare(`DELETE FROM room_message_reactions WHERE author_sub = ?`).bind(owner),
    db.prepare(`DELETE FROM room_messages WHERE author_sub = ?`).bind(owner),
    db.prepare(`DELETE FROM room_message_attachments WHERE owner_sub = ?`).bind(owner),
    db.prepare(`DELETE FROM room_access WHERE user_sub = ?`).bind(owner),
    db.prepare(`DELETE FROM room_people_saved WHERE owner_sub = ? OR person_sub = ?`).bind(owner, owner),
    db.prepare(`DELETE FROM room_people_labels WHERE owner_sub = ? OR person_sub = ?`).bind(owner, owner),
    db.prepare(`DELETE FROM room_people WHERE user_sub = ?`).bind(owner),
    db.prepare(`DELETE FROM room_profiles WHERE user_sub = ?`).bind(owner),
    db.prepare(`DELETE FROM room_member_names WHERE user_sub = ? OR set_by = ?`).bind(owner, owner),
    db.prepare(`DELETE FROM humanizer_runs WHERE owner_sub = ?`).bind(owner),
    db.prepare(`DELETE FROM conversation_shares WHERE owner_sub = ?`).bind(owner),
    db.prepare(`DELETE FROM conversation_summaries WHERE owner_sub = ?`).bind(owner),
    db.prepare(`DELETE FROM conversation_reactions WHERE owner_sub = ?`).bind(owner),
    db.prepare(`DELETE FROM project_conversations WHERE owner_sub = ?`).bind(owner),
    db.prepare(`DELETE FROM project_settings WHERE owner_sub = ?`).bind(owner),
    db.prepare(`DELETE FROM projects WHERE owner_sub = ?`).bind(owner),
    db.prepare(`DELETE FROM messages WHERE owner_sub = ?`).bind(owner),
    db.prepare(`DELETE FROM conversations WHERE owner_sub = ?`).bind(owner),
    db.prepare(`DELETE FROM users WHERE owner_sub = ?`).bind(owner),
    ...(accountId
      ? [
          db.prepare(`DELETE FROM auth_sessions WHERE user_id = ?`).bind(accountId),
          db.prepare(`DELETE FROM auth_users WHERE id = ?`).bind(accountId),
        ]
      : []),
    ...(isGuestUser(user)
      ? [db.prepare(`DELETE FROM guest_daily_usage WHERE ip_hash = ?`).bind(await guestUsageKey(c.req.raw))]
      : []),
  ]
  await db.batch(statements)
  await deleteAttachmentObjects(
    c.env.FILES,
    attachmentRows.results.flatMap((row) => attachmentObjectKeys(row.scope === 'room' ? 'room' : 'chat', row.id)),
  )
  deleteCookie(c, ACCOUNT_COOKIE, { path: '/' })
  deleteCookie(c, GUEST_COOKIE, { path: '/' })
  return privateJson(c, { ok: true })
})

account.delete('/account/conversations', async (c) => {
  const db = c.get('db')
  const owner = c.get('user').sub
  const attachmentRows = await db
    .prepare(`SELECT id FROM message_attachments WHERE owner_sub = ?`)
    .bind(owner)
    .all<{ id: string }>()
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
    db.prepare(`DELETE FROM room_message_reactions WHERE author_sub = ?`).bind(owner),
    db.prepare(`DELETE FROM room_messages WHERE author_sub = ?`).bind(owner),
    db.prepare(`DELETE FROM room_message_attachments WHERE owner_sub = ?`).bind(owner),
    db.prepare(`DELETE FROM room_access WHERE user_sub = ?`).bind(owner),
    db.prepare(`DELETE FROM humanizer_runs WHERE owner_sub = ?`).bind(owner),
    db.prepare(`DELETE FROM conversation_shares WHERE owner_sub = ?`).bind(owner),
    db.prepare(`DELETE FROM conversation_summaries WHERE owner_sub = ?`).bind(owner),
    db.prepare(`DELETE FROM conversation_reactions WHERE owner_sub = ?`).bind(owner),
    db.prepare(`DELETE FROM project_conversations WHERE owner_sub = ?`).bind(owner),
    db.prepare(`DELETE FROM messages WHERE owner_sub = ?`).bind(owner),
    db.prepare(`DELETE FROM conversations WHERE owner_sub = ?`).bind(owner),
  ])
  await deleteAttachmentObjects(c.env.FILES, attachmentRows.results.flatMap((row) => attachmentObjectKeys('chat', row.id)))
  return privateJson(c, { ok: true })
})
