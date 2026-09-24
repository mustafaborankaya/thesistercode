/** Yönetici: içerik alanları (content_fields) ve marka görselleri (brand_media). */
import { Router } from 'express'
import { z } from 'zod'
import * as contentService from '../services/content.js'
import { requireAdmin } from '../auth.js'
import { parseBody } from '../errors.js'

const router = Router()
router.use(requireAdmin)

const fieldsSchema = z.record(z.string().min(1).max(120), z.string().nullable())
const brandMediaSchema = z.record(z.string().min(1).max(64), z.string().nullable())

router.get('/content', async (req, res, next) => {
  try {
    const [fields, fieldsEn, brandMedia] = await Promise.all([
      contentService.getFields(),
      contentService.getFieldsEn(),
      contentService.getBrandMedia(),
    ])
    res.json({ fields, fieldsEn, brandMedia })
  } catch (err) {
    next(err)
  }
})

/**
 * Gövde geriye uyumludur: düz `anahtar → metin|null` sözlüğü TR değerleridir (eski istemciler
 * aynen çalışır). İsteğe bağlı `fieldsEn` anahtarı (aynı biçimde sözlük) İngilizce değerleri yazar;
 * null ya da boş metin EN değerini temizler. `fieldsEn` bir içerik anahtarı olarak yorumlanmaz.
 */
router.put('/content', async (req, res, next) => {
  try {
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {}
    const { fieldsEn: rawEn, ...rawTr } = body
    const patch = parseBody(fieldsSchema, rawTr)
    const patchEn = rawEn === undefined ? {} : parseBody(fieldsSchema, rawEn)
    const { fields, fieldsEn } = await contentService.updateFields(patch, patchEn)
    res.json({ fields, fieldsEn })
  } catch (err) {
    next(err)
  }
})

router.put('/brand-media', async (req, res, next) => {
  try {
    const patch = parseBody(brandMediaSchema, req.body)
    const brandMedia = await contentService.updateBrandMedia(patch)
    res.json({ brandMedia })
  } catch (err) {
    next(err)
  }
})

export default router
