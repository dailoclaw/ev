import type { OutboxOperation } from './cache'

// Prerequisites are sent before their dependants, regardless of clock precision.
const priority: Record<OutboxOperation['action'], number> = {
  'provider-upsert': 0,
  'photo-upsert': 0,
  'session-upsert': 1,
  'session-delete': 1,
  'settings-update': 1,
  'photo-delete': 2,
}

export function orderOutboxOperations(operations: OutboxOperation[]): OutboxOperation[] {
  return [...operations].sort((a, b) => priority[a.action] - priority[b.action] || a.updatedAt.localeCompare(b.updatedAt))
}

export function outboxPrerequisiteIds(operation: OutboxOperation): string[] {
  switch (operation.action) {
    case 'session-upsert':
      return typeof operation.payload.provider_id === 'string'
        ? [`${operation.ownerId}:provider:${operation.payload.provider_id}`] : []
    case 'settings-update':
      return typeof operation.payload.vehicle_photo_path === 'string' ? [`${operation.ownerId}:photo`] : []
    case 'photo-delete':
      return [`${operation.ownerId}:settings`]
    default:
      return []
  }
}

/** Check the currently durable prerequisites, not the batch read before upload. */
export function isOutboxOperationReady(operation: OutboxOperation, prerequisites: (OutboxOperation | undefined)[]): boolean {
  for (const prerequisite of prerequisites) {
    if (!prerequisite || prerequisite.ownerId !== operation.ownerId) continue
    if (operation.action === 'session-upsert' && prerequisite.action === 'provider-upsert') return false
    if (operation.action === 'settings-update') {
      if (prerequisite.action === 'photo-upsert' && prerequisite.payload.path === operation.payload.vehicle_photo_path) return false
      if (prerequisite.action === 'photo-delete' && prerequisite.payload.path === operation.payload.vehicle_photo_path) {
        throw new Error('Queued settings reference a photo queued for removal. Update the vehicle photo before retrying sync.')
      }
    }
    if (operation.action === 'photo-delete' && prerequisite.action === 'settings-update') {
      if (prerequisite.payload.vehicle_photo_path === operation.payload.path) {
        throw new Error('Queued settings still reference the photo queued for removal. Remove or replace the vehicle photo before retrying sync.')
      }
      return false
    }
  }
  return true
}
