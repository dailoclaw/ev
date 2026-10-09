import { DEFAULT_SETTINGS, type AppSettings } from './appModel'
import type { Provider } from './providers'
import type { Session } from './savings'
import { isBackupProvider, isBackupSession, isUuid, validateSettings, normalizeSettings, normalizeProvider, normalizeSession, roundDecimal } from './validation'
import { validateBackupPhoto } from './backupPhoto'

export const BACKUP_LIMITS = { bytes: 15_000_000, providers: 10_000, sessions: 25_000 } as const
export interface Backup {
  version: 2
  exportedAt: string
  settings: AppSettings
  providers: Provider[]
  sessions: Session[]
  vehiclePhotoDataUrl: string | null
  /** Internal provenance: v1 imports restore budget only and preserve the current photo. */
  sourceVersion?: 1 | 2
}
const key = (name: string) => name.trim().toLowerCase()
const canonicalId = (id: string) => isUuid(id) ? id.toLowerCase() : id
const now = () => new Date().toISOString()

function prepareBackup(value: unknown, allowProvenance: boolean): Backup {
  if (!value || typeof value !== 'object') throw new Error('Expected an EV Command backup object.')
  const raw = value as Record<string, unknown>
  if (raw.version !== 1 && raw.version !== 2) throw new Error('Unsupported backup version.')
  if (!Array.isArray(raw.providers) || raw.providers.length > BACKUP_LIMITS.providers || !raw.providers.every(isBackupProvider)) throw new Error('Backup contains invalid or too many chargers.')
  const providers = raw.providers.map(item => normalizeProvider({ id: canonicalId(item.id), name: item.name, color: item.color, freeKwhPerDay: item.freeKwhPerDay, ...(item.archived === undefined ? {} : { archived: item.archived }), ...(item.sortOrder === undefined ? {} : { sortOrder: item.sortOrder }) }))
  const byId = new Map<string, Provider>(); const byName = new Map<string, Provider>()
  for (const provider of providers) {
    if (byId.has(provider.id) || byName.has(key(provider.name))) throw new Error('Backup contains duplicate charger IDs or names.')
    byId.set(provider.id, provider); byName.set(key(provider.name), provider)
  }
  if (!Array.isArray(raw.sessions) || raw.sessions.length > BACKUP_LIMITS.sessions || !raw.sessions.every(isBackupSession)) throw new Error('Backup contains invalid or too many charges.')
  const sessions: Session[] = []; const ids = new Set<string>()
  for (const item of raw.sessions as Session[]) {
    if (ids.has(canonicalId(item.id))) throw new Error('Backup contains duplicate charge IDs.')
    ids.add(canonicalId(item.id))
    const provider = item.providerId === undefined ? byName.get(key(item.type)) : byId.get(canonicalId(item.providerId))
    if (!provider || key(provider.name) !== key(item.type)) throw new Error('A backup charge has an invalid charger reference.')
    sessions.push(normalizeSession({ id: canonicalId(item.id), providerId: provider.id, date: item.date, type: provider.name, amount: item.amount, cost: item.cost, notes: item.notes }))
  }
  const sourceVersion = raw.version === 1 || (allowProvenance && raw.sourceVersion === 1) ? 1 : 2
  const settings = raw.version === 1 ? { ...DEFAULT_SETTINGS, budgetCap: raw.budgetCap as number } : raw.settings as AppSettings
  const settingsError = validateSettings(settings)
  if (settingsError) throw new Error(settingsError)
  const vehiclePhotoDataUrl = sourceVersion === 1 ? null : raw.vehiclePhotoDataUrl
  if (vehiclePhotoDataUrl !== null) {
    const photoError = validateBackupPhoto(vehiclePhotoDataUrl)
    if (photoError) throw new Error(photoError)
  } else if (sourceVersion === 2 && settings.vehiclePhotoPath !== null) {
    throw new Error('Backup is incomplete: it references a vehicle photo but does not include it.')
  }
  return { version: 2, exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : now(), sourceVersion, settings: normalizeSettings(settings), providers, sessions, vehiclePhotoDataUrl: vehiclePhotoDataUrl as string | null }
}

export function normalizeBackupValues(backup: Backup): Backup { return prepareBackup(backup, true) }
export function parseBackupOrThrow(text: string): Backup {
  if (text.length > BACKUP_LIMITS.bytes || new TextEncoder().encode(text).byteLength > BACKUP_LIMITS.bytes) throw new Error('Backup must be under 15 MB.')
  let value: unknown
  try { value = JSON.parse(text) } catch { throw new Error('Could not read backup JSON.') }
  return prepareBackup(value, false)
}
export function assertBackupSize(backup: Backup): void {
  const text = JSON.stringify(backup)
  if (text.length > BACKUP_LIMITS.bytes || new TextEncoder().encode(text).byteLength > BACKUP_LIMITS.bytes) throw new Error('Backup or merged ledger exceeds 15 MB. No data was changed.')
}
export function parseBackup(text: string): Backup | null {
  try { return parseBackupOrThrow(text) } catch { return null }
}

export const sessionSignature = (session: Session, providerIdentity = key(session.type)) =>
  JSON.stringify([session.date, providerIdentity, roundDecimal(session.amount, 3), roundDecimal(session.cost, 2), session.notes ?? ''])

/** One linear merge plan shared by preview and durable restore. Existing ledger rows win. */
export function planRestore(backup: Backup, currentProviders: Provider[], currentSessions: Session[], makeId = () => crypto.randomUUID()) {
  const existingById = new Map(currentProviders.map(provider => [provider.id, provider]))
  const existingByName = new Map(currentProviders.map(provider => [key(provider.name), provider]))
  const providersByBackupId = new Map<string, Provider>()
  const providersByBackupName = new Map<string, Provider>()
  const newProviders: Provider[] = []
  const matchedProviderIds = new Set<string>()
  const imported = [...backup.providers].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  let order = currentProviders.reduce((maximum, provider) => Math.max(maximum, provider.sortOrder ?? -1), -1) + 1
  for (const provider of imported) {
    const idMatch = existingById.get(provider.id); const nameMatch = existingByName.get(key(provider.name))
    if (idMatch && nameMatch && idMatch.id !== nameMatch.id) throw new Error('Backup charger identity conflicts with an existing charger.')
    const existing = idMatch ?? nameMatch
    if (existing && matchedProviderIds.has(existing.id)) throw new Error('Multiple backup chargers resolve to the same existing charger.')
    if (existing) matchedProviderIds.add(existing.id)
    const target = existing ?? normalizeProvider({ ...provider, id: isUuid(provider.id) ? provider.id : makeId(), archived: provider.archived ?? false, sortOrder: currentProviders.length ? order++ : provider.sortOrder ?? order++ })
    if (!existing) newProviders.push(target)
    providersByBackupId.set(provider.id, target); providersByBackupName.set(key(provider.name), target)
  }
  if (currentProviders.length + newProviders.length > BACKUP_LIMITS.providers) throw new Error('Merged ledger would exceed the charger limit.')
  const targetProvider = (session: Session) => session.providerId === undefined ? providersByBackupName.get(key(session.type)) : providersByBackupId.get(session.providerId)
  const existingSessions = new Map(currentSessions.map(session => [session.id, session]))
  const idMatches = new Set(backup.sessions.filter(session => existingSessions.has(session.id)).map(session => session.id))
  const signatures = new Map<string, number>()
  for (const session of currentSessions) {
    if (idMatches.has(session.id)) continue
    const identity = session.providerId ?? existingByName.get(key(session.type))?.id ?? key(session.type)
    const signature = sessionSignature(session, identity)
    signatures.set(signature, (signatures.get(signature) ?? 0) + 1)
  }
  const newSessions: Session[] = []; let conflicts = 0; let matched = 0
  for (const session of backup.sessions) {
    const provider = targetProvider(session)
    if (!provider) throw new Error('A restored charge has no matching charger.')
    const current = existingSessions.get(session.id)
    const signature = sessionSignature(session, provider.id)
    if (current) {
      matched++
      if (signature !== sessionSignature(current, current.providerId ?? existingByName.get(key(current.type))?.id)) conflicts++
      continue
    }
    const count = signatures.get(signature) ?? 0
    if (count > 0) { signatures.set(signature, count - 1); matched++; continue }
    newSessions.push({ ...session, type: provider.name, providerId: provider.id, id: isUuid(session.id) ? session.id : makeId() })
  }
  if (currentSessions.length + newSessions.length > BACKUP_LIMITS.sessions) throw new Error('Merged ledger would exceed the charge limit.')
  return { newProviders, newSessions, providersMatched: backup.providers.length - newProviders.length, sessionsMatched: matched, sessionsConflicting: conflicts }
}

export function backupDelta(backup: Backup, providers: Provider[], sessions: Session[]) {
  return planRestore(normalizeBackupValues(backup), providers, sessions)
}
