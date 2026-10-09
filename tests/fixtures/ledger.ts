import type { Page } from '@playwright/test'

// Exercise the real app and offline outbox against an isolated fake owner/backend.
// No production account, credentials or ledger writes are used.
export async function ledger(page: Page, style = 'classic', theme = 'light', used = 3.5, allowance = 7, vehicle = { efficiency: 14.2, petrolPrice: 1.85, petrolUse: 7 }) {
  const owner = '11111111-1111-4111-8111-111111111111'
  const provider = '22222222-2222-4222-8222-222222222222'
  const providerRow = { id: provider, name: 'FreeCo', color: '#059669', free_kwh_per_day: allowance, archived: false, sort_order: 0 }
  let providerRows = [providerRow]
  let photo: Buffer | null = null
  const date = new Date().toLocaleDateString('en-CA')
  let sessions = used > 0 ? [{ id: '33333333-3333-4333-8333-333333333333', provider_id: provider, date, amount: used, cost: 0, notes: null }] : []
  let fail = false
  let rejectedTable: string | undefined
  let rejectionCode = '23514'
  let hold: Promise<void> | undefined
  const settings = { id: 1, owner_id: owner, budget_cap: 50, theme, style, density: 'comfortable',
    vehicle_efficiency: vehicle.efficiency, petrol_price: vehicle.petrolPrice, petrol_use: vehicle.petrolUse, vehicle_photo_path: null, updated_at: new Date().toISOString() }
  await page.addInitScript(({ owner }) => {
    localStorage.setItem('ev.supabaseCanonicalMigrated.v2', 'done')
    localStorage.setItem('sb-example-auth-token', JSON.stringify({ access_token: 'test-access-token', refresh_token: 'test-refresh-token',
      expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer',
      user: { id: owner, aud: 'authenticated', role: 'authenticated', email: 'owner@example.com', app_metadata: {}, user_metadata: {} } }))
  }, { owner })
  await page.route('https://example.supabase.co/**', async route => {
    const request = route.request()
    if (hold && !request.url().includes('/auth/v1/')) await hold
    if (fail) { await route.fulfill({ status: 403, json: { message: 'Test sync rejected' } }); return }
    if (request.url().includes('/storage/v1/')) {
      if (request.method() === 'GET') await route.fulfill({ status: photo ? 200 : 404, body: photo ?? 'Missing photo', contentType: 'image/jpeg' })
      else if (request.method() === 'DELETE') { photo = null; await route.fulfill({ json: [] }) }
      else { photo = request.postDataBuffer(); await route.fulfill({ json: { Key: 'vehicle.jpg' } }) }
      return
    }
    const table = new URL(request.url()).pathname.split('/').pop()
    if (request.method() !== 'GET' && table === rejectedTable) {
      await route.fulfill({ status: rejectionCode === '42501' ? 403 : 400, json: { code: rejectionCode, message: 'Test write rejected' } }); return
    }
    if (request.method() === 'GET') {
      await route.fulfill({ json: table === 'providers'
        ? providerRows
        : table === 'charging_sessions' ? sessions : table === 'app_settings' ? settings : { user: { id: owner } } })
    } else {
      if (table === 'app_settings') Object.assign(settings, request.postDataJSON())
      if (table === 'providers') {
        const input = request.postDataJSON()
        providerRows = [...providerRows.filter(row => row.id !== input.id), { ...providerRows.find(row => row.id === input.id), ...input }]
      }
      if (table === 'charging_sessions') {
        if (request.method() === 'DELETE') {
          const id = new URL(request.url()).searchParams.get('id')?.replace(/^eq\./, '')
          sessions = sessions.filter(row => row.id !== id)
        }
        else {
          const input = request.postDataJSON()
          sessions = [...sessions.filter(s => s.id !== input.id), input]
        }
      }
      if (table === 'app_settings') await route.fulfill({ status: 200, json: { id: 1, owner_id: owner } })
      else await route.fulfill({ status: 204 })
    }
  })
  await page.routeWebSocket('wss://example.supabase.co/**', socket => socket.close())
  return {
    rejectWrites: (table?: string, code = '23514') => { rejectedTable = table; rejectionCode = code },
    fail: (value: boolean) => { fail = value },
    pause: () => { let resume!: () => void; hold = new Promise<void>(resolve => { resume = resolve }); return () => { hold = undefined; resume() } },
  }
}
