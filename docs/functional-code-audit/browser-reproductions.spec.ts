import { expect, test, type Page } from '@playwright/test'

// Exercise the real app and offline outbox against an isolated fake owner/backend.
// No production account, credentials or ledger writes are used.
async function ledger(page: Page, style = 'classic', theme = 'light', used = 3.5, allowance = 7) {
  const owner = '11111111-1111-4111-8111-111111111111'
  const provider = '22222222-2222-4222-8222-222222222222'
  const date = new Date().toLocaleDateString('en-CA')
  let sessions = used > 0 ? [{ id: '33333333-3333-4333-8333-333333333333', provider_id: provider, date, amount: used, cost: 0, notes: null }] : []
  let fail = false
  let hold: Promise<void> | undefined
  const settings = { id: 1, owner_id: owner, budget_cap: 50, theme, style, density: 'comfortable',
    vehicle_efficiency: 14.2, petrol_price: 1.85, petrol_use: 7, vehicle_photo_path: null, updated_at: new Date().toISOString() }
  await page.addInitScript(({ owner }) => {
    localStorage.setItem('ev.supabaseCanonicalMigrated.v2', 'done')
    localStorage.setItem('sb-example-auth-token', JSON.stringify({ access_token: 'test-access-token', refresh_token: 'test-refresh-token',
      expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer',
      user: { id: owner, aud: 'authenticated', role: 'authenticated', email: 'owner@example.com', app_metadata: {}, user_metadata: {} } }))
  }, { owner })
  await page.route('https://example.supabase.co/**', async route => {
    const request = route.request()
    if (hold) await hold
    if (fail) { await route.fulfill({ status: 403, json: { message: 'Test sync rejected' } }); return }
    const table = new URL(request.url()).pathname.split('/').pop()
    if (request.method() === 'GET') {
      await route.fulfill({ json: table === 'providers'
        ? [{ id: provider, name: 'FreeCo', color: '#059669', free_kwh_per_day: allowance, archived: false, sort_order: 0 }]
        : table === 'charging_sessions' ? sessions : table === 'app_settings' ? settings : { user: { id: owner } } })
    } else {
      if (table === 'charging_sessions') {
        if (request.method() === 'DELETE') sessions = []
        else {
          const input = request.postDataJSON()
          sessions = [...sessions.filter(s => s.id !== input.id), input]
        }
      }
      await route.fulfill({ status: 204 })
    }
  })
  await page.routeWebSocket('wss://example.supabase.co/**', socket => socket.close())
  return {
    fail: (value: boolean) => { fail = value },
    pause: () => { let resume!: () => void; hold = new Promise<void>(resolve => { resume = resolve }); return () => { hold = undefined; resume() } },
  }
}

test('audit: receipt does not dismiss on Escape and focus remains outside dialog', async ({ page }) => {
  await ledger(page)
  await page.goto('/statement')
  await expect(page.locator('.startup-splash')).toHaveCount(0)
  const row = page.locator('.swiperow .row').first()
  await row.focus()
  await row.press('Enter')
  await expect(page.getByRole('dialog')).toBeVisible()
  expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(false)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeVisible()
})

test('regression: minimal distance view retains its photo input', async ({ page }) => {
  await ledger(page, 'minimal')
  await page.goto('/vehicle')
  await expect(page.locator('.startup-splash')).toHaveCount(0)
  await page.getByRole('button', { name: /Distance powered/ }).click()
  await expect(page.getByRole('button', { name: 'Add a vehicle photo', exact: true })).toBeVisible()
  await expect(page.locator('input[type="file"]')).toHaveCount(1)
})
