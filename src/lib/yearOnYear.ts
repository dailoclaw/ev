import type { MonthSummary } from './savings'
import { thisMonth } from './format'

export interface YoyMonth {
  mm: string // '05'
  label: string // 'May'
  prevEnergy: number
  curEnergy: number
  prevFees: number
  curFees: number
  prevKwh: number
  curKwh: number
}

export interface YearOnYear {
  hasPair: boolean
  prevYear: string
  curYear: string
  months: YoyMonth[]
  /** Totals across the comparable months only. */
  prevEnergy: number
  curEnergy: number
  prevFees: number
  curFees: number
  prevKwh: number
  curKwh: number
  energyDeltaPct: number | null
  feeDelta: number
}

const EMPTY: YearOnYear = {
  hasPair: false,
  prevYear: '',
  curYear: '',
  months: [],
  prevEnergy: 0,
  curEnergy: 0,
  prevFees: 0,
  curFees: 0,
  prevKwh: 0,
  curKwh: 0,
  energyDeltaPct: null,
  feeDelta: 0,
}

const monthShort = (mm: string) =>
  new Date(2000, Number(mm) - 1, 1).toLocaleDateString('en-AU', { month: 'short' })

/**
 * Pair the latest year against the one before it, using completed calendar months recorded in both consecutive years.
 * Energy is cost minus fees, so a membership charge never reads as more driving.
 */
export function yearOnYear(months: MonthSummary[], selectedYear?: string, asOfMonth = thisMonth()): YearOnYear {
  if (months.length === 0) return EMPTY

  const byYear = new Map<string, Map<string, MonthSummary>>()
  for (const m of months) {
    const [y, mm] = [m.month.slice(0, 4), m.month.slice(5, 7)]
    if (!byYear.has(y)) byYear.set(y, new Map())
    byYear.get(y)!.set(mm, m)
  }

  const years = [...byYear.keys()].sort()
  if (years.length < 2) return EMPTY
  const curYear = selectedYear ?? years.filter(year => year <= asOfMonth.slice(0, 4)).at(-1)
  if (!curYear) return EMPTY
  const prevYear = String(Number(curYear) - 1)
  const cur = byYear.get(curYear)
  const prev = byYear.get(prevYear)
  if (!cur || !prev) return EMPTY

  const pairs: YoyMonth[] = []
  for (const mm of [...cur.keys()].sort()) {
    const c = cur.get(mm)
    const p = prev.get(mm)
    if (!c || !p || `${curYear}-${mm}` >= asOfMonth) continue
    pairs.push({
      mm,
      label: monthShort(mm),
      prevEnergy: p.cost - p.fees,
      curEnergy: c.cost - c.fees,
      prevFees: p.fees,
      curFees: c.fees,
      prevKwh: p.kwh,
      curKwh: c.kwh,
    })
  }
  if (pairs.length === 0) return EMPTY

  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
  const prevEnergy = sum(pairs.map(p => p.prevEnergy))
  const curEnergy = sum(pairs.map(p => p.curEnergy))
  const prevFees = sum(pairs.map(p => p.prevFees))
  const curFees = sum(pairs.map(p => p.curFees))

  return {
    hasPair: true,
    prevYear,
    curYear,
    months: pairs,
    prevEnergy,
    curEnergy,
    prevFees,
    curFees,
    prevKwh: sum(pairs.map(p => p.prevKwh)),
    curKwh: sum(pairs.map(p => p.curKwh)),
    energyDeltaPct: prevEnergy > 0 ? ((curEnergy - prevEnergy) / prevEnergy) * 100 : null,
    feeDelta: curFees - prevFees,
  }
}
