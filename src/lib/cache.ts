import type { SyncFailure } from './syncFailure'
import type { AppSettings } from './appModel'
import type { Provider } from './providers'
import type { Session } from './savings'

const DB_NAME = 'ev-command'
const DB_VERSION = 2
const SNAPSHOTS = 'snapshots'
const OUTBOX = 'outbox'
const CURRENT = 'current'
const RECOVERY = 'recovery'

export interface CachedSnapshot {
  ownerId: string
  sessions: Session[]
  providers: Provider[]
  settings: AppSettings
  vehiclePhotoDataUrl: string | null
  cachedAt: string
}

export type OutboxMutation =
  | { id: string; ownerId: string; updatedAt: string; action: 'session-upsert'; payload: Record<string, unknown> }
  | { id: string; ownerId: string; updatedAt: string; action: 'session-delete'; payload: { id: string } }
  | { id: string; ownerId: string; updatedAt: string; action: 'provider-upsert'; payload: Record<string, unknown> }
  | { id: string; ownerId: string; updatedAt: string; action: 'settings-update'; payload: Record<string, unknown> }
  | { id: string; ownerId: string; updatedAt: string; action: 'photo-upsert'; payload: { path: string; dataUrl: string } }
  | { id: string; ownerId: string; updatedAt: string; action: 'photo-delete'; payload: { path: string } }

export type OutboxOperation = OutboxMutation & { revision: string; rejection?: SyncFailure & { failedAt: string } }
export interface RecoveryArchive { id: string; ownerId: string; createdAt: string; snapshot: CachedSnapshot; operations: OutboxOperation[] }

let openPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (openPromise) return openPromise
  let cancelled = false
  const attempt = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(SNAPSHOTS)) db.createObjectStore(SNAPSHOTS)
      if (!db.objectStoreNames.contains(OUTBOX)) db.createObjectStore(OUTBOX, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(RECOVERY)) {
        const recovery = db.createObjectStore(RECOVERY, { keyPath: 'id' })
        recovery.createIndex('ownerId', 'ownerId')
      }
    }
    request.onsuccess = () => {
      const db = request.result
      if (cancelled) { db.close(); return }
      db.onversionchange = () => { db.close(); if (openPromise === connection) openPromise = null }
      db.onclose = () => { if (openPromise === connection) openPromise = null }
      resolve(db)
    }
    request.onblocked = () => {
      cancelled = true
      reject(new Error('Offline storage is blocked by another tab. Close other EV Command tabs and retry.'))
    }
    request.onerror = () => reject(request.error ?? new Error('Could not open the offline cache'))
  })
  const connection = attempt.catch(error => {
    if (openPromise === connection) openPromise = null
    throw error
  })
  openPromise = connection
  return connection
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
  })
}

export async function loadCachedSnapshot(): Promise<CachedSnapshot | null> {
  const db = await openDb()
  const transaction = db.transaction(SNAPSHOTS, 'readonly')
  const value = await requestResult(transaction.objectStore(SNAPSHOTS).get(CURRENT))
  return (value as CachedSnapshot | undefined) ?? null
}

/** Atomically persist the snapshot and all operations needed to sync it. */
export async function commitCachedState(snapshot: CachedSnapshot, operations: OutboxMutation[] = []): Promise<void> {
  const db = await openDb()
  const transaction = db.transaction([SNAPSHOTS, OUTBOX], 'readwrite')
  const done = transactionDone(transaction)
  let submissionError: unknown
  try {
    transaction.objectStore(SNAPSHOTS).put(snapshot, CURRENT)
    const outbox = transaction.objectStore(OUTBOX)
    let offset = 0
    const submitBatch = () => {
      try {
        const end = Math.min(offset + 250, operations.length)
        let last: IDBRequest | undefined
        while (offset < end) last = outbox.put({ ...operations[offset++], revision: crypto.randomUUID() })
        // Request events keep this same transaction active; timers would allow
        // auto-commit and turn a later failure into a partially saved restore.
        if (offset < operations.length && last) last.onsuccess = submitBatch
      } catch (error) {
        submissionError = error
        transaction.abort()
      }
    }
    submitBatch()
    await done
  } catch (error) {
    try { transaction.abort() } catch { /* The transaction may already have aborted. */ }
    await done.catch(() => undefined)
    throw submissionError ?? error
  }
}

export async function listOutbox(ownerId?: string): Promise<OutboxOperation[]> {
  const db = await openDb()
  // Upgrade pre-revision entries in place, atomically across browser tabs.
  const transaction = db.transaction(OUTBOX, 'readwrite')
  const done = transactionDone(transaction)
  const store = transaction.objectStore(OUTBOX)
  const request = store.getAll()
  const read = new Promise<OutboxOperation[]>((resolve, reject) => {
    request.onsuccess = () => {
      try {
        const operations = request.result as OutboxOperation[]
        for (const operation of operations) {
          if (typeof operation.revision === 'string' && operation.revision.length > 0) continue
          operation.revision = crypto.randomUUID()
          store.put(operation)
        }
        resolve(operations)
      } catch (error) {
        transaction.abort()
        reject(error)
      }
    }
    request.onerror = () => reject(request.error ?? new Error('Could not read the offline queue'))
  })
  const [operations] = await Promise.all([read, done])
  return operations
    .filter(operation => !ownerId || operation.ownerId === ownerId)
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
}

/** Read a candidate and its prerequisites together without scanning the queue again. */
export async function readOutboxOperations(ids: string[]): Promise<(OutboxOperation | undefined)[]> {
  const db = await openDb()
  const transaction = db.transaction(OUTBOX, 'readonly')
  const done = transactionDone(transaction)
  const store = transaction.objectStore(OUTBOX)
  const reads = Promise.all(ids.map(id => requestResult<OutboxOperation | undefined>(store.get(id))))
  const [operations] = await Promise.all([reads, done])
  return operations
}

/** Acknowledge only the version actually uploaded; preserve any newer mutation. */
export async function acknowledgeOutboxOperation(operation: OutboxOperation): Promise<void> {
  const db = await openDb()
  const transaction = db.transaction(OUTBOX, 'readwrite')
  const done = transactionDone(transaction)
  const store = transaction.objectStore(OUTBOX)
  const request = store.get(operation.id)
  request.onsuccess = () => {
    const current = request.result as OutboxOperation | undefined
    if (current?.revision === operation.revision && current.ownerId === operation.ownerId) {
      store.delete(operation.id)
    }
  }
  await done
}

export async function clearOfflineCache(): Promise<void> {
  const db = await openDb()
  const transaction = db.transaction([SNAPSHOTS, OUTBOX, RECOVERY], 'readwrite')
  transaction.objectStore(RECOVERY).clear()
  transaction.objectStore(SNAPSHOTS).clear()
  transaction.objectStore(OUTBOX).clear()
  await transactionDone(transaction)
}

/** Test-only reset: closes the singleton so fake IndexedDB can start cleanly. */
export function resetCacheConnectionForTests() {
  openPromise?.then(db => db.close()).catch(() => undefined)
  openPromise = null
}

/** Failure/retry metadata never overwrites a newer payload or another owner's write. */
export async function setOutboxRejection(operation: OutboxOperation, rejection?: OutboxOperation['rejection']): Promise<boolean> {
  const db = await openDb()
  const transaction = db.transaction(OUTBOX, 'readwrite')
  const done = transactionDone(transaction)
  const store = transaction.objectStore(OUTBOX)
  let changed = false
  const request = store.get(operation.id)
  request.onsuccess = () => {
    const current = request.result as OutboxOperation | undefined
    if (current?.revision !== operation.revision || current.ownerId !== operation.ownerId) return
    const next = { ...current }
    if (rejection) next.rejection = rejection
    else delete next.rejection
    store.put(next)
    changed = true
  }
  await done
  return changed
}

export async function listRecoveryArchives(ownerId: string): Promise<RecoveryArchive[]> {
  const db = await openDb()
  const transaction = db.transaction(RECOVERY, 'readonly')
  const done = transactionDone(transaction)
  const read = requestResult<RecoveryArchive[]>(transaction.objectStore(RECOVERY).index('ownerId').getAll(ownerId))
  const [archives] = await Promise.all([read, done])
  return archives.filter(archive => archive.ownerId === ownerId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/** Restore cloud state and archive every discarded local change in one guarded transaction. */
export async function discardOutboxToRemote(snapshot: CachedSnapshot, expected: OutboxOperation[], assertCurrent: () => void = () => {}): Promise<void> {
  if (!expected.length || expected.some(operation => operation.ownerId !== snapshot.ownerId)) throw new Error('No matching pending changes to discard.')
  const revisions = new Map(expected.map(operation => [operation.id, operation.revision]))
  const db = await openDb()
  const transaction = db.transaction([SNAPSHOTS, OUTBOX, RECOVERY], 'readwrite')
  const done = transactionDone(transaction)
  let failure: Error | undefined
  const store = transaction.objectStore(OUTBOX)
  const request = store.getAll()
  request.onsuccess = () => {
    const current = (request.result as OutboxOperation[]).filter(operation => operation.ownerId === snapshot.ownerId)
    if (current.length !== expected.length || current.some(operation => revisions.get(operation.id) !== operation.revision)) {
      failure = new Error('Pending changes changed during recovery. Review them and try again.')
      transaction.abort()
      return
    }
    const snapshots = transaction.objectStore(SNAPSHOTS)
    const previous = snapshots.get(CURRENT)
    previous.onsuccess = () => {
      const local = previous.result as CachedSnapshot | undefined
      if (!local || local.ownerId !== snapshot.ownerId) {
        failure = new Error('The cached account changed during recovery.')
        transaction.abort()
        return
      }
      try {
        assertCurrent()
        transaction.objectStore(RECOVERY).put({ id: crypto.randomUUID(), ownerId: snapshot.ownerId, createdAt: new Date().toISOString(), snapshot: local, operations: current } satisfies RecoveryArchive)
        snapshots.put(snapshot, CURRENT)
        for (const operation of current) store.delete(operation.id)
      } catch (error) {
        failure = error instanceof Error ? error : new Error('The account changed during recovery.')
        transaction.abort()
        return
      }
    }
  }
  try { await done } catch (error) { throw failure ?? error }
}

export async function countRecoveryArchives(ownerId: string): Promise<number> {
  const db = await openDb()
  const transaction = db.transaction(RECOVERY, 'readonly')
  const done = transactionDone(transaction)
  const read = requestResult(transaction.objectStore(RECOVERY).index('ownerId').count(ownerId))
  const [count] = await Promise.all([read, done])
  return count
}
