import type { EnrichedSession } from '../lib/savings'
import type { Provider } from '../lib/providers'
import { aud, longDate, rate } from '../lib/format'
import { Mark, SplitBar } from './ui'

export default function ReceiptSheet({
  session,
  provider,
  onClose,
}: {
  session: EnrichedSession
  provider?: Provider
  onClose: () => void
}) {
  const freePct = session.amount > 0 ? (session.freeKwh / session.amount) * 100 : 0

  return (
    <div className="sheet-backdrop" role="presentation" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Session receipt" onClick={e => e.stopPropagation()}>
        <div className="handle" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <Mark provider={provider} name={session.type} />
          <div>
            <b style={{ fontSize: 16, fontWeight: 800 }}>{session.type} — session receipt</b>
            <div style={{ fontSize: 12, color: 'var(--mut)', fontWeight: 600 }}>{longDate(session.date)}</div>
          </div>
        </div>

        {session.isFee ? (
          <div className="rcpt">
            <div className="rl">
              <span>Membership charge</span>
              <b>{aud(session.cost)}</b>
            </div>
            <div className="rl">
              <span>Energy delivered</span>
              <b>—</b>
            </div>
            <div className="rl tot">
              <span>Total paid</span>
              <b>{aud(session.cost)}</b>
            </div>
            <div className="rl free">
              <span>Funds the daily free allowance</span>
              <b>⚡</b>
            </div>
          </div>
        ) : (
        <div className="rcpt">
          <div className="rl">
            <span>Energy delivered</span>
            <b>{session.amount.toFixed(2)} kWh</b>
          </div>
          {session.freeKwh > 0 && (
            <div className="rl free">
              <span>Free daily allowance</span>
              <b>− {session.freeKwh.toFixed(2)} kWh</b>
            </div>
          )}
          <div className="rl">
            <span>Billable energy</span>
            <b>{session.paidKwh.toFixed(2)} kWh</b>
          </div>
          {session.paidKwh > 0 && (
            <div className="rl">
              <span>Rate</span>
              <b>{rate(session.billedRate)} / kWh</b>
            </div>
          )}
          <div className="rl tot">
            <span>Total paid</span>
            <b>{aud(session.cost)}</b>
          </div>
          {session.savedValue > 0 && (
            <div className="rl free">
              <span>You saved</span>
              <b>{aud(session.savedValue)}</b>
            </div>
          )}
        </div>
        )}

        {session.freeKwh > 0 && (
          <div style={{ marginTop: 12 }}>
            <SplitBar
              segments={[
                { pct: freePct, cls: 'f' },
                { pct: 100 - freePct, cls: 'p' },
              ]}
            />
            <div className="splitleg">
              <span>
                <i style={{ background: '#059669' }} />
                Free {session.freeKwh.toFixed(1)} kWh
              </span>
              <span>
                <i style={{ background: '#334155' }} />
                Paid {session.paidKwh.toFixed(1)} kWh
              </span>
            </div>
          </div>
        )}

        {session.notes && (
          <div className="freepreview" style={{ background: 'var(--surf2)', borderColor: 'var(--bd)', color: 'var(--mut)' }}>
            {session.notes}
          </div>
        )}
      </div>
    </div>
  )
}
