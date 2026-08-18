import { useMemo, useState } from 'react'
import { addProvider, addSession } from '../lib/data'
import { previewFreeAllocation } from '../lib/savings'
import { aud, todayIso } from '../lib/format'
import { PROVIDER_PALETTE, nextPaletteColor } from '../lib/providers'
import { useEv } from '../lib/useEv'
import { SyncBadge, TickSvg } from './ui'
import GlassSegmented from './GlassSegmented'

type Mode = 'charge' | 'fee'

export default function AddSheet({ onClose }: { onClose: () => void }) {
  const { providers: allProviders, sessions, refRate, synced, syncStatus, pendingCount } = useEv()
  const providers = useMemo(
    () => allProviders.filter(provider => !provider.archived),
    [allProviders],
  )
  const defaultProviderName = providers[0]?.name ?? ''
  const [mode, setMode] = useState<Mode>('charge')
  const [providerName, setProviderName] = useState(defaultProviderName)
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newFree, setNewFree] = useState(0)
  const [newColor, setNewColor] = useState<string>(() => nextPaletteColor(providers))
  const [date, setDate] = useState(todayIso())
  const [kwhStr, setKwhStr] = useState('')
  const [costStr, setCostStr] = useState('')
  const [notes, setNotes] = useState('')
  const [saved, setSaved] = useState(false)
  const selectedProviderName = providers.some(p => p.name === providerName) ? providerName : defaultProviderName

  const isFee = mode === 'fee'
  const kwh = parseFloat(kwhStr) || 0
  const cost = parseFloat(costStr) || 0
  const provider = providers.find(p => p.name === selectedProviderName)

  const preview = useMemo(
    () => previewFreeAllocation(sessions, provider, date, kwh, refRate),
    [sessions, provider, date, kwh, refRate],
  )

  const providerChosen = showNew ? newName.trim().length > 0 : !!provider
  const canSave = isFee ? providerChosen && cost > 0 : providerChosen && kwh > 0 && cost >= 0

  const handleSave = () => {
    let typeName = selectedProviderName
    if (showNew) {
      const p = addProvider(newName, newFree, newColor)
      typeName = p.name
    }
    addSession({
      date,
      type: typeName,
      amount: isFee ? 0 : kwh,
      cost,
      notes: notes.trim() || (isFee ? 'Monthly membership' : null),
    })
    setSaved(true)
    setTimeout(onClose, 1300)
  }

  return (
    <div className="sheet-backdrop" role="presentation" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Add charge or fee" onClick={e => e.stopPropagation()}>
        <div className="handle" />
        {saved ? (
          <div style={{ textAlign: 'center', padding: '18px 0 26px' }}>
            <TickSvg />
            <b style={{ fontSize: 15, fontWeight: 800 }}>{isFee ? 'Fee saved' : 'Charge saved'}</b>
            <p style={{ fontSize: 12, color: 'var(--mut)', fontWeight: 600, marginTop: 4 }}>
              {synced ? 'Synced to Supabase' : `Saved safely · ${pendingCount || 1} change${(pendingCount || 1) === 1 ? '' : 's'} waiting to sync`}
            </p>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <b style={{ fontSize: 17, fontWeight: 800 }}>{isFee ? 'New membership fee' : 'New charge'}</b>
              <SyncBadge live={synced} label={synced ? 'Syncs live' : syncStatus === 'offline' ? 'Offline queue' : 'Will sync'} />
            </div>

            <GlassSegmented
              ariaLabel="Entry type"
              value={mode}
              onChange={setMode}
              style={{ marginTop: 12 }}
              options={[
                { value: 'charge', label: 'Charge' },
                { value: 'fee', label: 'Membership fee' },
              ]}
            />

            <label>Charger</label>
            <div className="provrow">
              {providers.map(p => (
                <button
                  key={p.id}
                  type="button"
                  className={!showNew && selectedProviderName === p.name ? 'on' : ''}
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

            <label>{isFee ? 'Billed on' : 'Date'}</label>
            <div className="fld">
              <input type="date" value={date} max={todayIso()} onChange={e => setDate(e.target.value)} />
            </div>

            {isFee ? (
              <>
                <label>Fee amount</label>
                <div className="fld">
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={0.01}
                    placeholder="15.00"
                    value={costStr}
                    onChange={e => setCostStr(e.target.value)}
                  />
                  <span className="unit">AUD</span>
                </div>
                <div className="freepreview" style={{ background: 'var(--surf2)', borderColor: 'var(--bd)', color: 'var(--mut)' }}>
                  A membership fee has no energy — it's counted as a cost and netted against your free-energy savings.
                </div>
              </>
            ) : (
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
            )}

            <label>Notes (optional)</label>
            <div className="fld">
              <input
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder={isFee ? 'e.g. Monthly membership' : 'e.g. Norwood carpark'}
              />
            </div>

            {!isFee && !showNew && provider && provider.freeKwhPerDay > 0 && kwh > 0 && (
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
              {showNew ? 'Create charger & save' : isFee ? 'Save fee' : 'Save charge'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
