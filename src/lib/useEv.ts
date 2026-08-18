// One hook every page uses: raw state + enriched sessions + aggregates.
import { useMemo } from 'react'
import { useEvState } from './data'
import {
  enrichSessions,
  monthlySummaries,
  providerSummaries,
  totals,
  referenceRateBasis,
  type EnrichedSession,
  type MonthSummary,
  type ProviderSummary,
  type Totals,
  type RateBasis,
} from './savings'
import type { Provider } from './providers'
import type { AppSettings, SyncStatus } from './appModel'

export interface EvData {
  providers: Provider[]
  sessions: EnrichedSession[] // enriched, chronological (oldest → newest)
  sessionsDesc: EnrichedSession[] // newest first
  months: MonthSummary[]
  byProvider: ProviderSummary[]
  lifetime: Totals
  refRate: number
  rateBasis: RateBasis
  budgetCap: number
  synced: boolean
  loading: boolean
  settings: AppSettings
  vehiclePhoto: string | null
  syncStatus: SyncStatus
  pendingCount: number
  lastSyncError: string | null
}

export function useEv(): EvData {
  const { sessions, providers, budgetCap, synced, loading, settings, vehiclePhoto, syncStatus, pendingCount, lastSyncError } = useEvState()

  return useMemo(() => {
    const ordered = [...sessions].sort((a, b) => a.date.localeCompare(b.date))
    const basis = referenceRateBasis(sessions, providers)
    const enriched = enrichSessions(ordered, providers)
    const sessionsDesc = [...enriched].reverse()
    return {
      providers,
      sessions: enriched,
      sessionsDesc,
      months: monthlySummaries(enriched),
      byProvider: providerSummaries(enriched),
      lifetime: totals(enriched, providers),
      refRate: basis.rate,
      rateBasis: basis,
      budgetCap,
      synced,
      loading,
      settings,
      vehiclePhoto,
      syncStatus,
      pendingCount,
      lastSyncError,
    }
  }, [sessions, providers, budgetCap, synced, loading, settings, vehiclePhoto, syncStatus, pendingCount, lastSyncError])
}
