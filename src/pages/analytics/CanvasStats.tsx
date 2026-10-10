import { useReducedMotion } from '../../lib/useReducedMotion'
import { providerAccountPath } from '../../lib/accountRoutes'
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEv } from '../../lib/useEv'
import { aud, kwh } from '../../lib/format'
import { Icon, Mark } from '../../components/ui'
import { yearOnYear } from '../../lib/yearOnYear'
import { useRecords } from '../../lib/useRecords'
import CountUpNumber from '../../components/CountUpNumber'
import GlassSegmented from '../../components/GlassSegmented'
import { perKwh } from './format'

type CanvasStatsView = 'overview' | 'energy' | 'free' | 'providers'
type ProviderMetric = 'cost' | 'kwh' | 'free'

export default function CanvasStats() {
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
    const months = ev.months.filter(m => m.month.startsWith(activeYear))
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
    const rateNow = cur.kwh > 0 ? cur.cost / cur.kwh : 0
    const comparison = yearOnYear(ev.months, activeYear)
    const ratePrev = comparison.prevKwh > 0 ? (comparison.prevEnergy + comparison.prevFees) / comparison.prevKwh : 0
    const comparableRate = comparison.curKwh > 0 ? (comparison.curEnergy + comparison.curFees) / comparison.curKwh : null
    const rateDelta = comparableRate !== null && ratePrev > 0 ? ((comparableRate - ratePrev) / ratePrev) * 100 : null
    const freePct = cur.kwh > 0 ? Math.round((cur.freeKwh / cur.kwh) * 100) : 0
    const avgMonth = months.length > 0 ? cur.kwh / months.length : 0
    const largestMonth = months.reduce((max, m) => Math.max(max, m.kwh), 0)
    const bestProvider =
      ev.byProvider
        .filter(p => p.kwh > 0)
        .slice()
        .sort((a, b) => a.effectiveRate - b.effectiveRate)[0] ?? ev.byProvider[0]
    return { activeYear, months, cur, rateNow, rateDelta, freePct, avgMonth, largestMonth, bestProvider }
  }, [ev, years])

  const rates = model.months.map(m => (m.kwh > 0 ? m.cost / m.kwh : 0))
  const energyBars = model.months.slice(-8)
  const maxEnergy = Math.max(...energyBars.map(m => m.kwh), 1)
  const freeTrend = model.months.map(m => (m.kwh > 0 ? (m.freeKwh / m.kwh) * 100 : 0))
  const r = useRecords(ev)
  const providerMaxValue = Math.max(
    ...ev.byProvider.map(p => (providerMetric === 'cost' ? p.cost : providerMetric === 'kwh' ? p.kwh : p.freeKwh)),
    0.01,
  )

  const back = () => setView('overview')
  const deltaText =
    model.rateDelta == null
      ? 'Building trend.'
      : `${model.rateDelta > 0 ? 'Up' : 'Down'} ${Math.abs(model.rateDelta).toFixed(0)}% across matching completed months last year.`

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
              <span>Average recorded month</span>
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
                  onClick={() => navigate(providerAccountPath(p.name, ev.providers))}
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

  const reduceMotion = useReducedMotion()

  useEffect(() => {
    const path = pathRef.current
    const clip = clipRef.current
    const dot = dotRef.current
    if (!path || !clip || !dot) return

    const length = path.getTotalLength()

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
  }, [line, reduceMotion])

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
