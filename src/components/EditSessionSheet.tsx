import { useState } from 'react'
import type { EnrichedSession } from '../lib/savings'
import { updateSession } from '../lib/data'
import { todayIso } from '../lib/format'
import { GlassSurface, Mark } from './ui'

export default function EditSessionSheet({ session, onClose }: { session: EnrichedSession; onClose: () => void }) {
  const [date, setDate] = useState(session.date)
  const [kwhStr, setKwhStr] = useState(session.isFee ? '' : session.amount.toFixed(2))
  const [costStr, setCostStr] = useState(session.cost.toFixed(2))
  const [notes, setNotes] = useState(session.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const kwh = parseFloat(kwhStr) || 0
  const cost = parseFloat(costStr) || 0
  const canSave = session.isFee ? cost > 0 : kwh > 0 && cost >= 0

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await updateSession(session.id, {
        date,
        amount: session.isFee ? 0 : kwh,
        cost,
        notes: notes.trim() || null,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save — try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="sheet-backdrop" role="presentation" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Edit charge" onClick={e => e.stopPropagation()}>
        <div className="handle" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <Mark name={session.type} />
          <div>
            <b style={{ fontSize: 16, fontWeight: 800 }}>Edit {session.isFee ? 'fee' : 'charge'}</b>
            <div style={{ fontSize: 12, color: 'var(--mut)', fontWeight: 600 }}>{session.type} · charger can't change here</div>
          </div>
        </div>

        <label>{session.isFee ? 'Billed on' : 'Date'}</label>
        <div className="fld">
          <input type="date" value={date} max={todayIso()} onChange={e => setDate(e.target.value)} />
        </div>

        {!session.isFee && (
          <>
            <label>Energy</label>
            <div className="fld">
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step={0.1}
                value={kwhStr}
                onChange={e => setKwhStr(e.target.value)}
              />
              <span className="unit">kWh</span>
            </div>
          </>
        )}

        <label>Cost</label>
        <div className="fld">
          <input type="number" inputMode="decimal" min={0} step={0.01} value={costStr} onChange={e => setCostStr(e.target.value)} />
          <span className="unit">AUD</span>
        </div>

        <label>Notes (optional)</label>
        <div className="fld">
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" />
        </div>

        {error && <p style={{ color: 'var(--neg)', fontSize: 12, fontWeight: 700, marginTop: 8 }}>{error}</p>}

        <GlassSurface
          className="liquid-primary-action"
          width={360}
          height={52}
          radius={15}
          strength={0.09}
          chromaticAberration={0.2}
          depth={8}
          glow={0.16}
          edgeHighlight={0.32}
          disabled={!canSave || saving}
        >
          <button className="primary-btn" type="button" disabled={!canSave || saving} onClick={handleSave}>
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </GlassSurface>
      </div>
    </div>
  )
}
