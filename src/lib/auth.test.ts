import { describe, expect, it } from 'vitest'
import { validateOwnerPassword } from './auth'

describe('validateOwnerPassword', () => {
  it('rejects short passwords', () => {
    expect(validateOwnerPassword('short', 'short')).toBe('Use at least 12 characters.')
  })

  it('rejects mismatched confirmation', () => {
    expect(validateOwnerPassword('correct horse battery', 'correct horse staple')).toBe('The passwords do not match.')
  })

  it('accepts a matching password of at least 12 characters', () => {
    expect(validateOwnerPassword('correct horse battery', 'correct horse battery')).toBeNull()
  })
})
