import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEv } from '../lib/useEv'
import { aud, kwh } from '../lib/format'

type View = 'statement' | 'cluster' | 'trends' | 'split' | 'compare'
type Metric = 'cost' | 'kwh' | 'rate'

const VIEWS: { id: View; label: string; eye: string; icon: ReactNode }[] = [
  { id: 'statement', label: 'Statement', eye: 'Statement', icon: <path d="M4 6h16M4 12h16M4 18h10" /> },
  {
    id: 'cluster',
    label: 'Cluster',
    eye: 'Instruments',
    icon: (
      <>
        <rect x="4" y="4" width="7" height="7" rx="1.5" />
        <rect x="13" y="4" width="7" height="7" rx="1.5" />
        <rect x="4" y="13" width="7" height="7" rx="1.5" />
        <rect x="13" y="13" width="7" height="7" rx="1.5" />
      </>
    ),
  },
  {
    id: 'trends',
    label: 'Trends',
    eye: 'Trends',
    icon: (
      <>
        <path d="M3 16l5-5 4 3 8-8" />
        <path d="M17 6h4v4" />
      </>
    ),
  },
  {
    id: 'split',
    label: 'Split',
    eye: 'Breakdown',
    icon: (
      <>
        <path d="M12 3v9l7 4" />
        <circle cx="12" cy="12" r="9" />
      </>
    ),
  },
  { id: 'compare', label: 'Compare', eye: 'Compare', icon: <path d="M6 20V9M12 20V4M18 20v-7" /> },
]

const perKwh = (cost: number, k: number) => (k > 0 ? '$' + (cost / k).toFixed(2) : '—')
const pct = (cur: number, prev: number) => (prev > 0 ? ((cur - prev) / prev) * 100 : null)
// short chip label so all provider filters fit one row
const shortProv = (name: string) => (name === 'Supercharger' ? 'SC' : name)

export default function Analytics() {
  const ev = useEv()
  const navigate = useNavigate()
  const [view, setView] = useState<View>('statement')

  // ---- derived, shared across views ----
  const years = useMemo(() => {
    const set = new Set(ev.months.map(m => m.month.slice(0, 4)))
    return [...set].sort((a, b) => b.localeCompare(a))
  }, [ev.months])

  const provColor = (name: string) => ev.providers.find(p => p.name === name)?.color ?? 'var(--steel)'

  const yearAgg = (y: string) =>
    ev.months
      .filter(m => m.month.startsWith(y))
      .reduce(
        (a, m) => ({
          cost: a.cost + m.cost,
          kwh: a.kwh + m.kwh,
          sessions: a.sessions + m.sessions,
          freeKwh: a.freeKwh + m.freeKwh,
          saved: a.saved + m.saved,
          fees: a.fees + m.fees,
        }),
        { cost: 0, kwh: 0, sessions: 0, freeKwh: 0, saved: 0, fees: 0 },
      )

  // monthly series for a provider filter + metric, aligned to ev.months
  const series = (provider: string, metric: Metric) => {
    const byM = new Map<string, { cost: number; kwh: number }>()
    for (const s of ev.sessions) {
      if (provider !== 'All' && s.type !== provider) continue
      const ym = s.date.slice(0, 7)
      const o = byM.get(ym) ?? { cost: 0, kwh: 0 }
      o.cost += s.cost
      o.kwh += s.amount
      byM.set(ym, o)
    }
    return ev.months.map(m => {
      const o = byM.get(m.month) ?? { cost: 0, kwh: 0 }
      const value = metric === 'cost' ? o.cost : metric === 'kwh' ? o.kwh : o.kwh > 0 ? o.cost / o.kwh : 0
      return { month: m.month, label: m.label.split(' ')[0], value }
    })
  }

  // up-to-8 daily-kWh spark heights for a given month
  const daySpark = (ym: string) => {
    const days = new Map<string, number>()
    for (const s of ev.sessions) {
      if (!s.date.startsWith(ym)) continue
      days.set(s.date, (days.get(s.date) ?? 0) + s.amount)
    }
    let vals = [...days.values()]
    if (vals.length > 8) {
      const step = vals.length / 8
      vals = Array.from({ length: 8 }, (_, i) => vals[Math.floor(i * step)])
    }
    const max = Math.max(...vals, 0.01)
    return vals.map(v => Math.max(12, (v / max) * 100))
  }

  const empty = ev.months.length === 0

  return (
    <main className="app-shell">
      <header className="appbar">
        <div>
          <p className="eyebrow">{VIEWS.find(v => v.id === view)!.eye}</p>
          <h1>Analytics</h1>
          <span className="sub">{ev.lifetime.sessions} charges · {kwh(ev.lifetime.kwh)} kWh all-time</span>
        </div>
        <button className="icon-btn" type="button" aria-label="Back home" onClick={() => navigate('/')}>
          <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--steel)' }}>⌂</span>
        </button>
      </header>

      {/* the toggle */}
      <nav className="vtabs" aria-label="Analytics views">
        {VIEWS.map(v => (
          <button
            key={v.id}
            type="button"
            className={`vt ${view === v.id ? 'on' : ''}`}
            aria-current={view === v.id ? 'true' : undefined}
            onClick={() => {
              setView(v.id)
              window.scrollTo(0, 0)
            }}
          >
            <svg viewBox="0 0 24 24">{v.icon}</svg>
            <span>{v.label}</span>
          </button>
        ))}
      </nav>

      {empty ? (
        <div className="emptybat">
          <div className="batt">
            <i />
          </div>
          <b>No charges yet</b>
          <p>Log a charge with the + button and your analytics build here automatically.</p>
        </div>
      ) : view === 'statement' ? (
        <StatementView ev={ev} years={years} yearAgg={yearAgg} daySpark={daySpark} navigate={navigate} />
      ) : view === 'cluster' ? (
        <ClusterView ev={ev} series={series} navigate={navigate} />
      ) : view === 'trends' ? (
        <TrendsView ev={ev} series={series} provColor={provColor} navigate={navigate} />
      ) : view === 'split' ? (
        <SplitView ev={ev} provColor={provColor} />
      ) : (
        <CompareView years={years} yearAgg={yearAgg} />
      )}

      <footer className="app-footer">EV Command · Analytics</footer>
    </main>
  )
}

/* ============ STATEMENT (landing) ============ */
function StatementView({
  ev,
  years,
  yearAgg,
  daySpark,
  navigate,
}: {
  ev: ReturnType<typeof useEv>
  years: string[]
  yearAgg: (y: string) => { cost: number; kwh: number; sessions: number; freeKwh: number; saved: number; fees: number }
  daySpark: (ym: string) => number[]
  navigate: (to: string, opts?: { state: unknown }) => void
}) {
  const [year, setYear] = useState(years[0])
  const activeYear = years.includes(year) ? year : years[0]
  const yMonths = ev.months.filter(m => m.month.startsWith(activeYear))
  const yDesc = [...yMonths].reverse()
  const tot = yearAgg(activeYear)
  const prevYear = String(Number(activeYear) - 1)
  const deltaCost = years.includes(prevYear) ? pct(tot.cost, yearAgg(prevYear).cost) : null

  return (
    <>
      <div className="seg" aria-label="Select year">
        {years.map(y => (
          <button key={y} type="button" className={y === activeYear ? 'on' : ''} onClick={() => setYear(y)}>
            {y}
          </button>
        ))}
      </div>

      <section className="hero-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <div>
            <span className="cap">Spent · {activeYear}</span>
            <div className="hero-num">{aud(tot.cost)}</div>
          </div>
          {deltaCost != null && (
            <span className={`delta ${deltaCost > 0 ? 'up' : ''}`}>
              {deltaCost > 0 ? '▲' : '▼'} {Math.abs(deltaCost).toFixed(0)}% vs {prevYear}
            </span>
          )}
        </div>
        <p className="hero-sub">
          {kwh(tot.kwh)} kWh added over {tot.sessions} charges · effective {perKwh(tot.cost, tot.kwh)}/kWh
        </p>
      </section>

      <div className="sec-head">
        <h2 className="sec-h2" style={{ marginTop: 4 }}>
          Monthly breakdown
        </h2>
      </div>
      <p className="sec-sub">Tap a month to open its statement.</p>

      <div className="ledger">
        <div className="lhead">
          <span>Month</span>
          <span>kWh</span>
          <span style={{ textAlign: 'right' }}>Cost</span>
          <span />
        </div>
        {yDesc.map(m => {
          const spark = daySpark(m.month)
          return (
            <button
              key={m.month}
              type="button"
              className="lrow"
              onClick={() => navigate('/statement', { state: { month: m.month } })}
            >
              <div className="mo">
                {m.label.split(' ')[0]}
                <small>
                  {m.sessions} charge{m.sessions !== 1 ? 's' : ''}
                </small>
              </div>
              <div className="num">{kwh(m.kwh)}</div>
              <div className="num">{aud(m.cost)}</div>
              <div className="spk">
                {spark.map((h, i) => (
                  <i key={i} style={{ height: `${h}%` }} />
                ))}
              </div>
            </button>
          )
        })}
        <div className="lrow tot">
          <div className="mo">{activeYear} total</div>
          <div className="num">{kwh(tot.kwh)}</div>
          <div className="num">{aud(tot.cost)}</div>
          <div className="spk" />
        </div>
      </div>
    </>
  )
}

/* ============ CLUSTER (KPI tiles) ============ */
type Gran = 'year' | 'quarter' | 'month'
interface Bucket {
  key: string
  label: string
  cost: number
  kwh: number
  sessions: number
  freeKwh: number
  saved: number
  fees: number
}

function bucketize(months: ReturnType<typeof useEv>['months'], gran: Gran): Bucket[] {
  const map = new Map<string, Bucket>()
  for (const m of months) {
    const [y, mm] = m.month.split('-').map(Number)
    let key: string
    let label: string
    if (gran === 'year') {
      key = String(y)
      label = String(y)
    } else if (gran === 'quarter') {
      const q = Math.floor((mm - 1) / 3) + 1
      key = `${y}-Q${q}`
      label = `Q${q} '${String(y).slice(2)}`
    } else {
      key = m.month
      label = m.label.split(' ')[0]
    }
    const b = map.get(key) ?? { key, label, cost: 0, kwh: 0, sessions: 0, freeKwh: 0, saved: 0, fees: 0 }
    b.cost += m.cost
    b.kwh += m.kwh
    b.sessions += m.sessions
    b.freeKwh += m.freeKwh
    b.saved += m.saved
    b.fees += m.fees
    map.set(key, b)
  }
  return [...map.values()] // chronological — ev.months is sorted ascending
}

function ClusterView({
  ev,
  series,
  navigate,
}: {
  ev: ReturnType<typeof useEv>
  series: (provider: string, metric: Metric) => { month: string; label: string; value: number }[]
  navigate: (to: string) => void
}) {
  const [gran, setGran] = useState<Gran>('year')
  const [metric, setMetric] = useState<'cost' | 'kwh'>('cost')

  const bk = bucketize(ev.months, gran)
  const cur = bk[bk.length - 1]
  const prev = bk[bk.length - 2]
  const dCost = prev ? pct(cur.cost, prev.cost) : null
  const dKwh = prev ? pct(cur.kwh, prev.kwh) : null
  const priciest = bk.reduce((a, b) => (b.cost > a.cost ? b : a), bk[0])

  const bars = series('All', metric).slice(-6)
  const max = Math.max(...bars.map(b => b.value), 0.01)

  return (
    <>
      <div className="seg" aria-label="Granularity">
        {(['year', 'quarter', 'month'] as Gran[]).map(g => (
          <button key={g} type="button" className={gran === g ? 'on' : ''} onClick={() => setGran(g)}>
            {g[0].toUpperCase() + g.slice(1)}
          </button>
        ))}
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <span>Total cost</span>
          <strong>{aud(cur.cost)}</strong>
          {dCost != null ? (
            <small className={dCost > 0 ? 'negd' : 'pos'}>
              {dCost > 0 ? '▲' : '▼'} {Math.abs(dCost).toFixed(0)}% vs {prev.label}
            </small>
          ) : (
            <small>{cur.label}</small>
          )}
        </div>
        <div className="metric-card">
          <span>Energy added</span>
          <strong>{kwh(cur.kwh)} kWh</strong>
          {dKwh != null ? (
            <small>
              {dKwh > 0 ? '▲' : '▼'} {Math.abs(dKwh).toFixed(0)}% vs {prev.label}
            </small>
          ) : (
            <small>{cur.label}</small>
          )}
        </div>
        <div className="metric-card">
          <span>Avg rate</span>
          <strong>{perKwh(cur.cost, cur.kwh)}</strong>
          <small>per kWh · incl. free</small>
        </div>
        <div className="metric-card">
          <span>Charges</span>
          <strong>{cur.sessions}</strong>
          <small>{cur.sessions > 0 ? `${(cur.kwh / cur.sessions).toFixed(1)} kWh avg` : '—'}</small>
        </div>
      </div>

      <section className="chart-card">
        <h4>
          <span>{metric === 'cost' ? 'Cost' : 'Energy'} per month</span>
          <span className="seg" style={{ margin: 0, gridAutoColumns: 'auto', padding: 3 }}>
            <button
              type="button"
              className={metric === 'cost' ? 'on' : ''}
              style={{ minHeight: 26, padding: '0 12px' }}
              onClick={() => setMetric('cost')}
            >
              $
            </button>
            <button
              type="button"
              className={metric === 'kwh' ? 'on' : ''}
              style={{ minHeight: 26, padding: '0 12px' }}
              onClick={() => setMetric('kwh')}
            >
              kWh
            </button>
          </span>
        </h4>
        <button
          type="button"
          onClick={() => navigate('/analytics/chart')}
          aria-label="Open 12-month chart detail"
          style={{ display: 'block', width: '100%', background: 'none', border: 0, padding: 0, cursor: 'pointer' }}
        >
          <div className="bars">
            {bars.map((b, i) => (
              <div
                key={b.month}
                className={`b ${i === bars.length - 1 ? 'hi' : ''}`}
                data-v={metric === 'cost' ? aud(b.value, 0) : kwh(b.value)}
                style={{ height: `${Math.max(6, (b.value / max) * 100)}%` }}
              />
            ))}
          </div>
          <div className="blbl">
            {bars.map((b, i) => (
              <span key={b.month} className={i === bars.length - 1 ? 'hi' : ''}>
                {b.label}
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
            <span className="text-btn">Open 12-month detail ›</span>
          </div>
        </button>
      </section>

      <div className="metric-grid" style={{ marginBottom: 0 }}>
        <div className="metric-card">
          <span>Priciest {gran}</span>
          <strong>{priciest.label}</strong>
          <small>
            {aud(priciest.cost)} · {kwh(priciest.kwh)} kWh
          </small>
        </div>
        <div className="metric-card">
          <span>Free saved</span>
          <strong>{aud(ev.lifetime.netSaved, 0)}</strong>
          <small className="pos">net, lifetime</small>
        </div>
      </div>
    </>
  )
}

/* ============ TRENDS (line chart) ============ */
function TrendsView({
  ev,
  series,
  provColor,
  navigate,
}: {
  ev: ReturnType<typeof useEv>
  series: (provider: string, metric: Metric) => { month: string; label: string; value: number }[]
  provColor: (name: string) => string
  navigate: (to: string) => void
}) {
  const [metric, setMetric] = useState<Metric>('cost')
  const [prov, setProv] = useState('All')
  const provNames = ['All', ...ev.byProvider.map(p => p.name)]

  const data = series(prov, metric).slice(-6)
  const n = data.length
  const max = Math.max(...data.map(d => d.value), 1e-6)
  const xAt = (i: number) => (n > 1 ? (i / (n - 1)) * 300 : 150)
  const yAt = (v: number) => 128 - (v / max) * 108
  const d = data.map((p, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)} ${yAt(p.value).toFixed(1)}`).join(' ')
  const last = data[n - 1]
  const fmt = (v: number) => (metric === 'cost' ? aud(v) : metric === 'kwh' ? `${kwh(v)} kWh` : '$' + v.toFixed(3))
  const flagLeft = Math.min(86, Math.max(14, (n > 1 ? 1 : 0.5) * 100))

  const top = ev.byProvider[0]
  const share = ev.lifetime.kwh > 0 && top ? (top.kwh / ev.lifetime.kwh) * 100 : 0
  const priciest = ev.months.reduce((a, m) => (m.cost > a.cost ? m : a), ev.months[0])
  const lifeRate = perKwh(ev.lifetime.cost, ev.lifetime.kwh)

  return (
    <>
      <div className="seg" aria-label="Metric">
        {(['cost', 'kwh', 'rate'] as Metric[]).map(mt => (
          <button key={mt} type="button" className={metric === mt ? 'on' : ''} onClick={() => setMetric(mt)}>
            {mt === 'cost' ? 'Cost' : mt === 'kwh' ? 'kWh' : '$/kWh'}
          </button>
        ))}
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

      <button
        type="button"
        className="chart-card"
        onClick={() => navigate('/analytics/chart')}
        aria-label="Open 12-month chart detail"
        style={{ display: 'block', width: '100%', textAlign: 'left', paddingTop: 22, cursor: 'pointer' }}
      >
        <div className="scrub">
          {last && (
            <div className="flag" style={{ left: `${flagLeft}%`, top: 8 }}>
              {last.label} · {fmt(last.value)}
            </div>
          )}
          <svg viewBox="0 0 300 148" preserveAspectRatio="none">
            <line className="gl" x1="0" y1="38" x2="300" y2="38" />
            <line className="gl" x1="0" y1="94" x2="300" y2="94" />
            <path className="ln" d={d} />
            {last && <circle className="dot" cx={xAt(n - 1)} cy={yAt(last.value)} r="5" />}
          </svg>
        </div>
        <div className="yaxis">
          {data.map((p, i) => (
            <span key={p.month} style={i === n - 1 ? { color: 'var(--tx)' } : undefined}>
              {p.label}
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
          <span className="text-btn">Open 12-month detail ›</span>
        </div>
      </button>

      {top && (
        <div className="row">
          <span className="mark" style={{ ['--pc' as string]: provColor(top.name) }}>
            {top.name.charAt(0)}
          </span>
          <span>
            <strong>
              {top.name} drove {share.toFixed(0)}% of energy
            </strong>
            <small>
              {kwh(top.kwh)} of {kwh(ev.lifetime.kwh)} kWh lifetime
            </small>
          </span>
          <b className="amt">{share.toFixed(0)}%</b>
        </div>
      )}
      <div className="row">
        <span className="mark" style={{ ['--pc' as string]: 'var(--money)' }}>
          ▲
        </span>
        <span>
          <strong>{priciest.label.split(' ')[0]} cost the most</strong>
          <small>
            {aud(priciest.cost)} · {kwh(priciest.kwh)} kWh
          </small>
        </span>
        <b className="amt">{aud(priciest.cost)}</b>
      </div>
      <div className="row">
        <span className="mark" style={{ ['--pc' as string]: 'var(--steel)' }}>
          ≈
        </span>
        <span>
          <strong>Effective rate</strong>
          <small>{lifeRate}/kWh all-in across your history</small>
        </span>
        <b className="amt">{lifeRate}</b>
      </div>
    </>
  )
}

/* ============ SPLIT (composition) ============ */
function SplitView({ ev, provColor }: { ev: ReturnType<typeof useEv>; provColor: (name: string) => string }) {
  const byCost = ev.byProvider.filter(p => p.cost > 0)
  const totalCost = byCost.reduce((a, p) => a + p.cost, 0)
  const stops = byCost
    .map((p, i) => {
      const before = byCost.slice(0, i).reduce((s, q) => s + q.cost, 0)
      const start = (before / totalCost) * 100
      const end = ((before + p.cost) / totalCost) * 100
      return `${provColor(p.name)} ${start.toFixed(2)}% ${end.toFixed(2)}%`
    })
    .join(', ')

  const byKwh = [...ev.byProvider].sort((a, b) => b.kwh - a.kwh)
  const maxKwh = Math.max(...byKwh.map(p => p.kwh), 0.01)

  const last6 = ev.months.slice(-6)
  const maxTot = Math.max(...last6.map(m => m.kwh), 0.01)

  return (
    <>
      <section className="hero-card">
        <span className="cap" style={{ marginBottom: 12 }}>
          Cost by charger network
        </span>
        <div className="donutwrap">
          <div
            className="donut"
            style={{ background: `conic-gradient(${stops || 'var(--bd2) 0 100%'})` }}
            role="img"
            aria-label="Cost split by network"
          >
            <div className="din">
              <b>{aud(totalCost, 0)}</b>
            </div>
          </div>
          <div className="leg">
            {byCost.map(p => (
              <div className="lr" key={p.name} style={{ ['--pc' as string]: provColor(p.name) }}>
                <i />
                <span className="nm">{p.name}</span>
                <span className="vl">{aud(p.cost, 0)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="chart-card race">
        <h4>
          <span>Energy by network</span>
          <em>kWh · {kwh(ev.lifetime.kwh)} total</em>
        </h4>
        {byKwh.map(p => (
          <div className="rrow" key={p.name} style={{ ['--pc' as string]: provColor(p.name) }}>
            <div className="rl2">
              <b>{p.name}</b>
              <span>{kwh(p.kwh)} kWh</span>
            </div>
            <div className="bar">
              <i style={{ width: `${Math.max(3, (p.kwh / maxKwh) * 100)}%` }} />
            </div>
          </div>
        ))}
      </section>

      <section className="chart-card">
        <h4>
          <span>Free vs paid kWh</span>
          <em>per month</em>
        </h4>
        <div className="sbars">
          {last6.map(m => {
            const paid = Math.max(0, m.kwh - m.freeKwh)
            return (
              <div className="col" key={m.month}>
                <i className="paid" style={{ height: `${(paid / maxTot) * 100}%` }} />
                <i className="free" style={{ height: `${(m.freeKwh / maxTot) * 100}%` }} />
              </div>
            )
          })}
        </div>
        <div className="blbl">
          {last6.map(m => (
            <span key={m.month}>{m.label.split(' ')[0]}</span>
          ))}
        </div>
        <div className="splitleg">
          <span>
            <i style={{ background: '#059669' }} />
            Free allowance
          </span>
          <span>
            <i style={{ background: 'var(--steel)' }} />
            Paid
          </span>
        </div>
      </section>
    </>
  )
}

/* ============ COMPARE (period vs period) ============ */
function CompareView({
  years,
  yearAgg,
}: {
  years: string[]
  yearAgg: (y: string) => { cost: number; kwh: number; sessions: number; freeKwh: number; saved: number; fees: number }
}) {
  if (years.length < 2) {
    return (
      <div className="emptybat">
        <div className="batt">
          <i />
        </div>
        <b>Need two periods to compare</b>
        <p>Your data spans a single year so far. Once there's a second year, this view lights up.</p>
      </div>
    )
  }
  const A = years[1]
  const B = years[0]
  const a = yearAgg(A)
  const b = yearAgg(B)
  const rateA = a.kwh > 0 ? a.cost / a.kwh : 0
  const rateB = b.kwh > 0 ? b.cost / b.kwh : 0
  const bar = (va: number, vb: number) => {
    const t = va + vb
    return t > 0 ? [(va / t) * 100, (vb / t) * 100] : [50, 50]
  }
  const [cA, cB] = bar(a.cost, b.cost)
  const [kA, kB] = bar(a.kwh, b.kwh)
  const [rA, rB] = bar(rateA, rateB)
  const arrow = (x: number, y: number) => (x === y ? '' : x > y ? '▲ ' : '▼ ')
  const delta = (x: number, y: number) => (y > 0 ? `${x > y ? '+' : ''}${(((x - y) / y) * 100).toFixed(0)}%` : '—')

  return (
    <>
      <div className="seg" style={{ gridTemplateColumns: '1fr auto 1fr', gridAutoFlow: 'unset' }}>
        <button type="button" className="on">
          {A}
        </button>
        <button type="button" style={{ minHeight: 34, color: 'var(--fnt)' }} disabled>
          vs
        </button>
        <button type="button" className="on" style={{ background: 'var(--money)' }}>
          {B}
        </button>
      </div>

      <section className="hero-card">
        <div className="cmp-metric">Total cost</div>
        <div className="cmp">
          <div className="side">
            <div className="v">{aud(a.cost, 0)}</div>
            <div className="l">{A}</div>
          </div>
          <div className="mid">{delta(b.cost, a.cost)}</div>
          <div className="side">
            <div className="v" style={{ color: 'var(--money-deep)' }}>
              {aud(b.cost, 0)}
            </div>
            <div className="l">{B}</div>
          </div>
        </div>
        <div className="cmpbar">
          <i className="b" style={{ width: `${cA}%` }} />
          <i className="a" style={{ width: `${cB}%` }} />
        </div>

        <div className="cmp-metric">Energy added</div>
        <div className="cmp">
          <div className="side">
            <div className="v">{kwh(a.kwh)}</div>
            <div className="l">kWh {A}</div>
          </div>
          <div className="mid">{delta(b.kwh, a.kwh)}</div>
          <div className="side">
            <div className="v">{kwh(b.kwh)}</div>
            <div className="l">kWh {B}</div>
          </div>
        </div>
        <div className="cmpbar">
          <i className="b" style={{ width: `${kA}%` }} />
          <i className="a" style={{ width: `${kB}%` }} />
        </div>

        <div className="cmp-metric">Effective rate</div>
        <div className="cmp">
          <div className="side">
            <div className="v">{perKwh(a.cost, a.kwh)}</div>
            <div className="l">{A}</div>
          </div>
          <div className="mid">
            {arrow(rateB, rateA)}
            {rateB > rateA ? 'higher' : 'lower'}
          </div>
          <div className="side">
            <div className="v">{perKwh(b.cost, b.kwh)}</div>
            <div className="l">{B}</div>
          </div>
        </div>
        <div className="cmpbar">
          <i className="b" style={{ width: `${rA}%` }} />
          <i className="a" style={{ width: `${rB}%` }} />
        </div>
      </section>

      <div className="metric-grid" style={{ marginBottom: 0 }}>
        <div className="metric-card">
          <span>Charges</span>
          <strong>
            {a.sessions} → {b.sessions}
          </strong>
          <small>
            {A} → {B}
          </small>
        </div>
        <div className="metric-card">
          <span>Free saved</span>
          <strong>
            {aud(a.saved - a.fees, 0)} → {aud(b.saved - b.fees, 0)}
          </strong>
          <small className="pos">net free energy</small>
        </div>
      </div>
    </>
  )
}
