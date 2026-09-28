/** Yönetici: müşteriler (liste/detay) ve üyelik indirimi bayrağı. Parola hash'i asla dönmez. */
import { Router } from 'express'
import { z } from 'zod'
import * as customersService from '../services/customers.js'
import * as paymentService from '../services/payments/service.js'
import { paymentsEnabled } from '../services/payments/index.js'
import { requireAdmin } from '../auth.js'
import { parseBody, notFound, badRequest } from '../errors.js'

const router = Router()
router.use(requireAdmin)

const patchSchema = z.object({ discountEligible: z.boolean({ required_error: 'discountEligible gerekli', invalid_type_error: 'discountEligible true/false olmalı' }) })

function parseId(req) {
  const id = Number.parseInt(req.params.id, 10)
  if (!Number.isInteger(id) || id <= 0 || String(id) !== req.params.id) throw badRequest('Geçersiz müşteri id', 'validation_error')
  return id
}

/** Ciro (totalSpent): paid + shipped; ödeme sağlayıcısı yokken (PAYMENT_PROVIDER=none) 'new' de sayılır. */
const includeNew = () => !paymentsEnabled()

router.get('/', async (req, res, next) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : undefined
    res.json(await customersService.adminListCustomers({ q, page: req.query.page, pageSize: req.query.pageSize, includeNew: includeNew() }))
  } catch (err) {
    next(err)
  }
})

router.get('/:id', async (req, res, next) => {
  try {
    const result = await customersService.adminGetCustomer(parseId(req), { includeNew: includeNew() })
    if (!result) return next(notFound('Müşteri bulunamadı'))
    result.orders = await paymentService.attachPayments(result.orders)
    res.json(result)
  } catch (err) {
    next(err)
  }
})

router.patch('/:id', async (req, res, next) => {
  try {
    const id = parseId(req)
    const { discountEligible } = parseBody(patchSchema, req.body)
    const customer = await customersService.adminSetDiscountEligible(id, discountEligible, { includeNew: includeNew() })
    if (!customer) return next(notFound('Müşteri bulunamadı'))
    res.json({ customer })
  } catch (err) {
    next(err)
  }
})

export default router
