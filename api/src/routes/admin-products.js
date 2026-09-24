/** Yönetici: ürün listeleme (gizliler dahil), güncelleme, oluşturma. */
import { Router } from 'express'
import { z } from 'zod'
import * as productsService from '../services/products.js'
import { requireAdmin } from '../auth.js'
import { parseBody, badRequest } from '../errors.js'

const router = Router()
router.use(requireAdmin)

/** Ürün id biçimi: `urun-NN` (bkz. services/products.js createProduct). */
const PRODUCT_ID_RE = /^urun-\d{2,4}$/

// İngilizce alanlar opsiyoneldir; null ya da boş metin EN değerini temizler (mağaza Türkçeye düşer).
// Uzunluk sınırları TR karşılıklarıyla / DB sütunlarıyla aynıdır (bkz. migrations/005_content_locale.sql).
const colorSchema = z.object({ id: z.string().min(1), label: z.string().min(1), labelEn: z.string().max(64).nullable().optional() })
// Stok matrisi: { [colorId]: { [size]: qty } } — qty 0..9999 tam sayı; negatif/ondalık/bilinmeyen beden → 400.
const stockSchema = z.record(
  z.string().min(1).max(32),
  z.record(z.enum(productsService.SIZES), z.number().int().min(0).max(productsService.MAX_STOCK_QTY)),
)
const newBadgeSchema = z.enum(productsService.NEW_BADGE_MODES)
const mediaSchema = z.record(z.enum(productsService.MEDIA_KINDS), z.string().min(1))

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  nameEn: z.string().max(200).nullable().optional(),
  price: z.number().min(0).optional(),
  category: z.enum(productsService.CATEGORIES).optional(),
  isNew: z.boolean().optional(),
  newBadge: newBadgeSchema.optional(),
  hidden: z.boolean().optional(),
  colors: z.array(colorSchema).min(1).optional(),
  stock: stockSchema.optional(),
  description: z.string().nullable().optional(),
  descriptionEn: z.string().nullable().optional(),
  fabricCare: z.string().nullable().optional(),
  fabricCareEn: z.string().nullable().optional(),
  deliveryReturns: z.string().nullable().optional(),
  similarProductIds: z.array(z.string()).optional(),
  completeLookProductIds: z.array(z.string()).optional(),
  media: mediaSchema.optional(),
})

const createSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  nameEn: z.string().max(200).nullable().optional(),
  category: z.enum(productsService.CATEGORIES),
  price: z.number().min(0),
  isNew: z.boolean().optional(),
  newBadge: newBadgeSchema.optional(),
  hidden: z.boolean().optional(),
  colors: z.array(colorSchema).optional(),
  stock: stockSchema.optional(),
  description: z.string().optional(),
  descriptionEn: z.string().nullable().optional(),
  fabricCare: z.string().optional(),
  fabricCareEn: z.string().nullable().optional(),
  deliveryReturns: z.string().optional(),
})

router.get('/', async (req, res, next) => {
  try {
    const products = await productsService.listProducts({ includeHidden: true })
    res.json({ products })
  } catch (err) {
    next(err)
  }
})

router.put('/:id', async (req, res, next) => {
  try {
    if (!PRODUCT_ID_RE.test(req.params.id)) throw badRequest('Geçersiz ürün id biçimi', 'validation_error')
    const patch = parseBody(updateSchema, req.body)
    const product = await productsService.updateProduct(req.params.id, patch)
    res.json({ product })
  } catch (err) {
    next(err)
  }
})

router.post('/', async (req, res, next) => {
  try {
    const data = parseBody(createSchema, req.body)
    const product = await productsService.createProduct(data)
    res.status(201).json({ product })
  } catch (err) {
    next(err)
  }
})

export default router
