/**
 * iyzico Ödeme Formu (Checkout Form) sağlayıcısı — resmi Node SDK'sı `iyzipay` (CommonJS; ESM'den
 * `import Iyzipay from 'iyzipay'` ile varsayılan dışa aktarım olarak yüklenir).
 *
 * Akış: checkoutFormInitialize.create → { token, paymentPageUrl } → müşteri iyzico'nun barındırdığı
 * ödeme sayfasında kartını girer (3D Secure dahil; kart verisi sunucumuza HİÇ gelmez) → iyzico
 * tarayıcıyı `callbackUrl`'e form-urlencoded `token` ile POST eder → checkoutForm.retrieve ile sonuç
 * sunucudan sunucuya doğrulanır.
 *
 * Yanıt imzası (https://docs.iyzico.com/en/advanced/response-signature-validation):
 *   HMAC-SHA256(secretKey, parametreler.join(':')) → hex. Fiyatlardaki gereksiz sondaki sıfırlar atılır.
 *   Initialize: conversationId:token
 *   Retrieve:   paymentStatus:paymentId:currency:basketId:conversationId:paidPrice:price:token
 *
 * Güvenlik: API/secret anahtarı hiçbir zaman loglanmaz; SDK yanıtından yalnızca beyaz listeli alanlar
 * saklanır (bkz. summarizeRetrieve) — cardToken/cardUserKey/binNumber gibi alanlar atılır.
 */
import crypto from 'node:crypto'
import Iyzipay from 'iyzipay'

const REQUEST_TIMEOUT_MS = 20_000

/** Kimlik numarası toplanmıyor; iyzico `buyer.identityNumber` zorunlu tuttuğu için yaygın yer tutucu kullanılır. */
export const PLACEHOLDER_IDENTITY_NUMBER = '11111111111'

/* ---------------- Para yardımcıları (kuruş cinsinden tam sayı) ---------------- */

export function toKurus(value) {
  return Math.round(Number(value) * 100)
}

export function fromKurus(kurus) {
  return (kurus / 100).toFixed(2)
}

/** İmza için fiyat biçimi: "10.00" → "10", "10.50" → "10.5", 10.51 → "10.51". */
export function stripPriceZeros(value) {
  if (value === undefined || value === null) return ''
  let s = typeof value === 'number' ? String(value) : String(value).trim()
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '')
  return s
}

export function hmacSignature(secretKey, parts) {
  return crypto.createHmac('sha256', secretKey).update(parts.map((p) => (p === undefined || p === null ? '' : String(p))).join(':')).digest('hex')
}

function safeEqualHexString(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'))
  } catch {
    return false
  }
}

/** true: imza doğru; false: imza var ama yanlış; null: yanıtta imza yok. */
export function verifyInitializeSignature(secretKey, res) {
  if (!res?.signature) return null
  return safeEqualHexString(hmacSignature(secretKey, [res.conversationId, res.token]), String(res.signature).toLowerCase())
}

export function verifyRetrieveSignature(secretKey, res) {
  if (!res?.signature) return null
  const expected = hmacSignature(secretKey, [
    res.paymentStatus,
    res.paymentId,
    res.currency,
    res.basketId,
    res.conversationId,
    stripPriceZeros(res.paidPrice),
    stripPriceZeros(res.price),
    res.token,
  ])
  return safeEqualHexString(expected, String(res.signature).toLowerCase())
}

/* ---------------- İstek gövdesi ---------------- */

/** Türkiye cep numarasını iyzico'nun beklediği `+90…` biçimine çevirir (diğer ülkeler `+<rakamlar>`). */
export function normalizeGsm(phone) {
  const d = String(phone ?? '').replace(/\D/g, '')
  if (d.length === 12 && d.startsWith('90')) return `+${d}`
  if (d.length === 11 && d.startsWith('0')) return `+9${d}`
  if (d.length === 10 && d.startsWith('5')) return `+90${d}`
  return d ? `+${d}` : ''
}

function clip(s, n) {
  return String(s ?? '').slice(0, n)
}

/**
 * Siparişten (services/orders.js formatOrder çıktısı, items dahil) iyzico checkoutFormInitialize
 * isteğini üretir. Saf fonksiyon — birim testinde doğrudan doğrulanır.
 *  - basketItems: her satır `unitPrice × qty`; kargo tanımlı ve > 0 ise ayrı "Kargo" kalemi.
 *  - price = sepet kalemleri toplamı (ara toplam + kargo); paidPrice = siparişin genel toplamı
 *    (üyelik indirimi sonrası + kargo). Tüm hesap kuruş cinsinden tam sayıyla yapılır.
 */
export function buildCheckoutFormRequest(order, { callbackUrl, installments, ip, customerId, registeredAt }) {
  const items = order.items ?? []
  if (!items.length) throw new Error('Sipariş kalemi yok')
  const basketItems = []
  let priceKurus = 0
  for (const item of items) {
    const lineKurus = toKurus(item.unitPrice) * item.qty
    if (lineKurus <= 0) throw new Error(`Sıfır tutarlı kalem: ${item.productId}`)
    priceKurus += lineKurus
    basketItems.push({
      id: clip(`${item.productId}-${item.colorId}-${item.size}`, 64),
      name: clip(`${item.productName} (${item.colorLabel} / ${item.size}) x${item.qty}`, 200),
      category1: 'Giyim',
      itemType: Iyzipay.BASKET_ITEM_TYPE.PHYSICAL,
      price: fromKurus(lineKurus),
    })
  }
  const shippingKurus = order.totals.shipping == null ? 0 : toKurus(order.totals.shipping)
  if (shippingKurus > 0) {
    priceKurus += shippingKurus
    basketItems.push({ id: 'KARGO', name: 'Kargo', category1: 'Kargo', itemType: Iyzipay.BASKET_ITEM_TYPE.VIRTUAL, price: fromKurus(shippingKurus) })
  }
  const expectedPriceKurus = toKurus(order.totals.subtotal) + shippingKurus
  if (priceKurus !== expectedPriceKurus) throw new Error('Sepet toplamı siparişin ara toplamıyla eşleşmiyor')
  const paidKurus = toKurus(order.totals.total)
  if (paidKurus <= 0) throw new Error('Tahsil edilecek tutar sıfır')

  const d = order.delivery
  const contactName = clip(`${d.firstName} ${d.lastName}`, 100)
  const fullAddress = clip(`${d.address} ${d.district}`.trim(), 250)
  const address = { contactName, city: clip(d.city, 50), country: clip(d.country || 'Türkiye', 50), address: fullAddress, zipCode: clip(d.postalCode, 20) }

  return {
    locale: order.locale === 'en' ? Iyzipay.LOCALE.EN : Iyzipay.LOCALE.TR,
    conversationId: order.id,
    price: fromKurus(priceKurus),
    paidPrice: fromKurus(paidKurus),
    currency: Iyzipay.CURRENCY.TRY,
    basketId: order.id,
    paymentGroup: Iyzipay.PAYMENT_GROUP.PRODUCT,
    callbackUrl,
    enabledInstallments: installments,
    buyer: {
      id: customerId ? `C${customerId}` : `G-${order.id}`,
      name: clip(d.firstName, 50),
      surname: clip(d.lastName, 50),
      gsmNumber: normalizeGsm(order.contact.phone),
      email: order.contact.email,
      identityNumber: PLACEHOLDER_IDENTITY_NUMBER,
      registrationDate: registeredAt || undefined,
      registrationAddress: fullAddress,
      ip: ip || '127.0.0.1',
      city: address.city,
      country: address.country,
      zipCode: address.zipCode,
    },
    shippingAddress: address,
    billingAddress: address,
    basketItems,
  }
}

/* ---------------- Yanıt normalizasyonu ---------------- */

/** Saklanacak beyaz listeli özet — kart numarası/token/cardUserKey/binNumber içermez. */
export function summarizeRetrieve(res) {
  if (!res || typeof res !== 'object') return null
  return {
    status: res.status,
    paymentStatus: res.paymentStatus,
    fraudStatus: res.fraudStatus,
    paymentId: res.paymentId,
    conversationId: res.conversationId,
    basketId: res.basketId,
    currency: res.currency,
    price: res.price,
    paidPrice: res.paidPrice,
    installment: res.installment,
    cardType: res.cardType,
    cardAssociation: res.cardAssociation,
    cardFamily: res.cardFamily,
    lastFourDigits: res.lastFourDigits,
    mdStatus: res.mdStatus,
    authCode: res.authCode,
    errorCode: res.errorCode,
    errorMessage: res.errorMessage,
    errorGroup: res.errorGroup,
    systemTime: res.systemTime,
    itemTransactionCount: Array.isArray(res.itemTransactions) ? res.itemTransactions.length : 0,
  }
}

/** retrieve yanıtını sağlayıcıdan bağımsız biçime çevirir (fake sağlayıcı da aynı biçimi üretir). */
export function normalizeRetrieve(res, signatureValid) {
  return {
    status: res?.status ?? 'failure',
    paymentStatus: res?.paymentStatus ?? null,
    fraudStatus: res?.fraudStatus === undefined || res?.fraudStatus === null ? null : Number(res.fraudStatus),
    paymentId: res?.paymentId ? String(res.paymentId) : null,
    conversationId: res?.conversationId ?? null,
    basketId: res?.basketId ?? null,
    token: res?.token ?? null,
    currency: res?.currency ?? null,
    price: res?.price ?? null,
    paidPrice: res?.paidPrice ?? null,
    installment: res?.installment == null ? null : Number(res.installment),
    cardAssociation: res?.cardAssociation ?? null,
    cardFamily: res?.cardFamily ?? null,
    lastFour: res?.lastFourDigits ? String(res.lastFourDigits).slice(-4) : null,
    itemTransactions: Array.isArray(res?.itemTransactions)
      ? res.itemTransactions.map((t) => ({ id: String(t.paymentTransactionId), paidPrice: Number(t.paidPrice) }))
      : [],
    errorCode: res?.errorCode ? String(res.errorCode) : null,
    errorMessage: res?.errorMessage ? String(res.errorMessage) : null,
    signatureValid,
    summary: summarizeRetrieve(res),
  }
}

/* ---------------- Sağlayıcı ---------------- */

function call(resource, method, params) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('iyzico isteği zaman aşımına uğradı')), REQUEST_TIMEOUT_MS)
    try {
      resource[method](params, (err, result) => {
        clearTimeout(timer)
        if (err) reject(new Error(`iyzico bağlantı hatası: ${err.code || err.message || 'bilinmiyor'}`))
        else resolve(result)
      })
    } catch (err) {
      clearTimeout(timer)
      reject(err)
    }
  })
}

/**
 * @param {{ apiKey: string, secretKey: string, baseUrl: string, client?: object }} cfg
 *   `client` birim testinde sahte SDK istemcisi enjekte etmek içindir.
 */
export function createIyzicoProvider({ apiKey, secretKey, baseUrl, client }) {
  const iyzipay = client ?? new Iyzipay({ apiKey, secretKey, uri: baseUrl })

  return {
    name: 'iyzico',

    /** @returns {Promise<{ok:true, token:string, paymentPageUrl:string} | {ok:false, errorCode:string|null, errorMessage:string|null}>} */
    async initialize(order, ctx) {
      const request = buildCheckoutFormRequest(order, ctx)
      const res = await call(iyzipay.checkoutFormInitialize, 'create', request)
      if (res?.status !== 'success' || !res.token || !res.paymentPageUrl) {
        return { ok: false, errorCode: res?.errorCode ? String(res.errorCode) : 'init_failed', errorMessage: res?.errorMessage ?? null }
      }
      const sig = verifyInitializeSignature(secretKey, res)
      if (sig === false) return { ok: false, errorCode: 'signature_mismatch', errorMessage: 'Başlatma yanıtının imzası doğrulanamadı' }
      if (res.conversationId && res.conversationId !== order.id) return { ok: false, errorCode: 'order_mismatch', errorMessage: 'conversationId eşleşmiyor' }
      return { ok: true, token: String(res.token), paymentPageUrl: String(res.paymentPageUrl), tokenExpireTime: res.tokenExpireTime ?? null }
    },

    async retrieve({ token, conversationId, locale }) {
      const res = await call(iyzipay.checkoutForm, 'retrieve', { locale: locale === 'en' ? 'en' : 'tr', conversationId, token })
      return normalizeRetrieve(res, verifyRetrieveSignature(secretKey, res))
    },

    /** Aynı gün (gün sonu mutabakatından önce) tam iptal — ekstreye yansımaz. */
    async cancel({ paymentId, ip, conversationId, locale }) {
      const res = await call(iyzipay.cancel, 'create', { locale: locale === 'en' ? 'en' : 'tr', conversationId, paymentId, ip })
      return { ok: res?.status === 'success', errorCode: res?.errorCode ? String(res.errorCode) : null, errorMessage: res?.errorMessage ?? null }
    },

    /** Kalem (paymentTransactionId) bazında iade — 365 güne kadar, ekstreye yansır. */
    async refund({ paymentTransactionId, price, ip, conversationId, locale }) {
      const res = await call(iyzipay.refund, 'create', {
        locale: locale === 'en' ? 'en' : 'tr',
        conversationId,
        paymentTransactionId,
        price: fromKurus(toKurus(price)),
        currency: Iyzipay.CURRENCY.TRY,
        ip,
      })
      return { ok: res?.status === 'success', errorCode: res?.errorCode ? String(res.errorCode) : null, errorMessage: res?.errorMessage ?? null }
    },
  }
}
