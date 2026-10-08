import { afterEach, expect, it, vi } from 'vitest'
import { applyOutboxOperation, fetchRemoteSnapshot } from './repository'

const backend = vi.hoisted(() => ({ from: vi.fn(), storageFrom: vi.fn() }))
vi.mock('./supa', () => ({ supa: { from: backend.from, storage: { from: backend.storageFrom } } }))
afterEach(() => vi.resetAllMocks())
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}
const settings = { owner_id: 'owner-1', vehicle_photo_path: null }

it('stops pagination when the session changes during the first page', async () => {
  let current = true
  const assertCurrent = () => { if (!current) throw new Error('Session changed') }
  const providers = deferred<{ data: unknown[]; error: null }>()
  const sessions = deferred<{ data: unknown[]; error: null }>()
  const ranges = vi.fn((table: string) => table === 'providers' ? providers.promise : sessions.promise)
  backend.from.mockImplementation((table: string) => {
    const query = {
      select: () => query, order: () => query, eq: () => query,
      range: () => ranges(table), maybeSingle: async () => ({ data: settings, error: null }),
    }
    return query
  })
  const fetch = fetchRemoteSnapshot('owner-1', assertCurrent)
  const rejected = expect(fetch).rejects.toThrow('Session changed')
  current = false
  providers.resolve({ data: Array.from({ length: 500 }, () => ({})), error: null })
  sessions.resolve({ data: Array.from({ length: 500 }, () => ({})), error: null })
  await rejected
  expect(ranges).toHaveBeenCalledTimes(2)
  expect(backend.storageFrom).not.toHaveBeenCalled()
})

it('rejects settings belonging to another owner before downloading a photo', async () => {
  backend.from.mockImplementation(() => {
    const query = {
      select: () => query, order: () => query, eq: () => query,
      range: async () => ({ data: [], error: null }),
      maybeSingle: async () => ({ data: { owner_id: 'owner-2', vehicle_photo_path: 'owner-2/photo.jpg' }, error: null }),
    }
    return query
  })
  await expect(fetchRemoteSnapshot('owner-1', () => {})).rejects.toThrow('different account')
  expect(backend.storageFrom).not.toHaveBeenCalled()
})

it('does not hide a session change during a failed photo download', async () => {
  let current = true
  const assertCurrent = () => { if (!current) throw new Error('Session changed') }
  const photo = deferred<{ data: null; error: Error }>()
  backend.from.mockImplementation(() => {
    const query = {
      select: () => query, order: () => query, eq: () => query,
      range: async () => ({ data: [], error: null }),
      maybeSingle: async () => ({ data: { ...settings, vehicle_photo_path: 'owner-1/photo.jpg' }, error: null }),
    }
    return query
  })
  const started = deferred<void>()
  backend.storageFrom.mockReturnValue({ download: () => { started.resolve(); return photo.promise } })
  const fetch = fetchRemoteSnapshot('owner-1', assertCurrent)
  const rejected = expect(fetch).rejects.toThrow('Session changed')
  await started.promise
  current = false
  photo.resolve({ data: null, error: new Error('Download failed') })
  await rejected
})

it('refuses an outbox operation from another owner before making a request', async () => {
  await expect(applyOutboxOperation({
    id: 'old', ownerId: 'owner-1', updatedAt: '', revision: 'old', action: 'session-delete', payload: { id: 'old' },
  }, 'owner-2', () => {})).rejects.toThrow('different account')
  expect(backend.from).not.toHaveBeenCalled()
})
