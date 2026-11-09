// Attachments arrive with the chat request, are validated here, and are kept
// beside their message in D1. Image bytes are served separately so loading a
// conversation does not download every screenshot as base64 JSON.

import {
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENT_TOTAL_BYTES,
  MAX_ATTACHMENTS,
  MAX_TEXT_ATTACHMENT_CHARS,
} from '../shared/config'
import type { AttachmentInput, AttachmentKind, MessageAttachment, Role } from '../shared/types'
import type { ChatMessage } from './ai'

const IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'markdown', 'csv', 'json', 'js', 'jsx', 'ts', 'tsx', 'css', 'html', 'htm',
  'xml', 'yaml', 'yml', 'toml', 'ini', 'sql', 'py', 'go', 'rs', 'java', 'c', 'cpp', 'h',
  'sh', 'log',
])
const APPLICATION_TEXT_MIMES = new Set([
  'application/json',
  'application/xml',
  'application/javascript',
  'application/x-javascript',
  'application/x-yaml',
  'application/yaml',
  'application/typescript',
  'application/x-typescript',
  'application/x-python',
  'application/x-sh',
  'application/sql',
])

const PROMPT_TEXT_PER_FILE = 20_000

export class AttachmentValidationError extends Error {}

export interface StoredAttachment extends AttachmentInput {
  id: string
}

type Row = Record<string, unknown>

const extensionOf = (name: string) => name.toLowerCase().split('.').pop() ?? ''

function normalizeMime(value: unknown): string {
  const mime = String(value ?? '').toLowerCase().split(';')[0]!.trim()
  return mime === 'image/jpg' ? 'image/jpeg' : mime
}

function textMimeFor(name: string, mime: string): string | null {
  if (mime.startsWith('text/') || APPLICATION_TEXT_MIMES.has(mime)) return mime
  const ext = extensionOf(name)
  if (!TEXT_EXTENSIONS.has(ext)) return null
  if (ext === 'json') return 'application/json'
  if (ext === 'xml') return 'application/xml'
  if (ext === 'md' || ext === 'markdown') return 'text/markdown'
  if (ext === 'csv') return 'text/csv'
  if (ext === 'html' || ext === 'htm') return 'text/html'
  return 'text/plain'
}

function cleanName(value: unknown): string {
  if (typeof value !== 'string') return ''
  const base = value.split(/[\\/]/).pop() ?? ''
  return base.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 120)
}

function imageBytesLookValid(mime: string, bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false
  if (mime === 'image/png') return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
  if (mime === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  if (mime === 'image/gif') return bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38
  if (mime === 'image/webp') {
    return (
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
    )
  }
  return false
}

/** Validates attachments from the request and computes their real sizes. */
export function parseAttachments(value: unknown): StoredAttachment[] {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) throw new AttachmentValidationError('Attachments must be a list.')
  if (value.length > MAX_ATTACHMENTS) throw new AttachmentValidationError(`Attach at most ${MAX_ATTACHMENTS} files.`)
  let total = 0
  const parsed: StoredAttachment[] = []

  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new AttachmentValidationError('One of the attachments is invalid.')
    const raw = item as Partial<AttachmentInput> & { data?: unknown }
    const name = cleanName(raw.name)
    if (!name) throw new AttachmentValidationError('Every attachment needs a file name.')
    const declaredKind: AttachmentKind | null = raw.kind === 'image' || raw.kind === 'text' ? raw.kind : null
    const mime = normalizeMime(raw.mime)
    const kind: AttachmentKind | null = IMAGE_MIMES.has(mime) ? 'image' : textMimeFor(name, mime) ? 'text' : null
    if (!kind) throw new AttachmentValidationError('Attach images, text or code files only.')
    if (declaredKind && declaredKind !== kind) throw new AttachmentValidationError('One attachment did not match its file type.')
    if (typeof raw.data !== 'string') throw new AttachmentValidationError('One attachment is missing its contents.')

    if (kind === 'image') {
      const dataUrl = raw.data.match(/^data:([^;,]+)?;base64,([\s\S]*)$/i)
      const base64 = (dataUrl ? dataUrl[2]! : raw.data).replace(/\s+/g, '')
      if (!base64 || base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
        throw new AttachmentValidationError('That image could not be read.')
      }
      let bytes: Uint8Array
      try {
        const binary = atob(base64)
        bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
      } catch {
        throw new AttachmentValidationError('That image could not be read.')
      }
      if (bytes.byteLength > MAX_ATTACHMENT_BYTES) {
        throw new AttachmentValidationError(`Each image can be up to ${Math.round(MAX_ATTACHMENT_BYTES / 100_000) / 10} MB.`)
      }
      if (!imageBytesLookValid(mime, bytes)) throw new AttachmentValidationError('That image is not a valid PNG, JPG, WebP or GIF.')
      total += bytes.byteLength
      parsed.push({ id: crypto.randomUUID(), name, mime, size: bytes.byteLength, kind, data: base64 })
      continue
    }

    const text = raw.data.replace(/\r\n?/g, '\n').replace(/^\uFEFF/, '')
    if (text.length > MAX_TEXT_ATTACHMENT_CHARS) {
      throw new AttachmentValidationError(`Text files can be up to ${MAX_TEXT_ATTACHMENT_CHARS.toLocaleString()} characters.`)
    }
    const size = new TextEncoder().encode(text).byteLength
    total += size
    parsed.push({ id: crypto.randomUUID(), name, mime: textMimeFor(name, mime) ?? 'text/plain', size, kind, data: text })
  }

  if (total > MAX_ATTACHMENT_TOTAL_BYTES) throw new AttachmentValidationError('Those attachments are too large together. Attach fewer or smaller files.')
  return parsed
}

export function attachmentDataUrl(attachment: StoredAttachment): string {
  return `data:${attachment.mime};base64,${attachment.data}`
}

export function attachmentMeta(
  attachment: Pick<StoredAttachment, 'id' | 'name' | 'mime' | 'size' | 'kind'>,
  baseUrl = '/api/attachments',
): MessageAttachment {
  return {
    id: attachment.id,
    name: attachment.name,
    mime: attachment.mime,
    size: attachment.size,
    kind: attachment.kind,
    ...(attachment.kind === 'image' ? { url: `${baseUrl}/${encodeURIComponent(attachment.id)}` } : {}),
  }
}

export function attachmentFromRow(row: Row): StoredAttachment {
  return {
    id: row.id as string,
    name: row.name as string,
    mime: row.mime as string,
    size: Number(row.size),
    kind: row.kind === 'image' ? 'image' : 'text',
    data: row.data as string,
  }
}

const placeholders = (count: number) => Array.from({ length: count }, () => '?').join(',')

/** Loads the bytes only for the messages currently in the model window. */
export async function loadAttachmentsForMessages(
  db: D1Database,
  owner: string,
  messageIds: string[],
): Promise<Map<string, StoredAttachment[]>> {
  const grouped = new Map<string, StoredAttachment[]>()
  if (!messageIds.length) return grouped
  const rows = await db
    .prepare(
      `SELECT id, message_id, name, mime, size, kind, data
       FROM message_attachments
       WHERE owner_sub = ? AND message_id IN (${placeholders(messageIds.length)})
       ORDER BY message_id, position, created_at`,
    )
    .bind(owner, ...messageIds)
    .all<Row>()
  for (const row of rows.results) {
    const messageId = row.message_id as string
    const list = grouped.get(messageId) ?? []
    list.push(attachmentFromRow(row))
    grouped.set(messageId, list)
  }
  return grouped
}

/** Metadata for the conversation page: no base64 or file text is returned. */
export function groupAttachmentMeta(rows: Row[], baseUrl = '/api/attachments'): Map<string, MessageAttachment[]> {
  const grouped = new Map<string, MessageAttachment[]>()
  for (const row of rows) {
    const attachment = attachmentMeta({
      id: row.id as string,
      name: row.name as string,
      mime: row.mime as string,
      size: Number(row.size),
      kind: row.kind === 'image' ? 'image' : 'text',
    }, baseUrl)
    const messageId = row.message_id as string
    const list = grouped.get(messageId) ?? []
    list.push(attachment)
    grouped.set(messageId, list)
  }
  return grouped
}

function clipText(value: string): string {
  return value.length > PROMPT_TEXT_PER_FILE ? `${value.slice(0, PROMPT_TEXT_PER_FILE)}\n…[file truncated for context]` : value
}

/**
 * Adds a user message's files to the prompt. Images use the OpenAI-compatible
 * image_url part; text files are included with a filename header so the model
 * can refer to them naturally.
 */
export function messageWithAttachments(
  message: { role: Role; content: string },
  attachments: StoredAttachment[],
): ChatMessage {
  const images = attachments.filter((attachment) => attachment.kind === 'image')
  const files = attachments.filter((attachment) => attachment.kind === 'text')
  const fileBlock = files
    .map((attachment) => `--- Attached file: ${attachment.name} (${attachment.mime}) ---\n${clipText(attachment.data)}`)
    .join('\n\n')
  const text = [message.content.trim(), fileBlock].filter(Boolean).join('\n\n')

  if (!images.length) return { role: message.role, content: text }
  const intro = text || `The user attached ${images.length === 1 ? 'an image' : `${images.length} images`}.`
  return {
    role: message.role,
    content: [
      { type: 'text', text: intro },
      ...images.map((attachment) => ({ type: 'image_url' as const, image_url: { url: attachmentDataUrl(attachment) } })),
    ],
  }
}
