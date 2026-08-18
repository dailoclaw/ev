import { describe, expect, it } from 'vitest'
import { yearOnYear } from './yearOnYear'
import type { MonthSummary } from './savings'

const month = (month: string, cost: number, fees: number): MonthSummary => ({
  month,
  label: month,
  cost,
  fees,
  kwh: 10,
  sessions: 1,
  freeKwh: 0,
  saved: 0,
})

describe('year-on-year comparison', () => {
  it('compares only months present in both latest years and separates fees', () => {
    const result = yearOnYear([
      month('2025-01', 20, 5),
      month('2025-02', 30, 5),
      month('2026-01', 25, 5),
      month('2026-03', 100, 50),
    ])
    expect(result).toMatchObject({
      hasPair: true,
      prevYear: '2025',
      curYear: '2026',
      prevEnergy: 15,
      curEnergy: 20,
      prevFees: 5,
      curFees: 5,
      feeDelta: 0,
    })
    expect(result.energyDeltaPct).toBeCloseTo(100 / 3)
    expect(result.months.map(m => m.mm)).toEqual(['01'])
  })

  it('has no comparison without overlapping years', () => {
    expect(yearOnYear([]).hasPair).toBe(false)
    expect(yearOnYear([month('2026-01', 10, 0)]).hasPair).toBe(false)
    expect(yearOnYear([month('2025-01', 10, 0), month('2026-02', 12, 0)]).hasPair).toBe(false)
  })
})
