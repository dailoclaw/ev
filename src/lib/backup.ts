import { DEFAULT_SETTINGS, type AppSettings } from './appModel'
import type { Provider } from './providers'
import type { Session } from './savings'
import { isBackupProvider, isBackupSession, validateSettings, normalizeSettings, normalizeProvider, normalizeSession } from './validation'

export interface Backup {
  version: 2
  exportedAt: string
  settings: AppSettings
  providers: Provider[]
  sessions: Session[]
  vehiclePhotoDataUrl: string | null
}

interface LegacyBackup {
  version: 1
  exportedAt?: string
  budgetCap: number
  providers: Provider[]
  sessions: Session[]
}

const now = () => new Date().toISOString()

export function normalizeBackupValues(backup: Backup): Backup {
  return { ...backup, settings: normalizeSettings(backup.settings), providers: backup.providers.map(normalizeProvider), sessions: backup.sessions.map(normalizeSession) }
}

export function parseBackup(text: string): Backup | null {
  if (text.length > 15_000_000) return null
  try {
    const value = JSON.parse(text) as Partial<Backup> | Partial<LegacyBackup>
    if (!value || typeof value !== 'object') return null
    if (!Array.isArray(value.providers) || value.providers.length > 10_000 || !value.providers.every(isBackupProvider)) return null
    if (!Array.isArray(value.sessions) || value.sessions.length > 100_000 || !value.sessions.every(isBackupSession)) return null
    const providerNames = new Set(value.providers.map(provider => provider.name.trim().toLowerCase()))
    if (value.sessions.some(session => !providerNames.has(session.type.trim().toLowerCase()))) return null
    if (value.version === 1) {
      const legacy = value as Partial<LegacyBackup>
      const settings = { ...DEFAULT_SETTINGS, budgetCap: legacy.budgetCap! }
      if (validateSettings(settings)) return null
      return {
        version: 2,
        exportedAt: typeof legacy.exportedAt === 'string' ? legacy.exportedAt : now(),
        settings: normalizeSettings(settings),
        providers: legacy.providers!.map(normalizeProvider),
        sessions: legacy.sessions!.map(normalizeSession),
        vehiclePhotoDataUrl: null,
      }
    }
    const current = value as Partial<Backup>
    if (current.version !== 2 || validateSettings(current.settings) !== null) return null
    if (
      current.vehiclePhotoDataUrl !== null &&
      (typeof current.vehiclePhotoDataUrl !== 'string' ||
        !current.vehiclePhotoDataUrl.startsWith('data:image/') ||
        current.vehiclePhotoDataUrl.length > 7_000_000)
    ) return null
    return { ...current, settings: normalizeSettings(current.settings!), providers: current.providers!.map(normalizeProvider), sessions: current.sessions!.map(normalizeSession) } as Backup
  } catch {
    return null
  }
}

export const sessionSignature = (session: Session) =>
  `${session.date}|${session.type.trim().toLowerCase()}|${session.amount}|${session.cost}|${session.notes ?? ''}`

export function backupDelta(backup: Backup, providers: Provider[], sessions: Session[]) {
  const existingProviderNames = new Set(providers.map(provider => provider.name.trim().toLowerCase()))
  const newProviders = backup.providers.filter(provider => !existingProviderNames.has(provider.name.trim().toLowerCase()))
  const existingSignatures = new Set(sessions.map(sessionSignature))
  const seen = new Set<string>()
  const newSessions = backup.sessions.filter(session => {
    const signature = sessionSignature(session)
    if (existingSignatures.has(signature) || seen.has(signature)) return false
    seen.add(signature)
    return true
  })
  return { newProviders, newSessions }
}
