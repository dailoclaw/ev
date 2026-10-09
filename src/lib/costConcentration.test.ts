import { describe, expect, it } from 'vitest'
import { costConcentration } from './costConcentration'
import type { EnrichedSession } from './savings'

const row = (overrides: Partial<EnrichedSession>): EnrichedSession => ({
  id: 'row',
  date: '2026-01-01',
  type: 'Network',
  amount: 10,
  cost: 0,
  notes: null,
  freeKwh: 10,
  paidKwh: 0,
  savedValue: 0,
  rate: 0,
  billedRate: 0,
  isFee: false,
  ...overrides,
})

describe('cost concentration', () => {
  it('separates free and billed energy before sorting by effective rate', () => {
    const model = costConcentration(
      [
        row({ id: 'free', amount: 10, freeKwh: 10 }),
        row({ id: 'mixed', amount: 10, cost: 4, freeKwh: 2, paidKwh: 8, rate: 0.4, billedRate: 0.5 }),
      ],
      'all',
      null,
      60,
    )

    expect(model.blocks.map(block => [block.kwh, block.rate])).toEqual([
      [10, 0],
      [2, 0],
      [8, 0.5],
    ])
    expect(model.totalKwh).toBe(20)
    expect(model.totalCost).toBe(4)
    expect(model.tailCostPct).toBe(100)
  })

  it('limits paid-only mode to billed energy', () => {
    const model = costConcentration(
      [
        row({ id: 'free' }),
        row({ id: 'paid', amount: 10, cost: 5, freeKwh: 0, paidKwh: 10, rate: 0.5, billedRate: 0.5 }),
      ],
      'paid',
      null,
      50,
    )

    expect(model.totalKwh).toBe(10)
    expect(model.energySessions).toBe(1)
    expect(model.tailCostPct).toBeCloseTo(50)
  })

  it('filters the curve and contributing sessions to one provider', () => {
    const model = costConcentration(
      [
        row({ id: 'a', type: 'A' }),
        row({ id: 'b', type: 'B', amount: 10, cost: 5, freeKwh: 0, paidKwh: 10, rate: 0.5, billedRate: 0.5 }),
      ],
      'provider',
      'B',
      80,
    )

    expect(model.energySessions).toBe(1)
    expect(model.tailSessions.map(session => session.id)).toEqual(['b'])
  })

  it('ignores subscription rows because they contain no energy', () => {
    const model = costConcentration(
      [row({ id: 'fee', amount: 0, cost: 15, freeKwh: 0, paidKwh: 0, isFee: true })],
      'all',
      null,
      88,
    )

    expect(model.points).toEqual([{ energyPct: 0, costPct: 0 }])
    expect(model.totalKwh).toBe(0)
    expect(model.totalCost).toBe(0)
  })
})

it('preserves positive recorded cost when an allowance covers all energy in every mode', () => {
  const covered = row({ amount: 7, cost: 5, freeKwh: 7, paidKwh: 0 })
  for (const mode of ['all', 'paid', 'provider'] as const) {
    const model = costConcentration([covered], mode, 'Network', 50)
    expect(model.totalCost).toBe(5)
    expect(model.totalKwh).toBe(7)
    expect(model.tailCostPct).toBeCloseTo(50)
    expect(model.points.at(-1)).toEqual({ energyPct: 100, costPct: 100 })
  }
})

it('reconciles scoped ledger cost with energy and excluded non-energy costs', () => {
  const sessions = [
    row({ id: 'covered', amount: 7, cost: 5, freeKwh: 7 }),
    row({ id: 'mixed', amount: 10, cost: 4, freeKwh: 2, paidKwh: 8 }),
    row({ id: 'fee', amount: 0, cost: 15, isFee: true }),
    row({ id: 'other', type: 'Other', amount: 10, cost: 100, freeKwh: 0 }),
  ]
  const result = costConcentration(sessions, 'provider', 'Network', 100)
  expect(result.totalCost + result.excludedNonEnergyCost).toBe(24)
  expect(result.tailCostPct).toBe(0)
  expect(result.tailSessions).toEqual([])
  const free = costConcentration([row({})], 'all', null, 0)
  expect(free.totalCost).toBe(0)
  expect(free.points.every(p => Number.isFinite(p.costPct))).toBe(true)
})
