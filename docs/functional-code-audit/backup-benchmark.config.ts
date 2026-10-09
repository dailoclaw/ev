import { defineConfig } from '@playwright/test'
import base from '../../playwright.config'
export default defineConfig({ ...base, testDir: '.', testMatch: 'backup-scale.spec.ts', workers: 1 })
