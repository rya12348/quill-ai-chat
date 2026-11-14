// SheetJS has no fixed npm release for its parser advisories. Keep every
// untrusted workbook out of the app page: a disposable worker parses it, the
// main thread receives only plain strings/rows, and a timed-out worker is
// terminated so a crafted file cannot hang the tab.

type Reply = {
  id: number
  ok: boolean
  csv?: string
  sheetName?: string
  rows?: unknown[][]
  error?: string
}

type Pending = {
  resolve: (reply: Reply) => void
  reject: (error: Error) => void
  timer: number
}

const TIMEOUT_MS = 15_000
let worker: Worker | undefined
let nextId = 1
const pending = new Map<number, Pending>()

function failAll(message: string): void {
  for (const entry of pending.values()) {
    window.clearTimeout(entry.timer)
    entry.reject(new Error(message))
  }
  pending.clear()
  worker?.terminate()
  worker = undefined
}

function getWorker(): Worker {
  if (worker) return worker
  if (typeof Worker === 'undefined') throw new Error('This browser cannot read spreadsheets here.')
  worker = new Worker(new URL('./xlsx-worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (event: MessageEvent<Reply>) => {
    const reply = event.data
    const entry = pending.get(reply.id)
    if (!entry) return
    pending.delete(reply.id)
    window.clearTimeout(entry.timer)
    if (reply.ok) entry.resolve(reply)
    else entry.reject(new Error(reply.error || 'That spreadsheet could not be read.'))
  }
  worker.onerror = (event) => {
    event.preventDefault()
    failAll('That spreadsheet could not be read safely.')
  }
  return worker
}

/** Node-only fallback for unit tests; browsers always use the worker. */
async function readForNode(kind: 'csv' | 'rows', buffer: ArrayBuffer): Promise<Reply> {
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const first = workbook.SheetNames[0]
  if (!first) throw new Error('That workbook has no sheets.')
  const sheet = workbook.Sheets[first]
  if (!sheet) throw new Error('That workbook sheet could not be read.')
  if (kind === 'csv') {
    return { id: 0, ok: true, csv: XLSX.utils.sheet_to_csv(sheet, { blankrows: false }).replace(/\r\n?/g, '\n') }
  }
  return {
    id: 0,
    ok: true,
    sheetName: first,
    rows: XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: '' }),
  }
}

function request(kind: 'csv' | 'rows', buffer: ArrayBuffer): Promise<Reply> {
  let active: Worker
  try {
    active = getWorker()
  } catch (error) {
    return Promise.reject(error)
  }
  const id = nextId++
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      pending.delete(id)
      failAll('That spreadsheet took too long to read.')
    }, TIMEOUT_MS)
    pending.set(id, { resolve, reject, timer })
    try {
      active.postMessage({ id, kind, buffer }, [buffer])
    } catch (error) {
      pending.delete(id)
      window.clearTimeout(timer)
      reject(error instanceof Error ? error : new Error('That spreadsheet could not be read.'))
    }
  })
}

/** Convert the first sheet to CSV without exposing the parser to app state. */
export async function readXlsxCsv(buffer: ArrayBuffer): Promise<string> {
  const reply = typeof window === 'undefined' ? await readForNode('csv', buffer) : await request('csv', buffer)
  return reply.csv ?? ''
}

/** Read the first sheet as rows without exposing the parser to app state. */
export async function readXlsxRows(buffer: ArrayBuffer): Promise<{ sheetName: string; rows: unknown[][] }> {
  const reply = typeof window === 'undefined' ? await readForNode('rows', buffer) : await request('rows', buffer)
  return { sheetName: reply.sheetName || 'Sheet1', rows: reply.rows ?? [] }
}
