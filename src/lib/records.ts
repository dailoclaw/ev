// Records — personal bests and milestones mined from the ledger.
//
// Every trophy is a plain query over the sessions with the date it happened.
// Nothing here is stored: install the feature and history unlocks retroactively.
import type { EvData } from './useEv'
import { aud, kwh, shortDate, thisMonth } from './format'

export interface Trophy {
  icon: string
  name: string
  detail: string
  unlocked: boolean
}

export interface Records {
  /** Current run of consecutive fully-free charges (fee rows ignored). */
  currentStreak: number
  bestStreak: number
  /** What ends the current streak, phrased for the card. */
  streakNote: string
  trophies: Trophy[]
}

const KWH_TIERS = [500, 1_000, 2_500, 5_000, 10_000]
const FREE_TIERS = [50, 100, 250, 500]
const SAVED_TIERS = [250, 500, 1_000, 2_500]

/** Largest tier crossed, or null. */
const crossed = (tiers: number[], value: number) => [...tiers].reverse().find(t => value >= t) ?? null
/** First tier not yet crossed, or null when all are. */
const next = (tiers: number[], value: number) => tiers.find(t => value < t) ?? null

export function records(ev: EvData): Records {
  const energy = ev.sessions.filter(s => !s.isFee) // chronological
  const isFree = (s: (typeof energy)[number]) => s.cost === 0 && s.amount > 0

  // ---- free-charge streaks ----
  let currentStreak = 0
  let bestStreak = 0
  let run = 0
  for (const s of energy) {
    run = isFree(s) ? run + 1 : 0
    if (run > bestStreak) bestStreak = run
  }
  currentStreak = run

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

  const trophies: Trophy[] = [
    kwhTier != null
      ? {
          icon: '🏆',
          name: `${kwh(kwhTier)} kWh Club`,
          detail: kwhDate ? `crossed ${shortDate(kwhDate)}` : 'crossed',
          unlocked: true,
        }
      : {
          icon: '🏆',
          name: `${kwh(KWH_TIERS[0])} kWh Club`,
          detail: `${kwh(ev.lifetime.kwh)} / ${kwh(KWH_TIERS[0])} kWh`,
          unlocked: false,
        },
    cheapest
      ? { icon: '🧊', name: 'Cheapest month', detail: `${cheapest.label} · ${aud(cheapest.cost)}`, unlocked: true }
      : { icon: '🧊', name: 'Cheapest month', detail: 'needs a completed month', unlocked: false },
    freeTier != null
      ? {
          icon: '🎯',
          name: `${freeTier}th free charge`,
          detail: freeDate ? shortDate(freeDate) : '',
          unlocked: true,
        }
      : {
          icon: '🎯',
          name: `${FREE_TIERS[0]}th free charge`,
          detail: `${freeCharges.length} / ${FREE_TIERS[0]} so far`,
          unlocked: false,
        },
    biggest
      ? {
          icon: '⚡',
          name: 'Biggest sip',
          detail: `${biggest.amount.toFixed(1)} kWh · ${shortDate(biggest.date)}`,
          unlocked: true,
        }
      : { icon: '⚡', name: 'Biggest sip', detail: 'no charges yet', unlocked: false },
    savedTier != null
      ? {
          icon: '💰',
          name: `${aud(savedTier, 0)} net saved`,
          detail: savedNext ? `${aud(ev.lifetime.netSaved, 0)} · next ${aud(savedNext, 0)}` : aud(ev.lifetime.netSaved, 0),
          unlocked: true,
        }
      : {
          icon: '💰',
          name: `${aud(SAVED_TIERS[0], 0)} net saved`,
          detail: `${aud(Math.max(0, ev.lifetime.netSaved), 0)} / ${aud(SAVED_TIERS[0], 0)}`,
          unlocked: false,
        },
    zeroMonth
      ? { icon: '🗓️', name: '$0 month', detail: zeroMonth.label, unlocked: true }
      : { icon: '🗓️', name: '$0 month', detail: 'not yet', unlocked: false },
  ]

  const free = ev.providers.find(p => p.freeKwhPerDay > 0)
  const streakNote =
    currentStreak > 0
      ? currentStreak >= bestStreak
        ? 'personal best — a paid charge ends it'
        : `best ${bestStreak} · survives while charges stay inside the ${free?.freeKwhPerDay ?? 7} kWh allowance`
      : bestStreak > 0
        ? `best ${bestStreak} — a $0.00 charge starts a new one`
        : 'a $0.00 charge starts one'

  return { currentStreak, bestStreak, streakNote, trophies }
}
