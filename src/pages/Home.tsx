import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEv } from '../lib/useEv'
import { allowanceUsedOn } from '../lib/savings'
import { aud, kwh, monthTitle, thisMonth, todayIso, shortDate, rate } from '../lib/format'
import { FreeTag, Icon, Mark, Ring, Thermo } from '../components/ui'
import Explainable from '../components/Explainable'
import { deriveMonthSpend } from '../lib/derive'
import CountUpNumber from '../components/CountUpNumber'

export default function Home() {
  const navigate = useNavigate()
  const ev = useEv()
  const ym = thisMonth()

  const view = useMemo(() => {
    const cur = ev.months.find(m => m.month === ym)
    const prevYm = (() => {
      const [y, m] = ym.split('-').map(Number)
      const d = new Date(y, m - 2, 1)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    })()
    const prev = ev.months.find(m => m.month === prevYm)
    const deltaPct = prev && prev.cost > 0 && cur ? ((cur.cost - prev.cost) / prev.cost) * 100 : null

    // budget projection: linear on day-of-month
    const now = new Date()
    const dayOfMonth = now.getDate()
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const projected = cur ? (cur.cost / Math.max(1, dayOfMonth)) * daysInMonth : 0

    // today's allowance across providers that have one
    const freeProvider = ev.providers.find(p => p.freeKwhPerDay > 0)
    const usedToday = freeProvider ? allowanceUsedOn(ev.sessions, freeProvider.name, todayIso()) : 0

    return { cur, deltaPct, projected, freeProvider, usedToday }
  }, [ev, ym])

  const { cur, deltaPct, projected, freeProvider, usedToday } = view
  const freePctOfKwh = cur && cur.kwh > 0 ? Math.round((cur.freeKwh / cur.kwh) * 100) : 0
  const topAccounts = ev.byProvider.slice(0, 2)
  const recent = ev.sessionsDesc.slice(0, 3)

  return (
    <main className="app-shell">
      <header className="appbar">
        <div>
          <p className="eyebrow">EV Command</p>
          <h1>{monthTitle(ym).split(' ')[0]}</h1>
          <span className="sub">
            {cur ? `${cur.sessions} charges · ${kwh(cur.kwh)} kWh` : 'No charges yet this month'}
          </span>
        </div>
        <button className="icon-btn" type="button" aria-label="Settings" onClick={() => navigate('/settings')}>
          <Icon name="gear" />
        </button>
      </header>

      <section className="hero-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <div>
            <span className="cap">Spent this month</span>
            <Explainable derive={() => deriveMonthSpend(ev, ym)} label="Spent this month">
              <CountUpNumber className="hero-num countup-num" value={cur?.cost ?? 0} format={aud} />
            </Explainable>
          </div>
          {deltaPct != null && (
            <span className={`delta ${deltaPct > 0 ? 'up' : ''}`}>
              {deltaPct > 0 ? '▲' : '▼'} {Math.abs(deltaPct).toFixed(0)}% vs last mo
            </span>
          )}
        </div>
        <p className="hero-sub">
          {cur ? `${kwh(cur.kwh)} kWh added · ${freePctOfKwh}% of it free` : 'Tap + to log your first charge'}
        </p>
      </section>

      {freeProvider && (
        <button
          className="savecard"
          type="button"
          style={{ width: '100%', textAlign: 'left', cursor: 'pointer' }}
          onClick={() => navigate('/savings')}
        >
          <span className="bolt">⚡</span>
          <span className="cap">Free {freeProvider.name} energy · {monthTitle(ym).split(' ')[0]}</span>
          <b className="big">
            <CountUpNumber value={cur?.saved ?? 0} format={aud} durationMs={780} /> saved
          </b>
          <small>
            {kwh(cur?.freeKwh ?? 0, 1)} kWh free this month · lifetime <b>{aud(ev.lifetime.netSaved, 0)}</b> net
            <br />
            Today: {usedToday.toFixed(1)} of {freeProvider.freeKwhPerDay} kWh free used
          </small>
          <span className="ringside">
            <Ring
              value={usedToday}
              max={freeProvider.freeKwhPerDay}
              label={usedToday.toFixed(1)}
              sub={`of ${freeProvider.freeKwhPerDay}`}
            />
          </span>
        </button>
      )}

      <section className="hero-card" style={{ paddingBottom: 14 }}>
        <span className="cap" style={{ marginBottom: 10 }}>
          {monthTitle(ym).split(' ')[0]} budget ·{' '}
          <CountUpNumber className="countup-inline" value={ev.budgetCap} format={value => aud(value, 0)} durationMs={650} />
        </span>
        <Thermo spent={cur?.cost ?? 0} projected={projected} cap={ev.budgetCap} />
        <div className="thermoleg">
          <span>{aud(cur?.cost ?? 0)} spent</span>
          {projected > (cur?.cost ?? 0) && <span className="warn">projected {aud(projected, 0)}</span>}
          <span>cap {aud(ev.budgetCap, 0)}</span>
        </div>
      </section>

      <div className="sec-head">
        <h2 className="sec-h2">Accounts</h2>
        <button className="text-btn" type="button" onClick={() => navigate('/accounts')}>
          View all
        </button>
      </div>
      <p className="sec-sub">Spend by charger network.</p>
      {topAccounts.map(p => {
        const provider = ev.providers.find(x => x.name === p.name)
        return (
          <button
            className="row"
            type="button"
            key={p.name}
            onClick={() => navigate(`/accounts/${encodeURIComponent(p.name)}`)}
          >
            <Mark provider={provider} name={p.name} />
            <span>
              <strong>
                {p.name}
                {provider && provider.freeKwhPerDay > 0 && <FreeTag>{provider.freeKwhPerDay} kWh/day FREE</FreeTag>}
              </strong>
              <small>
                {p.sessions} charges · effective {rate(p.effectiveRate)}/kWh
              </small>
            </span>
            <b className="amt">{aud(p.cost)}</b>
          </button>
        )
      })}

      <div className="sec-head">
        <h2 className="sec-h2">Recent</h2>
        <button className="text-btn" type="button" onClick={() => navigate('/statement')}>
          Statement
        </button>
      </div>
      <p className="sec-sub">Latest charges.</p>
      {recent.map(s => {
        const provider = ev.providers.find(x => x.name === s.type)
        return (
          <div className="row" key={s.id}>
            <Mark provider={provider} name={s.type} />
            <span>
              <strong>
                {s.type}
                {s.cost === 0 && s.freeKwh > 0 && <FreeTag />}
              </strong>
              <small>
                {shortDate(s.date)} · {s.amount.toFixed(1)} kWh · {rate(s.rate)}/kWh
              </small>
            </span>
            <b className="amt">{aud(s.cost)}</b>
          </div>
        )
      })}

      <footer className="app-footer">EV Command v3.6.16 · Cockpit Ledger</footer>
    </main>
  )
}
