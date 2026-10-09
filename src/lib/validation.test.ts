import { afterEach, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from './appModel'
import { parseBackup } from './backup'
import { isCalendarDate, normalizeProvider, normalizeSession, normalizeSettings, validateSessionInput, validateSettings, VEHICLE_LIMITS } from './validation'

const row = { date: '2024-02-29', type: 'Example', amount: 1, cost: 1, notes: null }
afterEach(() => vi.useRealTimers())
it.each(['2026-02-30', '2025-02-29', '2100-02-29', '2024-04-31', '2024-00-01', '2024-13-01', '2024-01-00', '2024-1-01', '', '0000-01-01'])('rejects impossible calendar date %s', date => {
  expect(isCalendarDate(date)).toBe(false)
  expect(validateSessionInput({ ...row, date })).not.toBeNull()
})
it.each(['2000-02-29', '2024-02-29', '2026-02-28'])('accepts real calendar date %s', date => expect(validateSessionInput({ ...row, date })).toBeNull())
it.each(['2026-10-08T23:59:59Z', '2026-10-09T00:00:00Z'])('uses one UTC date boundary at %s', instant => {
  vi.useFakeTimers(); vi.setSystemTime(new Date(instant))
  const tomorrow = new Date(instant); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  expect(validateSessionInput({ ...row, date: tomorrow.toISOString().slice(0, 10) })).toBeNull()
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  expect(validateSessionInput({ ...row, date: tomorrow.toISOString().slice(0, 10) })).toContain('future')
})
it.each([-1, 100_000.001, NaN, Infinity, '50', null])('rejects invalid budget %s', budgetCap => {
  expect(validateSettings({ ...DEFAULT_SETTINGS, budgetCap })).not.toBeNull()
  expect(parseBackup(JSON.stringify({ version: 1, budgetCap, providers: [], sessions: [] }))).toBeNull()
})
it.each(Object.entries(VEHICLE_LIMITS))('enforces %s bounds', (key, { min, max }) => {
  for (const value of [min, max]) expect(validateSettings({ ...DEFAULT_SETTINGS, vehicle: { ...DEFAULT_SETTINGS.vehicle, [key]: value } })).toBeNull()
  for (const value of [min - 0.001, max + 0.001, NaN, Infinity]) expect(validateSettings({ ...DEFAULT_SETTINGS, vehicle: { ...DEFAULT_SETTINGS.vehicle, [key]: value } })).not.toBeNull()
})
it.each([null, {}, { ...DEFAULT_SETTINGS, vehicle: null }, { ...DEFAULT_SETTINGS, theme: 'blue' }, { ...DEFAULT_SETTINGS, style: 'other' }, { ...DEFAULT_SETTINGS, density: 'other' }, { ...DEFAULT_SETTINGS, vehiclePhotoPath: 1 }])('rejects malformed settings safely', settings => expect(validateSettings(settings)).not.toBeNull())
it('normalizes precision consistently and rejects rows that disappear after rounding', () => {
  expect(normalizeSettings({ ...DEFAULT_SETTINGS, budgetCap: 1.005, vehicle: { efficiency: 14.225, petrolPrice: 1.2345, petrolUse: 7.005 } })).toMatchObject({ budgetCap: 1.01, vehicle: { efficiency: 14.23, petrolPrice: 1.235, petrolUse: 7.01 } })
  expect(normalizeSession({ ...row, amount: 1.2345, cost: 1.005 })).toMatchObject({ amount: 1.235, cost: 1.01 })
  expect(normalizeProvider({ name: ' Example ', freeKwhPerDay: 1.005, color: '#123456' }).freeKwhPerDay).toBe(1.01)
  expect(() => normalizeSession({ ...row, amount: 0.0001, cost: 0.001 })).toThrow('after rounding')
  expect(() => normalizeSession({ ...row, amount: -0.0001 })).toThrow('Energy')
  expect(() => normalizeProvider({ name: 'Example', freeKwhPerDay: 0, color: '#123456', sortOrder: 0.5 })).toThrow('integer')
})
it('applies the same settings and precision rules to both backup versions', () => {
  const legacy = { version: 1, budgetCap: 1.005, providers: [], sessions: [] }
  expect(parseBackup(JSON.stringify(legacy))?.settings.budgetCap).toBe(1.01)
  const current = { version: 2, settings: { ...DEFAULT_SETTINGS, budgetCap: 1.005 }, providers: [], sessions: [], vehiclePhotoDataUrl: null }
  expect(parseBackup(JSON.stringify(current))?.settings.budgetCap).toBe(1.01)
  expect(parseBackup(JSON.stringify({ ...current, settings: { ...DEFAULT_SETTINGS, vehicle: { ...DEFAULT_SETTINGS.vehicle, efficiency: 0 } } }))).toBeNull()
})
it('accepts inclusive session limits and rejects values outside them', () => {
  expect(validateSessionInput({ ...row, amount: 10_000, cost: 100_000, notes: 'a'.repeat(1000) })).toBeNull()
  for (const amount of [-0.001, 10_000.001, NaN, Infinity]) expect(validateSessionInput({ ...row, amount })).toContain('Energy')
  for (const cost of [-0.001, 100_000.001, NaN, Infinity]) expect(validateSessionInput({ ...row, cost })).toContain('Cost')
  expect(validateSessionInput({ ...row, notes: 'a'.repeat(1001) })).toContain('Notes')
  expect(validateSessionInput({ ...row, date: '1999-12-31' })).toContain('2000')
  for (const budgetCap of [0, 100_000]) expect(validateSettings({ ...DEFAULT_SETTINGS, budgetCap })).toBeNull()
})
it('enforces inclusive provider limits and integer order before rounding', () => {
  const provider = { name: 'Example', color: '#123456', freeKwhPerDay: 0, sortOrder: 0 }
  expect(normalizeProvider(provider)).toEqual(provider)
  expect(normalizeProvider({ ...provider, freeKwhPerDay: 500, sortOrder: 10_000 }).freeKwhPerDay).toBe(500)
  for (const freeKwhPerDay of [-0.001, 500.001, NaN, Infinity]) expect(() => normalizeProvider({ ...provider, freeKwhPerDay })).toThrow('Daily allowance')
  for (const sortOrder of [-1, 10_001, 0.5]) expect(() => normalizeProvider({ ...provider, sortOrder })).toThrow('integer')
})
