import type { Provider } from './providers'
import { compareSessions, enrichSessions, monthlySummaries, providerSummaries, referenceRateBasis, totals, type Session } from './savings'

function deriveLedger(sessions: Session[], providers: Provider[]) {
  const ordered = [...sessions].sort(compareSessions)
  const rateBasis = referenceRateBasis(sessions, providers)
  const enriched = enrichSessions(ordered, providers)
  return {
    sessions: enriched,
    sessionsDesc: [...enriched].reverse(),
    months: monthlySummaries(enriched),
    byProvider: providerSummaries(enriched),
    lifetime: totals(enriched, providers),
    refRate: rateBasis.rate,
    rateBasis,
  }
}

export type LedgerSummary = ReturnType<typeof deriveLedger>
const summaries = new WeakMap<Session[], WeakMap<Provider[], LedgerSummary>>()

/** State mutations replace these arrays. Sync metadata can reuse the same summary across hooks. */
export function selectLedger(sessions: Session[], providers: Provider[]): LedgerSummary {
  let byProviders = summaries.get(sessions)
  if (!byProviders) { byProviders = new WeakMap(); summaries.set(sessions, byProviders) }
  let summary = byProviders.get(providers)
  if (!summary) { summary = deriveLedger(sessions, providers); byProviders.set(providers, summary) }
  return summary
}
