// Read-only adaptation of React Bits Slosh Gauge. See docs/licenses/react-bits.md.
import { useEffect, useRef, type CSSProperties } from 'react'
import { useReducedMotion } from '../lib/useReducedMotion'
import './SloshGauge.css'

export default function SloshGauge({ used, max, provider, large = false }: {
  used: number; max: number; provider: string; large?: boolean
}) {
  const capacity = Number.isFinite(max) ? Math.max(0, max) : 0
  const amount = Number.isFinite(used) ? Math.max(0, Math.min(used, capacity)) : 0
  const level = capacity > 0 ? amount / capacity * 100 : 0
  const reduce = useReducedMotion()
  const liquid = useRef<HTMLDivElement>(null)
  const sim = useRef({ x: level, v: 0 })

  useEffect(() => {
    let raf = 0
    let last = 0
    const state = sim.current
    const paint = () => {
      // A small lean only while the value is changing; no idle animation.
      const lean = reduce ? 0 : Math.max(-5, Math.min(5, state.v * 0.015))
      if (liquid.current) liquid.current.style.clipPath = `polygon(0 calc(${100 - state.x}% + ${lean}px), 100% calc(${100 - state.x}% - ${lean}px), 100% 100%, 0 100%)`
    }
    const tick = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 1 / 120
      last = now
      // Substeps keep the spring stable even after a dropped frame.
      for (let n = Math.ceil(dt * 120), h = dt / n; n > 0; n--) {
        state.v += (180 * (level - state.x) - 22 * state.v) * h
        state.x = Math.max(0, Math.min(100, state.x + state.v * h))
      }
      const settled = Math.abs(level - state.x) < 0.03 && Math.abs(state.v) < 0.1
      if (settled) { state.x = level; state.v = 0 }
      paint()
      if (!settled) raf = requestAnimationFrame(tick)
    }
    if (reduce) { state.x = level; state.v = 0; paint() }
    else raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [level, reduce])

  const text = capacity > 0
    ? `${amount.toFixed(1)} of ${capacity.toFixed(1)} kWh used today at ${provider}`
    : 'No free allowance configured'
  const label = `${Math.round(level)}%`
  return (
    <div className={`slosh-gauge${large ? ' slosh-gauge--large' : ''}`}
      role="meter" aria-label={`Today's allowance at ${provider}`} aria-valuemin={0}
      aria-valuemax={capacity || 1} aria-valuenow={amount} aria-valuetext={text}
      style={{ '--sg-top': `${100 - level}%` } as CSSProperties}>
      <span className="slosh-gauge__value" aria-hidden="true">{label}</span>
      <div ref={liquid} className="slosh-gauge__liquid" aria-hidden="true">
        <span className="slosh-gauge__value">{label}</span>
      </div>
      <div className="slosh-gauge__ticks" aria-hidden="true" />
    </div>
  )
}
