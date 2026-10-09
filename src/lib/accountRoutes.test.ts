import { expect, it } from 'vitest'
import { matchRoutes } from 'react-router-dom'
import { legacyAccountName, providerAccountPath } from './accountRoutes'

it.each(['50% Charger', 'Literal %20', '東京 ⚡', 'AC/DC', 'Literal %2F'])('uses stable identity links for %s', name => {
  const provider = { id: '11111111-1111-4111-8111-111111111111', name, color: '#123456', freeKwhPerDay: 0 }
  expect(providerAccountPath(name, [provider])).toBe(`/accounts/id/${provider.id}`)
})
it.each(['50% Charger', 'Literal %20', '東京 ⚡', 'AC/DC'])('keeps old name URLs decoded exactly once for %s', name => {
  const path = providerAccountPath(name, [])
  expect(matchRoutes([{ path: '/accounts/:name' }], path)?.[0].params.name).toBe(name)
})

it('preserves a literal encoded slash in legacy URLs without selecting a different slash name', () => {
  const name = 'Literal %2F'
  const path = providerAccountPath(name, [])
  const params = matchRoutes([{ path: '/accounts/:name' }], path)![0].params
  expect(params.name).toBe('Literal /')
  expect(legacyAccountName(params.name!, path)).toBe(name)
  expect(legacyAccountName('Literal /', '/accounts/Literal%20%252F%broken')).toBe('Literal /')
})
