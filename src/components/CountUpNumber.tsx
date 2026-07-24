import { useEffect, useMemo, useState } from 'react'

type CountUpNumberProps = {
  value: number
  format: (value: number) => string
  className?: string
  durationMs?: number
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

export default function CountUpNumber({ value, format, className, durationMs = 900 }: CountUpNumberProps) {
  const reduceMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )
  const [displayValue, setDisplayValue] = useState(reduceMotion ? value : 0)

  useEffect(() => {
    if (reduceMotion) {
      setDisplayValue(value)
      return
    }

    let raf = 0
    const start = performance.now()

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs)
      setDisplayValue(value * easeOutCubic(progress))
      if (progress < 1) raf = requestAnimationFrame(tick)
    }

    setDisplayValue(0)
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [durationMs, reduceMotion, value])

  return (
    <span className={className} aria-label={format(value)}>
      {format(displayValue)}
    </span>
  )
}
