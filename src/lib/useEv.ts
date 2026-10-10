// One hook every page uses: raw state + enriched sessions + aggregates.
import { useMemo } from 'react'
import { useEvState } from './data'
import { selectLedger } from './ledgerSelectors'
import type { EnrichedSession, MonthSummary, ProviderSummary, Totals, RateBasis } from './savings'
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

  const ledger = useMemo(() => selectLedger(sessions, providers), [sessions, providers])

  return useMemo(() => {
    return {
      providers,
      ...ledger,
      budgetCap,
      synced,
      loading,
      settings,
      vehiclePhoto,
      syncStatus,
      pendingCount,
      lastSyncError,
    }
  }, [ledger, providers, budgetCap, synced, loading, settings, vehiclePhoto, syncStatus, pendingCount, lastSyncError])
}
