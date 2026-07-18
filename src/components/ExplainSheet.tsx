import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { Derivation } from '../lib/derive'

/**
 * Renders a Derivation: the arithmetic behind a figure, with the rows underneath.
 *
 * Portalled to <body> because these figures live inside cards that set their own
 * colour (the green savecard makes text white) — and a fixed-position dialog
 * nested in arbitrary content also inherits transforms and overflow clipping.
 */
export default function ExplainSheet({ deriv, onClose }: { deriv: Derivation; onClose: () => void }) {
  const [showRows, setShowRows] = useState(false)

  return createPortal(
    <div className="sheet-backdrop" role="presentation" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={`How ${deriv.title} was calculated`}
        onClick={e => e.stopPropagation()}
      >
        <div className="handle" />

        <div className="exp-head">
          <span className="cap">How this was calculated</span>
          <b>{deriv.title}</b>
          <div className="exp-val">{deriv.value}</div>
        </div>

        <div className="deriv">
          {deriv.lines.map((l, i) => (
            <div
              key={i}
              className={`dl d${l.depth ?? 0}${l.strong ? ' strong' : ''}${l.gap ? ' gap' : ''}${
                l.tone ? ` t-${l.tone}` : ''
              }`}
            >
              {l.op && <span className="op">{l.op}</span>}
              <span className="lb">{l.label}</span>
              {l.value && <span className="val">{l.value}</span>}
            </div>
          ))}
        </div>

        {deriv.rows && deriv.rows.items.length > 0 && (
          <div className="exp-rows">
            <button type="button" className="exp-toggle" onClick={() => setShowRows(v => !v)}>
              {showRows ? 'Hide' : 'Show'} {deriv.rows.label}
              <span className={`chev ${showRows ? 'up' : ''}`}>›</span>
            </button>
            {showRows && (
              <div className="exp-list">
                {deriv.rows.items.map((r, i) => (
                  <div className="exp-row" key={i}>
                    <span>{r.label}</span>
                    <b>{r.value}</b>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {deriv.footnote && <p className="exp-foot">{deriv.footnote}</p>}
      </div>
    </div>,
    document.body,
  )
}
