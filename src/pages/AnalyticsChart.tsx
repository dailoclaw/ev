import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEv } from '../lib/useEv'
import { aud, kwh } from '../lib/format'
import { Icon } from '../components/ui'

const shortProv = (name: string) => (name === 'Supercharger' ? 'SC' : name)

// Dedicated 12-month chart: $ / kWh metric toggle + charger-type filter.
export default function AnalyticsChart() {
  const ev = useEv()
  const navigate = useNavigate()
  const [metric, setMetric] = useState<'cost' | 'kwh'>('cost')
  const [prov, setProv] = useState('All')
  const provNames = ['All', ...ev.byProvider.map(p => p.name)]
  const provColor = (name: string) => ev.providers.find(p => p.name === name)?.color ?? 'var(--steel)'

  // monthly cost + kWh for the selected provider, aligned to ev.months, last 12
  const byM = new Map<string, { cost: number; kwh: number }>()
  for (const s of ev.sessions) {
    if (prov !== 'All' && s.type !== prov) continue
    const ym = s.date.slice(0, 7)
    const o = byM.get(ym) ?? { cost: 0, kwh: 0 }
    o.cost += s.cost
    o.kwh += s.amount
    byM.set(ym, o)
  }
  const data = ev.months
    .map(m => {
      const o = byM.get(m.month) ?? { cost: 0, kwh: 0 }
      return { month: m.month, label: m.label.split(' ')[0], cost: o.cost, kwh: o.kwh }
    })
    .slice(-12)
  const val = (d: { cost: number; kwh: number }) => (metric === 'cost' ? d.cost : d.kwh)
  const max = Math.max(...data.map(val), 0.01)
  const totalCost = data.reduce((s, d) => s + d.cost, 0)
  const totalKwh = data.reduce((s, d) => s + d.kwh, 0)

  return (
    <main className="app-shell">
      <header className="appbar">
        <div>
          <p className="eyebrow">Analytics · detail</p>
          <h1>Monthly chart</h1>
          <span className="sub">Last 12 months{prov !== 'All' ? ` · ${prov}` : ''}</span>
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

      <section className="hero-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span className="cap">12-mo cost</span>
          <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>{aud(totalCost)}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span className="cap">12-mo energy</span>
          <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>{kwh(totalKwh)} kWh</div>
        </div>
      </section>

      <section className="chart-card">
        <h4>
          <span>{metric === 'cost' ? 'Cost' : 'Energy'} per month</span>
          <em>{prov === 'All' ? 'all networks' : prov}</em>
        </h4>
        <div className="bars" style={{ height: 128 }}>
          {data.map((d, i) => (
            <div
              key={d.month}
              className={`b ${i === data.length - 1 ? 'hi' : ''}`}
              data-v={metric === 'cost' ? aud(val(d), 0) : kwh(val(d))}
              style={{ height: `${Math.max(4, (val(d) / max) * 100)}%` }}
            />
          ))}
        </div>
        <div className="blbl">
          {data.map((d, i) => (
            <span key={d.month} className={i === data.length - 1 ? 'hi' : ''}>
              {d.label}
            </span>
          ))}
        </div>
      </section>

      <footer className="app-footer">EV Command · Analytics</footer>
    </main>
  )
}
