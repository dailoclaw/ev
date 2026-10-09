import { describe, expect, it } from 'vitest'
import { allowanceRule, dailyAllowances, matchedMonthSpend, recentCalendarMonths } from './analyticsPeriods'
import { enrichSessions, referenceRate, type Session, type MonthSummary } from './savings'

const providers = [
  { id: 'a', name: 'A', color: '#000', freeKwhPerDay: 7 },
  { id: 'b', name: 'B', color: '#111', freeKwhPerDay: 5 },
]
const row = (id: string, type: string, date: string, amount: number, cost = 0): Session => ({ id, type, date, amount, cost, notes: null })
const month = (key: string, saved: number): MonthSummary => ({ month: key, label: key, saved, cost: 0, kwh: 0, freeKwh: 0, fees: 0, sessions: 0 })

describe('analytics scope helpers', () => {
  it('fills exactly six calendar months, including missing months and the ongoing month', () => {
    const result = recentCalendarMonths([month('2025-01', 100), month('2025-12', 30)], 6, '2026-03')
    expect(result.map(m => m.month)).toEqual(['2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03'])
    expect(result.reduce((sum, m) => sum + m.saved, 0) / result.length).toBe(5)
    expect(recentCalendarMonths([], 6, '2026-03').every(m => m.saved === 0)).toBe(true)
  })
  it('keeps independent daily caps and hides archived networks from today', () => {
    const date = '2026-01-01'
    const enriched = enrichSessions([row('a', 'A', date, 10), row('b', 'B', date, 3)], providers)
    expect(dailyAllowances(enriched, providers, date).map(a => [a.provider.name, a.used, a.left])).toEqual([['A', 7, 0], ['B', 3, 2]])
    expect(dailyAllowances(enriched, [{ ...providers[0], archived: true }, providers[1]], date)).toHaveLength(1)
    expect(dailyAllowances(enriched, [], date)).toEqual([])
  })
  it('describes every current allowance and no invented default', () => {
    expect(allowanceRule(providers)).toContain('A: min(7 kWh')
    expect(allowanceRule(providers)).toContain('B: min(5 kWh')
    expect(allowanceRule([])).toBe('No free allowances are configured.')
    const input = [row('a', 'A', '2026-01-01', 10)]
    expect(dailyAllowances(enrichSessions(input, providers), providers, '2026-01-01')[0].used).toBe(7)
    const changed = [{ ...providers[0], freeKwhPerDay: 2 }]
    expect(dailyAllowances(enrichSessions(input, changed), changed, '2026-01-01')[0].used).toBe(2)
    expect(referenceRate(input, providers)).toBe(0)
  })
  it('compares equal day prefixes across leap February and excludes later charges', () => {
    const rows = enrichSessions([
      row('p', 'A', '2024-02-29', 1, 10), row('c', 'A', '2024-03-29', 1, 20), row('late', 'A', '2024-03-31', 1, 100),
    ], providers)
    expect(matchedMonthSpend(rows, '2024-03-31')).toEqual({ days: 29, deltaPct: 100 })
    expect(matchedMonthSpend([], '2024-03-31').deltaPct).toBeNull()
    expect(matchedMonthSpend(enrichSessions([row('zero', 'A', '2024-02-01', 1)], providers), '2024-03-01').deltaPct).toBeNull()
  })
})
