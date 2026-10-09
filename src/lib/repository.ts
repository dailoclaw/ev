import { syncInputError } from './syncFailure'
import type { OutboxOperation } from './cache'
import { supa, type DbProvider, type DbSession, type DbSettings } from './supa'

const PAGE_SIZE = 500
const PHOTO_BUCKET = 'vehicle-photos'

export interface RemoteSnapshot {
  providers: DbProvider[]
  sessions: DbSession[]
  settings: DbSettings
  vehiclePhotoDataUrl: string | null
}

const requireClient = () => {
  if (!supa) throw new Error('Supabase is not configured')
  return supa
}

async function fetchProviders(assertCurrent: () => void): Promise<DbProvider[]> {
  const client = requireClient()
  const rows: DbProvider[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    assertCurrent()
    const { data, error } = await client
      .from('providers')
      .select('id,name,color,free_kwh_per_day,archived,sort_order')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    assertCurrent()
    if (error) throw error
    const page = (data ?? []) as DbProvider[]
    rows.push(...page)
    if (page.length < PAGE_SIZE) return rows
  }
}

async function fetchSessions(assertCurrent: () => void): Promise<DbSession[]> {
  const client = requireClient()
  const rows: DbSession[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    assertCurrent()
    const { data, error } = await client
      .from('charging_sessions')
      .select('id,provider_id,date,amount,cost,notes,created_at')
      .order('date', { ascending: true })
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    assertCurrent()
    if (error) throw error
    const page = (data ?? []) as DbSession[]
    rows.push(...page)
    if (page.length < PAGE_SIZE) return rows
  }
}

export async function downloadVehiclePhoto(path: string, assertCurrent: () => void): Promise<string> {
  assertCurrent()
  const { data, error } = await requireClient().storage.from(PHOTO_BUCKET).download(path)
  assertCurrent()
  if (error) throw error
  const dataUrl = await blobToDataUrl(data)
  assertCurrent()
  return dataUrl
}

export async function fetchRemoteSnapshot(ownerId: string, assertCurrent: () => void): Promise<RemoteSnapshot> {
  assertCurrent()
  const client = requireClient()
  const [providers, sessions, settingsResult] = await Promise.all([
    fetchProviders(assertCurrent),
    fetchSessions(assertCurrent),
    client.from('app_settings').select('*').eq('id', 1).eq('owner_id', ownerId).maybeSingle(),
  ])
  assertCurrent()
  if (settingsResult.error) throw settingsResult.error
  if (!settingsResult.data) {
    throw new Error('This account is signed in but is not configured as the EV Command owner.')
  }
  const settings = settingsResult.data as DbSettings
  if (settings.owner_id !== ownerId) throw new Error('The returned settings belong to a different account.')
  let vehiclePhotoDataUrl: string | null = null
  if (settings.vehicle_photo_path) {
    try {
      vehiclePhotoDataUrl = await downloadVehiclePhoto(settings.vehicle_photo_path, assertCurrent)
    } catch (error) {
      assertCurrent()
      console.warn('Vehicle photo could not be cached for offline use', error)
    }
  }
  return { providers, sessions, settings, vehiclePhotoDataUrl }
}

function dataUrlToBlob(dataUrl: string): Blob {
  const match = /^data:([^;,]+);base64,(.+)$/.exec(dataUrl)
  if (!match) throw syncInputError('Vehicle photo is not a supported data URL')
  let decoded: string
  try { decoded = atob(match[2]) } catch { throw syncInputError('Vehicle photo contains invalid base64 data') }
  const bytes = Uint8Array.from(decoded, char => char.charCodeAt(0))
  return new Blob([bytes], { type: match[1] })
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Could not read vehicle photo'))
    reader.readAsDataURL(blob)
  })
}

/** Apply one idempotent outbox operation. Callers remove it only after success. */
export async function applyOutboxOperation(operation: OutboxOperation, ownerId: string, assertCurrent: () => void): Promise<void> {
  assertCurrent()
  if (operation.ownerId !== ownerId) throw new Error('The queued change belongs to a different account.')
  const client = requireClient()
  let error: { message: string } | null = null
  let status: number | undefined

  switch (operation.action) {
    case 'session-upsert':
      ;({ error, status } = await client.from('charging_sessions').upsert(operation.payload, { onConflict: 'id' }))
      break
    case 'session-delete':
      ;({ error, status } = await client.from('charging_sessions').delete().eq('id', operation.payload.id))
      break
    case 'provider-upsert':
      ;({ error, status } = await client.from('providers').upsert(operation.payload, { onConflict: 'id' }))
      break
    case 'settings-update': {
      const result = await client.from('app_settings').update(operation.payload).eq('id', 1).eq('owner_id', ownerId).select('id,owner_id').maybeSingle()
      error = result.error
      status = result.status
      if (!error && (!result.data || result.data.id !== 1 || result.data.owner_id !== ownerId)) {
        error = Object.assign(new Error('Settings were not updated for this owner. Check owner permissions before retrying.'), { code: '42501' })
      }
      break
    }
    case 'photo-upsert': {
      const blob = dataUrlToBlob(operation.payload.dataUrl)
      const upload = await client.storage
        .from(PHOTO_BUCKET)
        .upload(operation.payload.path, blob, {
          upsert: true,
          contentType: blob.type,
          cacheControl: '3600',
        })
      error = upload.error
      break
    }
    case 'photo-delete': {
      const removed = await client.storage.from(PHOTO_BUCKET).remove([operation.payload.path])
      error = removed.error
      break
    }
  }

  assertCurrent()
  if (error) throw Object.assign(new Error(error.message), error, status === undefined ? {} : { status })
}
