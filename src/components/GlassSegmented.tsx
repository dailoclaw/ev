import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { LiquidGlass, type LiquidGlassHandle } from 'liquid-glass-web-react'

type SegmentValue = string | number

export interface GlassSegmentOption<T extends SegmentValue> {
  value: T
  label: ReactNode
  disabled?: boolean
}

export interface GlassSegmentedProps<T extends SegmentValue> {
  options: GlassSegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  ariaLabel: string
  className?: string
  style?: CSSProperties
  compact?: boolean
}

export default function GlassSegmented<T extends SegmentValue>({
  options,
  value,
  onChange,
  ariaLabel,
  className = '',
  style,
  compact = false,
}: GlassSegmentedProps<T>) {
  const glassRef = useRef<LiquidGlassHandle>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([])
  const activeIndex = Math.max(0, options.findIndex(option => option.value === value))
  const [initialX] = useState(() => (activeIndex + 0.5) / Math.max(options.length, 1))
  const [lensWidth, setLensWidth] = useState(104)
  const motionRef = useRef({ x: initialX, v: 0, target: initialX, raf: 0, settled: false })

  const columns = useMemo(() => `repeat(${Math.max(options.length, 1)}, minmax(0, 1fr))`, [options.length])

  const moveTo = useCallback((target: number, animate: boolean) => {
    const motion = motionRef.current
    motion.target = target
    cancelAnimationFrame(motion.raf)

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!animate || reduceMotion) {
      motion.x = target
      motion.v = 0
      glassRef.current?.setPosition(target, 0.5)
      return
    }

    let previous = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - previous) / 1000)
      previous = now
      const spring = 170
      const damping = 20
      motion.v += (spring * (motion.target - motion.x) - damping * motion.v) * dt
      motion.x += motion.v * dt
      glassRef.current?.setPosition(motion.x, 0.5)

      if (Math.abs(motion.target - motion.x) > 0.0005 || Math.abs(motion.v) > 0.001) {
        motion.raf = requestAnimationFrame(tick)
        return
      }

      motion.x = motion.target
      motion.v = 0
      glassRef.current?.setPosition(motion.target, 0.5)
    }

    motion.raf = requestAnimationFrame(tick)
  }, [])

  useLayoutEffect(() => {
    const track = trackRef.current
    if (!track) return

    const measure = () => {
      const active = buttonRefs.current[activeIndex]
      const rect = track.getBoundingClientRect()
      const activeRect = active?.getBoundingClientRect()
      if (!rect.width || !activeRect?.width) return
      const next = {
        x: (activeRect.left + activeRect.width / 2 - rect.left) / rect.width,
        width: Math.round(activeRect.width) + 8,
      }
      setLensWidth(next.width)
      moveTo(next.x, motionRef.current.settled)
      motionRef.current.settled = true
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(track)
    for (const button of buttonRefs.current) {
      if (button) observer.observe(button)
    }
    return () => observer.disconnect()
  }, [activeIndex, moveTo, options.length])

  useEffect(() => {
    const motion = motionRef.current
    return () => cancelAnimationFrame(motion.raf)
  }, [])

  return (
    <LiquidGlass
      ref={glassRef}
      className={`glass-seg ${compact ? 'glass-seg--compact' : ''} ${className}`.trim()}
      style={{ touchAction: 'none', ...style }}
      x={initialX}
      y={0.5}
      width={lensWidth}
      height={compact ? 34 : 46}
      radius="auto"
      strength={0.02}
      chromaticAberration={0.25}
      curvature={0.85}
      depth={8}
      glow={0.15}
      edgeHighlight={0.35}
      shadow="0 0 0 1px rgba(255,255,255,0.14), 0 4px 14px rgba(0,0,0,0.45)"
    >
      <div
        ref={trackRef}
        className="glass-seg__controls"
        role="group"
        aria-label={ariaLabel}
        style={{ gridTemplateColumns: columns }}
      >
        {options.map((option, index) => (
          <button
            key={option.value}
            ref={element => {
              buttonRefs.current[index] = element
            }}
            type="button"
            className={option.value === value ? 'is-active' : ''}
            disabled={option.disabled}
            aria-pressed={option.value === value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </LiquidGlass>
  )
}
