// The free-energy savings engine.
// Core rule: a provider may give the first N kWh each day for free (Jolt: 7 kWh/day).
// We apply that allowance day-by-day, session-by-session, and value the free energy
// at the user's *measured* paid rate elsewhere.
import type { Provider } from './providers'

export interface Session {
  id: string
  date: string // yyyy-mm-dd
  type: string // provider name
  amount: number // kWh
  cost: number // AUD
  notes: string | null
}

export interface EnrichedSession extends Session {
  freeKwh: number
  paidKwh: number
  savedValue: number // freeKwh * reference rate
  rate: number // cost / amount (headline rate)
  billedRate: number // cost / paidKwh when some energy was billed
  isFee: boolean // cost with no energy — e.g. Jolt's $15/mo membership charge
}

export interface MonthSummary {
  month: string // yyyy-mm
  label: string // "Jun 2026"
  cost: number
  kwh: number
  sessions: number
  freeKwh: number
  saved: number
  fees: number // membership/subscription charges (no energy attached)
}

export interface ProviderSummary {
  name: string
  sessions: number
  cost: number
  kwh: number
  freeKwh: number
  saved: number
  fees: number
  effectiveRate: number // cost / kwh, all-in (fees included)
}

const monthLabel = (ym: string) => {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })
}

/** Average $/kWh across sessions that actually cost money — the value of a free kWh. */
export function measuredPaidRate(sessions: Session[]): number {
  let cost = 0
  let kwh = 0
  for (const s of sessions) {
    if (s.cost > 0 && s.amount > 0) {
      cost += s.cost
      kwh += s.amount
    }
  }
  return kwh > 0 ? cost / kwh : 0
}

/** How the value of a free kWh was arrived at — surfaced so the UI can show its working. */
export interface RateBasis {
  rate: number
  /** True when the rate comes only from providers that give no free energy. */
  independent: boolean
  /** Provider names that set the rate. */
  from: string[]
  /** Paid kWh behind the rate. */
  kwh: number
}

/** Below this there isn't enough independent data to trust the rate. */
const MIN_BASIS_KWH = 20

/**
 * What a free kWh is actually worth: the price of that energy somewhere else.
 *
 * Only providers *without* their own allowance count. Including an allowance
 * provider's own sessions values its giveaway using its own discounted prices —
 * those sessions are already softened by the free kWh inside them, which drags
 * the rate down and understates the saving. Falls back to the all-session rate
 * when there isn't enough independent data to be meaningful.
 */
export function referenceRateBasis(sessions: Session[], providers: Provider[]): RateBasis {
  const independent = new Set(providers.filter(p => p.freeKwhPerDay <= 0).map(p => p.name))
  const from = new Set<string>()
  let cost = 0
  let kwh = 0
  for (const s of sessions) {
    if (!independent.has(s.type)) continue
    if (s.cost > 0 && s.amount > 0) {
      cost += s.cost
      kwh += s.amount
      from.add(s.type)
    }
  }
  if (kwh >= MIN_BASIS_KWH) {
    return { rate: cost / kwh, independent: true, from: [...from].sort(), kwh }
  }
  // Not enough energy bought outside an allowance — fall back to the blended rate.
  return { rate: measuredPaidRate(sessions), independent: false, from: [], kwh }
}

/** The value of a free kWh. See referenceRateBasis for how it's chosen. */
export function referenceRate(sessions: Session[], providers: Provider[]): number {
  return referenceRateBasis(sessions, providers).rate
}

/**
 * Apply each provider's daily free allowance across sessions.
 * Sessions on the same provider+day consume the allowance in date order.
 */
export function enrichSessions(sessions: Session[], providers: Provider[]): EnrichedSession[] {
  const refRate = referenceRate(sessions, providers)
  const freeByProvider = new Map(providers.map(p => [p.name, p.freeKwhPerDay]))
  // allowance remaining per provider+day key
  const remaining = new Map<string, number>()

  // process in chronological order so allowance applies to the first charge of the day
  const ordered = [...sessions].sort((a, b) => a.date.localeCompare(b.date))
  const enriched = new Map<string, EnrichedSession>()

  for (const s of ordered) {
    const dailyFree = freeByProvider.get(s.type) ?? 0
    const key = `${s.type}|${s.date}`
    if (!remaining.has(key)) remaining.set(key, dailyFree)
    const avail = remaining.get(key)!
    const freeKwh = Math.min(avail, s.amount)
    remaining.set(key, avail - freeKwh)
    const paidKwh = Math.max(0, s.amount - freeKwh)
    enriched.set(s.id, {
      ...s,
      freeKwh,
      paidKwh,
      savedValue: freeKwh * refRate,
      rate: s.amount > 0 ? s.cost / s.amount : 0,
      billedRate: paidKwh > 0 ? s.cost / paidKwh : 0,
      isFee: s.cost > 0 && s.amount <= 0,
    })
  }
  // return in the caller's original order
  return sessions.map(s => enriched.get(s.id)!)
}

export function monthlySummaries(sessions: EnrichedSession[]): MonthSummary[] {
  const byMonth = new Map<string, MonthSummary>()
  for (const s of sessions) {
    const ym = s.date.slice(0, 7)
    let m = byMonth.get(ym)
    if (!m) {
      m = { month: ym, label: monthLabel(ym), cost: 0, kwh: 0, sessions: 0, freeKwh: 0, saved: 0, fees: 0 }
      byMonth.set(ym, m)
    }
    m.cost += s.cost
    m.kwh += s.amount
    m.sessions += 1
    m.freeKwh += s.freeKwh
    m.saved += s.savedValue
    if (s.isFee) m.fees += s.cost
  }
  return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month))
}

export function providerSummaries(sessions: EnrichedSession[]): ProviderSummary[] {
  const byName = new Map<string, ProviderSummary>()
  for (const s of sessions) {
    let p = byName.get(s.type)
    if (!p) {
      p = { name: s.type, sessions: 0, cost: 0, kwh: 0, freeKwh: 0, saved: 0, fees: 0, effectiveRate: 0 }
      byName.set(s.type, p)
    }
    p.sessions += 1
    p.cost += s.cost
    p.kwh += s.amount
    p.freeKwh += s.freeKwh
    p.saved += s.savedValue
    if (s.isFee) p.fees += s.cost
  }
  for (const p of byName.values()) p.effectiveRate = p.kwh > 0 ? p.cost / p.kwh : 0
  return [...byName.values()].sort((a, b) => b.cost - a.cost)
}

export interface Totals {
  cost: number
  kwh: number
  sessions: number
  freeKwh: number
  saved: number
  fees: number // membership charges
  netSaved: number // saved minus fees — the honest number
  refRate: number
  daysMaxed: number // days a provider's full allowance was used
}

export function totals(sessions: EnrichedSession[], providers: Provider[]): Totals {
  const t: Totals = { cost: 0, kwh: 0, sessions: sessions.length, freeKwh: 0, saved: 0, fees: 0, netSaved: 0, refRate: 0, daysMaxed: 0 }
  const dayFree = new Map<string, number>()
  for (const s of sessions) {
    t.cost += s.cost
    t.kwh += s.amount
    t.freeKwh += s.freeKwh
    t.saved += s.savedValue
    if (s.isFee) t.fees += s.cost
    const key = `${s.type}|${s.date}`
    dayFree.set(key, (dayFree.get(key) ?? 0) + s.freeKwh)
  }
  const freeByProvider = new Map(providers.map(p => [p.name, p.freeKwhPerDay]))
  for (const [key, used] of dayFree) {
    const allowance = freeByProvider.get(key.split('|')[0]) ?? 0
    if (allowance > 0 && used >= allowance - 1e-9) t.daysMaxed += 1
  }
  t.refRate = referenceRate(sessions, providers)
  t.netSaved = t.saved - t.fees
  return t
}

/** kWh of a provider's daily allowance already consumed on a given date. */
export function allowanceUsedOn(sessions: EnrichedSession[], providerName: string, date: string): number {
  return sessions
    .filter(s => s.type === providerName && s.date === date)
    .reduce((sum, s) => sum + s.freeKwh, 0)
}

/** Preview how much of a hypothetical new charge would be free. */
export function previewFreeAllocation(
  sessions: EnrichedSession[],
  provider: Provider | undefined,
  date: string,
  kwh: number,
  refRate: number,
): { freeKwh: number; saving: number; allowanceLeft: number } {
  if (!provider || provider.freeKwhPerDay <= 0) return { freeKwh: 0, saving: 0, allowanceLeft: 0 }
  const used = allowanceUsedOn(sessions, provider.name, date)
  const left = Math.max(0, provider.freeKwhPerDay - used)
  const freeKwh = Math.min(left, kwh)
  return { freeKwh, saving: freeKwh * refRate, allowanceLeft: left }
}
