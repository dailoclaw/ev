// Data layer with two backends behind one store API:
//  - Local:    bundled JSON + localStorage (no config needed)
//  - Supabase: providers + charging_sessions with realtime sync
// The backend is chosen by the presence of VITE_SUPABASE_* env vars (see supa.ts).
import { useSyncExternalStore } from 'react'
import rawData from '../data/ev_data.json'
import { DEFAULT_PROVIDERS, nextPaletteColor, slugify, type Provider } from './providers'
import type { Session } from './savings'
import { supa, type DbProvider, type DbSession } from './supa'

const LS_SESSIONS = 'ev.extraSessions.v1'
const LS_PROVIDERS = 'ev.providers.v1'
const LS_BUDGET = 'ev.budgetCap.v1'

interface EvState {
  sessions: Session[]
  providers: Provider[]
  budgetCap: number
  synced: boolean // true when live on Supabase
  loading: boolean
}

const readLS = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

const seedSessions: Session[] = (rawData as Array<Record<string, unknown>>).map((item, i) => ({
  id: `seed-${i}`,
  date: String(item.Date),
  type: String(item.Type || 'Unknown'),
  amount: Number(item.Amount) || 0,
  cost: Number(item.Cost) || 0,
  notes: (item.Notes as string) || null,
}))

let state: EvState = {
  sessions: [...seedSessions, ...readLS<Session[]>(LS_SESSIONS, [])],
  providers: readLS<Provider[]>(LS_PROVIDERS, DEFAULT_PROVIDERS),
  budgetCap: readLS<number>(LS_BUDGET, 50),
  synced: false,
  loading: !!supa,
}

const listeners = new Set<() => void>()
const emit = () => listeners.forEach(fn => fn())
const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
export const getState = () => state
export function useEvState(): EvState {
  return useSyncExternalStore(subscribe, getState, getState)
}

/* ================= Supabase backend ================= */

const mapProvider = (p: DbProvider): Provider => ({
  id: p.id,
  name: p.name,
  color: p.color,
  freeKwhPerDay: Number(p.free_kwh_per_day) || 0,
})

const mapSession = (s: DbSession, providersById: Map<string, string>): Session => ({
  id: s.id,
  date: s.date,
  type: s.providers?.name ?? providersById.get(s.provider_id) ?? 'Unknown',
  amount: Number(s.amount) || 0,
  cost: Number(s.cost) || 0,
  notes: s.notes,
})

let providerIdByName = new Map<string, string>()

async function loadRemote(): Promise<void> {
  if (!supa) return
  const [provRes, sessRes] = await Promise.all([
    supa.from('providers').select('*').order('name'),
    supa.from('charging_sessions').select('*, providers(name)').order('date', { ascending: true }),
  ])
  if (provRes.error || sessRes.error) {
    console.error('Supabase load failed', provRes.error ?? sessRes.error)
    state = { ...state, loading: false }
    emit()
    return
  }
  const providers = (provRes.data as DbProvider[]).map(mapProvider)
  providerIdByName = new Map(providers.map(p => [p.name, p.id]))
  const providersById = new Map(providers.map(p => [p.id, p.name]))
  const sessions = (sessRes.data as DbSession[]).map(s => mapSession(s, providersById))

  state = { ...state, providers, sessions, synced: true, loading: false }
  emit()

  // one-time: push any records captured locally before Supabase was connected
  await migrateLocalExtras()
}

async function migrateLocalExtras() {
  if (!supa) return
  const extras = readLS<Session[]>(LS_SESSIONS, [])
  if (extras.length === 0) return
  for (const s of extras) {
    const providerId = providerIdByName.get(s.type)
    if (!providerId) continue
    await supa.from('charging_sessions').insert({
      provider_id: providerId,
      date: s.date,
      amount: s.amount,
      cost: s.cost,
      notes: s.notes,
    })
  }
  localStorage.removeItem(LS_SESSIONS)
  await reloadSoon()
}

let reloadTimer: ReturnType<typeof setTimeout> | undefined
function reloadSoon() {
  clearTimeout(reloadTimer)
  reloadTimer = setTimeout(() => void loadRemote(), 250)
}

if (supa) {
  void loadRemote()
  supa
    .channel('ev-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'charging_sessions' }, reloadSoon)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'providers' }, reloadSoon)
    .subscribe()
  // Mobile-PWA safety net: realtime sockets drop when the app is backgrounded,
  // so refetch whenever the app comes back to the foreground.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') reloadSoon()
  })
  window.addEventListener('focus', reloadSoon)
}

/* ================= mutations (backend-aware) ================= */

export function addSession(input: Omit<Session, 'id'>) {
  const session: Session = { ...input, id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }
  // optimistic UI either way
  state = { ...state, sessions: [...state.sessions, session] }
  emit()

  if (supa && state.synced) {
    const providerId = providerIdByName.get(input.type)
    if (providerId) {
      void supa
        .from('charging_sessions')
        .insert({ provider_id: providerId, date: input.date, amount: input.amount, cost: input.cost, notes: input.notes })
        .then(({ error }) => {
          if (error) {
            console.error('Insert failed, keeping local copy', error)
            persistLocalExtra(session)
          }
          // realtime will reload with the canonical row
        })
      return session
    }
  }
  persistLocalExtra(session)
  return session
}

function persistLocalExtra(session: Session) {
  const extras = readLS<Session[]>(LS_SESSIONS, [])
  extras.push(session)
  localStorage.setItem(LS_SESSIONS, JSON.stringify(extras))
}

export function addProvider(name: string, freeKwhPerDay: number, color?: string): Provider {
  const provider: Provider = {
    id: slugify(name),
    name: name.trim(),
    color: color ?? nextPaletteColor(state.providers),
    freeKwhPerDay,
  }
  state = { ...state, providers: [...state.providers, provider] }
  emit()

  if (supa && state.synced) {
    void supa
      .from('providers')
      .insert({ name: provider.name, color: provider.color, free_kwh_per_day: provider.freeKwhPerDay })
      .select()
      .single()
      .then(({ data, error }) => {
        if (error) console.error('Provider insert failed', error)
        else if (data) providerIdByName.set(provider.name, (data as DbProvider).id)
      })
  } else {
    localStorage.setItem(LS_PROVIDERS, JSON.stringify(state.providers))
  }
  return provider
}

export function updateProvider(id: string, patch: Partial<Omit<Provider, 'id'>>) {
  const providers = state.providers.map(p => (p.id === id ? { ...p, ...patch } : p))
  state = { ...state, providers }
  emit()

  if (supa && state.synced) {
    const db: Record<string, unknown> = {}
    if (patch.name !== undefined) db.name = patch.name
    if (patch.color !== undefined) db.color = patch.color
    if (patch.freeKwhPerDay !== undefined) db.free_kwh_per_day = patch.freeKwhPerDay
    void supa.from('providers').update(db).eq('id', id).then(({ error }) => {
      if (error) console.error('Provider update failed', error)
    })
  } else {
    localStorage.setItem(LS_PROVIDERS, JSON.stringify(providers))
  }
}

export function setBudgetCap(cap: number) {
  localStorage.setItem(LS_BUDGET, JSON.stringify(cap))
  state = { ...state, budgetCap: cap }
  emit()
}

/* ================= CSV export ================= */

export function buildCsv(sessions: Array<Session & { freeKwh?: number }>): string {
  const esc = (v: string | number | null) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }
  const header = 'Date,Provider,AmountKwh,CostAud,FreeKwh,Notes'
  const rows = sessions.map(s =>
    [s.date, s.type, s.amount, s.cost.toFixed(2), (s.freeKwh ?? 0).toFixed(2), s.notes ?? ''].map(esc).join(','),
  )
  return [header, ...rows].join('\n')
}

export function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
