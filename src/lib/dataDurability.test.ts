import 'fake-indexeddb/auto'
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from './appModel'
import * as cache from './cache'
import { addProvider, addSession, deleteSession, getState, initializeData, removeVehiclePhoto, restoreMerge, setProviderOrder, stopDataSync, undoDeleteSession, updateAppSettings, updateProvider, updateSession, uploadVehiclePhoto } from './data'

vi.mock('./supa', () => ({ supa: null }))
const provider = { id: 'p', name: 'Example', color: '#123456', freeKwhPerDay: 0 }
const session = { id: 's', providerId: 'p', date: '2026-01-01', type: 'Example', amount: 10, cost: 1, notes: null }
const snapshot = { ownerId: 'owner', settings: { ...DEFAULT_SETTINGS, vehiclePhotoPath: 'owner/vehicle.jpg' }, providers: [provider], sessions: [session], vehiclePhotoDataUrl: 'data:image/jpeg;base64,old', cachedAt: '' }
const backup = { version: 2 as const, exportedAt: '', settings: DEFAULT_SETTINGS, providers: [{ ...provider, id: 'new', name: 'New provider' }], sessions: [{ ...session, id: 'new', type: 'New provider' }], vehiclePhotoDataUrl: 'data:image/jpeg;base64,new' }
const changes = [
  ['add', () => addSession({ ...session, cost: 2 })],
  ['new charger and charge', () => addSession({ ...session, type: 'New provider' }, { name: 'New provider', color: '#234567', freeKwhPerDay: 0 })],
  ['edit', () => updateSession('s', { cost: 2 })],
  ['delete', () => deleteSession('s')],
  ['undo', () => undoDeleteSession({ ...session, id: 'deleted', cost: 2 })],
  ['provider', () => addProvider('New provider', 0)],
  ['provider edit', () => updateProvider('p', { name: 'Renamed' })],
  ['provider order', () => setProviderOrder(['p'])],
  ['settings', () => updateAppSettings({ budgetCap: 80 })],
  ['photo upload', () => uploadVehiclePhoto('data:image/jpeg;base64,new')],
  ['photo removal', () => removeVehiclePhoto()],
  ['restore', () => restoreMerge(backup)],
] as const
beforeAll(() => {
  vi.stubGlobal('navigator', { onLine: false })
  vi.stubGlobal('localStorage', { getItem: () => 'done', setItem: vi.fn() })
})
beforeEach(async () => { await cache.commitCachedState(snapshot); await initializeData('owner') })
afterEach(async () => { stopDataSync(); vi.restoreAllMocks(); await cache.clearOfflineCache() })
afterAll(() => vi.unstubAllGlobals())

it.each(changes)('rejects a failed %s without changing the ledger, then retries durably', async (_name, change) => {
  const before = getState()
  vi.spyOn(cache, 'commitCachedState').mockRejectedValueOnce(new DOMException('Device quota exceeded', 'QuotaExceededError'))
  await expect(change()).rejects.toThrow('Not saved on this device')
  expect(getState().sessions).toEqual(before.sessions)
  expect(getState().providers).toEqual(before.providers)
  expect(getState().settings).toEqual(before.settings)
  expect(getState().vehiclePhoto).toBe(before.vehiclePhoto)
  expect(await cache.loadCachedSnapshot()).toEqual(snapshot)
  expect(await cache.listOutbox()).toEqual([])
  expect(getState().lastSaveError).toContain('quota')
  await change()
  expect(getState().lastSaveError).toBeNull()
  expect(await cache.listOutbox()).not.toEqual([])
  const saved = getState()
  stopDataSync()
  await initializeData('owner')
  expect(getState().sessions).toEqual(saved.sessions)
  expect(getState().providers).toEqual(saved.providers)
  expect(getState().settings).toEqual(saved.settings)
  expect(getState().vehiclePhoto).toBe(saved.vehiclePhoto)
})

it('publishes only after commit and serializes concurrent patches without losing fields', async () => {
  let resume!: () => void
  let started!: () => void
  const waiting = new Promise<void>(resolve => { resume = resolve })
  const began = new Promise<void>(resolve => { started = resolve })
  const commit = cache.commitCachedState
  vi.spyOn(cache, 'commitCachedState').mockImplementationOnce(async (...args) => { started(); await waiting; await commit(...args) })
  const first = updateSession('s', { cost: 2 })
  await began
  const second = updateSession('s', { notes: 'Concurrent note' })
  expect(getState().sessions[0].cost).toBe(1)
  expect(getState().sessions[0].notes).toBeNull()
  resume()
  await Promise.all([first, second])
  expect(getState().sessions[0]).toMatchObject({ cost: 2, notes: 'Concurrent note' })
  expect((await cache.loadCachedSnapshot())?.sessions[0]).toMatchObject({ cost: 2, notes: 'Concurrent note' })
})

it('does not poison later mutations when an earlier concurrent write fails', async () => {
  vi.spyOn(cache, 'commitCachedState').mockRejectedValueOnce(new Error('Transaction aborted'))
  const failed = updateSession('s', { cost: 2 })
  const next = updateSession('s', { notes: 'Survives' })
  await expect(failed).rejects.toThrow('Transaction aborted')
  await next
  expect(getState().sessions[0]).toMatchObject({ cost: 1, notes: 'Survives' })
})

it('saves settings durably even when optional localStorage reads and writes are denied', async () => {
  vi.stubGlobal('localStorage', { getItem: () => { throw new Error('Denied') }, setItem: () => { throw new Error('Denied') } })
  await updateAppSettings({ theme: 'dark', budgetCap: 80 })
  expect(getState().settings).toMatchObject({ theme: 'dark', budgetCap: 80 })
  expect((await cache.loadCachedSnapshot())?.settings).toMatchObject({ theme: 'dark', budgetCap: 80 })
})

it('reports save success even if post-commit queue diagnostics fail', async () => {
  vi.spyOn(cache, 'listOutbox').mockRejectedValueOnce(new Error('Read failed'))
  await expect(updateSession('s', { cost: 2 })).resolves.toBeUndefined()
  expect((await cache.loadCachedSnapshot())?.sessions[0].cost).toBe(2)
  expect(await cache.listOutbox()).toHaveLength(1)
})
