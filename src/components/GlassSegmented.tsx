import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
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
  const [lens, setLens] = useState({ x: (activeIndex + 0.5) / Math.max(options.length, 1), width: 104 })

  const columns = useMemo(() => `repeat(${Math.max(options.length, 1)}, minmax(0, 1fr))`, [options.length])

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
      setLens(next)
      glassRef.current?.setPosition(next.x, 0.5)
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(track)
    for (const button of buttonRefs.current) {
      if (button) observer.observe(button)
    }
    return () => observer.disconnect()
  }, [activeIndex, options.length])

  return (
    <LiquidGlass
      ref={glassRef}
      className={`glass-seg ${compact ? 'glass-seg--compact' : ''} ${className}`.trim()}
      style={{ touchAction: 'none', ...style }}
      x={lens.x}
      y={0.5}
      width={lens.width}
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
