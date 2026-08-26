// Records — personal bests and milestones mined from the ledger.
//
// Every trophy is a plain query over the sessions with the date it happened.
// Nothing here is stored: install the feature and history unlocks retroactively.
// Target tracks stay visible with live progress throughout their lifecycle,
// including before enough history exists and after a milestone is achieved.
import type { EvData } from './useEv'
import { aud, kwh, shortDate, thisMonth } from './format'

export interface Trophy {
  /** Icon name rendered through the shared Icon component. */
  icon: string
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

export interface RecordAchievement {
  id: string
  icon: string
  name: string
  detail: string
}

export interface Records {
  /** Current run of consecutive fully-free charges (fee rows ignored). */
  currentStreak: number
  bestStreak: number
  /** What ends the current streak, phrased for the card. */
  streakNote: string
  /** Freezes currently banked (0..freezeCap) — a held freeze absorbs the next overflow. */
  freezesHeld: number
  freezeCap: number
  /** Date of the freeze protecting the *current* run, if the streak survived one. */
  freezeSavedDate: string | null
  trophies: Trophy[]
  targets: Target[]
  /** Stable, completed milestones used by the one-time celebration queue. */
  achievements: RecordAchievement[]
}

const KWH_TIERS = [500, 1_000, 2_500, 5_000, 10_000]
const FREE_TIERS = [50, 100, 250, 500]
const SAVED_TIERS = [250, 500, 1_000, 2_500]
const CENTURY = 100 // free charges in a row
const WEEK_DAYS = 7 // allowance days claimed Mon–Sun
const SUB_RATE = 0.1 // $/kWh effective, over a completed month
const FREEZE_CAP = 1 // freezes held at once — earned again each century milestone
const FREE_KWH_TARGET = 1_000
const BUDGET_MONTH_TARGET = 3
const MAXED_DAY_TARGET = 30
const PROVIDER_TARGET = 5
const QUARTER_MONTHS = 3
const QUARTER_RATE = 0.1
const FEE_FREE_MONTH_TARGET = 12
const FREE_CHARGE_STARTER_TARGET = 5
const FREE_KWH_STARTER_TARGET = 100
const WEEKEND_DAY_TARGET = 2
const PROVIDER_STARTER_TARGET = 3

/** Largest tier crossed, or null. */
const crossed = (tiers: number[], value: number) => [...tiers].reverse().find(t => value >= t) ?? null
/** First tier not yet crossed, or null when all are. */
const next = (tiers: number[], value: number) => tiers.find(t => value < t) ?? null

const monthNumber = (ym: string) => {
  const [year, month] = ym.split('-').map(Number)
  return year * 12 + month
}

const bestMonthlyRun = <T extends { month: string }>(months: T[], qualifies: (month: T) => boolean) => {
  let best = 0
  let run = 0
  let previous: number | null = null
  for (const month of [...months].sort((a, b) => a.month.localeCompare(b.month))) {
    const current = monthNumber(month.month)
    run = qualifies(month) ? (previous != null && current === previous + 1 ? run + 1 : 1) : 0
    best = Math.max(best, run)
    previous = current
  }
  return best
}

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

  // ---- free-charge streaks, with earned freeze protection ----
  // A freeze is earned every time a run crosses a century milestone (100, 200, …),
  // capped at FREEZE_CAP held at once. The next overflow after that spends it
  // instead of breaking the streak — deterministic and fully re-derivable, so
  // nothing about this needs to be stored.
  let bestStreak = 0
  let run = 0
  let freezeBank = 0
  let runFreezeDate: string | null = null // set while the *current* run survives on a freeze
  for (const s of energy) {
    if (isFree(s)) {
      run += 1
      if (run > bestStreak) bestStreak = run
      if (run % CENTURY === 0 && freezeBank < FREEZE_CAP) freezeBank += 1
    } else if (freezeBank > 0) {
      freezeBank -= 1
      runFreezeDate = s.date // streak survives — run carries on unbroken
    } else {
      run = 0
      runFreezeDate = null
    }
  }
  const currentStreak = run
  const freezesHeld = freezeBank
  const freezeSavedDate = currentStreak > 0 ? runFreezeDate : null

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
          name: 'Biggest sip',
          detail: `${biggest.amount.toFixed(1)} kWh · ${shortDate(biggest.date)}`,
          unlocked: true,
        }
      : { icon: 'rbattery', name: 'Biggest sip', detail: 'no charges yet', unlocked: false },
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
      ? { icon: 'rcalcheck', name: '$0 month', detail: zeroMonth.label, unlocked: true }
      : { icon: 'rcalcheck', name: '$0 month', detail: 'not yet', unlocked: false },
  ]

  const targets: Target[] = []
  if (bestStreak >= CENTURY) {
    trophies.push({ icon: 'rstreak', name: 'Century streak', detail: `${bestStreak} free in a row`, unlocked: true })
  }

  targets.push({
    icon: 'rstreak',
    name: 'Century streak',
    detail:
      bestStreak >= CENTURY
        ? `achieved · best ${bestStreak} free in a row`
        : `best ${bestStreak} of ${CENTURY} free in a row`,
    progress: Math.min(1, bestStreak / CENTURY),
  })

  // Keep the calendar target visible throughout its lifecycle. Perfect week
  // graduates to Perfect month, whose progress is derived from completed months.
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

  if (bestWeek >= WEEK_DAYS) {
    trophies.push({ icon: 'rweek', name: 'Perfect week', detail: 'all 7 allowance days claimed', unlocked: true })
    if (bestFrac >= 1) {
      trophies.push({ icon: 'rweek', name: 'Perfect month', detail: 'every day claimed', unlocked: true })
    }

    targets.push({
      icon: 'rweek',
      name: 'Perfect month',
      detail:
        bestOf === 0
          ? 'needs a completed month'
          : bestFrac >= 1
            ? `achieved · all ${bestOf} allowance days claimed`
            : `best ${bestDays} of ${bestOf} allowance days`,
      progress: bestFrac,
    })
  } else {
    targets.push({
      icon: 'rweek',
      name: 'Perfect week',
      detail: `best ${bestWeek} of ${WEEK_DAYS} allowance days`,
      progress: bestWeek / WEEK_DAYS,
    })
  }
  if (bestRate != null && bestRateMonth != null && bestRate < SUB_RATE) {
    trophies.push({
      icon: 'rgauge',
      name: 'Sub-10¢ month',
      detail: `$${bestRate.toFixed(3)}/kWh · ${bestRateMonth.label}`,
      unlocked: true,
    })
  }

  targets.push({
    icon: 'rgauge',
    name: 'Sub-10¢ month',
    detail:
      bestRate == null || bestRateMonth == null
        ? 'needs a completed paid month'
        : bestRate < SUB_RATE
          ? `achieved · $${bestRate.toFixed(3)}/kWh · ${bestRateMonth.label}`
          : `best $${bestRate.toFixed(3)}/kWh · ${bestRateMonth.label}`,
    progress: bestRate == null ? 0 : Math.min(1, SUB_RATE / bestRate),
  })

  // Keep the savings ladder present after its final tier has been reached.
  const savedTarget = savedNext ?? SAVED_TIERS[SAVED_TIERS.length - 1]
  targets.push({
    icon: 'rdollar',
    name: `${aud(savedTarget, 0)} net saved`,
    detail:
      savedNext == null
        ? `achieved · ${aud(Math.max(0, ev.lifetime.netSaved), 0)} saved`
        : `${aud(Math.max(0, ev.lifetime.netSaved), 0)} of ${aud(savedTarget, 0)}`,
    progress: Math.min(1, Math.max(0, ev.lifetime.netSaved) / savedTarget),
  })

  const freeKwhProgress = Math.max(0, ev.lifetime.freeKwh)
  targets.push({
    icon: 'bolt',
    name: `${kwh(FREE_KWH_TARGET)} free kWh`,
    detail:
      freeKwhProgress >= FREE_KWH_TARGET
        ? `achieved · ${kwh(freeKwhProgress)} kWh captured`
        : `${kwh(freeKwhProgress)} of ${kwh(FREE_KWH_TARGET)} kWh`,
    progress: Math.min(1, freeKwhProgress / FREE_KWH_TARGET),
  })

  const budgetRun = bestMonthlyRun(done, month => month.cost <= ev.budgetCap)
  targets.push({
    icon: 'rcalcheck',
    name: 'Budget hat-trick',
    detail:
      budgetRun >= BUDGET_MONTH_TARGET
        ? `achieved · best ${budgetRun} months in a row`
        : `best ${budgetRun} of ${BUDGET_MONTH_TARGET} months within ${aud(ev.budgetCap, 0)}`,
    progress: Math.min(1, budgetRun / BUDGET_MONTH_TARGET),
  })

  const maxedDays = Math.max(0, ev.lifetime.daysMaxed)
  targets.push({
    icon: 'rtarget',
    name: 'Allowance maximiser',
    detail:
      maxedDays >= MAXED_DAY_TARGET
        ? `achieved · ${maxedDays} allowance days maxed`
        : `${maxedDays} of ${MAXED_DAY_TARGET} allowance days maxed`,
    progress: Math.min(1, maxedDays / MAXED_DAY_TARGET),
  })

  const providersUsed = new Set(energy.filter(session => session.amount > 0).map(session => session.type)).size
  targets.push({
    icon: 'rtrend',
    name: 'Network explorer',
    detail:
      providersUsed >= PROVIDER_TARGET
        ? `achieved · ${providersUsed} networks used`
        : `${providersUsed} of ${PROVIDER_TARGET} networks used`,
    progress: Math.min(1, providersUsed / PROVIDER_TARGET),
  })

  const completedRun = bestMonthlyRun(done, () => true)
  const orderedDone = [...done].sort((a, b) => a.month.localeCompare(b.month))
  let bestQuarterRate: number | null = null
  for (let i = 0; i <= orderedDone.length - QUARTER_MONTHS; i += 1) {
    const quarter = orderedDone.slice(i, i + QUARTER_MONTHS)
    const consecutive = quarter.every(
      (month, index) => index === 0 || monthNumber(month.month) === monthNumber(quarter[index - 1].month) + 1,
    )
    if (!consecutive) continue
    const totalKwh = quarter.reduce((sum, month) => sum + month.kwh, 0)
    if (totalKwh <= 0) continue
    const quarterRate = quarter.reduce((sum, month) => sum + month.cost, 0) / totalKwh
    bestQuarterRate = bestQuarterRate == null ? quarterRate : Math.min(bestQuarterRate, quarterRate)
  }
  targets.push({
    icon: 'rgauge',
    name: 'Low-cost quarter',
    detail:
      bestQuarterRate == null
        ? `best ${Math.min(completedRun, QUARTER_MONTHS)} of ${QUARTER_MONTHS} consecutive completed months`
        : bestQuarterRate < QUARTER_RATE
          ? `achieved · best $${bestQuarterRate.toFixed(3)}/kWh`
          : `best $${bestQuarterRate.toFixed(3)}/kWh · target below $${QUARTER_RATE.toFixed(2)}`,
    progress:
      bestQuarterRate == null
        ? Math.min(1, completedRun / QUARTER_MONTHS)
        : Math.min(1, QUARTER_RATE / bestQuarterRate),
  })

  const feeFreeRun = bestMonthlyRun(done, month => month.fees === 0)
  targets.push({
    icon: 'rdollar',
    name: 'Fee-free year',
    detail:
      feeFreeRun >= FEE_FREE_MONTH_TARGET
        ? `achieved · best ${feeFreeRun} months without fees`
        : `best ${feeFreeRun} of ${FEE_FREE_MONTH_TARGET} months without fees`,
    progress: Math.min(1, feeFreeRun / FEE_FREE_MONTH_TARGET),
  })

  targets.push({
    icon: 'rstreak',
    name: 'Free five',
    detail:
      freeCharges.length >= FREE_CHARGE_STARTER_TARGET
        ? `achieved · ${freeCharges.length} fully free charges`
        : `${freeCharges.length} of ${FREE_CHARGE_STARTER_TARGET} fully free charges`,
    progress: Math.min(1, freeCharges.length / FREE_CHARGE_STARTER_TARGET),
  })

  targets.push({
    icon: 'bolt',
    name: `${kwh(FREE_KWH_STARTER_TARGET)} free kWh`,
    detail:
      freeKwhProgress >= FREE_KWH_STARTER_TARGET
        ? `achieved · ${kwh(freeKwhProgress)} kWh captured`
        : `${kwh(freeKwhProgress)} of ${kwh(FREE_KWH_STARTER_TARGET)} kWh`,
    progress: Math.min(1, freeKwhProgress / FREE_KWH_STARTER_TARGET),
  })

  const cheapestCompletedCost = done.length > 0 ? Math.min(...done.map(month => month.cost)) : null
  const budgetDebutHeld = cheapestCompletedCost != null && cheapestCompletedCost <= ev.budgetCap
  targets.push({
    icon: 'rcalcheck',
    name: 'Budget debut',
    detail:
      cheapestCompletedCost == null
        ? 'needs a completed month'
        : budgetDebutHeld
          ? `achieved · best month ${aud(cheapestCompletedCost)}`
          : `best month ${aud(cheapestCompletedCost)} · target ${aud(ev.budgetCap, 0)}`,
    progress:
      cheapestCompletedCost == null
        ? 0
        : cheapestCompletedCost <= 0
          ? 1
          : Math.min(1, ev.budgetCap / cheapestCompletedCost),
  })

  let bestWeekend = 0
  for (const days of byWeek.values()) {
    const weekendDays = new Set(
      [...days].filter(date => {
        const day = new Date(`${date}T00:00:00`).getDay()
        return day === 0 || day === 6
      }),
    ).size
    bestWeekend = Math.max(bestWeekend, weekendDays)
  }
  targets.push({
    icon: 'rweek',
    name: 'Weekend allowance',
    detail:
      bestWeekend >= WEEKEND_DAY_TARGET
        ? 'achieved · Saturday and Sunday claimed'
        : `${bestWeekend} of ${WEEKEND_DAY_TARGET} weekend days claimed`,
    progress: Math.min(1, bestWeekend / WEEKEND_DAY_TARGET),
  })

  targets.push({
    icon: 'rtrend',
    name: 'Network sampler',
    detail:
      providersUsed >= PROVIDER_STARTER_TARGET
        ? `achieved · ${providersUsed} networks used`
        : `${providersUsed} of ${PROVIDER_STARTER_TARGET} networks used`,
    progress: Math.min(1, providersUsed / PROVIDER_STARTER_TARGET),
  })

  const achievements: RecordAchievement[] = []
  const achieved = (id: string, icon: string, name: string, detail: string) => {
    achievements.push({ id, icon, name, detail })
  }

  if (bestStreak >= CENTURY) {
    achieved('century-streak', 'rstreak', 'Century streak', `${bestStreak} fully free charges in a row`)
  }
  if (bestWeek >= WEEK_DAYS) {
    achieved('perfect-week', 'rweek', 'Perfect week', 'All seven allowance days claimed')
  }
  if (bestFrac >= 1) {
    achieved('perfect-month', 'rweek', 'Perfect month', 'Every allowance day claimed in a completed month')
  }
  if (bestRate != null && bestRateMonth != null && bestRate < SUB_RATE) {
    achieved('sub-10-month', 'rgauge', 'Sub-10¢ month', `$${bestRate.toFixed(3)}/kWh · ${bestRateMonth.label}`)
  }
  for (const tier of SAVED_TIERS) {
    if (ev.lifetime.netSaved >= tier) {
      achieved(`net-saved-${tier}`, 'rdollar', `${aud(tier, 0)} net saved`, `${aud(ev.lifetime.netSaved, 0)} saved after fees`)
    }
  }
  if (freeKwhProgress >= FREE_KWH_TARGET) {
    achieved('free-kwh-1000', 'bolt', '1,000 free kWh', `${kwh(freeKwhProgress)} kWh captured for free`)
  }
  if (budgetRun >= BUDGET_MONTH_TARGET) {
    achieved('budget-hat-trick', 'rcalcheck', 'Budget hat-trick', `${budgetRun} consecutive months within budget`)
  }
  if (maxedDays >= MAXED_DAY_TARGET) {
    achieved('allowance-maximiser', 'rtarget', 'Allowance maximiser', `${maxedDays} daily allowances fully claimed`)
  }
  if (providersUsed >= PROVIDER_TARGET) {
    achieved('network-explorer', 'rtrend', 'Network explorer', `${providersUsed} charging networks used`)
  }
  if (bestQuarterRate != null && bestQuarterRate < QUARTER_RATE) {
    achieved('low-cost-quarter', 'rgauge', 'Low-cost quarter', `$${bestQuarterRate.toFixed(3)}/kWh across three months`)
  }
  if (feeFreeRun >= FEE_FREE_MONTH_TARGET) {
    achieved('fee-free-year', 'rdollar', 'Fee-free year', `${feeFreeRun} consecutive months without charging fees`)
  }
  if (freeCharges.length >= FREE_CHARGE_STARTER_TARGET) {
    achieved('free-five', 'rstreak', 'Free five', `${freeCharges.length} fully free charges completed`)
  }
  if (freeKwhProgress >= FREE_KWH_STARTER_TARGET) {
    achieved('free-kwh-100', 'bolt', '100 free kWh', `${kwh(freeKwhProgress)} kWh captured for free`)
  }
  if (budgetDebutHeld) {
    achieved('budget-debut', 'rcalcheck', 'Budget debut', `Best completed month: ${aud(cheapestCompletedCost ?? 0)}`)
  }
  if (bestWeekend >= WEEKEND_DAY_TARGET) {
    achieved('weekend-allowance', 'rweek', 'Weekend allowance', 'Free energy claimed on Saturday and Sunday')
  }
  if (providersUsed >= PROVIDER_STARTER_TARGET) {
    achieved('network-sampler', 'rtrend', 'Network sampler', `${providersUsed} charging networks used`)
  }

  const free = ev.providers.find(p => p.freeKwhPerDay > 0)
  const hasFreeze = freezesHeld > 0
  const streakNote =
    currentStreak > 0
      ? currentStreak >= bestStreak
        ? hasFreeze
          ? 'personal best — a freeze in reserve would absorb the next overflow'
          : 'personal best — a paid charge ends it'
        : hasFreeze
          ? `best ${bestStreak} · a freeze in reserve would absorb the next overflow`
          : `best ${bestStreak} · survives while charges stay inside the ${free?.freeKwhPerDay ?? 7} kWh allowance`
      : bestStreak > 0
        ? `best ${bestStreak} — a $0.00 charge starts a new one`
        : 'a $0.00 charge starts one'

  return {
    currentStreak,
    bestStreak,
    streakNote,
    freezesHeld,
    freezeCap: FREEZE_CAP,
    freezeSavedDate,
    trophies,
    targets,
    achievements,
  }
}
