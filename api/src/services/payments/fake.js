/**
 * SAHTE ödeme sağlayıcısı — yalnızca yerel uçtan uca test için (PAYMENT_PROVIDER=fake;
 * env.js üretimde bunu reddeder, fake ödeme uç noktası da yalnızca NODE_ENV!=='production' iken bağlanır).
 *
 * iyzico ile birebir aynı arayüzü (initialize/retrieve/cancel/refund) ve aynı normalize retrieve
 * biçimini üretir. Gerçek bir ödeme sayfası yoktur: `paymentPageUrl`, API'deki
 * `GET /payments/fake/pay?token=…&result=success|failure|amount_mismatch` uç noktasına işaret eder;
 * o uç nokta sonucu kaydeder ve callback işleyicisini doğrudan çalıştırır (iyzico'nun callback POST'unun
 * simülasyonu). Durum süreç belleğindedir (tek süreç; yeniden başlatınca sıfırlanır).
 */
import crypto from 'node:crypto'
import { buildCheckoutFormRequest, normalizeRetrieve, toKurus, fromKurus } from './iyzico.js'

/** token → { orderId, price, paidPrice, outcome, paymentId, cancelled, refunded:Set } */
const sessions = new Map()

export const FAKE_OUTCOMES = ['success', 'failure', 'amount_mismatch', 'fraud']

export function setFakeOutcome(token, outcome) {
  const s = sessions.get(token)
  if (!s || !FAKE_OUTCOMES.includes(outcome)) return false
  s.outcome = outcome
  return true
}

export function createFakeProvider({ publicApiBase }) {
  return {
    name: 'fake',

    async initialize(order, ctx) {
      // Gerçek sağlayıcıyla aynı istek kurallarını (sepet toplamı = ara toplam + kargo) uygular.
      const request = buildCheckoutFormRequest(order, ctx)
      const token = `fake-${crypto.randomBytes(12).toString('hex')}`
      sessions.set(token, {
        orderId: order.id,
        price: request.price,
        paidPrice: request.paidPrice,
        basketLines: request.basketItems.length,
        outcome: 'success',
        paymentId: String(Math.floor(10_000_000 + Math.random() * 89_999_999)),
        refunded: new Set(),
        cancelled: false,
      })
      return { ok: true, token, paymentPageUrl: `${publicApiBase}/payments/fake/pay?token=${encodeURIComponent(token)}` }
    },

    async retrieve({ token }) {
      const s = sessions.get(token)
      if (!s) return normalizeRetrieve({ status: 'failure', errorCode: '5099', errorMessage: 'Token bulunamadı (fake)' }, null)
      const base = {
        status: 'success',
        token,
        conversationId: s.orderId,
        basketId: s.orderId,
        currency: 'TRY',
        price: Number(s.price),
        installment: 1,
        cardAssociation: 'MASTER_CARD',
        cardFamily: 'Bonus',
        lastFourDigits: '0006',
      }
      if (s.outcome === 'failure') {
        return normalizeRetrieve({ ...base, paymentStatus: 'FAILURE', paidPrice: Number(s.paidPrice), errorCode: '10051', errorMessage: 'Kart limiti yetersiz, yetersiz bakiye (fake)' }, null)
      }
      const paidPrice = s.outcome === 'amount_mismatch' ? Number(fromKurus(toKurus(s.paidPrice) - 100)) : Number(s.paidPrice)
      // Kalem işlemleri: tahsil edilen tutar tek kaleme yazılır (fake için yeterli).
      const itemTransactions = [{ paymentTransactionId: `${s.paymentId}01`, paidPrice }]
      return normalizeRetrieve(
        { ...base, paymentStatus: 'SUCCESS', fraudStatus: s.outcome === 'fraud' ? -1 : 1, paymentId: s.paymentId, paidPrice, itemTransactions },
        null,
      )
    },

    async cancel({ paymentId }) {
      for (const s of sessions.values()) {
        if (s.paymentId === paymentId && !s.cancelled) {
          s.cancelled = true
          return { ok: true, errorCode: null, errorMessage: null }
        }
      }
      return { ok: false, errorCode: '5093', errorMessage: 'İptal edilecek ödeme bulunamadı (fake)' }
    },

    async refund({ paymentTransactionId }) {
      for (const s of sessions.values()) {
        if (paymentTransactionId.startsWith(s.paymentId) && !s.refunded.has(paymentTransactionId)) {
          s.refunded.add(paymentTransactionId)
          return { ok: true, errorCode: null, errorMessage: null }
        }
      }
      return { ok: false, errorCode: '5094', errorMessage: 'İade edilecek işlem bulunamadı (fake)' }
    },
  }
}
