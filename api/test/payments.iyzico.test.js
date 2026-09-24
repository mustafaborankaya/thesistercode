/**
 * iyzico sağlayıcısı birim testleri — ağ/anahtar gerektirmez.
 *   cd api && node --test test/
 * 1) buildCheckoutFormRequest: tutar kuralları (kuruş), zorunlu alanlar
 * 2) Sahte SDK istemcisi (mock client): initialize/retrieve/cancel/refund çağrı parametreleri + imza doğrulaması
 * 3) GERÇEK iyzipay SDK'sı → yerel sahte HTTP sunucusu: SDK'nın ürettiği gövde/uç nokta/Authorization biçimi
 * 4) validateRetrieve: tutar/sipariş/para birimi/imza/fraud/taksit kuralları
 * İmza referans değerleri openssl ile bağımsız hesaplandı:
 *   printf '<parçalar>' | openssl dgst -sha256 -hmac 'sandbox-secret'
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import Iyzipay from 'iyzipay'
import {
  buildCheckoutFormRequest,
  createIyzicoProvider,
  hmacSignature,
  normalizeGsm,
  stripPriceZeros,
  verifyRetrieveSignature,
  PLACEHOLDER_IDENTITY_NUMBER,
} from '../src/services/payments/iyzico.js'

// service.js env/db içe aktarır; havuz tembeldir (bağlanmaz) — yalnızca saf validateRetrieve kullanılır.
Object.assign(process.env, {
  NODE_ENV: 'test',
  DB_HOST: '127.0.0.1',
  DB_NAME: 'x',
  DB_USER: 'x',
  SESSION_SECRET: '0123456789abcdef0123',
  ADMIN_USERNAME: 'x',
  ADMIN_PASSWORD: 'xxxxxxxx',
  UPLOAD_DIR: '/tmp',
  CORS_ORIGIN: 'http://localhost',
  PAYMENT_PROVIDER: 'none',
})
const { validateRetrieve } = await import('../src/services/payments/service.js')

const SECRET = 'sandbox-secret'
const ORDER_ID = 'TSV-20260924-0001'

const order = {
  id: ORDER_ID,
  locale: 'en',
  status: 'pending_payment',
  contact: { email: 'ayse@example.test', phone: '0532 000 00 00' },
  delivery: { firstName: 'Ayşe', lastName: 'Deneme', address: 'Test Mah. 1', district: 'Şişli', city: 'İstanbul', postalCode: '34000', country: 'Türkiye' },
  totals: { subtotal: 8500, discountPercent: 10, discountAmount: 850, shipping: 49.9, total: 7699.9 },
  items: [
    { productId: 'urun-01', productName: 'Ürün 01', colorId: 'renk-1', colorLabel: 'Siyah', size: 'M', qty: 2, unitPrice: 4250 },
  ],
}
const ctx = { callbackUrl: 'https://teshvikiye.com/api/payments/iyzico/callback', installments: [1, 2, 3, 6, 9], ip: '85.34.78.112', customerId: 7 }

test('buildCheckoutFormRequest: price = kalemler toplamı (ara toplam + kargo), paidPrice = genel toplam', () => {
  const r = buildCheckoutFormRequest(order, ctx)
  assert.equal(r.price, '8549.90')
  assert.equal(r.paidPrice, '7699.90')
  const sum = r.basketItems.reduce((s, i) => s + Math.round(Number(i.price) * 100), 0)
  assert.equal(sum, 854990)
  assert.deepEqual(
    r.basketItems.map((i) => [i.id, i.price, i.itemType]),
    [
      ['urun-01-renk-1-M', '8500.00', 'PHYSICAL'],
      ['KARGO', '49.90', 'VIRTUAL'],
    ],
  )
  assert.equal(r.currency, 'TRY')
  assert.equal(r.locale, 'en')
  assert.equal(r.conversationId, ORDER_ID)
  assert.equal(r.basketId, ORDER_ID)
  assert.equal(r.paymentGroup, 'PRODUCT')
  assert.equal(r.callbackUrl, ctx.callbackUrl)
  assert.deepEqual(r.enabledInstallments, [1, 2, 3, 6, 9])
  assert.equal(r.buyer.id, 'C7')
  assert.equal(r.buyer.gsmNumber, '+905320000000')
  assert.equal(r.buyer.identityNumber, PLACEHOLDER_IDENTITY_NUMBER)
  assert.equal(r.buyer.ip, '85.34.78.112')
  assert.equal(r.buyer.email, 'ayse@example.test')
  assert.equal(r.shippingAddress.contactName, 'Ayşe Deneme')
  assert.equal(r.billingAddress.address, 'Test Mah. 1 Şişli')
})

test('buildCheckoutFormRequest: kargo null → kargo kalemi yok; misafir buyer id', () => {
  const r = buildCheckoutFormRequest({ ...order, totals: { ...order.totals, shipping: null, total: 7650 } }, { ...ctx, customerId: null })
  assert.equal(r.price, '8500.00')
  assert.equal(r.paidPrice, '7650.00')
  assert.equal(r.basketItems.length, 1)
  assert.equal(r.buyer.id, `G-${ORDER_ID}`)
})

test('buildCheckoutFormRequest: kalem toplamı ara toplamla uyuşmazsa hata', () => {
  assert.throws(() => buildCheckoutFormRequest({ ...order, totals: { ...order.totals, subtotal: 8499 } }, ctx), /eşleşmiyor/)
})

test('normalizeGsm / stripPriceZeros', () => {
  assert.equal(normalizeGsm('05320000000'), '+905320000000')
  assert.equal(normalizeGsm('+90 532 000 00 00'), '+905320000000')
  assert.equal(normalizeGsm('5320000000'), '+905320000000')
  assert.equal(stripPriceZeros('10.00'), '10')
  assert.equal(stripPriceZeros('10.50'), '10.5')
  assert.equal(stripPriceZeros('10.510'), '10.51')
  assert.equal(stripPriceZeros(7699.9), '7699.9')
  assert.equal(stripPriceZeros(100), '100')
})

test('imza: openssl referans değerleriyle birebir', () => {
  assert.equal(
    hmacSignature(SECRET, ['SUCCESS', '12345', 'TRY', ORDER_ID, ORDER_ID, '7699.9', '8549.9', 'tok-abc']),
    '48b2ca4718ed34866d3834ee3479f79e8384d692d0a3bca7fa2aec36172f72f0',
  )
  assert.equal(hmacSignature(SECRET, [ORDER_ID, 'tok-abc']), '10e1a81241706dc32dbf06cfd90cffd340f64835ef0da400e939aab7ce3255fb')
  const res = { paymentStatus: 'SUCCESS', paymentId: '12345', currency: 'TRY', basketId: ORDER_ID, conversationId: ORDER_ID, paidPrice: '7699.90', price: 8549.9, token: 'tok-abc', signature: '48b2ca4718ed34866d3834ee3479f79e8384d692d0a3bca7fa2aec36172f72f0' }
  assert.equal(verifyRetrieveSignature(SECRET, res), true)
  assert.equal(verifyRetrieveSignature(SECRET, { ...res, paidPrice: '7698.90' }), false)
  assert.equal(verifyRetrieveSignature(SECRET, { ...res, signature: undefined }), null)
})

/* ---------------- Mock SDK istemcisi ---------------- */

function mockClient(responses) {
  const calls = []
  const resource = (name) => ({
    create(params, cb) {
      calls.push({ name, method: 'create', params })
      setImmediate(() => cb(null, responses[name](params)))
    },
    retrieve(params, cb) {
      calls.push({ name, method: 'retrieve', params })
      setImmediate(() => cb(null, responses[name](params)))
    },
  })
  return {
    calls,
    client: {
      checkoutFormInitialize: resource('checkoutFormInitialize'),
      checkoutForm: resource('checkoutForm'),
      cancel: resource('cancel'),
      refund: resource('refund'),
    },
  }
}

test('provider (mock client): initialize parametreleri + imza doğrulaması', async () => {
  const { client, calls } = mockClient({
    checkoutFormInitialize: (p) => ({
      status: 'success',
      conversationId: p.conversationId,
      token: 'tok-abc',
      paymentPageUrl: 'https://sandbox-cpp.iyzipay.com?token=tok-abc&lang=en',
      signature: hmacSignature(SECRET, [p.conversationId, 'tok-abc']),
    }),
  })
  const provider = createIyzicoProvider({ apiKey: 'k', secretKey: SECRET, baseUrl: 'https://sandbox-api.iyzipay.com', client })
  const r = await provider.initialize(order, ctx)
  assert.deepEqual(r, { ok: true, token: 'tok-abc', paymentPageUrl: 'https://sandbox-cpp.iyzipay.com?token=tok-abc&lang=en', tokenExpireTime: null })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].name, 'checkoutFormInitialize')
  assert.equal(calls[0].params.price, '8549.90')
  assert.equal(calls[0].params.paidPrice, '7699.90')
  assert.equal(calls[0].params.callbackUrl, ctx.callbackUrl)
})

test('provider (mock client): initialize imzası yanlış → reddedilir; iyzico hatası → ok:false', async () => {
  const bad = mockClient({ checkoutFormInitialize: (p) => ({ status: 'success', conversationId: p.conversationId, token: 't', paymentPageUrl: 'u', signature: 'deadbeef' }) })
  const r1 = await createIyzicoProvider({ apiKey: 'k', secretKey: SECRET, baseUrl: 'x', client: bad.client }).initialize(order, ctx)
  assert.equal(r1.ok, false)
  assert.equal(r1.errorCode, 'signature_mismatch')
  const err = mockClient({ checkoutFormInitialize: () => ({ status: 'failure', errorCode: '1001', errorMessage: 'api bilgileri bulunamadı' }) })
  const r2 = await createIyzicoProvider({ apiKey: 'k', secretKey: SECRET, baseUrl: 'x', client: err.client }).initialize(order, ctx)
  assert.deepEqual(r2, { ok: false, errorCode: '1001', errorMessage: 'api bilgileri bulunamadı' })
})

test('provider (mock client): retrieve normalize + imza, cancel/refund parametreleri', async () => {
  const retrieveRes = {
    status: 'success',
    paymentStatus: 'SUCCESS',
    fraudStatus: 1,
    paymentId: '12345',
    conversationId: ORDER_ID,
    basketId: ORDER_ID,
    token: 'tok-abc',
    currency: 'TRY',
    price: 8549.9,
    paidPrice: 7699.9,
    installment: 1,
    cardAssociation: 'MASTER_CARD',
    cardFamily: 'Bonus',
    lastFourDigits: '0006',
    binNumber: '552608',
    cardToken: 'GİZLİ',
    cardUserKey: 'GİZLİ',
    itemTransactions: [{ paymentTransactionId: '777', paidPrice: 7699.9, price: 8549.9 }],
    signature: '48b2ca4718ed34866d3834ee3479f79e8384d692d0a3bca7fa2aec36172f72f0',
  }
  const { client, calls } = mockClient({
    checkoutForm: () => retrieveRes,
    cancel: () => ({ status: 'success' }),
    refund: () => ({ status: 'failure', errorCode: '5092', errorMessage: 'iade edilemez' }),
  })
  const provider = createIyzicoProvider({ apiKey: 'k', secretKey: SECRET, baseUrl: 'x', client })
  const r = await provider.retrieve({ token: 'tok-abc', conversationId: ORDER_ID, locale: 'en' })
  assert.deepEqual(calls[0].params, { locale: 'en', conversationId: ORDER_ID, token: 'tok-abc' })
  assert.equal(r.signatureValid, true)
  assert.equal(r.paymentId, '12345')
  assert.equal(r.lastFour, '0006')
  assert.deepEqual(r.itemTransactions, [{ id: '777', paidPrice: 7699.9 }])
  // Saklanan özet kart token'ı / BIN / cardUserKey içermez
  const summary = JSON.stringify(r.summary)
  assert.ok(!summary.includes('GİZLİ') && !summary.includes('552608'))

  const c = await provider.cancel({ paymentId: '12345', ip: '1.2.3.4', conversationId: ORDER_ID })
  assert.equal(c.ok, true)
  assert.deepEqual(calls[1].params, { locale: 'tr', conversationId: ORDER_ID, paymentId: '12345', ip: '1.2.3.4' })
  const rf = await provider.refund({ paymentTransactionId: '777', price: 7699.9, ip: '1.2.3.4', conversationId: ORDER_ID })
  assert.deepEqual(rf, { ok: false, errorCode: '5092', errorMessage: 'iade edilemez' })
  assert.deepEqual(calls[2].params, { locale: 'tr', conversationId: ORDER_ID, paymentTransactionId: '777', price: '7699.90', currency: 'TRY', ip: '1.2.3.4' })
})

/* ---------------- Gerçek SDK → yerel sahte iyzico sunucusu ---------------- */

test('gerçek iyzipay SDK: uç nokta, JSON gövde ve IYZWSv2 Authorization başlığı', async () => {
  const seen = []
  const server = http.createServer((req, res) => {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      seen.push({ url: req.url, auth: req.headers.authorization, rnd: req.headers['x-iyzi-rnd'], body: JSON.parse(body || '{}') })
      res.setHeader('Content-Type', 'application/json')
      const b = JSON.parse(body || '{}')
      if (req.url.endsWith('/initialize/auth/ecom')) {
        res.end(JSON.stringify({ status: 'success', conversationId: b.conversationId, token: 'tok-abc', paymentPageUrl: 'https://sandbox-cpp.iyzipay.com?token=tok-abc', signature: hmacSignature(SECRET, [b.conversationId, 'tok-abc']) }))
      } else {
        res.end(JSON.stringify({ status: 'failure', errorCode: '5000' }))
      }
    })
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const { port } = server.address()
  try {
    const provider = createIyzicoProvider({ apiKey: 'sandbox-key', secretKey: SECRET, baseUrl: `http://127.0.0.1:${port}` })
    const r = await provider.initialize(order, ctx)
    assert.equal(r.ok, true)
    const init = seen[0]
    assert.equal(init.url, '/payment/iyzipos/checkoutform/initialize/auth/ecom')
    assert.match(init.auth, /^IYZWSv2 /)
    assert.ok(!init.auth.includes(SECRET), 'secret başlıkta düz metin olmamalı')
    assert.equal(init.body.price, '8549.9')
    assert.equal(init.body.paidPrice, '7699.9')
    assert.equal(init.body.currency, 'TRY')
    assert.equal(init.body.basketItems.length, 2)
    assert.equal(init.body.basketItems[0].price, '8500.0')
    assert.deepEqual(init.body.enabledInstallments, [1, 2, 3, 6, 9])
    assert.equal(init.body.buyer.identityNumber, PLACEHOLDER_IDENTITY_NUMBER)
    assert.equal(typeof Iyzipay, 'function') // ESM'den varsayılan içe aktarım çalışıyor

    const rr = await provider.retrieve({ token: 'tok-abc', conversationId: ORDER_ID, locale: 'tr' })
    assert.equal(seen[1].url, '/payment/iyzipos/checkoutform/auth/ecom/detail')
    assert.deepEqual(seen[1].body, { locale: 'tr', conversationId: ORDER_ID, token: 'tok-abc' })
    assert.equal(rr.status, 'failure')
  } finally {
    server.close()
  }
})

/* ---------------- validateRetrieve ---------------- */

test('validateRetrieve: tutar/sipariş/para birimi/imza/fraud/taksit', () => {
  const payment = { order_id: ORDER_ID, price: 8549.9, paid_price: 7699.9 }
  const good = { status: 'success', paymentStatus: 'SUCCESS', token: 'tok', conversationId: ORDER_ID, basketId: ORDER_ID, currency: 'TRY', fraudStatus: 1, paymentId: '1', price: 8549.9, paidPrice: 7699.9, installment: 1, signatureValid: true }
  assert.equal(validateRetrieve(good, payment, 'tok'), null)
  assert.equal(validateRetrieve({ ...good, signatureValid: null }, payment, 'tok'), null)
  assert.equal(validateRetrieve({ ...good, signatureValid: false }, payment, 'tok').code, 'signature_mismatch')
  assert.equal(validateRetrieve({ ...good, paidPrice: 7699.8 }, payment, 'tok').code, 'amount_mismatch')
  assert.equal(validateRetrieve({ ...good, paidPrice: 7700 }, payment, 'tok').code, 'amount_mismatch')
  assert.equal(validateRetrieve({ ...good, price: 100 }, payment, 'tok').code, 'amount_mismatch')
  assert.equal(validateRetrieve({ ...good, conversationId: 'TSV-20260924-9999' }, payment, 'tok').code, 'order_mismatch')
  assert.equal(validateRetrieve({ ...good, currency: 'USD' }, payment, 'tok').code, 'currency_mismatch')
  assert.equal(validateRetrieve({ ...good, fraudStatus: -1 }, payment, 'tok').code, 'fraud_rejected')
  assert.equal(validateRetrieve({ ...good, token: 'baska' }, payment, 'tok').code, 'token_mismatch')
  assert.equal(validateRetrieve({ ...good, paymentStatus: 'FAILURE', errorCode: '10051' }, payment, 'tok').code, '10051')
  // Taksit: vade farkı müşteriye yansıtılmışsa paidPrice beklenenden büyük olabilir (≤ ×1,5); düşük asla.
  assert.equal(validateRetrieve({ ...good, installment: 6, paidPrice: 8200.55 }, payment, 'tok'), null)
  assert.equal(validateRetrieve({ ...good, installment: 6, paidPrice: 7000 }, payment, 'tok').code, 'amount_mismatch')
  assert.equal(validateRetrieve({ ...good, installment: 6, paidPrice: 20000 }, payment, 'tok').code, 'amount_mismatch')
})
