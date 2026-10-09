import 'fake-indexeddb/auto'
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from './appModel'
import * as cache from './cache'
import { buildBackup, getState, initializeData, stopDataSync, synchronize, updateSession } from './data'

const backend = vi.hoisted(() => {
  const channel = { on: vi.fn(), subscribe: vi.fn() }
  channel.on.mockReturnValue(channel)
  channel.subscribe.mockReturnValue(channel)
  return { channel, removeChannel: vi.fn(), apply: vi.fn(), fetch: vi.fn(), photo: vi.fn() }
})
vi.mock('./supa', () => ({ supa: { channel: () => backend.channel, removeChannel: backend.removeChannel } }))
vi.mock('./repository', () => ({
  applyOutboxOperation: backend.apply, fetchRemoteSnapshot: backend.fetch, downloadVehiclePhoto: backend.photo,
}))

const connection = { onLine: false }
const browserWindow = new EventTarget()
const snapshot: cache.CachedSnapshot = {
  ownerId: 'owner-1', settings: DEFAULT_SETTINGS, vehiclePhotoDataUrl: null, cachedAt: '2026-01-01',
  providers: [{ id: 'provider-1', name: 'Example', color: '#123456', freeKwhPerDay: 0 }],
  sessions: [{ id: 'session-1', providerId: 'provider-1', date: '2026-01-01', type: 'Example', amount: 10, cost: 1, notes: null }],
}
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}
const transitions = ['sign-out', 'other-owner', 'same-owner'] as const
async function transition(kind: typeof transitions[number]) {
  stopDataSync()
  if (kind !== 'sign-out') await initializeData(kind === 'other-owner' ? 'owner-2' : 'owner-1')
}
function remote(ownerId: string, cost = 7) {
  return {
    providers: [{ id: 'provider-1', name: 'Example', color: '#123456', free_kwh_per_day: 0, archived: false, sort_order: 0 }],
    sessions: [{ id: 'session-1', provider_id: 'provider-1', date: '2026-01-01', amount: 10, cost, notes: null }],
    vehiclePhotoDataUrl: null,
    settings: { id: 1, owner_id: ownerId, budget_cap: 50, theme: 'light', style: 'classic', density: 'comfortable', vehicle_efficiency: 14.2, petrol_price: 1.85, petrol_use: 7, vehicle_photo_path: null },
  }
}

beforeAll(() => {
  vi.stubGlobal('navigator', connection)
  vi.stubGlobal('window', browserWindow)
  vi.stubGlobal('document', new EventTarget())
  vi.stubGlobal('localStorage', { getItem: () => 'done' })
})
beforeEach(async () => {
  connection.onLine = false
  await cache.commitCachedState(snapshot)
})
afterEach(async () => {
  stopDataSync()
  vi.restoreAllMocks()
  await cache.clearOfflineCache()
  backend.channel.on.mockClear()
  backend.channel.subscribe.mockClear()
  backend.removeChannel.mockClear()
  backend.apply.mockReset()
  backend.fetch.mockReset()
  backend.photo.mockReset()
})
afterAll(() => vi.unstubAllGlobals())

it.each(transitions)('ignores a paused cache initialization after %s', async kind => {
  const read = deferred<cache.CachedSnapshot>()
  vi.spyOn(cache, 'loadCachedSnapshot').mockReturnValueOnce(read.promise)
  const oldInitialization = initializeData('owner-1')
  await transition(kind)
  const current = getState()
  const subscriptions = backend.channel.subscribe.mock.calls.length
  read.resolve(snapshot)
  await oldInitialization
  expect(getState()).toBe(current)
  expect(backend.channel.subscribe).toHaveBeenCalledTimes(subscriptions)
  if (kind !== 'same-owner') expect(getState().sessions).toEqual([])
})

it('does not subscribe or update counts when a pending queue read resumes after sign-out', async () => {
  const started = deferred<void>()
  const pending = deferred<cache.OutboxOperation[]>()
  vi.spyOn(cache, 'listOutbox').mockImplementationOnce(() => { started.resolve(); return pending.promise })
  const initialization = initializeData('owner-1')
  await started.promise
  stopDataSync()
  const signedOut = getState()
  pending.resolve([{ id: 'old', ownerId: 'owner-1', updatedAt: '', revision: 'old', action: 'session-delete', payload: { id: 'old' } }])
  await initialization
  expect(getState()).toBe(signedOut)
  expect(backend.channel.subscribe).not.toHaveBeenCalled()
})

it.each(transitions)('stops the remaining upload batch and retains acknowledgements after %s', async kind => {
  await cache.commitCachedState(snapshot, ['first', 'second'].map(id => ({
    id, ownerId: 'owner-1', updatedAt: id, action: 'session-delete' as const, payload: { id },
  })))
  await initializeData('owner-1')
  const started = deferred<void>()
  const upload = deferred<void>()
  backend.apply.mockImplementationOnce(() => { started.resolve(); return upload.promise })
  connection.onLine = true
  const oldSync = synchronize()
  await started.promise
  connection.onLine = false
  await transition(kind)
  const current = getState()
  upload.resolve()
  await oldSync
  expect(getState()).toBe(current)
  expect(backend.apply).toHaveBeenCalledTimes(1)
  expect(backend.fetch).not.toHaveBeenCalled()
  expect(await cache.listOutbox('owner-1')).toHaveLength(2)
})

it.each(transitions)('ignores an old remote response after %s', async kind => {
  await initializeData('owner-1')
  const started = deferred<void>()
  const fetch = deferred<ReturnType<typeof remote>>()
  backend.fetch.mockImplementationOnce(() => { started.resolve(); return fetch.promise })
  connection.onLine = true
  const oldSync = synchronize()
  await started.promise
  connection.onLine = false
  await transition(kind)
  const current = getState()
  fetch.resolve(remote('owner-1', 999))
  await oldSync
  expect(getState()).toBe(current)
  expect(backend.fetch).toHaveBeenCalledTimes(1)
  expect((await cache.loadCachedSnapshot())?.sessions[0].cost).toBe(1)
})

it('lets the new owner synchronize while the previous upload is still pending', async () => {
  await cache.commitCachedState(snapshot, [{ id: 'old', ownerId: 'owner-1', updatedAt: '', action: 'session-delete', payload: { id: 'old' } }])
  await initializeData('owner-1')
  const started = deferred<void>()
  const upload = deferred<void>()
  backend.apply.mockImplementationOnce(() => { started.resolve(); return upload.promise })
  backend.fetch.mockImplementation(async (owner: string) => remote(owner))
  connection.onLine = true
  const oldSync = synchronize()
  await started.promise
  await initializeData('owner-2') // Must complete before the old upload is released.
  expect(getState().syncStatus).toBe('synced')
  expect((await cache.loadCachedSnapshot())?.ownerId).toBe('owner-2')
  const current = getState()
  upload.resolve()
  await oldSync
  expect(getState()).toBe(current)
  expect(backend.fetch.mock.calls.every(([owner]) => owner === 'owner-2')).toBe(true)
  expect(await cache.listOutbox('owner-1')).toHaveLength(1)
  expect(backend.removeChannel).toHaveBeenCalledTimes(1)
})

it.each(['success', 'failure'] as const)('ignores old mutation persistence %s after sign-out', async result => {
  await initializeData('owner-1')
  const started = deferred<void>()
  const write = deferred<void>()
  const originalCommit = cache.commitCachedState
  vi.spyOn(cache, 'commitCachedState').mockImplementationOnce(async (...args) => {
    await originalCommit(...args)
    started.resolve()
    await write.promise
  })
  const mutation = updateSession('session-1', { cost: 2 })
  await started.promise
  stopDataSync()
  const signedOut = getState()
  if (result === 'success') write.resolve()
  else write.reject(new Error('Old transaction failed'))
  await expect(mutation).rejects.toThrow(result === 'success' ? 'account session changed' : 'Old transaction failed')
  expect(getState()).toBe(signedOut)
})

it('keeps signed-out state on offline events and ignores removed channel callbacks', async () => {
  await initializeData('owner-1')
  const callback = backend.channel.on.mock.calls[0][2] as () => void
  stopDataSync()
  const signedOut = getState()
  browserWindow.dispatchEvent(new Event('offline'))
  callback()
  await new Promise(resolve => setTimeout(resolve, 300))
  expect(getState()).toBe(signedOut)
  expect(backend.fetch).not.toHaveBeenCalled()
})


it('rejects a backup when sign-out occurs during its photo download', async () => {
  connection.onLine = true
  backend.fetch.mockImplementation(async () => {
    const result = remote('owner-1')
    return { ...result, settings: { ...result.settings, vehicle_photo_path: 'owner-1/photo.jpg' } }
  })
  await initializeData('owner-1')
  const photo = deferred<string>()
  backend.photo.mockReturnValueOnce(photo.promise)
  const backup = buildBackup()
  const rejected = expect(backup).rejects.toThrow('account session changed')
  stopDataSync()
  photo.resolve('data:image/jpeg;base64,old')
  await rejected
  expect(getState().syncStatus).toBe('signed-out')
})

it('exports one captured snapshot when an edit occurs during its photo download', async () => {
  connection.onLine = true
  backend.fetch.mockImplementation(async () => {
    const result = remote('owner-1', 7)
    return { ...result, settings: { ...result.settings, vehicle_photo_path: 'owner-1/photo.jpg' } }
  })
  await initializeData('owner-1')
  const photo = deferred<string>()
  backend.photo.mockReturnValueOnce(photo.promise)
  const backup = buildBackup()
  connection.onLine = false
  await updateSession('session-1', { cost: 9 })
  photo.resolve('data:image/jpeg;base64,photo')
  expect((await backup).sessions[0].cost).toBe(7)
  expect(getState().sessions[0].cost).toBe(9)
})
