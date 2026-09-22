// Adapted from React Bits Swipe Row. See docs/licenses/react-bits.md.
import { useCallback, useEffect, useId, useRef, type PointerEvent, type ReactNode } from 'react'
import { useReducedMotion } from '../lib/useReducedMotion'
import { Icon } from './ui'
import './SwipeRow.css'

const WIDTH = 96
const rubber = (extra: number) => extra * 0.35 / (1 + Math.abs(extra) / 80)
type Grip = { id: number; x: number; y: number; base: number; axis: 'x' | 'y' | null; lastX: number; lastTime: number; velocity: number }

export default function SwipeRow({ children, label, open, onOpenChange, onTap, onEdit, onDelete }: {
  children: ReactNode; label: string; open: boolean; onOpenChange: (open: boolean) => void
  onTap: () => void; onEdit: () => void; onDelete: () => void
}) {
  const id = useId()
  const surface = useRef<HTMLDivElement>(null)
  const grip = useRef<Grip | null>(null)
  const position = useRef(0)
  const frame = useRef(0)
  const suppressClick = useRef(false)
  const reduce = useReducedMotion()

  const paint = useCallback((x: number) => {
    position.current = x
    if (surface.current) surface.current.style.transform = `translateX(${x}px)`
  }, [])

  const settle = useCallback((expanded: boolean, velocity = 0) => {
    cancelAnimationFrame(frame.current)
    const target = expanded ? -WIDTH : 0
    if (reduce) { paint(target); return }
    let last = 0
    let v = Math.max(-1200, Math.min(1200, velocity))
    const tick = (time: number) => {
      const dt = last ? Math.min((time - last) / 1000, 0.032) : 1 / 120
      last = time
      let x = position.current
      for (let n = Math.ceil(dt * 120), h = dt / n; n > 0; n--) {
        v += (420 * (target - x) - 34 * v) * h
        x += v * h
      }
      if (Math.abs(target - x) < 0.2 && Math.abs(v) < 2) { paint(target); return }
      paint(x)
      frame.current = requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)
  }, [paint, reduce])

  useEffect(() => {
    settle(open)
    return () => cancelAnimationFrame(frame.current)
  }, [open, settle])

  const changeOpen = (next: boolean, velocity = 0) => {
    settle(next, velocity) // Settle even when the parent state does not change.
    onOpenChange(next)
  }
  const down = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button !== 0 || (event.target as HTMLElement).closest('[data-swipe-toggle]')) return
    cancelAnimationFrame(frame.current)
    suppressClick.current = false
    grip.current = { id: event.pointerId, x: event.clientX, y: event.clientY, base: position.current,
      axis: null, lastX: event.clientX, lastTime: event.timeStamp, velocity: 0 }
    // Capture on the original button, preserving normal click targeting on taps.
    try { (event.target as HTMLElement).setPointerCapture(event.pointerId) } catch { /* The pointer may already have been cancelled. */ }
  }
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const g = grip.current
    if (!g || g.id !== event.pointerId) return
    const dx = event.clientX - g.x
    const dy = event.clientY - g.y
    if (!g.axis && Math.max(Math.abs(dx), Math.abs(dy)) > 8) {
      g.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      suppressClick.current = true
    }
    if (g.axis !== 'x') return
    const elapsed = event.timeStamp - g.lastTime
    if (elapsed > 0) g.velocity = (event.clientX - g.lastX) / elapsed * 1000
    g.lastX = event.clientX
    g.lastTime = event.timeStamp
    const raw = g.base + dx
    paint(raw > 0 ? rubber(raw) : raw < -WIDTH ? -WIDTH + rubber(raw + WIDTH) : raw)
  }
  const finish = (event: PointerEvent<HTMLDivElement>, cancelled = false) => {
    const g = grip.current
    if (!g || g.id !== event.pointerId) return
    grip.current = null
    if (cancelled || g.axis !== 'x') {
      if (cancelled) suppressClick.current = true
      settle(open)
      return
    }
    // Tiny fast movements are taps with drift, not intentional flicks.
    const velocity = Math.abs(event.clientX - g.x) < 20 || event.timeStamp - g.lastTime > 100 ? 0 : g.velocity
    const projected = position.current + Math.max(-40, Math.min(40, velocity * 0.12))
    changeOpen(projected < -WIDTH / 2, velocity)
  }

  return (
    <div className="swiperow" data-open={open} onKeyDown={event => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'Escape') {
        event.preventDefault()
        const next = event.key === 'ArrowLeft'
        if (!next) surface.current?.querySelector<HTMLButtonElement>('[data-swipe-toggle]')?.focus()
        changeOpen(next)
      }
    }}>
      <div id={id} className="swipe-actions" aria-hidden={!open} inert={!open}>
        <button type="button" className="edit" onClick={onEdit} aria-label={`Edit ${label}`}><Icon name="edit" size={18} /></button>
        <button type="button" className="del" onClick={onDelete} aria-label={`Delete ${label}`}><Icon name="trash" size={18} /></button>
      </div>
      <div ref={surface} className="swipe-content" onPointerDown={down} onPointerMove={move}
        onPointerUp={event => finish(event)} onPointerCancel={event => finish(event, true)}
        onLostPointerCapture={event => finish(event, true)}>
        <button className="row" type="button" onClick={event => {
          const dragged = suppressClick.current
          suppressClick.current = false
          if (dragged && event.detail !== 0) return
          if (open) changeOpen(false)
          else onTap()
        }}>{children}</button>
        <button className="swipe-toggle" type="button" data-swipe-toggle=""
          aria-label={`Actions for ${label}`} aria-expanded={open} aria-controls={id}
          onClick={() => changeOpen(!open)}><span aria-hidden="true">···</span></button>
      </div>
    </div>
  )
}
