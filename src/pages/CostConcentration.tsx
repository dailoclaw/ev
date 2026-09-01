import { useId, useMemo, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import GlassSegmented from '../components/GlassSegmented'
import { Icon, Mark } from '../components/ui'
import { costConcentration, type CostConcentrationMode } from '../lib/costConcentration'
import { aud, kwh, longDate, rate } from '../lib/format'
import { useEv } from '../lib/useEv'

const plot = { left: 34, right: 342, top: 18, bottom: 190 }
const xFor = (pct: number) => plot.left + (pct / 100) * (plot.right - plot.left)
const yFor = (pct: number) => plot.bottom - (pct / 100) * (plot.bottom - plot.top)

export default function CostConcentration() {
  const ev = useEv()
  const navigate = useNavigate()
  const gradientId = useId().replace(/:/g, '')
  const [mode, setMode] = useState<CostConcentrationMode>('all')
  const [provider, setProvider] = useState(() => ev.byProvider.find(item => item.kwh > 0)?.name ?? '')
  const [threshold, setThreshold] = useState(88)
  const [showCharges, setShowCharges] = useState(false)

  const providerNames = useMemo(
    () => ev.byProvider.filter(item => item.kwh > 0).map(item => item.name),
    [ev.byProvider],
  )
  const activeProvider = providerNames.includes(provider) ? provider : providerNames[0] ?? ''
  const model = useMemo(
    () => costConcentration(ev.sessions, mode, mode === 'provider' ? activeProvider : null, threshold),
    [activeProvider, ev.sessions, mode, threshold],
  )

  const path = model.points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${xFor(point.energyPct).toFixed(2)} ${yFor(point.costPct).toFixed(2)}`)
    .join(' ')
  const area = path ? `${path} L ${plot.right} ${plot.bottom} L ${plot.left} ${plot.bottom} Z` : ''
  const thresholdX = xFor(threshold)
  const thresholdY = yFor(100 - model.tailCostPct)
  const tailEnergy = Math.round(model.tailEnergyPct)
  const tailCost = Math.round(model.tailCostPct)
  const titleScope = mode === 'paid' ? 'Paid energy' : mode === 'provider' ? activeProvider : 'All energy'
  const hasCurve = model.totalKwh > 0 && model.totalCost > 0
  const updateThresholdFromPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const left = rect.left + rect.width * (plot.left / 360)
    const right = rect.left + rect.width * (plot.right / 360)
    const next = 55 + ((event.clientX - left) / Math.max(1, right - left)) * 40
    setThreshold(Math.round(Math.min(95, Math.max(55, next))))
  }

  return (
    <main className="app-shell cost-concentration-page">
      <header className="appbar">
        <div>
          <p className="eyebrow">Analytics · Cost tail</p>
          <h1>Cost concentration</h1>
          <span className="sub">
            {titleScope} · {kwh(model.totalKwh)} kWh · {model.energySessions} charge
            {model.energySessions === 1 ? '' : 's'}
          </span>
        </div>
        <button
          className="icon-btn"
          type="button"
          aria-label="Back to Split"
          onClick={() => navigate('/analytics', { state: { view: 'split' } })}
        >
          <Icon name="back" />
        </button>
      </header>

      <GlassSegmented
        ariaLabel="Cost concentration scope"
        value={mode}
        onChange={next => {
          setMode(next)
          setShowCharges(false)
        }}
        options={[
          { value: 'all', label: 'All energy' },
          { value: 'paid', label: 'Paid only' },
          { value: 'provider', label: 'Provider', disabled: providerNames.length === 0 },
        ]}
      />

      {mode === 'provider' && (
        <div className="chiprow cc-provider-row" aria-label="Choose provider">
          {providerNames.map(name => {
            const colour = ev.providers.find(item => item.name === name)?.color ?? 'var(--money)'
            return (
              <button
                key={name}
                type="button"
                className={`chip ${activeProvider === name ? 'on' : ''}`}
                style={{ ['--pc' as string]: colour }}
                onClick={() => {
                  setProvider(name)
                  setShowCharges(false)
                }}
              >
                <i className="dt" />
                {name}
              </button>
            )
          })}
        </div>
      )}

      {!hasCurve ? (
        <div className="emptybat">
          <div className="batt">
            <i />
          </div>
          <b>No cost curve yet</b>
          <p>This view needs at least one energy charge with a cost.</p>
        </div>
      ) : (
        <>
          <section className="hero-card cc-curve-card">
            <div className="cc-card-head">
              <div>
                <span className="cap">Where spend concentrates</span>
                <strong className="cc-headline">
                  {tailEnergy}% <span>→</span> {tailCost}%
                </strong>
                <p className="hero-sub">Highest-rate energy → variable charging spend</p>
              </div>
              <span className="delta">Live ledger</span>
            </div>

            <div
              className="cc-chart"
              style={{ ['--cc-threshold' as string]: `${threshold}%` }}
              onPointerDown={event => {
                event.currentTarget.setPointerCapture(event.pointerId)
                updateThresholdFromPointer(event)
              }}
              onPointerMove={event => {
                if (event.currentTarget.hasPointerCapture(event.pointerId)) updateThresholdFromPointer(event)
              }}
              onPointerUp={event => event.currentTarget.releasePointerCapture(event.pointerId)}
            >
              <svg viewBox="0 0 360 226" role="img" aria-label={`The highest-rate ${tailEnergy}% of energy accounts for ${tailCost}% of spend`}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="var(--money)" stopOpacity=".22" />
                    <stop offset="1" stopColor="var(--money)" stopOpacity=".02" />
                  </linearGradient>
                </defs>
                <g className="cc-grid">
                  <path d={`M${plot.left} ${plot.top}V${plot.bottom}H${plot.right}`} />
                  <path d={`M${plot.left} ${yFor(25)}H${plot.right}`} />
                  <path d={`M${plot.left} ${yFor(50)}H${plot.right}`} />
                  <path d={`M${plot.left} ${yFor(75)}H${plot.right}`} />
                </g>
                <path className="cc-equality" d={`M${plot.left} ${plot.bottom}L${plot.right} ${plot.top}`} />
                <rect
                  className="cc-tail-zone"
                  x={thresholdX}
                  y={plot.top}
                  width={plot.right - thresholdX}
                  height={plot.bottom - plot.top}
                  rx="5"
                />
                <path className="cc-area" d={area} fill={`url(#${gradientId})`} />
                <path className="cc-line" d={path} pathLength="1" />
                <path className="cc-threshold-line" d={`M${thresholdX} ${plot.top}V${plot.bottom}`} />
                <path className="cc-threshold-mark" d={`M${thresholdX - 6} ${thresholdY}H${thresholdX + 6}`} />
                <g className="cc-axis-labels">
                  <text x="6" y={plot.bottom + 3}>0</text>
                  <text x="3" y={yFor(50) + 3}>50%</text>
                  <text x="0" y={plot.top + 3}>100%</text>
                  <text x={plot.left - 2} y="210">0</text>
                  <text x={xFor(50) - 10} y="210">50%</text>
                  <text x={plot.right - 23} y="210">100%</text>
                </g>
              </svg>

              <input
                className="cc-scrubber"
                type="range"
                min="55"
                max="95"
                step="1"
                value={threshold}
                aria-label="Choose the start of the expensive energy tail"
                aria-valuetext={`Highest-rate ${tailEnergy}% of energy`}
                onInput={event => setThreshold(Number(event.currentTarget.value))}
                onChange={event => setThreshold(Number(event.target.value))}
              />

              <div className="cc-tail-card" aria-hidden="true">
                <span>Expensive tail</span>
                <strong>{tailEnergy}% energy</strong>
                <b>{tailCost}% of spend</b>
              </div>
            </div>

            <div className="cc-axis-foot">
              <span>↑ Cumulative cost</span>
              <span>Cumulative energy →</span>
            </div>
            <p className="cc-note">Drag the vertical rail to change how much of the highest-rate energy is isolated.</p>
          </section>

          <section className="cc-insight">
            <span><Icon name="chart" size={16} /></span>
            <div>
              <strong>The last sliver of energy can dominate the bill.</strong>
              <p>
                The costliest {tailEnergy}% of this energy accounts for {tailCost}% of its charging spend.
              </p>
            </div>
          </section>

          <section className="hero-card cc-explain">
            <div>
              <span className="cap">Curve answers</span>
              <strong>Which kWh?</strong>
              <p>Ranks energy from free to highest effective rate.</p>
            </div>
            <span className="cc-explain-arrow">→</span>
            <div>
              <span className="cap">Then reveals</span>
              <strong>Which charges?</strong>
              <p>Opens the exact provider and date rows behind the tail.</p>
            </div>
          </section>

          <button
            className="cc-contributors-toggle"
            type="button"
            aria-expanded={showCharges}
            onClick={() => setShowCharges(value => !value)}
          >
            <span>{showCharges ? 'Hide contributing charges' : `View ${model.tailSessions.length} contributing charges`}</span>
            <Icon name="chev" size={17} />
          </button>

          {showCharges && (
            <section className="cc-contributors" aria-label="Charges in the expensive tail">
              {model.tailSessions.slice(0, 8).map(session => {
                const providerDetails = ev.providers.find(item => item.name === session.type)
                const billedRate = session.paidKwh > 0 ? session.cost / session.paidKwh : session.rate
                return (
                  <button
                    type="button"
                    className="row"
                    key={session.id}
                    onClick={() => navigate('/statement', { state: { month: session.date.slice(0, 7) } })}
                  >
                    <Mark provider={providerDetails} name={session.type} />
                    <span className="rmain">
                      <strong>{session.type}</strong>
                      <small>{longDate(session.date)} · {kwh(session.amount)} kWh · {rate(billedRate)}/kWh</small>
                    </span>
                    <b className="amt">{aud(session.cost)}</b>
                  </button>
                )
              })}
              {model.tailSessions.length > 8 && (
                <p className="cc-more">Showing the 8 highest-rate charges of {model.tailSessions.length}.</p>
              )}
            </section>
          )}
        </>
      )}

      <footer className="app-footer">EV Command · Cost concentration</footer>
    </main>
  )
}
