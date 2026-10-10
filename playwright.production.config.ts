import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/production',
  outputDir: 'test-results-production',
  workers: 1,
  timeout: 45_000,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? [['github'], ['list'], ['html', { open: 'never', outputFolder: 'playwright-report-production' }]] : 'list',
  use: { baseURL: 'http://127.0.0.1:4174', trace: 'retain-on-failure' },
  webServer: {
    command: 'VITE_SUPABASE_URL=http://127.0.0.1:4174/supabase VITE_SUPABASE_ANON_KEY=e2e-public-key node scripts/build-validation.mjs && node scripts/serve-validation.mjs',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: false,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'msedge', use: { ...devices['Desktop Edge'], channel: 'msedge' } },
  ],
})
