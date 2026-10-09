import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { removeVehiclePhoto, uploadVehiclePhoto } from './data'

function compressImage(file: File, maxWidth = 960, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        try {
          const scale = Math.min(1, maxWidth / img.width, maxWidth / img.height)
          const canvas = document.createElement('canvas')
          canvas.width = Math.max(1, Math.round(img.width * scale))
          canvas.height = Math.max(1, Math.round(img.height * scale))
          const ctx = canvas.getContext('2d')
          if (!ctx) return reject(new Error('Canvas unavailable'))
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          resolve(canvas.toDataURL('image/jpeg', quality))
        } catch (error) { reject(error) }
      }
      img.onerror = () => reject(new Error('Could not read that image'))
      img.src = reader.result as string
    }
    reader.onerror = () => reject(new Error('Could not read that file'))
    reader.onabort = () => reject(new Error('Photo reading was cancelled'))
    reader.readAsDataURL(file)
  })
}

export function useVehiclePhoto() {
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [photoRetry, setPhotoRetry] = useState<string | null>(null)
  const [photoSaving, setPhotoSaving] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const busy = useRef(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const begin = () => {
    if (busy.current || !mounted.current) return false
    busy.current = true; setPhotoSaving(true); setPhotoError(null); setPhotoRetry(null)
    return true
  }
  const finish = () => { busy.current = false; if (mounted.current) setPhotoSaving(false) }
  const fail = (error: unknown, retry: string | null) => {
    if (!mounted.current) return
    setPhotoRetry(retry)
    setPhotoError(error instanceof Error ? error.message : 'Could not save that photo. Please retry.')
  }
  const savePhoto = async (dataUrl: string) => {
    if (!begin()) return
    try { await uploadVehiclePhoto(dataUrl) } catch (error) { fail(error, dataUrl) }
    finally { finish() }
  }
  const onPhotoChosen = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = ''
    if (!file || !begin()) return
    let compressed: string | null = null
    try {
      compressed = await compressImage(file)
      if (mounted.current) await uploadVehiclePhoto(compressed)
    } catch (error) { fail(error, compressed) }
    finally { finish() }
  }
  const removePhoto = async () => {
    if (!begin()) return
    try { await removeVehiclePhoto() } catch (error) { fail(error, null) }
    finally { finish() }
  }
  return { photoError, photoRetry, photoSaving, photoInputRef, savePhoto, onPhotoChosen, removePhoto }
}
