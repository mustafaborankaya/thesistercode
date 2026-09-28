/** Yönetici: kuponlar (listele / oluştur / güncelle / sil — kullanılmışsa pasifleştir). */
import { Router } from 'express'
import { z } from 'zod'
import * as couponsService from '../services/coupons.js'
import { requireAdmin } from '../auth.js'
import { parseBody, notFound, badRequest } from '../errors.js'

const router = Router()
router.use(requireAdmin)

const money = z
  .number({ invalid_type_error: 'Tutar sayı olmalı' })
  .min(0, 'Tutar negatif olamaz')
  .max(99_999_999.99, 'Tutar çok büyük')
  .refine((n) => Math.abs(Math.round(n * 100) - n * 100) < 1e-6, 'En fazla 2 ondalık basamak')
const dateOrNull = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), 'Geçersiz tarih (ISO 8601 bekleniyor)')
  .nullable()
const limit = z.number().int('Tam sayı olmalı').min(1, 'En az 1 olmalı').max(1_000_000).nullable()

const baseFields = {
  code: z.string().trim().min(4, 'Kod en az 4 karakter olmalı').max(40, 'Kod en fazla 40 karakter olabilir'),
  type: z.enum(couponsService.COUPON_TYPES, { errorMap: () => ({ message: "Tür 'percent' ya da 'fixed' olmalı" }) }),
  value: money.refine((n) => n > 0, 'Değer 0’dan büyük olmalı'),
  minSubtotal: money.nullable(),
  usageLimit: limit,
  perCustomerLimit: limit,
  startsAt: dateOrNull,
  expiresAt: dateOrNull,
  active: z.boolean(),
}

const createSchema = z.object({
  ...baseFields,
  minSubtotal: baseFields.minSubtotal.optional(),
  usageLimit: baseFields.usageLimit.optional(),
  perCustomerLimit: baseFields.perCustomerLimit.optional(),
  startsAt: baseFields.startsAt.optional(),
  expiresAt: baseFields.expiresAt.optional(),
  active: baseFields.active.optional(),
})
const updateSchema = z.object(baseFields).partial()

function parseId(req) {
  const id = Number.parseInt(req.params.id, 10)
  if (!Number.isInteger(id) || id <= 0 || String(id) !== req.params.id) throw badRequest('Geçersiz kupon id', 'validation_error')
  return id
}

router.get('/', async (req, res, next) => {
  try {
    res.json({ coupons: await couponsService.listCoupons() })
  } catch (err) {
    next(err)
  }
})

router.post('/', async (req, res, next) => {
  try {
    const data = parseBody(createSchema, req.body)
    res.status(201).json({ coupon: await couponsService.createCoupon(data) })
  } catch (err) {
    next(err)
  }
})

router.put('/:id', async (req, res, next) => {
  try {
    const id = parseId(req)
    const patch = parseBody(updateSchema, req.body)
    const coupon = await couponsService.updateCoupon(id, patch)
    if (!coupon) return next(notFound('Kupon bulunamadı'))
    res.json({ coupon })
  } catch (err) {
    next(err)
  }
})

/** Kullanılmış kupon silinmez: active=0 → { ok:true, deactivated:true }; kullanılmamışsa silinir → { ok:true }. */
router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseId(req)
    const result = await couponsService.deleteCoupon(id)
    if (!result) return next(notFound('Kupon bulunamadı'))
    res.json(result)
  } catch (err) {
    next(err)
  }
})

export default router
