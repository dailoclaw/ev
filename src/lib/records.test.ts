import { describe, expect, it } from 'vitest'
import type { Provider } from './providers'
import { records } from './records'
import type { EnrichedSession, MonthSummary, ProviderSummary, RateBasis, Totals } from './savings'
import type { EvData } from './useEv'
import { DEFAULT_SETTINGS } from './appModel'

const provider: Provider = { id: 'free', name: 'FreeCo', color: '#008000', freeKwhPerDay: 7 }

const session = (id: string, date: string, patch: Partial<EnrichedSession> = {}): EnrichedSession => ({
  id,
  date,
  type: 'FreeCo',
  amount: 7,
  cost: 0,
  notes: null,
  freeKwh: 7,
  paidKwh: 0,
  savedValue: 3.5,
  rate: 0.5,
  billedRate: 0,
  isFee: false,
  ...patch,
})

const total = (patch: Partial<Totals> = {}): Totals => ({
  cost: 0,
  kwh: 0,
  sessions: 0,
  freeKwh: 0,
  saved: 0,
  fees: 0,
  netSaved: 0,
  refRate: 0.5,
  daysMaxed: 0,
  ...patch,
})

const evData = (sessions: EnrichedSession[], months: MonthSummary[] = [], lifetime = total()): EvData => ({
  providers: [provider],
  sessions,
  sessionsDesc: [...sessions].reverse(),
  months,
  byProvider: [] as ProviderSummary[],
  lifetime,
  refRate: 0.5,
  rateBasis: { rate: 0.5, independent: true, from: ['PaidCo'], kwh: 100 } as RateBasis,
  budgetCap: 50,
  synced: true,
  loading: false,
  settings: DEFAULT_SETTINGS,
  vehiclePhoto: null,
  syncStatus: 'synced',
  pendingCount: 0,
  lastSyncError: null,
})

const month = (ym: string, cost: number, kwh: number, freeKwh = 0): MonthSummary => ({
  month: ym,
  label: ym,
  cost,
  fees: 0,
  kwh,
  sessions: 1,
  freeKwh,
  saved: freeKwh * 0.5,
})

describe('records', () => {
  it('returns locked starter records for an empty ledger', () => {
    const result = records(evData([]))
    expect(result).toMatchObject({ currentStreak: 0, bestStreak: 0, freezesHeld: 0, freezeSavedDate: null })
    expect(result.trophies).toHaveLength(6)
    expect(result.trophies.every(t => !t.unlocked)).toBe(true)
    expect(result.targets.map(t => t.name)).toEqual(['Century streak', 'Perfect week', '$250 net saved'])
  })

  it('derives milestones, perfect-week progress, rates, and the current streak', () => {
    const sessions = [
      session('a', '2024-01-01', { amount: 300 }),
      session('b', '2024-01-02', { amount: 250 }),
      session('c', '2024-01-03', { amount: 20 }),
      session('d', '2024-01-04', { amount: 30 }),
      session('e', '2024-01-05', { amount: 40 }),
      session('f', '2024-01-06', { amount: 50 }),
      session('g', '2024-01-07', { amount: 60 }),
      session('paid', '2024-01-08', { amount: 5, cost: 2, freeKwh: 0, paidKwh: 5, savedValue: 0 }),
    ]
    const months = [month('2024-01', 5, 100, 49), month('2024-02', 0, 20, 20)]
    const result = records(evData(sessions, months, total({ kwh: 755, netSaved: 300 })))

    expect(result.currentStreak).toBe(0)
    expect(result.bestStreak).toBe(7)
    expect(result.trophies.some(t => t.name === '500 kWh Club' && t.unlocked)).toBe(true)
    expect(result.trophies.some(t => t.name === 'Biggest sip')).toBe(true)
    expect(result.trophies.some(t => t.name === '$250 net saved')).toBe(true)
    expect(result.trophies.some(t => t.name === '$0 month')).toBe(true)
    expect(result.trophies.some(t => t.name === 'Perfect week')).toBe(true)
    expect(result.trophies.some(t => t.name === 'Sub-10¢ month')).toBe(true)
    expect(result.targets.some(t => t.name === 'Perfect month')).toBe(true)
  })

  it('earns and spends one century freeze without breaking the streak', () => {
    const free = Array.from({ length: 100 }, (_, index) =>
      session(`free-${index}`, `2023-01-${String((index % 28) + 1).padStart(2, '0')}`),
    )
    const overflow = session('overflow', '2023-05-01', { cost: 1, freeKwh: 0, paidKwh: 7, savedValue: 0 })
    const after = session('after', '2023-05-02')
    const result = records(evData([...free, overflow, after], [], total({ kwh: 707, netSaved: 600 })))

    expect(result.currentStreak).toBe(101)
    expect(result.bestStreak).toBe(101)
    expect(result.freezesHeld).toBe(0)
    expect(result.freezeSavedDate).toBe('2023-05-01')
    expect(result.trophies.some(t => t.name === 'Century streak')).toBe(true)
  })
})
