import type { AppSettings } from './appModel'
import type { Provider } from './providers'
import type { Session } from './savings'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const HEX_COLOR = /^#[0-9a-f]{6}([0-9a-f]{2})?$/i
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const VEHICLE_LIMITS = {
  efficiency: { min: 1, max: 100 },
  petrolPrice: { min: 0, max: 20 },
  petrolUse: { min: 0, max: 100 },
} as const
export const INPUT_LIMITS = { budget: 100_000, allowance: 500, energy: 10_000, cost: 100_000, notes: 1000, providerOrder: 10_000 } as const

// Decimal exponent shifting avoids binary rounding errors such as 1.005 -> 1.00.
export function roundDecimal(value: number, places: number): number {
  const [coefficient, exponent = '0'] = String(value).split('e')
  return Number(`${Math.round(Number(`${coefficient}e${Number(exponent) + places}`))}e-${places}`)
}

export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return year > 0 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1]
}

export function validateSettings(value: unknown): string | null {
  if (!value || typeof value !== 'object') return 'Settings must be an object.'
  const settings = value as Partial<AppSettings>
  if (!finiteInRange(settings.budgetCap, 0, INPUT_LIMITS.budget)) return 'Budget must be between $0 and $100,000.'
  if (settings.theme !== 'light' && settings.theme !== 'dark') return 'Choose a valid theme.'
  if (settings.style !== 'classic' && settings.style !== 'minimal') return 'Choose a valid style.'
  if (!['comfortable', 'compact', 'presentation'].includes(settings.density ?? '')) return 'Choose a valid density.'
  if (!settings.vehicle || typeof settings.vehicle !== 'object') return 'Vehicle assumptions are required.'
  for (const key of Object.keys(VEHICLE_LIMITS) as (keyof typeof VEHICLE_LIMITS)[]) {
    const { min, max } = VEHICLE_LIMITS[key]
    if (!finiteInRange(settings.vehicle[key], min, max)) return `${key} must be between ${min} and ${max}.`
  }
  if (settings.vehiclePhotoPath !== null && typeof settings.vehiclePhotoPath !== 'string') return 'Photo path must be text or empty.'
  return null
}

export function normalizeSettings(settings: AppSettings): AppSettings {
  const error = validateSettings(settings)
  if (error) throw new Error(error)
  return { ...settings, budgetCap: roundDecimal(settings.budgetCap, 2), vehicle: {
    efficiency: roundDecimal(settings.vehicle.efficiency, 2),
    petrolPrice: roundDecimal(settings.vehicle.petrolPrice, 3),
    petrolUse: roundDecimal(settings.vehicle.petrolUse, 2),
  } }
}

export function normalizeProvider<T extends Pick<Provider, 'name' | 'freeKwhPerDay' | 'color'> & Partial<Provider>>(provider: T): T {
  const error = validateProviderInput(provider.name, provider.freeKwhPerDay, provider.color)
  if (error) throw new Error(error)
  if (provider.archived !== undefined && typeof provider.archived !== 'boolean') throw new Error('Archived must be a boolean.')
  if (provider.sortOrder !== undefined && (!finiteInRange(provider.sortOrder, 0, INPUT_LIMITS.providerOrder) || !Number.isInteger(provider.sortOrder))) throw new Error('Provider order must be an integer between 0 and 10,000.')
  return { ...provider, name: provider.name.trim(), freeKwhPerDay: roundDecimal(provider.freeKwhPerDay, 2) }
}

export function normalizeSession<T extends Pick<Session, 'date' | 'type' | 'amount' | 'cost' | 'notes'>>(session: T): T {
  const error = validateSessionInput(session)
  if (error) throw new Error(error)
  const createdAt = (session as T & { createdAt?: unknown }).createdAt
  if (createdAt !== undefined && !isSessionCreatedAt(createdAt)) throw new Error('Charge creation timestamp must be valid.')
  return { ...session, type: session.type.trim(), amount: roundDecimal(session.amount, 3), cost: roundDecimal(session.cost, 2) }
}

const finiteInRange = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max

export function validateProviderInput(name: string, freeKwhPerDay: number, color: string): string | null {
  if (typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 80) return 'Provider name must be between 1 and 80 characters.'
  if (!finiteInRange(freeKwhPerDay, 0, INPUT_LIMITS.allowance)) return 'Daily allowance must be between 0 and 500 kWh.'
  if (typeof color !== 'string' || !HEX_COLOR.test(color)) return 'Provider colour must be a hexadecimal colour.'
  return null
}

export function validateSessionInput(session: Pick<Session, 'date' | 'type' | 'amount' | 'cost' | 'notes'>): string | null {
  if (!isCalendarDate(session.date)) return 'Date must be valid.'
  if (session.date < '2000-01-01') return 'Date must be 2000 or later.'
  const tomorrow = new Date()
  // Use a consistent UTC boundary; verify the database timezone when deploying.
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  if (session.date > tomorrow.toISOString().slice(0, 10)) return 'Date cannot be more than one day in the future.'
  if (typeof session.type !== 'string' || session.type.trim().length < 1 || session.type.trim().length > 80) return 'Provider is required.'
  if (!finiteInRange(session.amount, 0, INPUT_LIMITS.energy)) return 'Energy must be between 0 and 10,000 kWh.'
  if (!finiteInRange(session.cost, 0, INPUT_LIMITS.cost)) return 'Cost must be between $0 and $100,000.'
  if (roundDecimal(session.amount, 3) === 0 && roundDecimal(session.cost, 2) === 0) return 'A row must contain at least 0.001 kWh or $0.01 after rounding.'
  if (session.notes != null && (typeof session.notes !== 'string' || session.notes.length > INPUT_LIMITS.notes)) return 'Notes cannot exceed 1,000 characters.'
  return null
}

export function isBackupProvider(value: unknown): value is Provider {
  if (!value || typeof value !== 'object') return false
  const provider = value as Partial<Provider>
  return (
    typeof provider.id === 'string' &&
    provider.id.length > 0 &&
    provider.id.length <= 100 &&
    typeof provider.name === 'string' &&
    typeof provider.color === 'string' &&
    typeof provider.freeKwhPerDay === 'number' &&
    validateProviderInput(provider.name, provider.freeKwhPerDay, provider.color) === null &&
    (provider.archived === undefined || typeof provider.archived === 'boolean') &&
    (provider.sortOrder === undefined || (finiteInRange(provider.sortOrder, 0, INPUT_LIMITS.providerOrder) && Number.isInteger(provider.sortOrder)))
  )
}

export function isSessionCreatedAt(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false
  const time = Date.parse(value)
  return Number.isFinite(time) && new Date(time).toISOString() === value
}

export function isBackupSession(value: unknown): value is Session {
  if (!value || typeof value !== 'object') return false
  const session = value as Partial<Session>
  return (
    typeof session.id === 'string' &&
    session.id.length > 0 &&
    session.id.length <= 100 &&
    (session.providerId === undefined || (typeof session.providerId === 'string' && session.providerId.length <= 100)) &&
    (session.createdAt === undefined || isSessionCreatedAt(session.createdAt)) &&
    typeof session.date === 'string' &&
    typeof session.type === 'string' &&
    typeof session.amount === 'number' &&
    typeof session.cost === 'number' &&
    (session.notes === null || typeof session.notes === 'string') &&
    validateSessionInput(session as Session) === null
  )
}

export const isUuid = (value: string) => UUID.test(value)
