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

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

test('sync mark follows real sync, offline, error and retry states', async ({ page, context }) => {
  const backend = await ledger(page)
  await page.goto('/settings')
  const badge = page.locator('.sync-badge')
  await expect(badge).toHaveAttribute('data-sync', 'synced')
  await expect(badge.locator('.status-mark')).toHaveAttribute('data-status', 'done')
  await context.setOffline(true)
  await expect(badge).toHaveAttribute('data-sync', 'offline')
  await expect(badge.locator('.status-mark')).toHaveAttribute('data-status', 'pending')
  backend.fail(true)
  await context.setOffline(false)
  await expect(badge).toHaveAttribute('data-sync', 'error')
  await expect(badge).toHaveText('Sync failed')
  backend.fail(false)
  const resume = backend.pause()
  await page.getByRole('button', { name: /Retry sync/ }).click()
  await expect(badge).toHaveAttribute('data-sync', 'syncing')
  await expect(badge.locator('.status-mark')).toHaveAttribute('data-status', 'running')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(badge.locator('.status-mark__ring')).toHaveCSS('animation-name', 'none')
  resume()
  await expect(badge).toHaveAttribute('data-sync', 'synced')
})

test('history supports taps, accessible actions, delete and Undo', async ({ page }) => {
  await ledger(page)
  await page.goto('/statement')
  const row = page.locator('.swiperow').first()
  await row.locator('.row').click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.locator('.sheet-backdrop').click({ position: { x: 5, y: 5 } })
  const toggle = row.getByRole('button', { name: 'Actions for FreeCo charge' })
  await toggle.focus()
  await page.keyboard.press('ArrowLeft')
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await row.getByRole('button', { name: 'Edit FreeCo charge' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.locator('.sheet-backdrop').click({ position: { x: 5, y: 5 } })
  await toggle.click()
  await row.getByRole('button', { name: 'Delete FreeCo charge' }).click()
  await expect(page.locator('.swiperow')).toHaveCount(0)
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(page.locator('.swiperow')).toHaveCount(1)
})

test('swiping settles even when closed state is unchanged; vertical and cancelled gestures do not open actions', async ({ page }) => {
  await ledger(page)
  await page.goto('/statement')
  const surface = page.locator('.swipe-content').first()
  await expect(surface).toBeVisible()
  await expect(page.locator('.startup-splash')).toHaveCount(0)
  const box = (await surface.boundingBox())!
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x - 115, y, { steps: 10 })
  await page.mouse.up()
  const toggle = page.getByRole('button', { name: 'Actions for FreeCo charge' })
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await toggle.press('Escape')
  await expect(surface).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)')
  // Short horizontal movement must spring back, even though open stays false.
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x - 9, y, { steps: 8 })
  await page.mouse.up()
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(surface).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)')
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x - 20, y + 70, { steps: 10 })
  await page.mouse.up()
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await surface.dispatchEvent('pointerdown', { pointerId: 9, isPrimary: true, button: 0, clientX: x, clientY: y })
  await surface.dispatchEvent('pointermove', { pointerId: 9, clientX: x - 70, clientY: y })
  await surface.dispatchEvent('pointercancel', { pointerId: 9 })
  await expect(surface).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)')
  await surface.locator('.row').press('Enter')
  await expect(page.getByRole('dialog')).toBeVisible()
})

for (const style of ['classic', 'minimal']) {
  test(`${style} allowance gauge updates from a saved charge and honours reduced motion`, async ({ page }) => {
    await ledger(page, style, style === 'minimal' ? 'dark' : 'light')
    await page.goto('/savings')
    if (style === 'minimal') await page.getByRole('button', { name: /Today's allowance/ }).click()
    const gauge = page.getByRole('meter')
    await expect(gauge).toHaveAttribute('aria-valuenow', '3.5')
    await expect(gauge).toHaveAttribute('aria-valuemax', '7')
    await expect(gauge).toHaveAttribute('aria-valuetext', '3.5 of 7.0 kWh used today at FreeCo')
    await page.getByRole('button', { name: 'Add charge', exact: true }).click()
    await page.getByPlaceholder('0.0', { exact: true }).fill('1')
    await page.getByRole('button', { name: 'Save charge', exact: true }).click()
    await expect(gauge).toHaveAttribute('aria-valuenow', '4.5')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const clip = await gauge.locator('.slosh-gauge__liquid').evaluate(el => (el as HTMLElement).style.clipPath)
    await expect.poll(() => gauge.locator('.slosh-gauge__liquid').evaluate(el => (el as HTMLElement).style.clipPath)).toBe(clip)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: `test-results/micro-${style}.png`, fullPage: true })
  })
}

for (const [used, allowance] of [[0, 7], [9, 7], [0.25, 0.5]]) {
  test(`allowance gauge accurately represents ${used}/${allowance} kWh`, async ({ page }) => {
    await ledger(page, 'classic', 'light', used, allowance)
    await page.goto('/savings')
    await expect(page.getByRole('meter')).toHaveAttribute('aria-valuenow', String(Math.min(used, allowance)))
    await expect(page.getByRole('meter')).toHaveAttribute('aria-valuemax', String(allowance))
  })
}
