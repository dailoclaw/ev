// Supabase client — active only when env vars are present.
// Without them the app runs on the local (JSON + localStorage) backend.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supa: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null

export interface DbProvider {
  id: string
  name: string
  color: string
  free_kwh_per_day: number
}

export interface DbSession {
  id: string
  provider_id: string
  date: string
  amount: number
  cost: number
  notes: string | null
  providers?: { name: string } | null
}
