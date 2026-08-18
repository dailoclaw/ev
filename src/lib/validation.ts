import type { Provider } from './providers'
import type { Session } from './savings'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const HEX_COLOR = /^#[0-9a-f]{6}([0-9a-f]{2})?$/i
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const finiteInRange = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max

export function validateProviderInput(name: string, freeKwhPerDay: number, color: string): string | null {
  if (name.trim().length < 1 || name.trim().length > 80) return 'Provider name must be between 1 and 80 characters.'
  if (!finiteInRange(freeKwhPerDay, 0, 500)) return 'Daily allowance must be between 0 and 500 kWh.'
  if (!HEX_COLOR.test(color)) return 'Provider colour must be a hexadecimal colour.'
  return null
}

export function validateSessionInput(session: Pick<Session, 'date' | 'type' | 'amount' | 'cost' | 'notes'>): string | null {
  if (!ISO_DATE.test(session.date) || Number.isNaN(Date.parse(`${session.date}T00:00:00Z`))) return 'Date must be valid.'
  if (session.date < '2000-01-01') return 'Date must be 2000 or later.'
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (session.date > tomorrow.toISOString().slice(0, 10)) return 'Date cannot be more than one day in the future.'
  if (session.type.trim().length < 1 || session.type.trim().length > 80) return 'Provider is required.'
  if (!finiteInRange(session.amount, 0, 10_000)) return 'Energy must be between 0 and 10,000 kWh.'
  if (!finiteInRange(session.cost, 0, 100_000)) return 'Cost must be between $0 and $100,000.'
  if (session.amount === 0 && session.cost === 0) return 'A row must contain energy or cost.'
  if (session.notes != null && session.notes.length > 1000) return 'Notes cannot exceed 1,000 characters.'
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
    (provider.sortOrder === undefined || finiteInRange(provider.sortOrder, 0, 10_000))
  )
}

export function isBackupSession(value: unknown): value is Session {
  if (!value || typeof value !== 'object') return false
  const session = value as Partial<Session>
  return (
    typeof session.id === 'string' &&
    session.id.length > 0 &&
    session.id.length <= 100 &&
    (session.providerId === undefined || (typeof session.providerId === 'string' && session.providerId.length <= 100)) &&
    typeof session.date === 'string' &&
    typeof session.type === 'string' &&
    typeof session.amount === 'number' &&
    typeof session.cost === 'number' &&
    (session.notes === null || typeof session.notes === 'string') &&
    validateSessionInput(session as Session) === null
  )
}

export const isUuid = (value: string) => UUID.test(value)
