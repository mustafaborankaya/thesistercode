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
// Yuva değeri null → o yuvanın görseli kaldırılır (product_media satırı silinir, kullanılmayan dosya uploads'tan silinir).
const mediaSchema = z.record(
  z.enum(productsService.MEDIA_KINDS, { errorMap: () => ({ message: 'Geçersiz görsel yuvası' }) }),
  z.string().min(1, 'Görsel adresi boş olamaz').max(500, 'Görsel adresi çok uzun').nullable(),
)
/** Fiyat: ≥ 0, ≤ 99.999.999,99 (DECIMAL(10,2)), en fazla 2 ondalık. */
const priceSchema = z
  .number({ invalid_type_error: 'Fiyat sayı olmalı', required_error: 'Fiyat gerekli' })
  .min(0, 'Fiyat negatif olamaz')
  .max(99_999_999.99, 'Fiyat çok büyük (en fazla 99.999.999,99)')
  .refine((n) => Math.abs(Math.round(n * 100) - n * 100) < 1e-6, 'Fiyat en fazla 2 ondalık basamak içerebilir')

const updateSchema = z.object({
  name: z.string().min(1, 'Ürün adı boş olamaz').max(200, 'Ürün adı en fazla 200 karakter olabilir').optional(),
  nameEn: z.string().max(200, 'İngilizce ad en fazla 200 karakter olabilir').nullable().optional(),
  price: priceSchema.optional(),
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
  /** İyimser kilit: istemcinin son gördüğü updatedAt; DB'dekinden farklıysa 409 conflict { details:{ updatedAt } }. */
  expectedUpdatedAt: z.string().max(40).nullable().optional(),
})

const createSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  nameEn: z.string().max(200).nullable().optional(),
  category: z.enum(productsService.CATEGORIES, { errorMap: () => ({ message: 'Geçerli bir kategori seçin' }) }),
  price: priceSchema,
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
