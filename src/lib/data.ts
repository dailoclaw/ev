import { useSyncExternalStore } from 'react'
import { DEFAULT_SETTINGS, type AppSettings, type SyncStatus, type VehicleAssumptions } from './appModel'
import {
  commitCachedState,
  listOutbox,
  loadCachedSnapshot,
  removeOutboxOperation,
  type CachedSnapshot,
  type OutboxOperation,
} from './cache'
import { nextPaletteColor, type Provider } from './providers'
import { applyOutboxOperation, downloadVehiclePhoto, fetchRemoteSnapshot } from './repository'
import type { Session } from './savings'
import { supa, type DbProvider, type DbSession, type DbSettings } from './supa'
import { validateProviderInput, validateSessionInput } from './validation'
import { backupDelta, sessionSignature, type Backup } from './backup'

export { parseBackup } from './backup'
export type { Backup } from './backup'
export { buildCsv, downloadCsv, downloadJson } from './exports'

const LS_SESSIONS = 'ev.extraSessions.v1'
const LS_PROVIDERS = 'ev.providers.v1'
const LS_BUDGET = 'ev.budgetCap.v1'
const LS_ARCHIVED = 'ev.archivedProviders.v1'
const LS_PROVIDER_ORDER = 'ev.providerOrder.v1'
const LS_VEHICLE = 'ev.vehicle.v1'
const LS_PHOTO = 'ev.vehiclePhoto.v1'
const LS_THEME = 'ev.theme'
const LS_STYLE = 'ev.style'
const LS_DENSITY = 'ev.density'
const LS_MIGRATED = 'ev.supabaseCanonicalMigrated.v2'
const LS_LAST_BACKUP = 'ev.lastBackupAt.v1'

export interface EvState {
  sessions: Session[]
  providers: Provider[]
  settings: AppSettings
  budgetCap: number
  vehiclePhoto: string | null
  synced: boolean
  loading: boolean
  syncStatus: SyncStatus
  pendingCount: number
  lastSyncError: string | null
}

let state: EvState = {
  sessions: [],
  providers: [],
  settings: DEFAULT_SETTINGS,
  budgetCap: DEFAULT_SETTINGS.budgetCap,
  vehiclePhoto: null,
  synced: false,
  loading: true,
  syncStatus: 'signed-out',
  pendingCount: 0,
  lastSyncError: null,
}

const listeners = new Set<() => void>()
const emit = () => listeners.forEach(listener => listener())
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const getState = () => state
export function useEvState(): EvState {
  return useSyncExternalStore(subscribe, getState, getState)
}

const isOnline = () => typeof navigator === 'undefined' || navigator.onLine
const uuid = () => crypto.randomUUID()
const now = () => new Date().toISOString()

const readLS = <T,>(key: string, fallback: T): T => {
  try {
    const value = localStorage.getItem(key)
    return value ? (JSON.parse(value) as T) : fallback
  } catch {
    return fallback
  }
}

const finalizeProviders = (providers: Provider[]): Provider[] =>
  [...providers].sort(
    (a, b) =>
      Number(b.freeKwhPerDay > 0) - Number(a.freeKwhPerDay > 0) ||
      (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER) ||
      a.name.localeCompare(b.name),
  )

const mapProvider = (provider: DbProvider): Provider => ({
  id: provider.id,
  name: provider.name,
  color: provider.color,
  freeKwhPerDay: Number(provider.free_kwh_per_day),
  archived: provider.archived,
  sortOrder: provider.sort_order,
})

const mapSession = (session: DbSession, providersById: Map<string, string>): Session => ({
  id: session.id,
  providerId: session.provider_id,
  date: session.date,
  type: providersById.get(session.provider_id) ?? 'Unknown',
  amount: Number(session.amount),
  cost: Number(session.cost),
  notes: session.notes,
})

const mapSettings = (settings: DbSettings): AppSettings => ({
  budgetCap: Number(settings.budget_cap),
  theme: settings.theme,
  style: settings.style,
  density: settings.density,
  vehicle: {
    efficiency: Number(settings.vehicle_efficiency),
    petrolPrice: Number(settings.petrol_price),
    petrolUse: Number(settings.petrol_use),
  },
  vehiclePhotoPath: settings.vehicle_photo_path,
})

const providerPayload = (provider: Provider) => ({
  id: provider.id,
  name: provider.name.trim(),
  color: provider.color,
  free_kwh_per_day: provider.freeKwhPerDay,
  archived: Boolean(provider.archived),
  sort_order: provider.sortOrder ?? 0,
})

const sessionPayload = (session: Session) => ({
  id: session.id,
  provider_id: session.providerId,
  date: session.date,
  amount: session.amount,
  cost: session.cost,
  notes: session.notes,
})

const settingsPayload = (settings: AppSettings) => ({
  budget_cap: settings.budgetCap,
  theme: settings.theme,
  style: settings.style,
  density: settings.density,
  vehicle_efficiency: settings.vehicle.efficiency,
  petrol_price: settings.vehicle.petrolPrice,
  petrol_use: settings.vehicle.petrolUse,
  vehicle_photo_path: settings.vehiclePhotoPath,
  updated_at: now(),
})

const cachedSnapshot = (): CachedSnapshot => ({
  ownerId: ownerId ?? '',
  sessions: state.sessions,
  providers: state.providers,
  settings: state.settings,
  vehiclePhotoDataUrl: state.vehiclePhoto?.startsWith('data:') ? state.vehiclePhoto : null,
  cachedAt: now(),
})

function applyCachedSnapshot(snapshot: CachedSnapshot) {
  state = {
    ...state,
    sessions: snapshot.sessions,
    providers: finalizeProviders(snapshot.providers),
    settings: snapshot.settings,
    budgetCap: snapshot.settings.budgetCap,
    vehiclePhoto: snapshot.vehiclePhotoDataUrl,
    loading: false,
  }
  emit()
}

let ownerId: string | null = null
let syncPromise: Promise<void> | null = null
let syncRequested = false
let reloadTimer: ReturnType<typeof setTimeout> | undefined
let realtimeChannel: ReturnType<NonNullable<typeof supa>['channel']> | null = null
let lifecycleBound = false

function mutationOperation(
  id: string,
  action: OutboxOperation['action'],
  payload: Record<string, unknown>,
  updatedAt = now(),
): OutboxOperation {
  if (!ownerId) throw new Error('Sign in before changing the ledger.')
  return { id: `${ownerId}:${id}`, ownerId, updatedAt, action, payload } as OutboxOperation
}

async function persistAndSync(operations: OutboxOperation[]) {
  try {
    await commitCachedState(cachedSnapshot(), operations)
    const pendingCount = (await listOutbox(ownerId ?? undefined)).length
    state = {
      ...state,
      pendingCount,
      synced: false,
      syncStatus: isOnline() ? 'syncing' : 'offline',
      lastSyncError: null,
    }
    emit()
    if (isOnline()) void synchronize()
  } catch (error) {
    state = {
      ...state,
      syncStatus: 'error',
      lastSyncError: error instanceof Error ? error.message : 'Could not save the offline queue.',
    }
    emit()
  }
}

async function flushOutbox(currentOwnerId: string) {
  const operations = await listOutbox(currentOwnerId)
  for (const operation of operations) {
    await applyOutboxOperation(operation, currentOwnerId)
    await removeOutboxOperation(operation.id)
  }
}

function applyRemote(remote: Awaited<ReturnType<typeof fetchRemoteSnapshot>>) {
  const providers = remote.providers.map(mapProvider)
  const providersById = new Map(providers.map(provider => [provider.id, provider.name]))
  const settings = mapSettings(remote.settings)
  state = {
    ...state,
    providers: finalizeProviders(providers),
    sessions: remote.sessions.map(session => mapSession(session, providersById)),
    settings,
    budgetCap: settings.budgetCap,
    vehiclePhoto: remote.vehiclePhotoDataUrl,
    loading: false,
    lastSyncError: null,
  }
  emit()
}

async function migrateLegacyState(currentOwnerId: string) {
  if (localStorage.getItem(LS_MIGRATED) === 'done') return

  const operations: OutboxOperation[] = []
  const legacyProviders = readLS<Provider[]>(LS_PROVIDERS, [])
  const archivedIds = new Set(readLS<string[]>(LS_ARCHIVED, []))
  const orderedIds = readLS<string[]>(LS_PROVIDER_ORDER, [])
  const legacyNameById = new Map(legacyProviders.map(provider => [provider.id, provider.name]))
  const archivedNames = new Set([...archivedIds].map(id => legacyNameById.get(id)).filter(Boolean))
  const orderedNames = orderedIds.map(id => legacyNameById.get(id)).filter((name): name is string => Boolean(name))

  let providers = [...state.providers]
  for (const legacy of legacyProviders) {
    if (providers.some(provider => provider.name.toLowerCase() === legacy.name.toLowerCase())) continue
    const provider: Provider = {
      ...legacy,
      id: uuid(),
      archived: archivedIds.has(legacy.id) || Boolean(legacy.archived),
      sortOrder: providers.length,
    }
    providers.push(provider)
    operations.push(mutationOperation(`provider:${provider.id}`, 'provider-upsert', providerPayload(provider)))
  }

  providers = providers.map((provider, index) => {
    const orderedIndex = orderedNames.findIndex(name => name.toLowerCase() === provider.name.toLowerCase())
    const next = {
      ...provider,
      archived: Boolean(provider.archived || archivedIds.has(provider.id) || archivedNames.has(provider.name)),
      sortOrder: orderedIndex >= 0 ? orderedIndex : orderedNames.length + index,
    }
    if (next.archived !== provider.archived || next.sortOrder !== provider.sortOrder) {
      operations.push(mutationOperation(`provider:${next.id}`, 'provider-upsert', providerPayload(next)))
    }
    return next
  })

  const signatures = new Set(state.sessions.map(sessionSignature))
  const sessions = [...state.sessions]
  for (const legacy of readLS<Session[]>(LS_SESSIONS, [])) {
    if (signatures.has(sessionSignature(legacy))) continue
    const provider = providers.find(candidate => candidate.name.toLowerCase() === legacy.type.toLowerCase())
    if (!provider) continue
    const session: Session = { ...legacy, id: uuid(), providerId: provider.id }
    if (validateSessionInput(session)) continue
    signatures.add(sessionSignature(session))
    sessions.push(session)
    operations.push(mutationOperation(`session:${session.id}`, 'session-upsert', sessionPayload(session)))
  }

  const legacyVehicle = readLS<Partial<VehicleAssumptions>>(LS_VEHICLE, {})
  const settings: AppSettings = {
    ...state.settings,
    budgetCap: readLS<number>(LS_BUDGET, state.settings.budgetCap),
    theme: localStorage.getItem(LS_THEME) === 'dark' ? 'dark' : state.settings.theme,
    style: localStorage.getItem(LS_STYLE) === 'minimal' ? 'minimal' : state.settings.style,
    density: ['compact', 'presentation', 'comfortable'].includes(localStorage.getItem(LS_DENSITY) ?? '')
      ? (localStorage.getItem(LS_DENSITY) as AppSettings['density'])
      : state.settings.density,
    vehicle: { ...state.settings.vehicle, ...legacyVehicle },
  }
  const legacyPhoto = localStorage.getItem(LS_PHOTO)
  if (legacyPhoto?.startsWith('data:image/')) settings.vehiclePhotoPath = `${currentOwnerId}/vehicle.jpg`

  state = {
    ...state,
    providers: finalizeProviders(providers),
    sessions,
    settings,
    budgetCap: settings.budgetCap,
    vehiclePhoto: legacyPhoto?.startsWith('data:image/') ? legacyPhoto : state.vehiclePhoto,
  }
  if (legacyPhoto?.startsWith('data:image/')) {
    operations.push(
      mutationOperation('photo', 'photo-upsert', { path: settings.vehiclePhotoPath!, dataUrl: legacyPhoto }, new Date(Date.now() - 1).toISOString()),
    )
  }
  operations.push(mutationOperation('settings', 'settings-update', settingsPayload(settings)))

  await commitCachedState(cachedSnapshot(), operations)
  localStorage.setItem(LS_MIGRATED, 'done')
  ;[LS_SESSIONS, LS_PROVIDERS, LS_BUDGET, LS_ARCHIVED, LS_PROVIDER_ORDER, LS_VEHICLE, LS_PHOTO].forEach(key =>
    localStorage.removeItem(key),
  )
}

async function runSynchronization() {
  const currentOwnerId = ownerId
  if (!currentOwnerId || !supa) return
  if (!isOnline()) {
    state = { ...state, loading: false, synced: false, syncStatus: 'offline' }
    emit()
    return
  }

  state = { ...state, syncStatus: 'syncing', synced: false, lastSyncError: null }
  emit()
  try {
    await flushOutbox(currentOwnerId)
    if (ownerId !== currentOwnerId) return
    const initialRemote = await fetchRemoteSnapshot()
    if (ownerId !== currentOwnerId) return
    if ((await listOutbox(currentOwnerId)).length > 0) {
      syncRequested = true
      return
    }
    applyRemote(initialRemote)
    await migrateLegacyState(currentOwnerId)
    if (ownerId !== currentOwnerId) return
    await flushOutbox(currentOwnerId)
    if (ownerId !== currentOwnerId) return
    if ((await listOutbox(currentOwnerId)).length > 0) {
      syncRequested = true
      return
    }
    const canonicalRemote = await fetchRemoteSnapshot()
    if (ownerId !== currentOwnerId) return
    if ((await listOutbox(currentOwnerId)).length > 0) {
      syncRequested = true
      return
    }
    applyRemote(canonicalRemote)
    state = { ...state, pendingCount: 0, synced: true, syncStatus: 'synced', loading: false }
    await commitCachedState(cachedSnapshot())
    emit()
  } catch (error) {
    if (ownerId !== currentOwnerId) return
    const message = error instanceof Error ? error.message : 'Supabase synchronization failed.'
    const pendingCount = (await listOutbox(currentOwnerId).catch(() => [])).length
    state = {
      ...state,
      pendingCount,
      synced: false,
      loading: false,
      syncStatus: isOnline() ? 'error' : 'offline',
      lastSyncError: message,
    }
    emit()
  }
}

export function synchronize(): Promise<void> {
  if (syncPromise) {
    syncRequested = true
    return syncPromise
  }
  syncRequested = false
  syncPromise = runSynchronization().finally(() => {
    syncPromise = null
    if (syncRequested) void synchronize()
  })
  return syncPromise
}

function reloadSoon() {
  clearTimeout(reloadTimer)
  reloadTimer = setTimeout(() => void synchronize(), 250)
}

function bindLifecycle() {
  if (lifecycleBound || !supa) return
  lifecycleBound = true
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') reloadSoon()
  })
  window.addEventListener('focus', reloadSoon)
  window.addEventListener('online', reloadSoon)
  window.addEventListener('offline', () => {
    state = { ...state, synced: false, syncStatus: 'offline' }
    emit()
  })
}

export async function initializeData(currentOwnerId: string) {
  if (ownerId === currentOwnerId && state.syncStatus !== 'signed-out') return synchronize()
  ownerId = currentOwnerId
  state = { ...state, loading: true, syncStatus: 'loading', lastSyncError: null }
  emit()

  const cached = await loadCachedSnapshot().catch(() => null)
  if (cached?.ownerId === currentOwnerId) applyCachedSnapshot(cached)
  const pendingCount = (await listOutbox(currentOwnerId).catch(() => [])).length
  state = { ...state, pendingCount }
  emit()

  bindLifecycle()
  realtimeChannel =
    supa
      ?.channel('ev-owner-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'charging_sessions' }, reloadSoon)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'providers' }, reloadSoon)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, reloadSoon)
      .subscribe() ?? null
  await synchronize()
}

export function stopDataSync() {
  if (realtimeChannel && supa) void supa.removeChannel(realtimeChannel)
  realtimeChannel = null
  ownerId = null
  state = {
    ...state,
    sessions: [],
    providers: [],
    vehiclePhoto: null,
    settings: DEFAULT_SETTINGS,
    budgetCap: DEFAULT_SETTINGS.budgetCap,
    synced: false,
    loading: false,
    syncStatus: 'signed-out',
    pendingCount: 0,
    lastSyncError: null,
  }
  emit()
}

export const retrySync = () => synchronize()

/* ================= Mutations ================= */

export function addSession(input: Omit<Session, 'id' | 'providerId'>): Session {
  const validationError = validateSessionInput(input)
  if (validationError) throw new Error(validationError)
  const provider = state.providers.find(candidate => candidate.name === input.type)
  if (!provider) throw new Error('Choose a valid provider before saving.')
  const session: Session = { ...input, id: uuid(), providerId: provider.id }
  state = { ...state, sessions: [...state.sessions, session] }
  emit()
  void persistAndSync([mutationOperation(`session:${session.id}`, 'session-upsert', sessionPayload(session))])
  return session
}

export async function updateSession(id: string, patch: Partial<Pick<Session, 'date' | 'amount' | 'cost' | 'notes'>>) {
  const session = state.sessions.find(candidate => candidate.id === id)
  if (!session) throw new Error('That charge no longer exists.')
  const next = { ...session, ...patch }
  const validationError = validateSessionInput(next)
  if (validationError) throw new Error(validationError)
  state = { ...state, sessions: state.sessions.map(candidate => (candidate.id === id ? next : candidate)) }
  emit()
  await persistAndSync([mutationOperation(`session:${id}`, 'session-upsert', sessionPayload(next))])
}

export async function deleteSession(id: string): Promise<Session | null> {
  const removed = state.sessions.find(session => session.id === id) ?? null
  if (!removed) return null
  state = { ...state, sessions: state.sessions.filter(session => session.id !== id) }
  emit()
  await persistAndSync([mutationOperation(`session:${id}`, 'session-delete', { id })])
  return removed
}

export function undoDeleteSession(session: Session) {
  return addSession({ date: session.date, type: session.type, amount: session.amount, cost: session.cost, notes: session.notes })
}

export function addProvider(name: string, freeKwhPerDay: number, color = nextPaletteColor(state.providers)): Provider {
  const validationError = validateProviderInput(name, freeKwhPerDay, color)
  if (validationError) throw new Error(validationError)
  if (state.providers.some(provider => provider.name.toLowerCase() === name.trim().toLowerCase())) {
    throw new Error('A provider with that name already exists.')
  }
  const provider: Provider = {
    id: uuid(),
    name: name.trim(),
    color,
    freeKwhPerDay,
    archived: false,
    sortOrder: Math.max(-1, ...state.providers.map(item => item.sortOrder ?? -1)) + 1,
  }
  state = { ...state, providers: finalizeProviders([...state.providers, provider]) }
  emit()
  void persistAndSync([mutationOperation(`provider:${provider.id}`, 'provider-upsert', providerPayload(provider))])
  return provider
}

export function updateProvider(id: string, patch: Partial<Omit<Provider, 'id'>>) {
  const current = state.providers.find(provider => provider.id === id)
  if (!current) throw new Error('That provider no longer exists.')
  const next = { ...current, ...patch, name: patch.name?.trim() ?? current.name }
  const validationError = validateProviderInput(next.name, next.freeKwhPerDay, next.color)
  if (validationError) throw new Error(validationError)
  if (state.providers.some(provider => provider.id !== id && provider.name.toLowerCase() === next.name.toLowerCase())) {
    throw new Error('A provider with that name already exists.')
  }
  state = {
    ...state,
    providers: finalizeProviders(state.providers.map(provider => (provider.id === id ? next : provider))),
    sessions: state.sessions.map(session => (session.providerId === id ? { ...session, type: next.name } : session)),
  }
  emit()
  void persistAndSync([mutationOperation(`provider:${id}`, 'provider-upsert', providerPayload(next))])
}

export function setProviderArchived(id: string, archived: boolean) {
  updateProvider(id, { archived })
}

export function setProviderOrder(order: string[]) {
  const rank = new Map(order.map((id, index) => [id, index]))
  const providers = state.providers.map((provider, index) => ({
    ...provider,
    sortOrder: rank.get(provider.id) ?? order.length + index,
  }))
  state = { ...state, providers: finalizeProviders(providers) }
  emit()
  void persistAndSync(
    providers.map(provider => mutationOperation(`provider:${provider.id}`, 'provider-upsert', providerPayload(provider))),
  )
}

export function updateAppSettings(patch: Partial<Omit<AppSettings, 'vehicle'>> & { vehicle?: Partial<VehicleAssumptions> }) {
  const settings: AppSettings = {
    ...state.settings,
    ...patch,
    vehicle: { ...state.settings.vehicle, ...patch.vehicle },
  }
  state = { ...state, settings, budgetCap: settings.budgetCap }
  localStorage.setItem(LS_THEME, settings.theme)
  localStorage.setItem(LS_STYLE, settings.style)
  localStorage.setItem(LS_DENSITY, settings.density)
  emit()
  void persistAndSync([mutationOperation('settings', 'settings-update', settingsPayload(settings))])
}

export const setBudgetCap = (budgetCap: number) => updateAppSettings({ budgetCap })
export const setVehicleAssumptions = (vehicle: Partial<VehicleAssumptions>) => updateAppSettings({ vehicle })

export function uploadVehiclePhoto(dataUrl: string) {
  if (!ownerId) throw new Error('Sign in before uploading a vehicle photo.')
  if (!dataUrl.startsWith('data:image/') || dataUrl.length > 7_000_000) throw new Error('Photo must be an image under 5 MB.')
  const path = `${ownerId}/vehicle.jpg`
  const settings = { ...state.settings, vehiclePhotoPath: path }
  state = { ...state, settings, vehiclePhoto: dataUrl }
  emit()
  void persistAndSync([
    mutationOperation('photo', 'photo-upsert', { path, dataUrl }),
    mutationOperation('settings', 'settings-update', settingsPayload(settings), new Date(Date.now() + 1).toISOString()),
  ])
}

export function removeVehiclePhoto() {
  const path = state.settings.vehiclePhotoPath
  const settings = { ...state.settings, vehiclePhotoPath: null }
  state = { ...state, settings, vehiclePhoto: null }
  emit()
  const operations = [mutationOperation('settings', 'settings-update', settingsPayload(settings))]
  if (path) operations.push(mutationOperation('photo', 'photo-delete', { path }, new Date(Date.now() + 1).toISOString()))
  void persistAndSync(operations)
}

/* ================= Backup & restore ================= */

export async function buildBackup(): Promise<Backup> {
  let vehiclePhotoDataUrl = state.vehiclePhoto?.startsWith('data:image/') ? state.vehiclePhoto : null
  if (!vehiclePhotoDataUrl && state.settings.vehiclePhotoPath && state.synced) {
    vehiclePhotoDataUrl = await downloadVehiclePhoto(state.settings.vehiclePhotoPath).catch(() => null)
  }
  return {
    version: 2,
    exportedAt: now(),
    settings: state.settings,
    providers: state.providers,
    sessions: state.sessions,
    vehiclePhotoDataUrl,
  }
}

export function markBackedUp() {
  localStorage.setItem(LS_LAST_BACKUP, JSON.stringify(now()))
}

export const lastBackupAt = () => readLS<string | null>(LS_LAST_BACKUP, null)

export function previewRestore(backup: Backup) {
  const { newProviders, newSessions } = backupDelta(backup, state.providers, state.sessions)
  return {
    providersNew: newProviders.length,
    sessionsNew: newSessions.length,
    totalSessions: backup.sessions.length,
    totalProviders: backup.providers.length,
  }
}

/** Merge-only restore: adds missing ledger rows, then restores settings and photo. */
export async function restoreMerge(backup: Backup): Promise<{ providersAdded: number; sessionsAdded: number }> {
  const { newProviders, newSessions } = backupDelta(backup, state.providers, state.sessions)
  const providerByName = new Map(state.providers.map(provider => [provider.name.toLowerCase(), provider]))
  for (const item of newProviders) {
    const added = addProvider(item.name, item.freeKwhPerDay, item.color)
    providerByName.set(added.name.toLowerCase(), added)
  }
  for (const item of newSessions) {
    const provider = providerByName.get(item.type.toLowerCase())
    if (!provider) continue
    addSession({ date: item.date, type: provider.name, amount: item.amount, cost: item.cost, notes: item.notes })
  }
  updateAppSettings({
    ...backup.settings,
    vehicle: backup.settings.vehicle,
    vehiclePhotoPath: backup.vehiclePhotoDataUrl ? backup.settings.vehiclePhotoPath : state.settings.vehiclePhotoPath,
  })
  if (backup.vehiclePhotoDataUrl) uploadVehiclePhoto(backup.vehiclePhotoDataUrl)
  await commitCachedState(cachedSnapshot())
  void synchronize()
  return { providersAdded: newProviders.length, sessionsAdded: newSessions.length }
}
