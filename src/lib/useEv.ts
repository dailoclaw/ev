// One hook every page uses: raw state + enriched sessions + aggregates.
import { useMemo } from 'react'
import { useEvState } from './data'
import {
  enrichSessions,
  monthlySummaries,
  providerSummaries,
  totals,
  measuredPaidRate,
  type EnrichedSession,
  type MonthSummary,
  type ProviderSummary,
  type Totals,
} from './savings'
import type { Provider } from './providers'

export interface EvData {
  providers: Provider[]
  sessions: EnrichedSession[] // enriched, chronological (oldest → newest)
  sessionsDesc: EnrichedSession[] // newest first
  months: MonthSummary[]
  byProvider: ProviderSummary[]
  lifetime: Totals
  refRate: number
  budgetCap: number
  synced: boolean
  loading: boolean
}

export function useEv(): EvData {
  const { sessions, providers, budgetCap, synced, loading } = useEvState()

  return useMemo(() => {
    const ordered = [...sessions].sort((a, b) => a.date.localeCompare(b.date))
    const enriched = enrichSessions(ordered, providers)
    const sessionsDesc = [...enriched].reverse()
    return {
      providers,
      sessions: enriched,
      sessionsDesc,
      months: monthlySummaries(enriched),
      byProvider: providerSummaries(enriched),
      lifetime: totals(enriched, providers),
      refRate: measuredPaidRate(sessions),
      budgetCap,
      synced,
      loading,
    }
  }, [sessions, providers, budgetCap, synced, loading])
}
