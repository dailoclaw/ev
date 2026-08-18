import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from './appModel'
import { buildCsv, parseBackup } from './data'

const provider = { id: 'provider-1', name: 'Example', color: '#123456', freeKwhPerDay: 7 }
const session = {
  id: 'session-1',
  date: '2026-01-01',
  type: 'Example',
  amount: 7,
  cost: 0,
  notes: null,
}

describe('portable backups', () => {
  it('accepts the complete v2 shape and upgrades validated v1 files', () => {
    const current = parseBackup(
      JSON.stringify({
        version: 2,
        exportedAt: '2026-01-02T00:00:00.000Z',
        settings: DEFAULT_SETTINGS,
        providers: [provider],
        sessions: [session],
        vehiclePhotoDataUrl: null,
      }),
    )
    expect(current?.version).toBe(2)
    expect(current?.settings.vehicle.efficiency).toBe(14.2)

    const legacy = parseBackup(
      JSON.stringify({ version: 1, exportedAt: '2026-01-02T00:00:00.000Z', budgetCap: 75, providers: [provider], sessions: [session] }),
    )
    expect(legacy).toMatchObject({ version: 2, settings: { budgetCap: 75 }, vehiclePhotoDataUrl: null })
  })

  it('rejects malformed, unbounded, and zero-value ledger rows', () => {
    const base = {
      version: 2,
      exportedAt: '2026-01-02T00:00:00.000Z',
      settings: DEFAULT_SETTINGS,
      providers: [provider],
      sessions: [session],
      vehiclePhotoDataUrl: null,
    }
    expect(parseBackup('{bad json')).toBeNull()
    expect(parseBackup(JSON.stringify({ ...base, sessions: [{ ...session, amount: 0, cost: 0 }] }))).toBeNull()
    expect(parseBackup(JSON.stringify({ ...base, providers: [{ ...provider, color: 'red' }] }))).toBeNull()
    expect(parseBackup(JSON.stringify({ ...base, sessions: [{ ...session, type: 'Missing provider' }] }))).toBeNull()
    expect(parseBackup(JSON.stringify({ ...base, vehiclePhotoDataUrl: 'https://example.com/photo.jpg' }))).toBeNull()
  })
})

describe('CSV export', () => {
  it('quotes delimiters and neutralizes spreadsheet formulas', () => {
    const csv = buildCsv([{ ...session, type: '=IMPORTXML()', notes: '+cmd,with comma', freeKwh: 7 }])
    expect(csv).toContain("'=IMPORTXML()")
    expect(csv).toContain('"\'+cmd,with comma"')
  })
})
