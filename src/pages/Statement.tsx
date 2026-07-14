import { useMemo, useState } from 'react'
import { useEv } from '../lib/useEv'
import type { EnrichedSession } from '../lib/savings'
import { buildCsv, downloadCsv } from '../lib/data'
import { aud, dayHeader, kwh, monthTitle, rate, thisMonth } from '../lib/format'
import { FreeTag, Icon, Mark } from '../components/ui'
import ReceiptSheet from '../components/ReceiptSheet'

export default function Statement() {
  const ev = useEv()
  const monthsDesc = useMemo(() => [...ev.months].reverse(), [ev.months])
  const [ym, setYm] = useState(() => monthsDesc[0]?.month ?? thisMonth())
  const [receipt, setReceipt] = useState<EnrichedSession | null>(null)

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

  const exportMonth = () => {
    downloadCsv(buildCsv(monthSessions), `ev-charging-${ym}.csv`)
  }

  return (
    <main className="app-shell">
      <header className="appbar">
        <div>
          <p className="eyebrow">Statement</p>
          <h1>{cur ? monthTitle(cur.month) : monthTitle(ym)}</h1>
          <span className="sub">{cur ? `${cur.sessions} charges · ${kwh(cur.kwh)} kWh` : 'No charges this month'}</span>
        </div>
        <button className="icon-btn" type="button" aria-label="Export month CSV" onClick={exportMonth}>
          <Icon name="dl" />
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
            <div style={{ fontSize: 26, fontWeight: 800, marginTop: 4 }}>{aud(cur.cost)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span className="cap" style={{ color: 'var(--money-deep)' }}>
              Saved free
            </span>
            <div style={{ fontSize: 26, fontWeight: 800, marginTop: 4, color: 'var(--money-deep)' }}>{aud(cur.saved)}</div>
          </div>
        </section>
      )}

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
              <button className="row" type="button" key={s.id} onClick={() => setReceipt(s)}>
                <Mark provider={provider} name={s.type} />
                <span>
                  <strong>
                    {s.isFee ? `${s.type} membership` : s.type}
                    {s.cost === 0 && s.freeKwh > 0 && <FreeTag />}
                  </strong>
                  <small>
                    {s.isFee
                      ? 'monthly charge — funds the free allowance'
                      : `${s.amount.toFixed(1)} kWh · ${
                          s.freeKwh > 0 && s.paidKwh > 0
                            ? `${s.freeKwh.toFixed(1)} free + ${s.paidKwh.toFixed(1)} paid`
                            : s.freeKwh > 0
                              ? 'allowance covered it'
                              : `${rate(s.rate)}/kWh`
                        }`}
                  </small>
                </span>
                <b className="amt">{aud(s.cost)}</b>
              </button>
            )
          })}
        </section>
      ))}

      {monthSessions.length > 0 && (
        <button className="ghost-btn" type="button" style={{ marginTop: 10 }} onClick={exportMonth}>
          ⬇ Download {cur?.label ?? ym} CSV
        </button>
      )}

      {receipt && (
        <ReceiptSheet
          session={receipt}
          provider={ev.providers.find(p => p.name === receipt.type)}
          onClose={() => setReceipt(null)}
        />
      )}
    </main>
  )
}
