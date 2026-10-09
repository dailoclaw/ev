import 'fake-indexeddb/auto'
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import * as cache from './cache'
import { DEFAULT_SETTINGS } from './appModel'
import { clearOfflineCache, commitCachedState, listOutbox, listRecoveryArchives, type OutboxOperation } from './cache'
import { discardPendingChanges, exportSyncRecovery, getState, initializeData, retrySync, stopDataSync, synchronize, updateProvider, updateSession } from './data'
const backend = vi.hoisted(() => {
  const channel = { on: vi.fn(), subscribe: vi.fn() }; channel.on.mockReturnValue(channel); channel.subscribe.mockReturnValue(channel)
  return { channel, apply: vi.fn(), fetch: vi.fn() }
})
vi.mock('./supa', () => ({ supa: { channel: () => backend.channel, removeChannel: vi.fn() } }))
vi.mock('./repository', () => ({ applyOutboxOperation: backend.apply, fetchRemoteSnapshot: backend.fetch, downloadVehiclePhoto: vi.fn() }))
const connection = { onLine: false }
const provider = { id: 'p', name: 'Example', color: '#123456', freeKwhPerDay: 0, archived: false, sortOrder: 0 }
const row = { id: 's', providerId: 'p', type: 'Example', date: '2026-01-01', amount: 10, cost: 1, notes: null }
const snapshot = { ownerId: 'owner', settings: DEFAULT_SETTINGS, sessions: [row], providers: [provider], vehiclePhotoDataUrl: null, cachedAt: '' }
const providers = new Map<string, Record<string, unknown>>()
const sessions = new Map<string, Record<string, unknown>>()
let release = () => {}
let settings: Record<string, unknown>
let reject: ((operation: OutboxOperation) => unknown) | undefined
beforeAll(() => { vi.stubGlobal('navigator', connection); vi.stubGlobal('window', new EventTarget()); vi.stubGlobal('document', new EventTarget()); vi.stubGlobal('localStorage', { getItem: () => 'done', setItem: vi.fn() }) })
beforeEach(async () => {
  connection.onLine = false; reject = undefined
  providers.clear(); sessions.clear()
  providers.set('p', { id: 'p', name: 'Example', color: '#123456', free_kwh_per_day: 0, archived: false, sort_order: 0 })
  sessions.set('s', { id: 's', provider_id: 'p', date: row.date, amount: 10, cost: 1, notes: null })
  settings = { id: 1, owner_id: 'owner', budget_cap: 50, theme: 'light', style: 'classic', density: 'comfortable', vehicle_efficiency: 14.2, petrol_price: 1.85, petrol_use: 7, vehicle_photo_path: null }
  backend.fetch.mockImplementation(async () => ({ providers: [...providers.values()], sessions: [...sessions.values()], settings, vehiclePhotoDataUrl: null }))
  backend.apply.mockImplementation(async (operation: OutboxOperation) => {
    const error = reject?.(operation); if (error) throw error
    if (operation.action === 'provider-upsert') providers.set(String(operation.payload.id), operation.payload)
    if (operation.action === 'session-upsert') sessions.set(String(operation.payload.id), operation.payload)
    if (operation.action === 'settings-update') settings = { ...settings, ...operation.payload }
  })
  await commitCachedState(snapshot); await initializeData('owner')
})
afterEach(async () => { release(); stopDataSync(); vi.restoreAllMocks(); backend.apply.mockReset(); backend.fetch.mockReset(); await clearOfflineCache() })
afterAll(() => vi.unstubAllGlobals())
async function sync() { connection.onLine = true; await synchronize() }
function deferred() { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done }); return { promise, resolve } }

it('retains a rejected prerequisite, sends independent writes, and syncs after correction', async () => {
  await commitCachedState(snapshot, [
    { id: 'owner:provider:p', ownerId: 'owner', updatedAt: '', action: 'provider-upsert', payload: { ...providers.get('p'), name: 'Duplicate' } },
    { id: 'owner:session:s', ownerId: 'owner', updatedAt: '', action: 'session-upsert', payload: { ...sessions.get('s'), cost: 2 } },
    { id: 'owner:settings', ownerId: 'owner', updatedAt: '', action: 'settings-update', payload: { budget_cap: 80 } },
  ])
  reject = operation => operation.action === 'provider-upsert' && operation.payload.name === 'Duplicate' ? { code: '23505', message: 'Name exists' } : undefined
  await sync()
  expect(settings.budget_cap).toBe(80)
  expect(getState().syncStatus).toBe('error')
  expect(getState().rejectedWrites).toHaveLength(1)
  expect((await listOutbox()).map(operation => operation.action)).toEqual(['provider-upsert', 'session-upsert'])
  const attempts = backend.apply.mock.calls.length
  await synchronize()
  expect(backend.apply).toHaveBeenCalledTimes(attempts)
  await updateProvider('p', { name: 'Corrected' })
  await vi.waitFor(() => expect(getState().syncStatus).toBe('synced'))
  expect(await listOutbox()).toEqual([])
  expect(getState().rejectedWrites).toEqual([])
  expect(sessions.get('s')?.cost).toBe(2)
})
it('keeps transient failures retryable and clears held rejections on explicit retry', async () => {
  await updateSession('s', { cost: 2 })
  reject = () => new TypeError('Failed to fetch')
  await sync()
  expect((await listOutbox())[0].rejection).toBeUndefined()
  reject = () => ({ code: '23514', message: 'Rejected' })
  await retrySync()
  expect((await listOutbox())[0].rejection?.kind).toBe('invalid')
  reject = undefined
  await retrySync()
  expect(getState().syncStatus).toBe('synced')
  expect(await listOutbox()).toEqual([])
})
it('stops the current batch when owner authorization is denied', async () => {
  await updateProvider('p', { freeKwhPerDay: 1 }); await updateSession('s', { cost: 2 })
  reject = () => ({ code: '42501', message: 'Owner access denied' })
  await sync()
  expect(backend.apply).toHaveBeenCalledTimes(1)
  expect(getState().rejectedWrites[0].rejection?.kind).toBe('authorization')
  expect(await listOutbox()).toHaveLength(2)
})
it('does not mark a newer edit rejected when an older upload fails', async () => {
  await updateSession('s', { cost: 2 })
  const [old] = await listOutbox(); const began = deferred(); const paused = deferred(); release = paused.resolve
  const apply = backend.apply.getMockImplementation()!
  backend.apply.mockImplementation(async (operation: OutboxOperation) => {
    if (operation.revision === old.revision) { began.resolve(); await paused.promise; throw { code: '23514', message: 'Old value rejected' } }
    await apply(operation)
  })
  connection.onLine = true; const syncing = synchronize(); await began.promise
  await updateSession('s', { cost: 3 }); paused.resolve(); await syncing
  await vi.waitFor(() => expect(getState().syncStatus).toBe('synced'))
  expect(sessions.get('s')?.cost).toBe(3)
  expect(getState().rejectedWrites).toEqual([])
})
it('discards to cloud state only after archiving the complete pending ledger and survives reload', async () => {
  await updateSession('s', { cost: 2 }); reject = () => ({ code: '23514', message: 'Rejected' }); await sync()
  await discardPendingChanges()
  expect(getState().sessions[0].cost).toBe(1)
  expect(await listOutbox()).toEqual([])
  const recovery = await exportSyncRecovery()
  expect(recovery.archives[0].snapshot.sessions[0].cost).toBe(2)
  expect(recovery.archives[0].operations[0].payload).toMatchObject({ cost: 2 })
  stopDataSync(); await initializeData('owner')
  expect(getState().recoveryArchiveCount).toBe(1)
})
it('preserves all pending changes when fetching the cloud version fails', async () => {
  await updateSession('s', { cost: 2 }); reject = () => ({ code: '23514', message: 'Rejected' }); await sync()
  const pending = await listOutbox()
  backend.fetch.mockRejectedValue(new Error('Network down'))
  await expect(discardPendingChanges()).rejects.toThrow('Network down')
  expect(getState().sessions[0].cost).toBe(2)
  expect(await listRecoveryArchives('owner')).toEqual([])
  expect(await listOutbox()).toEqual(pending)
})
it('rejects stale recovery after sign-out without publishing or archiving another account', async () => {
  await updateSession('s', { cost: 2 }); connection.onLine = true
  const began = deferred(); const paused = deferred(); release = paused.resolve
  const fetch = backend.fetch.getMockImplementation()!
  backend.fetch.mockImplementationOnce(async () => { began.resolve(); await paused.promise; return fetch() })
  const discard = discardPendingChanges(); await began.promise; stopDataSync(); paused.resolve()
  await expect(discard).rejects.toThrow('account session changed')
  expect(getState().syncStatus).toBe('signed-out')
  expect(getState().sessions).toEqual([])
  expect(await listOutbox('owner')).toHaveLength(1)
  expect(await listRecoveryArchives('owner')).toEqual([])
})

it('serializes a new local edit behind recovery and preserves it against the restored cloud version', async () => {
  await updateSession('s', { cost: 2 }); reject = () => ({ code: '23514', message: 'Rejected' }); await sync()
  const began = deferred(); const paused = deferred(); release = paused.resolve
  const fetch = backend.fetch.getMockImplementation()!
  backend.fetch.mockImplementationOnce(async () => { began.resolve(); await paused.promise; return fetch() })
  const discard = discardPendingChanges(); await began.promise
  const edit = updateSession('s', { cost: 3 })
  paused.resolve(); await discard; await edit
  await vi.waitFor(() => expect(getState().rejectedWrites).toHaveLength(1))
  expect(getState().sessions[0].cost).toBe(3)
  expect((await listRecoveryArchives('owner'))[0].snapshot.sessions[0].cost).toBe(2)
  expect((await listOutbox())[0].payload).toMatchObject({ cost: 3 })
})

it('refuses to discard a newer edit created while waiting for an in-flight upload', async () => {
  await updateSession('s', { cost: 2 })
  const started = deferred(); const paused = deferred(); release = paused.resolve
  const apply = backend.apply.getMockImplementation()!
  backend.apply.mockImplementationOnce(async (operation: OutboxOperation) => { started.resolve(); await paused.promise; await apply(operation) })
  connection.onLine = true; const syncing = synchronize(); await started.promise
  const captured = deferred(); const list = cache.listOutbox
  vi.spyOn(cache, 'listOutbox').mockImplementationOnce(async owner => { const result = await list(owner); captured.resolve(); return result })
  const discard = discardPendingChanges(); const rejected = expect(discard).rejects.toThrow('changed during recovery')
  await captured.promise
  reject = operation => operation.action === 'session-upsert' && operation.payload.cost === 3 ? { code: '23514', message: 'New edit held' } : undefined
  await updateSession('s', { cost: 3 }); paused.resolve(); await syncing; await rejected
  await vi.waitFor(() => expect(getState().rejectedWrites).toHaveLength(1))
  expect(getState().sessions[0].cost).toBe(3)
  expect((await listOutbox())[0].payload).toMatchObject({ cost: 3 })
  expect(await listRecoveryArchives('owner')).toEqual([])
})
