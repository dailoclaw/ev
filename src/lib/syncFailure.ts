export type SyncFailureKind = 'invalid' | 'authorization' | 'conflict' | 'transient'
export interface SyncFailure { kind: SyncFailureKind; message: string; code?: string }

/** Unknown failures remain retryable; only recognized rejections are held for review. */
export function classifySyncFailure(error: unknown): SyncFailure {
  const value = error && typeof error === 'object' ? error as { message?: unknown; code?: unknown; status?: unknown; statusCode?: unknown } : {}
  const code = typeof value.code === 'string' ? value.code : undefined
  const status = Number(value.status ?? value.statusCode ?? (/^PT\d{3}$/.test(code ?? '') ? code!.slice(2) : NaN))
  const message = typeof value.message === 'string' ? value.message : 'Cloud synchronization failed. Please retry.'
  let kind: SyncFailureKind = 'transient'
  if (code === '42501' || code?.startsWith('28') || ['PGRST301', 'PGRST302', 'PGRST303', 'AccessDenied', 'InvalidJWT'].includes(code ?? '') || status === 401 || status === 403) kind = 'authorization'
  else if (['23503', '23505', 'QUEUE_CONFLICT', 'KeyAlreadyExists', 'ResourceAlreadyExists'].includes(code ?? '') || status === 409) kind = 'conflict'
  else if (code?.startsWith('22') || ['23502', '23514', 'INVALID_INPUT', 'PGRST102', 'InvalidMimeType', 'InvalidUpload', 'EntityTooLarge'].includes(code ?? '') || [400, 413, 415, 422].includes(status)) kind = 'invalid'
  return { kind, message, ...(code ? { code } : {}) }
}

export function syncInputError(message: string): Error & { code: string } {
  return Object.assign(new Error(message), { code: 'INVALID_INPUT' })
}
