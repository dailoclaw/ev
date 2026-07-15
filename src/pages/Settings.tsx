import { useState } from 'react'
import { useEv } from '../lib/useEv'
import { buildCsv, downloadCsv, setBudgetCap, updateProvider } from '../lib/data'
import { aud } from '../lib/format'
import { useTheme } from '../lib/theme'
import { Icon, Mark, SyncBadge } from '../components/ui'

export default function Settings() {
  const ev = useEv()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [exported, setExported] = useState(false)
  const [theme, setTheme] = useTheme()

  const exportAll = () => {
    downloadCsv(buildCsv(ev.sessions), 'ev-charging-export.csv')
    setExported(true)
    setTimeout(() => setExported(false), 2000)
  }

  const capPct = ((ev.budgetCap - 20) / (150 - 20)) * 100

  return (
    <main className="app-shell">
      <header className="appbar">
        <div>
          <p className="eyebrow">Settings</p>
          <h1>Manage</h1>
          <span className="sub">Chargers · budget · data</span>
        </div>
        <span className="icon-btn" aria-hidden>
          <Icon name="gear" />
        </span>
      </header>

      <h2 className="sec-h2" style={{ marginTop: 4 }}>
        Appearance
      </h2>
      <p className="sec-sub">Carbon OLED dark theme — easy on the eyes and the battery.</p>
      <div className="seg" role="group" aria-label="Theme">
        <button type="button" className={theme === 'light' ? 'on' : ''} onClick={() => setTheme('light')}>
          ☀ Light
        </button>
        <button type="button" className={theme === 'dark' ? 'on' : ''} onClick={() => setTheme('dark')}>
          ☾ Dark
        </button>
      </div>

      <h2 className="sec-h2">Charger types</h2>
      <p className="sec-sub">Free allowances are per-charger settings — they drive every savings figure.</p>
      {ev.providers.map(p => (
        <div key={p.id}>
          <button
            className="row"
            type="button"
            onClick={() => setEditingId(editingId === p.id ? null : p.id)}
            style={{ marginBottom: editingId === p.id ? 4 : 8 }}
          >
            <Mark provider={p} />
            <span>
              <strong>{p.name}</strong>
              <small>{p.freeKwhPerDay > 0 ? `Free allowance: ${p.freeKwhPerDay} kWh/day` : 'No free allowance'}</small>
            </span>
            <b className="amt chev">
              <Icon name="chev" size={17} />
            </b>
          </button>
          {editingId === p.id && (
            <div className="hero-card" style={{ marginTop: 0 }}>
              <span className="cap" style={{ marginBottom: 8 }}>
                Free kWh per day — {p.name}
              </span>
              <div className="kstep">
                <button
                  type="button"
                  onClick={() => updateProvider(p.id, { freeKwhPerDay: Math.max(0, +(p.freeKwhPerDay - 0.5).toFixed(1)) })}
                >
                  −
                </button>
                <span className="v">
                  {p.freeKwhPerDay}
                  <small>kWh free daily</small>
                </span>
                <button
                  type="button"
                  onClick={() => updateProvider(p.id, { freeKwhPerDay: +(p.freeKwhPerDay + 0.5).toFixed(1) })}
                >
                  +
                </button>
              </div>
              <p style={{ fontSize: 11, color: 'var(--fnt)', fontWeight: 700, marginTop: 9 }}>
                Savings, receipts and rings update instantly — the allowance is data, not code.
              </p>
            </div>
          )}
        </div>
      ))}
      <p className="sec-sub" style={{ marginTop: 2 }}>
        Add a new charger type from the + Add charge sheet.
      </p>

      <h2 className="sec-h2">Budget</h2>
      <p className="sec-sub">Monthly spending cap for the home-screen thermometer.</p>
      <section className="hero-card">
        <span className="cap" style={{ marginBottom: 12 }}>
          Monthly cap — {aud(ev.budgetCap, 0)}
        </span>
        <input
          type="range"
          className="capslider"
          min={20}
          max={150}
          step={5}
          value={ev.budgetCap}
          style={{ ['--pct' as string]: `${capPct}%` }}
          onChange={e => setBudgetCap(Number(e.target.value))}
        />
        <div className="thermoleg" style={{ marginTop: 10 }}>
          <span>$20</span>
          <span>$150</span>
        </div>
      </section>

      <h2 className="sec-h2">Data</h2>
      <p className="sec-sub">Cloud sync and export.</p>
      <div className="row">
        <span className="mark" style={{ ['--pc' as string]: '#059669' }}>
          ☁
        </span>
        <span>
          <strong>Supabase sync</strong>
          <small>
            {ev.synced ? `${ev.sessions.length} sessions synced` : `${ev.sessions.length} sessions on device · not connected yet`}
          </small>
        </span>
        <SyncBadge live={ev.synced} label={ev.synced ? 'Live' : 'Local'} />
      </div>
      <button className="row" type="button" onClick={exportAll}>
        <span className="mark" style={{ ['--pc' as string]: '#334155' }}>
          <Icon name="dl" size={17} />
        </span>
        <span>
          <strong>{exported ? 'Exported ✓' : 'Export all data'}</strong>
          <small>Excel-ready CSV · {ev.sessions.length} rows · free-kWh column included</small>
        </span>
        <b className="amt chev">
          <Icon name="chev" size={17} />
        </b>
      </button>

      <footer className="app-footer">EV Command v3.0.2 · Cockpit Ledger</footer>
    </main>
  )
}
