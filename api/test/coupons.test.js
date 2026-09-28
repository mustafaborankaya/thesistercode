/** Kupon saf yardımcıları: indirim hesabı (kuruş yuvarlama), kod normalizasyonu, UTC tarih dönüşümü, takip bağlantısı. */
import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.DB_HOST ??= '127.0.0.1'
process.env.DB_NAME ??= 'x'
process.env.DB_USER ??= 'x'
process.env.SESSION_SECRET ??= 'test-secret-0123456789abcdef'
process.env.ADMIN_USERNAME ??= 'admin'
process.env.ADMIN_PASSWORD ??= 'adminpass123'
process.env.UPLOAD_DIR ??= '/tmp/uploads'
process.env.CORS_ORIGIN ??= 'http://localhost:5173'

const { couponDiscountAmount, normalizeCode, COUPON_CODE_RE, toDbDate, fromDbDate } = await import('../src/services/coupons.js')
const { trackingUrl } = await import('../src/services/shipping.js')

test('couponDiscountAmount: yüzde kuruşa yuvarlanır, sabit tutar ara toplamı aşmaz', () => {
  assert.equal(couponDiscountAmount({ type: 'percent', value: 15 }, 5670), 850.5)
  assert.equal(couponDiscountAmount({ type: 'percent', value: 12.5 }, 99.99), 12.5) // 1249.875 kuruş → 1250
  assert.equal(couponDiscountAmount({ type: 'percent', value: 100 }, 1890), 1890)
  assert.equal(couponDiscountAmount({ type: 'fixed', value: 200 }, 150.25), 150.25)
  assert.equal(couponDiscountAmount({ type: 'fixed', value: '49.90' }, 1000), 49.9)
})

test('kod: büyük harfe çevrilir; 4–40, [A-Z0-9_-]', () => {
  assert.equal(normalizeCode('  yaz15 '), 'YAZ15')
  assert.equal(normalizeCode('indirim'), 'INDIRIM') // Türkçe büyük İ üretilmez
  assert.ok(COUPON_CODE_RE.test('YAZ-2026_A'))
  assert.ok(!COUPON_CODE_RE.test('ABC'))
  assert.ok(!COUPON_CODE_RE.test('ÇOK1'))
})

test('tarih: ISO → UTC DATETIME → ISO Z', () => {
  assert.equal(toDbDate('2026-10-01T00:00:00+03:00'), '2026-09-30 21:00:00')
  assert.equal(fromDbDate('2026-09-30 21:00:00'), '2026-09-30T21:00:00.000Z')
  assert.equal(toDbDate(null), null)
})

test('trackingUrl: bilinen firmalar (Türkçe karakter duyarsız), bilinmeyen → null', () => {
  assert.match(trackingUrl('Yurtiçi Kargo', '12 3'), /yurticikargo\.com.*code=12%203$/)
  assert.match(trackingUrl('ARAS', 'A1'), /araskargo/)
  assert.match(trackingUrl('MNG Kargo', 'M1'), /mngkargo/)
  assert.match(trackingUrl('PTT Kargo', 'P1'), /ptt\.gov\.tr/)
  assert.match(trackingUrl('Sürat Kargo', 'S1'), /suratkargo/)
  assert.match(trackingUrl('UPS', '1Z'), /ups\.com/)
  assert.equal(trackingUrl('Bilinmeyen Kargo', '1'), null)
  assert.equal(trackingUrl('Aras', null), null)
})
