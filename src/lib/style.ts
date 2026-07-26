// Classic / Minimal visual style — persisted, applied to <html data-style>.
// Classic is the original Cockpit Ledger look; Minimal is a calmer layer over
// the same markup (bigger radii, no card borders, sentence-case labels, more
// air). Token values live in minimal.css; this just flips the attribute.
// Composes with the light/dark theme — both attributes apply independently.
import { useState } from 'react'

export type Style = 'classic' | 'minimal'
const KEY = 'ev.style'

export const getStoredStyle = (): Style => (localStorage.getItem(KEY) === 'minimal' ? 'minimal' : 'classic')

export function applyStyle(style: Style) {
  const root = document.documentElement
  if (style === 'minimal') root.dataset.style = 'minimal'
  else delete root.dataset.style
}

export function setStyle(style: Style) {
  localStorage.setItem(KEY, style)
  applyStyle(style)
}

/** Settings toggle state — reads the stored value, writes through on change. */
export function useStyle() {
  const [style, set] = useState<Style>(getStoredStyle)
  const update = (s: Style) => {
    setStyle(s)
    set(s)
  }
  return [style, update] as const
}
