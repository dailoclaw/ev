import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'

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
  const [lens, setLens] = useState({ left: 4, top: 4, width: 96, height: compact ? 30 : 38 })

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
      <span
        className="glass-seg__indicator"
        style={{
          transform: `translate(${lens.left}px, ${lens.top}px)`,
          width: lens.width,
          height: lens.height,
        }}
        aria-hidden="true"
      />
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
