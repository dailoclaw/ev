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
const LS_ARCHIVED = 'ev.archivedProviders.v1'
const LS_PROVIDER_ORDER = 'ev.providerOrder.v1'

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

// Archived flag and custom order are both purely local overlays — never sent
// to Supabase, never part of the seed/CSV/backup data. Applied to whatever the
// backend hands back, so it works identically whether providers come from
// localStorage or Supabase.
const readArchivedSet = () => new Set(readLS<string[]>(LS_ARCHIVED, []))
const readProviderOrder = () => readLS<string[]>(LS_PROVIDER_ORDER, [])

const finalizeProviders = (providers: Provider[]): Provider[] => {
  const archived = readArchivedSet()
  const withFlags = providers.map(p => ({ ...p, archived: archived.has(p.id) }))
  const order = readProviderOrder()
  if (order.length === 0) return withFlags
  const rank = new Map(order.map((id, i) => [id, i]))
  return withFlags
    .map((p, i) => ({ p, key: rank.has(p.id) ? rank.get(p.id)! : order.length + i }))
    .sort((a, b) => a.key - b.key)
    .map(x => x.p)
}

export function setProviderArchived(id: string, archived: boolean) {
  const set = readArchivedSet()
  if (archived) set.add(id)
  else set.delete(id)
  localStorage.setItem(LS_ARCHIVED, JSON.stringify([...set]))
  state = { ...state, providers: finalizeProviders(state.providers) }
  emit()
}

/** Persist a full provider id order — callers pass the complete desired sequence. */
export function setProviderOrder(order: string[]) {
  localStorage.setItem(LS_PROVIDER_ORDER, JSON.stringify(order))
  state = { ...state, providers: finalizeProviders(state.providers) }
  emit()
}

let state: EvState = {
  sessions: [...seedSessions, ...readLS<Session[]>(LS_SESSIONS, [])],
  providers: finalizeProviders(readLS<Provider[]>(LS_PROVIDERS, DEFAULT_PROVIDERS)),
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

  state = { ...state, providers: finalizeProviders(providers), sessions, synced: true, loading: false }
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

const isRemoteId = (id: string) => !id.startsWith('seed-') && !id.startsWith('local-')

/** Edits a logged charge in place — date, energy, cost, notes. Provider stays fixed. */
export async function updateSession(id: string, patch: Partial<Pick<Session, 'date' | 'amount' | 'cost' | 'notes'>>) {
  const prevSessions = state.sessions
  state = { ...state, sessions: state.sessions.map(s => (s.id === id ? { ...s, ...patch } : s)) }
  emit()

  if (supa && state.synced && isRemoteId(id)) {
    const db: Record<string, unknown> = {}
    if (patch.date !== undefined) db.date = patch.date
    if (patch.amount !== undefined) db.amount = patch.amount
    if (patch.cost !== undefined) db.cost = patch.cost
    if (patch.notes !== undefined) db.notes = patch.notes
    const { error } = await supa.from('charging_sessions').update(db).eq('id', id)
    if (error) {
      console.error('Update failed, reverting', error)
      state = { ...state, sessions: prevSessions }
      emit()
      throw error
    }
    return
  }
  const extras = readLS<Session[]>(LS_SESSIONS, []).map(s => (s.id === id ? { ...s, ...patch } : s))
  localStorage.setItem(LS_SESSIONS, JSON.stringify(extras))
}

/** Removes a logged charge. Returns the removed session so callers can offer Undo. */
export async function deleteSession(id: string): Promise<Session | null> {
  const removed = state.sessions.find(s => s.id === id) ?? null
  const prevSessions = state.sessions
  state = { ...state, sessions: state.sessions.filter(s => s.id !== id) }
  emit()

  if (supa && state.synced && isRemoteId(id)) {
    const { error } = await supa.from('charging_sessions').delete().eq('id', id)
    if (error) {
      console.error('Delete failed, reverting', error)
      state = { ...state, sessions: prevSessions }
      emit()
      throw error
    }
    return removed
  }
  const extras = readLS<Session[]>(LS_SESSIONS, []).filter(s => s.id !== id)
  localStorage.setItem(LS_SESSIONS, JSON.stringify(extras))
  return removed
}

/** Powers the Undo snackbar after a delete — re-adds the session as a fresh row. */
export function undoDeleteSession(session: Session) {
  addSession({ date: session.date, type: session.type, amount: session.amount, cost: session.cost, notes: session.notes })
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
  downloadBlob(csv, filename, 'text/csv;charset=utf-8')
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/* ================= Backup & Restore =================
 * A complete, portable copy of the ledger — separate from the CSV export
 * (which is for spreadsheets) and separate from cloud sync (which is Supabase's
 * job while you're online). This is the plain "get it all back" safety net.
 */

const LS_LAST_BACKUP = 'ev.lastBackupAt.v1'

export interface Backup {
  version: 1
  exportedAt: string
  budgetCap: number
  providers: Provider[]
  sessions: Session[]
}

export function buildBackup(): Backup {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    budgetCap: state.budgetCap,
    providers: state.providers,
    sessions: state.sessions,
  }
}

export function downloadJson(data: unknown, filename: string) {
  downloadBlob(JSON.stringify(data, null, 2), filename, 'application/json')
}

export function markBackedUp() {
  const at = new Date().toISOString()
  localStorage.setItem(LS_LAST_BACKUP, JSON.stringify(at))
}

export function lastBackupAt(): string | null {
  return readLS<string | null>(LS_LAST_BACKUP, null)
}

export function parseBackup(text: string): Backup | null {
  try {
    const data = JSON.parse(text) as Partial<Backup>
    if (!data || typeof data !== 'object') return null
    if (!Array.isArray(data.sessions) || !Array.isArray(data.providers)) return null
    return data as Backup
  } catch {
    return null
  }
}

const sessionSignature = (s: Session) => `${s.date}|${s.type}|${s.amount}|${s.cost}|${s.notes ?? ''}`

function newInBackup(backup: Backup) {
  const existingProviderNames = new Set(state.providers.map(p => p.name))
  const newProviders = backup.providers.filter(p => !existingProviderNames.has(p.name))
  const existingSignatures = new Set(state.sessions.map(sessionSignature))
  const seen = new Set<string>()
  const newSessions = backup.sessions.filter(s => {
    const sig = sessionSignature(s)
    if (existingSignatures.has(sig) || seen.has(sig)) return false
    seen.add(sig)
    return true
  })
  return { newProviders, newSessions }
}

/** What a merge would do, without changing anything — for the confirm screen. */
export function previewRestore(backup: Backup) {
  const { newProviders, newSessions } = newInBackup(backup)
  return {
    providersNew: newProviders.length,
    sessionsNew: newSessions.length,
    totalSessions: backup.sessions.length,
    totalProviders: backup.providers.length,
  }
}

/**
 * Adds whatever the backup has that the ledger doesn't — exact duplicates are
 * skipped. Safe in both local and Supabase-synced modes: it goes through the
 * same addProvider/addSession mutations as manual entry, so synced charges are
 * written straight to Supabase, not just kept on-device.
 */
export function restoreMerge(backup: Backup): { providersAdded: number; sessionsAdded: number } {
  const { newProviders, newSessions } = newInBackup(backup)
  for (const p of newProviders) addProvider(p.name, p.freeKwhPerDay, p.color)
  for (const s of newSessions) addSession({ date: s.date, type: s.type, amount: s.amount, cost: s.cost, notes: s.notes })
  return { providersAdded: newProviders.length, sessionsAdded: newSessions.length }
}

/** Replace everything on this device with the backup's contents. Local-only — never touches Supabase. */
export function restoreReplaceLocal(backup: Backup) {
  const extras = backup.sessions.filter(s => !s.id.startsWith('seed-'))
  localStorage.setItem(LS_SESSIONS, JSON.stringify(extras))
  localStorage.setItem(LS_PROVIDERS, JSON.stringify(backup.providers))
  localStorage.setItem(LS_BUDGET, JSON.stringify(backup.budgetCap))
  state = { ...state, sessions: backup.sessions, providers: backup.providers, budgetCap: backup.budgetCap }
  emit()
}

/**
 * Replace everything in Supabase with the backup's contents: deletes every
 * remote session and provider, then reinserts the backup's rows. Destructive
 * and irreversible from within the app — callers must gate this behind an
 * explicit, deliberate confirmation (never a single accidental tap).
 */
export async function restoreReplaceRemote(backup: Backup): Promise<{ providersAdded: number; sessionsAdded: number }> {
  if (!supa) throw new Error('Not connected to Supabase')

  const delSessions = await supa.from('charging_sessions').delete().neq('id', '')
  if (delSessions.error) throw delSessions.error
  const delProviders = await supa.from('providers').delete().neq('id', '')
  if (delProviders.error) throw delProviders.error

  const providerRows = backup.providers.map(p => ({ name: p.name, color: p.color, free_kwh_per_day: p.freeKwhPerDay }))
  const insProviders = providerRows.length
    ? await supa.from('providers').insert(providerRows).select()
    : { data: [] as DbProvider[], error: null }
  if (insProviders.error) throw insProviders.error
  const idByName = new Map((insProviders.data as DbProvider[]).map(p => [p.name, p.id]))

  const sessionRows = backup.sessions
    .map(s => {
      const providerId = idByName.get(s.type)
      return providerId ? { provider_id: providerId, date: s.date, amount: s.amount, cost: s.cost, notes: s.notes } : null
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)

  const CHUNK = 200
  for (let i = 0; i < sessionRows.length; i += CHUNK) {
    const ins = await supa.from('charging_sessions').insert(sessionRows.slice(i, i + CHUNK))
    if (ins.error) throw ins.error
  }

  await loadRemote()
  return { providersAdded: providerRows.length, sessionsAdded: sessionRows.length }
}
