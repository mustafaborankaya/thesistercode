/**
 * Çevrim içi ödeme uç noktaları (bkz. services/payments/service.js).
 *
 *  POST /payments/init            { orderId } + Bearer accessToken ya da sahibi müşteri oturumu → { paymentPageUrl }
 *  GET  /payments/status/:orderId  Bearer / oturum → { status, paymentStatus, lastError }
 *  POST /payments/iyzico/callback  iyzico → (tarayıcı) → form-urlencoded `token` → 302 mağaza sonuç sayfası
 *                                  (callbackRouter; app.js'de originCheck/express.json'dan ÖNCE bağlanır)
 *  GET  /payments/fake/pay         yalnızca PAYMENT_PROVIDER=fake ve NODE_ENV!=='production'
 */
import express, { Router } from 'express'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { optionalCustomer } from '../auth.js'
import { parseBody, notFound } from '../errors.js'
import { env, isProd } from '../env.js'
import * as paymentService from '../services/payments/service.js'
import { setFakeOutcome } from '../services/payments/index.js'
import { FAKE_OUTCOMES } from '../services/payments/fake.js'

const ORDER_ID_RE = /^TSV-\d{8}-\d{4}$/

const limiterMessage = { error: { code: 'rate_limited', message: 'Çok fazla deneme yapıldı. Lütfen daha sonra tekrar deneyin.' } }

const initLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false, message: limiterMessage })
const statusLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false, message: limiterMessage })
const callbackLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false, message: limiterMessage })

function bearer(req) {
  const h = req.get('authorization') || ''
  return h.startsWith('Bearer ') ? h.slice(7).trim() : null
}

/* ---------------- Ana router (originCheck + JSON arkasında) ---------------- */

const router = Router()

const initSchema = z.object({ orderId: z.string().regex(ORDER_ID_RE, 'Geçersiz sipariş numarası') })

router.post('/init', initLimiter, optionalCustomer, async (req, res, next) => {
  try {
    const { orderId } = parseBody(initSchema, req.body)
    const result = await paymentService.initPayment({ orderId, customerId: req.customer?.id ?? null, token: bearer(req), ip: req.ip })
    res.json(result)
  } catch (err) {
    next(err)
  }
})

router.get('/status/:orderId', statusLimiter, optionalCustomer, async (req, res, next) => {
  try {
    if (!ORDER_ID_RE.test(req.params.orderId)) return next(notFound('Sipariş bulunamadı'))
    res.json(await paymentService.getPaymentStatus({ orderId: req.params.orderId, customerId: req.customer?.id ?? null, token: bearer(req) }))
  } catch (err) {
    next(err)
  }
})

// Sahte ödeme sayfası: sonucu kaydedip callback'i doğrudan çalıştırır (iyzico'nun tarayıcı POST'unun simülasyonu).
if (env.PAYMENT_PROVIDER === 'fake' && !isProd) {
  router.get('/fake/pay', async (req, res) => {
    const token = typeof req.query.token === 'string' ? req.query.token : ''
    const result = typeof req.query.result === 'string' && FAKE_OUTCOMES.includes(req.query.result) ? req.query.result : 'success'
    setFakeOutcome(token, result)
    const out = await paymentService.handleCallback(token, { ip: req.ip }).catch(() => ({ orderId: null, locale: 'tr', outcome: 'failure' }))
    res.redirect(302, paymentService.resultRedirectUrl(out.orderId, out.locale, out.outcome))
  })
}

export default router

/* ---------------- Callback (originCheck/CSRF'den muaf; çerez kullanmaz) ---------------- */

/**
 * iyzico ödeme sayfası sonucu tarayıcı üzerinden, farklı bir kökenden (Origin: iyzico ya da "null")
 * form-urlencoded POST olarak gönderir; bu yüzden originCheck'ten ÖNCE bağlanır. Güvenlik çerezden
 * değil, token'ın bizim kaydımızda olmasından ve retrieve ile sunucudan sunucuya doğrulamadan gelir.
 * Yanıt her durumda 302'dir (JSON asla).
 */
export const callbackRouter = Router()

callbackRouter.post(
  '/payments/iyzico/callback',
  callbackLimiter,
  express.urlencoded({ extended: false, limit: '10kb', parameterLimit: 20 }),
  async (req, res) => {
    const token = typeof req.body?.token === 'string' ? req.body.token : ''
    let out = { orderId: null, locale: 'tr', outcome: 'failure' }
    try {
      out = await paymentService.handleCallback(token, { ip: req.ip })
    } catch (err) {
      console.error('[payments] callback beklenmeyen hata:', err?.message)
    }
    res.redirect(302, paymentService.resultRedirectUrl(out.orderId, out.locale, out.outcome))
  },
)
