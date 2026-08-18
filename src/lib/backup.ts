import { DEFAULT_SETTINGS, type AppSettings, type VehicleAssumptions } from './appModel'
import type { Provider } from './providers'
import type { Session } from './savings'
import { isBackupProvider, isBackupSession } from './validation'

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

function isSettings(value: unknown): value is AppSettings {
  if (!value || typeof value !== 'object') return false
  const settings = value as Partial<AppSettings>
  const vehicle = settings.vehicle as Partial<VehicleAssumptions> | undefined
  return (
    typeof settings.budgetCap === 'number' &&
    Number.isFinite(settings.budgetCap) &&
    settings.budgetCap >= 0 &&
    settings.budgetCap <= 100_000 &&
    (settings.theme === 'light' || settings.theme === 'dark') &&
    (settings.style === 'classic' || settings.style === 'minimal') &&
    (settings.density === 'comfortable' || settings.density === 'compact' || settings.density === 'presentation') &&
    Boolean(vehicle) &&
    typeof vehicle!.efficiency === 'number' &&
    vehicle!.efficiency >= 1 &&
    vehicle!.efficiency <= 100 &&
    typeof vehicle!.petrolPrice === 'number' &&
    vehicle!.petrolPrice >= 0 &&
    vehicle!.petrolPrice <= 20 &&
    typeof vehicle!.petrolUse === 'number' &&
    vehicle!.petrolUse >= 0 &&
    vehicle!.petrolUse <= 100 &&
    (settings.vehiclePhotoPath === null || typeof settings.vehiclePhotoPath === 'string')
  )
}

export function parseBackup(text: string): Backup | null {
  if (text.length > 15_000_000) return null
  try {
    const value = JSON.parse(text) as Partial<Backup> | Partial<LegacyBackup>
    if (!value || typeof value !== 'object') return null
    if (!Array.isArray(value.providers) || value.providers.length > 10_000 || !value.providers.every(isBackupProvider)) return null
    if (!Array.isArray(value.sessions) || value.sessions.length > 100_000 || !value.sessions.every(isBackupSession)) return null
    const providerNames = new Set(value.providers.map(provider => provider.name.toLowerCase()))
    if (value.sessions.some(session => !providerNames.has(session.type.toLowerCase()))) return null
    if (value.version === 1) {
      const legacy = value as Partial<LegacyBackup>
      if (typeof legacy.budgetCap !== 'number' || !Number.isFinite(legacy.budgetCap)) return null
      return {
        version: 2,
        exportedAt: typeof legacy.exportedAt === 'string' ? legacy.exportedAt : now(),
        settings: { ...DEFAULT_SETTINGS, budgetCap: legacy.budgetCap },
        providers: legacy.providers!,
        sessions: legacy.sessions!,
        vehiclePhotoDataUrl: null,
      }
    }
    const current = value as Partial<Backup>
    if (current.version !== 2 || !isSettings(current.settings)) return null
    if (
      current.vehiclePhotoDataUrl !== null &&
      (typeof current.vehiclePhotoDataUrl !== 'string' ||
        !current.vehiclePhotoDataUrl.startsWith('data:image/') ||
        current.vehiclePhotoDataUrl.length > 7_000_000)
    ) return null
    return current as Backup
  } catch {
    return null
  }
}

export const sessionSignature = (session: Session) =>
  `${session.date}|${session.type.toLowerCase()}|${session.amount}|${session.cost}|${session.notes ?? ''}`

export function backupDelta(backup: Backup, providers: Provider[], sessions: Session[]) {
  const existingProviderNames = new Set(providers.map(provider => provider.name.toLowerCase()))
  const newProviders = backup.providers.filter(provider => !existingProviderNames.has(provider.name.toLowerCase()))
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
