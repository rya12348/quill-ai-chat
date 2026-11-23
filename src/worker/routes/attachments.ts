// Image bytes are kept out of conversation JSON. The browser requests them
// with the same authenticated cookie session as the rest of the API.

import { Hono } from 'hono'

import { contentDisposition, readAttachmentBytes, readAttachmentThumbnail } from '../attachment-storage'
import type { AppContext } from '../env'

export const attachments = new Hono<AppContext>()

attachments.get('/:id', async (c) => {
  const row = await c
    .get('db')
    .prepare(`SELECT id, name, mime, kind, data, r2_key FROM message_attachments WHERE owner_sub = ? AND id = ?`)
    .bind(c.get('user').sub, c.req.param('id'))
    .first<{ id: string; name: string; mime: string; kind: string; data: string; r2_key: string | null }>()
  if (!row) return c.json({ error: 'not_found' }, 404)

  const download = c.req.query('download') === '1'
  // Text is available for download; only images are rendered inline here.
  if (row.kind !== 'image' && !download) return c.json({ error: 'not_found' }, 404)
  const thumbnail = row.kind === 'image' && c.req.query('thumb') === '1'
  const loaded = thumbnail
    ? await readAttachmentThumbnail(c.env.FILES, 'chat', row)
    : await readAttachmentBytes(c.env.FILES, row).then((bytes) => (bytes ? { bytes, mime: row.mime } : null))
  if (!loaded) return c.json({ error: 'not_found' }, 404)
  return new Response(loaded.bytes.buffer as ArrayBuffer, {
    headers: {
      'content-type': loaded.mime,
      'content-length': String(loaded.bytes.byteLength),
      'cache-control': 'private, max-age=31536000, immutable',
      'content-disposition': contentDisposition(row.name, !download),
      'x-content-type-options': 'nosniff',
    },
  })
})
