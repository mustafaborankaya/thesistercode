/** Yönetici: medya yükleme (dosya belleğe alınır, magic-byte doğrulaması sonrası diske yazılır). */
import { Router } from 'express'
import multer from 'multer'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { env } from '../env.js'
import { pool } from '../db.js'
import { requireAdmin } from '../auth.js'
import { badRequest } from '../errors.js'

const router = Router()

// Ürün görseli adları bu kalıba uymalı (bkz. src/data/media.ts): "urun-01-on", "urun-12-kumas" vb.
const PRODUCT_MEDIA_NAME_RE = /^urun-\d{2,4}-(on|arka|model|kumas)$/

/**
 * `name` alanı beyaz listesi: ya ürün görseli kalıbına uyar ya da `brand_media` tablosunda
 * TANIMLI (önceden bilinen) bir marka görseli adıdır. Bu, safeName() ile sadece "tehlikeli
 * karakterleri temizlemenin" ötesine geçer: rastgele/uydurma bir `name` ile diskte keyfi
 * (ama zararsız) dosya biriktirmeyi ve isim çakışması/karışıklığını önler.
 */
async function isAllowedUploadName(name) {
  if (PRODUCT_MEDIA_NAME_RE.test(name)) return true
  const [rows] = await pool.query('SELECT 1 FROM brand_media WHERE name = ? LIMIT 1', [name])
  return rows.length > 0
}

// NOT: SVG BİLİNÇLİ OLARAK DIŞLANMIŞTIR. SVG, <script>/olay işleyicisi/harici kaynak içerebilen bir
// XML formatıdır; img olarak gömülse bile bazı bağlamlarda (doğrudan sekmede açma, object/iframe,
// bazı eski tarayıcı content-sniffing davranışları) depolanmış XSS'e yol açabilir. Mağaza için SVG
// desteği gerekiyorsa yalnızca sunucu tarafında sanitize edilmiş (script/on*/foreignObject/harici
// referans temizlenmiş) bir SVG olarak, ayrı bir uç noktada yeniden değerlendirilmelidir.
const ALLOWED_MIME_EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
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
    .slice(0, 80)
  return cleaned || 'dosya'
}

/**
 * Dosyanın GERÇEK türünü baytlardan (magic number/signature) tespit eder. İstemcinin gönderdiği
 * `Content-Type`/multer `mimetype` alanına GÜVENİLMEZ (tarayıcı/araç tarafından kolayca sahtelenir);
 * yalnızca burada tespit edilen tür, uzantı ve depolama kararı için kullanılır.
 */
function detectRealMimeType(buf) {
  if (!buf || buf.length < 12) return null

  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'

  if (
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) {
    return 'image/png'
  }

  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp'
  }

  // ISO base media container (MP4/AVIF/HEIF ailesi) — 4-8 baytları arasında 'ftyp' kutusu taşır;
  // içindeki "major brand" alanı (8-12) türü ayırt eder.
  if (buf.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buf.toString('ascii', 8, 12)
    if (['avif', 'avis', 'mif1', 'msf1', 'heic', 'heif'].includes(brand)) return 'image/avif'
    return 'video/mp4'
  }

  // EBML header — WebM/Matroska.
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) {
    return 'video/webm'
  }

  return null
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB, tek dosya (upload.single)
})

// NOT: bellek depolamasında (memoryStorage) multer, `next()`/route handler'ı ÇAĞIRMADAN ÖNCE tüm
// multipart gövdeyi (tüm metin alanları + dosya) tamamen tüketir; bu yüzden `name` alanının
// `file` alanından önce/sonra gönderilmesi ARTIK ÖNEMLİ DEĞİLDİR (eski diskStorage akış sırası
// kısıtlaması burada geçerli değil).
router.post('/upload', requireAdmin, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return next(badRequest('Dosya bulunamadı', 'file_required'))

    const realType = detectRealMimeType(req.file.buffer)
    const ext = realType ? ALLOWED_MIME_EXT[realType] : undefined
    if (!ext) {
      return next(
        badRequest(
          'Desteklenmeyen veya bozuk/sahte dosya. İzin verilenler: jpg, png, webp, avif, mp4, webm',
          'unsupported_media_type',
        ),
      )
    }

    const name = safeName(req.body?.name)
    if (!(await isAllowedUploadName(name))) {
      return next(
        badRequest(
          "Geçersiz dosya adı. İzin verilenler: \"urun-NN-(on|arka|model|kumas)\" veya tanımlı marka görseli adları",
          'invalid_name',
        ),
      )
    }

    const filename = `${name}-${Date.now()}.${ext}`
    // `filename` yalnızca [a-z0-9-] + sabit bir uzantıdan oluşur (safeName + ALLOWED_MIME_EXT
    // beyaz listesi) — path traversal (../, mutlak yol, gizli uzantı) imkânsızdır.
    const destPath = path.join(env.UPLOAD_DIR, filename)

    await fsp.mkdir(env.UPLOAD_DIR, { recursive: true })
    // 'wx': hedef dosya zaten varsa (ör. aynı milisaniyede yarışan iki istek) sessizce üzerine
    // YAZMAZ, hata fırlatır — üzerine yazma politikası açıkça "asla" olarak uygulanır.
    await fsp.writeFile(destPath, req.file.buffer, { flag: 'wx' })

    res.json({ name, url: `${env.UPLOAD_PUBLIC_BASE}/${filename}` })
  } catch (err) {
    next(err)
  }
})

export default router
