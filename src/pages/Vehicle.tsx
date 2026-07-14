import { useState } from 'react'
import { useEv } from '../lib/useEv'
import { aud, kwh, rate } from '../lib/format'
import { Icon } from '../components/ui'

// Cockpit assumptions — editable, persisted locally.
const LS_KEY = 'ev.vehicle.v1'
interface Assumptions {
  efficiency: number // kWh / 100 km
  petrolPrice: number // $/L
  petrolUse: number // L / 100 km
}
const DEFAULTS: Assumptions = { efficiency: 14.2, petrolPrice: 1.85, petrolUse: 7.0 }
const read = (): Assumptions => {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(LS_KEY) ?? '{}') }
  } catch {
    return DEFAULTS
  }
}

export default function Vehicle() {
  const ev = useEv()
  const [a, setA] = useState<Assumptions>(read)
  const [editing, setEditing] = useState(false)

  const save = (patch: Partial<Assumptions>) => {
    const next = { ...a, ...patch }
    setA(next)
    localStorage.setItem(LS_KEY, JSON.stringify(next))
  }

  const distanceKm = a.efficiency > 0 ? (ev.lifetime.kwh / a.efficiency) * 100 : 0
  const allInRate = ev.lifetime.kwh > 0 ? ev.lifetime.cost / ev.lifetime.kwh : 0
  const evPer100 = allInRate * a.efficiency
  const noFreePer100 = ev.refRate * a.efficiency
  const petrolPer100 = a.petrolUse * a.petrolPrice
  const savedVsPetrol = ((petrolPer100 - evPer100) * distanceKm) / 100
  const evPct = petrolPer100 > 0 ? Math.max(4, (evPer100 / petrolPer100) * 100) : 0

  const num = (v: number, dp = 1) => v.toFixed(dp)

  return (
    <main className="app-shell">
      <header className="appbar">
        <div>
          <p className="eyebrow">Vehicle</p>
          <h1>Cockpit</h1>
          <span className="sub">Efficiency, cost & the petrol brag</span>
        </div>
        <button className="icon-btn" type="button" aria-label="Edit assumptions" onClick={() => setEditing(v => !v)}>
          <Icon name="gear" />
        </button>
      </header>

      {editing && (
        <section className="hero-card">
          <span className="cap" style={{ marginBottom: 10 }}>
            Assumptions
          </span>
          {(
            [
              ['efficiency', 'Efficiency (kWh / 100 km)', 0.1],
              ['petrolPrice', 'Petrol price ($ / L)', 0.01],
              ['petrolUse', 'Petrol car use (L / 100 km)', 0.1],
            ] as const
          ).map(([key, label, step]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ flex: 1, fontSize: 12.5, fontWeight: 700, color: 'var(--mut)' }}>{label}</span>
              <div className="kstep" style={{ width: 150 }}>
                <button type="button" onClick={() => save({ [key]: Math.max(0, +(a[key] - step * 10).toFixed(2)) } as Partial<Assumptions>)}>
                  −
                </button>
                <span className="v">{a[key]}</span>
                <button type="button" onClick={() => save({ [key]: +(a[key] + step * 10).toFixed(2) } as Partial<Assumptions>)}>
                  +
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="hero-card">
        <span className="cap">Estimated distance powered</span>
        <div className="hero-num">
          {kwh(distanceKm)} <span style={{ fontSize: 16, color: 'var(--fnt)', fontWeight: 750 }}>km</span>
        </div>
        <p className="hero-sub">
          {kwh(ev.lifetime.kwh)} kWh lifetime ÷ {num(a.efficiency)} kWh/100km
        </p>
      </section>

      <section className="metric-grid">
        <article className="metric-card">
          <span>Efficiency</span>
          <strong>{num(a.efficiency)}</strong>
          <small>kWh / 100 km</small>
        </article>
        <article className="metric-card">
          <span>All-in rate</span>
          <strong>{rate(allInRate)}</strong>
          <small>/kWh incl. free energy</small>
        </article>
        <article className="metric-card">
          <span>Energy cost</span>
          <strong style={{ color: 'var(--money-deep)' }}>{aud(evPer100)}</strong>
          <small>/100 km actual</small>
        </article>
        <article className="metric-card">
          <span>Without free kWh</span>
          <strong>{aud(noFreePer100)}</strong>
          <small>/100 km at paid rate</small>
        </article>
      </section>

      <section className="chart-card race">
        <h4>Cost per 100 km</h4>
        <div className="rrow">
          <div className="rl2">
            <span>Petrol equivalent ({num(a.petrolUse)} L @ {aud(a.petrolPrice)})</span>
            <b>{aud(petrolPer100)}</b>
          </div>
          <div className="bar pet">
            <i style={{ width: '92%' }} />
          </div>
        </div>
        <div className="rrow">
          <div className="rl2">
            <span>You (incl. free energy)</span>
            <b style={{ color: 'var(--money-deep)' }}>{aud(evPer100)}</b>
          </div>
          <div className="bar ev">
            <i style={{ width: `${evPct * 0.92}%` }} />
          </div>
        </div>
        <p className="note">≈ {aud(savedVsPetrol, 0)} saved vs petrol across {kwh(distanceKm)} km</p>
      </section>

      <footer className="app-footer">Assumption-based — tap the gear to tune</footer>
    </main>
  )
}
