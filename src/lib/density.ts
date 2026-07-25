import { useState } from 'react'

export type Density = 'comfortable' | 'compact' | 'presentation'
const KEY = 'ev.density'

const isDensity = (value: string | null): value is Density =>
  value === 'compact' || value === 'presentation' || value === 'comfortable'

export const getStoredDensity = (): Density => {
  const stored = localStorage.getItem(KEY)
  return isDensity(stored) ? stored : 'comfortable'
}

export function applyDensity(density: Density) {
  const root = document.documentElement
  if (density === 'comfortable') delete root.dataset.density
  else root.dataset.density = density
}

export function setDensity(density: Density) {
  localStorage.setItem(KEY, density)
  applyDensity(density)
}

export function useDensity() {
  const [density, set] = useState<Density>(getStoredDensity)
  const update = (value: Density) => {
    setDensity(value)
    set(value)
  }
  return [density, update] as const
}
