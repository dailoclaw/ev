import type { APIRequestContext, Page } from '@playwright/test'

export async function productionLedger(page: Page, request: APIRequestContext) {
  await request.post('/__validation__/backend/reset')
  await page.addInitScript(() => {
    const owner = '11111111-1111-4111-8111-111111111111'
    localStorage.setItem('ev.supabaseCanonicalMigrated.v2', 'done')
    localStorage.setItem('sb-127-auth-token', JSON.stringify({ access_token: 'test-access-token', refresh_token: 'test-refresh-token',
      expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer',
      user: { id: owner, aud: 'authenticated', role: 'authenticated', email: 'owner@example.com', app_metadata: {}, user_metadata: {} } }))
  })
  return { fail: async (enabled: boolean) => { await request.post(`/__validation__/backend/fail?enabled=${enabled}`) } }
}
