import { useEffect, useMemo, useState } from 'react'
import { records } from '../lib/records'
import { shortDate } from '../lib/format'
import { useEv } from '../lib/useEv'
import { Icon } from './ui'

type RecordDetail = {
  icon: string
  name: string
  detail: string
  status: string
  progress?: number
  achieved: boolean
}

function RecordDetailPopup({ record, onClose }: { record: RecordDetail; onClose: () => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const progress = record.progress == null ? null : Math.round(Math.min(1, record.progress) * 100)

  return (
    <div className="record-detail-backdrop" role="presentation" onClick={onClose}>
      <section
        className={`record-detail-card ${record.achieved ? 'achieved' : 'open'}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="record-detail-title"
        aria-describedby="record-detail-description"
        onClick={event => event.stopPropagation()}
      >
        <button className="record-detail-close" type="button" aria-label="Close record details" onClick={onClose}>×</button>
        <div className="record-detail-icon" aria-hidden="true">
          <Icon name={record.icon} size={52} />
        </div>
        <p className="record-detail-status">{record.status}</p>
        <h2 id="record-detail-title">{record.name}</h2>
        <p id="record-detail-description" className="record-detail-description">{record.detail}</p>
        {progress != null && (
          <div className="record-detail-progress">
            <span><b>Progress</b><strong>{progress}%</strong></span>
            <div aria-hidden="true"><i style={{ width: `${progress}%` }} /></div>
          </div>
        )}
        <button className="primary-btn" type="button" onClick={onClose} autoFocus>Done</button>
      </section>
    </div>
  )
}

export default function RecordsSection({ ev }: { ev: ReturnType<typeof useEv> }) {
  const r = useMemo(() => records(ev), [ev])
  const [selected, setSelected] = useState<RecordDetail | null>(null)
  const trophyNames = new Set(r.trophies.map(t => t.name))
  const completedTargets = r.targets.filter(t => t.progress >= 1 && !trophyNames.has(t.name))
  const openTargets = r.targets.filter(t => t.progress < 1)
  const held = r.trophies.filter(t => t.unlocked).length + completedTargets.length
  const open = r.trophies.filter(t => !t.unlocked).length + openTargets.length

  return (
    <section id="records" className="records-section">
      <div className="sec-head">
        <h2 className="sec-h2">Records</h2>
      </div>
      <p className="sec-sub">
        Mined from your {ev.lifetime.sessions} charges · {held} held · {open} open
      </p>

      <div className="metric-grid" style={{ marginBottom: 8 }}>
        <div className="metric-card" style={{ gridColumn: '1 / -1' }}>
          <span>Free-charge streak</span>
          <strong>
            {r.currentStreak} free charge{r.currentStreak !== 1 ? 's' : ''} running
          </strong>
          <small>{r.streakNote}</small>
          {r.freezeCap > 0 && (
            <div className="freeze-row">
              {Array.from({ length: r.freezeCap }, (_, i) => (
                <span key={i} className={`freeze-chip ${i < r.freezesHeld ? '' : 'used'}`} aria-hidden="true">
                  <Icon name="rfreeze" size={13} />
                </span>
              ))}
              <span className="freeze-label">
                {r.freezesHeld > 0
                  ? `${r.freezesHeld} freeze earned at the Century milestone`
                  : 'earn a freeze at the Century milestone'}
              </span>
            </div>
          )}
        </div>
        {r.freezeSavedDate && (
          <div className="freepreview" style={{ gridColumn: '1 / -1' }}>
            Survived an overflow on {shortDate(r.freezeSavedDate)} with a freeze — the streak never noticed.
          </div>
        )}
      </div>

      <div className="trophy-grid">
        {r.trophies.map(t => (
          <div key={t.name} className={`trophy ${t.unlocked ? '' : 'locked'}`}>
            <button
              className="tico record-icon-button"
              type="button"
              aria-label={`View ${t.name} record status`}
              aria-haspopup="dialog"
              onClick={() => setSelected({
                icon: t.icon,
                name: t.name,
                detail: t.detail,
                status: t.unlocked ? 'Record held' : 'Not yet held',
                achieved: t.unlocked,
              })}
            >
              <Icon name={t.icon} size={19} />
            </button>
            <b>{t.name}</b>
            <small>{t.detail}</small>
          </div>
        ))}
        {completedTargets.map(t => (
          <div key={t.name} className="trophy">
            <button
              className="tico record-icon-button"
              type="button"
              aria-label={`View ${t.name} record status`}
              aria-haspopup="dialog"
              onClick={() => setSelected({
                icon: t.icon,
                name: t.name,
                detail: t.detail,
                status: 'Target achieved',
                progress: 1,
                achieved: true,
              })}
            >
              <Icon name={t.icon} size={19} />
            </button>
            <b>{t.name}</b>
            <small>{t.detail}</small>
          </div>
        ))}
      </div>

      {openTargets.length > 0 && (
        <>
          <p className="sec-sub" style={{ margin: '12px 0 8px' }}>
            Open targets
          </p>
          <div className="trophy-grid">
            {openTargets.map(t => (
              <div key={t.name} className="trophy target">
                <button
                  className="tico record-icon-button"
                  type="button"
                  aria-label={`View ${t.name} target status`}
                  aria-haspopup="dialog"
                  onClick={() => {
                    const progress = Math.min(1, t.progress)
                    setSelected({
                      icon: t.icon,
                      name: t.name,
                      detail: t.detail,
                      status: progress >= 1 ? 'Target achieved' : progress > 0 ? 'In progress' : 'Not started',
                      progress,
                      achieved: progress >= 1,
                    })
                  }}
                >
                  <Icon name={t.icon} size={19} />
                </button>
                <b>{t.name}</b>
                <span className="tbar">
                  <i style={{ width: `${Math.round(Math.min(1, t.progress) * 100)}%` }} />
                </span>
                <small>{t.detail}</small>
              </div>
            ))}
          </div>
        </>
      )}
      {selected && <RecordDetailPopup record={selected} onClose={() => setSelected(null)} />}
    </section>
  )
}
