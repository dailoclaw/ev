import { expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from './appModel'
import { costConcentration } from './costConcentration'
import { deriveMonthSpend, deriveNetBenefit } from './derive'
import { buildCsv } from './exports'
import { enrichSessions, monthlySummaries, providerSummaries, referenceRateBasis, totals, type Session } from './savings'
import type { EvData } from './useEv'

it('receipts, CSV, chart and derivations preserve the same recorded costs and scope', () => {
  const providers = [
    { id: 'a', name: 'A', color: '#000000', freeKwhPerDay: 7 },
    { id: 'b', name: 'B', color: '#111111', freeKwhPerDay: 5 },
  ]
  const rows: Session[] = [
    { id: 'a', type: 'A', date: '2026-01-01', amount: 7, cost: 5, notes: null },
    { id: 'b', type: 'B', date: '2026-01-01', amount: 10, cost: 4, notes: null },
    { id: 'fee', type: 'A', date: '2026-01-01', amount: 0, cost: 15, notes: null },
  ]
  const sessions = enrichSessions(rows, providers)
  const rateBasis = referenceRateBasis(rows, providers)
  const ev: EvData = {
    providers, sessions, sessionsDesc: [...sessions].reverse(), months: monthlySummaries(sessions),
    byProvider: providerSummaries(sessions), lifetime: totals(sessions, providers), refRate: rateBasis.rate, rateBasis,
    budgetCap: 0, synced: true, loading: false, settings: { ...DEFAULT_SETTINGS, budgetCap: 0 },
    vehiclePhoto: null, syncStatus: 'synced', pendingCount: 0, lastSyncError: null,
  }
  const csvTotal = buildCsv(sessions).split('\n').slice(1).reduce((sum, line) => sum + Number(line.split(',')[3]), 0)
  const chart = costConcentration(sessions, 'all', null, 88)
  expect(csvTotal).toBe(24)
  expect(ev.months[0].cost).toBe(csvTotal)
  expect(chart.totalCost + chart.excludedNonEnergyCost).toBe(csvTotal)
  expect(deriveMonthSpend(ev, '2026-01')?.value).toBe('$24.00')
  expect(deriveMonthSpend(ev, '2026-01')?.rows?.items.map(row => row.value)).toEqual(['$15.00', '$4.00', '$5.00'])
  const explanation = deriveNetBenefit(ev).lines.map(line => line.label).join(' ')
  expect(explanation).toContain('A: min(7 kWh')
  expect(explanation).toContain('B: min(5 kWh')
  expect(explanation).not.toContain('Jolt')
  expect(explanation).toContain('positive-cost energy charges')
})
