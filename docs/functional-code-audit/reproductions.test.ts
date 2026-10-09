import 'fake-indexeddb/auto'
import { expect, it, vi } from 'vitest'
import { matchRoutes } from 'react-router-dom'
import { DEFAULT_SETTINGS } from '../../src/lib/appModel'
import { parseBackup, backupDelta } from '../../src/lib/backup'
import { validateSessionInput } from '../../src/lib/validation'
import { enrichSessions } from '../../src/lib/savings'
import { costConcentration } from '../../src/lib/costConcentration'
import { commitCachedState, listOutbox, acknowledgeOutboxOperation, clearOfflineCache } from '../../src/lib/cache'
import * as cache from '../../src/lib/cache'
import { getState, initializeData, stopDataSync, updateSession, updateAppSettings } from '../../src/lib/data'

vi.mock('../../src/lib/supa', () => ({ supa: null }))

const provider = { id: 'p', name: 'Example', color: '#123456', freeKwhPerDay: 7 }
const row = { id: 's', date: '2026-02-28', type: 'Example', amount: 7, cost: 5, notes: null }

it('regression: stale acknowledgement preserves a newer queued edit', async () => {
  await clearOfflineCache()
  const snapshot = { ownerId: 'owner', sessions: [], providers: [], settings: DEFAULT_SETTINGS, vehiclePhotoDataUrl: null, cachedAt: '' }
  const old = { id: 'owner:session:s', ownerId: 'owner', updatedAt: '1', action: 'session-upsert' as const, payload: { cost: 1 } }
  await commitCachedState(snapshot, [old])
  const inFlight = (await listOutbox('owner'))[0]
  await commitCachedState(snapshot, [{ ...old, updatedAt: '2', payload: { cost: 2 } }])
  await acknowledgeOutboxOperation(inFlight)
  expect(await listOutbox('owner')).toEqual([expect.objectContaining({ payload: { cost: 2 } })])
  await clearOfflineCache()
})

it('demonstrates invalid calendar date accepted', () => {
  expect(validateSessionInput({ ...row, date: '2026-02-30' })).toBeNull()
})

it('demonstrates negative legacy cap and duplicate providers accepted', () => {
  const backup = parseBackup(JSON.stringify({ version: 1, budgetCap: -5, providers: [provider, { ...provider, id: 'p2' }], sessions: [row] }))!
  expect(backup.settings.budgetCap).toBe(-5)
  expect(backupDelta(backup, [], []).newProviders).toHaveLength(2)
})

it('demonstrates accepted fully allowance-covered cost disappears from curve', () => {
  const sessions = enrichSessions([row], [provider])
  expect(sessions[0].cost).toBe(5)
  expect(costConcentration(sessions, 'all', null, 88).totalCost).toBe(0)
})

it('demonstrates router params already decoded and account decoding throws', () => {
  const name = '50% Charger'
  const matches = matchRoutes([{ path: '/accounts/:name' }], `/accounts/${encodeURIComponent(name)}`)!
  expect(matches[0].params.name).toBe(name)
  expect(() => decodeURIComponent(matches[0].params.name!)).toThrow(URIError)
})

it('demonstrates Date.parse normalizes the invalid day', () => {
  expect(new Date('2026-02-30T00:00:00Z').toISOString().slice(0, 10)).toBe('2026-03-02')
  vi.restoreAllMocks()
})

it('regression: cache failure rejects save and preserves the persisted ledger', async () => {
  await clearOfflineCache()
  vi.stubGlobal('navigator', { onLine: false })
  vi.stubGlobal('localStorage', { getItem: () => 'done', setItem: () => undefined })
  await commitCachedState({ ownerId: 'owner', sessions: [{ ...row, providerId: 'p' }], providers: [provider], settings: DEFAULT_SETTINGS, vehiclePhotoDataUrl: null, cachedAt: '' })
  await initializeData('owner')
  const failed = vi.spyOn(cache, 'commitCachedState').mockRejectedValueOnce(new Error('quota exceeded'))
  await expect(updateSession('s', { cost: 9 })).rejects.toThrow('quota exceeded')
  expect(getState().sessions[0].cost).toBe(5)
  expect(getState().lastSaveError).toContain('Not saved')
  expect(await listOutbox('owner')).toEqual([])
  failed.mockRestore()
  stopDataSync()
  vi.unstubAllGlobals()
  await clearOfflineCache()
})

it('regression: blocked optional localStorage does not prevent durable settings saves', async () => {
  await clearOfflineCache()
  vi.stubGlobal('navigator', { onLine: false })
  vi.stubGlobal('localStorage', { getItem: () => 'done', setItem: () => { throw new Error('storage blocked') } })
  await commitCachedState({ ownerId: 'owner', sessions: [row], providers: [provider], settings: DEFAULT_SETTINGS, vehiclePhotoDataUrl: null, cachedAt: '' })
  await initializeData('owner')
  await expect(updateAppSettings({ budgetCap: 70 })).resolves.toBeUndefined()
  expect(getState().budgetCap).toBe(70)
  expect(await listOutbox('owner')).toHaveLength(1)
  stopDataSync()
  vi.unstubAllGlobals()
  await clearOfflineCache()
})
