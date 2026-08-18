import { useEffect, useMemo, useState } from 'react'
import CountUpNumber from './CountUpNumber'

const R = 69
const C = 2 * Math.PI * R

export default function Donut({
  value,
  max,
  label,
  sub,
}: {
  value: number
  max: number
  label: string
  sub: string
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  const reduceMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )
  // Start filled when motion is off, so the ring is never drawn empty.
  const [shown, setShown] = useState(0)

  useEffect(() => {
    if (reduceMotion) return
    const id = requestAnimationFrame(() => setShown(pct))
    return () => cancelAnimationFrame(id)
  }, [pct, reduceMotion])

  const displayPct = reduceMotion ? pct : shown

  return (
    <div className="cv-donut">
      <svg viewBox="0 0 190 190" role="img" aria-label={`${label} ${sub}`}>
        <circle className="tr" cx="95" cy="95" r={R} />
        <circle
          className="fl"
          cx="95"
          cy="95"
          r={R}
          strokeDasharray={C}
          strokeDashoffset={C * (1 - displayPct / 100)}
        />
      </svg>
      <div className="cv-donut-mid">
        <b aria-label={label}>
          <CountUpNumber value={pct} format={value => `${Math.round(value)}%`} durationMs={1100} />
        </b>
        <small>{sub}</small>
      </div>
    </div>
  )
}
