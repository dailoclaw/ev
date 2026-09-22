import type { SyncStatus } from './appModel'

export type StatusMarkState = 'pending' | 'running' | 'done' | 'failed'

export function syncMarkState(status: SyncStatus): StatusMarkState {
  switch (status) {
    case 'synced': return 'done'
    case 'syncing':
    case 'loading': return 'running'
    case 'error': return 'failed'
    default: return 'pending'
  }
}

export function syncLabel(status: SyncStatus): string {
  switch (status) {
    case 'synced': return 'Synced'
    case 'syncing': return 'Syncing'
    case 'loading': return 'Loading'
    case 'offline': return 'Offline · waiting to sync'
    case 'error': return 'Sync failed'
    default: return 'Not connected'
  }
}
