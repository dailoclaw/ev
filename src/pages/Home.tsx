import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEv } from '../lib/useEv'
import { aud, kwh, monthTitle, thisMonth } from '../lib/format'
import { Icon } from '../components/ui'
import Donut from '../components/Donut'

export default function Home() {
  const navigate = useNavigate()
  const ev = useEv()
  const ym = thisMonth()

  const view = useMemo(() => {
    const cur = ev.months.find(m => m.month === ym)
    const [y, m] = ym.split('-').map(Number)
    const prevYm = (() => {
      const d = new Date(y, m - 2, 1)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    })()
    const prev = ev.months.find(x => x.month === prevYm)
    const deltaPct = prev && prev.cost > 0 && cur ? ((cur.cost - prev.cost) / prev.cost) * 100 : null
    return { cur, deltaPct, prevName: monthTitle(prevYm).split(' ')[0] }
  }, [ev, ym])

  const { cur, deltaPct, prevName } = view
  const freeKwh = cur?.freeKwh ?? 0
  const totalKwh = cur?.kwh ?? 0
  const paidKwh = Math.max(0, totalKwh - freeKwh)
  const freePct = totalKwh > 0 ? Math.round((freeKwh / totalKwh) * 100) : 0

  return (
    <main className="app-shell cv">
      <header className="appbar">
        <div>
          <p className="cv-eyebrow">{monthTitle(ym).split(' ')[0]}</p>
          <h1 className="cv-big">{aud(cur?.cost ?? 0)}</h1>
        </div>
        <button className="icon-btn" type="button" aria-label="Settings" onClick={() => navigate('/settings')}>
          <Icon name="gear" />
        </button>
      </header>

      <p className="cv-ctx">
        {totalKwh > 0 ? `${kwh(totalKwh)} kWh added.` : 'No charges yet this month.'}{' '}
        {deltaPct != null && (
          <em>
            {deltaPct > 0 ? 'Up' : 'Down'} {Math.abs(deltaPct).toFixed(0)}% on {prevName}.
          </em>
        )}
      </p>

      <Donut value={freeKwh} max={totalKwh} label={`${freePct}%`} sub="free energy" />

      <div className="cv-legend">
        <span>
          <i style={{ background: 'var(--money)' }} />
          {kwh(freeKwh, 1)} kWh free
        </span>
        <span>
          <i style={{ background: 'var(--bd)' }} />
          {kwh(paidKwh, 1)} paid
        </span>
      </div>

      <div className="cv-rows">
        <button className="cv-row" type="button" onClick={() => navigate('/statement')}>
          <span className="k">Budget</span>
          <span className="v">
            {aud(cur?.cost ?? 0, 0)} / {aud(ev.budgetCap, 0)}
          </span>
          <span className="c" aria-hidden="true">
            ›
          </span>
        </button>
        <button className="cv-row" type="button" onClick={() => navigate('/savings')}>
          <span className="k">Saved on free</span>
          <span className="v">{aud(cur?.saved ?? 0)}</span>
          <span className="c" aria-hidden="true">
            ›
          </span>
        </button>
      </div>
    </main>
  )
}
