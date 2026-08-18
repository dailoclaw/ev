import { describe, expect, it } from 'vitest'
import { costAnatomy } from './costAnatomy'
import type { EnrichedSession } from './savings'

const row = (patch: Partial<EnrichedSession> & Pick<EnrichedSession, 'id' | 'date'>): EnrichedSession => ({
  type: 'FreeCo',
  amount: 0,
  cost: 0,
  notes: null,
  freeKwh: 0,
  paidKwh: 0,
  savedValue: 0,
  rate: 0,
  billedRate: 0,
  isFee: false,
  ...patch,
})

describe('cost anatomy', () => {
  it('returns the empty model when there are no fee rows', () => {
    expect(costAnatomy([row({ id: 'e', date: '2026-01-01', amount: 10 })], 0.5).hasFees).toBe(false)
  })

  it('separates fees, energy, and completed-month break-even figures', () => {
    const sessions = [
      row({ id: 'f1', date: '2026-01-01', cost: 15, isFee: true }),
      row({ id: 'e1', date: '2026-01-10', amount: 20, cost: 10, paidKwh: 20 }),
      row({ id: 'f2', date: '2026-02-01', cost: 15, isFee: true }),
      row({ id: 'e2', date: '2026-02-10', amount: 10, freeKwh: 7, savedValue: 3.5 }),
    ]
    const result = costAnatomy(sessions, 0.5, '2026-02')

    expect(result).toMatchObject({
      hasFees: true,
      feeStart: '2026-01-01',
      fees: 30,
      energyCost: 10,
      totalCost: 40,
      kwh: 30,
      feePerKwh: 1,
      energyPerKwh: 1 / 3,
      blendedPerKwh: 4 / 3,
      feeSharePct: 75,
      monthlyFee: 15,
      avgFreeKwhPerMonth: 0,
      avgFreeValuePerMonth: 0,
      netPerMonth: -15,
      breakEvenKwh: 30,
    })
    expect(result.months).toHaveLength(2)
    expect(result.months[1]).toMatchObject({ month: '2026-02', fee: 15, freeKwh: 7, freeValue: 3.5, net: -11.5 })
  })
})
