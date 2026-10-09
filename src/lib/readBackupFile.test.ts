import { expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from './appModel'
import { readBackupFile } from './readBackupFile'
it('rejects oversized files before reading and surfaces read failures', async () => {
  let read = false
  await expect(readBackupFile({ size: 15_000_001, text: async () => { read = true; return '' } })).rejects.toThrow('15 MB')
  expect(read).toBe(false)
  await expect(readBackupFile({ size: 1, text: async () => { throw new Error('File unavailable') } })).rejects.toThrow('File unavailable')
})
it('reports progress and returns a validated empty backup', async () => {
  const progress: string[] = []
  const text = JSON.stringify({ version: 2, settings: DEFAULT_SETTINGS, providers: [], sessions: [], vehiclePhotoDataUrl: null })
  const backup = await readBackupFile({ size: text.length, text: async () => text }, message => progress.push(message))
  expect(backup.version).toBe(2)
  expect(progress).toEqual(['Reading and validating backup…', 'Checking vehicle photo…', 'Preparing restore preview…'])
})
