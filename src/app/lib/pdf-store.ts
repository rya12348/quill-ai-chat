/** Generated files stay on this device; only metadata needs to be listed. */

export type SavedPdfFile = {
  id: string
  name: string
  size: number
  pages?: number
  tool: string
  createdAt: number
  blob: Blob
}

const DATABASE = 'quill-pdf-studio'
const STORE = 'files'
const MAX_FILES = 12
const MAX_BYTES = 40 * 1024 * 1024

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('This browser cannot keep a local file history.'))
      return
    }
    const request = indexedDB.open(DATABASE, 1)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE)) database.createObjectStore(STORE, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('The local file history could not be opened.'))
  })
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('The local file history request failed.'))
  })
}

export async function listSavedPdfs(): Promise<SavedPdfFile[]> {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(STORE, 'readonly')
    const files = await requestResult(transaction.objectStore(STORE).getAll() as IDBRequest<SavedPdfFile[]>)
    return files.sort((a, b) => b.createdAt - a.createdAt)
  } finally {
    database.close()
  }
}

export async function savePdfFile(input: { blob: Blob; name: string; pages?: number; tool: string }): Promise<SavedPdfFile> {
  const database = await openDatabase()
  const record: SavedPdfFile = {
    id: crypto.randomUUID(),
    name: input.name,
    size: input.blob.size,
    pages: input.pages,
    tool: input.tool,
    createdAt: Date.now(),
    blob: input.blob,
  }
  try {
    const existing = await requestResult(database.transaction(STORE, 'readonly').objectStore(STORE).getAll() as IDBRequest<SavedPdfFile[]>)
    const transaction = database.transaction(STORE, 'readwrite')
    const store = transaction.objectStore(STORE)
    store.put(record)
    let total = record.size
    const keep: SavedPdfFile[] = []
    for (const file of existing.sort((a, b) => b.createdAt - a.createdAt)) {
      if (keep.length >= MAX_FILES - 1 || total + file.size > MAX_BYTES) {
        store.delete(file.id)
      } else {
        keep.push(file)
        total += file.size
      }
    }
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('This file could not be saved locally.'))
      transaction.onabort = () => reject(transaction.error ?? new Error('This file could not be saved locally.'))
    })
    return record
  } finally {
    database.close()
  }
}

export async function deleteSavedPdf(id: string): Promise<void> {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(STORE, 'readwrite')
    transaction.objectStore(STORE).delete(id)
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('This file could not be removed.'))
    })
  } finally {
    database.close()
  }
}

export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}
