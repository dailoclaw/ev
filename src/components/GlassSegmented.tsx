import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { LiquidGlass } from 'liquid-glass-web-react'

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
  const trackRef = useRef<HTMLDivElement>(null)
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([])
  const activeIndex = Math.max(0, options.findIndex(option => option.value === value))
  const [lens, setLens] = useState({
    x: (activeIndex + 0.5) / Math.max(options.length, 1),
    left: 4,
    top: 4,
    width: 96,
    height: compact ? 30 : 38,
  })

  const columns = useMemo(() => `repeat(${Math.max(options.length, 1)}, minmax(0, 1fr))`, [options.length])

  useLayoutEffect(() => {
    const track = trackRef.current
    if (!track) return

    const measure = () => {
      const active = buttonRefs.current[activeIndex]
      const rect = track.getBoundingClientRect()
      const activeRect = active?.getBoundingClientRect()
      if (!rect.width || !activeRect?.width) return
      setLens({
        x: (activeRect.left - rect.left + activeRect.width / 2) / rect.width,
        left: activeRect.left - rect.left,
        top: activeRect.top - rect.top,
        width: activeRect.width,
        height: activeRect.height,
      })
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
    <div className={`glass-seg ${compact ? 'glass-seg--compact' : ''} ${className}`.trim()} style={style}>
      <LiquidGlass
        className="glass-seg__lens"
        style={{
          position: 'absolute',
          inset: 0,
          ['--glass-lens-left' as string]: `${lens.left}px`,
          ['--glass-lens-top' as string]: `${lens.top}px`,
          ['--glass-lens-width' as string]: `${lens.width}px`,
          ['--glass-lens-height' as string]: `${lens.height}px`,
          pointerEvents: 'none',
        }}
        x={lens.x}
        y={0.5}
        width={lens.width}
        height={lens.height}
        radius="auto"
        strength={0.12}
        chromaticAberration={0.28}
        curvature={0.82}
        glow={0.16}
        edgeHighlight={0.38}
        depth={10}
        blur={0}
        shadow={false}
        aria-hidden="true"
      >
        <div className="glass-seg__surface" style={{ gridTemplateColumns: columns }}>
          {options.map(option => (
            <span key={option.value} className={option.value === value ? 'is-active' : ''} />
          ))}
        </div>
      </LiquidGlass>
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
    </div>
  )
}
