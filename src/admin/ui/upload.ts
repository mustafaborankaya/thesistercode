import { AS } from '../adminStrings'

/** Sunucu sınırıyla aynı (api/src/routes/admin-upload.js → 15 MB). */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
export const VIDEO_TYPES = ['video/mp4', 'video/webm']

/** İstemci ön kontrolü: tür ve boyut. Geçerliyse null, değilse Türkçe hata. SVG sunucuda reddedilir. */
export function validateUpload(file: File, kind: 'image' | 'video'): string | null {
  const allowed = kind === 'video' ? VIDEO_TYPES : IMAGE_TYPES
  if (!allowed.includes(file.type)) return kind === 'video' ? AS.media.typeVideo : AS.media.typeImage
  if (file.size > MAX_UPLOAD_BYTES) return AS.media.tooLarge(Math.round((file.size / 1024 / 1024) * 10) / 10)
  return null
}
