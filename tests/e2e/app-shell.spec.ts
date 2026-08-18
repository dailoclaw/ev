import { expect, test } from '@playwright/test'

test('boots the owner authentication gate', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  await expect(page.getByLabel('Owner email')).toBeEditable()
  await expect(page.getByRole('button', { name: 'Email me a sign-in link' })).toBeEnabled()
  await expect(page).toHaveTitle('EV Command')
})
