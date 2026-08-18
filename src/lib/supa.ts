// Supabase is the canonical backend. IndexedDB provides an offline cache, but
// the application intentionally has no unauthenticated/local-only product mode.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const hasSupabaseConfig = Boolean(url && anonKey)

export const supa: SupabaseClient | null = url && anonKey
  ? createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      realtime: { params: { eventsPerSecond: 5 } },
    })
  : null

export interface DbProvider {
  id: string
  name: string
  color: string
  free_kwh_per_day: number
  archived: boolean
  sort_order: number
}

export interface DbSession {
  id: string
  provider_id: string
  date: string
  amount: number
  cost: number
  notes: string | null
}

export interface DbSettings {
  id: 1
  owner_id: string
  budget_cap: number
  theme: 'light' | 'dark'
  style: 'classic' | 'minimal'
  density: 'comfortable' | 'compact' | 'presentation'
  vehicle_efficiency: number
  petrol_price: number
  petrol_use: number
  vehicle_photo_path: string | null
  updated_at: string
}
