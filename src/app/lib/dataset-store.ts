// Browser-only storage for Analyze datasets. Nothing here is sent to D1. A
// different browser or cleared site data means a saved analysis cannot rerun
// until the file is attached again.

import type { DatasetInput } from '../../shared/types'

const DB_NAME = 'quill-datasets'
const STORE = 'datasets'
const VERSION = 1

type StoredDataset = { id: string; dataset: DatasetInput; csv: string }

const memory = new Map<string, StoredDataset>()

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)
  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, VERSION)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(null)
    request.onblocked = () => resolve(null)
  })
}

export async function putDataset(dataset: DatasetInput, csv: string): Promise<void> {
  const value: StoredDataset = { id: dataset.id, dataset, csv }
  memory.set(dataset.id, value)
  const db = await openDb()
  if (!db) return
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(value)
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
    tx.onabort = () => resolve()
  })
  db.close()
}

export async function getDataset(id: string): Promise<StoredDataset | null> {
  const cached = memory.get(id)
  if (cached) return cached
  const db = await openDb()
  if (!db) return null
  const value = await new Promise<StoredDataset | null>((resolve) => {
    const tx = db.transaction(STORE, 'readonly')
    const request = tx.objectStore(STORE).get(id)
    request.onsuccess = () => resolve((request.result as StoredDataset | undefined) ?? null)
    request.onerror = () => resolve(null)
  })
  db.close()
  if (value) memory.set(id, value)
  return value
}
