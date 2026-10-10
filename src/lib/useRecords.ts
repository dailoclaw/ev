import { useMemo } from 'react'
import { thisMonth } from './format'
import { records, type RecordsInput } from './records'

/** Sync status and appearance do not change records; the calendar boundary does. */
export function useRecords({ sessions, providers, months, lifetime, budgetCap }: RecordsInput) {
  const month = thisMonth()
  return useMemo(() => records({ sessions, providers, months, lifetime, budgetCap }, month),
    [sessions, providers, months, lifetime, budgetCap, month])
}
