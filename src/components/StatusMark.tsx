// Adapted from React Bits Status Mark. See docs/licenses/react-bits.md.
import type { CSSProperties } from 'react'
import type { StatusMarkState } from '../lib/syncPresentation'
import './StatusMark.css'

export default function StatusMark({ status, size = 18 }: { status: StatusMarkState; size?: number }) {
  return (
    <span className="status-mark" data-status={status} style={{ '--sm-size': `${size}px` } as CSSProperties} aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <circle className="status-mark__track" cx="12" cy="12" r="9" />
        <circle className="status-mark__ring" cx="12" cy="12" r="9" pathLength="100" />
        <path className="status-mark__check" d="M7.5 12.25 10.5 15.25 16.75 8.75" pathLength="1" />
        <path className="status-mark__cross" d="M8.5 8.5 15.5 15.5M15.5 8.5 8.5 15.5" pathLength="1" />
      </svg>
    </span>
  )
}
