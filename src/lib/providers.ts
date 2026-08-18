// Provider (charger network) config.
// Shaped to match the future Supabase `providers` table so Phase 4 is a drop-in swap:
//   id · name · color · free_kwh_per_day
export interface Provider {
  id: string
  name: string
  color: string
  freeKwhPerDay: number
  /** Hidden from pickers, but every session it ever contributed still counts everywhere. */
  archived?: boolean
  /** Stable picker order, synced with the provider. */
  sortOrder?: number
}

// Palette used when a new provider is added without picking a colour.
export const PROVIDER_PALETTE = [
  '#f59e0b', '#06b6d4', '#84cc16', '#d946ef', '#0ea5e9',
  '#f97316', '#14b8a6', '#a855f7', '#ef4444', '#22c55e',
]

export const providerInitial = (name: string) => name.charAt(0).toUpperCase()

export const nextPaletteColor = (existing: Provider[]) => {
  const used = new Set(existing.map(p => p.color.toLowerCase()))
  return PROVIDER_PALETTE.find(c => !used.has(c.toLowerCase())) ?? PROVIDER_PALETTE[0]
}
