import { TEST_PHOTO, ALT_TEST_PHOTO } from '../../src/lib/testPhotoFixtures'
import { expect, test, type Page } from '@playwright/test'

// Exercise the real app and offline outbox against an isolated fake owner/backend.
// No production account, credentials or ledger writes are used.
async function ledger(page: Page, style = 'classic', theme = 'light', used = 3.5, allowance = 7, vehicle = { efficiency: 14.2, petrolPrice: 1.85, petrolUse: 7 }) {
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


test('sign-out stays signed out when a paused sync response resumes', async ({ page }) => {
  const backend = await ledger(page)
  await page.goto('/settings')
  await expect(page.locator('.sync-badge')).toHaveAttribute('data-sync', 'synced')
  await expect(page.locator('.startup-splash')).toHaveCount(0)
  backend.fail(true)
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.locator('.sync-badge')).toHaveAttribute('data-sync', 'error')
  backend.fail(false)
  const resume = backend.pause()
  const requested = page.waitForRequest(request => request.url().includes('/rest/v1/providers'))
  await page.getByRole('button', { name: /Retry sync/ }).click()
  await requested
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible()
  const resumedResponses = Promise.all(['providers', 'charging_sessions', 'app_settings'].map(table =>
    page.waitForResponse(response => response.url().includes(`/rest/v1/${table}`)),
  ))
  resume()
  await resumedResponses
  await expect.poll(() => page.evaluate(async () => {
    const modulePath = '/src/lib/data.ts'
    const data = await import(/* @vite-ignore */ modulePath)
    await data.synchronize()
    return { status: data.getState().syncStatus, sessions: data.getState().sessions.length }
  })).toEqual({ status: 'signed-out', sessions: 0 })
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible()
})

async function injectQuotaFailure(page: Page) {
  await page.addInitScript(() => {
    const put = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (...args) {
      if (this.transaction.db.name === 'ev-command' && document.documentElement.dataset.testStorage === 'fail') {
        throw new DOMException('Test device quota exceeded', 'QuotaExceededError')
      }
      return put.apply(this, args)
    }
  })
}

test('failed edit keeps its input and succeeds only after a durable retry', async ({ page }) => {
  await ledger(page)
  await injectQuotaFailure(page)
  await page.goto('/statement')
  await expect(page.locator('.startup-splash')).toHaveCount(0)
  const row = page.locator('.swiperow').first()
  await row.getByRole('button', { name: 'Actions for FreeCo charge' }).click()
  await row.getByRole('button', { name: 'Edit FreeCo charge' }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit charge' })
  const cost = dialog.locator('input[type="number"]').last()
  await cost.fill('1.25')
  await page.evaluate(() => { document.documentElement.dataset.testStorage = 'fail' })
  await dialog.getByRole('button', { name: 'Save changes' }).click()
  await expect(dialog.getByRole('alert')).toContainText('Not saved on this device')
  await expect(cost).toHaveValue('1.25')
  await page.getByRole('button', { name: 'Dismiss save error' }).click()
  await page.evaluate(() => { delete document.documentElement.dataset.testStorage })
  await dialog.getByRole('button', { name: 'Save changes' }).click()
  await expect(dialog).toHaveCount(0)
  await expect.poll(() => page.evaluate(async () => {
    const modulePath = '/src/lib/cache.ts'
    const cache = await import(/* @vite-ignore */ modulePath)
    return (await cache.loadCachedSnapshot())?.sessions[0].cost
  })).toBe(1.25)
})

test('failed new charger and charge save stays atomic and preserves the add form', async ({ page }) => {
  await ledger(page)
  await injectQuotaFailure(page)
  await page.goto('/statement')
  await expect(page.locator('.startup-splash')).toHaveCount(0)
  await page.getByRole('button', { name: /Add charge/ }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Add charge or fee' })
  await dialog.getByRole('button', { name: '+ New', exact: true }).click()
  await dialog.getByPlaceholder('e.g. Evie').fill('New charger')
  await dialog.getByPlaceholder('0.0', { exact: true }).fill('5')
  await dialog.getByPlaceholder('0.00', { exact: true }).fill('2')
  await page.evaluate(() => { document.documentElement.dataset.testStorage = 'fail' })
  await dialog.getByRole('button', { name: 'Create charger & save' }).click()
  await expect(dialog.getByRole('alert')).toContainText('Not saved on this device')
  await expect(dialog.getByPlaceholder('e.g. Evie')).toHaveValue('New charger')
  await expect(dialog.locator('.save-status')).toHaveCount(0)
  await page.getByRole('button', { name: 'Dismiss save error' }).click()
  await page.evaluate(() => { delete document.documentElement.dataset.testStorage })
  await dialog.getByRole('button', { name: 'Create charger & save' }).click()
  await expect(dialog.locator('.save-status')).toBeVisible()
  await expect.poll(() => page.evaluate(async () => {
    const modulePath = '/src/lib/cache.ts'
    const cache = await import(/* @vite-ignore */ modulePath)
    const snapshot = await cache.loadCachedSnapshot()
    return { providers: snapshot?.providers.filter((provider: { name: string }) => provider.name === 'New charger').length,
      charges: snapshot?.sessions.filter((session: { cost: number }) => session.cost === 2).length }
  })).toEqual({ providers: 1, charges: 1 })
})

test('failed Delete preserves the row and failed Undo remains available to retry', async ({ page }) => {
  await ledger(page)
  await injectQuotaFailure(page)
  await page.goto('/statement')
  await expect(page.locator('.startup-splash')).toHaveCount(0)
  const row = page.locator('.swiperow').first()
  const openDelete = async () => {
    await row.getByRole('button', { name: 'Actions for FreeCo charge' }).click()
    await row.getByRole('button', { name: 'Delete FreeCo charge' }).click()
  }
  await page.evaluate(() => { document.documentElement.dataset.testStorage = 'fail' })
  await openDelete()
  await expect(page.getByRole('alert')).toContainText('Not saved on this device')
  await expect(page.locator('.swiperow')).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Dismiss save error' }).click()
  await page.evaluate(() => { delete document.documentElement.dataset.testStorage })
  await openDelete()
  await expect(page.locator('.swiperow')).toHaveCount(0)
  const undo = page.getByRole('button', { name: 'Undo', exact: true })
  await expect(undo).toBeVisible()
  await page.evaluate(() => { document.documentElement.dataset.testStorage = 'fail' })
  await undo.click()
  await expect(page.getByRole('alert')).toContainText('Not saved on this device')
  await expect(undo).toBeVisible()
  await expect(page.locator('.swiperow')).toHaveCount(0)
  await page.getByRole('button', { name: 'Dismiss save error' }).click()
  await page.evaluate(() => { delete document.documentElement.dataset.testStorage })
  await undo.click()
  await expect(page.locator('.swiperow')).toHaveCount(1)
  await expect(undo).toHaveCount(0)
})

for (const style of ['classic', 'minimal']) {
  test(`${style} vehicle controls stop at database limits`, async ({ page }) => {
    await ledger(page, style, 'light', 3.5, 7, { efficiency: 1, petrolPrice: 20, petrolUse: 100 })
    await page.goto('/vehicle')
    await page.getByRole('button', { name: style === 'minimal' ? 'Assumptions' : 'Edit assumptions', exact: true }).click()
    await expect(page.getByRole('button', { name: /Decrease.*efficiency/i })).toBeDisabled()
    await expect(page.getByRole('button', { name: /Increase.*petrol price/i })).toBeDisabled()
    await expect(page.getByRole('button', { name: /Increase.*petrol.*use/i })).toBeDisabled()
    await expect(page.getByRole('button', { name: /Increase.*efficiency/i })).toBeEnabled()
  })
}

test('invalid edit shows a validation error, preserves input and leaves the queue empty', async ({ page }) => {
  await ledger(page)
  await page.goto('/statement')
  const row = page.locator('.swiperow').first()
  await row.getByRole('button', { name: 'Actions for FreeCo charge' }).click()
  await row.getByRole('button', { name: 'Edit FreeCo charge' }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit charge' })
  const cost = dialog.locator('input[type="number"]').last()
  await cost.fill('100000.01')
  await dialog.getByRole('button', { name: 'Save changes' }).click()
  await expect(dialog.getByRole('alert')).toContainText('Cost must be between')
  await expect(dialog.getByRole('alert')).not.toContainText('browser storage')
  await expect(cost).toHaveValue('100000.01')
  await expect(dialog.locator('input[type="date"]')).toHaveAttribute('min', '2000-01-01')
  expect(await page.evaluate(async () => {
    const modulePath = '/src/lib/cache.ts'
    const cache = await import(/* @vite-ignore */ modulePath)
    return (await cache.listOutbox()).length
  })).toBe(0)
})

test('rejected settings survive reload and sync after a visible correction', async ({ page }) => {
  const backend = await ledger(page)
  await page.goto('/settings')
  await expect(page.locator('.sync-badge')).toHaveAttribute('data-sync', 'synced')
  backend.rejectWrites('app_settings')
  await page.locator('input[type="range"]').fill('80')
  const recovery = page.getByRole('region', { name: 'Sync recovery' })
  await expect(recovery).toContainText('Test write rejected')
  await page.reload()
  await expect(recovery).toContainText('Test write rejected')
  await recovery.getByRole('button', { name: 'Correct rejected settings' }).click()
  const form = page.getByRole('form', { name: 'Correct rejected settings' })
  await expect(form.getByLabel('Monthly budget (AUD)')).toHaveValue('80')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await form.getByLabel('Monthly budget (AUD)').fill('90')
  backend.rejectWrites()
  await form.getByRole('button', { name: 'Save correction' }).click()
  await expect(recovery).toHaveCount(0)
  await expect(page.locator('.sync-badge')).toHaveAttribute('data-sync', 'synced')
  await expect(page.locator('input[type="range"]')).toHaveValue('90')
})
test('discard requires confirmation, restores cloud settings and retains a downloadable archive', async ({ page }) => {
  const backend = await ledger(page)
  await page.goto('/settings')
  await expect(page.locator('.sync-badge')).toHaveAttribute('data-sync', 'synced')
  backend.rejectWrites('app_settings')
  await page.locator('input[type="range"]').fill('80')
  const recovery = page.getByRole('region', { name: 'Sync recovery' })
  await expect(recovery).toContainText('Test write rejected')
  page.once('dialog', dialog => dialog.dismiss())
  await recovery.getByRole('button', { name: 'Discard all pending changes' }).click()
  await expect(page.locator('input[type="range"]')).toHaveValue('80')
  page.once('dialog', async dialog => { expect(dialog.message()).toContain('ALL 1 pending'); await dialog.accept() })
  await recovery.getByRole('button', { name: 'Discard all pending changes' }).click()
  await expect(recovery).toContainText('1 recovery archive is saved')
  await expect(page.locator('input[type="range"]')).toHaveValue('50')
  await page.reload()
  await expect(recovery).toContainText('1 recovery archive is saved')
  const download = page.waitForEvent('download')
  await recovery.getByRole('button', { name: 'Download sync recovery copy' }).click()
  expect((await download).suggestedFilename()).toBe('ev-sync-recovery.json')
})

test('a rejected charger name can be corrected without dropping its charges', async ({ page }) => {
  const backend = await ledger(page)
  await page.goto('/settings')
  await expect(page.locator('.sync-badge')).toHaveAttribute('data-sync', 'synced')
  backend.rejectWrites('providers', '23505')
  await page.getByRole('button', { name: /FreeCo Free allowance/ }).click()
  await page.getByRole('button', { name: 'Increase FreeCo daily allowance' }).click()
  const recovery = page.getByRole('region', { name: 'Sync recovery' })
  await expect(recovery).toContainText('Test write rejected')
  await recovery.getByRole('button', { name: 'Correct rejected charger' }).click()
  const form = page.getByRole('form', { name: 'Correct rejected charger' })
  await form.getByLabel('Name', { exact: true }).fill('Corrected charger')
  backend.rejectWrites()
  await form.getByRole('button', { name: 'Save correction' }).click()
  await expect(page.locator('.sync-badge')).toHaveAttribute('data-sync', 'synced')
  await page.goto('/statement')
  await expect(page.locator('.swiperow')).toHaveCount(1)
  await expect(page.locator('.swiperow')).toContainText('Corrected charger')
})

async function backupFile(page: Page, value: unknown) {
  await page.locator('input[type=file][accept="application/json,.json"]').waitFor({ state: 'attached' })
  await page.evaluate(value => {
    const input = document.querySelector<HTMLInputElement>('input[type=file][accept="application/json,.json"]')!
    const transfer = new DataTransfer()
    transfer.items.add(new File([JSON.stringify(value)], 'backup.json', { type: 'application/json' }))
    input.files = transfer.files
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }, value)
}
function restoreFixture() {
  return { version: 2, exportedAt: '', settings: { budgetCap: 75, theme: 'light', style: 'classic', density: 'comfortable', vehicle: { efficiency: 14.2, petrolPrice: 1.85, petrolUse: 7 }, vehiclePhotoPath: null },
    providers: [{ id: '44444444-4444-4444-8444-444444444444', name: 'Imported', color: '#123456', freeKwhPerDay: 9, archived: true, sortOrder: 4 }],
    sessions: [{ id: '55555555-5555-4555-8555-555555555555', providerId: '44444444-4444-4444-8444-444444444444', type: 'Imported', date: '2026-01-01', amount: 7, cost: 1, notes: 'Imported charge' }], vehiclePhotoDataUrl: null }
}
test('backup worker previews, cancels, restores offline and safely repeats', async ({ page, context, browserName }) => {
  await ledger(page)
  await page.goto('/settings')
  await expect(page.locator('.sync-badge')).toHaveAttribute('data-sync', 'synced')
  if (browserName === 'webkit') {
    // Playwright network-offline mode also prevents local Blob/File reads here.
    // Exercise the app's offline branch with backend requests blocked instead.
    await page.route('https://example.supabase.co/**', route => route.abort())
    await page.evaluate(() => { Object.defineProperty(navigator, 'onLine', { configurable: true, value: false }); window.dispatchEvent(new Event('offline')) })
  } else await context.setOffline(true)
  await backupFile(page, restoreFixture())
  await expect(page.getByText('Restore preview', { exact: true })).toBeVisible()
  await expect(page.getByText(/Vehicle photo will be removed/)).toBeVisible()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Merge safely' })).toHaveCount(0)
  await backupFile(page, restoreFixture())
  await page.getByRole('button', { name: 'Merge safely' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Added 1 charge and 1 charger' })).toBeVisible()
  await backupFile(page, restoreFixture())
  await page.getByRole('button', { name: 'Merge safely' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Added 0 charges and 0 chargers' })).toBeVisible()
})
test('backup worker rejects duplicate identities and invalid photos without presenting a merge', async ({ page }) => {
  await ledger(page)
  await page.goto('/settings')
  const file = restoreFixture()
  await backupFile(page, { ...file, sessions: [file.sessions[0], file.sessions[0]] })
  await expect(page.getByRole('alert').filter({ hasText: 'duplicate charge IDs' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Merge safely' })).toHaveCount(0)
  await backupFile(page, { ...file, vehiclePhotoDataUrl: 'data:image/svg+xml;base64,PHN2Zz4=' })
  await expect(page.getByRole('alert').filter({ hasText: /photo/i })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Merge safely' })).toHaveCount(0)
})


test('failed restore keeps the preview and commits once after retry', async ({ page, context, browserName }) => {
  await ledger(page)
  await injectQuotaFailure(page)
  await page.goto('/settings')
  await expect(page.locator('.sync-badge')).toHaveAttribute('data-sync', 'synced')
  if (browserName === 'webkit') {
    // Playwright network-offline mode also prevents local Blob/File reads here.
    // Exercise the app's offline branch with backend requests blocked instead.
    await page.route('https://example.supabase.co/**', route => route.abort())
    await page.evaluate(() => { Object.defineProperty(navigator, 'onLine', { configurable: true, value: false }); window.dispatchEvent(new Event('offline')) })
  } else await context.setOffline(true)
  await backupFile(page, restoreFixture())
  await page.evaluate(() => { document.documentElement.dataset.testStorage = 'fail' })
  await page.getByRole('button', { name: 'Merge safely' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Not saved on this device' }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Merge safely' })).toBeEnabled()
  await page.evaluate(() => { delete document.documentElement.dataset.testStorage })
  await page.getByRole('button', { name: 'Merge safely' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Added 1 charge and 1 charger' })).toBeVisible()
  const stored = await page.evaluate(async () => {
    const modulePath = '/src/lib/cache.ts'
    const cache = await import(/* @vite-ignore */ modulePath)
    const snapshot = await cache.loadCachedSnapshot()
    return { sessions: snapshot.sessions.length, archived: snapshot.providers.find((item: { name: string }) => item.name === 'Imported').archived }
  })
  expect(stored).toEqual({ sessions: 2, archived: true })
})
test('v1 preview preserves settings and photos while valid raster photos decode in v2', async ({ page }) => {
  await ledger(page)
  await page.goto('/settings')
  await backupFile(page, { version: 1, budgetCap: 80, providers: [], sessions: [] })
  await expect(page.getByText(/legacy file restores budget only.*Vehicle photo will be kept/)).toBeVisible()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  for (const format of ['image/png', 'image/jpeg', 'image/webp']) {
    const photo = await page.evaluate(format => {
      const canvas = document.createElement('canvas'); canvas.width = 2; canvas.height = 2
      const context = canvas.getContext('2d')!; context.fillStyle = '#123456'; context.fillRect(0, 0, 2, 2)
      return canvas.toDataURL(format)
    }, format)
    await backupFile(page, { ...restoreFixture(), vehiclePhotoDataUrl: photo })
    await expect(page.getByText(/Vehicle photo will be replaced/)).toBeVisible()
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  }
})

for (const style of ['classic', 'minimal']) {
  test(`${style} photo picker, save retry and removal work across views and reload`, async ({ page }) => {
    test.setTimeout(45000)
    await ledger(page, style)
    await injectQuotaFailure(page)
    await page.goto('/vehicle')
    await expect(page.locator('.startup-splash')).toHaveCount(0)
    await page.evaluate(() => { document.documentElement.dataset.testStorage = 'fail' })
    const choose = async (dataUrl: string) => {
      const chooser = page.waitForEvent('filechooser')
      await page.getByRole('button', { name: /^(Add a vehicle photo|Change vehicle photo)$/ }).click()
      await (await chooser).setFiles({ name: 'vehicle.png', mimeType: 'image/png', buffer: Buffer.from(dataUrl.split(',')[1], 'base64') })
    }
    await choose(TEST_PHOTO)
    await expect(page.getByRole('alert').filter({ hasText: 'Not saved on this device' }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Retry photo save' })).toBeEnabled()
    await page.evaluate(() => { delete document.documentElement.dataset.testStorage })
    await page.getByRole('button', { name: 'Retry photo save' }).click()
    await expect(page.getByAltText('Your vehicle')).toBeVisible()
    await expect.poll(() => page.evaluate(async () => {
      const path = '/src/lib/data.ts'; const data = await import(/* @vite-ignore */ path)
      return data.getState().pendingCount
    })).toBe(0)
    await page.reload()
    await expect(page.locator('.startup-splash')).toHaveCount(0)
    await expect(page.getByAltText('Your vehicle')).toBeVisible()
    if (style === 'minimal') await page.getByRole('button', { name: /Distance powered/ }).click()
    await expect(page.locator('input[type=file]')).toHaveCount(1)
    await choose(ALT_TEST_PHOTO)
    await expect(page.getByRole('button', { name: 'Remove vehicle photo', exact: true })).toBeEnabled()
    await page.evaluate(() => { document.documentElement.dataset.testStorage = 'fail' })
    await page.getByRole('button', { name: 'Remove vehicle photo', exact: true }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Not saved on this device' }).first()).toBeVisible()
    await expect(page.getByAltText('Your vehicle')).toBeVisible()
    await page.evaluate(() => { delete document.documentElement.dataset.testStorage })
    await page.getByRole('button', { name: 'Remove vehicle photo', exact: true }).click()
    await expect(page.getByAltText('Your vehicle')).toHaveCount(0)
    await expect.poll(() => page.evaluate(async () => {
      const path = '/src/lib/data.ts'; const data = await import(/* @vite-ignore */ path)
      return data.getState().pendingCount
    })).toBe(0)
    await page.reload()
    await expect(page.getByRole('button', { name: 'Add a vehicle photo', exact: true })).toBeVisible()
    await expect(page.getByAltText('Your vehicle')).toHaveCount(0)
  })

  test(`${style} paid charger can move above a free charger and survives sync and reload`, async ({ page, context }) => {
    await ledger(page, style)
    await page.goto('/settings')
    await expect(page.locator('.sync-badge')).toHaveAttribute('data-sync', 'synced')
    await context.setOffline(true)
    await page.evaluate(async () => {
      const path = '/src/lib/data.ts'; const data = await import(/* @vite-ignore */ path)
      await data.addProvider('PaidCo', 0)
    })
    await page.getByRole('button', { name: /PaidCo/, exact: false }).first().click()
    await page.getByRole('button', { name: 'Move PaidCo up', exact: true }).click()
    await page.getByRole('button', { name: 'Add charge', exact: true }).click()
    await expect(page.locator('.provrow button').first()).toHaveText('PaidCo')
    await page.locator('.sheet-backdrop').click({ position: { x: 5, y: 5 } })
    await context.setOffline(false)
    await expect(page.locator('.sync-badge')).toHaveAttribute('data-sync', 'synced')
    await page.reload()
    await expect(page.locator('.startup-splash')).toHaveCount(0)
    await page.getByRole('button', { name: 'Add charge', exact: true }).click()
    await expect(page.locator('.provrow button').first()).toHaveText('PaidCo')
  })
}

test('account links preserve percent, encoded literals, Unicode and slash names through rename', async ({ page }) => {
  test.setTimeout(60000)
  await ledger(page)
  await page.goto('/accounts')
  await expect(page.locator('.startup-splash')).toHaveCount(0)
  const idPath = '/accounts/id/22222222-2222-4222-8222-222222222222'
  for (const name of ['50% Charger', 'Literal %20', '東京 ⚡', 'AC/DC', 'Literal %2F']) {
    await page.evaluate(async name => {
      const path = '/src/lib/data.ts'; const data = await import(/* @vite-ignore */ path)
      await data.updateProvider('22222222-2222-4222-8222-222222222222', { name })
      await data.synchronize()
    }, name)
    await page.goto(`/accounts/${encodeURIComponent(name)}`)
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible()
    await page.goto('/accounts')
    await expect(page.locator('.startup-splash')).toHaveCount(0)
    await page.locator('button.row').filter({ hasText: name }).click()
    await expect(page).toHaveURL(new RegExp(`${idPath}$`))
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible()
  }
  await page.evaluate(async () => {
    const path = '/src/lib/data.ts'; const data = await import(/* @vite-ignore */ path)
    await data.updateProvider('22222222-2222-4222-8222-222222222222', { name: 'Renamed charger' })
    await data.synchronize()
  })
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Renamed charger', exact: true })).toBeVisible()
})

for (const failure of ['render', 'import']) {
  test(`route ${failure} failure has a recovery screen and Home remains usable`, async ({ page }) => {
    await ledger(page)
    await page.route('**/src/pages/Accounts.tsx*', async route => {
      if (failure === 'import') await route.abort()
      else await route.fulfill({ contentType: 'application/javascript', body: 'export function AccountsList(){throw new Error("Test render failure")};export function AccountDetail(){throw new Error("Test render failure")}' })
    })
    await page.goto('/accounts')
    await expect(page.getByRole('heading', { name: 'Unable to open this page' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Reload app', exact: true })).toBeVisible()
    await page.getByRole('link', { name: 'Return home', exact: true }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('heading', { name: 'Unable to open this page' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Add charge', exact: true })).toBeVisible()
  })
}

for (const style of ['classic', 'minimal']) {
  test(`${style} Undo retains UUID, creation time and allowance through sync and reload`, async ({ page, context }) => {
    await ledger(page, style)
    await page.goto('/statement')
    await expect(page.locator('.startup-splash')).toHaveCount(0)
    const before = await page.evaluate(async () => {
      const path = '/src/lib/data.ts'; const data = await import(/* @vite-ignore */ path)
      await data.addSession({ type: 'FreeCo', date: data.getState().sessions[0].date, amount: 8, cost: 1, notes: 'Later charge' })
      await data.synchronize()
      const snapshot = await data.buildBackup()
      return snapshot.sessions.map((row: { id: string; createdAt?: string }) => ({ id: row.id, createdAt: row.createdAt }))
    })
    await context.setOffline(true)
    const row = page.locator('.swiperow').first()
    await row.getByRole('button', { name: 'Actions for FreeCo charge' }).click()
    await row.getByRole('button', { name: 'Delete FreeCo charge' }).click()
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    await expect(page.locator('.swiperow')).toHaveCount(2)
    const check = async () => page.evaluate(async () => {
      const dataPath = '/src/lib/data.ts', savingsPath = '/src/lib/savings.ts'
      const data = await import(/* @vite-ignore */ dataPath), savings = await import(/* @vite-ignore */ savingsPath)
      const state = data.getState()
      return { rows: state.sessions.map((row: { id: string; createdAt?: string }) => ({ id: row.id, createdAt: row.createdAt })).sort((a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id)), free: savings.enrichSessions(state.sessions, state.providers).map((row: { id: string; freeKwh: number }) => [row.id, row.freeKwh]).sort() }
    })
    const local = await check()
    expect(local.rows).toEqual(before.sort((a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id)))
    await context.setOffline(false)
    await expect.poll(() => page.evaluate(async () => {
      const path = '/src/lib/data.ts'; const data = await import(/* @vite-ignore */ path)
      return data.getState().pendingCount
    })).toBe(0)
    await page.reload()
    await expect(page.locator('.startup-splash')).toHaveCount(0)
    const reloaded = await check()
    expect(reloaded.free).toEqual(local.free)
    // Legacy rows acquire their fixed ordering timestamp when first persisted.
    expect(reloaded.rows.map((row: { id: string }) => row.id)).toEqual(local.rows.map((row: { id: string }) => row.id))
    expect(reloaded.rows.find((row: { id: string }) => row.id === before.find((row: { createdAt?: string }) => row.createdAt)?.id)?.createdAt).toBe(before.find((row: { createdAt?: string }) => row.createdAt)?.createdAt)
  })
}
