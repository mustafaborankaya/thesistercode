/** Herkese açık uç noktalar: ürün katalogu, içerik alanları, site ayarları. */
import { Router } from 'express'
import * as productsService from '../services/products.js'
import * as contentService from '../services/content.js'
import * as settingsService from '../services/settings.js'
import { notFound } from '../errors.js'
import { ADMIN_COOKIE } from '../auth.js'
import jwt from 'jsonwebtoken'
import { env } from '../env.js'

const router = Router()

/** includeHidden=1 yalnızca geçerli bir yönetici oturumu varsa etkilidir; aksi halde sessizce yok sayılır. */
function hasAdminSession(req) {
  const token = req.cookies?.[ADMIN_COOKIE]
  if (!token) return false
  try {
    const payload = jwt.verify(token, env.SESSION_SECRET)
    return payload.type === 'admin'
  } catch {
    return false
  }
}

router.get('/products', async (req, res, next) => {
  try {
    const category = typeof req.query.category === 'string' ? req.query.category : undefined
    const includeHidden = req.query.includeHidden === '1' && hasAdminSession(req)
    const products = await productsService.listProducts({ category, includeHidden })
    res.json({ products })
  } catch (err) {
    next(err)
  }
})

router.get('/products/:slug', async (req, res, next) => {
  try {
    const includeHidden = hasAdminSession(req)
    const product = await productsService.getProductBySlug(req.params.slug, { includeHidden })
    if (!product) return next(notFound('Ürün bulunamadı'))
    res.json({ product })
  } catch (err) {
    next(err)
  }
})

router.get('/content', async (req, res, next) => {
  try {
    const [fields, brandMedia] = await Promise.all([contentService.getFields(), contentService.getBrandMedia()])
    res.json({ fields, brandMedia })
  } catch (err) {
    next(err)
  }
})

router.get('/settings', async (req, res, next) => {
  try {
    const settings = await settingsService.getSettings()
    res.json({ settings })
  } catch (err) {
    next(err)
  }
})

export default router
