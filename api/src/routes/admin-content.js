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
    const [fields, brandMedia] = await Promise.all([contentService.getFields(), contentService.getBrandMedia()])
    res.json({ fields, brandMedia })
  } catch (err) {
    next(err)
  }
})

router.put('/content', async (req, res, next) => {
  try {
    const patch = parseBody(fieldsSchema, req.body)
    const fields = await contentService.updateFields(patch)
    res.json({ fields })
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
