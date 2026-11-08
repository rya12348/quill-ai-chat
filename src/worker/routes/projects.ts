import { Hono } from 'hono'

import { privateJson } from '../auth'
import { id, mapProject, now } from '../db'
import type { AppContext } from '../env'

export const projects = new Hono<AppContext>()

const MAX_PROJECTS = 50
const MAX_NAME = 60

function projectName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const name = value.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME)
  return name || null
}

projects.get('/', async (c) => {
  const rows = await c
    .get('db')
    .prepare(
      `SELECT p.*,
              (SELECT COUNT(*) FROM project_conversations pc
               JOIN conversations c ON c.id = pc.conversation_id AND c.owner_sub = pc.owner_sub
               WHERE pc.owner_sub = p.owner_sub AND pc.project_id = p.id) AS conversation_count
       FROM projects p
       WHERE p.owner_sub = ?
       ORDER BY p.updated_at DESC, p.created_at DESC
       LIMIT ?`,
    )
    .bind(c.get('user').sub, MAX_PROJECTS)
    .all()
  return privateJson(c, { items: (rows.results as Record<string, unknown>[]).map(mapProject) })
})

projects.post('/', async (c) => {
  const db = c.get('db')
  const owner = c.get('user').sub
  const input = await c.req.json<{ name?: unknown }>().catch(() => ({}) as { name?: unknown })
  const name = projectName(input.name)
  if (!name) return c.json({ error: 'Give the project a name.' }, 400)

  const count = await db.prepare(`SELECT COUNT(*) AS n FROM projects WHERE owner_sub = ?`).bind(owner).first<{ n: number }>()
  if (Number(count?.n ?? 0) >= MAX_PROJECTS) return c.json({ error: `You can have up to ${MAX_PROJECTS} projects.` }, 409)

  const at = now()
  const projectId = id()
  await db.prepare(`INSERT INTO projects (id, owner_sub, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`).bind(projectId, owner, name, at, at).run()
  const row = await db.prepare(`SELECT *, 0 AS conversation_count FROM projects WHERE owner_sub = ? AND id = ?`).bind(owner, projectId).first<Record<string, unknown>>()
  return privateJson(c, { project: mapProject(row!) }, 201)
})

projects.patch('/:id', async (c) => {
  const db = c.get('db')
  const owner = c.get('user').sub
  const projectId = c.req.param('id')
  const existing = await db.prepare(`SELECT * FROM projects WHERE owner_sub = ? AND id = ?`).bind(owner, projectId).first<Record<string, unknown>>()
  if (!existing) return c.json({ error: 'Project not found.' }, 404)
  const input = await c.req.json<{ name?: unknown }>().catch(() => ({}) as { name?: unknown })
  const name = projectName(input.name)
  if (!name) return c.json({ error: 'Give the project a name.' }, 400)
  await db.prepare(`UPDATE projects SET name = ?, updated_at = ? WHERE owner_sub = ? AND id = ?`).bind(name, now(), owner, projectId).run()
  const row = await db
    .prepare(
      `SELECT p.*,
              (SELECT COUNT(*) FROM project_conversations pc
               JOIN conversations c ON c.id = pc.conversation_id AND c.owner_sub = pc.owner_sub
               WHERE pc.owner_sub = p.owner_sub AND pc.project_id = p.id) AS conversation_count
       FROM projects p WHERE p.owner_sub = ? AND p.id = ?`,
    )
    .bind(owner, projectId)
    .first<Record<string, unknown>>()
  return privateJson(c, { project: mapProject(row!) })
})

projects.delete('/:id', async (c) => {
  const db = c.get('db')
  const owner = c.get('user').sub
  const projectId = c.req.param('id')
  const existing = await db.prepare(`SELECT id FROM projects WHERE owner_sub = ? AND id = ?`).bind(owner, projectId).first()
  if (!existing) return c.json({ error: 'Project not found.' }, 404)
  const count = await db.prepare(`SELECT COUNT(*) AS n FROM project_conversations WHERE owner_sub = ? AND project_id = ?`).bind(owner, projectId).first<{ n: number }>()
  await db.batch([
    db.prepare(`DELETE FROM project_conversations WHERE owner_sub = ? AND project_id = ?`).bind(owner, projectId),
    db.prepare(`DELETE FROM projects WHERE owner_sub = ? AND id = ?`).bind(owner, projectId),
  ])
  return privateJson(c, { ok: true, unassigned: Number(count?.n ?? 0) })
})
