import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

const openDialogs = new Set<HTMLDialogElement>()
let originalOverflow = ''

/** Native modal dialogs provide background inertness and stacked focus containment. */
export default function Modal({ children, label, labelledBy, describedBy, onClose, busy = false,
  className = 'sheet', backdropClass = 'sheet-backdrop', closeLabel = 'Close dialog' }: {
  children: ReactNode; label?: string; labelledBy?: string; describedBy?: string
  onClose: () => void; busy?: boolean; className?: string; backdropClass?: string; closeLabel?: string
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const invoker = useRef(document.activeElement instanceof HTMLElement ? document.activeElement : null)
  useLayoutEffect(() => {
    const dialog = ref.current!
    const source = invoker.current
    if (openDialogs.size === 0) {
      originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }
    openDialogs.add(dialog)
    dialog.showModal()
    return () => {
      dialog.close()
      openDialogs.delete(dialog)
      if (openDialogs.size === 0) document.body.style.overflow = originalOverflow
      let target = source?.closest('[inert]')
        ? source.closest('[data-modal-focus-group]')?.querySelector<HTMLElement>('[data-modal-focus-fallback]') : source
      if ((!target?.isConnected || target === document.body || target === document.documentElement) && openDialogs.size === 0) {
        target = document.querySelector<HTMLElement>('[data-modal-global-fallback]')
      }
      if (target?.isConnected && !target.closest('[inert]')) target.focus({ preventScroll: true })
    }
  }, [])

  return createPortal(
    <dialog ref={ref} className="modal-root" aria-modal="true" aria-label={label}
      aria-labelledby={labelledBy} aria-describedby={describedBy}
      onKeyDown={event => {
        if (event.key !== 'Tab' || (event.target as Element).closest('dialog') !== event.currentTarget) return
        const items = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]')].filter(item => item.getClientRects().length > 0)
        const first = items[0], last = items.at(-1)
        if (!first) { event.preventDefault(); return }
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last!.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }}
      onCancel={event => { event.preventDefault(); if (!busy) onClose() }}>
      <div className={backdropClass} onClick={event => { if (event.target === event.currentTarget && !busy) onClose() }}>
        <section className={className}>
          <button className="modal-close" type="button" aria-label={closeLabel} disabled={busy} onClick={onClose}>×</button>
          {children}
        </section>
      </div>
    </dialog>, document.body,
  )
}
