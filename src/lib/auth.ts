export const MIN_OWNER_PASSWORD_LENGTH = 12

export function validateOwnerPassword(password: string, confirmation: string): string | null {
  if (password.length < MIN_OWNER_PASSWORD_LENGTH) {
    return `Use at least ${MIN_OWNER_PASSWORD_LENGTH} characters.`
  }
  if (password !== confirmation) return 'The passwords do not match.'
  return null
}
