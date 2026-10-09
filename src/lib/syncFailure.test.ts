import { expect, it } from 'vitest'
import { classifySyncFailure } from './syncFailure'
it.each([
  ['23514', 'invalid'], ['23502', 'invalid'], ['22003', 'invalid'], ['INVALID_INPUT', 'invalid'],
  ['23505', 'conflict'], ['23503', 'conflict'], ['QUEUE_CONFLICT', 'conflict'],
  ['42501', 'authorization'], ['PGRST301', 'authorization'], ['PGRST302', 'authorization'], ['PGRST303', 'authorization'],
  ['PGRST000', 'transient'], ['PGRST300', 'transient'], ['40001', 'transient'], ['unknown', 'transient'],
])('classifies %s as %s', (code, kind) => expect(classifySyncFailure({ code, message: 'Rejected' })).toEqual({ kind, code, message: 'Rejected' }))
it.each([[401, 'authorization'], [403, 'authorization'], [409, 'conflict'], [400, 'invalid'], [413, 'invalid'], [422, 'invalid'], [429, 'transient'], [500, 'transient'], [503, 'transient']])('classifies storage status %s as %s', (statusCode, kind) => expect(classifySyncFailure({ statusCode: String(statusCode) }).kind).toBe(kind))
it('keeps unknown and network failures retryable without parsing message text', () => {
  expect(classifySyncFailure(new TypeError('Failed to fetch')).kind).toBe('transient')
  expect(classifySyncFailure({ message: 'conflict' }).kind).toBe('transient')
  expect(classifySyncFailure(null).kind).toBe('transient')
})
