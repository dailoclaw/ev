import { TEST_PHOTO, ALT_TEST_PHOTO } from '../../src/lib/testPhotoFixtures'
import { expect, test, type Page } from '@playwright/test'

import { ledger } from '../fixtures/ledger'

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
  while (await page.locator('.achievement-card').count()) await page.locator('.achievement-card').getByRole('button', { name: 'Continue', exact: true }).click()
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

for (const style of ['classic', 'minimal']) {
  test(`${style} savings shows separate network allowances and all costs reconcile`, async ({ page }) => {
    await ledger(page, style, 'light', 3.5)
    await page.goto('/')
    await expect(page.getByRole('main').getByRole('button', { name: 'Settings', exact: true })).toBeVisible()
    await page.evaluate(async () => {
      const path = '/src/lib/data.ts'; const data = await import(/* @vite-ignore */ path)
      await data.addProvider('SecondFree', 5)
      const date = data.getState().sessions[0].date
      await data.addSession({ type: 'SecondFree', date, amount: 5, cost: 4, notes: 'Recorded allowance cost' })
      await data.addSession({ type: 'FreeCo', date, amount: 0, cost: 15, notes: 'Membership' })
    })
    await page.goto('/savings')
    if (style === 'minimal') await page.getByRole('button', { name: /Today's allowance/ }).click()
    await expect(page.getByRole('meter', { name: /FreeCo/ })).toBeVisible()
    await expect(page.getByRole('meter', { name: /SecondFree/ })).toBeVisible()
    await expect(page.getByText('5.0 of 5.0 kWh used', { exact: false })).toBeVisible()
    await page.goto('/analytics/concentration')
    await expect(page.getByText('Recorded energy cost: $4.00. Non-energy charges excluded: $15.00.', { exact: false })).toBeVisible()
    await page.getByRole('button', { name: 'Paid only', exact: true }).click()
    await expect(page.getByText('Recorded energy cost: $4.00. Non-energy charges excluded: $15.00.', { exact: false })).toBeVisible()
  })
}

for (const style of ['classic', 'minimal']) {
  test(`${style} empty history and zero budget render finite analytics`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await ledger(page, style, 'light', 0, 0)
    await page.goto('/')
    await expect(page.getByRole('main').getByRole('button', { name: 'Settings', exact: true })).toBeVisible()
    await page.evaluate(async () => {
      const path = '/src/lib/data.ts'; const data = await import(/* @vite-ignore */ path)
      await data.setBudgetCap(0)
    })
    if (style === 'classic') {
      await expect(page.getByRole('img', { name: 'Spent 0.00 of 0 budget' }).locator('.fill')).toHaveAttribute('style', 'width: 0%;')
    }
    await page.goto('/savings')
    if (style === 'classic') await expect(page.getByText('No free allowances configured', { exact: true })).toBeVisible()
    else {
      await expect(page.getByRole('button', { name: /Today's allowance/ })).toHaveCount(0)
      await page.getByRole('button', { name: /Saved per month/ }).click()
    }
    await expect(page.getByRole('main')).not.toContainText('NaN')
    await expect(page.getByRole('main')).not.toContainText('Infinity')
    await page.goto('/analytics/concentration')
    await expect(page.getByText('No cost curve yet', { exact: true })).toBeVisible()
    await expect(page.getByText('Recorded energy cost: $0.00. Non-energy charges excluded: $0.00.', { exact: false })).toBeVisible()
  })
}

for (const style of ['classic', 'minimal']) {
  test(`${style} analytics compares completed matching months rather than partial year totals`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await ledger(page, style, 'light', 0, 0)
    await page.goto('/')
    await expect(page.getByRole('main').getByRole('button', { name: 'Settings', exact: true })).toBeVisible()
    await page.evaluate(async () => {
      const path = '/src/lib/data.ts'; const data = await import(/* @vite-ignore */ path)
      const now = new Date(), year = now.getFullYear(), month = now.getMonth() + 1
      // Historical consecutive years ensure this fixture also works during January.
      const current = month > 1 ? year : year - 1
      const completed = month > 1 ? String(month - 1).padStart(2, '0') : '12'
      const ongoing = String(month).padStart(2, '0')
      for (const [date, cost] of [
        [`${current - 1}-${completed}-01`, 10], [`${current}-${completed}-01`, 20],
        ...(month > 1 ? [[`${current - 1}-${ongoing}-01`, 1000], [`${current}-${ongoing}-01`, 1]] : []),
      ] as [string, number][]) await data.addSession({ type: 'FreeCo', date, amount: 2, cost, notes: null })
    })
    await expect.poll(async () => page.evaluate(async () => {
      const path = '/src/lib/data.ts'; const data = await import(/* @vite-ignore */ path)
      return data.getState().pendingCount
    })).toBe(0)
    await page.goto('/analytics')
    if (style === 'minimal') {
      await expect(page.getByText('Up 100% across matching completed months last year.', { exact: true })).toBeVisible()
    } else {
      await page.getByRole('navigation', { name: 'Analytics views' }).getByRole('button', { name: 'Compare', exact: true }).click()
      await expect(page.getByText('1 completed matching month.', { exact: false })).toBeVisible()
      const costs = page.locator('.cmp').first().locator('.side .v')
      await expect(costs.nth(0)).toHaveText('$10')
      await expect(costs.nth(1)).toHaveText('$20')
      await expect(page.locator('.cmp').first().locator('.mid')).toHaveText('+100%')
      await page.getByRole('navigation', { name: 'Analytics views' }).getByRole('button', { name: 'Statement', exact: true }).click()
      await expect(page.getByText('Change compares 1 completed matching month: $20.00 vs $10.00.', { exact: false })).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    }
  })
}

for (const style of ['classic', 'minimal']) for (const theme of ['light', 'dark']) {
  test(`${style} ${theme} modal keyboard focus, labels, Escape and restoration`, async ({ page }) => {
    await ledger(page, style, theme)
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Add charge', exact: true })).toBeVisible()
    const ratios = await page.evaluate(() => {
      const css = getComputedStyle(document.documentElement)
      const luminance = (hex: string) => {
        const c = hex.match(/[0-9a-f]{2}/gi)!.map(v => parseInt(v, 16) / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
        return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722
      }
      return ['fnt', 'mut', 'tx', 'money', 'money-deep', 'neg', 'warn'].flatMap(text => ['canvas', 'surf', 'surf2'].map(background => {
        const a = luminance(css.getPropertyValue(`--${text}`)), b = luminance(css.getPropertyValue(`--${background}`))
        return { name: `${text} on ${background}`, ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) }
      }))
    })
    for (const result of ratios) expect(result.ratio, result.name).toBeGreaterThanOrEqual(4.5)
    const add = page.getByRole('button', { name: 'Add charge', exact: true })
    await add.focus(); await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog', { name: 'Add charge or fee' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Close dialog', exact: true })).toBeFocused()
    await expect(dialog.getByRole('spinbutton', { name: 'Energy', exact: true })).toBeVisible()
    await expect(dialog.getByRole('spinbutton', { name: 'Cost', exact: true })).toBeVisible()
    await expect(dialog.getByLabel('Date', { exact: true })).toBeVisible()
    for (let i = 0; i < 16; i++) {
      await page.keyboard.press(i % 3 ? 'Tab' : 'Shift+Tab')
      expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true)
    }
    await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(add).toBeFocused()
    await page.goto('/statement')
    const row = page.locator('.swiperow').first().locator('.row')
    await row.focus(); await page.keyboard.press('Enter')
    await expect(page.getByRole('dialog', { name: 'Session receipt' })).toBeVisible()
    await page.keyboard.press('Escape'); await expect(row).toBeFocused()
    await page.getByRole('button', { name: 'Actions for FreeCo charge' }).click()
    const edit = page.getByRole('button', { name: 'Edit FreeCo charge' })
    await edit.focus(); await page.keyboard.press('Enter')
    await expect(page.getByRole('dialog', { name: 'Edit charge' }).getByRole('spinbutton', { name: 'Energy' })).toBeVisible()
    await page.keyboard.press('Escape'); await expect(page.getByRole('button', { name: 'Actions for FreeCo charge' })).toBeFocused()
    await page.goto('/savings')
    if (style === 'classic') {
      const ratios = await page.locator('.savecard').evaluate(card => {
        const css = getComputedStyle(card)
        const stops = [...css.backgroundImage.matchAll(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/g)].map(match => match.slice(1).map(Number))
        const light = (rgb: number[]) => {
          const c = rgb.map(v => v / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
          return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722
        }
        const opacity = Number(getComputedStyle(card.querySelector('small')!).opacity)
        return stops.map(background => {
          const blended = background.map(v => 255 * opacity + v * (1 - opacity))
          return (light(blended) + 0.05) / (light(background) + 0.05)
        })
      })
      expect(ratios).toHaveLength(3)
      for (const ratio of ratios) expect(ratio).toBeGreaterThanOrEqual(4.5)
    }
    const explain = page.getByRole('button', { name: 'Lifetime net benefit — show how this was calculated' })
    await explain.focus(); await page.keyboard.press('Enter')
    await expect(page.getByRole('dialog', { name: 'How Lifetime net benefit was calculated' })).toBeVisible()
    await page.keyboard.press('Escape'); await expect(explain).toBeFocused()
    await page.goto('/settings')
    await expect(page.getByRole('slider', { name: 'Monthly spending cap (AUD)' })).toBeVisible()
    const release = page.getByRole('button', { name: /EV Command v.*what's new/ })
    await release.focus(); await page.keyboard.press('Enter')
    await expect(page.getByRole('dialog', { name: "What's new" })).toBeVisible()
    await page.keyboard.press('Escape'); await expect(release).toBeFocused()
    await page.goto('/vehicle')
    const record = page.getByRole('button', { name: /View .* record status/ }).first()
    await record.focus(); await page.keyboard.press('Enter')
    await expect(page.getByRole('dialog', { name: /./ })).toBeVisible()
    await page.keyboard.press('Escape'); await expect(record).toBeFocused()
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content')
    expect(viewport).not.toContain('user-scalable=no')
    await page.goto('/settings')
    await page.setViewportSize({ width: 780, height: 844 })
    await page.evaluate(() => { document.body.style.zoom = '2' })
    await expect(page.getByRole('slider', { name: 'Monthly spending cap (AUD)' })).toBeVisible()
    const layout = await page.evaluate(() => ({ width: window.innerWidth, scroll: document.documentElement.scrollWidth,
      overflow: [...document.querySelectorAll<HTMLElement>('body *')].filter(el => el.getBoundingClientRect().right > window.innerWidth + 1).slice(0, 12).map(el => ({ tag: el.tagName, cls: el.className, html: el.outerHTML.slice(0, 500), visibility: getComputedStyle(el).visibility, right: el.getBoundingClientRect().right, text: el.textContent?.slice(0, 70) })) }))
    expect(layout.scroll, JSON.stringify(layout)).toBeLessThanOrEqual(layout.width)
  })
}

test('trend chart supports keyboard selection and motion changes are reactive', async ({ page }) => {
  await ledger(page, 'classic')
  await page.goto('/analytics')
  await page.getByRole('navigation', { name: 'Analytics views' }).getByRole('button', { name: 'Trends', exact: true }).click()
  const points = page.locator('circle[role="button"]')
  await points.first().focus(); await page.keyboard.press('Enter')
  await expect(points.first()).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('End'); await expect(points.last()).toBeFocused()
  await expect(points.last()).toHaveAttribute('aria-pressed', 'true')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.keyboard.press('Home')
  await expect(points.first()).toBeFocused()
  await expect(page.locator('animateMotion')).toHaveCount(0)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.keyboard.press('End')
  await expect(page.locator('animateMotion')).toHaveCount(1)
})

test('nested achievement stays readable and Escape restores the underlying sheet', async ({ page }) => {
  await ledger(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Add charge', exact: true }).click()
  const parent = page.getByRole('dialog', { name: 'Add charge or fee' })
  const notes = parent.getByLabel('Notes (optional)', { exact: true })
  await notes.focus()
  await page.evaluate(async () => {
    const path = '/src/lib/data.ts'; const data = await import(/* @vite-ignore */ path)
    const date = data.getState().sessions[0].date
    for (let i = 0; i < 4; i++) await data.addSession({ type: 'FreeCo', date, amount: 0.5, cost: 0, notes: null })
  })
  const achievement = page.getByRole('dialog', { name: 'Free five' })
  await expect(achievement).toBeVisible()
  await page.clock.install(); await page.clock.fastForward(5000)
  await expect(achievement).toBeVisible()
  await page.keyboard.press('Escape'); await expect(achievement).toHaveCount(0)
  await expect(parent).toBeVisible(); await expect(notes).toBeFocused()
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden')
  await page.keyboard.press('Escape'); await expect(parent).toHaveCount(0)
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('')
})

test('batched cache writes roll back after a later submission fails and can retry', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const cachePath = '/src/lib/cache.ts', modelPath = '/src/lib/appModel.ts'
    const cache = await import(/* @vite-ignore */ cachePath)
    const model = await import(/* @vite-ignore */ modelPath)
    const snapshot = { ownerId: 'batch-test', sessions: [], providers: [], settings: model.DEFAULT_SETTINGS, vehiclePhotoDataUrl: null, cachedAt: 'original' }
    const operations = Array.from({ length: 601 }, (_, i) => ({ id: `batch-test:session:${i}`, ownerId: 'batch-test', updatedAt: '', action: 'session-upsert' as const, payload: { id: String(i) } }))
    await cache.commitCachedState(snapshot, [operations[0]])
    const originalQueue = await cache.listOutbox('batch-test')
    const put = IDBObjectStore.prototype.put
    let submitted = 0, error = ''
    IDBObjectStore.prototype.put = function (...args: Parameters<typeof put>) {
      if (this.name === 'outbox' && ++submitted === 501) throw new DOMException('Late quota failure', 'QuotaExceededError')
      return put.apply(this, args)
    }
    try { await cache.commitCachedState({ ...snapshot, cachedAt: 'failed' }, operations) } catch (reason) {
      error = String(reason)
    } finally { IDBObjectStore.prototype.put = put }
    const unchanged = JSON.stringify(await cache.loadCachedSnapshot()) === JSON.stringify(snapshot)
      && JSON.stringify(await cache.listOutbox('batch-test')) === JSON.stringify(originalQueue)
    await cache.commitCachedState({ ...snapshot, cachedAt: 'retry' }, operations)
    return { error, submitted, unchanged, retrySnapshot: (await cache.loadCachedSnapshot())?.cachedAt, retryCount: (await cache.listOutbox('batch-test')).length }
  })
  expect(result.error).toContain('Late quota failure')
  expect(result.submitted).toBe(501)
  expect(result.unchanged).toBe(true)
  expect(result.retrySnapshot).toBe('retry')
  expect(result.retryCount).toBe(601)
})

test('achievement restores Add focus after its saving sheet automatically closes', async ({ page }) => {
  await ledger(page)
  await page.goto('/')
  await expect.poll(() => page.evaluate(async () => {
    const path = '/src/lib/data.ts'; const data = await import(/* @vite-ignore */ path)
    return data.getState().sessions.length
  })).toBeGreaterThan(0)
  await page.evaluate(async () => {
    const path = '/src/lib/data.ts'; const data = await import(/* @vite-ignore */ path)
    const date = data.getState().sessions[0].date
    for (let i = 0; i < 3; i++) await data.addSession({ type: 'FreeCo', date, amount: 0.5, cost: 0, notes: null })
  })
  const add = page.getByRole('button', { name: 'Add charge', exact: true })
  await add.click()
  const parent = page.getByRole('dialog', { name: 'Add charge or fee' })
  await parent.getByLabel('Energy', { exact: true }).fill('0.5')
  await parent.getByLabel('Cost', { exact: true }).fill('0')
  await parent.getByRole('button', { name: 'Save charge', exact: true }).click()
  const achievement = page.getByRole('dialog', { name: 'Free five' })
  await expect(achievement).toBeVisible()
  await expect(parent).toHaveCount(0)
  await expect(achievement).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(achievement).toHaveCount(0)
  await expect(add).toBeFocused()
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('')
})
