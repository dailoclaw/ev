import { expect, test } from '@playwright/test'
import { writeFileSync } from 'node:fs'
for (const mode of ['worker', 'offline'] as const) test(`measure ${mode} backup scale in a real browser`, async ({ page, context, browserName }, testInfo) => {
  test.setTimeout(300000)
  const cpuRate = Number(process.env.EV_BENCHMARK_CPU_RATE ?? 1)
  expect(Number.isFinite(cpuRate) && cpuRate >= 1 && cpuRate <= 20).toBe(true)
  if (cpuRate > 1) {
    expect(browserName, 'CPU throttling requires a Chromium project').toBe('chromium')
    const cdp = await context.newCDPSession(page)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuRate })
  }
  await page.goto('/')
  const results = await page.evaluate(async ({ mode }) => {
    const readerPath = '/src/lib/readBackupFile.ts', dataPath = '/src/lib/data.ts', cachePath = '/src/lib/cache.ts', modelPath = '/src/lib/appModel.ts'
    const reader = await import(/* @vite-ignore */ readerPath)
    const data = await import(/* @vite-ignore */ dataPath)
    const cache = await import(/* @vite-ignore */ cachePath)
    const model = await import(/* @vite-ignore */ modelPath)
    localStorage.setItem('ev.supabaseCanonicalMigrated.v2', 'done')
    const results = []
    for (const { count, noteLength } of [{ count: 1000, noteLength: 0 }, { count: 10000, noteLength: 0 }, { count: 25000, noteLength: 0 }, { count: 25000, noteLength: 320 }, { count: 25001, noteLength: 0 }]) {
      Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
      await cache.commitCachedState({ ownerId: 'benchmark', settings: model.DEFAULT_SETTINGS, providers: [], sessions: [], vehiclePhotoDataUrl: null, cachedAt: '' })
      await data.initializeData('benchmark')
      const provider = { id: '11111111-1111-4111-8111-111111111111', name: 'P', color: '#123456', freeKwhPerDay: 0 }
      const file = new File([JSON.stringify({ version: 2, exportedAt: '', settings: model.DEFAULT_SETTINGS, providers: [provider], sessions: Array.from({ length: count }, (_, id) => ({ id: `22222222-2222-4222-8222-${id.toString(16).padStart(12, '0')}`, date: '2026-01-01', type: 'P', amount: 1, cost: 0, notes: noteLength ? 'x'.repeat(noteLength) : null })), vehiclePhotoDataUrl: null })], 'backup.json')
      let maximumTimerDelayMs = 0, previous = performance.now()
      const heartbeat = setInterval(() => {
        const current = performance.now()
        maximumTimerDelayMs = Math.max(maximumTimerDelayMs, current - previous - 20)
        previous = current
      }, 20)
      Object.defineProperty(navigator, 'onLine', { configurable: true, value: mode === 'worker' })
      const start = performance.now()
      let backup
      try { backup = await reader.readBackupFile(file) } catch (reason) {
        clearInterval(heartbeat)
        const snapshot = await cache.loadCachedSnapshot()
        results.push({ count, noteLength, inputBytes: file.size, readWorkerMs: Math.round(performance.now() - start), previewMs: 0, restoreRealIdbMs: 0, maximumTimerDelayMs, savedCount: snapshot?.sessions.length ?? 0, pendingCount: (await cache.listOutbox('benchmark')).length, reloadedCount: data.getState().sessions.length, accepted: false, error: String(reason) })
        data.stopDataSync()
        await cache.clearOfflineCache()
        delete (navigator as unknown as { onLine?: boolean }).onLine
        continue
      }
      const read = performance.now()
      Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
      const previewStart = performance.now()
      let accepted = true, error = ''
      try { data.previewRestore(backup) } catch (reason) { accepted = false; error = String(reason) }
      const previewEnd = performance.now()
      if (accepted) await data.restoreMerge(backup)
      const saved = performance.now()
      await new Promise(resolve => setTimeout(resolve, 25))
      clearInterval(heartbeat)
      const snapshot = await cache.loadCachedSnapshot()
      const pendingCount = (await cache.listOutbox('benchmark')).length
      data.stopDataSync()
      await data.initializeData('benchmark')
      results.push({ count, noteLength, inputBytes: file.size, readWorkerMs: Math.round(read - start), previewMs: Math.round(previewEnd - previewStart), restoreRealIdbMs: Math.round(saved - previewEnd), maximumTimerDelayMs: Math.round(maximumTimerDelayMs), savedCount: snapshot?.sessions.length ?? 0, pendingCount, reloadedCount: data.getState().sessions.length, accepted, error })
      data.stopDataSync()
      await cache.clearOfflineCache()
      delete (navigator as unknown as { onLine?: boolean }).onLine
    }
    return results
  }, { mode })
  writeFileSync(`/tmp/ev-backup-${testInfo.project.name}-${mode}-${cpuRate}x.json`, JSON.stringify({ cpuRate, mode, results }, null, 2))
  for (const result of results) {
    const accepted = result.count <= 25000
    expect(result.accepted, result.error).toBe(accepted)
    expect(result.savedCount).toBe(accepted ? result.count : 0)
    expect(result.reloadedCount).toBe(accepted ? result.count : 0)
    expect(result.pendingCount).toBe(accepted ? result.count + 2 : 0)
  }
})
