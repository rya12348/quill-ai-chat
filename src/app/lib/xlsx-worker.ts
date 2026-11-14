/// <reference lib="webworker" />

import * as XLSX from 'xlsx'

type Request = {
  id: number
  kind: 'csv' | 'rows'
  buffer: ArrayBuffer
}

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<Request>) => void) | null
  postMessage: (message: unknown) => void
}

scope.onmessage = (event) => {
  const { id, kind, buffer } = event.data
  try {
    if (buffer.byteLength > 25_000_000) throw new Error('That spreadsheet is too large.')
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
    const first = workbook.SheetNames[0]
    if (!first) throw new Error('That workbook has no sheets.')
    const sheet = workbook.Sheets[first]
    if (!sheet) throw new Error('That workbook sheet could not be read.')

    if (kind === 'csv') {
      const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false }).replace(/\r\n?/g, '\n')
      scope.postMessage({ id, ok: true, csv })
      return
    }

    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: '' })
    scope.postMessage({ id, ok: true, sheetName: first, rows })
  } catch (error) {
    scope.postMessage({
      id,
      ok: false,
      error: error instanceof Error ? error.message.slice(0, 300) : 'That spreadsheet could not be read.',
    })
  }
}
