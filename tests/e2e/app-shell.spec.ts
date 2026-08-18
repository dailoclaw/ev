import { expect, test } from '@playwright/test'

test('boots the owner authentication gate', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  await expect(page.getByLabel('Owner email')).toBeEditable()
  await expect(page.getByLabel('Owner password')).toBeEditable()
  await page.getByLabel('Owner email').fill('owner@example.com')
  await page.getByLabel('Owner password').fill('password-manager-value')
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Use a magic link instead' })).toBeEnabled()
  await expect(page).toHaveTitle('EV Command')
})
