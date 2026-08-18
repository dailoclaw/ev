import type { AppSettings } from './appModel'
import type { Provider } from './providers'
import type { Session } from './savings'

const DB_NAME = 'ev-command'
const DB_VERSION = 1
const SNAPSHOTS = 'snapshots'
const OUTBOX = 'outbox'
const CURRENT = 'current'

export interface CachedSnapshot {
  ownerId: string
  sessions: Session[]
  providers: Provider[]
  settings: AppSettings
  vehiclePhotoDataUrl: string | null
  cachedAt: string
}

export type OutboxOperation =
  | { id: string; ownerId: string; updatedAt: string; action: 'session-upsert'; payload: Record<string, unknown> }
  | { id: string; ownerId: string; updatedAt: string; action: 'session-delete'; payload: { id: string } }
  | { id: string; ownerId: string; updatedAt: string; action: 'provider-upsert'; payload: Record<string, unknown> }
  | { id: string; ownerId: string; updatedAt: string; action: 'settings-update'; payload: Record<string, unknown> }
  | { id: string; ownerId: string; updatedAt: string; action: 'photo-upsert'; payload: { path: string; dataUrl: string } }
  | { id: string; ownerId: string; updatedAt: string; action: 'photo-delete'; payload: { path: string } }

let openPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (openPromise) return openPromise
  openPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(SNAPSHOTS)) db.createObjectStore(SNAPSHOTS)
      if (!db.objectStoreNames.contains(OUTBOX)) db.createObjectStore(OUTBOX, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Could not open the offline cache'))
  })
  return openPromise
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction was aborted'))
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'))
  })
}

export async function loadCachedSnapshot(): Promise<CachedSnapshot | null> {
  const db = await openDb()
  const transaction = db.transaction(SNAPSHOTS, 'readonly')
  const value = await requestResult(transaction.objectStore(SNAPSHOTS).get(CURRENT))
  return (value as CachedSnapshot | undefined) ?? null
}

/** Atomically persist the optimistic snapshot and all operations needed to sync it. */
export async function commitCachedState(snapshot: CachedSnapshot, operations: OutboxOperation[] = []): Promise<void> {
  const db = await openDb()
  const transaction = db.transaction([SNAPSHOTS, OUTBOX], 'readwrite')
  transaction.objectStore(SNAPSHOTS).put(snapshot, CURRENT)
  const outbox = transaction.objectStore(OUTBOX)
  for (const operation of operations) outbox.put(operation)
  await transactionDone(transaction)
}

export async function listOutbox(ownerId?: string): Promise<OutboxOperation[]> {
  const db = await openDb()
  const transaction = db.transaction(OUTBOX, 'readonly')
  const operations = (await requestResult(transaction.objectStore(OUTBOX).getAll())) as OutboxOperation[]
  return operations
    .filter(operation => !ownerId || operation.ownerId === ownerId)
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
}

export async function removeOutboxOperation(id: string): Promise<void> {
  const db = await openDb()
  const transaction = db.transaction(OUTBOX, 'readwrite')
  transaction.objectStore(OUTBOX).delete(id)
  await transactionDone(transaction)
}

export async function clearOfflineCache(): Promise<void> {
  const db = await openDb()
  const transaction = db.transaction([SNAPSHOTS, OUTBOX], 'readwrite')
  transaction.objectStore(SNAPSHOTS).clear()
  transaction.objectStore(OUTBOX).clear()
  await transactionDone(transaction)
}

/** Test-only reset: closes the singleton so fake IndexedDB can start cleanly. */
export function resetCacheConnectionForTests() {
  openPromise?.then(db => db.close()).catch(() => undefined)
  openPromise = null
}
