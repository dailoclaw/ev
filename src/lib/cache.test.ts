import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { acknowledgeOutboxOperation, clearOfflineCache, commitCachedState, listOutbox, loadCachedSnapshot, resetCacheConnectionForTests, type OutboxMutation } from './cache'
import { DEFAULT_SETTINGS } from './appModel'

afterEach(async () => {
  vi.restoreAllMocks()
  await clearOfflineCache()
  resetCacheConnectionForTests()
})

describe('offline cache', () => {
  it('commits the snapshot and bounded entity operations atomically', async () => {
    const snapshot = {
      ownerId: 'owner-1',
      sessions: [],
      providers: [],
      settings: DEFAULT_SETTINGS,
      vehiclePhotoDataUrl: null,
      cachedAt: '2026-01-01T00:00:00.000Z',
    }
    await commitCachedState(snapshot, [
      { id: 'session:1', ownerId: 'owner-1', updatedAt: '2026-01-01T00:00:00.000Z', action: 'session-upsert', payload: { id: '1' } },
    ])
    await commitCachedState(snapshot, [
      { id: 'session:1', ownerId: 'owner-1', updatedAt: '2026-01-02T00:00:00.000Z', action: 'session-delete', payload: { id: '1' } },
    ])

    expect(await loadCachedSnapshot()).toEqual(snapshot)
    expect(await listOutbox()).toEqual([
      expect.objectContaining({ id: 'session:1', ownerId: 'owner-1', updatedAt: '2026-01-02T00:00:00.000Z', action: 'session-delete', payload: { id: '1' }, revision: expect.any(String) }),
    ])
    expect(await listOutbox('owner-2')).toEqual([])
  })

  const snapshot = {
    ownerId: 'owner-1', sessions: [], providers: [], settings: DEFAULT_SETTINGS,
    vehiclePhotoDataUrl: null, cachedAt: '2026-01-01T00:00:00.000Z',
  }
  const metadata = { id: 'owner-1:entity', ownerId: 'owner-1', updatedAt: snapshot.cachedAt }
  const mutations: OutboxMutation[] = [
    { ...metadata, action: 'session-upsert', payload: { id: '1', cost: 2 } },
    { ...metadata, action: 'session-delete', payload: { id: '1' } },
    { ...metadata, action: 'provider-upsert', payload: { id: '1', name: 'New name' } },
    { ...metadata, action: 'settings-update', payload: { budget_cap: 75 } },
    { ...metadata, action: 'photo-upsert', payload: { path: 'owner-1/vehicle.jpg', dataUrl: 'data:image/jpeg;base64,new' } },
    { ...metadata, action: 'photo-delete', payload: { path: 'owner-1/vehicle.jpg' } },
  ]

  it.each(mutations)('preserves a replacement $action when an older upload is acknowledged', async replacement => {
    await commitCachedState(snapshot, [{ ...metadata, action: 'session-upsert', payload: { id: '1', cost: 1 } }])
    const [uploaded] = await listOutbox('owner-1')
    await commitCachedState(snapshot, [replacement])
    const [latest] = await listOutbox('owner-1')
    expect(latest.revision).not.toBe(uploaded.revision)
    // Timestamps deliberately match: millisecond precision is not an identity.
    expect(latest.updatedAt).toBe(uploaded.updatedAt)
    await acknowledgeOutboxOperation(uploaded)
    expect(await listOutbox('owner-1')).toEqual([latest])
    await acknowledgeOutboxOperation(latest)
    expect(await listOutbox('owner-1')).toEqual([])
    await acknowledgeOutboxOperation(latest) // Duplicate acknowledgements are harmless.
    expect(await listOutbox('owner-1')).toEqual([])
  })

  it('assigns new revisions even when an identical mutation is written again', async () => {
    await commitCachedState(snapshot, [mutations[0]])
    const [uploaded] = await listOutbox()
    await commitCachedState(snapshot, [mutations[0]])
    const [latest] = await listOutbox()
    expect(latest.revision).not.toBe(uploaded.revision)
    await acknowledgeOutboxOperation(uploaded)
    expect(await listOutbox()).toEqual([latest])
  })

  it('upgrades legacy pending operations once without changing their payloads or owner', async () => {
    await commitCachedState(snapshot)
    // Seed the pre-fix disk format directly, rather than through the new writer.
    const legacy = { ...metadata, action: 'session-delete', payload: { id: '1' } }
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('ev-command', 1)
      request.onsuccess = () => {
        const db = request.result
        const tx = db.transaction('outbox', 'readwrite')
        tx.objectStore('outbox').put(legacy)
        tx.oncomplete = () => { db.close(); resolve() }
        tx.onabort = () => { db.close(); reject(tx.error) }
      }
      request.onerror = () => reject(request.error)
    })
    const [firstRead, secondRead] = await Promise.all([listOutbox('owner-1'), listOutbox('owner-1')])
    expect(firstRead).toEqual([expect.objectContaining({ ...legacy, revision: expect.any(String) })])
    expect(secondRead).toEqual(firstRead)
    expect(await listOutbox('other-owner')).toEqual([])
    await acknowledgeOutboxOperation(firstRead[0])
    expect(await listOutbox()).toEqual([])
  })
})


it('recovers after an IndexedDB open denial', async () => {
  resetCacheConnectionForTests()
  vi.spyOn(indexedDB, 'open').mockImplementationOnce(() => { throw new DOMException('Offline storage denied', 'SecurityError') })
  await expect(loadCachedSnapshot()).rejects.toThrow('Offline storage denied')
  await expect(loadCachedSnapshot()).resolves.toBeNull()
})

it('rolls back the snapshot if an outbox put throws after the snapshot put', async () => {
  const snapshot = { ownerId: 'owner', sessions: [], providers: [], settings: DEFAULT_SETTINGS, vehiclePhotoDataUrl: null, cachedAt: 'original' }
  await commitCachedState(snapshot)
  const put = IDBObjectStore.prototype.put
  vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, ...args) {
    if (this.name === 'outbox') throw new DOMException('Queue quota exceeded', 'QuotaExceededError')
    return put.apply(this, args)
  })
  await expect(commitCachedState({ ...snapshot, cachedAt: 'failed' }, [
    { id: 'owner:settings', ownerId: 'owner', updatedAt: '', action: 'settings-update', payload: { budget_cap: 80 } },
  ])).rejects.toThrow('Queue quota exceeded')
  expect(await loadCachedSnapshot()).toEqual(snapshot)
  expect(await listOutbox()).toEqual([])
  vi.restoreAllMocks()
  await expect(commitCachedState({ ...snapshot, cachedAt: 'retry' })).resolves.toBeUndefined()
})

it('rejects an aborted transaction and retains the previous snapshot', async () => {
  const snapshot = { ownerId: 'owner', sessions: [], providers: [], settings: DEFAULT_SETTINGS, vehiclePhotoDataUrl: null, cachedAt: 'original' }
  await commitCachedState(snapshot)
  const put = IDBObjectStore.prototype.put
  vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(function (this: IDBObjectStore, ...args) {
    const request = put.apply(this, args)
    const transaction = this.transaction
    queueMicrotask(() => transaction.abort())
    return request
  })
  await expect(commitCachedState({ ...snapshot, cachedAt: 'failed' })).rejects.toThrow('aborted')
  expect(await loadCachedSnapshot()).toEqual(snapshot)
})

it.each(['error', 'blocked'] as const)('recovers after an asynchronous IndexedDB open %s', async event => {
  resetCacheConnectionForTests()
  vi.spyOn(indexedDB, 'open').mockImplementationOnce(() => {
    const request = { error: new DOMException('Open failed', 'UnknownError'), onerror: null, onblocked: null }
    queueMicrotask(() => {
      const handler = event === 'error' ? request.onerror : request.onblocked
      ;(handler as ((event: Event) => void) | null)?.(new Event(event))
    })
    return request as unknown as IDBOpenDBRequest
  })
  await expect(loadCachedSnapshot()).rejects.toThrow(event === 'error' ? 'Open failed' : 'blocked by another tab')
  await expect(loadCachedSnapshot()).resolves.toBeNull()
})
