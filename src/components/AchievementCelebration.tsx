import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { records, type RecordAchievement } from '../lib/records'
import { useEv } from '../lib/useEv'
import { Icon } from './ui'

const SEEN_KEY = 'ev.seenRecordAchievements.v1'
const AUTO_DISMISS_MS = 3800
const SUMMARY_THRESHOLD = 4

type Celebration = RecordAchievement & { count?: number }

const PREVIEW_ACHIEVEMENT: Celebration = {
  id: 'achievement-preview',
  icon: 'rstreak',
  name: 'Century streak',
  detail: '100 fully free charges in a row',
}

const loadSeen = (): Set<string> | null => {
  try {
    const stored = localStorage.getItem(SEEN_KEY)
    if (stored == null) return null
    const parsed = JSON.parse(stored)
    return Array.isArray(parsed) ? new Set(parsed.filter((id): id is string => typeof id === 'string')) : new Set()
  } catch {
    return null
  }
}

const saveSeen = (seen: Set<string>) => {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen].sort()))
  } catch {
    // Achievement playback still works for this session when storage is unavailable.
  }
}

export default function AchievementCelebration({ preview = false }: { preview?: boolean }) {
  const ev = useEv()
  const navigate = useNavigate()
  const achievements = useMemo(() => records(ev).achievements, [ev])
  const initialized = useRef(false)
  const seen = useRef(new Set<string>())
  const [queue, setQueue] = useState<Celebration[]>(() => preview ? [PREVIEW_ACHIEVEMENT] : [])
  const active = queue[0]

  useEffect(() => {
    if (preview) return
    if (ev.loading) return

    if (!initialized.current) {
      initialized.current = true
      const stored = loadSeen()
      if (stored == null) {
        seen.current = new Set(achievements.map(achievement => achievement.id))
        saveSeen(seen.current)
        return
      }
      seen.current = stored
    }

    const fresh = achievements.filter(achievement => !seen.current.has(achievement.id))
    if (fresh.length === 0) return

    for (const achievement of fresh) seen.current.add(achievement.id)
    saveSeen(seen.current)

    const additions: Celebration[] =
      fresh.length >= SUMMARY_THRESHOLD
        ? [
            {
              id: `achievement-summary-${fresh.map(achievement => achievement.id).join('-')}`,
              icon: 'rtarget',
              name: `${fresh.length} records discovered`,
              detail: 'Your latest ledger update crossed several milestones.',
              count: fresh.length,
            },
          ]
        : fresh
    setQueue(current => [...current, ...additions])
  }, [achievements, ev.loading, preview])

  const dismiss = useCallback(() => {
    setQueue(current => current.slice(1))
  }, [])

  useEffect(() => {
    if (!active || preview) return
    const timer = window.setTimeout(dismiss, AUTO_DISMISS_MS)
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [active, dismiss, preview])

  if (!active) return null

  const viewRecords = () => {
    if (preview) {
      window.location.reload()
      return
    }
    dismiss()
    navigate('/vehicle#records')
    window.dispatchEvent(new Event('ev:view-records'))
    let attempts = 0
    const scrollToRecords = () => {
      const section = document.getElementById('records')
      if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' })
        return
      }
      attempts += 1
      if (attempts < 8) window.setTimeout(scrollToRecords, 80)
    }
    window.setTimeout(scrollToRecords, 0)
  }

  return (
    <div className="achievement-backdrop" role="presentation" onClick={dismiss}>
      <section
        className="achievement-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="achievement-title"
        aria-describedby="achievement-detail"
        onClick={event => event.stopPropagation()}
      >
        <div className="achievement-rays" aria-hidden="true" />
        <div className="achievement-burst" aria-hidden="true">
          {Array.from({ length: 12 }, (_, index) => <i key={index} />)}
        </div>
        <div className="achievement-mark" aria-hidden="true">
          {active.count ? <strong>{active.count}</strong> : <Icon name={active.icon} size={31} />}
        </div>
        <p className="achievement-eyebrow">{active.count ? 'Records discovered' : 'Record achieved'}</p>
        <h2 id="achievement-title">{active.name}</h2>
        <p id="achievement-detail" className="achievement-detail">{active.detail}</p>
        <div className="achievement-progress" aria-hidden="true"><i /></div>
        <div className="achievement-actions">
          <button className="primary-btn" type="button" onClick={viewRecords}>{preview ? 'Replay Animation' : 'View Records'}</button>
          <button className="text-btn" type="button" onClick={dismiss} autoFocus>Continue</button>
        </div>
      </section>
    </div>
  )
}
