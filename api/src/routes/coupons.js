/** Herkese açık kupon doğrulama: POST /coupons/validate { code, subtotal } (+ müşteri oturumu varsa). */
import { Router } from 'express'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { parseBody } from '../errors.js'
import { optionalCustomer } from '../auth.js'
import * as couponsService from '../services/coupons.js'

const router = Router()

// Kod tahminine (enumeration) karşı: IP başına 30 / 15 dk; kodlar en az 4 karakter.
const validateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'rate_limited', message: 'Çok fazla deneme yapıldı. Lütfen daha sonra tekrar deneyin.' } },
})

const validateSchema = z.object({
  code: z.string().max(60, 'Kod çok uzun'),
  subtotal: z.number().min(0).max(100_000_000),
})

/** Geçersiz kodda da 200 döner: { valid:false, code, discountAmount:0, reason, message }. */
router.post('/validate', validateLimiter, optionalCustomer, async (req, res, next) => {
  try {
    const { code, subtotal } = parseBody(validateSchema, req.body)
    const result = await couponsService.validateCoupon({ code, subtotal, customerId: req.customer?.id ?? null, email: req.customer?.email ?? null })
    res.json(result)
  } catch (err) {
    next(err)
  }
})

export default router
