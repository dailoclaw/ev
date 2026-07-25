import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEv } from '../lib/useEv'
import { aud, kwh } from '../lib/format'
import { useUnitRoll } from '../lib/useUnitRoll'
import { Icon } from '../components/ui'

const shortProv = (name: string) => (name === 'Supercharger' ? 'SC' : name)
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// One monthly chart per calendar year (newest first), with a $ / kWh metric
// toggle and charger-type filter. Each chart runs Jan -> Dec (current year
// stops at the latest month with data).
export default function AnalyticsChart() {
  const ev = useEv()
  const navigate = useNavigate()
  const [metric, setMetric] = useState<'cost' | 'kwh'>('cost')
  const [prov, setProv] = useState('All')
  const [sel, setSel] = useState<string | null>(null)
  const rolling = useUnitRoll(metric)
  const provNames = ['All', ...ev.byProvider.map(p => p.name)]
  const provColor = (name: string) => ev.providers.find(p => p.name === name)?.color ?? 'var(--steel)'

  // provider-filtered monthly cost + kWh
  const byM = new Map<string, { cost: number; kwh: number }>()
  for (const s of ev.sessions) {
    if (prov !== 'All' && s.type !== prov) continue
    const ym = s.date.slice(0, 7)
    const o = byM.get(ym) ?? { cost: 0, kwh: 0 }
    o.cost += s.cost
    o.kwh += s.amount
    byM.set(ym, o)
  }

  const years = [...new Set(ev.months.map(m => m.month.slice(0, 4)))].sort((a, b) => b.localeCompare(a))
  const latestYm = ev.months[ev.months.length - 1]?.month ?? ''
  const [latestYear, latestMonth] = latestYm ? latestYm.split('-').map(Number) : [0, 0]

  const yearRows = (year: string) => {
    const end = Number(year) === latestYear ? latestMonth : 12
    return Array.from({ length: end }, (_, i) => {
      const ym = `${year}-${String(i + 1).padStart(2, '0')}`
      const o = byM.get(ym) ?? { cost: 0, kwh: 0 }
      return { ym, label: MONTHS[i], cost: o.cost, kwh: o.kwh, value: metric === 'cost' ? o.cost : o.kwh }
    })
  }

  return (
    <main className="app-shell">
      <header className="appbar">
        <div>
          <p className="eyebrow">Analytics · detail</p>
          <h1>Monthly charts</h1>
          <span className="sub">By calendar year{prov !== 'All' ? ` · ${prov}` : ''}</span>
        </div>
        <button className="icon-btn" type="button" aria-label="Back" onClick={() => navigate(-1)}>
          <Icon name="back" />
        </button>
      </header>

      <div className="seg" aria-label="Metric">
        <button type="button" className={metric === 'cost' ? 'on' : ''} onClick={() => setMetric('cost')}>
          Cost $
        </button>
        <button type="button" className={metric === 'kwh' ? 'on' : ''} onClick={() => setMetric('kwh')}>
          Energy kWh
        </button>
      </div>

      <div className="chiprow">
        {provNames.map(name => (
          <button
            key={name}
            type="button"
            className={`chip ${prov === name ? 'on' : ''}`}
            style={{ ['--pc' as string]: name === 'All' ? 'var(--money)' : provColor(name) }}
            onClick={() => setProv(name)}
          >
            <span className="dt" />
            {shortProv(name)}
          </button>
        ))}
      </div>

      {years.map(year => {
        const rows = yearRows(year)
        const max = Math.max(...rows.map(r => r.value), 0.01)
        const total = rows.reduce((s, r) => s + (metric === 'cost' ? r.cost : r.kwh), 0)
        const inProgress = Number(year) === latestYear
        const barLabel = (r: (typeof rows)[number], m: 'cost' | 'kwh') => (m === 'cost' ? aud(r.cost, 0) : `${kwh(r.kwh)} kWh`)
        const selectedValue = (r: (typeof rows)[number]) => barLabel(r, metric)
        const otherValue = (r: (typeof rows)[number]) => barLabel(r, metric === 'cost' ? 'kwh' : 'cost')
        return (
          <section className="chart-card" key={year}>
            <h4>
              <span>{year}</span>
              <em>
                {metric === 'cost' ? aud(total, 0) : `${kwh(total)} kWh`}
                {inProgress ? ' · YTD' : ''}
              </em>
            </h4>
            <div className="bars">
              {rows.map((r, i) => (
                <button
                  key={r.ym}
                  type="button"
                  className={`b ${inProgress && i === rows.length - 1 ? 'hi' : ''} ${sel === r.ym ? 'show' : ''} ${rolling ? 'rolling' : ''}`}
                  data-v={selectedValue(r)}
                  data-prev={otherValue(r)}
                  style={{ height: `${Math.max(3, (r.value / max) * 100)}%`, ['--i' as string]: i }}
                  aria-label={`${r.label} ${year}: ${selectedValue(r)}`}
                  onClick={() => setSel(sel === r.ym ? null : r.ym)}
                />
              ))}
            </div>
            <div className="blbl">
              {rows.map(r => (
                <span key={r.ym}>{r.label}</span>
              ))}
            </div>
          </section>
        )
      })}

      <footer className="app-footer">EV Command · Analytics</footer>
    </main>
  )
}
