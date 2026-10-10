import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  testMatch: 'backup-scale.spec.ts',
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:4173' },
  webServer: {
    cwd: new URL('../../', import.meta.url).pathname,
    command: 'VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_ANON_KEY=e2e-public-key npm run dev -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
})
