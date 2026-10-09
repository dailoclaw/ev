import { BACKUP_LIMITS, parseBackupOrThrow } from './backup'
self.onmessage = async (event: MessageEvent<File>) => {
  try {
    if (event.data.size > BACKUP_LIMITS.bytes) throw new Error('Backup must be under 15 MB.')
    const backup = parseBackupOrThrow(await event.data.text())
    self.postMessage({ backup })
  } catch (error) { self.postMessage({ error: error instanceof Error ? error.message : 'Could not read backup file.' }) }
}
