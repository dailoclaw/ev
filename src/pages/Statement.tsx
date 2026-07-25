import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useEv } from '../lib/useEv'
import type { EnrichedSession } from '../lib/savings'
import type { Session } from '../lib/savings'
import type { Provider } from '../lib/providers'
import { aud, dayHeader, kwh, monthTitle, rate, thisMonth } from '../lib/format'
import { FreeTag, Icon, Mark } from '../components/ui'
import ReceiptSheet from '../components/ReceiptSheet'
import EditSessionSheet from '../components/EditSessionSheet'
import MonthNarrative from '../components/MonthNarrative'
import CountUpNumber from '../components/CountUpNumber'
import { narrateMonth } from '../lib/narrate'
import { deleteSession, undoDeleteSession } from '../lib/data'

const SWIPE_ACTIONS_WIDTH = 84

function SessionRow({
  session,
  provider,
  open,
  onOpenChange,
  onTap,
  onEdit,
  onDelete,
}: {
  session: EnrichedSession
  provider?: Provider
  open: boolean
  onOpenChange: (id: string | null) => void
  onTap: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const contentRef = useRef<HTMLButtonElement>(null)
  const dragging = useRef<{ startX: number; startedOpen: boolean; moved: boolean } | null>(null)
  const showMicroSplit = !session.isFee && session.amount > 0
  const freePct = showMicroSplit ? Math.max(0, Math.min(100, (session.freeKwh / session.amount) * 100)) : 0
  const paidPct = showMicroSplit ? Math.max(0, 100 - freePct) : 0

  const setTx = (px: number, animate: boolean) => {
    const el = contentRef.current
    if (!el) return
    el.style.transition = animate ? 'transform 0.18s ease' : 'none'
    el.style.transform = `translateX(${px}px)`
  }

  useEffect(() => {
    setTx(open ? -SWIPE_ACTIONS_WIDTH : 0, true)
  }, [open])

  const onTouchStart = (e: React.TouchEvent) => {
    dragging.current = { startX: e.touches[0].clientX, startedOpen: open, moved: false }
  }
  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragging.current) return
    const dx = e.touches[0].clientX - dragging.current.startX
    if (Math.abs(dx) > 4) dragging.current.moved = true
    const base = dragging.current.startedOpen ? -SWIPE_ACTIONS_WIDTH : 0
    const next = Math.min(0, Math.max(-SWIPE_ACTIONS_WIDTH, base + dx))
    setTx(next, false)
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!dragging.current) return
    const dx = e.changedTouches[0].clientX - dragging.current.startX
    const base = dragging.current.startedOpen ? -SWIPE_ACTIONS_WIDTH : 0
    const finalPx = base + dx
    const moved = dragging.current.moved
    dragging.current = null
    if (!moved) {
      // a tap, not a drag
      if (open) onOpenChange(null)
      else onTap()
      return
    }
    const shouldOpen = finalPx < -SWIPE_ACTIONS_WIDTH / 2
    onOpenChange(shouldOpen ? session.id : null)
  }

  return (
    <div className="swiperow">
      <div className="swipe-actions">
        <button type="button" className="edit" onClick={onEdit} aria-label="Edit charge">
          <Icon name="edit" size={16} />
        </button>
        <button type="button" className="del" onClick={onDelete} aria-label="Delete charge">
          <Icon name="trash" size={16} />
        </button>
      </div>
      <button
        className="row swipe-content"
        type="button"
        ref={contentRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <Mark provider={provider} name={session.type} />
        <span>
          <strong>
            {session.isFee ? `${session.type} membership` : session.type}
            {session.cost === 0 && session.freeKwh > 0 && <FreeTag />}
          </strong>
          <small>
            {session.isFee
              ? 'monthly charge — funds the free allowance'
              : `${session.amount.toFixed(1)} kWh · ${
                  session.freeKwh > 0 && session.paidKwh > 0
                    ? `${session.freeKwh.toFixed(1)} free + ${session.paidKwh.toFixed(1)} paid`
                    : session.freeKwh > 0
                      ? 'allowance covered it'
                      : `${rate(session.rate)}/kWh`
                }`}
          </small>
          {showMicroSplit && (
            <span className="row-micro-split" aria-hidden="true">
              <i className="free" style={{ width: `${freePct}%` }} />
              <i className="paid" style={{ width: `${paidPct}%` }} />
            </span>
          )}
        </span>
        <b className="amt">{aud(session.cost)}</b>
      </button>
    </div>
  )
}

export default function Statement() {
  const ev = useEv()
  const loc = useLocation()
  const navigate = useNavigate()
  const monthsDesc = useMemo(() => [...ev.months].reverse(), [ev.months])
  const [ym, setYm] = useState(() => {
    const requested = (loc.state as { month?: string } | null)?.month
    return requested ?? monthsDesc[0]?.month ?? thisMonth()
  })
  const [receipt, setReceipt] = useState<EnrichedSession | null>(null)
  const [editing, setEditing] = useState<EnrichedSession | null>(null)
  const [openRowId, setOpenRowId] = useState<string | null>(null)
  const [snack, setSnack] = useState<{ session: Session; msg: string } | null>(null)
  const snackTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleDelete = async (s: EnrichedSession) => {
    setOpenRowId(null)
    try {
      const removed = await deleteSession(s.id)
      if (removed) {
        if (snackTimer.current) clearTimeout(snackTimer.current)
        setSnack({ session: removed, msg: `${s.isFee ? 'Fee' : 'Charge'} deleted` })
        snackTimer.current = setTimeout(() => setSnack(null), 6000)
      }
    } catch {
      // optimistic state already reverted inside deleteSession
    }
  }

  const handleUndo = () => {
    if (!snack) return
    undoDeleteSession(snack.session)
    if (snackTimer.current) clearTimeout(snackTimer.current)
    setSnack(null)
  }

  const idx = monthsDesc.findIndex(m => m.month === ym)
  const cur = monthsDesc[idx]
  const newer = monthsDesc[idx - 1]
  const older = monthsDesc[idx + 1]

  const monthSessions = useMemo(
    () => ev.sessionsDesc.filter(s => s.date.startsWith(ym)),
    [ev.sessionsDesc, ym],
  )
  const byDay = useMemo(() => {
    const groups: Array<{ date: string; sessions: EnrichedSession[]; cost: number; saved: number }> = []
    for (const s of monthSessions) {
      let g = groups[groups.length - 1]
      if (!g || g.date !== s.date) {
        g = { date: s.date, sessions: [], cost: 0, saved: 0 }
        groups.push(g)
      }
      g.sessions.push(s)
      g.cost += s.cost
      g.saved += s.savedValue
    }
    return groups
  }, [monthSessions])

  const narrative = useMemo(() => {
    if (!cur) return null
    const [y, mo] = ym.split('-').map(Number)
    const daysInMonth = new Date(y, mo, 0).getDate()
    const now = new Date()
    const isThisMonth = ym === thisMonth()
    const daysElapsed = isThisMonth ? now.getDate() : daysInMonth
    const prev = ev.months[ev.months.findIndex(m => m.month === ym) - 1]
    return narrateMonth(cur, monthSessions, prev, daysElapsed, daysInMonth)
  }, [cur, ym, monthSessions, ev.months])

  return (
    <main className="app-shell">
      <header className="appbar">
        <div>
          <p className="eyebrow">Statement</p>
          <h1>{cur ? monthTitle(cur.month) : monthTitle(ym)}</h1>
          <span className="sub">{cur ? `${cur.sessions} charges · ${kwh(cur.kwh)} kWh` : 'No charges this month'}</span>
        </div>
        <button className="icon-btn" type="button" aria-label="Back" onClick={() => navigate(-1)}>
          <Icon name="back" />
        </button>
      </header>

      <div className="seg" aria-label="Change month">
        <button type="button" disabled={!older} style={{ opacity: older ? 1 : 0.35 }} onClick={() => older && setYm(older.month)}>
          ‹ {older ? older.label.split(' ')[0] : '—'}
        </button>
        <button type="button" className="on">
          {cur ? cur.label.split(' ')[0] : monthTitle(ym).split(' ')[0]}
        </button>
        <button type="button" disabled={!newer} style={{ opacity: newer ? 1 : 0.35 }} onClick={() => newer && setYm(newer.month)}>
          {newer ? newer.label.split(' ')[0] : '—'} ›
        </button>
      </div>

      {cur && (
        <section className="hero-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span className="cap">Paid</span>
            <div style={{ fontSize: 26, fontWeight: 800, marginTop: 4 }}>
              <CountUpNumber value={cur.cost} format={aud} durationMs={820} />
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span className="cap" style={{ color: 'var(--money-deep)' }}>
              Saved free
            </span>
            <div style={{ fontSize: 26, fontWeight: 800, marginTop: 4, color: 'var(--money-deep)' }}>
              <CountUpNumber value={cur.saved} format={aud} durationMs={820} />
            </div>
          </div>
        </section>
      )}

      {narrative && <MonthNarrative narrative={narrative} ev={ev} ym={ym} />}

      {byDay.length === 0 && (
        <div className="emptybat">
          <div className="batt">
            <i />
          </div>
          <b>No charges this month</b>
          <p>Log one with the + button and it lands here instantly.</p>
        </div>
      )}

      {byDay.map(g => (
        <section key={g.date}>
          <div className="dayhead">
            <span>{dayHeader(g.date)}</span>
            <span>
              {g.sessions.length} charge{g.sessions.length > 1 ? 's' : ''} · {aud(g.cost)}
              {g.saved > 0 && ` · saved ${aud(g.saved)}`}
            </span>
          </div>
          {g.sessions.map(s => {
            const provider = ev.providers.find(p => p.name === s.type)
            return (
              <SessionRow
                key={s.id}
                session={s}
                provider={provider}
                open={openRowId === s.id}
                onOpenChange={setOpenRowId}
                onTap={() => setReceipt(s)}
                onEdit={() => {
                  setOpenRowId(null)
                  setEditing(s)
                }}
                onDelete={() => handleDelete(s)}
              />
            )
          })}
        </section>
      ))}

      {receipt && (
        <ReceiptSheet
          session={receipt}
          provider={ev.providers.find(p => p.name === receipt.type)}
          onClose={() => setReceipt(null)}
        />
      )}

      {editing && <EditSessionSheet session={editing} onClose={() => setEditing(null)} />}

      {snack && (
        <div className="snackbar">
          <span>{snack.msg}</span>
          <button type="button" onClick={handleUndo}>
            Undo
          </button>
        </div>
      )}
    </main>
  )
}
