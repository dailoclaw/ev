import { useRef, useState } from 'react'
import { useEv } from '../lib/useEv'
import { aud, kwh, rate } from '../lib/format'
import { Icon } from '../components/ui'
import CountUpNumber from '../components/CountUpNumber'

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

// The vehicle photo lives on this device only — a compressed data URL in
// localStorage, never synced. It's personalisation, not data worth backing up.
const LS_PHOTO = 'ev.vehiclePhoto.v1'

function compressImage(file: File, maxWidth = 960, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width)
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('Canvas unavailable'))
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = () => reject(new Error('Could not read that image'))
      img.src = reader.result as string
    }
    reader.onerror = () => reject(new Error('Could not read that file'))
    reader.readAsDataURL(file)
  })
}

export default function Vehicle() {
  const ev = useEv()
  const [a, setA] = useState<Assumptions>(read)
  const [editing, setEditing] = useState(false)
  const [photo, setPhoto] = useState<string | null>(() => localStorage.getItem(LS_PHOTO))
  const [photoError, setPhotoError] = useState<string | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const save = (patch: Partial<Assumptions>) => {
    const next = { ...a, ...patch }
    setA(next)
    localStorage.setItem(LS_KEY, JSON.stringify(next))
  }

  const onPhotoChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const compressed = await compressImage(file)
      localStorage.setItem(LS_PHOTO, compressed)
      setPhoto(compressed)
      setPhotoError(null)
    } catch {
      setPhotoError('Could not read that photo — try a different one.')
    }
  }

  const removePhoto = () => {
    localStorage.removeItem(LS_PHOTO)
    setPhoto(null)
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

      <button
        type="button"
        className="vehicle-photo"
        onClick={() => photoInputRef.current?.click()}
        aria-label={photo ? 'Change vehicle photo' : 'Add a vehicle photo'}
      >
        {photo ? (
          <img src={photo} alt="Your vehicle" />
        ) : (
          <span className="vehicle-photo-empty">
            <Icon name="car" size={22} />
            <small>Tap to add a photo</small>
          </span>
        )}
      </button>
      <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onPhotoChosen} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <p className="sec-sub" style={{ margin: 0 }}>
          Kept on this device only — not synced or backed up.
        </p>
        {photo && (
          <button type="button" className="text-btn" onClick={removePhoto}>
            Remove
          </button>
        )}
      </div>
      {photoError && (
        <p style={{ color: 'var(--neg)', fontSize: 12, fontWeight: 700, marginTop: -8, marginBottom: 12 }}>{photoError}</p>
      )}

      {editing && (
        <section className="hero-card">
          <span className="cap" style={{ marginBottom: 10 }}>
            Assumptions
          </span>
          {(
            [
              ['efficiency', 'Efficiency (kWh / 100 km)', 0.1],
              ['petrolPrice', 'Petrol price ($ / L)', 0.1],
              ['petrolUse', 'Petrol car use (L / 100 km)', 1.0],
            ] as const
          ).map(([key, label, step]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ flex: 1, fontSize: 12.5, fontWeight: 700, color: 'var(--mut)' }}>{label}</span>
              <div className="kstep" style={{ width: 150 }}>
                <button type="button" onClick={() => save({ [key]: Math.max(0, +(a[key] - step).toFixed(2)) } as Partial<Assumptions>)}>
                  −
                </button>
                <span className="v">{a[key]}</span>
                <button type="button" onClick={() => save({ [key]: +(a[key] + step).toFixed(2) } as Partial<Assumptions>)}>
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
          <CountUpNumber value={distanceKm} format={kwh} durationMs={900} />{' '}
          <span style={{ fontSize: 16, color: 'var(--fnt)', fontWeight: 750 }}>km</span>
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
          <strong style={{ color: 'var(--money-deep)' }}>
            <CountUpNumber value={evPer100} format={aud} durationMs={760} />
          </strong>
          <small>/100 km actual</small>
        </article>
        <article className="metric-card">
          <span>Without free kWh</span>
          <strong>
            <CountUpNumber value={noFreePer100} format={aud} durationMs={760} />
          </strong>
          <small>/100 km at paid rate</small>
        </article>
      </section>

      <section className="chart-card race">
        <h4>Cost per 100 km</h4>
        <div className="rrow">
          <div className="rl2">
            <span>Petrol equivalent ({num(a.petrolUse)} L @ {aud(a.petrolPrice)})</span>
            <b>
              <CountUpNumber value={petrolPer100} format={aud} durationMs={760} />
            </b>
          </div>
          <div className="bar pet">
            <i style={{ width: '92%' }} />
          </div>
        </div>
        <div className="rrow">
          <div className="rl2">
            <span>You (incl. free energy)</span>
            <b style={{ color: 'var(--money-deep)' }}>
              <CountUpNumber value={evPer100} format={aud} durationMs={760} />
            </b>
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
