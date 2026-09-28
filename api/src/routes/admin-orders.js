/** Yönetici: sipariş listeleme, görüntüleme, durum güncelleme, ödeme iadesi. */
import { Router } from 'express'
import { z } from 'zod'
import * as ordersService from '../services/orders.js'
import * as paymentService from '../services/payments/service.js'
import { paymentsEnabled } from '../services/payments/index.js'
import { requireAdmin } from '../auth.js'
import { parseBody, notFound, badRequest, conflict } from '../errors.js'
import { sendMail } from '../services/mail.js'

const router = Router()
router.use(requireAdmin)

const optText = (max, label) => z.string().max(max, `${label} en fazla ${max} karakter olabilir`).nullable().optional()
const patchSchema = z
  .object({
    status: z.enum(ordersService.ORDER_STATUSES, { errorMap: () => ({ message: 'Geçersiz sipariş durumu' }) }).optional(),
    carrier: optText(60, 'Kargo firması'),
    trackingNumber: optText(100, 'Takip numarası'),
    adminNote: optText(5000, 'Yönetici notu'),
  })
  .refine((b) => Object.values(b).some((v) => v !== undefined), 'Güncellenecek en az bir alan gönderin')

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
    const str = (k) => (typeof req.query[k] === 'string' && req.query[k] !== '' ? req.query[k] : undefined)
    const result = await ordersService.listOrders({
      status: str('status'),
      q: str('q'),
      from: str('from'),
      to: str('to'),
      page: str('page'),
      pageSize: str('pageSize'),
    })
    const orders = await paymentService.attachPayments(result.orders)
    res.json({ orders, total: result.total, page: result.page, pageSize: result.pageSize })
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
 *  - 'demo' durumu gerçek siparişe verilemez; demo sipariş başka duruma alınamaz.
 *  - İptalden çıkışta (cancelled → …) stok yeniden ayrılır; yetmezse 409 insufficient_stock.
 * Gövde: { status?, carrier?, trackingNumber?, adminNote? } — en az biri. 'shipped' geçişinde shipped_at set
 * edilir ve müşteriye orderShipped e-postası gider.
 */
router.patch('/:id', async (req, res, next) => {
  try {
    if (!assertOrderId(req, next)) return
    const body = parseBody(patchSchema, req.body)
    const { status } = body
    const guard = async (conn, current) => {
      if (status === current) return
      if (status === 'demo') throw conflict("'Demo' durumu gerçek siparişler için seçilemez", 'status_not_allowed')
      if (current === 'demo') throw conflict('Demo siparişin durumu değiştirilemez', 'status_not_allowed')
      if (status === 'pending_payment') throw conflict("'Ödeme bekleniyor' durumu elle seçilemez", 'status_not_allowed')
      if (current === 'pending_payment' && status !== 'cancelled') {
        throw conflict('Ödeme bekleyen sipariş yalnızca iptal edilebilir; ödendi durumu ödeme sağlayıcısından gelir', 'status_not_allowed')
      }
      if (status === 'paid' && paymentsEnabled()) throw conflict("'Ödendi' durumu yalnızca ödeme sağlayıcısının sonucuyla verilir", 'status_not_allowed')
      if (status === 'cancelled' && (await paymentService.hasUnrefundedPayment(conn, req.params.id))) {
        throw conflict('Bu siparişin alınmış bir ödemesi var; iptal için İade işlemini kullanın', 'use_refund')
      }
    }
    const { order, becameShipped } = await ordersService.updateOrderAdmin(req.params.id, body, { guard })
    const [withPayment] = await paymentService.attachPayments([order])
    res.json({ order: withPayment })
    // Kargoya verildi bildirimi — yalnızca gerçek 'shipped' geçişinde, commit SONRASI; yanıtı bekletmez.
    if (becameShipped) {
      sendMail({ to: order.contact.email, template: 'orderShipped', data: { order }, locale: order.locale, refType: 'order', refId: order.id }).catch(() => undefined)
    }
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
