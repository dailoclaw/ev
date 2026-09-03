import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEv } from '../lib/useEv'
import { allowanceUsedOn } from '../lib/savings'
import { aud, kwh, rate, thisMonth, todayIso } from '../lib/format'
import { Bars, Icon, Ring } from '../components/ui'
import Explainable from '../components/Explainable'
import { deriveNetBenefit } from '../lib/derive'
import CountUpNumber from '../components/CountUpNumber'
import StyleVariant from '../components/StyleVariant'

type CanvasSavingsView = 'overview' | 'math' | 'allowance' | 'months'

export default function Savings() {
  return <StyleVariant classic={ClassicSavings} minimal={CanvasSavings} />
}

function CanvasSavings() {
  const navigate = useNavigate()
  const ev = useEv()
  const [view, setView] = useState<CanvasSavingsView>('overview')
  const freeProvider = ev.providers.find(p => p.freeKwhPerDay > 0)
  const usedToday = freeProvider ? allowanceUsedOn(ev.sessions, freeProvider.name, todayIso()) : 0
  const allowance = freeProvider?.freeKwhPerDay ?? 0
  const leftToday = Math.max(0, allowance - usedToday)
  const last6 = ev.months.slice(-6)
  const averageSaved = last6.length > 0 ? last6.reduce((sum, month) => sum + month.saved, 0) / last6.length : 0
  const currentSaved = ev.months.find(month => month.month === thisMonth())?.saved ?? 0

  const cumulative = useMemo(() => {
    const visible = ev.months.slice(-12)
    const hidden = ev.months.slice(0, Math.max(0, ev.months.length - visible.length))
    const openingValue = hidden.reduce((sum, month) => sum + month.saved, 0)
    return visible.map((month, index) => ({
      label: month.label,
      value: openingValue + visible.slice(0, index + 1).reduce((sum, item) => sum + item.saved, 0),
    }))
  }, [ev.months])

  const back = () => setView('overview')

  return (
    <main className="app-shell cv cv-savings">
      {view === 'overview' ? (
        <>
          <CanvasSavingsHeader
            title="Lifetime, net"
            value={
              <Explainable derive={() => deriveNetBenefit(ev)} label="Lifetime net benefit">
                <CountUpNumber value={ev.lifetime.netSaved} format={aud} durationMs={850} />
              </Explainable>
            }
            ctx={
              ev.lifetime.fees > 0
                ? `${kwh(ev.lifetime.freeKwh)} kWh free. Membership fees already deducted.`
                : `${kwh(ev.lifetime.freeKwh)} kWh captured as free energy.`
            }
            onBack={() => navigate(-1)}
            backLabel="Back"
          />

          <CanvasSavingsWave data={cumulative} />

          <div className="cv-rows">
            <button className="cv-row" type="button" onClick={() => setView('math')}>
              <span className="k">The honest math</span>
              <span className="v">
                <CountUpNumber value={ev.lifetime.saved} format={value => aud(value, 0)} durationMs={720} />
                {ev.lifetime.fees > 0 ? ` − ${aud(ev.lifetime.fees, 0)}` : ''}
              </span>
              <span className="c" aria-hidden="true">›</span>
            </button>
            {freeProvider && (
              <button className="cv-row" type="button" onClick={() => setView('allowance')}>
                <span className="k">Today's allowance</span>
                <span className="v">
                  <CountUpNumber value={usedToday} format={value => value.toFixed(1)} durationMs={720} /> / {allowance.toFixed(1)}
                </span>
                <span className="c" aria-hidden="true">›</span>
              </button>
            )}
            <button className="cv-row" type="button" onClick={() => setView('months')}>
              <span className="k">Saved per month</span>
              <span className="v">
                <CountUpNumber value={averageSaved} format={value => `${aud(value, 0)} avg`} durationMs={720} />
              </span>
              <span className="c" aria-hidden="true">›</span>
            </button>
          </div>
        </>
      ) : view === 'math' ? (
        <>
          <CanvasSavingsHeader
            title="The honest math"
            value={<CountUpNumber value={ev.lifetime.netSaved} format={aud} durationMs={850} />}
            ctx="Free energy value, less every membership fee paid."
            onBack={back}
            backLabel="Back to savings"
          />

          <section className="cv-savings-equation" aria-label="Net benefit calculation">
            <div>
              <span>Free energy value</span>
              <b className="money">
                <CountUpNumber value={ev.lifetime.saved} format={aud} durationMs={760} />
              </b>
            </div>
            {ev.lifetime.fees > 0 && (
              <div>
                <span>Membership fees paid</span>
                <b>
                  − <CountUpNumber value={ev.lifetime.fees} format={aud} durationMs={760} />
                </b>
              </div>
            )}
            <div className="total">
              <span>Net benefit</span>
              <b className="money">
                <CountUpNumber value={ev.lifetime.netSaved} format={aud} durationMs={850} />
              </b>
            </div>
          </section>

          <section className="cv-savings-note">
            <span>How it is calculated</span>
            {freeProvider ? (
              <>
                <p>
                  Each day's first {allowance} kWh at {freeProvider.name} is free. We value the captured energy at{' '}
                  <b>{rate(ev.refRate)}/kWh</b>.
                </p>
                <p>
                  {ev.rateBasis.independent
                    ? `That rate comes from ${ev.rateBasis.from.join(', ')} across ${kwh(ev.rateBasis.kwh)} kWh, excluding discounted sessions.`
                    : 'Until there is enough charging outside an allowance, the app uses your average paid rate across all charging.'}
                </p>
              </>
            ) : (
              <p>No free allowance is configured yet. Add one to a charging network to begin tracking its value.</p>
            )}
          </section>
        </>
      ) : view === 'allowance' ? (
        <>
          <CanvasSavingsHeader
            title="Today's free allowance"
            value={
              <>
                <CountUpNumber value={usedToday} format={value => value.toFixed(1)} durationMs={850} />
                <span className="cv-savings-unit">of {allowance.toFixed(1)} kWh</span>
              </>
            }
            ctx={leftToday > 0 ? `${leftToday.toFixed(1)} kWh still free. Resets at midnight.` : 'Fully used today. Resets at midnight.'}
            onBack={back}
            backLabel="Back to savings"
          />

          <CanvasAllowanceCells used={usedToday} max={allowance} />

          <div className="cv-rows">
            <div className="cv-row cv-row-static">
              <span className="k">Days maxed, all time</span>
              <span className="v">
                <CountUpNumber value={ev.lifetime.daysMaxed} format={value => Math.round(value).toLocaleString('en-AU')} durationMs={720} />
              </span>
            </div>
            <button className="cv-row" type="button" onClick={() => setView('math')}>
              <span className="k">Lifetime net benefit</span>
              <span className="v">
                <CountUpNumber value={ev.lifetime.netSaved} format={aud} durationMs={720} />
              </span>
              <span className="c" aria-hidden="true">›</span>
            </button>
          </div>
        </>
      ) : (
        <>
          <CanvasSavingsHeader
            title="This month"
            value={<CountUpNumber value={currentSaved} format={aud} durationMs={850} />}
            ctx="Free energy value before membership fees."
            onBack={back}
            backLabel="Back to savings"
          />

          <CanvasSavingsBars data={last6.map(month => ({ label: month.label.split(' ')[0], value: month.saved }))} />

          <section className="cv-mini-grid">
            <article>
              <span>Six-month average</span>
              <b>
                <CountUpNumber value={averageSaved} format={value => aud(value, 0)} durationMs={760} />
              </b>
            </article>
            <article>
              <span>Lifetime value</span>
              <b>
                <CountUpNumber value={ev.lifetime.saved} format={value => aud(value, 0)} durationMs={760} />
              </b>
            </article>
          </section>
        </>
      )}
    </main>
  )
}

function CanvasSavingsHeader({
  title,
  value,
  ctx,
  onBack,
  backLabel,
}: {
  title: string
  value: ReactNode
  ctx: string
  onBack: () => void
  backLabel: string
}) {
  return (
    <>
      <header className="appbar">
        <div>
          <p className="cv-eyebrow">{title}</p>
          <h1 className="cv-big">{value}</h1>
        </div>
        <button className="icon-btn" type="button" aria-label={backLabel} onClick={onBack}>
          <Icon name="back" />
        </button>
      </header>
      <p className="cv-ctx">{ctx}</p>
    </>
  )
}

function CanvasSavingsWave({ data }: { data: Array<{ label: string; value: number }> }) {
  const width = 320
  const baseY = 142
  const topY = 14
  const max = Math.max(...data.map(point => point.value), 1)
  const points = data.map((point, index) => ({
    x: data.length > 1 ? 4 + (index / (data.length - 1)) * (width - 8) : width / 2,
    y: baseY - (point.value / max) * (baseY - topY),
  }))
  const coordinates = points.map(point => `${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' L')
  const line = points.length > 0 ? `M${coordinates}` : ''
  const area = points.length > 0
    ? `M${points[0].x.toFixed(1)} ${baseY} L${coordinates} L${points[points.length - 1].x.toFixed(1)} ${baseY} Z`
    : ''
  const start = data[0]?.label.split(' ')[0] ?? 'Start'
  const end = data[data.length - 1]?.label.split(' ')[0] ?? 'Now'
  const endpoint = points[points.length - 1]

  return (
    <figure className="cv-savings-wave" aria-label="Cumulative free energy value over the last twelve months">
      <svg viewBox={`0 0 ${width} 154`} preserveAspectRatio="none" aria-hidden="true">
        {area && <path className="area" d={area} />}
        {line && <path className="line" pathLength="1" d={line} />}
        {endpoint && <circle className="point" cx={endpoint.x} cy={endpoint.y} r="5" />}
      </svg>
      <figcaption>
        <span>{start}</span>
        <b>Cumulative free energy value</b>
        <span>{end}</span>
      </figcaption>
    </figure>
  )
}

function CanvasAllowanceCells({ used, max }: { used: number; max: number }) {
  const cellCount = Math.max(1, Math.ceil(max))
  return (
    <figure className="cv-allowance" aria-label={`${used.toFixed(1)} of ${max.toFixed(1)} kilowatt-hours used today`}>
      <div>
        {Array.from({ length: cellCount }, (_, index) => {
          const capacity = Math.min(1, Math.max(0, max - index))
          const fill = capacity > 0 ? Math.min(capacity, Math.max(0, used - index)) / capacity : 0
          return (
            <i key={index}>
              <span style={{ height: `${fill * 100}%` }} />
            </i>
          )
        })}
      </div>
      <figcaption>
        <span>1 kWh per cell</span>
        <span>{Math.max(0, max - used).toFixed(1)} kWh left</span>
      </figcaption>
    </figure>
  )
}

function CanvasSavingsBars({ data }: { data: Array<{ label: string; value: number }> }) {
  const max = Math.max(...data.map(point => point.value), 0.01)
  return (
    <figure className="cv-savings-bars" aria-label="Free energy value saved in each of the last six months">
      <div>
        {data.map((point, index) => (
          <i
            key={`${point.label}-${index}`}
            style={{ ['--h' as string]: `${Math.max(7, (point.value / max) * 100)}%`, ['--i' as string]: index }}
          >
            <b>{aud(point.value, 0)}</b>
          </i>
        ))}
      </div>
      <figcaption>
        {data.map((point, index) => <span key={`${point.label}-${index}`}>{point.label}</span>)}
      </figcaption>
    </figure>
  )
}

function ClassicSavings() {
  const navigate = useNavigate()
  const ev = useEv()
  const freeProvider = ev.providers.find(p => p.freeKwhPerDay > 0)
  const usedToday = freeProvider ? allowanceUsedOn(ev.sessions, freeProvider.name, todayIso()) : 0
  const leftToday = freeProvider ? Math.max(0, freeProvider.freeKwhPerDay - usedToday) : 0
  const last6 = ev.months.slice(-6)

  return (
    <main className="app-shell">
      <header className="appbar">
        <div>
          <p className="eyebrow">Free energy</p>
          <h1>Savings</h1>
          <span className="sub">
            {freeProvider ? `Powered by ${freeProvider.name}'s ${freeProvider.freeKwhPerDay} kWh/day` : 'No free allowances configured'}
          </span>
        </div>
        <button className="icon-btn" type="button" aria-label="Back" onClick={() => navigate(-1)}>
          <Icon name="back" />
        </button>
      </header>

      <section className="savecard no-ring" style={{ padding: 18 }}>
        <span className="bolt">⚡</span>
        <span className="cap">Lifetime net benefit</span>
        <Explainable derive={() => deriveNetBenefit(ev)} label="Lifetime net benefit" className="on-dark">
          <CountUpNumber className="big xl" value={ev.lifetime.netSaved} format={aud} />
        </Explainable>
        <small>
          {kwh(ev.lifetime.freeKwh)} kWh free of {kwh(ev.lifetime.kwh)} charged · valued at{' '}
          {rate(ev.refRate)}/kWh
          {ev.rateBasis.independent ? ' — what you pay elsewhere' : ' — your average paid rate'}
        </small>
      </section>

      <section className="hero-card">
        <span className="cap" style={{ marginBottom: 8 }}>
          The honest math
        </span>
        <div className="rcpt" style={{ border: 0, boxShadow: 'none', padding: 0 }}>
          <div className="rl free">
            <span>Free energy value</span>
            <b>
              <CountUpNumber value={ev.lifetime.saved} format={aud} durationMs={760} />
            </b>
          </div>
          {ev.lifetime.fees > 0 && (
            <div className="rl">
              <span>Membership fees paid</span>
              <b>
                − <CountUpNumber value={ev.lifetime.fees} format={aud} durationMs={760} />
              </b>
            </div>
          )}
          <div className="rl tot">
            <span>Net benefit</span>
            <b style={{ color: 'var(--money-deep)' }}>
              <CountUpNumber value={ev.lifetime.netSaved} format={aud} durationMs={850} />
            </b>
          </div>
        </div>
      </section>

      {freeProvider && (
        <section className="hero-card" style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <Ring
            value={usedToday}
            max={freeProvider.freeKwhPerDay}
            label={usedToday.toFixed(1)}
            sub={`of ${freeProvider.freeKwhPerDay}`}
            size={88}
            onSurface
          />
          <div>
            <span className="cap">Today's allowance</span>
            <div style={{ fontSize: 16, fontWeight: 800, marginTop: 5 }}>
              {leftToday > 0 ? `${leftToday.toFixed(1)} kWh still free` : 'Fully used — nice'}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--mut)', fontWeight: 600, marginTop: 3 }}>
              Resets midnight · {ev.lifetime.daysMaxed} days maxed all-time
            </div>
          </div>
        </section>
      )}

      <section className="chart-card">
        <h4>
          Saved per month <em>$ value</em>
        </h4>
        <Bars data={last6.map(m => ({ label: m.label.split(' ')[0], value: m.saved }))} showValues valueLabel={v => aud(v, 0)} />
      </section>

      <section className="hero-card" style={{ paddingBottom: 14 }}>
        <span className="cap" style={{ marginBottom: 7 }}>
          How it's calculated
        </span>
        <p style={{ fontSize: 12.5, color: 'var(--mut)', fontWeight: 600, lineHeight: 1.6 }}>
          Each day's first {freeProvider?.freeKwhPerDay ?? 7} kWh at {freeProvider?.name ?? 'Jolt'} is free. We sum{' '}
          <b style={{ color: 'var(--tx)' }}>
            min({freeProvider?.freeKwhPerDay ?? 7}, that day's {freeProvider?.name ?? 'Jolt'} kWh)
          </b>{' '}
          and value it at <b style={{ color: 'var(--tx)' }}>{rate(ev.refRate)}/kWh</b>.
        </p>
        <div className="ratebasis">
          {ev.rateBasis.independent ? (
            <>
              That rate is what you actually pay where there's <b>no</b> free allowance —{' '}
              <b>{ev.rateBasis.from.join(', ')}</b> across {kwh(ev.rateBasis.kwh)} kWh. {freeProvider?.name ?? 'Jolt'}'s
              own sessions are excluded: they're already discounted by the free kWh inside them, so counting them would
              value the giveaway using the giver's prices.
            </>
          ) : (
            <>
              Not enough energy bought outside an allowance yet, so this falls back to your average paid rate across all
              charging. Add a few charges at a network with no free allowance and it'll sharpen.
            </>
          )}
        </div>
      </section>

      <footer className="app-footer">
        You've charged {aud(ev.lifetime.saved + ev.lifetime.cost, 0)} of energy for {aud(ev.lifetime.cost, 0)}
      </footer>
    </main>
  )
}
