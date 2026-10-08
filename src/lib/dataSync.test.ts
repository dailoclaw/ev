import 'fake-indexeddb/auto'
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from './appModel'
import { clearOfflineCache, commitCachedState, listOutbox, loadCachedSnapshot, type OutboxOperation } from './cache'
import { deleteSession, getState, initializeData, stopDataSync, synchronize, updateSession } from './data'

const backend = vi.hoisted(() => {
  const channel = { on: vi.fn(), subscribe: vi.fn() }
  channel.on.mockReturnValue(channel)
  channel.subscribe.mockReturnValue(channel)
  return { channel, apply: vi.fn(), fetch: vi.fn() }
})
vi.mock('./supa', () => ({ supa: { channel: () => backend.channel, removeChannel: vi.fn() } }))
vi.mock('./repository', () => ({
  applyOutboxOperation: backend.apply, fetchRemoteSnapshot: backend.fetch, downloadVehiclePhoto: vi.fn(),
}))

const connection = { onLine: false }
const browserWindow = new EventTarget()
const browserDocument = new EventTarget()
const session = { id: 'session-1', providerId: 'provider-1', date: '2026-01-01', type: 'Example', amount: 10, cost: 1, notes: null }
const provider = { id: 'provider-1', name: 'Example', color: '#123456', freeKwhPerDay: 0, archived: false, sortOrder: 0 }

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>(done => { resolve = done })
  return { promise, resolve }
}
let releaseUpload = () => {}

beforeAll(() => {
  vi.stubGlobal('navigator', connection)
  vi.stubGlobal('window', browserWindow)
  vi.stubGlobal('document', browserDocument)
  vi.stubGlobal('localStorage', { getItem: () => 'done' })
})
afterEach(async () => {
  releaseUpload()
  await synchronize()
  stopDataSync()
  await clearOfflineCache()
  backend.apply.mockReset()
  backend.fetch.mockReset()
})
afterAll(() => vi.unstubAllGlobals())

it.each(['edit', 'delete'] as const)('syncs the newer %s queued while an earlier upload is paused', async change => {
  connection.onLine = false
  await commitCachedState({ ownerId: 'owner-1', sessions: [session], providers: [provider], settings: DEFAULT_SETTINGS, vehiclePhotoDataUrl: null, cachedAt: '' })
  await initializeData('owner-1')
  await updateSession(session.id, { cost: 2 })
  const [old] = await listOutbox('owner-1')
  const started = deferred()
  const paused = deferred()
  releaseUpload = paused.resolve
  let remoteSessions = [{ id: session.id, provider_id: provider.id, date: session.date, amount: 10, cost: 1, notes: null }]
  backend.apply.mockImplementation(async (operation: OutboxOperation) => {
    if (operation.revision === old.revision) {
      started.resolve()
      await paused.promise
    }
    if (operation.action === 'session-delete') remoteSessions = []
    if (operation.action === 'session-upsert') remoteSessions = [operation.payload as typeof remoteSessions[number]]
  })
  backend.fetch.mockImplementation(async () => ({
    providers: [{ id: provider.id, name: provider.name, color: provider.color, free_kwh_per_day: 0, archived: false, sort_order: 0 }],
    sessions: structuredClone(remoteSessions), vehiclePhotoDataUrl: null,
    settings: { id: 1, owner_id: 'owner-1', budget_cap: 50, theme: 'light', style: 'classic', density: 'comfortable', vehicle_efficiency: 14.2, petrol_price: 1.85, petrol_use: 7, vehicle_photo_path: null },
  }))
  connection.onLine = true
  const firstSync = synchronize()
  await started.promise
  if (change === 'edit') await updateSession(session.id, { cost: 3 })
  else await deleteSession(session.id)
  const [latest] = await listOutbox('owner-1')
  expect(latest.revision).not.toBe(old.revision)
  expect(getState().synced).toBe(false)
  paused.resolve()
  await firstSync
  await vi.waitFor(() => expect(getState().syncStatus).toBe('synced'))
  expect(backend.apply.mock.calls.map(([operation]) => operation.revision)).toEqual([old.revision, latest.revision])
  expect(await listOutbox('owner-1')).toEqual([])
  if (change === 'edit') {
    expect(remoteSessions[0].cost).toBe(3)
    expect(getState().sessions[0].cost).toBe(3)
    expect((await loadCachedSnapshot())?.sessions[0].cost).toBe(3)
  } else {
    expect(remoteSessions).toEqual([])
    expect(getState().sessions).toEqual([])
    expect((await loadCachedSnapshot())?.sessions).toEqual([])
  }
})
