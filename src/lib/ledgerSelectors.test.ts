import { expect, it } from 'vitest'
import { selectLedger } from './ledgerSelectors'
import type { Session } from './savings'
import type { Provider } from './providers'

const providers: Provider[] = [{ id: 'p', name: 'Free', color: '#059669', freeKwhPerDay: 7 }]
const sessions: Session[] = [
  { id: 'b', type: 'Free', date: '2026-01-01', createdAt: '2026-01-01T02:00:00Z', amount: 5, cost: 2, notes: null },
  { id: 'a', type: 'Free', date: '2026-01-01', createdAt: '2026-01-01T01:00:00Z', amount: 5, cost: 0, notes: null },
]

it('shares calculated references across consumers and metadata-only updates without changing input order', () => {
  const first = selectLedger(sessions, providers)
  for (let i = 0; i < 20; i++) expect(selectLedger(sessions, providers)).toBe(first)
  expect(first.sessions.map(s => [s.id, s.freeKwh])).toEqual([['a', 5], ['b', 2]])
  expect(first.sessionsDesc.map(s => s.id)).toEqual(['b', 'a'])
  expect(sessions.map(s => s.id)).toEqual(['b', 'a'])
})

it('invalidates on a new session array and on a new provider array', () => {
  const first = selectLedger(sessions, providers)
  const edited = selectLedger(sessions.map(s => s.id === 'b' ? { ...s, cost: 8 } : s), providers)
  expect(edited).not.toBe(first)
  expect(edited.lifetime.cost).toBe(8)
  const changed = selectLedger(sessions, providers.map(p => ({ ...p, freeKwhPerDay: 2 })))
  expect(changed).not.toBe(first)
  expect(changed.lifetime.freeKwh).toBe(2)
  // A second owner/input pair must not contaminate the first cached pair.
  expect(selectLedger(sessions, providers)).toBe(first)
})
