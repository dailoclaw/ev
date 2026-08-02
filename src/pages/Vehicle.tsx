import { useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEv } from '../lib/useEv'
import { aud, kwh, rate } from '../lib/format'
import { Icon } from '../components/ui'
import CountUpNumber from '../components/CountUpNumber'
import { useStyle } from '../lib/style'
import { LiquidGlass } from 'liquid-glass-web-react'

// Cockpit assumptions — editable, persisted locally.
const LS_KEY = 'ev.vehicle.v1'
interface Assumptions {
  efficiency: number // kWh / 100 km
  petrolPrice: number // $/L
  petrolUse: number // L / 100 km
}

function VehicleGlassStat({ className, children }: { className: string; children: ReactNode }) {
  return (
    <LiquidGlass
      className={`cv-comp ${className}`}
      x={0.5}
      y={0.5}
      width={92}
      height={92}
      radius="auto"
      strength={0.035}
      chromaticAberration={0.35}
      curvature={0.82}
      depth={10}
      glow={0.18}
      edgeHighlight={0.38}
      shadow="0 0 0 1px rgba(255,255,255,0.16), 0 16px 36px rgba(0,0,0,0.24)"
    >
      <span className="cv-comp__content">{children}</span>
    </LiquidGlass>
  )
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

type VehicleView = 'overview' | 'efficiency' | 'distance' | 'petrol' | 'assumptions'

export default function Vehicle() {
  const [style] = useStyle()
  return style === 'minimal' ? <CanvasVehicle /> : <ClassicVehicle />
}

function CanvasVehicle() {
  const ev = useEv()
  const navigate = useNavigate()
  const [a, setA] = useState<Assumptions>(read)
  const [view, setView] = useState<VehicleView>('overview')
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

  const distanceKm = a.efficiency > 0 ? (ev.lifetime.kwh / a.efficiency) * 100 : 0
  const allInRate = ev.lifetime.kwh > 0 ? ev.lifetime.cost / ev.lifetime.kwh : 0
  const evPer100 = allInRate * a.efficiency
  const petrolPer100 = a.petrolUse * a.petrolPrice
  const savedVsPetrol = ((petrolPer100 - evPer100) * distanceKm) / 100
  const cheaper = evPer100 > 0 ? petrolPer100 / evPer100 : 0
  const evPct = petrolPer100 > 0 ? Math.max(4, (evPer100 / petrolPer100) * 100) : 0
  const effMin = 10
  const effMax = 20
  const targetEfficiency = 12.8
  const effRatio = Math.min(1, Math.max(0, (a.efficiency - effMin) / (effMax - effMin)))
  const efficiencyScore = Math.min(92, Math.max(8, (1 - effRatio) * 100))
  const effStatus = a.efficiency <= 13 ? 'excellent efficiency' : a.efficiency <= 15 ? 'good efficiency' : a.efficiency <= 18 ? 'moderate efficiency' : 'heavy use'

  const num = (v: number, dp = 1) => v.toFixed(dp)
  const back = () => setView('overview')

  return (
    <main className="app-shell cv cv-vehicle">
      {view === 'overview' ? (
        <>
          <header className="appbar">
            <div>
              <p className="cv-eyebrow">Vehicle</p>
              <h1 className="cv-big">
                <CountUpNumber value={evPer100} format={aud} durationMs={850} />
              </h1>
              <span className="cv-unit">per 100 km</span>
            </div>
            <button className="icon-btn" type="button" aria-label="Assumptions" onClick={() => setView('assumptions')}>
              <Icon name="gear" />
            </button>
          </header>
          <p className="cv-ctx">
            Actual EV running cost.{' '}
            {cheaper > 0 && (
              <em>
                About <CountUpNumber value={cheaper} format={value => `${value.toFixed(1)}x`} durationMs={650} /> cheaper than petrol.
              </em>
            )}
          </p>
          <button
            className={`cv-car-stage ${photo ? 'has-photo' : ''}`}
            type="button"
            onClick={() => photoInputRef.current?.click()}
            aria-label={photo ? 'Change vehicle photo' : 'Add a vehicle photo'}
          >
            {photo ? <img src={photo} alt="Your vehicle" /> : <span className="cv-car-line" aria-hidden="true" />}
            <VehicleGlassStat className="c1">
              <b>
                <CountUpNumber value={a.efficiency} format={value => num(value)} durationMs={720} />
              </b>
              <small>kWh/100</small>
            </VehicleGlassStat>
            <VehicleGlassStat className="c2">
              <b>
                <CountUpNumber value={distanceKm} format={value => kwh(value, 0)} durationMs={760} />
              </b>
              <small>km</small>
            </VehicleGlassStat>
            <VehicleGlassStat className="c3">
              <b>
                <CountUpNumber value={savedVsPetrol} format={value => aud(value, 0)} durationMs={760} />
              </b>
              <small>saved</small>
            </VehicleGlassStat>
          </button>
          <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onPhotoChosen} />
          {photoError && <p className="cv-error">{photoError}</p>}
          <div className="cv-rows">
            <button className="cv-row" type="button" onClick={() => setView('efficiency')}>
              <span className="k">Efficiency</span>
              <span className="v">
                <CountUpNumber value={a.efficiency} format={value => `${num(value)} kWh/100`} durationMs={720} />
              </span>
              <span className="c" aria-hidden="true">
                ›
              </span>
            </button>
            <button className="cv-row" type="button" onClick={() => setView('distance')}>
              <span className="k">Distance powered</span>
              <span className="v">
                <CountUpNumber value={distanceKm} format={value => `${kwh(value, 0)} km`} durationMs={720} />
              </span>
              <span className="c" aria-hidden="true">
                ›
              </span>
            </button>
            <button className="cv-row" type="button" onClick={() => setView('petrol')}>
              <span className="k">Petrol comparison</span>
              <span className="v">
                {cheaper > 0 ? <CountUpNumber value={cheaper} format={value => `${value.toFixed(1)}x cheaper`} durationMs={720} /> : '—'}
              </span>
              <span className="c" aria-hidden="true">
                ›
              </span>
            </button>
            <button className="cv-row" type="button" onClick={() => setView('assumptions')}>
              <span className="k">Assumptions</span>
              <span className="v">Tuned</span>
              <span className="c" aria-hidden="true">
                ›
              </span>
            </button>
          </div>
        </>
      ) : view === 'efficiency' ? (
        <>
          <CanvasVehicleHeader
            title="Efficiency"
            value={<CountUpNumber value={a.efficiency} format={value => num(value)} durationMs={850} />}
            unit="kWh / 100 km"
            ctx="Assumption used across Vehicle. Lower is better."
            onBack={back}
          />
          <div className="cv-eff-chart" aria-label="Efficiency guide">
            <div className="cv-eff-dial">
              <svg viewBox="0 0 224 224" aria-hidden="true">
                <defs>
                  <linearGradient id="cvEffGrad" x1="0" x2="1" y1="0" y2="1">
                    <stop offset="0%" stopColor="var(--money)" />
                    <stop offset="100%" stopColor="var(--warn)" />
                  </linearGradient>
                </defs>
                <path className="track" d="M42 150 A82 82 0 1 1 182 150" />
                <path
                  className="arc"
                  d="M42 150 A82 82 0 1 1 182 150"
                  pathLength={100}
                  strokeDasharray={`${efficiencyScore} 100`}
                />
              </svg>
              <div className="cv-eff-mid">
                <strong>
                  <CountUpNumber value={a.efficiency} format={value => num(value)} durationMs={850} />
                </strong>
                <small>{effStatus}</small>
              </div>
            </div>
            <div className="cv-eff-scale">
              <span>{num(targetEfficiency)} target</span>
              <span>{num(effMax - 2)} heavy</span>
            </div>
          </div>
          <section className="cv-mini-grid">
            <article>
              <span>Best target</span>
              <b>
                <CountUpNumber value={targetEfficiency} format={value => num(value)} durationMs={760} />
              </b>
            </article>
            <article>
              <span>Your model</span>
              <b>
                <CountUpNumber value={a.efficiency} format={value => num(value)} durationMs={760} />
              </b>
            </article>
          </section>
          <div className="cv-rows">
            <button className="cv-row" type="button" onClick={() => setView('assumptions')}>
              <span className="k">Edit assumption</span>
              <span className="v">
                <CountUpNumber value={a.efficiency} format={value => num(value)} durationMs={720} />
              </span>
              <span className="c" aria-hidden="true">
                ›
              </span>
            </button>
          </div>
        </>
      ) : view === 'distance' ? (
        <>
          <CanvasVehicleHeader
            title="Distance"
            value={<CountUpNumber value={distanceKm} format={value => kwh(value, 0)} durationMs={850} />}
            unit="km powered"
            ctx="Lifetime kWh translated through your efficiency assumption."
            onBack={back}
          />
          <button
            className={`cv-distance-photo ${photo ? 'has-photo' : ''}`}
            type="button"
            onClick={() => photoInputRef.current?.click()}
            aria-label={photo ? 'Change vehicle photo' : 'Add a vehicle photo'}
          >
            {photo ? (
              <img src={photo} alt="Your vehicle" />
            ) : (
              <span className="cv-distance-empty">
                <strong>Add vehicle photo</strong>
                <small>Distance metrics will sit over your car.</small>
              </span>
            )}
            <span className="cv-comp c1">
              <b>
                <CountUpNumber value={ev.lifetime.kwh} format={value => kwh(value, 0)} durationMs={760} />
              </b>
              <small>kWh</small>
            </span>
            <span className="cv-comp c2">
              <b>
                <CountUpNumber value={a.efficiency} format={value => num(value)} durationMs={760} />
              </b>
              <small>kWh/100</small>
            </span>
          </button>
          <div className="cv-rows">
            <button className="cv-row" type="button" onClick={() => navigate('/statement')}>
              <span className="k">Lifetime energy</span>
              <span className="v">
                <CountUpNumber value={ev.lifetime.kwh} format={value => `${kwh(value, 0)} kWh`} durationMs={720} />
              </span>
              <span className="c" aria-hidden="true">
                ›
              </span>
            </button>
            <button className="cv-row" type="button" onClick={() => setView('assumptions')}>
              <span className="k">Efficiency basis</span>
              <span className="v">
                <CountUpNumber value={a.efficiency} format={value => num(value)} durationMs={720} />
              </span>
              <span className="c" aria-hidden="true">
                ›
              </span>
            </button>
          </div>
        </>
      ) : view === 'petrol' ? (
        <>
          <CanvasVehicleHeader
            title="Comparison"
            value={cheaper > 0 ? <CountUpNumber value={cheaper} format={value => `${value.toFixed(1)}x`} durationMs={850} /> : '—'}
            unit="cheaper than petrol"
            ctx="Real EV energy costs against a comparable petrol car."
            onBack={back}
          />
          <section className="cv-race">
            <div>
              <span>
                <b>You</b>
                <small>per 100 km · includes free energy</small>
              </span>
              <strong>
                <CountUpNumber value={evPer100} format={aud} durationMs={760} />
              </strong>
              <i style={{ ['--w' as string]: `${evPct}%`, ['--c' as string]: 'var(--money)' }} />
            </div>
            <div>
              <span>
                <b>Petrol equivalent</b>
                <small>{num(a.petrolUse)} L/100km @ {aud(a.petrolPrice)}/L</small>
              </span>
              <strong>
                <CountUpNumber value={petrolPer100} format={aud} durationMs={760} />
              </strong>
              <i style={{ ['--w' as string]: '92%', ['--c' as string]: 'var(--tx)' }} />
            </div>
          </section>
          <section className="cv-mini-grid">
            <article>
              <span>Total saved</span>
              <b>
                <CountUpNumber value={savedVsPetrol} format={value => aud(value, 0)} durationMs={760} />
              </b>
            </article>
            <article>
              <span>Across</span>
              <b>
                <CountUpNumber value={distanceKm} format={value => `${kwh(value, 0)} km`} durationMs={760} />
              </b>
            </article>
          </section>
        </>
      ) : (
        <>
          <CanvasVehicleHeader title="Assumptions" value="Tuned" ctx="These values drive Vehicle only. They never alter your charge ledger." onBack={back} />
          <section className="cv-stepper">
            <CanvasStepper label="Efficiency" sub="kWh / 100 km" value={num(a.efficiency)} onDec={() => save({ efficiency: Math.max(0, +(a.efficiency - 0.1).toFixed(2)) })} onInc={() => save({ efficiency: +(a.efficiency + 0.1).toFixed(2) })} />
            <CanvasStepper label="Petrol price" sub="Australian dollars / litre" value={aud(a.petrolPrice)} onDec={() => save({ petrolPrice: Math.max(0, +(a.petrolPrice - 0.1).toFixed(2)) })} onInc={() => save({ petrolPrice: +(a.petrolPrice + 0.1).toFixed(2) })} />
            <CanvasStepper label="Petrol use" sub="litres / 100 km" value={num(a.petrolUse)} onDec={() => save({ petrolUse: Math.max(0, +(a.petrolUse - 1).toFixed(2)) })} onInc={() => save({ petrolUse: +(a.petrolUse + 1).toFixed(2) })} />
          </section>
          <div className="cv-rows">
            <button className="cv-row" type="button" onClick={() => save(DEFAULTS)}>
              <span className="k">Reset to defaults</span>
              <span className="v">Safe</span>
              <span className="c" aria-hidden="true">
                ›
              </span>
            </button>
            <button className="cv-row" type="button" onClick={back}>
              <span className="k">Recalculate vehicle</span>
              <span className="v">
                <CountUpNumber value={evPer100} format={aud} durationMs={720} />
              </span>
              <span className="c" aria-hidden="true">
                ›
              </span>
            </button>
          </div>
        </>
      )}
    </main>
  )
}

function CanvasVehicleHeader({
  title,
  value,
  unit,
  ctx,
  onBack,
}: {
  title: string
  value: ReactNode
  unit?: string
  ctx: string
  onBack: () => void
}) {
  return (
    <>
      <header className="appbar">
        <div>
          <p className="cv-eyebrow">{title}</p>
          <h1 className="cv-big">{value}</h1>
          {unit && <span className="cv-unit">{unit}</span>}
        </div>
        <button className="icon-btn" type="button" aria-label="Back to vehicle overview" onClick={onBack}>
          <Icon name="back" />
        </button>
      </header>
      <p className="cv-ctx">{ctx}</p>
    </>
  )
}

function CanvasStepper({
  label,
  sub,
  value,
  onDec,
  onInc,
}: {
  label: string
  sub: string
  value: string
  onDec: () => void
  onInc: () => void
}) {
  return (
    <div className="cv-step-row">
      <span>
        <strong>{label}</strong>
        <small>{sub}</small>
      </span>
      <span className="cv-control">
        <button type="button" onClick={onDec}>
          −
        </button>
        <b>{value}</b>
        <button type="button" onClick={onInc}>
          +
        </button>
      </span>
    </div>
  )
}

function ClassicVehicle() {
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
