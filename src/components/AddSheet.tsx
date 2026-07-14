import { useMemo, useState } from 'react'
import { addProvider, addSession } from '../lib/data'
import { previewFreeAllocation } from '../lib/savings'
import { aud, todayIso } from '../lib/format'
import { PROVIDER_PALETTE, nextPaletteColor } from '../lib/providers'
import { useEv } from '../lib/useEv'
import { SyncBadge, TickSvg } from './ui'

export default function AddSheet({ onClose }: { onClose: () => void }) {
  const { providers, sessions, refRate, synced } = useEv()
  const [providerName, setProviderName] = useState(providers[0]?.name ?? '')
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newFree, setNewFree] = useState(0)
  const [newColor, setNewColor] = useState<string>(() => nextPaletteColor(providers))
  const [date, setDate] = useState(todayIso())
  const [kwhStr, setKwhStr] = useState('')
  const [costStr, setCostStr] = useState('')
  const [notes, setNotes] = useState('')
  const [saved, setSaved] = useState(false)

  const kwh = parseFloat(kwhStr) || 0
  const cost = parseFloat(costStr) || 0
  const provider = providers.find(p => p.name === providerName)

  const preview = useMemo(
    () => previewFreeAllocation(sessions, provider, date, kwh, refRate),
    [sessions, provider, date, kwh, refRate],
  )

  const canSave = (showNew ? newName.trim().length > 0 : !!provider) && kwh > 0 && cost >= 0

  const handleSave = () => {
    let typeName = providerName
    if (showNew) {
      const p = addProvider(newName, newFree, newColor)
      typeName = p.name
    }
    addSession({ date, type: typeName, amount: kwh, cost, notes: notes.trim() || null })
    setSaved(true)
    setTimeout(onClose, 1300)
  }

  return (
    <div className="sheet-backdrop" role="presentation" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Add charge" onClick={e => e.stopPropagation()}>
        <div className="handle" />
        {saved ? (
          <div style={{ textAlign: 'center', padding: '18px 0 26px' }}>
            <TickSvg />
            <b style={{ fontSize: 15, fontWeight: 800 }}>Charge saved</b>
            <p style={{ fontSize: 12, color: 'var(--mut)', fontWeight: 600, marginTop: 4 }}>
              {synced ? 'Synced to Supabase' : 'Stored on this device — will sync once Supabase is connected'}
            </p>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <b style={{ fontSize: 17, fontWeight: 800 }}>New charge</b>
              <SyncBadge live={synced} label={synced ? 'Syncs live' : 'Local for now'} />
            </div>

            <label>Charger</label>
            <div className="provrow">
              {providers.map(p => (
                <button
                  key={p.id}
                  type="button"
                  className={!showNew && providerName === p.name ? 'on' : ''}
                  onClick={() => {
                    setShowNew(false)
                    setProviderName(p.name)
                  }}
                >
                  {p.name}
                </button>
              ))}
              <button type="button" className={`newp ${showNew ? 'on' : ''}`} onClick={() => setShowNew(v => !v)}>
                + New
              </button>
            </div>

            {showNew && (
              <div className="freepreview" style={{ background: 'var(--surf2)', borderColor: 'var(--bd)', color: 'var(--tx)' }}>
                <label style={{ margin: '0 0 5px' }}>New charger name</label>
                <div className="fld" style={{ background: 'var(--surf)' }}>
                  <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Evie" autoFocus />
                </div>
                <label>Colour</label>
                <div className="colorrow">
                  {PROVIDER_PALETTE.slice(0, 5).map(c => (
                    <button
                      key={c}
                      type="button"
                      className={newColor === c ? 'on' : ''}
                      style={{ background: c }}
                      aria-label={`Colour ${c}`}
                      onClick={() => setNewColor(c)}
                    />
                  ))}
                </div>
                <label>Free allowance (kWh per day)</label>
                <div className="fld" style={{ background: 'var(--surf)' }}>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={newFree}
                    onChange={e => setNewFree(Math.max(0, parseFloat(e.target.value) || 0))}
                  />
                  <span className="unit">kWh / day</span>
                </div>
              </div>
            )}

            <label>Date</label>
            <div className="fld">
              <input type="date" value={date} max={todayIso()} onChange={e => setDate(e.target.value)} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <label>Energy</label>
                <div className="fld">
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={0.1}
                    placeholder="0.0"
                    value={kwhStr}
                    onChange={e => setKwhStr(e.target.value)}
                  />
                  <span className="unit">kWh</span>
                </div>
              </div>
              <div style={{ minWidth: 0 }}>
                <label>Cost</label>
                <div className="fld">
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={0.01}
                    placeholder="0.00"
                    value={costStr}
                    onChange={e => setCostStr(e.target.value)}
                  />
                  <span className="unit">AUD</span>
                </div>
              </div>
            </div>

            <label>Notes (optional)</label>
            <div className="fld">
              <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Norwood carpark" />
            </div>

            {!showNew && provider && provider.freeKwhPerDay > 0 && kwh > 0 && (
              <div className="freepreview">
                ⚡ {(provider.freeKwhPerDay - preview.allowanceLeft).toFixed(1)} of {provider.freeKwhPerDay} kWh already
                used {date === todayIso() ? 'today' : 'that day'} —{' '}
                <b>
                  {preview.freeKwh.toFixed(1)} kWh of this charge is free
                </b>{' '}
                → saving ≈ {aud(preview.saving)}
              </div>
            )}

            <button className="primary-btn" style={{ marginTop: 16 }} type="button" disabled={!canSave} onClick={handleSave}>
              {showNew ? 'Create charger & save' : 'Save charge'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
