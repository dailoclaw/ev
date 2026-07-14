import { useNavigate, useParams } from 'react-router-dom'
import { useEv } from '../lib/useEv'
import { aud, kwh, rate, shortDate } from '../lib/format'
import { FreeTag, Icon, Mark, SplitBar } from '../components/ui'

export function AccountsList() {
  const navigate = useNavigate()
  const ev = useEv()
  const totalKwh = ev.lifetime.kwh || 1

  return (
    <main className="app-shell">
      <header className="appbar">
        <div>
          <p className="eyebrow">Networks</p>
          <h1>Accounts</h1>
          <span className="sub">Lifetime by charger network</span>
        </div>
        <button className="icon-btn" type="button" aria-label="Back" onClick={() => navigate(-1)}>
          <Icon name="back" />
        </button>
      </header>

      <section className="hero-card" style={{ paddingBottom: 14 }}>
        <span className="cap" style={{ marginBottom: 9 }}>
          Where your kWh come from
        </span>
        <SplitBar
          segments={ev.byProvider.map(p => ({
            pct: (p.kwh / totalKwh) * 100,
            color: ev.providers.find(x => x.name === p.name)?.color ?? 'var(--steel)',
          }))}
        />
        <div className="splitleg">
          {ev.byProvider.map(p => (
            <span key={p.name}>
              <i style={{ background: ev.providers.find(x => x.name === p.name)?.color ?? 'var(--steel)' }} />
              {p.name} {Math.round((p.kwh / totalKwh) * 100)}%
            </span>
          ))}
        </div>
      </section>

      {ev.byProvider.map(p => {
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
                {p.sessions} charges · {kwh(p.kwh)} kWh · eff. {rate(p.effectiveRate)}/kWh
              </small>
            </span>
            <b className="amt">{aud(p.cost)}</b>
          </button>
        )
      })}
    </main>
  )
}

export function AccountDetail() {
  const navigate = useNavigate()
  const { name = '' } = useParams()
  const ev = useEv()
  const decoded = decodeURIComponent(name)
  const summary = ev.byProvider.find(p => p.name === decoded)
  const provider = ev.providers.find(p => p.name === decoded)
  const sessions = ev.sessionsDesc.filter(s => s.type === decoded).slice(0, 12)

  if (!summary) {
    return (
      <main className="app-shell">
        <header className="appbar">
          <div>
            <h1>Not found</h1>
          </div>
          <button className="icon-btn" type="button" onClick={() => navigate(-1)}>
            <Icon name="back" />
          </button>
        </header>
      </main>
    )
  }

  const freePct = summary.kwh > 0 ? (summary.freeKwh / summary.kwh) * 100 : 0

  return (
    <main className="app-shell">
      <header className="appbar">
        <div>
          <p className="eyebrow">Account</p>
          <h1>{summary.name}</h1>
          <span className="sub">{summary.sessions} charges all-time</span>
        </div>
        <button className="icon-btn" type="button" aria-label="Back" onClick={() => navigate(-1)}>
          <Icon name="back" />
        </button>
      </header>

      <section className="hero-card">
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <span className="cap">Total paid</span>
            <div style={{ fontSize: 28, fontWeight: 800, marginTop: 5 }}>{aud(summary.cost)}</div>
          </div>
          {summary.saved > 0 && (
            <div style={{ textAlign: 'right' }}>
              <span className="cap" style={{ color: 'var(--money-deep)' }}>
                Free banked
              </span>
              <div style={{ fontSize: 28, fontWeight: 800, marginTop: 5, color: 'var(--money-deep)' }}>
                {aud(summary.saved, 0)}
              </div>
            </div>
          )}
        </div>
        {summary.freeKwh > 0 && (
          <div style={{ marginTop: 13 }}>
            <SplitBar
              segments={[
                { pct: freePct, cls: 'f' },
                { pct: 100 - freePct, cls: 'p' },
              ]}
            />
            <div className="splitleg">
              <span>
                <i style={{ background: '#059669' }} />
                {kwh(summary.freeKwh)} kWh free
              </span>
              <span>
                <i style={{ background: '#334155' }} />
                {kwh(summary.kwh - summary.freeKwh)} kWh paid
              </span>
            </div>
          </div>
        )}
      </section>

      <section className="metric-grid">
        <article className="metric-card">
          <span>Effective rate</span>
          <strong style={{ color: summary.effectiveRate < 0.2 ? 'var(--money-deep)' : undefined }}>
            {rate(summary.effectiveRate)}
          </strong>
          <small>/kWh all-in</small>
        </article>
        <article className="metric-card">
          <span>Energy</span>
          <strong>{kwh(summary.kwh)}</strong>
          <small>kWh lifetime</small>
        </article>
      </section>

      <h2 className="sec-h2">Recent at {summary.name}</h2>
      <p className="sec-sub">
        {provider && provider.freeKwhPerDay > 0
          ? 'Free allowance applied automatically.'
          : 'No free allowance on this network.'}
      </p>
      {sessions.map(s => (
        <div className="row" key={s.id}>
          <Mark provider={provider} name={s.type} />
          <span>
            <strong>
              {shortDate(s.date)}
              {s.cost === 0 && s.freeKwh > 0 && <FreeTag />}
            </strong>
            <small>
              {s.amount.toFixed(1)} kWh
              {s.freeKwh > 0 && s.paidKwh > 0 && ` · ${s.freeKwh.toFixed(1)} free + ${s.paidKwh.toFixed(1)} paid`}
              {s.freeKwh > 0 && s.paidKwh === 0 && ' · allowance covered it'}
            </small>
          </span>
          <b className="amt">{aud(s.cost)}</b>
        </div>
      ))}
    </main>
  )
}
