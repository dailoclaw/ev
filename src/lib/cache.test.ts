import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { clearOfflineCache, commitCachedState, listOutbox, loadCachedSnapshot, resetCacheConnectionForTests } from './cache'
import { DEFAULT_SETTINGS } from './appModel'

afterEach(async () => {
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
      { id: 'session:1', ownerId: 'owner-1', updatedAt: '2026-01-02T00:00:00.000Z', action: 'session-delete', payload: { id: '1' } },
    ])
    expect(await listOutbox('owner-2')).toEqual([])
  })
})
