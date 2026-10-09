import { readBackupFile } from './readBackupFile'
import { useSyncExternalStore } from 'react'
import { DEFAULT_SETTINGS, type AppSettings, type SyncStatus, type VehicleAssumptions } from './appModel'
import {
  commitCachedState,
  listOutbox,
  readOutboxOperations,
  loadCachedSnapshot,
  acknowledgeOutboxOperation,
  setOutboxRejection,
  discardOutboxToRemote,
  listRecoveryArchives,
  countRecoveryArchives,
  type OutboxOperation,
  type CachedSnapshot,
  type OutboxMutation,
} from './cache'
import { verifyBackupPhoto } from './backupPhoto'
import { classifySyncFailure } from './syncFailure'
import { isOutboxOperationReady, orderOutboxOperations, outboxPrerequisiteIds } from './outboxPlan'
import { nextPaletteColor, type Provider } from './providers'
import { applyOutboxOperation, downloadVehiclePhoto, fetchRemoteSnapshot } from './repository'
import { LEGACY_SESSION_CREATED_AT, type Session } from './savings'
import { supa, type DbProvider, type DbSession, type DbSettings } from './supa'
import { validateProviderInput, validateSessionInput, normalizeSettings, normalizeProvider, normalizeSession } from './validation'
import { planRestore, assertBackupSize, normalizeBackupValues, sessionSignature, type Backup } from './backup'

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
  lastSaveError: string | null
  lastSyncError: string | null
  rejectedWrites: OutboxOperation[]
  recoveryArchiveCount: number
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
  lastSaveError: null,
  rejectedWrites: [],
  recoveryArchiveCount: 0,
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

const readStorage = (key: string): string | null => {
  try { return localStorage.getItem(key) } catch { return null }
}
const migratedOwners = new Set<string>()

const readLS = <T,>(key: string, fallback: T): T => {
  try {
    const value = readStorage(key)
    return value ? (JSON.parse(value) as T) : fallback
  } catch {
    return fallback
  }
}

const finalizeProviders = (providers: Provider[]): Provider[] =>
  [...providers].sort(
    (a, b) =>
      (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER) ||
      Number(b.freeKwhPerDay > 0) - Number(a.freeKwhPerDay > 0) ||
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
  ...(session.created_at ? { createdAt: new Date(session.created_at).toISOString() } : {}),
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
  created_at: session.createdAt ?? LEGACY_SESSION_CREATED_AT,
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

const cachedSnapshot = (value = state): CachedSnapshot => ({
  ownerId: ownerId ?? '',
  sessions: value.sessions,
  providers: value.providers,
  settings: value.settings,
  vehiclePhotoDataUrl: value.vehiclePhoto?.startsWith('data:') ? value.vehiclePhoto : null,
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
interface DataSession {
  ownerId: string
  epoch: number
  ready: boolean
  recovering: boolean
  syncPromise: Promise<void> | null
  syncRequested: boolean
  writeTail: Promise<void>
}
let sessionEpoch = 0
let activeSession: DataSession | null = null
const isCurrentSession = (session: DataSession) => activeSession === session && session.epoch === sessionEpoch
function assertCurrentSession(session: DataSession) {
  if (!isCurrentSession(session)) throw new Error('The account session changed. Please try again.')
}
function requireSession(): DataSession {
  if (!activeSession) throw new Error('Sign in before changing the ledger.')
  return activeSession
}
let reloadTimer: ReturnType<typeof setTimeout> | undefined
let realtimeChannel: ReturnType<NonNullable<typeof supa>['channel']> | null = null
let lifecycleBound = false

function mutationOperation(
  id: string,
  action: OutboxMutation['action'],
  payload: Record<string, unknown>,
): OutboxMutation {
  if (!ownerId) throw new Error('Sign in before changing the ledger.')
  return { id: `${ownerId}:${id}`, ownerId, updatedAt: now(), action, payload } as OutboxMutation
}

function withLocalWrite<T>(session: DataSession, work: () => Promise<T>): Promise<T> {
  const result = session.writeTail.then(() => {
    assertCurrentSession(session)
    return work()
  })
  session.writeTail = result.then(() => undefined, () => undefined)
  return result
}

function mirrorSettings(settings: AppSettings) {
  try {
    localStorage.setItem(LS_THEME, settings.theme)
    localStorage.setItem(LS_STYLE, settings.style)
    localStorage.setItem(LS_DENSITY, settings.density)
  } catch { /* Optional startup preferences cannot block a durable ledger save. */ }
}

async function saveLocal<T>(build: () => { next: EvState; operations: OutboxMutation[]; result: T }): Promise<T> {
  const session = requireSession()
  let commitAttempted = false
  return withLocalWrite(session, async () => {
    const { next, operations, result } = build()
    commitAttempted = true
    await commitCachedState(cachedSnapshot(next), operations)
    const pending = await listOutbox(session.ownerId).catch(() => null)
    const pendingCount = pending?.length ?? Math.max(state.pendingCount, operations.length)
    assertCurrentSession(session)
    state = {
      ...state, pendingCount, rejectedWrites: pending?.filter(item => item.rejection) ?? state.rejectedWrites, sessions: next.sessions, providers: next.providers, settings: next.settings,
      budgetCap: next.settings.budgetCap, vehiclePhoto: next.vehiclePhoto,
      synced: false, syncStatus: isOnline() ? 'syncing' : 'offline', lastSaveError: null,
    }
    mirrorSettings(next.settings)
    emit()
    // Queue diagnostics/cloud synchronization cannot turn a committed save into a failure.
    void synchronize()
    return result
  }).catch(error => {
    if (!isCurrentSession(session)) throw error
    const detail = error instanceof Error ? error.message : 'Storage is unavailable.'
    const message = commitAttempted
      ? `Not saved on this device. ${detail} Retry the action after checking browser storage.`
      : `Not saved. ${detail}`
    state = { ...state, lastSaveError: message }
    emit()
    throw new Error(message)
  })
}

export function dismissSaveError() {
  state = { ...state, lastSaveError: null }
  emit()
}

async function flushOutbox(session: DataSession) {
  const operations = await listOutbox(session.ownerId)
  assertCurrentSession(session)
  for (const operation of orderOutboxOperations(operations)) {
    assertCurrentSession(session)
    const [current, ...prerequisites] = await readOutboxOperations([operation.id, ...outboxPrerequisiteIds(operation)])
    assertCurrentSession(session)
    // Rejected revisions wait for an explicit retry or a correcting mutation.
    if (current?.revision !== operation.revision || current.rejection) continue
    try {
      if (!isOutboxOperationReady(current, prerequisites)) continue
      await applyOutboxOperation(operation, session.ownerId, () => assertCurrentSession(session))
      assertCurrentSession(session)
      await acknowledgeOutboxOperation(operation)
      assertCurrentSession(session)
    } catch (error) {
      assertCurrentSession(session)
      const failure = classifySyncFailure(error)
      if (failure.kind === 'transient') throw error
      const retained = await setOutboxRejection(operation, { ...failure, failedAt: now() })
      assertCurrentSession(session)
      if (retained && failure.kind === 'authorization') break
    }
  }
}

function remoteState(remote: Awaited<ReturnType<typeof fetchRemoteSnapshot>>): EvState {
  const providers = remote.providers.map(mapProvider)
  const providersById = new Map(providers.map(provider => [provider.id, provider.name]))
  const settings = mapSettings(remote.settings)
  return {
    ...state, providers: finalizeProviders(providers),
    sessions: remote.sessions.map(session => mapSession(session, providersById)),
    settings, budgetCap: settings.budgetCap, vehiclePhoto: remote.vehiclePhotoDataUrl,
    loading: false, lastSyncError: null, rejectedWrites: [],
  }
}

function adoptRemote(session: DataSession, remote: Awaited<ReturnType<typeof fetchRemoteSnapshot>>, synced: boolean) {
  return withLocalWrite(session, async () => {
    const pending = await listOutbox(session.ownerId)
    assertCurrentSession(session)
    if (pending.length > 0) return false
    const next = { ...remoteState(remote), pendingCount: 0, synced, syncStatus: synced ? 'synced' as const : 'syncing' as const }
    await commitCachedState(cachedSnapshot(next))
    assertCurrentSession(session)
    state = {
      ...next, lastSaveError: state.lastSaveError, synced: synced && isOnline(),
      syncStatus: isOnline() ? (synced ? 'synced' : 'syncing') : 'offline',
    }
    emit()
    return true
  })
}

async function migrateLegacyState(session: DataSession) {
  return withLocalWrite(session, async () => {
    assertCurrentSession(session)
    const currentOwnerId = session.ownerId
    if (migratedOwners.has(currentOwnerId) || readStorage(LS_MIGRATED) === 'done') return

    const operations: OutboxMutation[] = []
    const legacyProviders = readLS<Provider[]>(LS_PROVIDERS, [])
    const archivedIds = new Set(readLS<string[]>(LS_ARCHIVED, []))
    const orderedIds = readLS<string[]>(LS_PROVIDER_ORDER, [])
    const legacyNameById = new Map(legacyProviders.map(provider => [provider.id, provider.name]))
    const archivedNames = new Set([...archivedIds].map(id => legacyNameById.get(id)).filter(Boolean))
    const orderedNames = orderedIds.map(id => legacyNameById.get(id)).filter((name): name is string => Boolean(name))

    let providers = [...state.providers]
    for (const legacy of legacyProviders) {
      if (providers.some(provider => provider.name.toLowerCase() === legacy.name.toLowerCase())) continue
      const provider: Provider = normalizeProvider({
        ...legacy,
        id: uuid(),
        archived: archivedIds.has(legacy.id) || Boolean(legacy.archived),
        sortOrder: providers.length,
      })
      providers.push(provider)
      operations.push(mutationOperation(`provider:${provider.id}`, 'provider-upsert', providerPayload(provider)))
    }

    providers = providers.map((provider, index) => {
      const orderedIndex = orderedNames.findIndex(name => name.toLowerCase() === provider.name.toLowerCase())
      const next = normalizeProvider({
        ...provider,
        archived: Boolean(provider.archived || archivedIds.has(provider.id) || archivedNames.has(provider.name)),
        sortOrder: orderedIndex >= 0 ? orderedIndex : orderedNames.length + index,
      })
      if (next.archived !== provider.archived || next.sortOrder !== provider.sortOrder) {
        operations.push(mutationOperation(`provider:${next.id}`, 'provider-upsert', providerPayload(next)))
      }
      return next
    })

    const signatures = new Set(state.sessions.map(item => sessionSignature(item)))
    const sessions = [...state.sessions]
    for (const legacy of readLS<Session[]>(LS_SESSIONS, [])) {
      if (signatures.has(sessionSignature(legacy))) continue
      const provider = providers.find(candidate => candidate.name.toLowerCase() === legacy.type.toLowerCase())
      if (!provider) continue
      const session: Session = normalizeSession({ ...legacy, id: uuid(), providerId: provider.id })
      signatures.add(sessionSignature(session))
      sessions.push(session)
      operations.push(mutationOperation(`session:${session.id}`, 'session-upsert', sessionPayload(session)))
    }

    const legacyVehicle = readLS<Partial<VehicleAssumptions>>(LS_VEHICLE, {})
    const settings: AppSettings = normalizeSettings({
      ...state.settings,
      budgetCap: readLS<number>(LS_BUDGET, state.settings.budgetCap),
      theme: readStorage(LS_THEME) === 'dark' ? 'dark' : state.settings.theme,
      style: readStorage(LS_STYLE) === 'minimal' ? 'minimal' : state.settings.style,
      density: ['compact', 'presentation', 'comfortable'].includes(readStorage(LS_DENSITY) ?? '')
        ? (readStorage(LS_DENSITY) as AppSettings['density'])
        : state.settings.density,
      vehicle: { ...state.settings.vehicle, ...legacyVehicle },
    })
    const legacyPhoto = readStorage(LS_PHOTO)
    if (legacyPhoto?.startsWith('data:image/')) settings.vehiclePhotoPath = `${currentOwnerId}/vehicle.jpg`

    const next = {
      ...state,
      providers: finalizeProviders(providers),
      sessions,
      settings,
      budgetCap: settings.budgetCap,
      vehiclePhoto: legacyPhoto?.startsWith('data:image/') ? legacyPhoto : state.vehiclePhoto,
    }
    if (legacyPhoto?.startsWith('data:image/')) {
      operations.push(
        mutationOperation('photo', 'photo-upsert', { path: settings.vehiclePhotoPath!, dataUrl: legacyPhoto }),
      )
    }
    operations.push(mutationOperation('settings', 'settings-update', settingsPayload(settings)))

    await commitCachedState(cachedSnapshot(next), operations)
    assertCurrentSession(session)
    state = {
      ...state, providers: next.providers, sessions: next.sessions, settings: next.settings,
      budgetCap: next.budgetCap, vehiclePhoto: next.vehiclePhoto,
    }
    emit()
    migratedOwners.add(currentOwnerId)
    try {
      localStorage.setItem(LS_MIGRATED, 'done')
      ;[LS_SESSIONS, LS_PROVIDERS, LS_BUDGET, LS_ARCHIVED, LS_PROVIDER_ORDER, LS_VEHICLE, LS_PHOTO].forEach(key =>
        localStorage.removeItem(key),
      )
    } catch { /* Migration is durable even if its optional legacy marker is blocked. */ }
  })
}

async function runSynchronization(session: DataSession) {
  if (!isCurrentSession(session) || !supa) return
  if (!isOnline()) {
    state = { ...state, loading: false, synced: false, syncStatus: 'offline' }
    emit()
    return
  }

  state = { ...state, syncStatus: 'syncing', synced: false, lastSyncError: null }
  emit()
  try {
    await flushOutbox(session)
    assertCurrentSession(session)
    const initialRemote = await fetchRemoteSnapshot(session.ownerId, () => assertCurrentSession(session))
    assertCurrentSession(session)
    const initialPending = await listOutbox(session.ownerId)
    assertCurrentSession(session)
    if (initialPending.some(operation => operation.rejection)) throw new Error(`${initialPending.find(operation => operation.rejection)?.rejection?.message} Queued changes need attention. Review them in Settings before retrying.`)
    if (initialPending.length > 0) {
      session.syncRequested = true
      return
    }
    if (!(await adoptRemote(session, initialRemote, false))) {
      session.syncRequested = true
      return
    }
    assertCurrentSession(session)
    await migrateLegacyState(session)
    assertCurrentSession(session)
    await flushOutbox(session)
    assertCurrentSession(session)
    const migrationPending = await listOutbox(session.ownerId)
    assertCurrentSession(session)
    if (migrationPending.some(operation => operation.rejection)) throw new Error(`${migrationPending.find(operation => operation.rejection)?.rejection?.message} Queued changes need attention. Review them in Settings before retrying.`)
    if (migrationPending.length > 0) {
      session.syncRequested = true
      return
    }
    const canonicalRemote = await fetchRemoteSnapshot(session.ownerId, () => assertCurrentSession(session))
    assertCurrentSession(session)
    const canonicalPending = await listOutbox(session.ownerId)
    assertCurrentSession(session)
    if (canonicalPending.length > 0) {
      session.syncRequested = true
      return
    }
    if (!(await adoptRemote(session, canonicalRemote, true))) session.syncRequested = true
  } catch (error) {
    if (!isCurrentSession(session)) return
    const message = classifySyncFailure(error).message
    const pending = await listOutbox(session.ownerId).catch(() => [])
    const pendingCount = pending.length
    if (!isCurrentSession(session)) return
    state = {
      ...state,
      pendingCount,
      rejectedWrites: pending.filter(operation => operation.rejection),
      synced: false,
      loading: false,
      syncStatus: isOnline() ? 'error' : 'offline',
      lastSyncError: message,
    }
    emit()
  }
}

export function synchronize(): Promise<void> {
  const session = activeSession
  if (!session?.ready || session.recovering) return Promise.resolve()
  if (session.syncPromise) {
    session.syncRequested = true
    return session.syncPromise
  }
  session.syncRequested = false
  session.syncPromise = runSynchronization(session).finally(() => {
    session.syncPromise = null
    if (isCurrentSession(session) && session.syncRequested) void synchronize()
  })
  return session.syncPromise
}

function reloadSoon() {
  const session = activeSession
  if (!session) return
  clearTimeout(reloadTimer)
  reloadTimer = setTimeout(() => {
    if (isCurrentSession(session)) void synchronize()
  }, 250)
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
    if (!activeSession) return
    state = { ...state, synced: false, syncStatus: 'offline' }
    emit()
  })
}

export async function initializeData(currentOwnerId: string) {
  if (activeSession?.ownerId === currentOwnerId) return synchronize()
  stopDataSync()
  const session: DataSession = {
    ownerId: currentOwnerId, epoch: sessionEpoch, ready: false, recovering: false, syncPromise: null, syncRequested: false, writeTail: Promise.resolve(),
  }
  activeSession = session
  ownerId = currentOwnerId
  state = { ...state, loading: true, syncStatus: 'loading', lastSyncError: null }
  emit()

  const cached = await loadCachedSnapshot().catch(() => null)
  if (!isCurrentSession(session)) return
  if (cached?.ownerId === currentOwnerId) applyCachedSnapshot(cached)
  if (!isCurrentSession(session)) return
  const pending = await listOutbox(currentOwnerId).catch(() => [])
  const pendingCount = pending.length
  const recoveryArchiveCount = await countRecoveryArchives(currentOwnerId).catch(() => 0)
  if (!isCurrentSession(session)) return
  state = { ...state, pendingCount, rejectedWrites: pending.filter(operation => operation.rejection), recoveryArchiveCount }
  emit()
  if (!isCurrentSession(session)) return

  bindLifecycle()
  const reloadCurrentSession = () => { if (isCurrentSession(session)) reloadSoon() }
  realtimeChannel =
    supa
      ?.channel('ev-owner-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'charging_sessions' }, reloadCurrentSession)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'providers' }, reloadCurrentSession)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, reloadCurrentSession)
      .subscribe() ?? null
  session.ready = true
  await synchronize()
}

export function stopDataSync() {
  sessionEpoch += 1
  activeSession = null
  ownerId = null
  clearTimeout(reloadTimer)
  reloadTimer = undefined
  if (realtimeChannel && supa) void supa.removeChannel(realtimeChannel)
  realtimeChannel = null
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
    lastSaveError: null,
    rejectedWrites: [],
    recoveryArchiveCount: 0,
  }
  emit()
}

export async function retrySync() {
  const session = activeSession
  if (!session) return
  try {
    if (session.recovering) throw new Error('Recovery is already in progress.')
    await session.syncPromise
    assertCurrentSession(session)
    for (const operation of await listOutbox(session.ownerId)) {
      assertCurrentSession(session)
      if (operation.rejection) await setOutboxRejection(operation)
    }
    assertCurrentSession(session)
    const pending = await listOutbox(session.ownerId)
    assertCurrentSession(session)
    state = { ...state, rejectedWrites: pending.filter(operation => operation.rejection), pendingCount: pending.length }
    emit()
    await synchronize()
  } catch (error) {
    if (!isCurrentSession(session)) return
    state = { ...state, lastSyncError: classifySyncFailure(error).message, syncStatus: 'error' }
    emit()
  }
}

export async function exportSyncRecovery() {
  const session = requireSession()
  const [operations, archives] = await Promise.all([listOutbox(session.ownerId), listRecoveryArchives(session.ownerId)])
  assertCurrentSession(session)
  return { version: 1, ownerId: session.ownerId, exportedAt: now(), pending: operations, archives }
}

/** Explicitly discard ALL pending changes; preserve them in a durable recovery archive. */
export async function discardPendingChanges() {
  const session = requireSession()
  if (!isOnline()) throw new Error('Go online to restore the cloud version before discarding pending changes.')
  if (session.recovering) throw new Error('Recovery is already in progress.')
  session.recovering = true
  try {
    const intended = await listOutbox(session.ownerId)
    assertCurrentSession(session)
    const revisions = new Map(intended.map(operation => [operation.id, operation.revision]))
    await session.syncPromise
    assertCurrentSession(session)
    await withLocalWrite(session, async () => {
      const pending = await listOutbox(session.ownerId)
      assertCurrentSession(session)
      if (!pending.length) throw new Error('There are no pending changes to discard.')
      if (pending.some(operation => revisions.get(operation.id) !== operation.revision)) throw new Error('Pending changes changed during recovery. Review them and try again.')
      const remote = await fetchRemoteSnapshot(session.ownerId, () => assertCurrentSession(session))
      assertCurrentSession(session)
      const next = remoteState(remote)
      await discardOutboxToRemote(cachedSnapshot(next), pending, () => assertCurrentSession(session))
      assertCurrentSession(session)
      state = { ...next, pendingCount: 0, rejectedWrites: [], recoveryArchiveCount: state.recoveryArchiveCount + 1, synced: isOnline(), syncStatus: isOnline() ? 'synced' : 'offline', lastSaveError: null }
      mirrorSettings(state.settings)
      emit()
    })
  } finally {
    session.recovering = false
    if (isCurrentSession(session)) void synchronize()
  }
}

/* ================= Mutations ================= */

type NewProviderInput = { name: string; freeKwhPerDay: number; color: string }
function createProvider(input: NewProviderInput, providers = state.providers): Provider {
  const validationError = validateProviderInput(input.name, input.freeKwhPerDay, input.color)
  if (validationError) throw new Error(validationError)
  if (providers.some(provider => provider.name.toLowerCase() === input.name.trim().toLowerCase())) throw new Error('A provider with that name already exists.')
  return normalizeProvider({ ...input, name: input.name.trim(), id: uuid(), archived: false, sortOrder: Math.max(-1, ...providers.map(item => item.sortOrder ?? -1)) + 1 })
}

export function addSession(input: Omit<Session, 'id' | 'providerId' | 'createdAt'>, newProvider?: NewProviderInput): Promise<Session> {
  return saveLocal(() => {
    const validationError = validateSessionInput(input)
    if (validationError) throw new Error(validationError)
    const provider = newProvider ? createProvider(newProvider) : state.providers.find(candidate => candidate.name === input.type)
    if (!provider) throw new Error('Choose a valid provider before saving.')
    const previousCreated = state.sessions.reduce((latest, charge) =>
      charge.date === input.date && charge.providerId === provider.id
        ? Math.max(latest, Date.parse(charge.createdAt ?? LEGACY_SESSION_CREATED_AT) || 0) : latest, 0)
    const createdAt = new Date(Math.max(Date.now(), previousCreated + 1)).toISOString()
    const session: Session = normalizeSession({ ...input, type: provider.name, id: uuid(), providerId: provider.id, createdAt })
    const operations = [mutationOperation(`session:${session.id}`, 'session-upsert', sessionPayload(session))]
    if (newProvider) operations.push(mutationOperation(`provider:${provider.id}`, 'provider-upsert', providerPayload(provider)))
    return { next: { ...state, sessions: [...state.sessions, session], providers: newProvider ? finalizeProviders([...state.providers, provider]) : state.providers }, operations, result: session }
  })
}

export function updateSession(id: string, patch: Partial<Pick<Session, 'date' | 'amount' | 'cost' | 'notes'>>) {
  return saveLocal(() => {
    const session = state.sessions.find(candidate => candidate.id === id)
    if (!session) throw new Error('That charge no longer exists.')
    const next = normalizeSession({ ...session, ...patch })
    return { next: { ...state, sessions: state.sessions.map(candidate => candidate.id === id ? next : candidate) }, operations: [mutationOperation(`session:${id}`, 'session-upsert', sessionPayload(next))], result: undefined }
  })
}

export function deleteSession(id: string): Promise<Session | null> {
  return saveLocal(() => {
    const removed = state.sessions.find(session => session.id === id) ?? null
    return { next: { ...state, sessions: state.sessions.filter(session => session.id !== id) }, operations: removed ? [mutationOperation(`session:${id}`, 'session-delete', { id })] : [], result: removed }
  })
}

export function undoDeleteSession(session: Session) {
  return saveLocal(() => {
    const existing = state.sessions.find(candidate => candidate.id === session.id)
    if (existing) return { next: state, operations: [], result: existing }
    const provider = session.providerId === undefined
      ? state.providers.find(candidate => candidate.name === session.type)
      : state.providers.find(candidate => candidate.id === session.providerId)
    if (!provider) throw new Error('The charger for this charge no longer exists.')
    const restored = normalizeSession({ ...session, providerId: provider.id, type: provider.name })
    return { next: { ...state, sessions: [...state.sessions, restored] }, operations: [mutationOperation(`session:${restored.id}`, 'session-upsert', sessionPayload(restored))], result: restored }
  })
}

export function addProvider(name: string, freeKwhPerDay: number, color = nextPaletteColor(state.providers)): Promise<Provider> {
  return saveLocal(() => {
    const provider = createProvider({ name, freeKwhPerDay, color })
    return { next: { ...state, providers: finalizeProviders([...state.providers, provider]) }, operations: [mutationOperation(`provider:${provider.id}`, 'provider-upsert', providerPayload(provider))], result: provider }
  })
}

export function updateProvider(id: string, patch: Partial<Omit<Provider, 'id'>>) {
  return saveLocal(() => {
    const current = state.providers.find(provider => provider.id === id)
    if (!current) throw new Error('That provider no longer exists.')
    const next = normalizeProvider({ ...current, ...patch, name: patch.name ?? current.name })
    if (state.providers.some(provider => provider.id !== id && provider.name.toLowerCase() === next.name.toLowerCase())) throw new Error('A provider with that name already exists.')
    return { next: { ...state, providers: finalizeProviders(state.providers.map(provider => provider.id === id ? next : provider)), sessions: state.sessions.map(session => session.providerId === id ? { ...session, type: next.name } : session) }, operations: [mutationOperation(`provider:${id}`, 'provider-upsert', providerPayload(next))], result: undefined }
  })
}

export const setProviderArchived = (id: string, archived: boolean) => updateProvider(id, { archived })
export function setProviderOrder(order: string[]) {
  return saveLocal(() => {
    const rank = new Map(order.map((id, index) => [id, index]))
    const providers = state.providers.map((provider, index) => normalizeProvider({ ...provider, sortOrder: rank.get(provider.id) ?? order.length + index }))
    return { next: { ...state, providers: finalizeProviders(providers) }, operations: providers.map(provider => mutationOperation(`provider:${provider.id}`, 'provider-upsert', providerPayload(provider))), result: undefined }
  })
}

export function updateAppSettings(patch: Partial<Omit<AppSettings, 'vehicle'>> & { vehicle?: Partial<VehicleAssumptions> }) {
  return saveLocal(() => {
    const settings = normalizeSettings({ ...state.settings, ...patch, vehicle: { ...state.settings.vehicle, ...patch.vehicle } })
    return { next: { ...state, settings }, operations: [mutationOperation('settings', 'settings-update', settingsPayload(settings))], result: undefined }
  })
}
export const setBudgetCap = (budgetCap: number) => updateAppSettings({ budgetCap })
export const setVehicleAssumptions = (vehicle: Partial<VehicleAssumptions>) => updateAppSettings({ vehicle })

export async function uploadVehiclePhoto(dataUrl: string) {
  const session = requireSession()
  await verifyBackupPhoto(dataUrl)
  assertCurrentSession(session)
  return saveLocal(() => {
    const path = `${ownerId}/vehicle.jpg`
    const settings = normalizeSettings({ ...state.settings, vehiclePhotoPath: path })
    return { next: { ...state, settings, vehiclePhoto: dataUrl }, operations: [mutationOperation('photo', 'photo-upsert', { path, dataUrl }), mutationOperation('settings', 'settings-update', settingsPayload(settings))], result: undefined }
  })
}
export function removeVehiclePhoto() {
  return saveLocal(() => {
    const path = state.settings.vehiclePhotoPath
    const settings = normalizeSettings({ ...state.settings, vehiclePhotoPath: null })
    const operations = [mutationOperation('settings', 'settings-update', settingsPayload(settings))]
    if (path) operations.push(mutationOperation('photo', 'photo-delete', { path }))
    return { next: { ...state, settings, vehiclePhoto: null }, operations, result: undefined }
  })
}

/* ================= Backup & restore ================= */

export async function buildBackup(): Promise<Backup> {
  const session = requireSession()
  const snapshot = state
  let vehiclePhotoDataUrl = snapshot.vehiclePhoto?.startsWith('data:image/') ? snapshot.vehiclePhoto : null
  if (!vehiclePhotoDataUrl && snapshot.settings.vehiclePhotoPath) {
    if (!isOnline()) throw new Error('Backup is incomplete: the vehicle photo is not cached. Go online and retry.')
    vehiclePhotoDataUrl = await downloadVehiclePhoto(snapshot.settings.vehiclePhotoPath, () => assertCurrentSession(session))
  }
  assertCurrentSession(session)
  await verifyBackupPhoto(vehiclePhotoDataUrl)
  assertCurrentSession(session)
  const backup = normalizeBackupValues({
    version: 2, exportedAt: now(), settings: snapshot.settings,
    providers: snapshot.providers, sessions: snapshot.sessions, vehiclePhotoDataUrl,
  })
  assertBackupSize(backup)
  return backup
}

export function markBackedUp() {
  try { localStorage.setItem(LS_LAST_BACKUP, JSON.stringify(now())) } catch { /* The downloaded backup is already complete. */ }
}

export const lastBackupAt = () => readLS<string | null>(LS_LAST_BACKUP, null)

export async function readRestoreFile(file: File, onProgress?: (message: string) => void) {
  const session = requireSession()
  const backup = await readBackupFile(file, onProgress)
  assertCurrentSession(session)
  return { backup, ...previewRestore(backup) }
}

export function previewRestore(backup: Backup) {
  const session = requireSession()
  const prepared = normalizeBackupValues(backup)
  const plan = planRestore(prepared, state.providers, state.sessions)
  const photo = prepared.sourceVersion === 1 ? state.vehiclePhoto : prepared.vehiclePhotoDataUrl
  const settings = prepared.sourceVersion === 1
    ? { ...state.settings, budgetCap: prepared.settings.budgetCap }
    : { ...prepared.settings, vehiclePhotoPath: photo ? `${session.ownerId}/vehicle.jpg` : null }
  assertBackupSize({ ...prepared, providers: [...state.providers, ...plan.newProviders], sessions: [...state.sessions, ...plan.newSessions], settings, vehiclePhotoDataUrl: photo })
  return {
    ownerId: session.ownerId,
    providersNew: plan.newProviders.length,
    sessionsNew: plan.newSessions.length,
    providersMatched: plan.providersMatched,
    sessionsMatched: plan.sessionsMatched,
    sessionsConflicting: plan.sessionsConflicting,
    photoAction: prepared.sourceVersion === 1 ? 'keep' as const : prepared.vehiclePhotoDataUrl ? 'replace' as const : 'remove' as const,
    settingsAction: prepared.sourceVersion === 1 ? 'budget' as const : 'all' as const,
    totalSessions: prepared.sessions.length,
    totalProviders: prepared.providers.length,
  }
}

/** Add missing rows without replacing existing identities; commit the full plan atomically. */
export async function restoreMerge(backup: Backup, expectedOwnerId?: string) {
  const session = requireSession()
  if (expectedOwnerId !== undefined && expectedOwnerId !== session.ownerId) throw new Error('The account changed since this backup preview. Select the file again.')
  const prepared = normalizeBackupValues(backup)
  await verifyBackupPhoto(prepared.vehiclePhotoDataUrl)
  assertCurrentSession(session)
  return saveLocal(() => {
    const plan = planRestore(prepared, state.providers, state.sessions)
    const providers = [...state.providers, ...plan.newProviders]
    const sessions = [...state.sessions, ...plan.newSessions]
    const operations: OutboxMutation[] = []
    for (const provider of plan.newProviders) operations.push(mutationOperation(`provider:${provider.id}`, 'provider-upsert', providerPayload(provider)))
    for (const charge of plan.newSessions) operations.push(mutationOperation(`session:${charge.id}`, 'session-upsert', sessionPayload(charge)))
    const photoAction = prepared.sourceVersion === 1 ? 'keep' : prepared.vehiclePhotoDataUrl ? 'replace' : 'remove'
    const path = photoAction === 'keep' ? state.settings.vehiclePhotoPath : photoAction === 'replace' ? `${ownerId}/vehicle.jpg` : null
    const settings = normalizeSettings({ ...(prepared.sourceVersion === 1 ? { ...state.settings, budgetCap: prepared.settings.budgetCap } : prepared.settings), vehiclePhotoPath: path })
    assertBackupSize({ version: 2, exportedAt: now(), settings, providers, sessions, vehiclePhotoDataUrl: photoAction === 'keep' ? state.vehiclePhoto : prepared.vehiclePhotoDataUrl })
    if (photoAction === 'replace') operations.push(mutationOperation('photo', 'photo-upsert', { path: path!, dataUrl: prepared.vehiclePhotoDataUrl! }))
    if (photoAction === 'remove' && state.settings.vehiclePhotoPath) operations.push(mutationOperation('photo', 'photo-delete', { path: state.settings.vehiclePhotoPath }))
    operations.push(mutationOperation('settings', 'settings-update', settingsPayload(settings)))
    return { next: { ...state, providers: finalizeProviders(providers), sessions, settings, vehiclePhoto: photoAction === 'keep' ? state.vehiclePhoto : prepared.vehiclePhotoDataUrl }, operations,
      result: { providersAdded: plan.newProviders.length, sessionsAdded: plan.newSessions.length, providersMatched: plan.providersMatched, sessionsMatched: plan.sessionsMatched, sessionsConflicting: plan.sessionsConflicting, photoAction, settingsAction: prepared.sourceVersion === 1 ? 'budget' : 'all' } }
  })
}
