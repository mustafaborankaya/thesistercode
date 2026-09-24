/** Sipariş oluşturma (herkese açık, isteğe bağlı üye oturumu) ve sipariş sorgulama. */
import { Router } from 'express'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import * as ordersService from '../services/orders.js'
import * as productsService from '../services/products.js'
import { parseBody, notFound } from '../errors.js'
import { optionalCustomer } from '../auth.js'

const router = Router()

/**
 * GET /:id kimlik doğrulaması gerektirmez (bkz. aşağıdaki not) ve sipariş id'si yalnızca
 * `TSV-YYYYMMDD-XXXX` biçiminde 4 haneli rastgele bir sondan oluşur — günde yalnızca 10.000
 * olası değer. Bu, hız sınırlaması OLMADAN kaba kuvvetle taranabilir (ad/telefon/e-posta/adres
 * sızıntısı riski). Bu limit riski AZALTIR ama TEK BAŞINA yeterli bir koruma DEĞİLDİR — bkz.
 * README "Bilinen sınırlar".
 */
const orderLookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'rate_limited', message: 'Çok fazla deneme yapıldı. Lütfen daha sonra tekrar deneyin.' } },
})

const orderSchema = z.object({
  contact: z.object({
    email: z.string().email('Geçerli bir e-posta girin'),
    phone: z.string().min(5, 'Geçerli bir telefon numarası girin').max(32),
  }),
  delivery: z.object({
    firstName: z.string().min(1, 'Ad gerekli').max(100),
    lastName: z.string().min(1, 'Soyad gerekli').max(100),
    address: z.string().min(1, 'Adres gerekli'),
    district: z.string().min(1, 'İlçe gerekli').max(100),
    city: z.string().min(1, 'Şehir gerekli').max(100),
    postalCode: z.string().min(1, 'Posta kodu gerekli').max(20),
    country: z.string().min(1).max(100).default('Türkiye'),
    note: z.string().max(1000).optional(),
  }),
  lines: z
    .array(
      z.object({
        productId: z.string().min(1),
        colorId: z.string().min(1),
        size: z.enum(productsService.SIZES),
        qty: z.number().int().positive().max(99),
      }),
    )
    .min(1, 'Sepet boş olamaz'),
})

router.post('/', optionalCustomer, async (req, res, next) => {
  try {
    const input = parseBody(orderSchema, req.body)
    const order = await ordersService.createOrder(input, req.customer ?? null)
    res.status(201).json({ order })
  } catch (err) {
    next(err)
  }
})

// Not: demo amaçlı — e-posta doğrulaması yapılmaz, yalnızca sipariş id'si ile erişilir.
router.get('/:id', orderLookupLimiter, async (req, res, next) => {
  try {
    const order = await ordersService.getOrderById(req.params.id)
    if (!order) return next(notFound('Sipariş bulunamadı'))
    res.json({ order })
  } catch (err) {
    next(err)
  }
})

export default router
