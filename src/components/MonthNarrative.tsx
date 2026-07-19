import { useState } from 'react'
import type { EvData } from '../lib/useEv'
import type { MonthNarrative as Narrative, NarrativeSeg } from '../lib/narrate'
import { deriveMonthSpend } from '../lib/derive'
import Explainable from './Explainable'

/** Collapsed by default — the numbers are the page; this is the optional read. */
export default function MonthNarrative({ narrative, ev, ym }: { narrative: Narrative; ev: EvData; ym: string }) {
  const [open, setOpen] = useState(false)

  const renderSegs = (segs: NarrativeSeg[], key: string) =>
    segs.map((s, i) => {
      if (s.total) {
        return (
          <Explainable
            key={`${key}-${i}`}
            className="inline"
            derive={() => deriveMonthSpend(ev, ym)}
            label={`${s.text} spent this month`}
          >
            <b>{s.text}</b>
          </Explainable>
        )
      }
      if (s.em) return <b key={`${key}-${i}`}>{s.text}</b>
      return <span key={`${key}-${i}`}>{s.text}</span>
    })

  return (
    <section className="narr-wrap">
      <button
        type="button"
        className="narr-toggle"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
      >
        <span>The month in a paragraph</span>
        <span className={`chev ${open ? 'up' : ''}`} aria-hidden>
          ›
        </span>
      </button>

      {open && (
        <div className="narr-body">
          <p className="narr">{renderSegs(narrative.opening, 'o')}</p>
          {narrative.points.map((pt, i) => (
            <p className="narr" key={i}>
              {renderSegs(pt, `p${i}`)}
            </p>
          ))}
          {narrative.partial && <p className="narr-partial">{narrative.partial}</p>}
        </div>
      )}
    </section>
  )
}
