import type { ReactNode } from 'react'
import { providerInitial, type Provider } from '../lib/providers'

/* ---- icons ---- */
const PATHS: Record<string, string> = {
  home: 'M3 10.5 12 3l9 7.5V21h-6v-6h-6v6H3z',
  book: 'M4 5a2 2 0 0 1 2-2h14v18H6a2 2 0 0 0-2 2V5z M8 7h8 M8 11h8',
  plus: 'M12 5v14 M5 12h14',
  car: 'M4 15l1.6-4.8A2 2 0 0 1 7.5 8.8h9a2 2 0 0 1 1.9 1.4L20 15v4h-2.5v-1.6h-11V19H4v-4z',
  gear: 'M4 8h9 M17 8h3 M4 16h3 M11 16h9',
  bolt: 'M13 2 5 13h5l-1 9 8-11h-5l1-9z',
  dl: 'M12 3v12m0 0 4-4m-4 4-4-4 M4 21h16',
  chart: 'M4 19V5 M9 19v-9 M14 19v-6 M19 19V9',
  chev: 'm9 6 6 6-6 6',
  back: 'm15 6-6 6 6 6',
  wallet: 'M16 12.5h5 M3 9h18',
  // records — trophy cabinet icons, same 24-grid stroke language
  rtrend: 'M3 16l5-5 4 3 8-8 M21 12V6h-6',
  rtarget: 'M12 12h.01',
  rbattery: 'M21 11v2 M6.5 11v2 M10 11v2',
  rdollar: 'M12 7.5v9 M14.5 9.5h-3.6a1.7 1.7 0 0 0 0 3.4h2.2a1.7 1.7 0 0 1 0 3.4H9.5',
  rcalcheck: 'M4 9.5h16 M8 3v4 M16 3v4 M9.5 14.5l2 2 3.5-3.5',
  rstreak: 'M13 2 5 13h5l-1 9 8-11h-5l1-9z M19 3.5c1.2 1.6 1.2 3.4 0 5',
  rweek: 'M4 9.5h16 M8 3v4 M16 3v4 M7.5 13h.01 M12 13h.01 M16.5 13h.01 M7.5 16.5h.01 M12 16.5h.01 M16.5 16.5h.01',
  rgauge: 'M4 19a8.5 8.5 0 0 1 16 0 M12 19l3.5-5',
  rfreeze: 'M12 3v18 M5.5 6.5l13 11 M18.5 6.5l-13 11 M12 3l-2 2.4 M12 3l2 2.4 M12 21l-2-2.4 M12 21l2-2.4',
}
const EXTRAS: Record<string, ReactNode> = {
  gear: (
    <>
      <circle cx="15" cy="8" r="2.2" />
      <circle cx="9" cy="16" r="2.2" />
    </>
  ),
  car: (
    <>
      <circle cx="8" cy="15" r="1" />
      <circle cx="16" cy="15" r="1" />
    </>
  ),
  wallet: <rect x="3" y="6" width="18" height="13" rx="2.5" />,
  rtarget: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3.5" />
    </>
  ),
  rbattery: <rect x="3" y="8" width="16" height="8" rx="2" />,
  rdollar: <circle cx="12" cy="12" r="8.5" />,
  rcalcheck: <rect x="4" y="5" width="16" height="15" rx="2" />,
  rweek: <rect x="4" y="5" width="16" height="15" rx="2" />,
}

export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <svg className="svgi" viewBox="0 0 24 24" style={{ width: size, height: size }} aria-hidden>
      <path d={PATHS[name] ?? PATHS.bolt} />
      {EXTRAS[name]}
    </svg>
  )
}

/* ---- provider mark ---- */
export function Mark({ provider, name, color }: { provider?: Provider; name?: string; color?: string }) {
  const label = provider?.name ?? name ?? '?'
  const c = provider?.color ?? color ?? 'var(--steel)'
  return (
    <span className="mark" style={{ ['--pc' as string]: c }}>
      {providerInitial(label)}
    </span>
  )
}

/* ---- allowance / progress ring ---- */
export function Ring({
  value,
  max,
  label,
  sub,
  size = 80,
  onSurface = false,
  color,
}: {
  value: number
  max: number
  label: string
  sub: string
  size?: number
  onSurface?: boolean
  color?: string
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div
      className={`ringd ${onSurface ? 'on-surface' : ''}`}
      style={{
        ['--v' as string]: pct,
        ['--sz' as string]: `${size}px`,
        ...(onSurface ? { ['--hole' as string]: 'var(--surf)', ['--rc' as string]: color ?? 'var(--money)' } : {}),
      }}
      role="img"
      aria-label={`${label} ${sub}`}
    >
      <span className="in">
        <b>{label}</b>
        <small>{sub}</small>
      </span>
    </div>
  )
}

/* ---- budget thermometer ---- */
export function Thermo({ spent, projected, cap }: { spent: number; projected: number; cap: number }) {
  const pct = (n: number) => Math.min(100, Math.max(0, (n / cap) * 100))
  return (
    <div className="thermo" role="img" aria-label={`Spent ${spent.toFixed(2)} of ${cap} budget`}>
      <span className="fill" style={{ width: `${pct(spent)}%` }} />
      {projected > spent && <span className="proj" style={{ left: `${pct(projected)}%` }} />}
      <span className="cap100" />
    </div>
  )
}

/* ---- free/paid split bar ---- */
export function SplitBar({ segments }: { segments: Array<{ pct: number; color?: string; cls?: string }> }) {
  return (
    <div className="splitb">
      {segments.map((s, i) => (
        <i key={i} className={s.cls} style={{ width: `${s.pct}%`, ...(s.color ? { background: s.color } : {}) }} />
      ))}
    </div>
  )
}

/* ---- CSS bar chart ---- */
export function Bars({
  data,
  steel = false,
  highlight,
  showValues = false,
  valueLabel,
}: {
  data: Array<{ label: string; value: number }>
  steel?: boolean
  highlight?: number
  showValues?: boolean
  valueLabel?: (value: number) => string
}) {
  const max = Math.max(...data.map(d => d.value), 0.01)
  return (
    <>
      <div className={`bars ${showValues ? 'show-values' : ''}`}>
        {data.map((d, i) => (
          <div
            key={d.label + i}
            className={`b ${steel ? 'st' : ''} ${highlight != null && i !== highlight ? 'dim' : ''}`}
            data-v={valueLabel ? valueLabel(d.value) : d.value.toFixed(0)}
            style={{ height: `${8 + (d.value / max) * 88}%` }}
            title={`${d.label}: ${d.value.toFixed(2)}`}
          />
        ))}
      </div>
      <div className="blbl">
        {data.map((d, i) => (
          <span key={d.label + i}>{d.label}</span>
        ))}
      </div>
    </>
  )
}

export const FreeTag = ({ children = 'FREE' }: { children?: ReactNode }) => (
  <span className="freetag">{children}</span>
)

export function SyncBadge({ live, label }: { live: boolean; label: string }) {
  return (
    <span className={`sync-badge ${live ? '' : 'off'}`}>
      <span className="live" />
      {label}
    </span>
  )
}

export function TickSvg() {
  return (
    <svg className="ticksvg" viewBox="0 0 64 64" aria-hidden>
      <circle cx="32" cy="32" r="27" />
      <path d="M20 33l8 8 16-17" />
    </svg>
  )
}
