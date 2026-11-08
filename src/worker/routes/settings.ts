import { Hono } from 'hono'

import { MAX_INSTRUCTIONS_CHARS } from '../../shared/config'
import { privateJson } from '../auth'
import { now } from '../db'
import type { AppContext } from '../env'

export const settings = new Hono<AppContext>()

settings.get('/', async (c) => {
  const row = await c
    .get('db')
    .prepare(`SELECT instructions FROM user_settings WHERE owner_sub = ?`)
    .bind(c.get('user').sub)
    .first<{ instructions?: string }>()
  return privateJson(c, { instructions: typeof row?.instructions === 'string' ? row.instructions : '' })
})

settings.patch('/', async (c) => {
  const input = await c.req.json<{ instructions?: unknown }>().catch(() => ({} as { instructions?: unknown }))
  if (typeof input.instructions !== 'string') {
    return c.json({ error: 'instructions', message: 'Instructions must be text.' }, 400)
  }
  const instructions = input.instructions.replace(/\r\n?/g, '\n').trim().slice(0, MAX_INSTRUCTIONS_CHARS)
  await c
    .get('db')
    .prepare(
      `INSERT INTO user_settings (owner_sub, instructions, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(owner_sub) DO UPDATE SET instructions = excluded.instructions, updated_at = excluded.updated_at`,
    )
    .bind(c.get('user').sub, instructions, now())
    .run()
  return privateJson(c, { instructions })
})
