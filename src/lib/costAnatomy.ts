// Cost anatomy — separate the fixed subscription from the variable energy.
//
// A membership fee and a per-kWh charge are different animals. Blending them into
// one "effective rate" hides the single biggest lever on the bill, so everything
// here is scoped to the period since the first fee was charged and split in two:
//   fee $/kWh      — what the subscription costs per unit delivered
//   energy $/kWh   — what the electricity itself costs per unit delivered
// The two sum to the blended rate the rest of the app shows.
import type { EnrichedSession } from './savings'

export interface AnatomyMonth {
  month: string // yyyy-mm
  label: string // "Jun 2026"
  fee: number
  energyCost: number
  kwh: number
  freeKwh: number
  freeValue: number // freeKwh valued at the reference rate
  net: number // freeValue - fee: did the subscription earn its keep?
}

export interface CostAnatomy {
  hasFees: boolean
  feeStart: string | null // yyyy-mm-dd of the first fee row

  // totals since feeStart
  fees: number
  energyCost: number
  totalCost: number
  kwh: number

  // the split
  feePerKwh: number
  energyPerKwh: number
  blendedPerKwh: number
  feeSharePct: number // fee's share of the blended rate

  // break-even on the subscription
  monthlyFee: number // typical fee charged per month
  breakEvenKwh: number // free kWh/month needed just to cover the fee
  avgFreeKwhPerMonth: number
  avgFreeValuePerMonth: number
  netPerMonth: number

  months: AnatomyMonth[]
}

const monthLabel = (ym: string) => {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })
}

/** Median, so a one-off double-charge doesn't distort the "typical" monthly fee. */
const median = (xs: number[]) => {
  if (xs.length === 0) return 0
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

const EMPTY: CostAnatomy = {
  hasFees: false,
  feeStart: null,
  fees: 0,
  energyCost: 0,
  totalCost: 0,
  kwh: 0,
  feePerKwh: 0,
  energyPerKwh: 0,
  blendedPerKwh: 0,
  feeSharePct: 0,
  monthlyFee: 0,
  breakEvenKwh: 0,
  avgFreeKwhPerMonth: 0,
  avgFreeValuePerMonth: 0,
  netPerMonth: 0,
  months: [],
}

/**
 * Build the anatomy from enriched sessions.
 * Only the period from the first fee onward is analysed — before that there was
 * no subscription, so a fixed/variable split would be meaningless.
 */
export function costAnatomy(
  sessions: EnrichedSession[],
  refRate: number,
  /** Month (yyyy-mm) still in progress — excluded from averages so a part-month
   *  doesn't drag the break-even figures down. Its totals still show in the table. */
  partialMonth?: string,
): CostAnatomy {
  const feeRows = sessions.filter(s => s.isFee)
  if (feeRows.length === 0) return EMPTY

  const feeStart = feeRows.reduce((min, s) => (s.date < min ? s.date : min), feeRows[0].date)
  const inScope = sessions.filter(s => s.date >= feeStart)

  const byMonth = new Map<string, AnatomyMonth>()
  let fees = 0
  let energyCost = 0
  let kwh = 0

  for (const s of inScope) {
    const ym = s.date.slice(0, 7)
    let m = byMonth.get(ym)
    if (!m) {
      m = { month: ym, label: monthLabel(ym), fee: 0, energyCost: 0, kwh: 0, freeKwh: 0, freeValue: 0, net: 0 }
      byMonth.set(ym, m)
    }
    if (s.isFee) {
      fees += s.cost
      m.fee += s.cost
    } else {
      energyCost += s.cost
      kwh += s.amount
      m.energyCost += s.cost
      m.kwh += s.amount
      m.freeKwh += s.freeKwh
    }
  }

  const months = [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month))
  for (const m of months) {
    m.freeValue = m.freeKwh * refRate
    m.net = m.freeValue - m.fee
  }

  const totalCost = fees + energyCost
  const feePerKwh = kwh > 0 ? fees / kwh : 0
  const energyPerKwh = kwh > 0 ? energyCost / kwh : 0
  const blendedPerKwh = feePerKwh + energyPerKwh

  // Only months that actually carried a fee tell us the recurring charge, and only
  // complete ones are fair to average — a part-month understates free energy claimed.
  const complete = months.filter(m => m.month !== partialMonth)
  const charged = (complete.length > 0 ? complete : months).filter(m => m.fee > 0)
  const monthlyFee = median(charged.map(m => m.fee))
  const avgFreeKwhPerMonth = charged.length > 0 ? charged.reduce((a, m) => a + m.freeKwh, 0) / charged.length : 0
  const avgFreeValuePerMonth = avgFreeKwhPerMonth * refRate

  return {
    hasFees: true,
    feeStart,
    fees,
    energyCost,
    totalCost,
    kwh,
    feePerKwh,
    energyPerKwh,
    blendedPerKwh,
    feeSharePct: blendedPerKwh > 0 ? (feePerKwh / blendedPerKwh) * 100 : 0,
    monthlyFee,
    breakEvenKwh: refRate > 0 ? monthlyFee / refRate : 0,
    avgFreeKwhPerMonth,
    avgFreeValuePerMonth,
    netPerMonth: avgFreeValuePerMonth - monthlyFee,
    months,
  }
}
