import { expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from './appModel'
import { backupDelta, normalizeBackupValues, parseBackup, parseBackupOrThrow, planRestore, sessionSignature } from './backup'
import { TEST_PHOTO } from './testPhotoFixtures'
const provider = { id: '11111111-1111-4111-8111-111111111111', name: 'Example', color: '#123456', freeKwhPerDay: 7, archived: true, sortOrder: 3 }
const row = { id: '22222222-2222-4222-8222-222222222222', providerId: provider.id, date: '2026-01-01', type: 'Example', amount: 7, cost: 1, notes: null }
const backup = { version: 2 as const, exportedAt: '', settings: DEFAULT_SETTINGS, providers: [provider], sessions: [row], vehiclePhotoDataUrl: null }
it.each([
  { providers: [provider, { ...provider, id: 'other', name: ' example ' }] },
  { providers: [provider, { ...provider, name: 'Different' }] },
  { sessions: [row, row] },
  { sessions: [{ ...row, providerId: 'missing' }] },
  { sessions: [{ ...row, type: 'Other' }] },
  { vehiclePhotoDataUrl: undefined },
  { settings: { ...DEFAULT_SETTINGS, vehiclePhotoPath: 'old-owner/vehicle.jpg' } },
])('rejects ambiguous identities, missing references and incomplete photos before planning', patch => expect(parseBackup(JSON.stringify({ ...backup, ...patch }))).toBeNull())
it('applies preflight even to direct typed restore calls', () => expect(() => normalizeBackupValues({ ...backup, providers: [provider, provider] })).toThrow('duplicate'))
it('keeps imported UUIDs and archived/order metadata on an empty ledger', () => {
  const plan = planRestore(normalizeBackupValues(backup), [], [])
  expect(plan.newProviders).toEqual([provider])
  expect(plan.newSessions).toEqual([row])
  expect(backupDelta(backup, plan.newProviders, plan.newSessions).newSessions).toEqual([])
})
it('matches renamed UUIDs without changing current charger settings or ledger rows', () => {
  const currentProvider = { ...provider, name: 'Renamed', archived: false, freeKwhPerDay: 0, sortOrder: 0 }
  const currentRow = { ...row, type: 'Renamed', cost: 2 }
  const plan = planRestore(normalizeBackupValues(backup), [currentProvider], [currentRow])
  expect(plan.newProviders).toEqual([]); expect(plan.newSessions).toEqual([])
  expect(plan.sessionsConflicting).toBe(1)
  expect(currentRow.cost).toBe(2)
})
it('matches legacy charger names and maps new charges to current IDs', () => {
  const currentProvider = { ...provider, id: 'current', archived: false }
  const legacy = normalizeBackupValues({ ...backup, providers: [{ ...provider, id: 'legacy' }], sessions: [{ ...row, providerId: 'legacy' }] })
  const plan = planRestore(legacy, [currentProvider], [])
  expect(plan.newProviders).toEqual([])
  expect(plan.newSessions[0].providerId).toBe('current')
})
it('preserves multiplicity while matching identical legacy rows on repeat import', () => {
  const second = { ...row, id: '33333333-3333-4333-8333-333333333333' }
  const plan = planRestore(normalizeBackupValues({ ...backup, sessions: [row, second] }), [], [])
  expect(plan.newSessions).toHaveLength(2)
  const legacy = normalizeBackupValues({ ...backup, sessions: [{ ...row, id: 'legacy-a' }, { ...row, id: 'legacy-b' }] })
  const repeat = planRestore(legacy, [provider], [row])
  expect(repeat.newSessions).toHaveLength(1)
  expect(planRestore(legacy, [provider], [row, ...repeat.newSessions]).newSessions).toHaveLength(0)
})
it('does not consume a matched-ID row again for another content duplicate', () => {
  const sameContent = { ...row, id: 'other' }
  const plan = planRestore(normalizeBackupValues({ ...backup, sessions: [sameContent, row] }), [provider], [row])
  expect(plan.newSessions).toHaveLength(1)
})
it('rejects provider identity collisions rather than attaching rows to the wrong charger', () => {
  const providers = [{ ...provider, name: 'Renamed' }, { ...provider, id: 'other', name: 'Example' }]
  expect(() => planRestore(normalizeBackupValues(backup), providers, [])).toThrow('identity conflicts')
})
it('restores new charger metadata and appends in backup order while keeping matches unchanged', () => {
  const existing = { ...provider, id: 'current', name: 'Existing', sortOrder: 4 }
  const earlier = { ...provider, id: 'a', name: 'Earlier', sortOrder: 1 }
  const later = { ...provider, id: 'b', name: 'Later', sortOrder: 9 }
  const plan = planRestore(normalizeBackupValues({ ...backup, providers: [later, earlier], sessions: [] }), [existing], [])
  expect(plan.newProviders.map(item => [item.name, item.archived, item.sortOrder])).toEqual([['Earlier', true, 5], ['Later', true, 6]])
})
it('does not trust wire provenance to turn a v2 photo deletion into a legacy preserve', () => {
  expect(parseBackup(JSON.stringify({ ...backup, sourceVersion: 1 }))?.sourceVersion).toBe(2)
  expect(parseBackup(JSON.stringify({ version: 1, budgetCap: 75, providers: [provider], sessions: [row] }))?.sourceVersion).toBe(1)
})
it('accepts a complete self-contained photo and rejects corrupt or active image payloads', () => {
  expect(parseBackup(JSON.stringify({ ...backup, vehiclePhotoDataUrl: TEST_PHOTO }))?.vehiclePhotoDataUrl).toBe(TEST_PHOTO)
  for (const photo of ['data:image/svg+xml;base64,PHN2Zz4=', 'data:image/jpeg;base64,abcd', TEST_PHOTO.replace('image/png', 'image/jpeg'), TEST_PHOTO.slice(0, -4)]) expect(parseBackup(JSON.stringify({ ...backup, vehiclePhotoDataUrl: photo }))).toBeNull()
})
it('counts UTF-8 bytes and produces unambiguous signatures', () => {
  expect(() => parseBackupOrThrow(`{"pad":"${'😀'.repeat(3_800_000)}"}`)).toThrow('15 MB')
  expect(sessionSignature({ ...row, type: 'A|B', notes: 'C' })).not.toBe(sessionSignature({ ...row, type: 'A', notes: 'B|C' }))
})

it('rejects separate backup chargers that would both resolve to one current identity', () => {
  const current = { ...provider, name: 'Renamed' }
  const second = { ...provider, id: 'other', name: 'Renamed' }
  expect(() => planRestore(normalizeBackupValues({ ...backup, providers: [provider, second], sessions: [] }), [current], [])).toThrow('same existing charger')
})
it('normalizes UUID case before detecting duplicate identities', () => {
  const id = 'abcdefab-1234-4123-8123-abcdefabcdef'
  const source = { ...backup, providers: [{ ...provider, id }], sessions: [{ ...row, providerId: id.toUpperCase() }] }
  expect(parseBackup(JSON.stringify(source))?.sessions[0].providerId).toBe(id)
  expect(parseBackup(JSON.stringify({ ...source, providers: [source.providers[0], { ...provider, id: id.toUpperCase(), name: 'Other' }] }))).toBeNull()
})

it('rejects a backup above the supported 25000 charge ceiling', () => {
  const sessions = Array.from({ length: 25001 }, (_, id) => ({ ...row, id: String(id) }))
  expect(parseBackup(JSON.stringify({ ...backup, sessions }))).toBeNull()
})

it('preserves charge creation metadata through parsing and merge and rejects invalid timestamps', () => {
  const createdAt = '2026-01-01T00:00:00.000Z'
  const prepared = normalizeBackupValues({ ...backup, sessions: [{ ...row, createdAt }] })
  expect(planRestore(prepared, [], []).newSessions[0].createdAt).toBe(createdAt)
  expect(parseBackup(JSON.stringify({ ...backup, sessions: [{ ...row, createdAt: '2026-02-30T00:00:00.000Z' }] }))).toBeNull()
})
