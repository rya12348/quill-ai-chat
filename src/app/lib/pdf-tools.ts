import { PDFDocument, degrees } from 'pdf-lib'

/** Core PDF edits that do not need a canvas, so they also run in tests. */

async function load(source: Uint8Array): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(source)
  } catch {
    throw new Error('That PDF could not be opened. It may be damaged or password-protected.')
  }
}

function uniquePages(pages: number[], pageCount: number): number[] {
  const selected = [...new Set(pages)].filter((page) => Number.isInteger(page) && page >= 1 && page <= pageCount)
  if (!selected.length) throw new Error('Choose at least one page.')
  return selected.sort((a, b) => a - b)
}

export async function mergePdfs(sources: Uint8Array[]): Promise<Uint8Array> {
  if (sources.length < 2) throw new Error('Choose at least two PDFs to merge.')
  const output = await PDFDocument.create()
  for (const source of sources) {
    const document = await load(source)
    const pages = await output.copyPages(document, document.getPageIndices())
    pages.forEach((page) => output.addPage(page))
  }
  return output.save()
}

export async function extractPdfPages(source: Uint8Array, pages: number[]): Promise<Uint8Array> {
  const document = await load(source)
  const selected = uniquePages(pages, document.getPageCount())
  const output = await PDFDocument.create()
  const copied = await output.copyPages(document, selected.map((page) => page - 1))
  copied.forEach((page) => output.addPage(page))
  return output.save()
}

export async function rotatePdf(source: Uint8Array, pages: number[], angle: number): Promise<Uint8Array> {
  if (!Number.isFinite(angle) || angle % 90 !== 0) throw new Error('Choose a 90°, 180° or 270° rotation.')
  const document = await load(source)
  const selected = new Set(uniquePages(pages, document.getPageCount()))
  document.getPages().forEach((page, index) => {
    if (!selected.has(index + 1)) return
    const current = page.getRotation().angle
    page.setRotation(degrees(((current + angle) % 360 + 360) % 360))
  })
  return document.save()
}
