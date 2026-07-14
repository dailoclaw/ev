// Provider (charger network) config.
// Shaped to match the future Supabase `providers` table so Phase 4 is a drop-in swap:
//   id · name · color · free_kwh_per_day
export interface Provider {
  id: string
  name: string
  color: string
  freeKwhPerDay: number
}

// Palette used when a new provider is added without picking a colour.
export const PROVIDER_PALETTE = [
  '#f59e0b', '#06b6d4', '#84cc16', '#d946ef', '#0ea5e9',
  '#f97316', '#14b8a6', '#a855f7', '#ef4444', '#22c55e',
]

export const DEFAULT_PROVIDERS: Provider[] = [
  { id: 'jolt', name: 'Jolt', color: '#0d9488', freeKwhPerDay: 7 },
  { id: 'matty', name: 'Matty', color: '#6366f1', freeKwhPerDay: 0 },
  { id: 'chargefox', name: 'Chargefox', color: '#8b5cf6', freeKwhPerDay: 0 },
  { id: 'supercharger', name: 'Supercharger', color: '#f43f5e', freeKwhPerDay: 0 },
]

export const providerInitial = (name: string) => name.charAt(0).toUpperCase()

export const nextPaletteColor = (existing: Provider[]) => {
  const used = new Set(existing.map(p => p.color.toLowerCase()))
  return PROVIDER_PALETTE.find(c => !used.has(c.toLowerCase())) ?? PROVIDER_PALETTE[0]
}

export const slugify = (name: string) =>
  name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'provider'
