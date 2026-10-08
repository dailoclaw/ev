import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { include: ['docs/functional-code-audit/reproductions.test.ts'] } })
