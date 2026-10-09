import { providerAccountPath } from '../lib/accountRoutes'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEv } from '../lib/useEv'
import { dailyAllowances, matchedMonthSpend } from '../lib/analyticsPeriods'
import { aud, kwh, monthTitle, thisMonth, todayIso, shortDate, rate } from '../lib/format'
import { FreeTag, Icon, Mark, Ring, Thermo } from '../components/ui'
import Explainable from '../components/Explainable'
import { deriveMonthSpend } from '../lib/derive'
import CountUpNumber from '../components/CountUpNumber'
import Donut from '../components/Donut'
import { APP_VERSION } from '../lib/changelog'
import StyleVariant from '../components/StyleVariant'

export default function Home() {
  return <StyleVariant classic={ClassicHome} minimal={CanvasHome} />
}

function CanvasHome() {
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
    const comparison = matchedMonthSpend(ev.sessions, todayIso())
    const deltaPct = comparison.deltaPct
    return { cur, deltaPct, comparisonDays: comparison.days, prevName: monthTitle(prevYm).split(' ')[0] }
  }, [ev, ym])

  const { cur, deltaPct, comparisonDays, prevName } = view
  const freeKwh = cur?.freeKwh ?? 0
  const totalKwh = cur?.kwh ?? 0
  const paidKwh = Math.max(0, totalKwh - freeKwh)
  const freePct = totalKwh > 0 ? Math.round((freeKwh / totalKwh) * 100) : 0

  return (
    <main className="app-shell cv">
      <header className="appbar">
        <div>
          <p className="cv-eyebrow">{monthTitle(ym).split(' ')[0]}</p>
          <h1 className="cv-big">
            <CountUpNumber value={cur?.cost ?? 0} format={aud} durationMs={850} />
          </h1>
        </div>
        <button className="icon-btn" type="button" aria-label="Settings" onClick={() => navigate('/settings')}>
          <Icon name="gear" />
        </button>
      </header>

      <p className="cv-ctx">
        {totalKwh > 0 ? (
          <>
            <CountUpNumber value={totalKwh} format={kwh} durationMs={700} /> kWh added.
          </>
        ) : (
          'No charges yet this month.'
        )}{' '}
        {deltaPct != null && (
          <em>
            {deltaPct > 0 ? 'Up' : 'Down'}{' '}
            <CountUpNumber value={Math.abs(deltaPct)} format={value => `${value.toFixed(0)}%`} durationMs={620} /> on {prevName} across the first {comparisonDays} days.
          </em>
        )}
      </p>

      <Donut value={freeKwh} max={totalKwh} label={`${freePct}%`} sub="free energy" />

      <div className="cv-legend">
        <span>
          <i style={{ background: 'var(--money)' }} />
          <CountUpNumber value={freeKwh} format={value => `${kwh(value, 1)} kWh free`} durationMs={700} />
        </span>
        <span>
          <i style={{ background: 'var(--bd)' }} />
          <CountUpNumber value={paidKwh} format={value => `${kwh(value, 1)} paid`} durationMs={700} />
        </span>
      </div>

      <div className="cv-rows">
        <button className="cv-row" type="button" onClick={() => navigate('/statement')}>
          <span className="k">Budget</span>
          <span className="v">
            <CountUpNumber value={cur?.cost ?? 0} format={value => aud(value, 0)} durationMs={720} /> /{' '}
            <CountUpNumber value={ev.budgetCap} format={value => aud(value, 0)} durationMs={720} />
          </span>
          <span className="c" aria-hidden="true">
            ›
          </span>
        </button>
        <button className="cv-row" type="button" onClick={() => navigate('/savings')}>
          <span className="k">Saved on free</span>
          <span className="v">
            <CountUpNumber value={cur?.saved ?? 0} format={aud} durationMs={720} />
          </span>
          <span className="c" aria-hidden="true">
            ›
          </span>
        </button>
      </div>
    </main>
  )
}

function ClassicHome() {
  const navigate = useNavigate()
  const ev = useEv()
  const ym = thisMonth()

  const view = useMemo(() => {
    const cur = ev.months.find(m => m.month === ym)
    const comparison = matchedMonthSpend(ev.sessions, todayIso())
    const deltaPct = comparison.deltaPct

    // budget projection: linear on day-of-month
    const now = new Date()
    const dayOfMonth = now.getDate()
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const projected = cur ? (cur.cost / Math.max(1, dayOfMonth)) * daysInMonth : 0

    // today's allowance across providers that have one
    const allowances = dailyAllowances(ev.sessions, ev.providers, todayIso())
    const usedToday = allowances.reduce((sum, a) => sum + a.used, 0)
    const allowance = allowances.reduce((sum, a) => sum + a.provider.freeKwhPerDay, 0)
    return { cur, deltaPct, comparisonDays: comparison.days, projected, allowances, allowance, usedToday }
  }, [ev, ym])

  const { cur, deltaPct, comparisonDays, projected, allowances, allowance, usedToday } = view
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
        {deltaPct != null && <p className="hero-sub">Change compares the first {comparisonDays} days of each month.</p>}
      </section>

      {(allowances.length > 0 || (cur?.freeKwh ?? 0) > 0) && (
        <button
          className="savecard"
          type="button"
          style={{ width: '100%', textAlign: 'left', cursor: 'pointer' }}
          onClick={() => navigate('/savings')}
        >
          <span className="bolt">⚡</span>
          <span className="cap">Free energy · {monthTitle(ym).split(' ')[0]}</span>
          <b className="big">
            <CountUpNumber value={cur?.saved ?? 0} format={aud} durationMs={780} /> saved
          </b>
          <small>
            {kwh(cur?.freeKwh ?? 0, 1)} kWh free this month · lifetime <b>{aud(ev.lifetime.netSaved, 0)}</b> net
            <br />
            {allowances.map(a => `${a.provider.name}: ${a.used.toFixed(1)} of ${a.provider.freeKwhPerDay} kWh today`).join(' · ')}
          </small>
          <span className="ringside">
            <Ring
              value={usedToday}
              max={allowance}
              label={usedToday.toFixed(1)}
              sub={`of ${allowance}`}
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
            onClick={() => navigate(providerAccountPath(p.name, ev.providers))}
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

      <footer className="app-footer">EV Command v{APP_VERSION} · Cockpit Ledger</footer>
    </main>
  )
}
