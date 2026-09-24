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
 * GET /:id sipariş id'si tek başına yeterli DEĞİLDİR (yalnızca `TSV-YYYYMMDD-XXXX` biçiminde 4
 * haneli rastgele bir sondan oluşur — günde yalnızca 10.000 olası değer, kaba kuvvetle taranabilir).
 * Bu yüzden erişim (a) siparişi oluşturan müşterinin oturumuna veya (b) sipariş oluşturulurken
 * üretilen tek seferlik gizli `accessToken`'a (32 byte rastgele, DB'de yalnızca hash'i saklanır)
 * bağlıdır — bkz. services/orders.js `getOrderByIdForAccess`. Rate limit, kaba kuvvet denemelerine
 * karşı ek bir savunma katmanıdır (savunma derinliği), tek başına koruma mekanizması değildir.
 */
const orderLookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'rate_limited', message: 'Çok fazla deneme yapıldı. Lütfen daha sonra tekrar deneyin.' } },
})

// Sipariş oluşturma ödeme adımı İÇERMEZ (bkz. services/orders.js) ve stok gerçek zamanlı düşer;
// limitsiz bırakılırsa tek bir IP art arda sipariş oluşturarak stoğu tüketebilir/sipariş tablosunu
// şişirebilir. Login/register ile aynı IP başına sınır uygulanır.
const orderCreateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'rate_limited', message: 'Çok fazla deneme yapıldı. Lütfen daha sonra tekrar deneyin.' } },
})

/** Sipariş id biçimi: `TSV-YYYYMMDD-XXXX` (bkz. services/orders.js randomOrderId). */
const ORDER_ID_RE = /^TSV-\d{8}-\d{4}$/

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
        productId: z.string().min(1).max(32),
        colorId: z.string().min(1).max(32),
        size: z.enum(productsService.SIZES),
        qty: z.number().int().min(1).max(20),
      }),
    )
    .min(1, 'Sepet boş olamaz')
    .max(100, 'Sepette en fazla 100 satır olabilir'),
})

router.post('/', orderCreateLimiter, optionalCustomer, async (req, res, next) => {
  try {
    const input = parseBody(orderSchema, req.body)
    const { order, accessToken } = await ordersService.createOrder(input, req.customer ?? null)
    // accessToken yalnızca burada döner — istemci (mağaza) bunu saklamalı (ör. sipariş onay
    // sayfası/e-postası); sunucu bunu bir daha asla düz metin olarak döndürmez.
    res.status(201).json({ order, accessToken })
  } catch (err) {
    next(err)
  }
})

// Erişim: (a) siparişi oluşturan müşterinin oturumu veya (b) oluşturmada dönen accessToken
// (yalnızca `Authorization: Bearer <token>` başlığı). Bilinçli olarak `?token=` sorgu parametresi
// DESTEKLENMEZ: URL'e giren bir token, Apache erişim günlüklerine, tarayıcı geçmişine ve
// (varsa) giden Referer başlığına sessizce düşerek DB'de hash'lenmiş olsa bile sızma yüzeyini
// genişletirdi. İstemci (mağaza) token'ı yalnızca Authorization header ile göndermelidir.
router.get('/:id', orderLookupLimiter, optionalCustomer, async (req, res, next) => {
  try {
    // Biçimi uymayan id'ler DB'ye hiç gitmez; yanıt yine de generic notFound'dur (bulunamayan bir
    // id ile yetkisiz bir id arasında ayrım yapılmaz — ID enumeration/bilgi sızıntısı önlenir).
    if (!ORDER_ID_RE.test(req.params.id)) return next(notFound('Sipariş bulunamadı'))

    const authHeader = req.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null

    const order = await ordersService.getOrderByIdForAccess(req.params.id, {
      customerId: req.customer?.id ?? null,
      token,
    })
    if (!order) return next(notFound('Sipariş bulunamadı'))
    res.json({ order })
  } catch (err) {
    next(err)
  }
})

export default router
