// Attachment bytes belong in R2. D1 keeps only the metadata needed to authorize,
// list and render an attachment, so one large image cannot consume the row
// budget for its message.

import type { StoredAttachment } from './attachments'

export type AttachmentScope = 'chat' | 'room'

type AttachmentRow = {
  id: string
  owner_sub: string
  kind: string
  mime: string
  data: string
  r2_key?: string | null
}

type StoredObject = { r2Key: string | null; thumbnailKey: string | null; data: string }

export type AttachmentBytes = { bytes: Uint8Array; mime: string }

const MIGRATION_BATCH = 25
const MIGRATION_INTERVAL_MS = 30_000
const DELETE_BATCH = 100
const encoder = new TextEncoder()

let migrating: Promise<void> | undefined
let lastMigrationAt = 0

const objectPrefix = (scope: AttachmentScope) => (scope === 'chat' ? 'chat' : 'rooms')
const objectKey = (scope: AttachmentScope, id: string) => `${objectPrefix(scope)}/${id}`
const thumbnailKey = (scope: AttachmentScope, id: string) => `${objectPrefix(scope)}/${id}-thumb`

/** Every object an attachment may own, including a legacy row with no thumbnail. */
export function attachmentObjectKeys(scope: AttachmentScope, id: string): string[] {
  return [objectKey(scope, id), thumbnailKey(scope, id)]
}

export function contentDisposition(name: string, inline: boolean): string {
  return `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(name)}`
}

function imageDataUrl(value: string | undefined): { bytes: Uint8Array; mime: string } | null {
  if (!value) return null
  const match = value.match(/^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/]+={0,2})$/i)
  if (!match) return null
  try {
    return { mime: match[1]!.toLowerCase(), bytes: bytesFromBase64(match[2]!) }
  } catch {
    return null
  }
}

function bytesFromBase64(value: string): Uint8Array {
  const binary = atob(value)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

function base64FromBytes(bytes: Uint8Array): string {
  let binary = ''
  // Keep each spread below the argument limit for images near the old 1.2 MB
  // cap. A chunked conversion also avoids retaining a second full-size string.
  for (let offset = 0; offset < bytes.length; offset += 8_192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8_192))
  }
  return btoa(binary)
}

function objectBytes(row: Pick<AttachmentRow, 'kind' | 'data'>): Uint8Array {
  return row.kind === 'image' ? bytesFromBase64(row.data) : encoder.encode(row.data)
}

function isLink(row: Pick<AttachmentRow, 'mime'>): boolean {
  return row.mime === 'text/uri-list'
}

/**
 * Upload non-link attachments and return the D1 values to persist. If R2 is not
 * configured (local development before storage is provisioned), keep the old
 * D1 fallback instead of making attachments unusable.
 */
export async function storeAttachmentObjects(
  bucket: R2Bucket | undefined,
  scope: AttachmentScope,
  attachments: StoredAttachment[],
): Promise<Map<string, StoredObject>> {
  const stored = new Map<string, StoredObject>()
  if (!bucket) {
    for (const attachment of attachments) stored.set(attachment.id, { r2Key: null, thumbnailKey: null, data: attachment.data })
    return stored
  }

  const results = await Promise.allSettled(
    attachments.map(async (attachment) => {
      if (isLink(attachment)) {
        stored.set(attachment.id, { r2Key: null, thumbnailKey: null, data: attachment.data })
        return [] as string[]
      }
      const keys: string[] = []
      try {
        const key = objectKey(scope, attachment.id)
        await bucket.put(key, objectBytes({ kind: attachment.kind, data: attachment.data }), {
          httpMetadata: { contentType: attachment.mime },
        })
        keys.push(key)
        const preview = attachment.kind === 'image' ? imageDataUrl(attachment.thumbnail) : null
        const previewKey = preview ? thumbnailKey(scope, attachment.id) : null
        if (preview && previewKey) {
          await bucket.put(previewKey, preview.bytes, { httpMetadata: { contentType: preview.mime } })
          keys.push(previewKey)
        }
        stored.set(attachment.id, { r2Key: key, thumbnailKey: previewKey, data: '' })
        return keys
      } catch (error) {
        // Do not strand a partially uploaded original if the preview put fails.
        await deleteAttachmentObjects(bucket, keys)
        throw error
      }
    }),
  )
  const failed = results.find((result): result is PromiseRejectedResult => result.status === 'rejected')
  if (failed) {
    const keys = results.flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
    await deleteAttachmentObjects(bucket, keys)
    throw failed.reason
  }
  return stored
}

export async function deleteAttachmentObjects(bucket: R2Bucket | undefined, keys: string[]): Promise<void> {
  if (!bucket || !keys.length) return
  const unique = [...new Set(keys.filter(Boolean))]
  for (let offset = 0; offset < unique.length; offset += DELETE_BATCH) {
    await bucket.delete(unique.slice(offset, offset + DELETE_BATCH)).catch((error) => {
      console.warn('attachment_object_delete_failed', error)
    })
  }
}

/** Load a browser thumbnail, falling back to the original for old attachments. */
export async function readAttachmentThumbnail(
  bucket: R2Bucket | undefined,
  scope: AttachmentScope,
  row: Pick<AttachmentRow, 'id' | 'kind' | 'mime' | 'data' | 'r2_key'>,
): Promise<AttachmentBytes | null> {
  if (bucket) {
    const object = await bucket.get(thumbnailKey(scope, row.id))
    if (object) {
      return {
        bytes: new Uint8Array(await object.arrayBuffer()),
        mime: object.httpMetadata?.contentType || row.mime || 'application/octet-stream',
      }
    }
  }
  const bytes = await readAttachmentBytes(bucket, row)
  return bytes ? { bytes, mime: row.mime || 'application/octet-stream' } : null
}

/** Load the original bytes for an image response or a text preview. */
export async function readAttachmentBytes(
  bucket: R2Bucket | undefined,
  row: Pick<AttachmentRow, 'kind' | 'data' | 'r2_key'>,
): Promise<Uint8Array | null> {
  if (row.r2_key) {
    const object = bucket ? await bucket.get(row.r2_key) : null
    if (!object) return null
    return new Uint8Array(await object.arrayBuffer())
  }
  if (!row.data) return null
  try {
    return row.kind === 'image' ? bytesFromBase64(row.data) : encoder.encode(row.data)
  } catch {
    return null
  }
}

/** Load the form the model or a room preview needs: base64 for images, text otherwise. */
export async function readAttachmentData(
  bucket: R2Bucket | undefined,
  row: Pick<AttachmentRow, 'kind' | 'data' | 'r2_key'>,
): Promise<string | null> {
  if (!row.r2_key) return row.data
  const object = bucket ? await bucket.get(row.r2_key) : null
  if (!object) return null
  return row.kind === 'image'
    ? base64FromBytes(new Uint8Array(await object.arrayBuffer()))
    : await object.text()
}

async function migrateTable(db: D1Database, bucket: R2Bucket, table: 'message_attachments' | 'room_message_attachments', scope: AttachmentScope) {
  const rows = await db
    .prepare(
      `SELECT id, owner_sub, kind, mime, data
       FROM ${table}
       WHERE r2_key IS NULL AND data <> '' AND mime <> 'text/uri-list'
       ORDER BY created_at ASC
       LIMIT ?`,
    )
    .bind(MIGRATION_BATCH)
    .all<AttachmentRow>()
  for (const row of rows.results) {
    const key = objectKey(scope, row.id)
    try {
      await bucket.put(key, objectBytes(row), { httpMetadata: { contentType: row.mime } })
      const updated = await db
        .prepare(`UPDATE ${table} SET r2_key = ?, data = '' WHERE id = ? AND owner_sub = ? AND r2_key IS NULL`)
        .bind(key, row.id, row.owner_sub)
        .run()
      // A concurrent conversation/room delete may have removed the row after
      // it was read. Do not leave an unreferenced object in the bucket.
      if (updated.meta.changes === 0) await bucket.delete(key).catch(() => undefined)
    } catch (error) {
      // Leave the row in D1; reads still work and the next batch retries it.
      console.warn('attachment_migration_failed', table, row.id, error)
    }
  }
}

/**
 * Move legacy D1 blobs to R2 in bounded batches. This runs in the background
 * after API requests, so a deployment does not need a one-off migration job.
 * Reads fall back to D1 until a row has been copied.
 */
export function migrateAttachmentObjects(bucket: R2Bucket | undefined, db: D1Database): Promise<void> {
  if (!bucket) return Promise.resolve()
  const at = Date.now()
  if (migrating || at - lastMigrationAt < MIGRATION_INTERVAL_MS) return migrating ?? Promise.resolve()
  lastMigrationAt = at
  migrating = (async () => {
    await migrateTable(db, bucket, 'message_attachments', 'chat')
    await migrateTable(db, bucket, 'room_message_attachments', 'room')
  })()
    .catch((error) => console.warn('attachment_migration_failed', error))
    .finally(() => {
      migrating = undefined
    })
  return migrating
}
