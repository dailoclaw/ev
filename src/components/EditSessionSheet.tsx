import Modal from './Modal'
import { INPUT_LIMITS } from '../lib/validation'
import { useMemo, useState } from 'react'
import type { EnrichedSession } from '../lib/savings'
import { previewFreeAllocation } from '../lib/savings'
import { updateSession } from '../lib/data'
import { classifySave, playSaveFeedback } from '../lib/feedback'
import { todayIso } from '../lib/format'
import { useEv } from '../lib/useEv'
import { Mark } from './ui'

export default function EditSessionSheet({ session, onClose }: { session: EnrichedSession; onClose: () => void }) {
  const [date, setDate] = useState(session.date)
  const [kwhStr, setKwhStr] = useState(session.isFee ? '' : String(session.amount))
  const [costStr, setCostStr] = useState(session.cost.toFixed(2))
  const [notes, setNotes] = useState(session.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { sessions, providers, refRate } = useEv()
  const kwh = parseFloat(kwhStr) || 0
  const cost = parseFloat(costStr) || 0
  const canSave = session.isFee ? cost > 0 : kwh > 0 && cost >= 0

  // How much of the edited charge would be free, ignoring the row being replaced —
  // otherwise this session's own old allocation counts against itself.
  const freeKwh = useMemo(() => {
    const provider = providers.find(p => p.name === session.type)
    const others = sessions.filter(s => s.id !== session.id)
    return previewFreeAllocation(others, provider, date, kwh, refRate).freeKwh
  }, [sessions, providers, refRate, session.id, session.type, date, kwh])

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
      playSaveFeedback(classifySave({ isFee: session.isFee, kwh, cost, freeKwh }))
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save — try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal label="Edit charge" onClose={onClose} busy={saving}>
        <div className="handle" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <Mark name={session.type} />
          <div>
            <b style={{ fontSize: 16, fontWeight: 800 }}>Edit {session.isFee ? 'fee' : 'charge'}</b>
            <div style={{ fontSize: 12, color: 'var(--mut)', fontWeight: 600 }}>{session.type} · charger can't change here</div>
          </div>
        </div>

        <label htmlFor="edit-date">{session.isFee ? 'Billed on' : 'Date'}</label>
        <div className="fld">
          <input id="edit-date" aria-describedby="edit-error" disabled={saving} type="date" min="2000-01-01" value={date} max={todayIso()} onChange={e => setDate(e.target.value)} />
        </div>

        {!session.isFee && (
          <>
            <label htmlFor="edit-energy">Energy</label>
            <div className="fld">
              <input id="edit-energy" aria-describedby="edit-error" disabled={saving}
                type="number"
                inputMode="decimal"
                min={0}
                max={INPUT_LIMITS.energy}
                    step={0.1}
                value={kwhStr}
                onChange={e => setKwhStr(e.target.value)}
              />
              <span className="unit">kWh</span>
            </div>
          </>
        )}

        <label htmlFor="edit-cost">Cost</label>
        <div className="fld">
          <input id="edit-cost" aria-describedby="edit-error" disabled={saving} type="number" inputMode="decimal" min={0} max={INPUT_LIMITS.cost} step={0.01} value={costStr} onChange={e => setCostStr(e.target.value)} />
          <span className="unit">AUD</span>
        </div>

        <label htmlFor="edit-notes">Notes (optional)</label>
        <div className="fld">
          <input id="edit-notes" aria-describedby="edit-error" disabled={saving} maxLength={INPUT_LIMITS.notes} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" />
        </div>

        {error && <p id="edit-error" role="alert" style={{ color: 'var(--neg)', fontSize: 12, fontWeight: 700, marginTop: 8 }}>{error}</p>}

        <button className="primary-btn" style={{ marginTop: 16 }} type="button" disabled={!canSave || saving} onClick={handleSave}>
          {saving ? 'Saving...' : 'Save changes'}
        </button>
    </Modal>
  )
}
