import type { Provider } from './providers'
import { allowanceUsedOn, type EnrichedSession, type MonthSummary } from './savings'
import { thisMonth } from './format'

/** Calendar windows include zero-record months and the current, unfinished month. */
export function recentCalendarMonths(months: MonthSummary[], count = 6, end = thisMonth()): MonthSummary[] {
  const byMonth = new Map(months.map(month => [month.month, month]))
  const [year, mm] = end.split('-').map(Number)
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(Date.UTC(year, mm - count + i, 1))
    const key = date.toISOString().slice(0, 7)
    return byMonth.get(key) ?? {
      month: key, label: date.toLocaleDateString('en-AU', { month: 'short', year: 'numeric', timeZone: 'UTC' }),
      cost: 0, kwh: 0, sessions: 0, freeKwh: 0, saved: 0, fees: 0,
    }
  })
}

export function dailyAllowances(sessions: EnrichedSession[], providers: Provider[], date: string) {
  return providers.filter(p => !p.archived && p.freeKwhPerDay > 0).map(provider => {
    const used = allowanceUsedOn(sessions, provider.name, date)
    return { provider, used, left: Math.max(0, provider.freeKwhPerDay - used) }
  })
}

export function allowanceRule(providers: Provider[]): string {
  const rules = providers.filter(p => p.freeKwhPerDay > 0).map(p => `${p.name}: min(${p.freeKwhPerDay} kWh, that day's energy)`)
  return rules.length ? `Sum separately for each network and day: ${rules.join('; ')}. Current allowance settings apply across recorded history.` : 'No free allowances are configured.'
}

/** Equal calendar-day prefixes; require records in both windows before comparing. */
export function matchedMonthSpend(sessions: EnrichedSession[], date: string) {
  const [year, month, day] = date.split('-').map(Number)
  const previous = new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 7)
  const days = Math.min(day, new Date(Date.UTC(year, month - 1, 0)).getUTCDate())
  const current = date.slice(0, 7)
  const rows = (ym: string) => sessions.filter(s => s.date.startsWith(ym) && Number(s.date.slice(8, 10)) <= days)
  const cur = rows(current), prev = rows(previous)
  const total = (list: EnrichedSession[]) => list.reduce((sum, s) => sum + s.cost, 0)
  const previousCost = total(prev)
  return { days, deltaPct: cur.length && prev.length && previousCost > 0 ? (total(cur) - previousCost) / previousCost * 100 : null }
}
