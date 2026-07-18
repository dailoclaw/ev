// Derivations — how a displayed number was actually produced.
//
// Every figure in this app is the end of a chain of assumptions, and those
// assumptions have changed more than once. A derivation carries the arithmetic
// alongside the result so any number can show its working, down to the rows.
import type { EvData } from './useEv'
import { costAnatomy } from './costAnatomy'
import { aud, kwh, longDate, monthTitle, rate, shortDate } from './format'

export interface DerivLine {
  /** Operator shown before the label: '=', '−', '×', '÷', '+'. */
  op?: string
  label: string
  value?: string
  /** 0 = statement, 1 = working, 2 = note. */
  depth?: 0 | 1 | 2
  strong?: boolean
  tone?: 'good' | 'warn' | 'neg'
  /** Blank line above, to separate blocks. */
  gap?: boolean
}

export interface DerivRow {
  label: string
  value: string
}

export interface Derivation {
  title: string
  value: string
  lines: DerivLine[]
  /** The underlying records, revealed on demand. */
  rows?: { label: string; items: DerivRow[] }
  footnote?: string
}

/** Lifetime net benefit — the app's flagship figure, and the one that has moved most. */
export function deriveNetBenefit(ev: EvData): Derivation {
  const t = ev.lifetime
  const free = ev.providers.find(p => p.freeKwhPerDay > 0)

  // Days that actually contributed free energy, and what each contributed.
  const byDay = new Map<string, number>()
  for (const s of ev.sessions) {
    if (s.freeKwh <= 0) continue
    byDay.set(s.date, (byDay.get(s.date) ?? 0) + s.freeKwh)
  }
  const feeRows = ev.sessions.filter(s => s.isFee)
  const firstFee = feeRows.length > 0 ? feeRows.reduce((a, s) => (s.date < a ? s.date : a), feeRows[0].date) : null

  const basis = ev.rateBasis
  const lines: DerivLine[] = [
    { label: 'Free energy value', value: aud(t.saved), strong: true },
    { op: '−', label: 'Membership fees', value: aud(t.fees) },
    { op: '=', label: 'Net benefit', value: aud(t.netSaved), strong: true, tone: 'good' },

    { label: 'Free energy value', value: aud(t.saved), strong: true, gap: true },
    { op: '=', label: `${kwh(t.freeKwh)} kWh × ${rate(ev.refRate)}`, value: aud(t.saved), depth: 1 },
    {
      label: `${kwh(t.freeKwh)} kWh = sum of min(${free?.freeKwhPerDay ?? 7}, that day's ${free?.name ?? 'Jolt'} kWh)`,
      depth: 2,
    },
    { label: `across ${byDay.size} days that claimed free energy`, depth: 2 },
    basis.independent
      ? {
          label: `${rate(basis.rate)} = ${aud(basis.rate * basis.kwh)} ÷ ${kwh(basis.kwh)} kWh at ${basis.from.join(', ')}`,
          depth: 2,
        }
      : { label: `${rate(basis.rate)} = your average paid rate (no independent data yet)`, depth: 2 },
    { label: `providers with a free allowance are excluded from that rate`, depth: 2 },
  ]

  if (t.fees > 0) {
    lines.push(
      { label: 'Membership fees', value: aud(t.fees), strong: true, gap: true },
      { label: `${feeRows.length} charge${feeRows.length === 1 ? '' : 's'} with no energy attached`, depth: 1 },
    )
    if (firstFee) lines.push({ label: `first on ${longDate(firstFee)}`, depth: 2 })
  }

  const days = [...byDay.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  return {
    title: 'Lifetime net benefit',
    value: aud(t.netSaved),
    lines,
    rows: {
      label: `the ${days.length} days behind ${kwh(t.freeKwh)} kWh`,
      items: days.map(([d, k]) => ({ label: shortDate(d), value: `${k.toFixed(2)} kWh` })),
    },
    footnote: 'Free energy is valued at what you pay where there is no allowance — see Savings for the basis.',
  }
}

/** The blended $/kWh on Cost anatomy: subscription plus energy. */
export function deriveBlendedRate(ev: EvData): Derivation | null {
  const a = costAnatomy(ev.sessions, ev.refRate)
  if (!a.hasFees) return null

  const lines: DerivLine[] = [
      { label: 'Subscription', value: rate(a.feePerKwh) },
      { op: '+', label: 'Energy', value: rate(a.energyPerKwh) },
      { op: '=', label: 'Blended', value: rate(a.blendedPerKwh), strong: true },

      { label: 'Subscription', value: rate(a.feePerKwh), strong: true, gap: true },
      { op: '=', label: `${aud(a.fees)} ÷ ${kwh(a.kwh)} kWh`, value: rate(a.feePerKwh), depth: 1 },
      { label: 'fees spread across every kWh delivered since the first charge', depth: 2 },

      { label: 'Energy', value: rate(a.energyPerKwh), strong: true, gap: true },
      { op: '=', label: `${aud(a.energyCost)} ÷ ${kwh(a.kwh)} kWh`, value: rate(a.energyPerKwh), depth: 1 },
    { label: `${a.feeStart ? `measured from ${longDate(a.feeStart)}` : ''}`, depth: 2 },
  ]

  return {
    title: 'Blended rate per kWh',
    value: rate(a.blendedPerKwh),
    lines: lines.filter(l => l.label !== ''),
    footnote: 'Only the period since your first subscription charge is included — before it there was no fee to split.',
  }
}

/** A month's spend on Home: energy plus any fixed charges. */
export function deriveMonthSpend(ev: EvData, ym: string): Derivation | null {
  const m = ev.months.find(x => x.month === ym)
  if (!m) return null

  const inMonth = ev.sessionsDesc.filter(s => s.date.startsWith(ym))
  const energy = inMonth.filter(s => !s.isFee)
  const fees = inMonth.filter(s => s.isFee)
  const energyCost = m.cost - m.fees

  const lines: DerivLine[] = [
    { label: `Energy · ${energy.length} charge${energy.length === 1 ? '' : 's'}`, value: aud(energyCost) },
  ]
  if (m.fees > 0) lines.push({ op: '+', label: `Membership · ${fees.length} charge`, value: aud(m.fees) })
  lines.push({ op: '=', label: 'Spent this month', value: aud(m.cost), strong: true })

  lines.push(
    { label: 'Energy cost', value: aud(energyCost), strong: true, gap: true },
    { label: `${kwh(m.kwh)} kWh added, of which ${kwh(m.freeKwh, 1)} kWh was free`, depth: 1 },
    { label: 'free energy costs nothing, so only billed kWh appear here', depth: 2 },
  )

  return {
    title: `${monthTitle(ym)} spend`,
    value: aud(m.cost),
    lines,
    rows: {
      label: `the ${inMonth.length} charges in ${monthTitle(ym)}`,
      items: inMonth.map(s => ({
        label: `${shortDate(s.date)} · ${s.isFee ? 'membership' : `${s.amount.toFixed(1)} kWh`}`,
        value: aud(s.cost),
      })),
    },
  }
}
