// Records — personal bests and milestones mined from the ledger.
//
// Every trophy is a plain query over the sessions with the date it happened.
// Nothing here is stored: install the feature and history unlocks retroactively.
// Targets are open records with live progress — a locked tile is something
// underway, not something dead.
import type { EvData } from './useEv'
import { aud, kwh, shortDate, thisMonth } from './format'

export interface Trophy {
  /** Icon name rendered through the shared Icon component. */
  icon: string
  /** Machine-flavoured records render in steel; money ones in green. */
  steel?: boolean
  name: string
  detail: string
  unlocked: boolean
}

export interface Target {
  icon: string
  name: string
  detail: string
  /** 0..1 toward the record. */
  progress: number
}

export interface Records {
  /** Current run of consecutive fully-free charges (fee rows ignored). */
  currentStreak: number
  bestStreak: number
  /** What ends the current streak, phrased for the card. */
  streakNote: string
  trophies: Trophy[]
  targets: Target[]
}

const KWH_TIERS = [500, 1_000, 2_500, 5_000, 10_000]
const FREE_TIERS = [50, 100, 250, 500]
const SAVED_TIERS = [250, 500, 1_000, 2_500]
const CENTURY = 100 // free charges in a row
const WEEK_DAYS = 7 // allowance days claimed Mon–Sun
const SUB_RATE = 0.1 // $/kWh effective, over a completed month

/** Largest tier crossed, or null. */
const crossed = (tiers: number[], value: number) => [...tiers].reverse().find(t => value >= t) ?? null
/** First tier not yet crossed, or null when all are. */
const next = (tiers: number[], value: number) => tiers.find(t => value < t) ?? null

/** ISO date of the Monday starting the week that holds `iso`. */
const mondayOf = (iso: string) => {
  const d = new Date(iso + 'T00:00:00')
  const shift = (d.getDay() + 6) % 7 // Mon = 0
  d.setDate(d.getDate() - shift)
  return d.toISOString().slice(0, 10)
}

export function records(ev: EvData): Records {
  const energy = ev.sessions.filter(s => !s.isFee) // chronological
  const isFree = (s: (typeof energy)[number]) => s.cost === 0 && s.amount > 0

  // ---- free-charge streaks ----
  let bestStreak = 0
  let run = 0
  for (const s of energy) {
    run = isFree(s) ? run + 1 : 0
    if (run > bestStreak) bestStreak = run
  }
  const currentStreak = run

  // ---- lifetime kWh milestone, with the date it was crossed ----
  const kwhTier = crossed(KWH_TIERS, ev.lifetime.kwh)
  let kwhDate: string | null = null
  if (kwhTier != null) {
    let cum = 0
    for (const s of energy) {
      cum += s.amount
      if (cum >= kwhTier) {
        kwhDate = s.date
        break
      }
    }
  }

  // ---- Nth free charge ----
  const freeCharges = energy.filter(isFree)
  const freeTier = crossed(FREE_TIERS, freeCharges.length)
  const freeDate = freeTier != null ? freeCharges[freeTier - 1].date : null

  // ---- cheapest completed month (current month is still in motion) ----
  const done = ev.months.filter(m => m.month !== thisMonth() && m.sessions > 0)
  const cheapest = done.length > 0 ? done.reduce((a, m) => (m.cost < a.cost ? m : a)) : null

  // ---- biggest single charge ----
  const biggest = energy.length > 0 ? energy.reduce((a, s) => (s.amount > a.amount ? s : a)) : null

  // ---- net saved milestone ----
  const savedTier = crossed(SAVED_TIERS, ev.lifetime.netSaved)
  const savedNext = next(SAVED_TIERS, ev.lifetime.netSaved)

  // ---- a whole month costing nothing ----
  const zeroMonth = done.find(m => m.cost === 0) ?? null

  // ---- open targets ----
  // Perfect week: distinct allowance-claiming days within one Mon–Sun week.
  const byWeek = new Map<string, Set<string>>()
  for (const s of ev.sessions) {
    if (s.freeKwh <= 0) continue
    const wk = mondayOf(s.date)
    const days = byWeek.get(wk) ?? new Set<string>()
    days.add(s.date)
    byWeek.set(wk, days)
  }
  const bestWeek = Math.max(0, ...[...byWeek.values()].map(d => d.size))

  // Sub-10¢ month: lowest all-in effective rate over a completed month you
  // actually paid in — a $0.00 month is already its own record, not this one.
  const rated = done.filter(m => m.kwh > 0 && m.cost > 0)
  const bestRateMonth = rated.length > 0 ? rated.reduce((a, m) => (m.cost / m.kwh < a.cost / a.kwh ? m : a)) : null
  const bestRate = bestRateMonth ? bestRateMonth.cost / bestRateMonth.kwh : null

  const trophies: Trophy[] = [
    kwhTier != null
      ? {
          icon: 'bolt',
          name: `${kwh(kwhTier)} kWh Club`,
          detail: kwhDate ? `crossed ${shortDate(kwhDate)}` : 'crossed',
          unlocked: true,
        }
      : {
          icon: 'bolt',
          name: `${kwh(KWH_TIERS[0])} kWh Club`,
          detail: `${kwh(ev.lifetime.kwh)} / ${kwh(KWH_TIERS[0])} kWh`,
          unlocked: false,
        },
    cheapest
      ? { icon: 'rtrend', name: 'Cheapest month', detail: `${cheapest.label} · ${aud(cheapest.cost)}`, unlocked: true }
      : { icon: 'rtrend', name: 'Cheapest month', detail: 'needs a completed month', unlocked: false },
    freeTier != null
      ? {
          icon: 'rtarget',
          name: `${freeTier}th free charge`,
          detail: freeDate ? shortDate(freeDate) : '',
          unlocked: true,
        }
      : {
          icon: 'rtarget',
          name: `${FREE_TIERS[0]}th free charge`,
          detail: `${freeCharges.length} / ${FREE_TIERS[0]} so far`,
          unlocked: false,
        },
    biggest
      ? {
          icon: 'rbattery',
          steel: true,
          name: 'Biggest sip',
          detail: `${biggest.amount.toFixed(1)} kWh · ${shortDate(biggest.date)}`,
          unlocked: true,
        }
      : { icon: 'rbattery', steel: true, name: 'Biggest sip', detail: 'no charges yet', unlocked: false },
    savedTier != null
      ? {
          icon: 'rdollar',
          name: `${aud(savedTier, 0)} net saved`,
          detail: savedNext ? `${aud(ev.lifetime.netSaved, 0)} · next ${aud(savedNext, 0)}` : aud(ev.lifetime.netSaved, 0),
          unlocked: true,
        }
      : {
          icon: 'rdollar',
          name: `${aud(SAVED_TIERS[0], 0)} net saved`,
          detail: `${aud(Math.max(0, ev.lifetime.netSaved), 0)} / ${aud(SAVED_TIERS[0], 0)}`,
          unlocked: false,
        },
    zeroMonth
      ? { icon: 'rcalcheck', steel: true, name: '$0 month', detail: zeroMonth.label, unlocked: true }
      : { icon: 'rcalcheck', steel: true, name: '$0 month', detail: 'not yet', unlocked: false },
  ]

  const targets: Target[] = []
  if (bestStreak >= CENTURY) {
    trophies.push({ icon: 'rstreak', name: 'Century streak', detail: `${bestStreak} free in a row`, unlocked: true })
  } else {
    targets.push({
      icon: 'rstreak',
      name: 'Century streak',
      detail: `best ${bestStreak} of ${CENTURY} free in a row`,
      progress: bestStreak / CENTURY,
    })
  }
  if (bestWeek >= WEEK_DAYS) {
    trophies.push({ icon: 'rweek', name: 'Perfect week', detail: 'all 7 allowance days claimed', unlocked: true })
    // Held — the target escalates: a whole calendar month of claimed days.
    const byMonth = new Map<string, Set<string>>()
    for (const s of ev.sessions) {
      if (s.freeKwh <= 0) continue
      const ym = s.date.slice(0, 7)
      const days = byMonth.get(ym) ?? new Set<string>()
      days.add(s.date)
      byMonth.set(ym, days)
    }
    let bestFrac = 0
    let bestDays = 0
    let bestOf = 0
    for (const m of done) {
      const [y, mm] = m.month.split('-').map(Number)
      const dim = new Date(y, mm, 0).getDate()
      const claimed = byMonth.get(m.month)?.size ?? 0
      if (claimed / dim > bestFrac) {
        bestFrac = claimed / dim
        bestDays = claimed
        bestOf = dim
      }
    }
    if (bestFrac >= 1) {
      trophies.push({ icon: 'rweek', name: 'Perfect month', detail: 'every day claimed', unlocked: true })
    } else {
      targets.push({
        icon: 'rweek',
        name: 'Perfect month',
        detail: `best ${bestDays} of ${bestOf} allowance days`,
        progress: bestFrac,
      })
    }
  } else {
    targets.push({
      icon: 'rweek',
      name: 'Perfect week',
      detail: `best ${bestWeek} of ${WEEK_DAYS} allowance days`,
      progress: bestWeek / WEEK_DAYS,
    })
  }
  if (bestRate != null && bestRateMonth != null) {
    if (bestRate < SUB_RATE) {
      trophies.push({
        icon: 'rgauge',
        name: 'Sub-10¢ month',
        detail: `$${bestRate.toFixed(3)}/kWh · ${bestRateMonth.label}`,
        unlocked: true,
      })
    } else {
      targets.push({
        icon: 'rgauge',
        name: 'Sub-10¢ month',
        detail: `best $${bestRate.toFixed(3)}/kWh · ${bestRateMonth.label}`,
        progress: Math.min(1, SUB_RATE / bestRate),
      })
    }
  }

  // The next net-saved tier is always chaseable — surface it as a live target.
  if (savedNext != null) {
    targets.push({
      icon: 'rdollar',
      name: `${aud(savedNext, 0)} net saved`,
      detail: `${aud(Math.max(0, ev.lifetime.netSaved), 0)} of ${aud(savedNext, 0)}`,
      progress: Math.max(0, ev.lifetime.netSaved) / savedNext,
    })
  }

  const free = ev.providers.find(p => p.freeKwhPerDay > 0)
  const streakNote =
    currentStreak > 0
      ? currentStreak >= bestStreak
        ? 'personal best — a paid charge ends it'
        : `best ${bestStreak} · survives while charges stay inside the ${free?.freeKwhPerDay ?? 7} kWh allowance`
      : bestStreak > 0
        ? `best ${bestStreak} — a $0.00 charge starts a new one`
        : 'a $0.00 charge starts one'

  return { currentStreak, bestStreak, streakNote, trophies, targets }
}
