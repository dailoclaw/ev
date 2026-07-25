import { useEffect, useMemo, useState } from 'react'

type CountUpNumberProps = {
  value: number
  format: (value: number) => string
  className?: string
  durationMs?: number
  delayMs?: number
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

export default function CountUpNumber({ value, format, className, durationMs = 900, delayMs = 0 }: CountUpNumberProps) {
  const cls = className ? `countup-value ${className}` : 'countup-value'
  const reduceMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )
  const [displayValue, setDisplayValue] = useState(reduceMotion ? value : 0)

  useEffect(() => {
    if (reduceMotion) return

    let raf = 0
    let timer: ReturnType<typeof setTimeout> | undefined

    const startAnimation = (start: number) => {
      const tick = (now: number) => {
        const progress = Math.min(1, (now - start) / durationMs)
        setDisplayValue(value * easeOutCubic(progress))
        if (progress < 1) raf = requestAnimationFrame(tick)
      }
      setDisplayValue(0)
      raf = requestAnimationFrame(tick)
    }

    const queueAnimation = () => {
      raf = requestAnimationFrame(startAnimation)
    }

    if (delayMs > 0) timer = setTimeout(queueAnimation, delayMs)
    else queueAnimation()

    return () => {
      if (timer) clearTimeout(timer)
      cancelAnimationFrame(raf)
    }
  }, [delayMs, durationMs, reduceMotion, value])

  return (
    <span className={cls} aria-label={format(value)}>
      {format(reduceMotion ? value : displayValue)}
    </span>
  )
}
