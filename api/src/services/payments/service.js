/**
 * Çevrim içi ödeme akışı (sağlayıcıdan bağımsız):
 *
 *   POST /orders            → sipariş 'pending_payment' (stok rezerve, indirim hakkı "kullanılmış")
 *   POST /payments/init     → initPayment: sağlayıcıda ödeme formu başlatılır, payments satırı 'initialized',
 *                             { paymentPageUrl } döner → mağaza tarayıcıyı oraya yönlendirir
 *   POST /payments/iyzico/callback (iyzico → tarayıcı → biz; form-urlencoded `token`)
 *                           → handleCallback: retrieve ile sunucudan sunucuya doğrulama; başarıda
 *                             sipariş 'paid' + e-postalar; başarısızlıkta payments 'failure' (sipariş
 *                             'pending_payment' kalır, yeniden denenebilir) → 302 mağazaya
 *   30 dk ödenmeyen          → sweepExpiredPendingOrders: 'cancelled' (stok + indirim hakkı geri)
 *   POST /admin/orders/:id/refund → refundOrder: önce cancel (aynı gün), olmazsa kalem bazında refund
 *
 * Tutar/para birimi/sipariş eşleşmesi daima sunucuda, DB'deki payments satırına göre doğrulanır.
 */
import { pool } from '../../db.js'
import { ApiError, conflict, notFound } from '../../errors.js'
import { envInstallments, siteUrl } from '../../env.js'
import { getSetting } from '../settings.js'
import { sendMail, notifyAdmin } from '../mail.js'
import * as ordersService from '../orders.js'
import { getProvider } from './index.js'
import { toKurus } from './iyzico.js'

/** Ödenmeyen siparişin ömrü (dk). Son ödeme denemesi başlatıldıysa o andan itibaren de bu kadar korunur. */
export const PENDING_TTL_MINUTES = 30
const MAX_ATTEMPTS_PER_ORDER = 10
const ALLOWED_INSTALLMENTS = [1, 2, 3, 6, 9, 12]

/* ---------------- Yardımcılar ---------------- */

function jsonOrNull(v) {
  return v == null ? null : JSON.stringify(v)
}

function parseJsonArray(text) {
  if (!text) return []
  try {
    const v = JSON.parse(text)
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

/** Etkin taksit seçenekleri: panel ayarı `payment.installments` (geçerli dizi) > env PAYMENT_INSTALLMENTS. */
export async function getEffectiveInstallments() {
  const fromSettings = await getSetting('payment.installments').catch(() => null)
  if (Array.isArray(fromSettings)) {
    const clean = [...new Set(fromSettings.map(Number).filter((n) => ALLOWED_INSTALLMENTS.includes(n)))].sort((a, b) => a - b)
    if (clean.length) return clean
  }
  return envInstallments.length ? envInstallments : [1]
}

/** Ödeme sonrası mağaza sonuç sayfası (siparişin diline göre /en öneki). */
export function resultRedirectUrl(orderId, locale, outcome) {
  const prefix = locale === 'en' ? '/en' : ''
  if (!orderId) return `${siteUrl}${prefix}/`
  const q = outcome === 'success' ? 'basarili' : 'basarisiz'
  return `${siteUrl}${prefix}/odeme/sonuc/${encodeURIComponent(orderId)}?odeme=${q}`
}

/* ---------------- Süre dolumu ---------------- */

/**
 * Süresi dolan 'pending_payment' siparişleri iptal eder (stok + üyelik indirimi hakkı geri gelir).
 * Kural: sipariş PENDING_TTL_MINUTES'tan eski VE son PENDING_TTL_MINUTES içinde başlatılmış açık bir
 * ödeme denemesi YOK VE başarılı ödemesi YOK. Her sipariş kendi transaction'ında `FOR UPDATE` ile
 * yeniden denetlenir (callback ile yarışmaz). `orderId` verilirse yalnızca o sipariş.
 * @returns {Promise<string[]>} iptal edilen sipariş id'leri
 */
export async function sweepExpiredPendingOrders({ orderId } = {}) {
  const params = [PENDING_TTL_MINUTES, PENDING_TTL_MINUTES]
  let extra = ''
  if (orderId) {
    extra = ' AND o.id = ?'
    params.push(orderId)
  }
  const [rows] = await pool.query(
    `SELECT o.id FROM orders o
      WHERE o.status = 'pending_payment'
        AND o.created_at < (NOW() - INTERVAL ? MINUTE)
        AND NOT EXISTS (
          SELECT 1 FROM payments p
           WHERE p.order_id = o.id
             AND (p.status = 'success' OR (p.status = 'initialized' AND p.created_at > (NOW() - INTERVAL ? MINUTE)))
        )${extra}
      LIMIT 200`,
    params,
  )
  const cancelled = []
  for (const { id } of rows) {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()
      const [o] = await conn.query('SELECT status, created_at FROM orders WHERE id = ? FOR UPDATE', [id])
      const [blocking] = await conn.query(
        `SELECT id FROM payments WHERE order_id = ?
            AND (status = 'success' OR (status = 'initialized' AND created_at > (NOW() - INTERVAL ? MINUTE))) LIMIT 1 FOR UPDATE`,
        [id, PENDING_TTL_MINUTES],
      )
      if (o[0]?.status === 'pending_payment' && !blocking[0]) {
        await ordersService.setOrderStatusInTx(conn, id, 'pending_payment', 'cancelled')
        await conn.query(
          "UPDATE payments SET status = 'failure', error_code = 'expired', error_message = 'Ödeme süresi doldu' WHERE order_id = ? AND status = 'initialized'",
          [id],
        )
        cancelled.push(id)
      }
      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('[payments] süpürme hatası:', id, err?.message)
    } finally {
      conn.release()
    }
  }
  if (cancelled.length) console.log(`[payments] süresi dolan ${cancelled.length} sipariş iptal edildi: ${cancelled.join(', ')}`)
  return cancelled
}

let lastLazySweep = 0
/** Tembel süpürme: süreç başına en fazla dakikada bir; istek akışını asla bozmaz. */
export async function maybeSweep() {
  const now = Date.now()
  if (now - lastLazySweep < 60_000) return
  lastLazySweep = now
  try {
    await sweepExpiredPendingOrders()
  } catch (err) {
    console.error('[payments] tembel süpürme başarısız:', err?.message)
  }
}

/** Test yardımcısı: bir sonraki maybeSweep'in hemen çalışması için. */
export function resetLazySweepThrottle() {
  lastLazySweep = 0
}

/* ---------------- Başlatma ---------------- */

export async function initPayment({ orderId, customerId, token, ip }) {
  const provider = getProvider()
  if (!provider) throw conflict('Çevrim içi ödeme etkin değil', 'payments_disabled')

  await maybeSweep()
  const access = await ordersService.getOrderRowForAccess(orderId, { customerId, token })
  if (!access) throw notFound('Sipariş bulunamadı')
  // Bu sipariş kendi başına süresi dolmuşsa (tembel süpürme henüz görmediyse) şimdi iptal edilir.
  await sweepExpiredPendingOrders({ orderId })

  const order = await ordersService.getOrderById(orderId)
  if (order.status === 'paid') throw conflict('Bu siparişin ödemesi zaten alındı', 'already_paid')
  if (order.status !== 'pending_payment') throw conflict('Bu sipariş için ödeme alınamaz (süresi dolmuş ya da iptal edilmiş)', 'order_not_payable')

  const [[{ attempts }]] = await pool.query('SELECT COUNT(*) AS attempts FROM payments WHERE order_id = ?', [orderId])
  if (attempts >= MAX_ATTEMPTS_PER_ORDER) throw new ApiError(429, 'too_many_attempts', 'Bu sipariş için çok fazla ödeme denemesi yapıldı')

  const installments = await getEffectiveInstallments()
  const callbackUrl = `${siteUrl}/api/payments/iyzico/callback`
  const ctx = { callbackUrl, installments, ip, customerId: access.customer_id }

  let result
  try {
    result = await provider.initialize(order, ctx)
  } catch (err) {
    console.error('[payments] başlatma hatası:', orderId, err?.message)
    result = { ok: false, errorCode: 'provider_unreachable', errorMessage: err?.message ?? null }
  }

  const priceKurus = toKurus(order.totals.subtotal) + (order.totals.shipping == null ? 0 : toKurus(order.totals.shipping))
  const price = priceKurus / 100
  const paidPrice = order.totals.total

  if (!result.ok) {
    await pool.query(
      `INSERT INTO payments (order_id, provider, conversation_id, token, status, price, paid_price, error_code, error_message)
       VALUES (?, ?, ?, NULL, 'failure', ?, ?, ?, ?)`,
      [orderId, provider.name, orderId, price, paidPrice, (result.errorCode ?? 'init_failed').slice(0, 64), result.errorMessage ? String(result.errorMessage).slice(0, 500) : null],
    )
    throw new ApiError(502, 'payment_init_failed', 'Ödeme sayfası başlatılamadı. Lütfen biraz sonra tekrar deneyin.')
  }

  await pool.query(
    `INSERT INTO payments (order_id, provider, conversation_id, token, status, price, paid_price)
     VALUES (?, ?, ?, ?, 'initialized', ?, ?)`,
    [orderId, provider.name, orderId, result.token, price, paidPrice],
  )
  return { paymentPageUrl: result.paymentPageUrl }
}

/* ---------------- Callback / doğrulama ---------------- */

/**
 * retrieve sonucunu DB'deki beklentiye göre doğrular. Döner: null (geçerli başarı) ya da
 * { code, message } (başarısızlık nedeni).
 *
 * Tutar kuralı: `price` (sepet toplamı) birebir eşit olmalı. `paidPrice` tek çekimde birebir eşit
 * olmalı; taksitte (installment > 1) iyzico vade farkını müşteriye yansıtacak şekilde yapılandırılmışsa
 * paidPrice beklenenden BÜYÜK olabilir — bu yüzden taksitte `beklenen ≤ paidPrice ≤ beklenen × 1,5`
 * kabul edilir, tahsil edilen gerçek tutar payments.paid_price'a yazılır. Düşük tutar asla kabul edilmez.
 */
export function validateRetrieve(r, payment, token) {
  if (r.signatureValid === false) return { code: 'signature_mismatch', message: 'Yanıt imzası doğrulanamadı' }
  if (r.status !== 'success' || r.paymentStatus !== 'SUCCESS') {
    return { code: r.errorCode || 'payment_failed', message: r.errorMessage || 'Ödeme başarısız' }
  }
  if (r.token && r.token !== token) return { code: 'token_mismatch', message: 'Token eşleşmiyor' }
  if (r.conversationId !== payment.order_id || (r.basketId && r.basketId !== payment.order_id)) {
    return { code: 'order_mismatch', message: 'Sipariş eşleşmiyor' }
  }
  if (r.currency !== 'TRY') return { code: 'currency_mismatch', message: `Para birimi eşleşmiyor: ${r.currency}` }
  if (r.fraudStatus === -1) return { code: 'fraud_rejected', message: 'Ödeme sahtecilik kontrolünden geçemedi' }
  if (!r.paymentId) return { code: 'payment_id_missing', message: 'paymentId yok' }

  const expectedPrice = toKurus(payment.price)
  const expectedPaid = toKurus(payment.paid_price)
  const gotPrice = toKurus(r.price)
  const gotPaid = toKurus(r.paidPrice)
  if (!Number.isFinite(gotPrice) || gotPrice !== expectedPrice) return { code: 'amount_mismatch', message: `Sepet tutarı eşleşmiyor (${r.price})` }
  const installment = r.installment ?? 1
  const paidOk = installment > 1 ? gotPaid >= expectedPaid && gotPaid <= Math.round(expectedPaid * 1.5) : gotPaid === expectedPaid
  if (!Number.isFinite(gotPaid) || !paidOk) return { code: 'amount_mismatch', message: `Tahsil edilen tutar eşleşmiyor (${r.paidPrice})` }
  return null
}

async function sendPaidMails(orderId) {
  const order = await ordersService.getOrderById(orderId)
  if (!order) return
  sendMail({ to: order.contact.email, template: 'orderConfirmation', data: { order }, locale: order.locale, refType: 'order', refId: order.id }).catch(() => undefined)
  notifyAdmin('adminNewOrder', { order }, { refType: 'order', refId: order.id }).catch(() => undefined)
}

function notifyPaymentIssue(orderId, issue) {
  notifyAdmin('adminPaymentIssue', { orderId, issue }, { refType: 'order', refId: orderId }).catch(() => undefined)
}

/** Sağlayıcıda ödemeyi tamamen geri alır: önce cancel, olmazsa kalem bazında refund. */
async function reversePayment(provider, { paymentId, transactions, alreadyRefunded, ip, orderId, locale, onProgress }) {
  const refunded = new Set(alreadyRefunded)
  let lastError = null
  if (!refunded.size && paymentId) {
    try {
      const c = await provider.cancel({ paymentId, ip, conversationId: orderId, locale })
      if (c.ok) return { ok: true, method: 'cancel', refunded: transactions.map((t) => t.id) }
      lastError = c
    } catch (err) {
      lastError = { errorCode: 'provider_unreachable', errorMessage: err?.message }
    }
  }
  for (const t of transactions) {
    if (refunded.has(t.id)) continue
    try {
      const r = await provider.refund({ paymentTransactionId: t.id, price: t.paidPrice, ip, conversationId: orderId, locale })
      if (!r.ok) {
        lastError = r
        continue
      }
      refunded.add(t.id)
      if (onProgress) await onProgress([...refunded])
    } catch (err) {
      lastError = { errorCode: 'provider_unreachable', errorMessage: err?.message }
    }
  }
  const ok = transactions.length > 0 && transactions.every((t) => refunded.has(t.id))
  return { ok, method: 'refund', refunded: [...refunded], error: ok ? null : lastError }
}

/**
 * iyzico callback'i. Asla fırlatmaz; { orderId, locale, outcome: 'success'|'failure' } döner
 * (orderId null → bilinmeyen token). Tekrar çağrılara idempotenttir: durum değişikliği yalnızca bir
 * kez olur, e-postalar yalnızca gerçek 'pending_payment'→'paid' geçişinde gönderilir.
 */
export async function handleCallback(token, { ip } = {}) {
  if (typeof token !== 'string' || !token || token.length > 128) return { orderId: null, locale: 'tr', outcome: 'failure' }

  const [prow] = await pool.query(
    'SELECT p.*, o.locale AS order_locale FROM payments p JOIN orders o ON o.id = p.order_id WHERE p.token = ? LIMIT 1',
    [token],
  )
  const payment = prow[0]
  if (!payment) return { orderId: null, locale: 'tr', outcome: 'failure' }
  const orderId = payment.order_id
  const locale = payment.order_locale === 'en' ? 'en' : 'tr'

  // Önceden sonuçlanmış deneme: sağlayıcıya tekrar gitmeden aynı sonuç.
  if (payment.status === 'success') return { orderId, locale, outcome: 'success' }
  if (payment.status === 'refunded') return { orderId, locale, outcome: 'failure' }

  const provider = getProvider()
  if (!provider || provider.name !== payment.provider) {
    console.error('[payments] callback: sağlayıcı uyuşmazlığı', payment.provider)
    return { orderId, locale, outcome: 'failure' }
  }

  let r
  try {
    r = await provider.retrieve({ token, conversationId: payment.conversation_id, locale })
  } catch (err) {
    // Geçici bağlantı hatası: deneme 'initialized' kalır (kullanıcı sonuç sayfasında yeniden deneyebilir,
    // aynı token'la callback tekrar gelirse yeniden doğrulanır).
    console.error('[payments] retrieve hatası:', orderId, err?.message)
    return { orderId, locale, outcome: 'failure' }
  }
  if (r.signatureValid === null && provider.name === 'iyzico') {
    console.warn('[payments] retrieve yanıtında imza yok; TLS üzerinden doğrudan sorguya güveniliyor:', orderId)
  }

  const invalid = validateRetrieve(r, payment, token)
  const cardInfo = [r.installment, r.cardAssociation?.slice(0, 32) ?? null, r.cardFamily?.slice(0, 32) ?? null, r.lastFour, r.fraudStatus]
  const raw = jsonOrNull(r.summary)

  if (invalid) {
    await pool.query(
      `UPDATE payments SET status = 'failure', payment_id = ?, installment = ?, card_association = ?, card_family = ?, last_four = ?, fraud_status = ?,
              error_code = ?, error_message = ?, raw_result = ? WHERE id = ? AND status = 'initialized'`,
      [r.paymentId, ...cardInfo, invalid.code.slice(0, 64), String(invalid.message).slice(0, 500), raw, payment.id],
    )
    // Para çekilmiş ama doğrulama tutmuyorsa (tutar/sipariş/imza) yönetici mutlaka bilgilendirilir.
    if (r.status === 'success' && r.paymentStatus === 'SUCCESS') {
      notifyPaymentIssue(orderId, `Ödeme sağlayıcıda BAŞARILI görünüyor ama doğrulama reddetti (${invalid.code}: ${invalid.message}); paymentId ${r.paymentId}. Elle kontrol/iade gerekebilir.`)
    }
    return { orderId, locale, outcome: 'failure' }
  }

  const txJson = JSON.stringify(r.itemTransactions)
  const paidPrice = toKurus(r.paidPrice) / 100
  let becamePaid = false
  let lateRefund = false
  let duplicate = false

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const [orows] = await conn.query('SELECT status FROM orders WHERE id = ? FOR UPDATE', [orderId])
    const [lockP] = await conn.query('SELECT status FROM payments WHERE id = ? FOR UPDATE', [payment.id])
    const orderStatus = orows[0]?.status
    const pStatus = lockP[0]?.status

    if (pStatus === 'success' || pStatus === 'refunded') {
      await conn.commit()
      return { orderId, locale, outcome: pStatus === 'success' ? 'success' : 'failure' }
    }

    let errorCode = null
    let errorMessage = null
    if (orderStatus === 'pending_payment') {
      await ordersService.setOrderStatusInTx(conn, orderId, orderStatus, 'paid')
      becamePaid = true
    } else if (orderStatus === 'cancelled') {
      // Süre dolup iptal edildikten sonra gelen başarılı ödeme: stok yeniden ayrılabiliyorsa sipariş ödenir.
      if (await ordersService.reserveOrderStockInTx(conn, orderId)) {
        await conn.query("UPDATE orders SET status = 'paid' WHERE id = ?", [orderId])
        becamePaid = true
        errorCode = 'late_payment_recovered'
        errorMessage = 'Süre dolumundan sonra ödendi; stok yeniden ayrıldı'
      } else {
        await conn.rollback()
        lateRefund = true
      }
    } else {
      // Sipariş zaten ödenmiş/ilerlemiş: ikinci (mükerrer) başarılı ödeme — kayda geçir, yöneticiyi uyar.
      duplicate = true
      errorCode = 'duplicate_payment'
      errorMessage = `Sipariş durumu '${orderStatus}' iken ikinci ödeme alındı; iade gerekebilir`
    }

    if (!lateRefund) {
      await conn.query(
        `UPDATE payments SET status = 'success', payment_id = ?, payment_transaction_ids = ?, paid_price = ?, installment = ?, card_association = ?,
                card_family = ?, last_four = ?, fraud_status = ?, error_code = ?, error_message = ?, raw_result = ? WHERE id = ?`,
        [r.paymentId, txJson, paidPrice, ...cardInfo, errorCode, errorMessage, raw, payment.id],
      )
      await conn.commit()
    }
  } catch (err) {
    await conn.rollback().catch(() => undefined)
    console.error('[payments] callback işleme hatası:', orderId, err?.message)
    return { orderId, locale, outcome: 'failure' }
  } finally {
    conn.release()
  }

  if (lateRefund) {
    const rev = await reversePayment(provider, { paymentId: r.paymentId, transactions: r.itemTransactions, alreadyRefunded: [], ip, orderId, locale })
    await pool.query(
      `UPDATE payments SET status = ?, payment_id = ?, payment_transaction_ids = ?, refunded_transaction_ids = ?, paid_price = ?, installment = ?, card_association = ?,
              card_family = ?, last_four = ?, fraud_status = ?, error_code = ?, error_message = ?, raw_result = ? WHERE id = ?`,
      [
        rev.ok ? 'refunded' : 'success',
        r.paymentId,
        txJson,
        JSON.stringify(rev.refunded),
        paidPrice,
        ...cardInfo,
        rev.ok ? 'late_payment_refunded' : 'late_payment_refund_failed',
        rev.ok ? 'Sipariş süresi dolmuştu, stok yetersiz; ödeme otomatik iade edildi' : `Otomatik iade başarısız: ${rev.error?.errorMessage ?? ''}`.slice(0, 500),
        raw,
        payment.id,
      ],
    )
    notifyPaymentIssue(
      orderId,
      rev.ok
        ? `Süresi dolmuş siparişe geç ödeme geldi; stok yetersiz olduğundan ödeme otomatik iade edildi (paymentId ${r.paymentId}).`
        : `Süresi dolmuş siparişe geç ödeme geldi; OTOMATİK İADE BAŞARISIZ — elle iade edin (paymentId ${r.paymentId}).`,
    )
    return { orderId, locale, outcome: 'failure' }
  }

  if (duplicate) notifyPaymentIssue(orderId, `Mükerrer başarılı ödeme alındı (paymentId ${r.paymentId}); panelden kontrol edip gerekirse iade edin.`)
  if (r.fraudStatus === 0) notifyPaymentIssue(orderId, 'Ödeme iyzico sahtecilik incelemesinde (fraudStatus 0): onay bildirimi gelene kadar kargolamayın.')
  if (becamePaid) await sendPaidMails(orderId)
  return { orderId, locale, outcome: 'success' }
}

/* ---------------- Durum ---------------- */

export async function getPaymentStatus({ orderId, customerId, token }) {
  const row = await ordersService.getOrderRowForAccess(orderId, { customerId, token })
  if (!row) throw notFound('Sipariş bulunamadı')
  const [p] = await pool.query('SELECT status, error_code, error_message FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1', [orderId])
  const last = p[0]
  return {
    status: row.status,
    paymentStatus: last?.status ?? null,
    lastError: last && last.status === 'failure' ? { code: last.error_code, message: last.error_message } : null,
  }
}

/* ---------------- Yönetici: ödeme bilgisi + iade ---------------- */

function formatPayment(p) {
  if (!p) return null
  return {
    id: p.id,
    provider: p.provider,
    status: p.status,
    paymentId: p.payment_id,
    price: Number(p.price),
    paidPrice: Number(p.paid_price),
    installment: p.installment,
    cardAssociation: p.card_association,
    cardFamily: p.card_family,
    lastFour: p.last_four,
    fraudStatus: p.fraud_status,
    errorCode: p.error_code,
    errorMessage: p.error_message,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  }
}

/** Siparişlere (admin) `payment` (öncelik: success/refunded → en son deneme) ve `paymentAttempts` ekler. */
export async function attachPayments(orders) {
  if (!orders.length) return orders
  const ids = orders.map((o) => o.id)
  const [rows] = await pool.query(`SELECT * FROM payments WHERE order_id IN (${ids.map(() => '?').join(',')}) ORDER BY id ASC`, ids)
  const byOrder = new Map()
  for (const r of rows) {
    if (!byOrder.has(r.order_id)) byOrder.set(r.order_id, [])
    byOrder.get(r.order_id).push(r)
  }
  return orders.map((o) => {
    const list = byOrder.get(o.id) ?? []
    const settled = [...list].reverse().find((p) => p.status === 'success' || p.status === 'refunded')
    const chosen = settled ?? list[list.length - 1]
    return { ...o, payment: formatPayment(chosen), paymentAttempts: list.length }
  })
}

/** Siparişin iade edilmemiş başarılı ödemesi var mı? (durum seçicisiyle iptali engellemek için) */
export async function hasUnrefundedPayment(db, orderId) {
  const [rows] = await db.query("SELECT id FROM payments WHERE order_id = ? AND status = 'success' LIMIT 1", [orderId])
  return !!rows[0]
}

const refundLocks = new Set()

/** Tam iade: sağlayıcıda geri al → sipariş 'cancelled' (stok geri) + payments 'refunded'. */
export async function refundOrder(orderId, { ip } = {}) {
  const [rows] = await pool.query("SELECT * FROM payments WHERE order_id = ? AND status = 'success' ORDER BY id DESC", [orderId])
  if (!rows.length) {
    const [[exists]] = await pool.query('SELECT COUNT(*) AS n FROM orders WHERE id = ?', [orderId])
    if (!exists.n) throw notFound('Sipariş bulunamadı')
    throw conflict('Bu siparişin iade edilebilir bir ödemesi yok', 'no_refundable_payment')
  }
  const provider = getProvider()
  if (refundLocks.has(orderId)) throw conflict('Bu sipariş için iade zaten sürüyor', 'refund_in_progress')
  refundLocks.add(orderId)
  try {
    const [[order]] = await pool.query('SELECT locale FROM orders WHERE id = ?', [orderId])
    for (const payment of rows) {
      if (!provider || provider.name !== payment.provider) {
        throw conflict(`Ödeme '${payment.provider}' sağlayıcısıyla alınmış; etkin sağlayıcıdan iade edilemez`, 'provider_mismatch')
      }
      const rev = await reversePayment(provider, {
        paymentId: payment.payment_id,
        transactions: parseJsonArray(payment.payment_transaction_ids),
        alreadyRefunded: parseJsonArray(payment.refunded_transaction_ids),
        ip,
        orderId,
        locale: order?.locale,
        onProgress: (list) => pool.query('UPDATE payments SET refunded_transaction_ids = ? WHERE id = ?', [JSON.stringify(list), payment.id]),
      })
      if (!rev.ok) {
        await pool.query('UPDATE payments SET refunded_transaction_ids = ?, error_code = ?, error_message = ? WHERE id = ?', [
          JSON.stringify(rev.refunded),
          'refund_failed',
          `İade başarısız: ${rev.error?.errorCode ?? ''} ${rev.error?.errorMessage ?? ''}`.trim().slice(0, 500),
          payment.id,
        ])
        throw new ApiError(502, 'refund_failed', `İade tamamlanamadı: ${rev.error?.errorMessage ?? 'sağlayıcı hatası'}. Tekrar denenebilir; tamamlanan kalemler yeniden iade edilmez.`)
      }
      await pool.query("UPDATE payments SET status = 'refunded', refunded_transaction_ids = ?, error_code = NULL, error_message = NULL WHERE id = ?", [
        JSON.stringify(rev.refunded),
        payment.id,
      ])
    }

    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()
      const [o] = await conn.query('SELECT status FROM orders WHERE id = ? FOR UPDATE', [orderId])
      if (o[0] && o[0].status !== 'cancelled') await ordersService.setOrderStatusInTx(conn, orderId, o[0].status, 'cancelled')
      await conn.commit()
    } catch (err) {
      await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
  } finally {
    refundLocks.delete(orderId)
  }
  const [order] = await attachPayments([await ordersService.getOrderById(orderId)])
  return order
}
