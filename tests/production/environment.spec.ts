import { expect, test, type Page } from '@playwright/test'
import { productionLedger } from './ledger'

async function installedWorker(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
    if (!navigator.serviceWorker.controller) await new Promise<void>(resolve => {
      navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true })
    })
  })
  // Ready/claim follows completed precaching, including unvisited lazy routes.
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.state)).toBe('activated')
}

async function queuedWrites(page: Page) {
  return page.evaluate(() => new Promise<number>((resolve, reject) => {
    const open = indexedDB.open('ev-command')
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      const db = open.result
      const transaction = db.transaction('outbox', 'readonly')
      const count = transaction.objectStore('outbox').count()
      count.onsuccess = () => resolve(count.result)
      count.onerror = () => reject(count.error)
      transaction.oncomplete = () => db.close()
    }
  }))
}

test('production headers, lazy pages and backup worker satisfy CSP', async ({ page, request }) => {
  await productionLedger(page, request)
  const errors: string[] = []
  const violations: string[] = []
  const startupTables = ['providers', 'charging_sessions', 'app_settings']
  const completed = new Map<string, number>()
  page.on('requestfinished', request => {
    if (request.method() !== 'GET') return
    const table = new URL(request.url()).pathname.split('/').pop()!
    if (request.url().includes('/supabase/rest/v1/') && startupTables.includes(table)) completed.set(table, (completed.get(table) ?? 0) + 1)
  })
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => {
    const violations: string[] = []
    Object.assign(window, { validationCspViolations: violations })
    document.addEventListener('securitypolicyviolation', event => violations.push(`${event.violatedDirective}: ${event.blockedURI}`))
  })
  for (const path of ['/', '/settings', '/analytics', '/analytics/chart', '/analytics/concentration', '/cost-anatomy', '/vehicle', '/statement', '/savings', '/accounts']) {
    completed.clear()
    const response = await page.goto(path)
    expect(response?.headers()['content-security-policy']).toContain("script-src 'self'")
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible()
    await expect(page.getByRole('main', { name: 'Loading page' })).toHaveCount(0)
    // This one-page fixture performs an initial and a canonical read per table.
    // Finish both before full navigation can cancel the route's startup fetches.
    for (const table of startupTables) await expect.poll(() => completed.get(table) ?? 0, { message: `${path}: completed ${table} startup reads` }).toBeGreaterThanOrEqual(2)
    violations.push(...await page.evaluate(() => (window as unknown as { validationCspViolations: string[] }).validationCspViolations))
  }
  await page.goto('/settings')
  const backup = { version: 2, exportedAt: '', settings: { budgetCap: 50, theme: 'light', style: 'classic', density: 'comfortable', vehicle: { efficiency: 14.2, petrolPrice: 1.85, petrolUse: 7 }, vehiclePhotoPath: null }, providers: [], sessions: [], vehiclePhotoDataUrl: null }
  await page.locator('input[type="file"][accept*="json"]').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) })
  await expect(page.getByText(/This file has/)).toBeVisible()
  await expect(page.locator('.sync-badge')).toHaveAttribute('data-sync', 'synced')
  violations.push(...await page.evaluate(() => (window as unknown as { validationCspViolations: string[] }).validationCspViolations))
  expect(violations).toEqual([])
  expect(errors).toEqual([])
  const shell = await request.get('/settings')
  expect(shell.headers()['cache-control']).toContain('no-store')
  expect((await request.get('/sw.js')).headers()['cache-control']).toContain('no-store')
  const chunk = await page.locator('script[type="module"][src]').getAttribute('src')
  expect((await request.get(chunk!)).headers()['cache-control']).toContain('immutable')
  expect((await request.get('/assets/missing.js')).status()).toBe(404)
})

test('controlled PWA cold starts offline on visited and unvisited routes, retaining queued writes', async ({ page, context, request, browserName }) => {
  test.skip(browserName === 'webkit', 'Playwright WebKit reports an internal error for controlled offline navigation; installed Safari acceptance remains manual.')
  const backend = await productionLedger(page, request)
  await page.goto('/settings')
  await expect(page.locator('.sync-badge')).toHaveAttribute('data-sync', 'synced')
  await installedWorker(page)
  await backend.fail(true)
  await context.setOffline(true)
  await page.close()
  page = await context.newPage()
  await page.goto('/settings')
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible()
  await page.goto('/accounts')
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible()
  await page.getByRole('button', { name: 'Add charge', exact: true }).click()
  const add = page.getByRole('dialog', { name: 'Add charge or fee' })
  await add.getByLabel('Energy', { exact: true }).fill('1')
  await add.getByLabel('Cost', { exact: true }).fill('0')
  await add.getByRole('button', { name: 'Save charge', exact: true }).click()
  await expect(add).toHaveCount(0)
  await page.goto('/settings')
  await expect.poll(() => queuedWrites(page)).toBe(1)
  await page.reload()
  await expect.poll(() => queuedWrites(page)).toBe(1)
  await backend.fail(false)
  await context.setOffline(false)
  // Some automation engines omit the online event after an offline new window.
  // Exercise automatic recovery rather than racing a button it can already hide.
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await expect(page.locator('.sync-badge')).toHaveAttribute('data-sync', 'synced')
  await expect.poll(() => queuedWrites(page)).toBe(0)
})

test('worker replacement in an open tab preserves queued changes', async ({ page, request }) => {
  const backend = await productionLedger(page, request)
  await page.goto('/settings')
  await expect(page.locator('.sync-badge')).toHaveAttribute('data-sync', 'synced')
  await installedWorker(page)
  // Keep durable changes pending while a replacement worker takes over online.
  await backend.fail(true)
  await page.getByRole('slider', { name: 'Monthly spending cap (AUD)' }).evaluate((input: HTMLInputElement) => {
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
    setValue.call(input, '75')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await expect(page.locator('.sync-badge')).toHaveAttribute('data-sync', 'error')
  await request.post('/__validation__/worker-revision')
  await page.evaluate(async () => {
    const changed = new Promise<void>(resolve => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }))
    const registration = await navigator.serviceWorker.getRegistration()
    await registration!.update()
    await changed
  })
  await page.reload()
  await expect(page.getByRole('slider', { name: 'Monthly spending cap (AUD)' })).toHaveValue('75')
  await expect.poll(() => queuedWrites(page)).toBe(1)
  await backend.fail(false)
  await page.getByRole('button', { name: /Retry sync/ }).click()
  await expect(page.locator('.sync-badge')).toHaveAttribute('data-sync', 'synced')
  await expect.poll(() => queuedWrites(page)).toBe(0)
})

test.describe('missing deployment chunk', () => {
  test.use({ serviceWorkers: 'block' })
  test('presents recovery and keeps the shell usable', async ({ page, request }) => {
    await productionLedger(page, request)
    await page.goto('/')
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible()
    await page.route('**/assets/Settings-*.js', route => route.fulfill({ status: 404, body: 'Missing deployment chunk' }))
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Settings', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Unable to open this page' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Reload app' })).toBeVisible()
    await page.getByRole('link', { name: 'Return home' }).click()
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Unable to open this page' })).toHaveCount(0)
  })
})
