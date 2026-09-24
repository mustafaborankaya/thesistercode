/** Yönetici: sipariş listeleme, görüntüleme, durum güncelleme, ödeme iadesi. */
import { Router } from 'express'
import { z } from 'zod'
import * as ordersService from '../services/orders.js'
import * as paymentService from '../services/payments/service.js'
import { paymentsEnabled } from '../services/payments/index.js'
import { requireAdmin } from '../auth.js'
import { parseBody, notFound, badRequest, conflict } from '../errors.js'

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
    if (paymentsEnabled()) await paymentService.maybeSweep()
    const status = typeof req.query.status === 'string' ? req.query.status : undefined
    const orders = await paymentService.attachPayments(await ordersService.listOrders({ status }))
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
    const [withPayment] = await paymentService.attachPayments([order])
    res.json({ order: withPayment })
  } catch (err) {
    next(err)
  }
})

/**
 * Elle durum geçiş kuralları (kilit altında, güncel durumla denetlenir):
 *  - 'pending_payment' elle SEÇİLEMEZ; 'pending_payment' bir sipariş elle yalnızca 'cancelled'a alınabilir.
 *  - Ödeme sağlayıcısı etkinken 'paid' elle seçilemez (yalnızca sağlayıcı sonucu).
 *  - İade edilmemiş başarılı ödemesi olan sipariş durum seçiciyle iptal edilemez → POST /:id/refund.
 */
router.patch('/:id', async (req, res, next) => {
  try {
    if (!assertOrderId(req, next)) return
    const { status } = parseBody(statusSchema, req.body)
    const guard = async (conn, current) => {
      if (status === current) return
      if (status === 'pending_payment') throw conflict("'Ödeme bekleniyor' durumu elle seçilemez", 'status_not_allowed')
      if (current === 'pending_payment' && status !== 'cancelled') {
        throw conflict('Ödeme bekleyen sipariş yalnızca iptal edilebilir; ödendi durumu ödeme sağlayıcısından gelir', 'status_not_allowed')
      }
      if (status === 'paid' && paymentsEnabled()) throw conflict("'Ödendi' durumu yalnızca ödeme sağlayıcısının sonucuyla verilir", 'status_not_allowed')
      if (status === 'cancelled' && (await paymentService.hasUnrefundedPayment(conn, req.params.id))) {
        throw conflict('Bu siparişin alınmış bir ödemesi var; iptal için İade işlemini kullanın', 'use_refund')
      }
    }
    const order = await ordersService.updateOrderStatus(req.params.id, status, { guard })
    const [withPayment] = await paymentService.attachPayments([order])
    res.json({ order: withPayment })
  } catch (err) {
    next(err)
  }
})

/** Tam iade (tüm yöneticiler — sipariş durum değişikliği kuralıyla aynı yetki). */
router.post('/:id/refund', async (req, res, next) => {
  try {
    if (!assertOrderId(req, next)) return
    const order = await paymentService.refundOrder(req.params.id, { ip: req.ip })
    console.log(`[payments] iade: ${req.params.id} — yönetici ${req.admin.username}`)
    res.json({ order })
  } catch (err) {
    next(err)
  }
})

export default router
