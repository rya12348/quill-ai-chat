import {
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFOptionList,
  PDFRadioGroup,
  PDFTextField,
  StandardFonts,
  rgb,
} from 'pdf-lib'

import { outputName } from '../../shared/pdf'

export type PdfTextPage = { page: number; text: string; rows: string[][] }
export type PdfFormFieldKind = 'text' | 'checkbox' | 'radio' | 'dropdown' | 'option'
export type PdfFormField = {
  name: string
  kind: PdfFormFieldKind
  value: string
  options?: string[]
  readOnly?: boolean
}
export type CompressionLevel = 'balanced' | 'strong'

type PdfJs = typeof import('pdfjs-dist/legacy/build/pdf.mjs')
type PdfPage = {
  getViewport: (params: { scale: number }) => { width: number; height: number; transform: number[]; scale: number }
  render: (params: { canvasContext: CanvasRenderingContext2D; viewport: unknown; canvas?: HTMLCanvasElement }) => { promise: Promise<void> }
  getTextContent: () => Promise<{ items: unknown[] }>
}
type PdfTextFragment = { str: string; transform: number[]; width: number; height: number }

let pdfjsPromise: Promise<PdfJs> | undefined

async function getPdfJs(): Promise<PdfJs> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
      const worker = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default
      return pdfjs
    })()
  }
  return pdfjsPromise
}

async function loadPdf(bytes: Uint8Array) {
  const pdfjs = await getPdfJs()
  const task = pdfjs.getDocument({ data: new Uint8Array(bytes) })
  try {
    return { document: await task.promise, task }
  } catch (error) {
    await task.destroy()
    throw error
  }
}

function isTextFragment(value: unknown): value is PdfTextFragment {
  return Boolean(value && typeof value === 'object' && 'str' in value && 'transform' in value)
}

function pageText(page: number, fragments: PdfTextFragment[]): PdfTextPage {
  const lines: { y: number; items: PdfTextFragment[] }[] = []
  for (const fragment of fragments) {
    const y = Number(fragment.transform[5] ?? 0)
    let line = lines.find((candidate) => Math.abs(candidate.y - y) <= 2)
    if (!line) {
      line = { y, items: [] }
      lines.push(line)
    }
    line.items.push(fragment)
  }
  lines.sort((a, b) => b.y - a.y)
  const rows = lines.map((line) => {
    const items = line.items.sort((a, b) => Number(a.transform[4] ?? 0) - Number(b.transform[4] ?? 0))
    const cells: string[] = []
    let current = ''
    let end = 0
    for (const item of items) {
      const x = Number(item.transform[4] ?? 0)
      const text = item.str.trim()
      if (!text) continue
      if (current && x - end > 8) {
        cells.push(current.trim())
        current = text
      } else {
        current = current ? `${current} ${text}` : text
      }
      end = x + (Number(item.width) || 0)
    }
    if (current.trim()) cells.push(current.trim())
    return cells
  })
  return {
    page,
    rows,
    text: rows.map((cells) => cells.join('  ')).join('\n'),
  }
}

export async function pdfPageCount(bytes: Uint8Array): Promise<number> {
  const document = await PDFDocument.load(bytes)
  return document.getPageCount()
}

export async function extractPdfText(bytes: Uint8Array): Promise<PdfTextPage[]> {
  const { document, task } = await loadPdf(bytes)
  const pages: PdfTextPage[] = []
  try {
    for (let index = 1; index <= document.numPages; index += 1) {
      const page = (await document.getPage(index)) as unknown as PdfPage
      const content = await page.getTextContent()
      pages.push(pageText(index, content.items.filter(isTextFragment)))
    }
  } finally {
    await task.destroy()
  }
  if (!pages.some((page) => page.text.trim())) {
    throw new Error('This PDF has no selectable text. Use OCR for a scanned document.')
  }
  return pages
}

function bytesBlob(bytes: Uint8Array, type: string): Blob {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return new Blob([copy], { type })
}

export function textBlob(pages: PdfTextPage[]): Blob {
  return new Blob([pages.map((page) => `Page ${page.page}\n\n${page.text}`).join('\n\n\n')], { type: 'text/plain;charset=utf-8' })
}

export async function pdfToDocx(pages: PdfTextPage[]): Promise<Blob> {
  const { Document, Packer, PageBreak, Paragraph, TextRun } = await import('docx')
  const children: import('docx').Paragraph[] = []
  pages.forEach((page, pageIndex) => {
    if (pageIndex > 0) children.push(new Paragraph({ children: [new PageBreak()] }))
    if (!page.rows.length) children.push(new Paragraph({ children: [new TextRun('')] }))
    for (const cells of page.rows) {
      children.push(new Paragraph({ children: [new TextRun(cells.join('\t'))] }))
    }
  })
  return Packer.toBlob(new Document({ sections: [{ properties: {}, children }] }))
}

export async function pdfToWorkbook(pages: PdfTextPage[]): Promise<Blob> {
  const XLSX = await import('xlsx')
  const workbook = XLSX.utils.book_new()
  for (const page of pages) {
    const sheet = XLSX.utils.aoa_to_sheet(page.rows.length ? page.rows : [['No selectable text on this page']])
    sheet['!cols'] = (page.rows[0] ?? []).map((cell) => ({ wch: Math.min(60, Math.max(12, cell.length + 2)) }))
    XLSX.utils.book_append_sheet(workbook, sheet, `Page ${page.page}`.slice(0, 31))
  }
  const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as Uint8Array
  return bytesBlob(bytes, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
}

function pdfSafe(text: string): string {
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[^\t\n\r\x20-\x7e\xa0-\xff]/g, '?')
}

function wrapLines(text: string, font: { widthOfTextAtSize: (text: string, size: number) => number }, size: number, width: number): string[] {
  const lines: string[] = []
  for (const paragraph of pdfSafe(text).split('\n')) {
    if (!paragraph.trim()) {
      lines.push('')
      continue
    }
    const words = paragraph.split(/\s+/)
    let line = ''
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word
      if (!line || font.widthOfTextAtSize(candidate, size) <= width) {
        line = candidate
        continue
      }
      lines.push(line)
      line = word
    }
    if (line) lines.push(line)
  }
  return lines
}

async function textPdf(text: string, title: string): Promise<Uint8Array> {
  const document = await PDFDocument.create()
  const font = await document.embedFont(StandardFonts.Helvetica)
  const bold = await document.embedFont(StandardFonts.HelveticaBold)
  const pageWidth = 595.28
  const pageHeight = 841.89
  const margin = 54
  let page = document.addPage([pageWidth, pageHeight])
  let y = pageHeight - margin
  const ensurePage = () => {
    if (y >= margin) return
    page = document.addPage([pageWidth, pageHeight])
    y = pageHeight - margin
  }
  page.drawText(pdfSafe(title), { x: margin, y, font: bold, size: 17, color: rgb(0.1, 0.1, 0.09) })
  y -= 30
  const chunks = wrapLines(text, font, 10.5, pageWidth - margin * 2)
  for (const line of chunks) {
    ensurePage()
    page.drawText(line, { x: margin, y, font, size: 10.5, color: rgb(0.16, 0.15, 0.14) })
    y -= 15
  }
  const pages = document.getPages()
  pages.forEach((item, index) => {
    item.drawText(`Page ${index + 1} of ${pages.length}`, {
      x: margin,
      y: 25,
      font,
      size: 8,
      color: rgb(0.55, 0.53, 0.5),
    })
  })
  return document.save()
}

export async function textFileToPdf(file: File): Promise<Uint8Array> {
  const text = await file.text()
  if (!text.trim()) throw new Error('That file is empty.')
  return textPdf(text.slice(0, 300_000), file.name)
}

export async function docxToPdf(file: File): Promise<Uint8Array> {
  const mammoth = await import('mammoth')
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
  const text = result.value.trim()
  if (!text) throw new Error('That Word file has no readable text.')
  return textPdf(text.slice(0, 300_000), file.name)
}

async function tablePdf(rows: string[][], title: string): Promise<{ bytes: Uint8Array; note: string }> {
  const document = await PDFDocument.create()
  const font = await document.embedFont(StandardFonts.Helvetica)
  const bold = await document.embedFont(StandardFonts.HelveticaBold)
  const pageWidth = 841.89
  const pageHeight = 595.28
  const margin = 36
  const maxRows = 500
  const maxColumns = 12
  const limited = rows.slice(0, maxRows).map((row) => row.slice(0, maxColumns))
  const columns = Math.max(1, ...limited.map((row) => row.length))
  const width = (pageWidth - margin * 2) / columns
  let page = document.addPage([pageWidth, pageHeight])
  let y = pageHeight - margin
  page.drawText(pdfSafe(title), { x: margin, y, font: bold, size: 14, color: rgb(0.1, 0.1, 0.09) })
  y -= 24
  const nextPage = () => {
    page = document.addPage([pageWidth, pageHeight])
    y = pageHeight - margin
    page.drawText(pdfSafe(title), { x: margin, y, font: bold, size: 14, color: rgb(0.1, 0.1, 0.09) })
    y -= 24
  }
  limited.forEach((row, rowIndex) => {
    if (y < margin + 16) nextPage()
    const header = rowIndex === 0
    for (let column = 0; column < columns; column += 1) {
      const value = pdfSafe(row[column] ?? '')
      const maxWidth = width - 8
      let display = value
      while (display.length > 1 && font.widthOfTextAtSize(display, 7) > maxWidth) display = display.slice(0, -2)
      if (display !== value) display = `${display}...`
      page.drawRectangle({
        x: margin + column * width,
        y: y - 12,
        width,
        height: 16,
        borderColor: rgb(0.84, 0.82, 0.78),
        borderWidth: 0.5,
        color: header ? rgb(0.94, 0.93, 0.9) : undefined,
      })
      page.drawText(display, {
        x: margin + column * width + 4,
        y: y - 8,
        font: header ? bold : font,
        size: 7,
        color: rgb(0.16, 0.15, 0.14),
      })
    }
    y -= 16
  })
  return {
    bytes: await document.save(),
    note:
      rows.length > maxRows || rows.some((row) => row.length > maxColumns)
        ? `Converted the first ${maxRows} rows and ${maxColumns} columns.`
        : 'Table layout is simplified to fit the page.',
  }
}

export async function sheetToPdf(file: File): Promise<{ bytes: Uint8Array; note: string }> {
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) throw new Error('That spreadsheet has no sheets.')
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) throw new Error('That spreadsheet sheet could not be read.')
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: '' }).map((row) =>
    row.map((cell) => (cell instanceof Date ? cell.toLocaleDateString() : String(cell ?? ''))),
  )
  if (!rows.length) throw new Error('That spreadsheet is empty.')
  return tablePdf(rows, `${sheetName} · ${file.name}`)
}

async function renderPage(page: PdfPage, scale: number): Promise<HTMLCanvasElement> {
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.ceil(viewport.width))
  canvas.height = Math.max(1, Math.ceil(viewport.height))
  const context = canvas.getContext('2d', { alpha: false })
  if (!context) throw new Error('This browser could not prepare a canvas for the PDF.')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvasContext: context, viewport, canvas }).promise
  return canvas
}

export async function renderPdfPreview(bytes: Uint8Array, maxWidth = 540): Promise<{ dataUrl: string; pageCount: number; width: number; height: number }> {
  const { document, task } = await loadPdf(bytes)
  try {
    const page = (await document.getPage(1)) as unknown as PdfPage
    const original = page.getViewport({ scale: 1 })
    const scale = Math.min(2, maxWidth / original.width)
    const canvas = await renderPage(page, scale)
    return { dataUrl: canvas.toDataURL('image/png'), pageCount: document.numPages, width: canvas.width, height: canvas.height }
  } finally {
    await task.destroy()
  }
}

export async function compressPdf(bytes: Uint8Array, level: CompressionLevel): Promise<{ bytes: Uint8Array; note: string }> {
  const { document, task } = await loadPdf(bytes)
  const pageCount = document.numPages
  const output = await PDFDocument.create()
  const scale = level === 'strong' ? 0.9 : 1.25
  const quality = level === 'strong' ? 0.46 : 0.68
  try {
    for (let index = 1; index <= document.numPages; index += 1) {
      const page = (await document.getPage(index)) as unknown as PdfPage
      const viewport = page.getViewport({ scale: 1 })
      const canvas = await renderPage(page, scale)
      const image = await output.embedJpg(canvas.toDataURL('image/jpeg', quality))
      const target = output.addPage([viewport.width, viewport.height])
      target.drawImage(image, { x: 0, y: 0, width: viewport.width, height: viewport.height })
    }
  } finally {
    await task.destroy()
  }
  const compressed = await output.save()
  if (compressed.byteLength >= bytes.byteLength) {
    return { bytes, note: 'This PDF is already smaller than a flattened copy, so the original was kept.' }
  }
  return {
    bytes: compressed,
    note: `Flattened and recompressed ${pageCount} page${pageCount === 1 ? '' : 's'}. Selectable text is removed.`,
  }
}

export async function redactPdf(bytes: Uint8Array, terms: string[]): Promise<{ bytes: Uint8Array; note: string }> {
  const needles = terms.map((term) => term.trim()).filter(Boolean)
  if (!needles.length) throw new Error('Enter at least one word or phrase to redact.')
  const pdfjs = await getPdfJs()
  const { document, task } = await loadPdf(bytes)
  const output = await PDFDocument.create()
  let matches = 0
  try {
    for (let index = 1; index <= document.numPages; index += 1) {
      const page = (await document.getPage(index)) as unknown as PdfPage
      const viewport = page.getViewport({ scale: 2 })
      const canvas = await renderPage(page, 2)
      const context = canvas.getContext('2d')
      if (!context) throw new Error('This browser could not prepare the redaction canvas.')
      const content = await page.getTextContent()
      context.fillStyle = '#000000'
      for (const item of content.items.filter(isTextFragment)) {
        const value = item.str.toLowerCase()
        if (!needles.some((needle) => value.includes(needle.toLowerCase()))) continue
        const tx = pdfjs.Util.transform(viewport.transform, item.transform)
        const fontHeight = Math.hypot(tx[2] ?? 0, tx[3] ?? 0)
        const x = tx[4] ?? 0
        const baseline = viewport.height - (tx[5] ?? 0)
        context.fillRect(x - 1, baseline - fontHeight + 1, item.width * viewport.scale + 4, fontHeight * 1.15)
        matches += 1
      }
      const image = await output.embedJpg(canvas.toDataURL('image/jpeg', 0.92))
      const original = page.getViewport({ scale: 1 })
      const target = output.addPage([original.width, original.height])
      target.drawImage(image, { x: 0, y: 0, width: original.width, height: original.height })
    }
  } finally {
    await task.destroy()
  }
  if (!matches) throw new Error('No matching text was found. Nothing was created.')
  return {
    bytes: await output.save(),
    note: `Flattened copy with ${matches} matched text run${matches === 1 ? '' : 's'} blacked out. Selectable text is removed.`,
  }
}

export async function signPdf(bytes: Uint8Array, signatureDataUrl: string, pageNumber: number): Promise<Uint8Array> {
  const document = await PDFDocument.load(bytes)
  const pages = document.getPages()
  if (!pages.length) throw new Error('That PDF has no pages.')
  const page = pages[Math.min(Math.max(1, Math.round(pageNumber)), pages.length) - 1]
  if (!page) throw new Error('Choose a page that exists.')
  const signature = await document.embedPng(signatureDataUrl)
  const ratio = signature.height / signature.width
  const width = Math.min(180, page.getWidth() * 0.38)
  page.drawImage(signature, {
    x: Math.max(36, page.getWidth() - width - 48),
    y: 46,
    width,
    height: width * ratio,
  })
  return document.save()
}

export async function readPdfFormFields(bytes: Uint8Array): Promise<PdfFormField[]> {
  const document = await PDFDocument.load(bytes)
  const fields: PdfFormField[] = []
  for (const field of document.getForm().getFields()) {
    const name = field.getName()
    if (field instanceof PDFTextField) {
      fields.push({ name, kind: 'text', value: field.getText() ?? '', readOnly: field.isReadOnly() })
    } else if (field instanceof PDFCheckBox) {
      fields.push({ name, kind: 'checkbox', value: field.isChecked() ? 'true' : 'false', readOnly: field.isReadOnly() })
    } else if (field instanceof PDFRadioGroup) {
      fields.push({ name, kind: 'radio', value: field.getSelected() ?? '', options: field.getOptions(), readOnly: field.isReadOnly() })
    } else if (field instanceof PDFDropdown) {
      fields.push({ name, kind: 'dropdown', value: field.getSelected()[0] ?? '', options: field.getOptions(), readOnly: field.isReadOnly() })
    } else if (field instanceof PDFOptionList) {
      fields.push({ name, kind: 'option', value: field.getSelected()[0] ?? '', options: field.getOptions(), readOnly: field.isReadOnly() })
    }
  }
  return fields
}

export async function fillPdfForm(bytes: Uint8Array, values: Record<string, string>, flatten: boolean): Promise<Uint8Array> {
  const document = await PDFDocument.load(bytes)
  const form = document.getForm()
  for (const [name, value] of Object.entries(values)) {
    const field = form.getFieldMaybe(name)
    if (!field || field.isReadOnly()) continue
    if (field instanceof PDFTextField) field.setText(value)
    else if (field instanceof PDFCheckBox) (value === 'true' ? field.check() : field.uncheck())
    else if (field instanceof PDFRadioGroup) {
      if (value) field.select(value)
      else field.clear()
    } else if (field instanceof PDFDropdown) {
      if (value) field.select(value)
      else field.clear()
    } else if (field instanceof PDFOptionList) {
      if (value) field.select(value)
      else field.clear()
    }
  }
  if (flatten) form.flatten({ updateFieldAppearances: true })
  return document.save()
}

export async function ocrPdf(bytes: Uint8Array, onProgress?: (message: string) => void): Promise<{ pages: PdfTextPage[]; text: string }> {
  const { document, task } = await loadPdf(bytes)
  const Tesseract = await import('tesseract.js')
  const worker = await Tesseract.createWorker('eng', 1, {
    logger: (message) => onProgress?.(message.status === 'recognizing text' ? `Reading page text… ${Math.round(message.progress * 100)}%` : `Preparing OCR…`),
  })
  const pages: PdfTextPage[] = []
  try {
    for (let index = 1; index <= document.numPages; index += 1) {
      onProgress?.(`Reading page ${index} of ${document.numPages}…`)
      const page = (await document.getPage(index)) as unknown as PdfPage
      const canvas = await renderPage(page, 2)
      const result = await worker.recognize(canvas)
      const text = result.data.text.trim()
      pages.push({ page: index, text, rows: text.split('\n').map((line) => [line]) })
    }
  } finally {
    await worker.terminate()
    await task.destroy()
  }
  if (!pages.some((page) => page.text)) throw new Error('OCR did not find any readable text in this PDF.')
  return { pages, text: pages.map((page) => `Page ${page.page}\n\n${page.text}`).join('\n\n\n') }
}

export { outputName }
