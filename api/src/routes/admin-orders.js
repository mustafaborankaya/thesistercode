/** Yönetici: sipariş listeleme, görüntüleme, durum güncelleme. */
import { Router } from 'express'
import { z } from 'zod'
import * as ordersService from '../services/orders.js'
import { requireAdmin } from '../auth.js'
import { parseBody, notFound, badRequest } from '../errors.js'

const router = Router()
router.use(requireAdmin)

const statusSchema = z.object({ status: z.enum(ordersService.ORDER_STATUSES) })

/** Sipariş id biçimi: `TSV-YYYYMMDD-XXXX` (bkz. services/orders.js randomOrderId). */
const ORDER_ID_RE = /^TSV-\d{8}-\d{4}$/

function assertOrderId(req, next) {
  if (!ORDER_ID_RE.test(req.params.id)) {
    next(badRequest('Geçersiz sipariş id biçimi', 'validation_error'))
    return false
  }
  return true
}

router.get('/', async (req, res, next) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined
    const orders = await ordersService.listOrders({ status })
    res.json({ orders })
  } catch (err) {
    next(err)
  }
})

router.get('/:id', async (req, res, next) => {
  try {
    if (!assertOrderId(req, next)) return
    const order = await ordersService.getOrderById(req.params.id)
    if (!order) return next(notFound('Sipariş bulunamadı'))
    res.json({ order })
  } catch (err) {
    next(err)
  }
})

router.patch('/:id', async (req, res, next) => {
  try {
    if (!assertOrderId(req, next)) return
    const { status } = parseBody(statusSchema, req.body)
    const order = await ordersService.updateOrderStatus(req.params.id, status)
    res.json({ order })
  } catch (err) {
    next(err)
  }
})

export default router
