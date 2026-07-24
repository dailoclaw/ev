import { useRef, useState } from 'react'
import { useEv } from '../lib/useEv'
import {
  buildBackup,
  buildCsv,
  downloadCsv,
  downloadJson,
  lastBackupAt,
  markBackedUp,
  parseBackup,
  previewRestore,
  restoreMerge,
  restoreReplaceLocal,
  restoreReplaceRemote,
  setBudgetCap,
  setProviderArchived,
  setProviderOrder,
  updateProvider,
  type Backup,
} from '../lib/data'
import { aud, stamp, todayIso } from '../lib/format'
import { useTheme } from '../lib/theme'
import { Icon, Mark, SyncBadge } from '../components/ui'
import WhatsNewSheet from '../components/WhatsNewSheet'

type Pending = { backup: Backup; providersNew: number; sessionsNew: number; totalSessions: number; totalProviders: number }

export default function Settings() {
  const ev = useEv()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [exported, setExported] = useState(false)
  const [theme, setTheme] = useTheme()
  const [showWhatsNew, setShowWhatsNew] = useState(false)

  const [lastBackup, setLastBackup] = useState<string | null>(lastBackupAt())
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const [restoreDone, setRestoreDone] = useState<string | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [replacing, setReplacing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const activeProviders = ev.providers.filter(p => !p.archived)
  const moveProvider = (id: string, dir: -1 | 1) => {
    const ids = activeProviders.map(p => p.id)
    const idx = ids.indexOf(id)
    const swapIdx = idx + dir
    if (swapIdx < 0 || swapIdx >= ids.length) return
    ;[ids[idx], ids[swapIdx]] = [ids[swapIdx], ids[idx]]
    const archivedIds = ev.providers.filter(p => p.archived).map(p => p.id)
    setProviderOrder([...ids, ...archivedIds])
  }

  const exportAll = () => {
    downloadCsv(buildCsv(ev.sessions), 'ev-charging-export.csv')
    setExported(true)
    setTimeout(() => setExported(false), 2000)
  }

  const downloadBackup = () => {
    downloadJson(buildBackup(), `ev-command-backup-${todayIso()}.json`)
    markBackedUp()
    setLastBackup(lastBackupAt())
  }

  const onFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setRestoreError(null)
    setRestoreDone(null)
    setConfirmText('')
    const text = await file.text()
    const backup = parseBackup(text)
    if (!backup) {
      setRestoreError('Could not read that file — expecting an EV Command backup JSON.')
      return
    }
    setPending({ backup, ...previewRestore(backup) })
  }

  const confirmMerge = () => {
    if (!pending) return
    const { providersAdded, sessionsAdded } = restoreMerge(pending.backup)
    setRestoreDone(
      `Added ${sessionsAdded} charge${sessionsAdded === 1 ? '' : 's'}` +
        (providersAdded ? ` and ${providersAdded} provider${providersAdded === 1 ? '' : 's'}` : '') +
        (ev.synced ? ' — synced to Supabase.' : '.'),
    )
    setPending(null)
  }

  const confirmReplace = async () => {
    if (!pending) return
    setReplacing(true)
    try {
      if (ev.synced) {
        const { sessionsAdded } = await restoreReplaceRemote(pending.backup)
        setRestoreDone(`Replaced Supabase with the backup — ${sessionsAdded} charges restored.`)
      } else {
        restoreReplaceLocal(pending.backup)
        setRestoreDone(`Replaced your ledger with the backup — ${pending.totalSessions} charges restored.`)
      }
      setPending(null)
      setConfirmText('')
    } catch (err) {
      setRestoreError(
        (err instanceof Error ? err.message : 'Replace failed.') +
          (ev.synced ? ' Check Supabase directly — the wipe may have completed before this error.' : ''),
      )
    } finally {
      setReplacing(false)
    }
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
      <p className="sec-sub">Free allowances are per-charger settings — they drive every savings figure. Order here is the order chargers appear when logging a charge.</p>
      {activeProviders.map((p, i) => (
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
                <div className="row" style={{ marginTop: 10, marginBottom: 0, boxShadow: 'none', padding: '10px 12px' }}>
                  <span>
                    <strong style={{ fontSize: 12 }}>Order in pickers</strong>
                    <small>Position {i + 1} of {activeProviders.length}</small>
                  </span>
                  <span style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className="text-btn"
                      style={{ color: i === 0 ? 'var(--bd)' : 'var(--fnt)' }}
                      disabled={i === 0}
                      onClick={() => moveProvider(p.id, -1)}
                      aria-label={`Move ${p.name} up`}
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      className="text-btn"
                      style={{ color: i === activeProviders.length - 1 ? 'var(--bd)' : 'var(--fnt)' }}
                      disabled={i === activeProviders.length - 1}
                      onClick={() => moveProvider(p.id, 1)}
                      aria-label={`Move ${p.name} down`}
                    >
                      ▼
                    </button>
                  </span>
                </div>
                <button
                  type="button"
                  className="text-btn"
                  style={{ marginTop: 10, color: 'var(--fnt)' }}
                  onClick={() => {
                    setProviderArchived(p.id, true)
                    setEditingId(null)
                  }}
                >
                  Archive this charger ›
                </button>
              </div>
            )}
          </div>
        ))}
      <p className="sec-sub" style={{ marginTop: 2 }}>
        Add a new charger type from the + Add charge sheet.
      </p>

      {ev.providers.some(p => p.archived) && (
        <>
          <p className="sec-sub" style={{ marginTop: 12, marginBottom: 8 }}>
            Archived — hidden from pickers, still counted in every total
          </p>
          {ev.providers
            .filter(p => p.archived)
            .map(p => (
              <div className="row" key={p.id} style={{ opacity: 0.6 }}>
                <Mark provider={p} />
                <span>
                  <strong>{p.name}</strong>
                  <small>Archived</small>
                </span>
                <button
                  type="button"
                  className="text-btn"
                  style={{ whiteSpace: 'nowrap' }}
                  onClick={() => setProviderArchived(p.id, false)}
                >
                  Unarchive
                </button>
              </div>
            ))}
        </>
      )}

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

      <h2 className="sec-h2">Backup &amp; Restore</h2>
      <p className="sec-sub">
        A complete, portable copy of your ledger — separate from the CSV export and separate from cloud sync.
      </p>
      <button className="row" type="button" onClick={downloadBackup}>
        <span className="mark" style={{ ['--pc' as string]: '#334155' }}>
          <Icon name="dl" size={17} />
        </span>
        <span>
          <strong>Download backup</strong>
          <small>
            {ev.sessions.length} charges · {ev.providers.length} provider{ev.providers.length === 1 ? '' : 's'} · all settings
          </small>
        </span>
        <b className="amt chev">
          <Icon name="chev" size={17} />
        </b>
      </button>
      <div className="row">
        <span className="mark" style={{ ['--pc' as string]: 'var(--fnt)' }}>
          <Icon name="rcalcheck" size={17} />
        </span>
        <span>
          <strong>Last backup</strong>
          <small>{lastBackup ? stamp(lastBackup) : 'none yet'}</small>
        </span>
      </div>
      <button className="row" type="button" onClick={() => fileInputRef.current?.click()}>
        <span className="mark" style={{ ['--pc' as string]: '#334155' }}>
          <Icon name="book" size={17} />
        </span>
        <span>
          <strong>Restore from file</strong>
          <small>Reads a backup JSON — nothing changes until you confirm</small>
        </span>
        <b className="amt chev">
          <Icon name="chev" size={17} />
        </b>
      </button>
      <input ref={fileInputRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={onFileChosen} />

      {restoreError && (
        <p className="sec-sub" style={{ color: 'var(--neg)', fontWeight: 700 }}>
          {restoreError}
        </p>
      )}
      {restoreDone && (
        <p className="sec-sub" style={{ color: 'var(--money-deep)', fontWeight: 700 }}>
          {restoreDone}
        </p>
      )}

      {pending && (
        <div className="hero-card" style={{ marginTop: 0 }}>
          <span className="cap" style={{ marginBottom: 8 }}>
            Restore preview
          </span>
          <p style={{ fontSize: 13, color: 'var(--tx)', marginBottom: 12, lineHeight: 1.5 }}>
            This file has {pending.totalSessions} charge{pending.totalSessions === 1 ? '' : 's'} and{' '}
            {pending.totalProviders} provider{pending.totalProviders === 1 ? '' : 's'}.{' '}
            <b>
              {pending.sessionsNew} new charge{pending.sessionsNew === 1 ? '' : 's'}
            </b>{' '}
            {pending.sessionsNew === 1 ? "isn't" : "aren't"} in your ledger yet
            {pending.providersNew > 0
              ? `, along with ${pending.providersNew} new provider${pending.providersNew === 1 ? '' : 's'}`
              : ''}
            .
          </p>

          <button className="row" type="button" onClick={confirmMerge} style={{ marginBottom: 8 }}>
            <span className="mark" style={{ ['--pc' as string]: '#059669' }}>
              <Icon name="dl" size={17} />
            </span>
            <span>
              <strong>Merge safely</strong>
              <small>{ev.synced ? 'Adds the new rows and syncs them to Supabase' : 'Adds the new rows to this device'}</small>
            </span>
          </button>

          <p style={{ fontSize: 11.5, color: 'var(--fnt)', fontWeight: 700, marginTop: 4, marginBottom: 6 }}>
            REPLACE EVERYTHING INSTEAD
          </p>
          <p style={{ fontSize: 12.5, color: 'var(--mut)', marginBottom: 8 }}>
            {ev.synced
              ? 'Deletes every charge and charger currently in Supabase, then reinserts the backup. Permanent — this cannot be undone from within the app.'
              : 'Overwrites everything on this device with the backup. You can undo this by restoring your previous backup file.'}
          </p>
          {ev.synced && (
            <input
              type="text"
              placeholder='Type REPLACE to confirm'
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 10,
                border: '1px solid var(--bd)',
                background: 'var(--surf)',
                color: 'var(--tx)',
                fontSize: 13,
                marginBottom: 8,
              }}
            />
          )}
          <button
            className="row"
            type="button"
            disabled={replacing || (ev.synced && confirmText.trim() !== 'REPLACE')}
            onClick={confirmReplace}
            style={{ opacity: replacing || (ev.synced && confirmText.trim() !== 'REPLACE') ? 0.45 : 1, marginBottom: 8 }}
          >
            <span className="mark" style={{ ['--pc' as string]: 'var(--neg)' }}>
              <Icon name="rcalcheck" size={17} />
            </span>
            <span>
              <strong>{replacing ? 'Replacing…' : 'Replace everything'}</strong>
              <small>{ev.synced ? 'Wipes and restores Supabase' : 'Wipes and restores this device'}</small>
            </span>
          </button>

          <button type="button" className="text-btn" onClick={() => setPending(null)}>
            Cancel
          </button>
        </div>
      )}

      <button type="button" className="app-footer" style={{ width: '100%', border: 0, background: 'none' }} onClick={() => setShowWhatsNew(true)}>
        EV Command v3.6.10 · Cockpit Ledger · what's new ›
      </button>

      {showWhatsNew && <WhatsNewSheet onClose={() => setShowWhatsNew(false)} />}
    </main>
  )
}
