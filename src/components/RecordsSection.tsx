import { useMemo } from 'react'
import { records } from '../lib/records'
import { shortDate } from '../lib/format'
import { useEv } from '../lib/useEv'
import { Icon } from './ui'

export default function RecordsSection({ ev }: { ev: ReturnType<typeof useEv> }) {
  const r = useMemo(() => records(ev), [ev])
  const held = r.trophies.filter(t => t.unlocked).length
  const open = r.trophies.length - held + r.targets.length

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
            <span className="tico" aria-hidden="true">
              <Icon name={t.icon} size={19} />
            </span>
            <b>{t.name}</b>
            <small>{t.detail}</small>
          </div>
        ))}
      </div>

      {r.targets.length > 0 && (
        <>
          <p className="sec-sub" style={{ margin: '12px 0 8px' }}>
            Open targets
          </p>
          <div className="trophy-grid">
            {r.targets.map(t => (
              <div key={t.name} className="trophy target">
                <span className="tico" aria-hidden="true">
                  <Icon name={t.icon} size={19} />
                </span>
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
    </section>
  )
}
