// Image bytes are kept out of conversation JSON. The browser requests them
// with the same authenticated cookie session as the rest of the API.

import { Hono } from 'hono'

import type { AppContext } from '../env'

export const attachments = new Hono<AppContext>()

attachments.get('/:id', async (c) => {
  const row = await c
    .get('db')
    .prepare(`SELECT mime, data FROM message_attachments WHERE owner_sub = ? AND id = ? AND kind = 'image'`)
    .bind(c.get('user').sub, c.req.param('id'))
    .first<{ mime: string; data: string }>()
  if (!row) return c.json({ error: 'not_found' }, 404)

  let bytes: Uint8Array
  try {
    const binary = atob(row.data)
    bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  } catch {
    return c.json({ error: 'not_found' }, 404)
  }
  return new Response(bytes.buffer as ArrayBuffer, {
    headers: {
      'content-type': row.mime,
      'content-length': String(bytes.byteLength),
      'cache-control': 'private, max-age=31536000, immutable',
      'content-disposition': 'inline',
      'x-content-type-options': 'nosniff',
    },
  })
})
