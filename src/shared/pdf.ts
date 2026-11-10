/** Shared, browser-safe helpers for the PDF Studio. */

export type PdfFileKind = 'pdf' | 'docx' | 'sheet' | 'text' | 'other'

export function pdfFileKind(name: string): PdfFileKind {
  const extension = name.toLowerCase().split('.').pop() ?? ''
  if (extension === 'pdf') return 'pdf'
  if (extension === 'docx') return 'docx'
  if (extension === 'xlsx' || extension === 'xls') return 'sheet'
  if (extension === 'txt' || extension === 'md' || extension === 'markdown' || extension === 'csv') return 'text'
  return 'other'
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  if (bytes < 1_024) return `${Math.round(bytes)} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1_024
  let unit = 0
  while (value >= 1_024 && unit < units.length - 1) {
    value /= 1_024
    unit += 1
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`
}

export function outputName(source: string, suffix: string, extension = 'pdf'): string {
  const dot = source.lastIndexOf('.')
  const base = (dot > 0 ? source.slice(0, dot) : source).trim()
  const safeSuffix = suffix.trim().replace(/[^a-z0-9_-]+/gi, '-') || 'result'
  return base ? `${base}-${safeSuffix}.${extension}` : `${safeSuffix}.${extension}`
}

/**
 * Parses a human page range such as `1-3, 5` into sorted one-based pages.
 * An empty value means every page. Out-of-range or malformed input is rejected
 * rather than silently producing a surprising file.
 */
export function parsePageSelection(input: string, pageCount: number): number[] {
  const value = input.trim()
  if (!value) return Array.from({ length: pageCount }, (_, index) => index + 1)
  if (!Number.isInteger(pageCount) || pageCount < 1) throw new Error('That PDF has no pages.')
  const pages = new Set<number>()
  for (const raw of value.split(',')) {
    const token = raw.trim()
    if (!token) throw new Error('Use page numbers or ranges, such as 1-3, 5.')
    const parts = token.split('-').map((part) => part.trim())
    if (parts.length > 2 || parts.some((part) => !/^\d+$/.test(part))) {
      throw new Error('Use page numbers or ranges, such as 1-3, 5.')
    }
    const start = Number(parts[0])
    const end = parts.length === 1 ? start : Number(parts[1])
    if (start < 1 || end < 1 || start > pageCount || end > pageCount) {
      throw new Error(`That PDF has ${pageCount} page${pageCount === 1 ? '' : 's'}.`)
    }
    if (start > end) throw new Error('Page ranges must go from low to high, such as 1-3.')
    for (let page = start; page <= end; page += 1) pages.add(page)
  }
  return [...pages].sort((a, b) => a - b)
}
