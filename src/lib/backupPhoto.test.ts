import { afterEach, expect, it, vi } from 'vitest'
import { validateBackupPhoto, verifyBackupPhoto } from './backupPhoto'
import { TEST_PHOTO } from './testPhotoFixtures'
afterEach(() => vi.unstubAllGlobals())
it('accepts a complete PNG and rejects corrupt checksums', () => {
  expect(validateBackupPhoto(TEST_PHOTO)).toBeNull()
  const bytes = Uint8Array.from(atob(TEST_PHOTO.split(',')[1]), char => char.charCodeAt(0)); bytes[45] ^= 1
  expect(validateBackupPhoto(`data:image/png;base64,${btoa(String.fromCharCode(...bytes))}`)).toContain('checksum')
})
it.each(['data:image/svg+xml;base64,PHN2Zz4=', 'data:text/html;base64,PHNjcmlwdD4=', 'data:image/png;base64,abc', 'data:image/png;base64,!!!!', 'data:image/jpeg;base64,/9j/2Q==', 'data:image/webp;base64,UkZGRg=='])('rejects malformed or unsupported photo %s', photo => expect(validateBackupPhoto(photo)).not.toBeNull())
it('rejects corrupt pixels through the browser decoder and releases successful bitmaps', async () => {
  vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValueOnce(new Error('Corrupt pixels')))
  await expect(verifyBackupPhoto(TEST_PHOTO)).rejects.toThrow('Corrupt pixels')
  const close = vi.fn()
  vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 1, height: 1, close }))
  await verifyBackupPhoto(TEST_PHOTO)
  expect(close).toHaveBeenCalledOnce()
})
it('rejects oversized decoded images and still releases them', async () => {
  const close = vi.fn()
  vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 9000, height: 1, close }))
  await expect(verifyBackupPhoto(TEST_PHOTO)).rejects.toThrow('dimensions')
  expect(close).toHaveBeenCalledOnce()
})
