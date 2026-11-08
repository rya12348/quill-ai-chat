// Analyze data stays here. The browser reads the file, keeps the full text for
// the sandbox, and sends only the profile and a small sample to the Worker.

import { MAX_DATASET_BYTES, MAX_DATASET_COLUMNS, MAX_DATASET_ROWS, MAX_DATASET_SAMPLE_CHARS } from '../../shared/config'
import { profileCsv } from '../../shared/csv'
import type { DatasetInput } from '../../shared/types'
import type { PendingAttachment } from './attachments'

export const DATA_EXTENSIONS = new Set(['csv', 'tsv', 'xlsx', 'xls'])
export const DATA_ACCEPT = '.csv,.tsv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel'

export const isDataFile = (name: string) => DATA_EXTENSIONS.has(name.toLowerCase().split('.').pop() ?? '')

export function buildDataset(name: string, mime: string, size: number, csv: string): DatasetInput {
  const profile = profileCsv(csv, MAX_DATASET_SAMPLE_CHARS)
  if (!profile) throw new Error('That file needs a header and at least one data row.')
  if (profile.rows > MAX_DATASET_ROWS) throw new Error(`Analyze supports up to ${MAX_DATASET_ROWS.toLocaleString()} rows.`)
  if (profile.columns.length > MAX_DATASET_COLUMNS) throw new Error(`Analyze supports up to ${MAX_DATASET_COLUMNS} columns.`)
  return {
    id: crypto.randomUUID(),
    name,
    mime,
    size,
    rows: profile.rows,
    columns: profile.columns,
    sample: profile.sample,
  }
}

/** Converts the first sheet of an XLSX workbook to CSV entirely in the browser. */
async function xlsxToCsv(file: File): Promise<string> {
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true })
  const first = workbook.SheetNames[0]
  if (!first) throw new Error('That workbook has no sheets.')
  return XLSX.utils.sheet_to_csv(workbook.Sheets[first]!, { blankrows: false }).replace(/\r\n?/g, '\n')
}

/** Reads a table file and returns the composer attachment plus its profile. */
export async function readDataFile(file: File): Promise<PendingAttachment> {
  if (!isDataFile(file.name)) throw new Error('Analyze accepts CSV, TSV or XLSX files.')
  if (file.size > MAX_DATASET_BYTES) throw new Error('That dataset is too large. Try a file under 2 MB.')
  const csv = (file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls')
    ? await xlsxToCsv(file)
    : await file.text()
  ).replace(/^\uFEFF/, '')
  if (csv.length > MAX_DATASET_BYTES * 2) throw new Error('That sheet is too large after conversion. Try a smaller table.')
  const dataset = buildDataset(file.name, file.type || 'text/csv', file.size, csv)
  return {
    id: crypto.randomUUID(),
    name: file.name,
    mime: 'text/csv',
    size: new TextEncoder().encode(csv).byteLength,
    kind: 'text',
    data: csv,
    dataset,
  }
}
