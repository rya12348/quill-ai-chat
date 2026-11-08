// The browser owns the full CSV. This small parser is shared with tests so the
// sample, columns and row count sent to the Worker are predictable.

import { MAX_DATASET_COLUMNS } from './config'

export type CsvProfile = {
  delimiter: ',' | '\t'
  columns: string[]
  rows: number
  sample: string
}

export function splitCsvLine(line: string, delimiter: ',' | '\t'): string[] {
  const cells: string[] = []
  let value = ''
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]!
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"'
        index += 1
      } else {
        quoted = !quoted
      }
    } else if (char === delimiter && !quoted) {
      cells.push(value)
      value = ''
    } else {
      value += char
    }
  }
  cells.push(value)
  return cells
}

/** Header, approximate row count and a small sample. */
export function profileCsv(text: string, maxSampleChars = 8_000): CsvProfile | undefined {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const headerIndex = lines.findIndex((line) => line.trim().length > 0)
  if (headerIndex < 0) return undefined
  const header = lines[headerIndex]!
  const tabs = (header.match(/\t/g) ?? []).length
  const commas = (header.match(/,/g) ?? []).length
  const delimiter: ',' | '\t' = tabs > commas ? '\t' : ','
  const columns = splitCsvLine(header, delimiter)
    .map((column) => column.replace(/^\uFEFF/, '').trim().replace(/\s+/g, ' ').slice(0, 120))
    .filter(Boolean)
    .slice(0, MAX_DATASET_COLUMNS)
  if (!columns.length) return undefined
  const dataLines = lines.slice(headerIndex + 1).filter((line) => line.trim().length > 0)
  if (!dataLines.length) return undefined
  return {
    delimiter,
    columns,
    rows: dataLines.length,
    sample: lines.slice(headerIndex, headerIndex + 12).join('\n').slice(0, maxSampleChars),
  }
}
