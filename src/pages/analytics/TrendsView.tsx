import { useReducedMotion } from '../../lib/useReducedMotion'
import { useState } from 'react'
import type { EvData } from '../../lib/useEv'
import { aud, kwh } from '../../lib/format'
import GlassSegmented from '../../components/GlassSegmented'
import type { Metric } from './types'
import { perKwh, shortProv } from './format'

export default function TrendsView({
  ev,
  series,
  provColor,
  navigate,
}: {
  ev: EvData
  series: (provider: string, metric: Metric) => { month: string; label: string; value: number }[]
  provColor: (name: string) => string
  navigate: (to: string) => void
}) {
  const [metric, setMetric] = useState<Metric>('cost')
  const [prov, setProv] = useState('All')
  const [selIdx, setSelIdx] = useState<number | null>(null)
  const provNames = ['All', ...ev.byProvider.map(p => p.name)]
  const reduceMotion = useReducedMotion()

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
            aria-pressed={prov === name}
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
                role="button" tabIndex={0} aria-label={`${p.label}: ${fmt(p.value)}`} aria-pressed={activeIdx === i}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelIdx(i) }
                  else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft' || event.key === 'Home' || event.key === 'End') {
                    event.preventDefault()
                    const next = event.key === 'Home' ? 0 : event.key === 'End' ? n - 1 : Math.max(0, Math.min(n - 1, i + (event.key === 'ArrowRight' ? 1 : -1)))
                    setSelIdx(next)
                    const circles = event.currentTarget.parentElement?.querySelectorAll<SVGCircleElement>('circle[role="button"]')
                    circles?.[next]?.focus()
                  }
                }}
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
