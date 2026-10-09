import { updateAppSettings, useEvState } from './data'

export type Density = 'comfortable' | 'compact' | 'presentation'
const KEY = 'ev.density'

const isDensity = (value: string | null): value is Density =>
  value === 'compact' || value === 'presentation' || value === 'comfortable'

export const getStoredDensity = (): Density => {
  let stored: string | null = null
  try { stored = localStorage.getItem(KEY) } catch { /* Use the default. */ }
  return isDensity(stored) ? stored : 'comfortable'
}

export function applyDensity(density: Density) {
  const root = document.documentElement
  if (density === 'comfortable') delete root.dataset.density
  else root.dataset.density = density
}

export async function setDensity(density: Density) {
  await updateAppSettings({ density })
  applyDensity(density)
}

export function useDensity() {
  const density = useEvState().settings.density
  const update = (value: Density) => setDensity(value)
  return [density, update] as const
}
