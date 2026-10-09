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
    ], undefined, '2026-10')
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
    expect(yearOnYear([month('2025-01', 10, 0), month('2026-02', 12, 0)], undefined, '2026-10').hasPair).toBe(false)
  })
})

it('does not bridge missing years or compare the ongoing month', () => {
  expect(yearOnYear([month('2024-01', 10, 0), month('2026-01', 20, 0)], undefined, '2026-10').hasPair).toBe(false)
  const result = yearOnYear([
    month('2025-09', 10, 0), month('2026-09', 20, 0),
    month('2025-10', 100, 0), month('2026-10', 1, 0),
  ], undefined, '2026-10')
  expect(result.months.map(m => m.mm)).toEqual(['09'])
  expect(result.energyDeltaPct).toBe(100)
  expect(result.curKwh).toBe(10)
})

it('supports selected historical years, fees alone and zero energy baselines', () => {
  const rows = [month('2024-01', 15, 15), month('2025-01', 20, 20), month('2026-01', 50, 5)]
  const result = yearOnYear(rows, '2025', '2026-10')
  expect(result).toMatchObject({ prevYear: '2024', curYear: '2025', energyDeltaPct: null, feeDelta: 5 })
  expect(yearOnYear(rows, '2026', '2026-01').hasPair).toBe(false)
})
