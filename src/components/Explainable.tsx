import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Derivation } from '../lib/derive'
import ExplainSheet from './ExplainSheet'

const HOLD_MS = 450
/** Finger drift beyond this means the user is scrolling, not pressing. */
const MOVE_TOLERANCE = 10

/**
 * Wraps a figure so it can explain itself.
 *
 * Long-press is the primary gesture, but a plain tap (and keyboard activation)
 * opens it too — a hold-only control would be invisible to keyboard users and
 * undiscoverable to everyone else.
 */
export default function Explainable({
  derive,
  children,
  label,
  className = '',
}: {
  derive: () => Derivation | null
  children: ReactNode
  label: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const origin = useRef<{ x: number; y: number } | null>(null)
  const held = useRef(false)

  const clear = useCallback(() => {
    if (timer.current !== undefined) {
      window.clearTimeout(timer.current)
      timer.current = undefined
    }
  }, [])

  useEffect(() => clear, [clear])

  const onPointerDown = (e: React.PointerEvent) => {
    held.current = false
    origin.current = { x: e.clientX, y: e.clientY }
    clear()
    timer.current = window.setTimeout(() => {
      held.current = true
      setOpen(true)
    }, HOLD_MS)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!origin.current) return
    const dx = Math.abs(e.clientX - origin.current.x)
    const dy = Math.abs(e.clientY - origin.current.y)
    if (dx > MOVE_TOLERANCE || dy > MOVE_TOLERANCE) clear()
  }

  const onClick = () => {
    // The hold already opened it; don't treat the trailing click as a second press.
    if (held.current) {
      held.current = false
      return
    }
    setOpen(true)
  }

  const deriv = open ? derive() : null

  return (
    <>
      <button
        type="button"
        className={`explainable ${className}`}
        aria-label={`${label} — show how this was calculated`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={clear}
        onPointerCancel={clear}
        onPointerLeave={clear}
        onContextMenu={e => e.preventDefault()}
        onClick={onClick}
      >
        {children}
      </button>
      {open && deriv && <ExplainSheet deriv={deriv} onClose={() => setOpen(false)} />}
    </>
  )
}
