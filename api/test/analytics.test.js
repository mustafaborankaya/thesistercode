/**
 * Analitik saf yardımcıları (DB gerektirmez): UA ayrıştırma, olay normalizasyonu/doğrulama, referrer host;
 * "Beni hatırla" için müşteri JWT süresi (24 saat / 30 gün) ve çerez ömrü.
 *   cd api && node --test test/
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import jwt from 'jsonwebtoken'

process.env.DB_HOST ??= '127.0.0.1'
process.env.DB_NAME ??= 'x'
process.env.DB_USER ??= 'x'
process.env.SESSION_SECRET ??= 'test-secret-0123456789abcdef'
process.env.ADMIN_USERNAME ??= 'admin'
process.env.ADMIN_PASSWORD ??= 'adminpass123'
process.env.UPLOAD_DIR ??= '/tmp/uploads'
process.env.CORS_ORIGIN ??= 'http://localhost:5173,https://www.teshvikiye.com'
process.env.SITE_URL ??= 'https://teshvikiye.com'

const { parseUserAgent, normalizeEvent, normalizeBatch, referrerHost, isBotUserAgent } = await import('../src/services/analytics.js')
const { signCustomerToken, setCustomerCookie, CUSTOMER_TTL_SEC, CUSTOMER_SESSION_TTL_SEC } = await import('../src/auth.js')
const { ApiError } = await import('../src/errors.js')

const UA = {
  safariIphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  chromeAndroidTablet: 'Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  chromeAndroidPhone: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
  chromeMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  edgeWindows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.2478.80',
  safariIpad: 'Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
  firefoxLinux: 'Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0',
  googlebot: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
}

test('parseUserAgent: Safari iPhone → mobile / Safari / iOS', () => {
  assert.deepEqual(parseUserAgent(UA.safariIphone), { device: 'mobile', browser: 'Safari', os: 'iOS', isBot: false })
})

test('parseUserAgent: Chrome Android tablet (Mobile yok) → tablet; telefon → mobile', () => {
  assert.deepEqual(parseUserAgent(UA.chromeAndroidTablet), { device: 'tablet', browser: 'Chrome', os: 'Android', isBot: false })
  assert.equal(parseUserAgent(UA.chromeAndroidPhone).device, 'mobile')
  assert.equal(parseUserAgent(UA.safariIpad).device, 'tablet')
})

test('parseUserAgent: Chrome Mac → desktop / Chrome / macOS; Edge Windows → Edge (Chrome değil)', () => {
  assert.deepEqual(parseUserAgent(UA.chromeMac), { device: 'desktop', browser: 'Chrome', os: 'macOS', isBot: false })
  assert.deepEqual(parseUserAgent(UA.edgeWindows), { device: 'desktop', browser: 'Edge', os: 'Windows', isBot: false })
  assert.deepEqual(parseUserAgent(UA.firefoxLinux), { device: 'desktop', browser: 'Firefox', os: 'Linux', isBot: false })
})

test('parseUserAgent: Googlebot / curl → isBot; normal tarayıcılar bot değil', () => {
  assert.equal(parseUserAgent(UA.googlebot).isBot, true)
  assert.equal(isBotUserAgent('curl/8.4.0'), true)
  assert.equal(isBotUserAgent('python-requests/2.31'), true)
  assert.equal(isBotUserAgent(UA.chromeMac), false)
  assert.equal(isBotUserAgent(''), false)
})

test('parseUserAgent: boş UA → cihaz vw yedeğinden; vw yoksa other', () => {
  assert.equal(parseUserAgent('', 390).device, 'mobile')
  assert.equal(parseUserAgent('', 800).device, 'tablet')
  assert.equal(parseUserAgent('', 1440).device, 'desktop')
  assert.deepEqual(parseUserAgent(''), { device: 'other', browser: null, os: null, isBot: false })
  assert.deepEqual(parseUserAgent(undefined), { device: 'other', browser: null, os: null, isBot: false })
})

const VID = 'a'.repeat(32)
const SID = '0123456789abcdef0123456789abcdef'
const OWN = ['localhost', 'teshvikiye.com']

test('normalizeEvent: geçerli page_view → DB satırı (türetilen alanlar)', () => {
  const row = normalizeEvent(
    {
      type: 'page_view',
      path: '/urun/x',
      locale: 'en',
      vid: VID,
      sid: SID,
      entry: true,
      ref: 'https://www.google.com/search?q=elbise',
      utm: { source: 'instagram', medium: 'social', campaign: ' yaz26 ' },
      vw: 1440.6,
      meta: { a: 1 },
      extra: 'yok sayılır',
    },
    { ua: UA.chromeMac, isMember: true, ownHosts: OWN },
  )
  assert.deepEqual(row, {
    type: 'page_view',
    visitor_id: VID,
    session_id: SID,
    is_entry: 1,
    is_member: 1,
    path: '/urun/x',
    locale: 'en',
    referrer_host: 'google.com',
    utm_source: 'instagram',
    utm_medium: 'social',
    utm_campaign: 'yaz26',
    device: 'desktop',
    browser: 'Chrome',
    os: 'macOS',
    vw: 1441,
    product_id: null,
    query: null,
    value: null,
    meta: '{"a":1}',
  })
  assert.equal('extra' in row, false)
})

test('normalizeEvent: vid/sid yok → NULL, entry yalnızca page_view için, value 2 ondalık, query kırpılır', () => {
  const row = normalizeEvent(
    { type: 'add_to_cart', productId: 'urun-01', value: 1250.555, entry: true, vid: null, sid: null, meta: { colorId: 'siyah', size: 'M', qty: 2 } },
    { ua: UA.safariIphone, isMember: false },
  )
  assert.equal(row.visitor_id, null)
  assert.equal(row.session_id, null)
  assert.equal(row.is_entry, 0)
  assert.equal(row.is_member, 0)
  assert.equal(row.value, 1250.56)
  assert.equal(row.product_id, 'urun-01')
  assert.equal(row.device, 'mobile')
  const search = normalizeEvent({ type: 'search', query: `  ${'e'.repeat(200)}  `, meta: { results: 0 } }, {})
  assert.equal(search.query.length, 120)
  assert.equal(search.meta, '{"results":0}')
})

test('normalizeEvent: geçersiz örnekler 400 validation_error', () => {
  const bad = (raw, re) => {
    assert.throws(() => normalizeEvent(raw, {}), (err) => err instanceof ApiError && err.status === 400 && err.code === 'validation_error' && re.test(err.message))
  }
  bad({ type: 'page_view', vid: 'ABC' }, /vid/) // büyük harf / kısa
  bad({ type: 'page_view', vid: 'g'.repeat(32) }, /vid/) // hex dışı
  bad({ type: 'page_view', path: `/${'a'.repeat(300)}` }, /path/) // > 255
  bad({ type: 'page_view', path: 'urun/x' }, /path/) // '/' ile başlamıyor
  bad({ type: 'page_view', path: '/urun?x=1' }, /path/) // sorgu dizesi
  bad({ type: 'page_view', path: '/urun#a' }, /path/) // hash
  bad({ type: 'login' }, /type/) // bilinmeyen type
  bad({ type: 'add_to_cart', value: -1 }, /value/)
  bad({ type: 'add_to_cart', value: 10_000_000 }, /value/)
  bad({ type: 'page_view', locale: 'de' }, /locale/)
  bad({ type: 'page_view', meta: [1, 2] }, /meta/) // düz nesne değil
  bad({ type: 'page_view', meta: { big: 'x'.repeat(1100) } }, /meta/) // > 1 KB
  bad({ type: 'page_view', vw: 'geniş' }, /vw/)
  bad('page_view', /./)
})

test('normalizeEvent: referrer — kendi host → null, www soyulur, geçersiz URL → null', () => {
  const ctx = { ownHosts: OWN }
  assert.equal(normalizeEvent({ type: 'page_view', entry: true, ref: 'https://www.teshvikiye.com/koleksiyon' }, ctx).referrer_host, null)
  assert.equal(normalizeEvent({ type: 'page_view', entry: true, ref: 'http://localhost:5173/' }, ctx).referrer_host, null)
  assert.equal(normalizeEvent({ type: 'page_view', entry: true, ref: 'https://www.instagram.com/p/abc' }, ctx).referrer_host, 'instagram.com')
  assert.equal(normalizeEvent({ type: 'page_view', entry: true, ref: 'https://L.Facebook.COM/l.php' }, ctx).referrer_host, 'l.facebook.com')
  assert.equal(normalizeEvent({ type: 'page_view', entry: true, ref: 'bozuk referer' }, ctx).referrer_host, null)
  assert.equal(normalizeEvent({ type: 'page_view', entry: true, ref: '' }, ctx).referrer_host, null)
  // env'den türetilen kendi host'lar (CORS_ORIGIN + SITE_URL): www.teshvikiye.com → teshvikiye.com
  assert.equal(referrerHost('https://teshvikiye.com/'), null)
  assert.equal(referrerHost('https://www.teshvikiye.com/x'), null)
  assert.equal(referrerHost('http://localhost:5173/x'), null)
  assert.equal(referrerHost('https://www.google.com.tr/'), 'google.com.tr')
})

test('normalizeEvent: utm kırpılır (80/80/120), boş → null; utm null kabul', () => {
  const row = normalizeEvent(
    { type: 'page_view', entry: true, utm: { source: 's'.repeat(100), medium: '  ', campaign: 'c'.repeat(200) } },
    {},
  )
  assert.equal(row.utm_source.length, 80)
  assert.equal(row.utm_medium, null)
  assert.equal(row.utm_campaign.length, 120)
  assert.equal(normalizeEvent({ type: 'page_view', utm: null }, {}).utm_source, null)
})

test('normalizeBatch: ≤20 olay; events eksik ya da 21 olay → 400', () => {
  const ev = { type: 'page_view', path: '/' }
  assert.equal(normalizeBatch({ events: [] }).length, 0)
  assert.equal(normalizeBatch({ events: Array(20).fill(ev) }, { ua: UA.chromeMac }).length, 20)
  assert.throws(() => normalizeBatch({ events: Array(21).fill(ev) }), (err) => err instanceof ApiError && err.status === 400)
  assert.throws(() => normalizeBatch({}), (err) => err instanceof ApiError && err.status === 400)
  assert.throws(() => normalizeBatch({ events: [ev, { type: 'nope' }] }), (err) => err instanceof ApiError && err.status === 400)
})

test('beni hatırla: JWT süresi remember=true → 30 gün, yoksa 24 saat', () => {
  const customer = { id: 7, email: 'a@b.co' }
  const ttl = (token) => {
    const { exp, iat } = jwt.decode(token)
    return exp - iat
  }
  assert.equal(CUSTOMER_TTL_SEC, 30 * 24 * 60 * 60)
  assert.equal(CUSTOMER_SESSION_TTL_SEC, 24 * 60 * 60)
  assert.equal(ttl(signCustomerToken(customer, { remember: true })), CUSTOMER_TTL_SEC)
  assert.equal(ttl(signCustomerToken(customer, { remember: false })), CUSTOMER_SESSION_TTL_SEC)
  assert.equal(ttl(signCustomerToken(customer)), CUSTOMER_SESSION_TTL_SEC)
})

test('beni hatırla: çerez remember → 30 gün maxAge; yoksa oturum çerezi (maxAge/expires yok)', () => {
  const calls = []
  const res = { cookie: (name, value, options) => calls.push({ name, value, options }) }
  setCustomerCookie(res, 't1', { remember: true })
  setCustomerCookie(res, 't2')
  assert.equal(calls[0].name, 'tsc_customer')
  assert.equal(calls[0].options.maxAge, 30 * 24 * 60 * 60 * 1000)
  assert.equal(calls[0].options.httpOnly, true)
  assert.equal(calls[0].options.sameSite, 'lax')
  assert.equal('maxAge' in calls[1].options, false)
  assert.equal('expires' in calls[1].options, false)
  assert.equal(calls[1].options.httpOnly, true)
})
