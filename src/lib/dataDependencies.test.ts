import 'fake-indexeddb/auto'
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from './appModel'
import { clearOfflineCache, commitCachedState, listOutbox, type OutboxMutation, type OutboxOperation } from './cache'
import { getState, initializeData, removeVehiclePhoto, stopDataSync, synchronize, updateAppSettings, uploadVehiclePhoto } from './data'

const backend = vi.hoisted(() => {
  const channel = { on: vi.fn(), subscribe: vi.fn() }
  channel.on.mockReturnValue(channel)
  channel.subscribe.mockReturnValue(channel)
  return { channel, apply: vi.fn(), fetch: vi.fn() }
})
vi.mock('./supa', () => ({ supa: { channel: () => backend.channel, removeChannel: vi.fn() } }))
vi.mock('./repository', () => ({ applyOutboxOperation: backend.apply, fetchRemoteSnapshot: backend.fetch, downloadVehiclePhoto: vi.fn() }))

const ownerId = 'owner-1'
const photoPath = `${ownerId}/vehicle.jpg`
const connection = { onLine: false }
const snapshot = { ownerId, sessions: [], providers: [], settings: DEFAULT_SETTINGS, vehiclePhotoDataUrl: null, cachedAt: '' }
const providers = new Map<string, Record<string, unknown>>()
const sessions = new Map<string, Record<string, unknown>>()
const photos = new Map<string, string>()
let remoteSettings: Record<string, unknown>
let failAction: OutboxOperation['action'] | undefined
let pausedAction: OutboxOperation['action'] | undefined
let release = () => {}
let notifyStarted = () => {}
let pause: Promise<void> | undefined

function mutation(entity: string, action: OutboxMutation['action'], payload: Record<string, unknown>, updatedAt: string): OutboxMutation {
  return { id: `${ownerId}:${entity}`, ownerId, updatedAt, action, payload } as OutboxMutation
}
const providerWrite = mutation('provider:p', 'provider-upsert', { id: 'p', name: 'Example', color: '#123456', free_kwh_per_day: 0, archived: false, sort_order: 0 }, '30')
const sessionWrite = mutation('session:s', 'session-upsert', { id: 's', provider_id: 'p', date: '2026-01-01', amount: 10, cost: 2, notes: null }, '10')
const photoWrite = mutation('photo', 'photo-upsert', { path: photoPath, dataUrl: 'data:image/jpeg;base64,original' }, '30')
const photoDelete = mutation('photo', 'photo-delete', { path: photoPath }, '10')
const photoSettings = (path: string | null) => mutation('settings', 'settings-update', { vehicle_photo_path: path }, path ? '10' : '30')

beforeAll(() => {
  vi.stubGlobal('navigator', connection)
  vi.stubGlobal('window', new EventTarget())
  vi.stubGlobal('document', new EventTarget())
  vi.stubGlobal('localStorage', { getItem: () => 'done', setItem: () => {} })
})
beforeEach(() => {
  connection.onLine = false
  providers.clear(); sessions.clear(); photos.clear()
  remoteSettings = { id: 1, owner_id: ownerId, budget_cap: 50, theme: 'light', style: 'classic', density: 'comfortable', vehicle_efficiency: 14.2, petrol_price: 1.85, petrol_use: 7, vehicle_photo_path: null }
  failAction = undefined
  pausedAction = undefined
  pause = undefined
  backend.apply.mockImplementation(async (operation: OutboxOperation) => {
    if (operation.action === pausedAction && pause) {
      const waiting = pause
      pause = undefined
      notifyStarted()
      await waiting
    }
    if (operation.action === failAction) throw new Error('Prerequisite failed')
    switch (operation.action) {
      case 'provider-upsert': providers.set(String(operation.payload.id), operation.payload); break
      case 'session-upsert':
        if (!providers.has(String(operation.payload.provider_id))) throw new Error('Missing provider foreign key')
        sessions.set(String(operation.payload.id), operation.payload)
        break
      case 'settings-update':
        if (operation.payload.vehicle_photo_path && !photos.has(String(operation.payload.vehicle_photo_path))) throw new Error('Settings reference missing photo')
        remoteSettings = { ...remoteSettings, ...operation.payload }
        break
      case 'photo-upsert': photos.set(operation.payload.path, operation.payload.dataUrl); break
      case 'photo-delete':
        if (remoteSettings.vehicle_photo_path === operation.payload.path) throw new Error('Deleted photo still referenced')
        photos.delete(operation.payload.path)
        break
    }
  })
  backend.fetch.mockImplementation(async () => ({
    providers: [...providers.values()], sessions: [...sessions.values()], settings: { ...remoteSettings },
    vehiclePhotoDataUrl: photos.get(String(remoteSettings.vehicle_photo_path)) ?? null,
  }))
})
afterEach(async () => {
  release()
  stopDataSync()
  await clearOfflineCache()
  backend.apply.mockReset(); backend.fetch.mockReset()
})
afterAll(() => vi.unstubAllGlobals())
async function queue(operations: OutboxMutation[]) {
  await commitCachedState(snapshot, operations)
  await initializeData(ownerId)
}
async function sync() {
  connection.onLine = true
  await synchronize()
}
function pauseUpload(action: OutboxOperation['action']) {
  pausedAction = action
  pause = new Promise(resolve => { release = resolve })
  return new Promise<void>(resolve => { notifyStarted = resolve })
}
const applied = () => backend.apply.mock.calls.map(([operation]) => operation.action)

it.each(['reversed', 'equal'] as const)('uploads providers before sessions with %s timestamps', async timestamps => {
  await queue([sessionWrite, timestamps === 'equal' ? { ...providerWrite, updatedAt: sessionWrite.updatedAt } : providerWrite])
  await sync()
  expect(applied()).toEqual(['provider-upsert', 'session-upsert'])
  expect(getState().syncStatus).toBe('synced')
  expect(sessions.get('s')?.cost).toBe(2)
  expect(await listOutbox(ownerId)).toEqual([])
})

it.each(['upload', 'remove'] as const)('orders photo %s against settings regardless of timestamps', async action => {
  if (action === 'remove') { photos.set(photoPath, 'old'); remoteSettings.vehicle_photo_path = photoPath }
  await queue(action === 'upload' ? [photoSettings(photoPath), photoWrite] : [photoDelete, photoSettings(null)])
  await sync()
  expect(applied()).toEqual(action === 'upload' ? ['photo-upsert', 'settings-update'] : ['settings-update', 'photo-delete'])
  expect(remoteSettings.vehicle_photo_path).toBe(action === 'upload' ? photoPath : null)
  expect(photos.has(photoPath)).toBe(action === 'upload')
  expect(getState().syncStatus).toBe('synced')
})

it.each(['provider-upsert', 'photo-upsert', 'settings-update'] as const)('retains dependants when %s fails and retries safely', async action => {
  const operations = action === 'provider-upsert' ? [sessionWrite, providerWrite]
    : action === 'photo-upsert' ? [photoSettings(photoPath), photoWrite] : [photoDelete, photoSettings(null)]
  if (action === 'settings-update') { photos.set(photoPath, 'old'); remoteSettings.vehicle_photo_path = photoPath }
  await queue(operations)
  failAction = action
  await sync()
  expect(applied()).toEqual([action])
  expect(getState().syncStatus).toBe('error')
  expect(await listOutbox(ownerId)).toHaveLength(2)
  failAction = undefined
  await synchronize()
  expect(getState().syncStatus).toBe('synced')
  expect(await listOutbox(ownerId)).toEqual([])
})

it('does not publish stale photo settings when removal replaces a paused upload', async () => {
  await queue([photoSettings(photoPath), photoWrite])
  const started = pauseUpload('photo-upsert')
  connection.onLine = true
  const syncing = synchronize()
  await started
  connection.onLine = false
  // Cached settings must match the locally queued upload for the removal API.
  updateAppSettings({ vehiclePhotoPath: photoPath })
  await vi.waitFor(async () => expect((await listOutbox(ownerId)).find(op => op.action === 'settings-update')?.payload.vehicle_photo_path).toBe(photoPath))
  removeVehiclePhoto()
  await vi.waitFor(async () => expect((await listOutbox(ownerId)).find(op => op.action === 'settings-update')?.payload.vehicle_photo_path).toBeNull())
  connection.onLine = true
  release()
  await syncing
  await vi.waitFor(() => expect(getState().syncStatus).toBe('synced'))
  expect(applied()).toEqual(['photo-upsert', 'settings-update', 'photo-delete'])
  expect(remoteSettings.vehicle_photo_path).toBeNull()
  expect(photos.size).toBe(0)
})

it('does not delete a newly queued photo after a paused settings clear completes', async () => {
  photos.set(photoPath, 'old'); remoteSettings.vehicle_photo_path = photoPath
  await queue([photoDelete, photoSettings(null)])
  const started = pauseUpload('settings-update')
  connection.onLine = true
  const syncing = synchronize()
  await started
  connection.onLine = false
  uploadVehiclePhoto('data:image/jpeg;base64,new')
  await vi.waitFor(async () => expect((await listOutbox(ownerId)).find(op => op.action === 'photo-upsert')?.payload.dataUrl).toBe('data:image/jpeg;base64,new'))
  connection.onLine = true
  release()
  await syncing
  await vi.waitFor(() => expect(getState().syncStatus).toBe('synced'))
  expect(applied()).toEqual(['settings-update', 'photo-upsert', 'settings-update'])
  expect(photos.get(photoPath)).toBe('data:image/jpeg;base64,new')
  expect(remoteSettings.vehicle_photo_path).toBe(photoPath)
})

it('reports contradictory photo operations without deleting either queued record', async () => {
  await queue([photoDelete, photoSettings(photoPath)])
  await sync()
  expect(getState().syncStatus).toBe('error')
  expect(getState().lastSyncError).toContain('photo queued for removal')
  expect(backend.apply).not.toHaveBeenCalled()
  expect(await listOutbox(ownerId)).toHaveLength(2)
})

it('waits for the latest provider revision before sending its queued session', async () => {
  await queue([sessionWrite, providerWrite])
  const started = pauseUpload('provider-upsert')
  connection.onLine = true
  const syncing = synchronize()
  await started
  await commitCachedState(snapshot, [mutation('provider:p', 'provider-upsert', { ...providerWrite.payload, name: 'Updated provider' }, '30')])
  release()
  await syncing
  await vi.waitFor(() => expect(getState().syncStatus).toBe('synced'))
  expect(applied()).toEqual(['provider-upsert', 'provider-upsert', 'session-upsert'])
  expect(providers.get('p')?.name).toBe('Updated provider')
  expect(await listOutbox(ownerId)).toEqual([])
})

it.each([
  ['budget', { 'ev.budgetCap.v1': '-1' }, 'Budget'],
  ['vehicle', { 'ev.vehicle.v1': '{"efficiency":0}' }, 'efficiency'],
  ['date', {
    'ev.providers.v1': JSON.stringify([{ id: 'old', name: 'Legacy', freeKwhPerDay: 0, color: '#123456' }]),
    'ev.extraSessions.v1': JSON.stringify([{ id: 'old-row', type: 'Legacy', date: '2026-02-30', amount: 1, cost: 0, notes: null }]),
  }, 'Date'],
] as const)('invalid legacy %s stops migration without queueing or deleting the source', async (_name, values, message) => {
  const source = values as Record<string, string>
  const getItem = vi.spyOn(localStorage, 'getItem').mockImplementation(key => source[key] ?? null)
  const setItem = vi.spyOn(localStorage, 'setItem')
  setItem.mockClear()
  try {
    await queue([])
    await sync()
    expect(getState().syncStatus).toBe('error')
    expect(getState().lastSyncError).toContain(message)
    expect(await listOutbox(ownerId)).toEqual([])
    expect(backend.apply).not.toHaveBeenCalled()
    expect(getState().providers).toEqual([])
    expect(getState().sessions).toEqual([])
    expect(getState().settings.budgetCap).toBe(50)
    expect(setItem).not.toHaveBeenCalledWith('ev.supabaseCanonicalMigrated.v2', 'done')
    expect(setItem).not.toHaveBeenCalledWith('ev.extraSessions.v1', '[]')
  } finally { getItem.mockRestore(); setItem.mockRestore() }
})
