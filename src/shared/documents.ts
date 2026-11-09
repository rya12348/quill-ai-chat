/** PDFs and DOCX files are read in the browser; the Worker only receives text. */
export const DOCUMENT_EXTENSIONS = new Set(['pdf', 'docx'])

const extensionOf = (name: string) => name.toLowerCase().split('.').pop() ?? ''

export const isDocumentFile = (name: string) => DOCUMENT_EXTENSIONS.has(extensionOf(name))

/**
 * PDF and DOCX extraction leaves hard line breaks inside sentences and runs of
 * blank lines between blocks. Collapse that noise, then cap the text so one
 * document cannot exceed the attachment limit. The cap says what was dropped:
 * the model should never imply it read a page it was not given.
 */
export function normalizeDocumentText(raw: string, maxChars: number): { text: string; truncated: boolean } {
  const cleaned = raw
    .replace(/\r\n?/g, '\n')
    .replace(/\u0000/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  if (cleaned.length <= maxChars) return { text: cleaned, truncated: false }

  // Leave room for the notice inside the same limit the Worker enforces.
  const room = Math.max(0, maxChars - 120)
  const cut = cleaned.slice(0, room)
  const boundary = cut.lastIndexOf(' ')
  const body = (boundary > room * 0.85 ? cut.slice(0, boundary) : cut).trimEnd()
  const dropped = cleaned.length - body.length
  const note = `\n\n[Document truncated: ${dropped.toLocaleString()} characters were not attached.]`
  const text = body + note
  return { text: text.length > maxChars ? text.slice(0, maxChars) : text, truncated: true }
}
