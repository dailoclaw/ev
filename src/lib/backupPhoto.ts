export const MAX_PHOTO_BYTES = 5_000_000
const withinDimensions = (width: number, height: number) => width > 0 && height > 0 && width <= 8192 && height <= 8192 && width * height <= 16_000_000
const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  return value >>> 0
})
function crc(bytes: Uint8Array, start: number, end: number) {
  let value = 0xffffffff
  for (let index = start; index < end; index++) value = crcTable[(value ^ bytes[index]) & 255] ^ (value >>> 8)
  return (value ^ 0xffffffff) >>> 0
}
const PHOTO_PREFIX = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]*={0,2})$/

/** Reject non-images, MIME mismatches, malformed base64 and truncated containers. */
export function validateBackupPhoto(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > Math.ceil(MAX_PHOTO_BYTES / 3) * 4 + 40) return 'Photo must be a PNG, JPEG or WebP image under 5 MB.'
  const match = PHOTO_PREFIX.exec(value)
  if (!match || !match[2].length || match[2].length % 4 !== 0) return 'Photo must use valid base64 PNG, JPEG or WebP data.'
  let decoded: string
  try { decoded = atob(match[2]) } catch { return 'Photo contains invalid base64 data.' }
  if (decoded.length > MAX_PHOTO_BYTES || btoa(decoded) !== match[2]) return 'Photo data is oversized or incorrectly encoded.'
  const bytes = Uint8Array.from(decoded, char => char.charCodeAt(0))
  const view = new DataView(bytes.buffer)
  if (match[1] === 'png') {
    if (bytes.length < 45 || ![137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte)) return 'PNG signature is invalid.'
    let offset = 8; let header = false; let image = false
    while (offset + 12 <= bytes.length) {
      const length = view.getUint32(offset)
      if (offset + length + 12 > bytes.length) return 'PNG is truncated.'
      if (crc(bytes, offset + 4, offset + 8 + length) !== view.getUint32(offset + 8 + length)) return 'PNG checksum is invalid.'
      const type = decoded.slice(offset + 4, offset + 8)
      if (!header && (type !== 'IHDR' || length !== 13)) return 'PNG header is invalid.'
      if (type === 'IHDR') {
        if (header || !withinDimensions(view.getUint32(offset + 8), view.getUint32(offset + 12))) return 'PNG dimensions are invalid.'
        header = true
      }
      if (type === 'IDAT' && length > 0) image = true
      offset += length + 12
      if (type === 'IEND') return header && image && length === 0 && offset === bytes.length ? null : 'PNG ending is invalid.'
    }
    return 'PNG is missing its ending.'
  }
  if (match[1] === 'jpeg') {
    if (bytes.length < 4 || bytes[0] !== 255 || bytes[1] !== 216 || bytes[bytes.length - 2] !== 255 || bytes[bytes.length - 1] !== 217) return 'JPEG signature or ending is invalid.'
    let offset = 2; let frame = false
    while (offset < bytes.length - 2) {
      if (bytes[offset++] !== 255) return 'JPEG marker is invalid.'
      while (bytes[offset] === 255) offset++
      const marker = bytes[offset++]
      if (marker === 1) continue
      if (offset + 2 > bytes.length - 2) return 'JPEG is truncated.'
      const length = view.getUint16(offset)
      if (length < 2 || offset + length > bytes.length - 2) return 'JPEG segment is invalid.'
      if (marker >= 192 && marker <= 207 && ![196, 200, 204].includes(marker)) {
        if (length < 8 || !withinDimensions(view.getUint16(offset + 5), view.getUint16(offset + 3))) return 'JPEG dimensions are invalid or too large.'
        frame = true
      }
      if (marker === 218) return frame ? null : 'JPEG has no image frame.'
      offset += length
    }
    return 'JPEG has no image data.'
  }
  if (bytes.length < 20 || decoded.slice(0, 4) !== 'RIFF' || decoded.slice(8, 12) !== 'WEBP' || view.getUint32(4, true) + 8 !== bytes.length) return 'WebP signature or length is invalid.'
  let offset = 12; let image = false
  while (offset + 8 <= bytes.length) {
    const type = decoded.slice(offset, offset + 4); const length = view.getUint32(offset + 4, true)
    const data = offset + 8
    if (data + length + (length % 2) > bytes.length) return 'WebP is truncated.'
    if (type === 'VP8X') {
      if (length !== 10 || !withinDimensions((view.getUint32(data + 4, true) & 0xffffff) + 1, (bytes[data + 7] | bytes[data + 8] << 8 | bytes[data + 9] << 16) + 1)) return 'WebP dimensions are invalid or too large.'
    }
    if (type === 'VP8 ') {
      if (length < 10 || decoded.slice(data + 3, data + 6) !== '\x9d\x01\x2a' || !withinDimensions(view.getUint16(data + 6, true) & 0x3fff, view.getUint16(data + 8, true) & 0x3fff)) return 'WebP frame is invalid.'
      image = true
    }
    if (type === 'VP8L') {
      if (length < 5 || bytes[data] !== 47) return 'WebP lossless frame is invalid.'
      const dimensions = view.getUint32(data + 1, true)
      if (!withinDimensions((dimensions & 0x3fff) + 1, ((dimensions >>> 14) & 0x3fff) + 1)) return 'WebP dimensions are too large.'
      image = true
    }
    if (type === 'ANIM' || type === 'ANMF') return 'Use a still image for the vehicle photo.'
    offset = data + length + (length % 2)
  }
  return image && offset === bytes.length ? null : 'WebP has no complete image data.'

}

/** Browser decoding also rejects corrupt pixels and oversized image dimensions. */
export async function verifyBackupPhoto(value: string | null): Promise<void> {
  if (value === null) return
  const error = validateBackupPhoto(value)
  if (error) throw new Error(error)
  if (typeof createImageBitmap === 'function') {
    const blob = new Blob([Uint8Array.from(atob(value.slice(value.indexOf(',') + 1)), char => char.charCodeAt(0))], { type: value.slice(5, value.indexOf(';')) })
    const image = await createImageBitmap(blob)
    try { if (!withinDimensions(image.width, image.height)) throw new Error('Photo dimensions are too large. Resize the image and try again.') }
    finally { image.close() }
  } else if (typeof Image !== 'undefined') {
    await new Promise<void>((resolve, reject) => {
      const image = new Image()
      image.onload = () => !withinDimensions(image.width, image.height)
        ? reject(new Error('Photo dimensions are too large. Resize the image and try again.')) : resolve()
      image.onerror = () => reject(new Error('Photo could not be decoded. Use a valid PNG, JPEG or WebP image.'))
      image.src = value
    })
  }
}
