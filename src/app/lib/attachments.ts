import {
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS,
  MAX_DOCUMENT_SOURCE_BYTES,
  MAX_TEXT_ATTACHMENT_CHARS,
} from '../../shared/config'
import { isDocumentFile, normalizeDocumentText } from '../../shared/documents'
import type { AttachmentInput, AttachmentKind, DatasetInput } from '../../shared/types'

/** An attachment selected in the composer, before its message is sent. */
export type PendingAttachment = AttachmentInput & {
  id: string
  dataset?: DatasetInput
  /** A non-blocking note for the composer, e.g. a long document was clipped. */
  notice?: string
}

export class AttachmentError extends Error {}

/** File objects from a clipboard paste, including screenshots with no filename. */
export function clipboardFiles(clipboard: DataTransfer | null | undefined): File[] {
  if (!clipboard) return []
  const files = Array.from(clipboard.files)
  if (files.length) return files
  for (const item of Array.from(clipboard.items)) {
    if (item.kind !== 'file') continue
    const file = item.getAsFile()
    if (file) files.push(file)
  }
  return files
}

export const ATTACHMENT_ACCEPT =
  'image/png,image/jpeg,image/webp,image/gif,.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.txt,.md,.markdown,.csv,.tsv,.xlsx,.xls,.json,.js,.jsx,.ts,.tsx,.css,.html,.htm,.xml,.yaml,.yml,.toml,.ini,.sql,.py,.go,.rs,.java,.c,.cpp,.h,.sh,.log'

const PDF_MIME = 'application/pdf'
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
const IMAGE_SOURCE_BYTES = 20_000_000
const MAX_IMAGE_DIMENSION = 1_600

const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'markdown', 'csv', 'json', 'js', 'jsx', 'ts', 'tsx', 'css', 'html', 'htm',
  'xml', 'yaml', 'yml', 'toml', 'ini', 'sql', 'py', 'go', 'rs', 'java', 'c', 'cpp', 'h',
  'sh', 'log',
])

const TEXT_MIMES = new Set([
  'application/json',
  'application/xml',
  'application/javascript',
  'application/x-javascript',
  'application/x-yaml',
  'application/yaml',
])

const extensionOf = (name: string) => name.toLowerCase().split('.').pop() ?? ''

function normalizeImageMime(type: string): string {
  const normalized = type.toLowerCase().split(';')[0]!.trim()
  return normalized === 'image/jpg' ? 'image/jpeg' : normalized
}

function textMimeFor(file: { name: string; type: string }): string {
  const type = file.type.toLowerCase().split(';')[0]!.trim()
  if (type.startsWith('text/') || TEXT_MIMES.has(type)) return type
  const ext = extensionOf(file.name)
  if (ext === 'json') return 'application/json'
  if (ext === 'xml') return 'application/xml'
  if (ext === 'md' || ext === 'markdown') return 'text/markdown'
  if (ext === 'csv') return 'text/csv'
  if (ext === 'html' || ext === 'htm') return 'text/html'
  if (ext === 'yaml' || ext === 'yml' || ext === 'toml') return 'text/plain'
  return 'text/plain'
}

const readAsDataUrl = (file: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(new AttachmentError('Could not read that image.'))
    reader.readAsDataURL(file)
  })

const canvasBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))

async function compressImage(file: File, name: string): Promise<AttachmentInput> {
  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) {
    // Some browsers cannot decode every format they accept. At least keep a
    // small original instead of failing on a file the browser can display.
    if (file.size > MAX_ATTACHMENT_BYTES) throw new AttachmentError('That image could not be resized. Try a JPG or PNG.')
    const data = await readAsDataUrl(file)
    return { name, mime: normalizeImageMime(file.type), size: file.size, kind: 'image', data }
  }

  try {
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new AttachmentError('Could not prepare that image.')
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

    // WebP keeps screenshot text sharp at a fraction of PNG's size. Fall back
    // to JPEG where the browser does not implement the encoder.
    let blob = await canvasBlob(canvas, 'image/webp', 0.9)
    if (!blob || blob.size > MAX_ATTACHMENT_BYTES) blob = await canvasBlob(canvas, 'image/jpeg', 0.86)
    if (!blob) throw new AttachmentError('Could not prepare that image.')
    if (blob.size > MAX_ATTACHMENT_BYTES) throw new AttachmentError('That image is still too large after resizing. Try a smaller screenshot.')
    return {
      name,
      mime: blob.type || 'image/jpeg',
      size: blob.size,
      kind: 'image',
      data: await readAsDataUrl(blob),
    }
  } finally {
    bitmap.close()
  }
}

/** PDF text is extracted entirely in this browser and sent as a text attachment. */
async function extractPdf(file: File): Promise<string> {
  try {
    // The legacy build carries its own small polyfills. The modern build assumes
    // `Uint8Array.prototype.toHex`, which older Chromium/Electron shells lack.
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const worker = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default
    const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
    try {
      const loaded = await task.promise
      const pages: string[] = []
      for (let number = 1; number <= loaded.numPages; number += 1) {
        const page = await loaded.getPage(number)
        const content = await page.getTextContent()
        let pageText = ''
        for (const item of content.items) {
          if (!('str' in item)) continue
          pageText += item.str
          pageText += item.hasEOL ? '\n' : ' '
        }
        pages.push(pageText)
        page.cleanup()
      }
      return pages.join('\n\n')
    } finally {
      await task.destroy()
    }
  } catch (error) {
    if (error instanceof AttachmentError) throw error
    if (error instanceof Error && /password/i.test(`${error.name} ${error.message}`)) {
      throw new AttachmentError('That PDF is password-protected. Remove the password and try again.')
    }
    throw new AttachmentError('That PDF could not be read. Try a text-based PDF.')
  }
}

/** DOCX is a zip of XML; mammoth reads it in the browser too. */
async function extractDocx(file: File): Promise<string> {
  try {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
    return result.value
  } catch {
    throw new AttachmentError('That DOCX could not be read. Re-save it as .docx and try again.')
  }
}

async function readDocument(file: File, name: string, extension: 'pdf' | 'docx'): Promise<PendingAttachment> {
  if (file.size > MAX_DOCUMENT_SOURCE_BYTES) {
    throw new AttachmentError(`Documents can be up to ${MAX_DOCUMENT_SOURCE_BYTES / 1_000_000} MB.`)
  }
  const raw = extension === 'pdf' ? await extractPdf(file) : await extractDocx(file)
  const { text, truncated } = normalizeDocumentText(raw, MAX_TEXT_ATTACHMENT_CHARS)
  if (!text.trim()) {
    throw new AttachmentError('That document has no selectable text. Scanned PDFs and image-only files are not supported yet.')
  }
  return {
    id: crypto.randomUUID(),
    name,
    mime: 'text/plain',
    size: new TextEncoder().encode(text).byteLength,
    kind: 'text',
    data: text,
    ...(truncated
      ? { notice: `${name} is long: the first ${MAX_TEXT_ATTACHMENT_CHARS.toLocaleString()} characters were attached.` }
      : {}),
  }
}

/** Reads a picked file into the compact shape sent with the chat request. */
export async function readAttachment(file: File): Promise<PendingAttachment> {
  const mime = normalizeImageMime(file.type)
  // Clipboard images can arrive without a name. Give them one so the server
  // and the transcript have something useful to show.
  const name =
    file.name.trim() ||
    (file.type.startsWith('image/')
      ? `pasted-image.${mime.split('/')[1] || 'png'}`
      : mime === PDF_MIME
        ? 'pasted-document.pdf'
        : mime === DOCX_MIME
          ? 'pasted-document.docx'
          : 'pasted-file.txt')
  if (file.type.startsWith('image/')) {
    if (!IMAGE_TYPES.has(mime)) throw new AttachmentError('Use a PNG, JPG, WebP or GIF image.')
    if (file.size > IMAGE_SOURCE_BYTES) throw new AttachmentError('That image is too large. Try a screenshot under 20 MB.')
    const attachment = await compressImage(file, name)
    return { ...attachment, id: crypto.randomUUID() }
  }

  const ext = extensionOf(name)
  if (ext === 'doc' || mime === 'application/msword') {
    throw new AttachmentError('Legacy .doc files are not supported. Save it as .docx or PDF and attach that.')
  }
  if (isDocumentFile(name) || mime === PDF_MIME || mime === DOCX_MIME) {
    const extension = ext === 'pdf' || ext === 'docx' ? ext : mime === PDF_MIME ? 'pdf' : 'docx'
    return readDocument(file, name, extension)
  }
  const isText = file.type.startsWith('text/') || TEXT_MIMES.has(mime) || TEXT_EXTENSIONS.has(ext)
  if (!isText) throw new AttachmentError('Attach an image, a PDF/DOCX document, or a text/code file.')
  if (file.size > MAX_TEXT_ATTACHMENT_CHARS * 4) throw new AttachmentError(`Text files can be up to ${MAX_TEXT_ATTACHMENT_CHARS.toLocaleString()} characters.`)
  const data = (await file.text()).replace(/^\uFEFF/, '')
  if (data.length > MAX_TEXT_ATTACHMENT_CHARS) throw new AttachmentError(`Text files can be up to ${MAX_TEXT_ATTACHMENT_CHARS.toLocaleString()} characters.`)
  return {
    id: crypto.randomUUID(),
    name,
    mime: textMimeFor({ name, type: file.type }),
    size: new TextEncoder().encode(data).byteLength,
    kind: 'text',
    data,
  }
}

/** Converts a picked attachment into the message shape shown before the server replies. */
export function attachmentPreview(attachment: PendingAttachment): {
  id: string
  name: string
  mime: string
  size: number
  kind: AttachmentKind
  url?: string
} {
  return {
    id: attachment.id,
    name: attachment.name,
    mime: attachment.mime,
    size: attachment.size,
    kind: attachment.kind,
    ...(attachment.kind === 'image' ? { url: attachment.data } : {}),
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1_000) return `${bytes} B`
  if (bytes < 1_000_000) return `${Math.round(bytes / 1_000)} KB`
  return `${(bytes / 1_000_000).toFixed(1)} MB`
}

export { MAX_ATTACHMENTS }
