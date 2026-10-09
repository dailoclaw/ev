import { BACKUP_LIMITS, parseBackupOrThrow, type Backup } from './backup'
import { verifyBackupPhoto } from './backupPhoto'

async function readText(file: Pick<File, 'size' | 'text'>): Promise<string> {
  try { return await file.text() } catch (error) {
    if (typeof FileReader === 'undefined' || !(file instanceof Blob)) throw error
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error ?? error)
      reader.onabort = () => reject(new Error('Backup file reading was cancelled.'))
      reader.readAsText(file)
    })
  }
}

export async function readBackupFile(file: Pick<File, 'size' | 'text'>, onProgress: (message: string) => void = () => {}): Promise<Backup> {
  if (file.size > BACKUP_LIMITS.bytes) throw new Error('Backup must be under 15 MB.')
  onProgress('Reading and validating backup…')
  let backup: Backup
  if (typeof Worker !== 'undefined' && file instanceof File && (typeof navigator === 'undefined' || navigator.onLine)) {
    backup = await new Promise<Backup>((resolve, reject) => {
      const worker = new Worker(new URL('./backupWorker.ts', import.meta.url), { type: 'module' })
      worker.onmessage = (event: MessageEvent<{ backup?: Backup; error?: string }>) => {
        worker.terminate()
        if (event.data.backup) resolve(event.data.backup)
        else reject(new Error(event.data.error ?? 'Could not validate backup.'))
      }
      worker.onerror = () => {
        worker.terminate()
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          onProgress('Validating backup offline…')
          readText(file).then(text => resolve(parseBackupOrThrow(text))).catch(reject)
        } else reject(new Error('Could not validate backup. Reload the app and retry.'))
      }
      try { worker.postMessage(file) } catch (error) { worker.terminate(); reject(error) }
    })
  } else backup = parseBackupOrThrow(await readText(file))
  onProgress('Checking vehicle photo…')
  await verifyBackupPhoto(backup.vehiclePhotoDataUrl)
  onProgress('Preparing restore preview…')
  return backup
}
