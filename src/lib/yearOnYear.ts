// Same-month year-on-year comparison, with fees held apart from energy.
//
// A raw year-vs-year delta compares a full year against a partial one and folds a
// new subscription into what looks like rising consumption. Pairing calendar months
// that exist in BOTH years — and splitting fixed fees out of variable energy — shows
// the two movements separately, which is usually the opposite story.
import type { MonthSummary } from './savings'

export interface YoyMonth {
  mm: string // '05'
  label: string // 'May'
  prevEnergy: number
  curEnergy: number
  prevFees: number
  curFees: number
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
  energyDeltaPct: null,
  feeDelta: 0,
}

const monthShort = (mm: string) =>
  new Date(2000, Number(mm) - 1, 1).toLocaleDateString('en-AU', { month: 'short' })

/**
 * Pair the latest year against the one before it, using only months present in both.
 * Energy is cost minus fees, so a membership charge never reads as more driving.
 */
export function yearOnYear(months: MonthSummary[]): YearOnYear {
  if (months.length === 0) return EMPTY

  const byYear = new Map<string, Map<string, MonthSummary>>()
  for (const m of months) {
    const [y, mm] = [m.month.slice(0, 4), m.month.slice(5, 7)]
    if (!byYear.has(y)) byYear.set(y, new Map())
    byYear.get(y)!.set(mm, m)
  }

  const years = [...byYear.keys()].sort()
  if (years.length < 2) return EMPTY
  const curYear = years[years.length - 1]
  const prevYear = years[years.length - 2]
  const cur = byYear.get(curYear)!
  const prev = byYear.get(prevYear)!

  const pairs: YoyMonth[] = []
  for (const mm of [...cur.keys()].sort()) {
    const c = cur.get(mm)
    const p = prev.get(mm)
    if (!c || !p) continue
    pairs.push({
      mm,
      label: monthShort(mm),
      prevEnergy: p.cost - p.fees,
      curEnergy: c.cost - c.fees,
      prevFees: p.fees,
      curFees: c.fees,
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
    energyDeltaPct: prevEnergy > 0 ? ((curEnergy - prevEnergy) / prevEnergy) * 100 : null,
    feeDelta: curFees - prevFees,
  }
}
