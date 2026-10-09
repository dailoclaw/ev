import { test } from '@playwright/test'
import { writeFileSync } from 'node:fs'
test('measure backup scale in a real browser', async ({ page }, testInfo) => {
  test.setTimeout(120000)
  await page.goto('/')
  const results = await page.evaluate(async () => {
    const readerPath = '/src/lib/readBackupFile.ts', dataPath = '/src/lib/data.ts', cachePath = '/src/lib/cache.ts', modelPath = '/src/lib/appModel.ts'
    const reader = await import(/* @vite-ignore */ readerPath)
    const data = await import(/* @vite-ignore */ dataPath)
    const cache = await import(/* @vite-ignore */ cachePath)
    const model = await import(/* @vite-ignore */ modelPath)
    localStorage.setItem('ev.supabaseCanonicalMigrated.v2', 'done')
    const results = []
    for (const count of [1000, 10000, 25000, 25001]) {
      const provider = { id: '11111111-1111-4111-8111-111111111111', name: 'P', color: '#123456', freeKwhPerDay: 0 }
      const file = new File([JSON.stringify({ version: 2, exportedAt: '', settings: model.DEFAULT_SETTINGS, providers: [provider], sessions: Array.from({ length: count }, (_, id) => ({ id: `s${id}`, date: '2026-01-01', type: 'P', amount: 1, cost: 0, notes: null })), vehiclePhotoDataUrl: null })], 'backup.json')
      const start = performance.now()
      let backup
      try { backup = await reader.readBackupFile(file) } catch (reason) {
        results.push({ count, inputBytes: file.size, readWorkerMs: Math.round(performance.now() - start), previewMs: 0, restoreRealIdbMs: 0, accepted: false, error: String(reason) })
        continue
      }
      const read = performance.now()
      Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
      await cache.commitCachedState({ ownerId: 'benchmark', settings: model.DEFAULT_SETTINGS, providers: [], sessions: [], vehiclePhotoDataUrl: null, cachedAt: '' })
      await data.initializeData('benchmark')
      const previewStart = performance.now()
      let accepted = true, error = ''
      try { data.previewRestore(backup) } catch (reason) { accepted = false; error = String(reason) }
      const previewEnd = performance.now()
      if (accepted) await data.restoreMerge(backup)
      const saved = performance.now()
      results.push({ count, inputBytes: file.size, readWorkerMs: Math.round(read - start), previewMs: Math.round(previewEnd - previewStart), restoreRealIdbMs: Math.round(saved - previewEnd), accepted, error })
      data.stopDataSync()
      await cache.clearOfflineCache()
      delete (navigator as unknown as { onLine?: boolean }).onLine
    }
    return results
  })
  writeFileSync(`/tmp/ev-backup-${testInfo.project.name}.json`, JSON.stringify(results, null, 2))
})
