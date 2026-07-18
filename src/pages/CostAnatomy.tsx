import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEv } from '../lib/useEv'
import { costAnatomy } from '../lib/costAnatomy'
import { aud, kwh, longDate, rate, thisMonth } from '../lib/format'
import { Icon, SplitBar } from '../components/ui'
import Explainable from '../components/Explainable'
import { deriveBlendedRate } from '../lib/derive'

export default function CostAnatomy() {
  const navigate = useNavigate()
  const ev = useEv()
  const a = useMemo(() => costAnatomy(ev.sessions, ev.refRate, thisMonth()), [ev.sessions, ev.refRate])

  if (!a.hasFees) {
    return (
      <main className="app-shell">
        <header className="appbar">
          <div>
            <p className="eyebrow">Fixed vs variable</p>
            <h1>Cost anatomy</h1>
            <span className="sub">No subscription charges yet</span>
          </div>
          <button className="icon-btn" type="button" aria-label="Back" onClick={() => navigate(-1)}>
            <Icon name="back" />
          </button>
        </header>
        <section className="hero-card">
          <span className="cap" style={{ marginBottom: 7 }}>
            Nothing to split
          </span>
          <p className="anat-note">
            Every charge you've logged is energy — there are no membership or subscription rows. When a provider starts
            charging a recurring fee, this page will separate it from the electricity so you can see what each is
            really costing you.
          </p>
        </section>
      </main>
    )
  }

  const worthIt = a.netPerMonth >= 0

  return (
    <main className="app-shell">
      <header className="appbar">
        <div>
          <p className="eyebrow">Fixed vs variable</p>
          <h1>Cost anatomy</h1>
          <span className="sub">Since {longDate(a.feeStart!)}</span>
        </div>
        <button className="icon-btn" type="button" aria-label="Back" onClick={() => navigate(-1)}>
          <Icon name="back" />
        </button>
      </header>

      {/* the split — the point of the whole page */}
      <section className="hero-card">
        <span className="cap" style={{ marginBottom: 4 }}>
          What you actually pay per kWh
        </span>
        <Explainable derive={() => deriveBlendedRate(ev)} label="Blended rate per kWh">
          <div className="anat-rate">{rate(a.blendedPerKwh)}</div>
        </Explainable>
        <div className="anat-sub">blended — the rate shown elsewhere in the app</div>

        <div style={{ marginTop: 14 }}>
          <SplitBar
            segments={[
              { pct: a.feeSharePct, color: 'var(--warn)' },
              { pct: 100 - a.feeSharePct, color: 'var(--steel)' },
            ]}
          />
        </div>
        <div className="anat-legend">
          <div className="al">
            <i style={{ background: 'var(--warn)' }} />
            <div>
              <b>{rate(a.feePerKwh)}</b>
              <span>subscription</span>
            </div>
          </div>
          <div className="al right">
            <div>
              <b>{rate(a.energyPerKwh)}</b>
              <span>energy</span>
            </div>
            <i style={{ background: 'var(--steel)' }} />
          </div>
        </div>
        <p className="anat-note" style={{ marginTop: 12 }}>
          The membership is <b>{a.feeSharePct.toFixed(0)}%</b> of what you pay per kWh — it costs{' '}
          {a.feePerKwh >= a.energyPerKwh ? 'more than' : 'nearly as much as'} the electricity itself.
        </p>
      </section>

      <div className="metric-grid">
        <div className="metric-card">
          <span>Subscription</span>
          <strong style={{ color: 'var(--warn)' }}>{aud(a.fees)}</strong>
          <small>fixed · {a.months.filter(m => m.fee > 0).length} charges</small>
        </div>
        <div className="metric-card">
          <span>Energy</span>
          <strong>{aud(a.energyCost)}</strong>
          <small>variable · {kwh(a.kwh)} kWh</small>
        </div>
      </div>

      {/* does the subscription earn its keep? */}
      <section className="hero-card">
        <span className="cap" style={{ marginBottom: 8 }}>
          Break-even on the fee
        </span>
        <div className="rcpt" style={{ border: 0, boxShadow: 'none', padding: 0 }}>
          <div className="rl">
            <span>Free energy claimed / month</span>
            <b>{kwh(a.avgFreeKwhPerMonth, 1)} kWh</b>
          </div>
          <div className="rl free">
            <span>Worth (at {rate(ev.refRate)}/kWh)</span>
            <b>{aud(a.avgFreeValuePerMonth)}</b>
          </div>
          <div className="rl">
            <span>Membership fee</span>
            <b>− {aud(a.monthlyFee)}</b>
          </div>
          <div className="rl tot">
            <span>Net each month</span>
            <b style={{ color: worthIt ? 'var(--money-deep)' : 'var(--neg)' }}>
              {worthIt ? '+' : ''}
              {aud(a.netPerMonth)}
            </b>
          </div>
        </div>
        <div className={`anat-verdict ${worthIt ? '' : 'bad'}`}>
          {worthIt ? (
            <>
              <b>Worth keeping.</b> You need {kwh(a.breakEvenKwh, 0)} kWh of free energy a month just to cover the fee —
              you're averaging {kwh(a.avgFreeKwhPerMonth, 0)}.
            </>
          ) : (
            <>
              <b>Not earning its keep.</b> You need {kwh(a.breakEvenKwh, 0)} kWh of free energy a month to cover the fee
              — you're averaging only {kwh(a.avgFreeKwhPerMonth, 0)}.
            </>
          )}
        </div>
      </section>

      {/* month by month */}
      <section className="hero-card" style={{ paddingBottom: 10 }}>
        <span className="cap" style={{ marginBottom: 6 }}>
          Month by month
        </span>
        <div className="anat-table">
          <div className="ar head">
            <span>Month</span>
            <span>Fee</span>
            <span>Energy</span>
            <span>Net</span>
          </div>
          {[...a.months].reverse().map(m => {
            const partial = m.month === thisMonth()
            return (
              <div className="ar" key={m.month}>
                <span className="am">
                  {m.label}
                  {partial && <em className="apart">so far</em>}
                </span>
                <span>{m.fee > 0 ? aud(m.fee, 0) : '—'}</span>
                <span>{aud(m.energyCost, 0)}</span>
                <span className={partial ? 'part' : m.net >= 0 ? 'pos' : 'neg'}>
                  {m.net >= 0 ? '+' : ''}
                  {aud(m.net, 0)}
                </span>
              </div>
            )
          })}
        </div>
      </section>

      <section className="hero-card" style={{ paddingBottom: 14 }}>
        <span className="cap" style={{ marginBottom: 7 }}>
          How it's calculated
        </span>
        <p className="anat-note">
          Subscription rows are charges with no energy attached. We total them separately from energy spend since your
          first fee on <b>{longDate(a.feeStart!)}</b>, then divide each by the <b>{kwh(a.kwh)} kWh</b> delivered in that
          period. Free energy is valued at <b>{rate(ev.refRate)}/kWh</b> — the rate you actually pay elsewhere.
        </p>
      </section>

      <footer className="app-footer">
        {aud(a.fees)} of {aud(a.totalCost)} since {longDate(a.feeStart!)} was subscription, not electricity
      </footer>
    </main>
  )
}
