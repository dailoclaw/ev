import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEv } from '../lib/useEv'
import { aud, kwh } from '../lib/format'
import { Icon, Mark } from '../components/ui'
import { yearOnYear } from '../lib/yearOnYear'
import { records } from '../lib/records'
import { useUnitRoll } from '../lib/useUnitRoll'
import CountUpNumber from '../components/CountUpNumber'
import StyleVariant from '../components/StyleVariant'
import GlassSegmented from '../components/GlassSegmented'

type View = 'statement' | 'cluster' | 'trends' | 'split' | 'compare'
type Metric = 'cost' | 'kwh' | 'rate'
type CanvasStatsView = 'overview' | 'energy' | 'free' | 'providers'
type ProviderMetric = 'cost' | 'kwh' | 'free'

const VIEWS: { id: View; label: string; eye: string; icon: ReactNode }[] = [
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
  { id: 'statement', label: 'Statement', eye: 'Statement', icon: <path d="M4 6h16M4 12h16M4 18h10" /> },
]

const perKwh = (cost: number, k: number) => (k > 0 ? '$' + (cost / k).toFixed(2) : '—')
const pct = (cur: number, prev: number) => (prev > 0 ? ((cur - prev) / prev) * 100 : null)
// short chip label so all provider filters fit one row
const shortProv = (name: string) => {
  if (name.length <= 11) return name
  const initials = name.split(/\s+/).map(part => part[0]).join('').toUpperCase()
  return initials.length >= 2 ? initials.slice(0, 4) : name.slice(0, 4)
}

export default function Analytics() {
  return <StyleVariant classic={ClassicAnalytics} minimal={CanvasStats} />
}

function CanvasStats() {
  const ev = useEv()
  const navigate = useNavigate()
  const [view, setView] = useState<CanvasStatsView>('overview')
  const [providerMetric, setProviderMetric] = useState<ProviderMetric>('cost')

  const years = useMemo(() => {
    const set = new Set(ev.months.map(m => m.month.slice(0, 4)))
    return [...set].sort((a, b) => b.localeCompare(a))
  }, [ev.months])

  const model = useMemo(() => {
    const activeYear = years[0] ?? String(new Date().getFullYear())
    const prevYear = String(Number(activeYear) - 1)
    const months = ev.months.filter(m => m.month.startsWith(activeYear))
    const prevMonths = ev.months.filter(m => m.month.startsWith(prevYear))
    const sum = (list: typeof ev.months) =>
      list.reduce(
        (a, m) => ({
          cost: a.cost + m.cost,
          kwh: a.kwh + m.kwh,
          sessions: a.sessions + m.sessions,
          freeKwh: a.freeKwh + m.freeKwh,
          saved: a.saved + m.saved,
        }),
        { cost: 0, kwh: 0, sessions: 0, freeKwh: 0, saved: 0 },
      )
    const cur = sum(months)
    const prev = sum(prevMonths)
    const rateNow = cur.kwh > 0 ? cur.cost / cur.kwh : 0
    const ratePrev = prev.kwh > 0 ? prev.cost / prev.kwh : 0
    const rateDelta = ratePrev > 0 ? ((rateNow - ratePrev) / ratePrev) * 100 : null
    const freePct = cur.kwh > 0 ? Math.round((cur.freeKwh / cur.kwh) * 100) : 0
    const avgMonth = months.length > 0 ? cur.kwh / months.length : 0
    const largestMonth = months.reduce((max, m) => Math.max(max, m.kwh), 0)
    const bestProvider =
      ev.byProvider
        .filter(p => p.kwh > 0)
        .slice()
        .sort((a, b) => a.effectiveRate - b.effectiveRate)[0] ?? ev.byProvider[0]
    return { activeYear, months, cur, prev, rateNow, rateDelta, freePct, avgMonth, largestMonth, bestProvider }
  }, [ev, years])

  const rates = model.months.map(m => (m.kwh > 0 ? m.cost / m.kwh : 0))
  const energyBars = model.months.slice(-8)
  const maxEnergy = Math.max(...energyBars.map(m => m.kwh), 1)
  const freeTrend = model.months.map(m => (m.kwh > 0 ? (m.freeKwh / m.kwh) * 100 : 0))
  const r = useMemo(() => records(ev), [ev])
  const providerMaxValue = Math.max(
    ...ev.byProvider.map(p => (providerMetric === 'cost' ? p.cost : providerMetric === 'kwh' ? p.kwh : p.freeKwh)),
    0.01,
  )

  const back = () => setView('overview')
  const deltaText =
    model.rateDelta == null
      ? 'Building trend.'
      : `${model.rateDelta > 0 ? 'Up' : 'Down'} ${Math.abs(model.rateDelta).toFixed(0)}% on last year.`

  return (
    <main className="app-shell cv cv-stats">
      {view === 'overview' ? (
        <>
          <header className="appbar">
            <div>
              <p className="cv-eyebrow">Stats</p>
              <h1 className="cv-big cv-rate">
                <CountUpNumber value={model.rateNow} format={value => `$${value.toFixed(2)}`} durationMs={850} />
              </h1>
            </div>
            <button className="icon-btn" type="button" aria-label="Back home" onClick={() => navigate('/')}>
              <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--steel)' }}>⌂</span>
            </button>
          </header>
          <p className="cv-ctx">
            All-in rate per kWh. <em>{deltaText}</em>
          </p>
          <CanvasTrend values={rates} kind="rate" />
          <div className="cv-rows">
            <button className="cv-row" type="button" onClick={() => setView('energy')}>
              <span className="k">Energy added</span>
              <span className="v">
                <CountUpNumber value={model.cur.kwh} format={value => kwh(value, 0)} durationMs={720} />
              </span>
              <span className="c" aria-hidden="true">
                ›
              </span>
            </button>
            <button className="cv-row" type="button" onClick={() => setView('free')}>
              <span className="k">Free energy</span>
              <span className="v">
                <CountUpNumber value={model.freePct} format={value => `${Math.round(value)}%`} durationMs={720} />
              </span>
              <span className="c" aria-hidden="true">
                ›
              </span>
            </button>
            <button className="cv-row" type="button" onClick={() => navigate('/savings')}>
              <span className="k">Saved on free</span>
              <span className="v">
                <CountUpNumber value={model.cur.saved} format={value => aud(value, 0)} durationMs={720} />
              </span>
              <span className="c" aria-hidden="true">
                ›
              </span>
            </button>
            <button className="cv-row" type="button" onClick={() => setView('providers')}>
              <span className="k">Best network</span>
              <span className="v">{model.bestProvider?.name ?? '—'}</span>
              <span className="c" aria-hidden="true">
                ›
              </span>
            </button>
          </div>
        </>
      ) : view === 'energy' ? (
        <>
          <CanvasStatsHeader
            title="Energy"
            value={<CountUpNumber value={model.cur.kwh} format={value => Math.round(value).toLocaleString('en-AU')} durationMs={850} />}
            ctx={`${model.activeYear} charging rhythm.`}
            onBack={back}
          />
          <div className="cv-barviz" aria-label="Recent monthly energy">
            {energyBars.map((m, i) => (
              <i
                key={m.month}
                style={{ ['--h' as string]: `${Math.max(10, (m.kwh / maxEnergy) * 100)}%`, ['--i' as string]: i }}
                aria-label={`${m.label}: ${kwh(m.kwh)}`}
              >
                <span>
                  <CountUpNumber value={m.kwh} format={value => kwh(value, 0)} delayMs={i * 55} durationMs={650} />
                </span>
              </i>
            ))}
          </div>
          <section className="cv-mini-grid">
            <article>
              <span>Average month</span>
              <b>
                <CountUpNumber value={model.avgMonth} format={value => kwh(value, 0)} durationMs={760} />
              </b>
            </article>
            <article>
              <span>Largest month</span>
              <b>
                <CountUpNumber value={model.largestMonth} format={value => kwh(value, 0)} durationMs={760} />
              </b>
            </article>
          </section>
          <div className="cv-rows">
            <button className="cv-row" type="button" onClick={() => navigate('/statement')}>
              <span className="k">Statement view</span>
              <span className="v">Open</span>
              <span className="c" aria-hidden="true">
                ›
              </span>
            </button>
            <button className="cv-row" type="button" onClick={() => setView('overview')}>
              <span className="k">Back to rate trend</span>
              <span className="v">
                <CountUpNumber value={model.rateNow} format={value => `$${value.toFixed(2)}`} durationMs={720} />
              </span>
              <span className="c" aria-hidden="true">
                ›
              </span>
            </button>
          </div>
        </>
      ) : view === 'free' ? (
        <>
          <CanvasStatsHeader
            title="Free energy"
            value={<CountUpNumber value={model.freePct} format={value => `${Math.round(value)}%`} durationMs={850} />}
            ctx={`${aud(model.cur.saved, 0)} saved in ${model.activeYear}.`}
            onBack={back}
          />
          <CanvasTrend values={freeTrend} kind="free" />
          <div className="cv-rows">
            <button className="cv-row" type="button" onClick={() => navigate('/savings')}>
              <span className="k">Free kWh captured</span>
              <span className="v">
                <CountUpNumber value={model.cur.freeKwh} format={value => kwh(value, 0)} durationMs={720} />
              </span>
              <span className="c" aria-hidden="true">
                ›
              </span>
            </button>
            <button className="cv-row" type="button" onClick={() => navigate('/cost-anatomy')}>
              <span className="k">Paid overflow</span>
              <span className="v">
                <CountUpNumber value={Math.max(0, model.cur.kwh - model.cur.freeKwh)} format={value => kwh(value, 0)} durationMs={720} />
              </span>
              <span className="c" aria-hidden="true">
                ›
              </span>
            </button>
            <button className="cv-row" type="button" onClick={() => setView('overview')}>
              <span className="k">Free streak</span>
              <span className="v">
                <CountUpNumber value={r.currentStreak} format={value => Math.round(value).toLocaleString('en-AU')} durationMs={720} />
              </span>
              <span className="c" aria-hidden="true">
                ›
              </span>
            </button>
          </div>
        </>
      ) : (
        <>
          <CanvasStatsHeader
            title="Networks"
            value={model.bestProvider?.name ?? '—'}
            ctx={
              model.bestProvider
                ? `Best effective rate: ${perKwh(model.bestProvider.cost, model.bestProvider.kwh)}/kWh.`
                : 'Add charges to compare networks.'
            }
            onBack={back}
          />
          <GlassSegmented
            ariaLabel="Provider metric"
            value={providerMetric}
            onChange={setProviderMetric}
            style={{ marginTop: 26 }}
            options={[
              { value: 'cost', label: 'Cost' },
              { value: 'kwh', label: 'kWh' },
              { value: 'free', label: 'Free' },
            ]}
          />
          <div className="cv-providers">
            {ev.byProvider.slice(0, 4).map(p => {
              const provider = ev.providers.find(x => x.name === p.name)
              const color = provider?.color ?? 'var(--steel)'
              const providerValue = providerMetric === 'cost' ? p.cost : providerMetric === 'kwh' ? p.kwh : p.freeKwh
              const width = Math.max(7, (providerValue / providerMaxValue) * 100)
              return (
                <button
                  className="cv-provider"
                  key={p.name}
                  type="button"
                  onClick={() => navigate(`/accounts/${encodeURIComponent(p.name)}`)}
                  style={{ ['--pc' as string]: color, ['--w' as string]: `${width}%` }}
                >
                  <Mark provider={provider} name={p.name} />
                  <span>
                    <strong>{p.name}</strong>
                    <small>
                      {providerMetric === 'cost' ? (
                        <>
                          <CountUpNumber value={p.kwh > 0 ? p.cost / p.kwh : 0} format={value => `$${value.toFixed(2)}`} durationMs={650} /> effective
                        </>
                      ) : providerMetric === 'kwh' ? (
                        <>
                          <CountUpNumber value={p.cost} format={aud} durationMs={650} /> lifetime spend
                        </>
                      ) : provider?.freeKwhPerDay ? (
                        <>
                          <CountUpNumber value={provider.freeKwhPerDay} format={value => kwh(value, 1)} durationMs={650} /> kWh/day allowance
                        </>
                      ) : (
                        <>
                          no allowance set
                        </>
                      )}
                    </small>
                    <i />
                  </span>
                  <b>
                    <CountUpNumber
                      value={providerValue}
                      format={value => (providerMetric === 'cost' ? aud(value) : `${kwh(value, 0)} kWh`)}
                      durationMs={720}
                    />
                  </b>
                </button>
              )
            })}
          </div>
        </>
      )}
    </main>
  )
}

function CanvasStatsHeader({ title, value, ctx, onBack }: { title: string; value: ReactNode; ctx: string; onBack: () => void }) {
  return (
    <>
      <header className="appbar">
        <div>
          <p className="cv-eyebrow">{title}</p>
          <h1 className="cv-big">{value}</h1>
        </div>
        <button className="icon-btn" type="button" aria-label="Back to stats overview" onClick={onBack}>
          <Icon name="back" />
        </button>
      </header>
      <p className="cv-ctx">
        {ctx} <em>Tap rows for the full view.</em>
      </p>
    </>
  )
}

function CanvasTrend({ values, kind }: { values: number[]; kind: 'rate' | 'free' }) {
  const clipId = `cvTrendClip-${useId().replace(/:/g, '')}`
  const pathRef = useRef<SVGPathElement>(null)
  const clipRef = useRef<SVGRectElement>(null)
  const dotRef = useRef<HTMLSpanElement>(null)
  const normalized = values.length > 0 ? values : [0]
  const max = Math.max(...normalized, 0.01)
  const min = Math.min(...normalized, max)
  const range = Math.max(0.01, max - min)
  const pts = normalized.map((v, i) => {
    const x = normalized.length === 1 ? 50 : (i / (normalized.length - 1)) * 100
    const y = 82 - ((v - min) / range) * 54
    return { x, y }
  })
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')
  const area = `${line} L 100 100 L 0 100 Z`

  useEffect(() => {
    const path = pathRef.current
    const clip = clipRef.current
    const dot = dotRef.current
    if (!path || !clip || !dot) return

    const length = path.getTotalLength()
    const reduceMotion =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const setProgress = (progress: number) => {
      const point = path.getPointAtLength(length * progress)
      clip.setAttribute('width', String(Math.min(100, Math.max(0, point.x))))
      dot.style.left = `${point.x.toFixed(2)}%`
      dot.style.top = `${point.y.toFixed(2)}%`
    }

    if (reduceMotion) {
      setProgress(1)
      return
    }

    setProgress(0)
    const duration = 1350
    const ease = (t: number) => 1 - Math.pow(1 - t, 3)
    let id = 0
    const start = performance.now()

    const tick = (now: number) => {
      const raw = Math.min(1, (now - start) / duration)
      setProgress(ease(raw))
      if (raw < 1) id = requestAnimationFrame(tick)
    }

    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [line])

  return (
    <div className={`cv-trend ${kind}`}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label={kind === 'rate' ? 'Rate trend' : 'Free energy trend'}>
        <defs>
          <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
            <rect ref={clipRef} className="line-clip" x="0" y="0" width="0" height="100" />
          </clipPath>
        </defs>
        <path className="area" d={area} />
        <path ref={pathRef} className="line" d={line} clipPath={`url(#${clipId})`} />
      </svg>
      <span ref={dotRef} className="dot" style={{ left: `${pts[0].x}%`, top: `${pts[0].y}%` }} />
    </div>
  )
}

function ClassicAnalytics() {
  const ev = useEv()
  const navigate = useNavigate()
  const [view, setView] = useState<View>('cluster')

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
      return { month: m.month, label: m.label.split(' ')[0], cost: o.cost, kwh: o.kwh, value }
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
      <GlassSegmented
        ariaLabel="Select year"
        value={activeYear}
        onChange={setYear}
        options={years.map(y => ({ value: y, label: y }))}
      />

      <section className="hero-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <div>
            <span className="cap">Spent · {activeYear}</span>
            <div className="hero-num">
              <CountUpNumber value={tot.cost} format={aud} durationMs={860} />
            </div>
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
              <div className="num">
                <CountUpNumber value={m.kwh} format={kwh} durationMs={640} />
              </div>
              <div className="num">
                <CountUpNumber value={m.cost} format={aud} durationMs={640} />
              </div>
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
          <div className="num">
            <CountUpNumber value={tot.kwh} format={kwh} durationMs={760} />
          </div>
          <div className="num">
            <CountUpNumber value={tot.cost} format={aud} durationMs={760} />
          </div>
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
      label = `${m.label.split(' ')[0]} ${String(y).slice(2)}`
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
  series: (provider: string, metric: Metric) => { month: string; label: string; cost: number; kwh: number; value: number }[]
  navigate: (to: string) => void
}) {
  const [gran, setGran] = useState<Gran>('year')
  const [metric, setMetric] = useState<'cost' | 'kwh'>('cost')
  const [sel, setSel] = useState<string | null>(null)

  const bk = bucketize(ev.months, gran)
  const cur = bk[bk.length - 1]
  const prev = bk[bk.length - 2]
  const dCost = prev ? pct(cur.cost, prev.cost) : null
  const dKwh = prev ? pct(cur.kwh, prev.kwh) : null
  const priciest = bk.reduce((a, b) => (b.cost > a.cost ? b : a), bk[0])

  const rolling = useUnitRoll(metric)

  const bars = series('All', metric).slice(-6)
  const max = Math.max(...bars.map(b => b.value), 0.01)
  const barLabel = (b: (typeof bars)[number], m: 'cost' | 'kwh') => (m === 'cost' ? aud(b.cost, 0) : `${kwh(b.kwh)} kWh`)
  const selectedValue = (b: (typeof bars)[number]) => barLabel(b, metric)
  const otherValue = (b: (typeof bars)[number]) => barLabel(b, metric === 'cost' ? 'kwh' : 'cost')
  const rateValue = cur.kwh > 0 ? cur.cost / cur.kwh : 0

  return (
    <>
      <GlassSegmented
        ariaLabel="Granularity"
        value={gran}
        onChange={setGran}
        options={(['year', 'quarter', 'month'] as Gran[]).map(g => ({ value: g, label: g[0].toUpperCase() + g.slice(1) }))}
      />

      <div className="metric-grid" key={gran}>
        <div className="metric-card">
          <span>Total cost</span>
          <strong>
            <CountUpNumber value={cur.cost} format={aud} delayMs={80} durationMs={850} />
          </strong>
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
          <strong>
            <CountUpNumber value={cur.kwh} format={value => `${kwh(value)} kWh`} delayMs={180} durationMs={850} />
          </strong>
          {dKwh != null ? (
            <small>
              {dKwh > 0 ? '▲' : '▼'} {Math.abs(dKwh).toFixed(0)}% vs {prev.label}
            </small>
          ) : (
            <small>{cur.label}</small>
          )}
        </div>
        <button className="metric-card tappable" type="button" onClick={() => navigate('/cost-anatomy')}>
          <span>
            Avg rate <Icon name="chev" size={12} />
          </span>
          <strong>
            <CountUpNumber value={rateValue} format={value => `$${value.toFixed(2)}`} delayMs={280} durationMs={850} />
          </strong>
          <small>per kWh · see the split</small>
        </button>
        <div className="metric-card">
          <span>Charges</span>
          <strong>
            <CountUpNumber value={cur.sessions} format={value => Math.round(value).toLocaleString('en-AU')} delayMs={380} durationMs={850} />
          </strong>
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
        <div className="bars show-values">
          {bars.map((b, i) => (
            <button
              key={b.month}
              type="button"
              className={`b ${i === bars.length - 1 ? 'hi' : ''} ${sel === b.month ? 'show' : ''} ${rolling ? 'rolling' : ''}`}
              data-v={selectedValue(b)}
              data-prev={otherValue(b)}
              style={{ height: `${Math.max(6, (b.value / max) * 100)}%`, ['--i' as string]: i }}
              aria-label={`${b.label}: ${selectedValue(b)}`}
              onClick={() => setSel(sel === b.month ? null : b.month)}
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
          <button type="button" className="text-btn" onClick={() => navigate('/analytics/chart')}>
            Open 12-month detail ›
          </button>
        </div>
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

      <YoyCard ev={ev} />
    </>
  )
}

/* ============ SAME-MONTH YEAR ON YEAR ============ */
function YoyCard({ ev }: { ev: ReturnType<typeof useEv> }) {
  const y = useMemo(() => yearOnYear(ev.months), [ev.months])
  if (!y.hasPair) return null

  const scale = Math.max(...y.months.flatMap(m => [m.prevEnergy, m.curEnergy]), 0.01)
  const down = y.energyDeltaPct != null && y.energyDeltaPct < 0

  return (
    <section className="chart-card" style={{ marginTop: 10 }}>
      <h4>
        <span>Same month, year on year</span>
        <em>energy only</em>
      </h4>

      <div className="yoy">
        {y.months.map(m => (
          <div className="yoyrow" key={m.mm}>
            <span className="ym">{m.label}</span>
            <div className="ybars">
              <div className="yline">
                <span className="yt">
                  <i className="prev" style={{ width: `${Math.max(3, (m.prevEnergy / scale) * 100)}%` }} />
                </span>
                <b>
                  <em>{y.prevYear}</em> {aud(m.prevEnergy)}
                </b>
              </div>
              <div className="yline">
                <span className="yt">
                  <i className="cur" style={{ width: `${Math.max(3, (m.curEnergy / scale) * 100)}%` }} />
                </span>
                <b>
                  <em>{y.curYear}</em> {aud(m.curEnergy)}
                </b>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="yoysum">
        <div className="ys">
          <span>Energy · {y.months.length} matching months</span>
          <b className={down ? 'pos' : 'negd'}>
            {y.energyDeltaPct != null
              ? `${y.energyDeltaPct > 0 ? '▲' : '▼'} ${Math.abs(y.energyDeltaPct).toFixed(0)}%`
              : '—'}
          </b>
        </div>
        <div className="ys">
          <span>
            Membership fees {y.prevFees === 0 ? `(new in ${y.curYear})` : ''}
          </span>
          <b className={y.feeDelta > 0 ? 'negd' : ''}>
            {aud(y.prevFees, 0)} → {aud(y.curFees, 0)}
          </b>
        </div>
      </div>

      <p className="yoynote">
        <b>Energy only.</b> These bars exclude membership fees — {aud(y.curFees, 0)} across these {y.months.length}{' '}
        months
        {y.prevFees === 0 ? `, none in ${y.prevYear}` : ` vs ${aud(y.prevFees, 0)} in ${y.prevYear}`}. Only months that
        exist in both years are compared, so a part-year never skews it.
        {down && y.feeDelta > 0 && (
          <>
            {' '}
            The year total at the top of this page counts those fees, which is why it reads as a rise while your actual
            energy cost <b>fell {Math.abs(y.energyDeltaPct!).toFixed(0)}%</b>.
          </>
        )}
      </p>
    </section>
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
  const [selIdx, setSelIdx] = useState<number | null>(null)
  const provNames = ['All', ...ev.byProvider.map(p => p.name)]
  const reduceMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  const data = series(prov, metric).slice(-6)
  const n = data.length
  const max = Math.max(...data.map(d => d.value), 1e-6)
  const xAt = (i: number) => (n > 1 ? (i / (n - 1)) * 300 : 150)
  const yAt = (v: number) => 128 - (v / max) * 108
  const d = data.map((p, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)} ${yAt(p.value).toFixed(1)}`).join(' ')
  const areaD = n > 0 ? `${d} L${xAt(n - 1).toFixed(1)} 148 L${xAt(0).toFixed(1)} 148 Z` : ''
  const chartKey = `${prov}-${metric}-${data.map(p => p.month).join('-')}`
  const fmt = (v: number) => (metric === 'cost' ? aud(v) : metric === 'kwh' ? `${kwh(v)} kWh` : '$' + v.toFixed(3))
  const activeIdx = selIdx == null ? n - 1 : selIdx
  const sp = data[activeIdx]
  const activeD = data
    .slice(0, activeIdx + 1)
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)} ${yAt(p.value).toFixed(1)}`)
    .join(' ')
  const flagLeft = Math.min(90, Math.max(10, (n > 1 ? activeIdx / (n - 1) : 0.5) * 100))

  const top = ev.byProvider[0]
  const share = ev.lifetime.kwh > 0 && top ? (top.kwh / ev.lifetime.kwh) * 100 : 0
  const priciest = ev.months.reduce((a, m) => (m.cost > a.cost ? m : a), ev.months[0])
  const lifeRate = perKwh(ev.lifetime.cost, ev.lifetime.kwh)

  return (
    <>
      <GlassSegmented
        ariaLabel="Metric"
        value={metric}
        onChange={setMetric}
        options={(['cost', 'kwh', 'rate'] as Metric[]).map(mt => ({
          value: mt,
          label: mt === 'cost' ? 'Cost' : mt === 'kwh' ? 'kWh' : '$/kWh',
        }))}
      />

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

      <section className="chart-card" style={{ paddingTop: 22 }}>
        <div className="scrub">
          {sp && (
            <div className="flag" style={{ left: `${flagLeft}%`, top: 8 }}>
              {sp.label} · {fmt(sp.value)}
            </div>
          )}
          <svg key={chartKey} viewBox="0 0 300 148" preserveAspectRatio="none">
            <line className="gl" x1="0" y1="38" x2="300" y2="38" />
            <line className="gl" x1="0" y1="94" x2="300" y2="94" />
            {areaD && <path className="area" d={areaD} />}
            <path className="ln" d={d} pathLength={1} />
            {data.map((p, i) => (
              <circle
                key={p.month}
                cx={xAt(i)}
                cy={yAt(p.value)}
                r="12"
                fill="transparent"
                style={{ cursor: 'pointer', pointerEvents: 'all' }}
                onClick={() => setSelIdx(i)}
              />
            ))}
            {sp &&
              (activeIdx > 0 && !reduceMotion ? (
                <circle key={`${chartKey}-${activeIdx}`} className="dot travel-dot" r="5">
                  <animateMotion
                    dur="900ms"
                    fill="freeze"
                    path={activeD}
                    calcMode="spline"
                    keyTimes="0;1"
                    keySplines="0.35 0.8 0.25 1"
                  />
                </circle>
              ) : (
                <circle className="dot" cx={xAt(activeIdx)} cy={yAt(sp.value)} r="5" />
              ))}
          </svg>
        </div>
        <div className="yaxis">
          {data.map((p, i) => (
            <span key={p.month} style={i === activeIdx ? { color: 'var(--tx)' } : undefined}>
              {p.label}
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
          <button type="button" className="text-btn" onClick={() => navigate('/analytics/chart')}>
            Open 12-month detail ›
          </button>
        </div>
      </section>

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
  const [sel, setSel] = useState<string | null>(null)
  const byCost = ev.byProvider.filter(p => p.cost > 0)
  const totalCost = byCost.reduce((a, p) => a + p.cost, 0)
  const donutSegments = byCost.reduce<Array<(typeof byCost)[number] & { pct: number; offset: number }>>(
    (segments, p) => {
      const pct = totalCost > 0 ? (p.cost / totalCost) * 100 : 0
      const offset = segments.reduce((sum, segment) => sum + segment.pct, 0)
      return [...segments, { ...p, pct, offset }]
    },
    [],
  )

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
            className="donut donut-animated"
            role="img"
            aria-label="Cost split by network"
          >
            <svg viewBox="0 0 100 100" aria-hidden="true">
              {donutSegments.map((p, i) => (
                <circle
                  key={p.name}
                  className="donutseg"
                  cx="50"
                  cy="50"
                  r="40"
                  pathLength="100"
                  style={{
                    stroke: provColor(p.name),
                    strokeDasharray: `${p.pct} ${100 - p.pct}`,
                    strokeDashoffset: -p.offset,
                    animationDelay: `${i * 80}ms`,
                  }}
                />
              ))}
            </svg>
            <div className="din">
              <b>
                <CountUpNumber value={totalCost} format={value => aud(value, 0)} durationMs={920} />
              </b>
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
        {byKwh.map((p, i) => (
          <div className="rrow" key={p.name} style={{ ['--pc' as string]: provColor(p.name) }}>
            <div className="rl2">
              <b>{p.name}</b>
              <span>
                <CountUpNumber value={p.kwh} format={kwh} delayMs={i * 90} durationMs={760} /> kWh
              </span>
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
              <button
                type="button"
                className={`col ${sel === m.month ? 'show' : ''}`}
                key={m.month}
                data-v={`${kwh(m.freeKwh)} free · ${kwh(paid)} paid`}
                aria-label={`${m.label.split(' ')[0]}: ${kwh(m.freeKwh)} kWh free, ${kwh(paid)} kWh paid`}
                onClick={() => setSel(sel === m.month ? null : m.month)}
              >
                <i className="paid" style={{ height: `${(paid / maxTot) * 100}%` }} />
                <i className="free" style={{ height: `${(m.freeKwh / maxTot) * 100}%` }} />
              </button>
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
        <button type="button" className="on compare-year-accent" style={{ background: 'var(--money)' }}>
          {B}
        </button>
      </div>

      <section className="hero-card">
        <div className="cmp-metric">Total cost</div>
        <div className="cmp">
          <div className="side">
            <div className="v">
              <CountUpNumber value={a.cost} format={value => aud(value, 0)} durationMs={860} />
            </div>
            <div className="l">{A}</div>
          </div>
          <div className="mid">{delta(b.cost, a.cost)}</div>
          <div className="side">
            <div className="v" style={{ color: 'var(--money-deep)' }}>
              <CountUpNumber value={b.cost} format={value => aud(value, 0)} durationMs={860} />
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
            <div className="v">
              <CountUpNumber value={a.kwh} format={kwh} durationMs={860} />
            </div>
            <div className="l">kWh {A}</div>
          </div>
          <div className="mid">{delta(b.kwh, a.kwh)}</div>
          <div className="side">
            <div className="v">
              <CountUpNumber value={b.kwh} format={kwh} durationMs={860} />
            </div>
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
            <div className="v">
              <CountUpNumber value={rateA} format={value => `$${value.toFixed(2)}`} durationMs={860} />
            </div>
            <div className="l">{A}</div>
          </div>
          <div className="mid">
            {arrow(rateB, rateA)}
            {rateB > rateA ? 'higher' : 'lower'}
          </div>
          <div className="side">
            <div className="v">
              <CountUpNumber value={rateB} format={value => `$${value.toFixed(2)}`} durationMs={860} />
            </div>
            <div className="l">{B}</div>
          </div>
        </div>
        <div className="cmpbar">
          <i className="b" style={{ width: `${rA}%` }} />
          <i className="a" style={{ width: `${rB}%` }} />
        </div>
      </section>

      <div className="metric-grid compare-support" style={{ marginBottom: 0 }}>
        <div className="metric-card">
          <span>Charges</span>
          <strong>
            <CountUpNumber value={a.sessions} format={value => Math.round(value).toLocaleString('en-AU')} durationMs={720} /> →{' '}
            <CountUpNumber value={b.sessions} format={value => Math.round(value).toLocaleString('en-AU')} delayMs={120} durationMs={720} />
          </strong>
          <small>
            {A} → {B}
          </small>
        </div>
        <div className="metric-card">
          <span>Free saved</span>
          <strong>
            <CountUpNumber value={a.saved - a.fees} format={value => aud(value, 0)} durationMs={720} /> →{' '}
            <CountUpNumber value={b.saved - b.fees} format={value => aud(value, 0)} delayMs={120} durationMs={720} />
          </strong>
          <small className="pos">net free energy</small>
        </div>
      </div>
    </>
  )
}
