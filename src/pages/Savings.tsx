import { useNavigate } from 'react-router-dom'
import { useEv } from '../lib/useEv'
import { allowanceUsedOn } from '../lib/savings'
import { aud, kwh, rate, todayIso } from '../lib/format'
import { Bars, Icon, Ring } from '../components/ui'

export default function Savings() {
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
        <b className="big xl">{aud(ev.lifetime.netSaved)}</b>
        <small>
          {kwh(ev.lifetime.freeKwh)} kWh free of {kwh(ev.lifetime.kwh)} charged · valued at your paid rate{' '}
          {rate(ev.refRate)}/kWh
        </small>
      </section>

      <section className="hero-card">
        <span className="cap" style={{ marginBottom: 8 }}>
          The honest math
        </span>
        <div className="rcpt" style={{ border: 0, boxShadow: 'none', padding: 0 }}>
          <div className="rl free">
            <span>Free energy value</span>
            <b>{aud(ev.lifetime.saved)}</b>
          </div>
          {ev.lifetime.fees > 0 && (
            <div className="rl">
              <span>Membership fees paid</span>
              <b>− {aud(ev.lifetime.fees)}</b>
            </div>
          )}
          <div className="rl tot">
            <span>Net benefit</span>
            <b style={{ color: 'var(--money-deep)' }}>{aud(ev.lifetime.netSaved)}</b>
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
          and value it at the {rate(ev.refRate)}/kWh you pay elsewhere. Allowances are per-charger settings — edit them
          in Settings.
        </p>
      </section>

      <footer className="app-footer">
        You've charged {aud(ev.lifetime.saved + ev.lifetime.cost, 0)} of energy for {aud(ev.lifetime.cost, 0)}
      </footer>
    </main>
  )
}
