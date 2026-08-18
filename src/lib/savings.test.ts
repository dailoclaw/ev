import { describe, expect, it } from 'vitest'
import type { Provider } from './providers'
import {
  allowanceUsedOn,
  enrichSessions,
  measuredPaidRate,
  monthlySummaries,
  previewFreeAllocation,
  providerSummaries,
  referenceRateBasis,
  totals,
  type Session,
} from './savings'

const providers: Provider[] = [
  { id: 'free', name: 'FreeCo', color: '#008000', freeKwhPerDay: 7 },
  { id: 'paid', name: 'PaidCo', color: '#0000ff', freeKwhPerDay: 0 },
]

const sessions: Session[] = [
  { id: 'a', date: '2026-01-01', type: 'FreeCo', amount: 5, cost: 0, notes: null },
  { id: 'b', date: '2026-01-01', type: 'FreeCo', amount: 4, cost: 1, notes: null },
  { id: 'c', date: '2026-01-02', type: 'PaidCo', amount: 20, cost: 10, notes: 'reference' },
  { id: 'd', date: '2026-01-03', type: 'FreeCo', amount: 0, cost: 15, notes: 'membership' },
]

describe('savings engine', () => {
  it('allocates each provider allowance once per day and derives honest totals', () => {
    const enriched = enrichSessions(sessions, providers)

    expect(enriched.map(s => ({ id: s.id, free: s.freeKwh, paid: s.paidKwh, saved: s.savedValue }))).toEqual([
      { id: 'a', free: 5, paid: 0, saved: 2.5 },
      { id: 'b', free: 2, paid: 2, saved: 1 },
      { id: 'c', free: 0, paid: 20, saved: 0 },
      { id: 'd', free: 0, paid: 0, saved: 0 },
    ])
    expect(enriched[3].isFee).toBe(true)
    expect(monthlySummaries(enriched)).toMatchObject([
      { month: '2026-01', cost: 26, kwh: 29, sessions: 4, freeKwh: 7, saved: 3.5, fees: 15 },
    ])
    expect(totals(enriched, providers)).toEqual({
      cost: 26,
      kwh: 29,
      sessions: 4,
      freeKwh: 7,
      saved: 3.5,
      fees: 15,
      netSaved: -11.5,
      refRate: 0.5,
      daysMaxed: 1,
    })
  })

  it('uses independent paid providers as the reference-rate basis', () => {
    expect(referenceRateBasis(sessions, providers)).toEqual({
      rate: 0.5,
      independent: true,
      from: ['PaidCo'],
      kwh: 20,
    })
  })

  it('falls back to the measured blended rate when independent data is too small', () => {
    const sparse: Session[] = [
      { id: 'a', date: '2026-01-01', type: 'PaidCo', amount: 10, cost: 5, notes: null },
      { id: 'b', date: '2026-01-01', type: 'FreeCo', amount: 10, cost: 3, notes: null },
    ]
    expect(measuredPaidRate(sparse)).toBe(0.4)
    expect(referenceRateBasis(sparse, providers)).toEqual({ rate: 0.4, independent: false, from: [], kwh: 10 })
  })

  it('summarizes providers and previews remaining allowance', () => {
    const enriched = enrichSessions(sessions, providers)
    expect(providerSummaries(enriched)).toEqual([
      { name: 'FreeCo', sessions: 3, cost: 16, kwh: 9, freeKwh: 7, saved: 3.5, fees: 15, effectiveRate: 16 / 9 },
      { name: 'PaidCo', sessions: 1, cost: 10, kwh: 20, freeKwh: 0, saved: 0, fees: 0, effectiveRate: 0.5 },
    ])
    expect(allowanceUsedOn(enriched, 'FreeCo', '2026-01-01')).toBe(7)
    expect(previewFreeAllocation(enriched, providers[0], '2026-01-04', 10, 0.5)).toEqual({
      freeKwh: 7,
      saving: 3.5,
      allowanceLeft: 7,
    })
    expect(previewFreeAllocation(enriched, providers[1], '2026-01-04', 10, 0.5)).toEqual({
      freeKwh: 0,
      saving: 0,
      allowanceLeft: 0,
    })
  })
})
