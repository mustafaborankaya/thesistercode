/** Yönetici: medya yükleme (multer disk storage → UPLOAD_DIR). */
import { Router } from 'express'
import multer from 'multer'
import fs from 'node:fs'
import { env } from '../env.js'
import { requireAdmin } from '../auth.js'
import { badRequest } from '../errors.js'

const router = Router()

const ALLOWED_MIME_EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
}

/** "urun-01-on", "acilis-masaustu" gibi güvenli dosya adı tabanı üretir. */
function safeName(name) {
  const cleaned = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return cleaned || 'dosya'
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      fs.mkdirSync(env.UPLOAD_DIR, { recursive: true })
      cb(null, env.UPLOAD_DIR)
    } catch (err) {
      cb(err)
    }
  },
  filename: (req, file, cb) => {
    const ext = ALLOWED_MIME_EXT[file.mimetype]
    const base = safeName(req.body?.name)
    cb(null, `${base}-${Date.now()}.${ext}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_EXT[file.mimetype]) {
      return cb(badRequest('Desteklenmeyen dosya türü. İzin verilenler: jpg, png, webp, avif, svg, mp4, webm', 'unsupported_media_type'))
    }
    cb(null, true)
  },
})

// NOT: multipart form alanında `name` metin alanı, `file` alanından ÖNCE gönderilmelidir —
// multer alanları akış sırasına göre işler ve dosya adı üretimi `name` alanına ihtiyaç duyar.
router.post('/upload', requireAdmin, upload.single('file'), (req, res, next) => {
  if (!req.file) return next(badRequest('Dosya bulunamadı', 'file_required'))
  const name = safeName(req.body?.name)
  res.json({ name, url: `${env.UPLOAD_PUBLIC_BASE}/${req.file.filename}` })
})

export default router
