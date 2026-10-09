import './SyncRecoveryPanel.css'
import SyncCorrectionForm from './SyncCorrectionForm'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { discardPendingChanges, downloadJson, exportSyncRecovery, retrySync, useEvState } from '../lib/data'
import type { OutboxOperation } from '../lib/cache'

function title(operation: OutboxOperation) {
  switch (operation.action) {
    case 'session-upsert': return `Charge on ${String(operation.payload.date ?? 'unknown date')}`
    case 'session-delete': return 'Deleted charge'
    case 'provider-upsert': return `Charger: ${String(operation.payload.name ?? 'unnamed')}`
    case 'settings-update': return 'Budget, preferences and vehicle assumptions'
    case 'photo-upsert': return 'Vehicle photo upload'
    case 'photo-delete': return 'Vehicle photo removal'
  }
}

export default function SyncRecoveryPanel() {
  const ev = useEvState()
  const [editing, setEditing] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const activeEditing = ev.rejectedWrites.some(operation => operation.id === editing) ? editing : null
  const [message, setMessage] = useState<string | null>(null)
  if (!ev.rejectedWrites.length && !ev.recoveryArchiveCount) return null
  const act = async (action: () => Promise<void>) => {
    if (busy) return
    setBusy(true); setMessage(null)
    try { await action() } catch (error) { setMessage(error instanceof Error ? error.message : 'Recovery failed. Please retry.') }
    finally { setBusy(false) }
  }
  return (
    <section className="hero-card sync-recovery" aria-label="Sync recovery">
      {ev.rejectedWrites.length > 0 && <>
        <h3>Queued changes need attention</h3>
        <p>Rejected changes remain saved on this device. Other changes can sync if they do not depend on them.</p>
        <ul>
          {ev.rejectedWrites.map(operation => <li key={operation.id}>
            <strong>{title(operation)}</strong>
            <p>{operation.rejection?.kind === 'authorization' ? 'Access denied. Check your sign-in and owner permissions before retrying. ' : ''}{operation.rejection?.message}</p>
            {operation.action === 'session-upsert' && <Link to="/statement">Edit charge in History</Link>}
            {(operation.action === 'provider-upsert' || operation.action === 'settings-update') && <button type="button" className="text-btn" disabled={busy} onClick={() => setEditing(operation.id)}>Correct rejected {operation.action === 'provider-upsert' ? 'charger' : 'settings'}</button>}
            {activeEditing === operation.id && <SyncCorrectionForm key={operation.revision} operation={operation} onClose={() => setEditing(null)} />}
            {operation.action === 'settings-update' && <p>Correct budget and preferences below. <Link to="/vehicle">Edit vehicle assumptions</Link></p>}
            {(operation.action === 'photo-upsert' || operation.action === 'photo-delete') && <Link to="/vehicle">Replace or remove vehicle photo</Link>}
          </li>)}
        </ul>
        <button type="button" className="row" disabled={busy || activeEditing !== null} onClick={() => void act(retrySync)}>Retry rejected changes</button>
        <button type="button" className="row" disabled={busy || activeEditing !== null} onClick={() => {
          if (!window.confirm(`Discard ALL ${ev.pendingCount} pending changes and restore the cloud version? A recovery copy will remain on this device for download.`)) return
          void act(discardPendingChanges)
        }}>Discard all pending changes</button>
        <p>Discard restores the cloud version for the entire ledger. It also archives every pending change on this device. Download a recovery copy before clearing browser data.</p>
      </>}
      <button type="button" className="row" disabled={busy || activeEditing !== null} onClick={() => void act(async () => {
        downloadJson(await exportSyncRecovery(), 'ev-sync-recovery.json')
      })}>Download sync recovery copy</button>
      {ev.recoveryArchiveCount > 0 && <p>{ev.recoveryArchiveCount} recovery {ev.recoveryArchiveCount === 1 ? 'archive is' : 'archives are'} saved on this device. The recovery file is for review and manual recovery; it cannot be imported as a standard backup.</p>}
      {busy && <p role="status">Working…</p>}
      {message && <p role="alert">{message}</p>}
    </section>
  )
}
