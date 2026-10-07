/**
 * SEO saf yardımcıları (DB gerektirmez): şablon JSON eşitliği (api ↔ mağaza), meta üretimi, yol doğrulama /
 * rota çözümleme, head enjeksiyonu, sitemap ve Google Merchant feed XML'i (xmllint varsa geçerlilik).
 * Depo içinde çalışırken (../../src mevcut ve Node tip soyma destekliyorsa) mağazadaki src/seo/seo.ts ve
 * parseFaq.ts doğrudan içe aktarılır ve JS uygulamasıyla aynı çıktıyı verdiği doğrulanır; canlı deploy'da
 * (api tek başına) bu testler atlanır.
 *   cd api && node --test test/
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

process.env.DB_HOST ??= '127.0.0.1'
process.env.DB_NAME ??= 'x'
process.env.DB_USER ??= 'x'
process.env.SESSION_SECRET ??= 'test-secret-0123456789abcdef'
process.env.ADMIN_USERNAME ??= 'admin'
process.env.ADMIN_PASSWORD ??= 'adminpass123'
process.env.UPLOAD_DIR ??= '/tmp/uploads'
process.env.CORS_ORIGIN ??= 'http://localhost:5173'
process.env.SITE_URL ??= 'https://teshvikiye.com'

const seo = await import('../src/services/seo.js')
const {
  templates,
  pageMeta,
  excerpt,
  cleanText,
  normalizePhone,
  parseAddress,
  socialLinks,
  validatePath,
  resolveRoute,
  injectHead,
  renderHead,
  sitemapEntries,
  buildSitemapXml,
  buildMerchantFeedXml,
  toSeoProduct,
  resolveContentField,
  infoSections,
  parseFaq,
  isoDate,
} = seo

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_SRC = path.resolve(__dirname, '../../src')
const STORE_TEMPLATES = path.join(REPO_SRC, 'seo/templates.json')
const STORE_SEO_TS = path.join(REPO_SRC, 'seo/seo.ts')
const STORE_FAQ_TS = path.join(REPO_SRC, 'components/info/parseFaq.ts')
const STORE_CONTENT_TS = path.join(REPO_SRC, 'data/contentTexts.ts')
const canImportTs = Boolean(process.features?.typescript)

const ORIGIN = 'https://teshvikiye.com'
const env = (locale = 'tr') => ({ origin: ORIGIN, locale, templates })
const BRAND = {
  collectionTitle: 'Sonbahar / Kış 2026 Koleksiyonu',
  collectionIntro: 'Bu sonbahar-kış sezonunda Teshvikiye, günün her anına eşlik eden sade ve zamansız parçaları bir araya getiriyor. Yumuşak dokular, dengeli kesimler ve nötr bir renk paleti, kışın soğuğuna hazırlanırken şıklıktan ödün vermek istemeyenler için tasarlandı.',
  companyName: 'Biçeroğlu Tekstil Konfeksiyon Sanayi Dış Ticaret Limited Şirketi',
  address: 'Çağlayan Mahallesi Cihanşah Sokak No:15 K:4 Kağıthane / İstanbul',
  phone: '0507 600 6124',
  email: 'info@teshvikiye.com',
}
const EMPTY_BRAND = { collectionTitle: null, collectionIntro: null, companyName: null, address: null, phone: null, email: null }
const SOCIAL = { instagram: 'teshvikiye', tiktok: null, pinterest: 'https://www.pinterest.com/teshvikiye/' }

const product = (over = {}) => ({
  id: 'urun-01',
  slug: 'urun-01',
  name: 'Siyah Midi Elbise',
  category: 'elbiseler',
  price: 4250,
  colorCount: 2,
  inStock: true,
  images: [`${ORIGIN}/uploads/urun-01-on.jpg`, `${ORIGIN}/uploads/urun-01-arka.jpg`],
  description: 'Akışkan dokulu, **midi boy** siyah elbise. Yuvarlak yaka, uzun kol. Günden geceye taşınan sade bir siluet.',
  ...over,
})
const placeholderProduct = product({ id: 'urun-07', slug: 'urun-07', name: 'Ürün 07 — Ürün adı', category: 'ust-giyim', price: 2150, colorCount: 3, images: [], description: 'Ürün 07 — Ürün açıklaması alanı' })
const PRODUCTS = [product(), placeholderProduct, product({ id: 'urun-02', slug: 'urun-02', name: 'Krem Gömlek', category: 'ust-giyim', price: 1890, colorCount: 1, inStock: false, description: null })]
const FAQ_TEXT = 'S: Siparişimi nasıl takip edebilirim?\nC: Hesabım → Siparişlerim sayfasından.\nİkinci satır.\n\nS: İade süresi?\nC: 14 gün.'
const INFO_SECTIONS = { hakkimizda: ['Teshvikiye ismini, İstanbul\'un moda ve zarafetle anılan semti Teşvikiye\'den alır. Sade ve şık.', 'İkinci bölüm.'], sss: [FAQ_TEXT, null], iletisim: [BRAND.companyName, BRAND.address, BRAND.phone, BRAND.email], gizlilik: [null], 'mesafeli-satis-sozlesmesi': [null] }

const dataFor = (route, locale = 'tr', over = {}) => {
  const data = { brand: BRAND, social: SOCIAL, ...over }
  if (route.kind === 'product' && !('product' in over)) data.product = PRODUCTS.find((p) => p.slug === route.slug) ?? null
  if (route.kind === 'collection' && !('products' in over)) data.products = route.categoryId === 'tum-urunler' ? PRODUCTS : PRODUCTS.filter((p) => p.category === route.categoryId)
  if (route.kind === 'info' && !('info' in over)) {
    const slug = templates.infoAliases[route.slug] ?? route.slug
    data.info = INFO_SECTIONS[slug] ? { slug, sections: INFO_SECTIONS[slug] } : null
    if (slug === 'sss') data.faq = parseFaq(FAQ_TEXT).items
  }
  return data
}

const jsonLdTypes = (meta) => meta.jsonLd.map((o) => o['@type'])

/* ---------------- Şablon JSON eşitliği ---------------- */

test('şablon JSON: api/src/services/seo-templates.json = src/seo/templates.json (depo içinde)', (t) => {
  if (!fs.existsSync(STORE_TEMPLATES)) return t.skip('mağaza kaynak ağacı yok (api tek başına deploy edilmiş)')
  const store = JSON.parse(fs.readFileSync(STORE_TEMPLATES, 'utf8'))
  assert.deepEqual(templates, store)
})

test('şablon JSON: tutarlılık (kategoriler, bilgi sayfaları, her iki dilde aynı anahtarlar)', () => {
  for (const locale of ['tr', 'en']) {
    const lt = templates.locales[locale]
    for (const id of templates.categories) assert.ok(lt.categories[id], `${locale}: kategori etiketi ${id}`)
    for (const slug of templates.infoSlugs) assert.ok(lt.info.titles[slug], `${locale}: bilgi sayfası başlığı ${slug}`)
    for (const id of templates.noindexPages) {
      assert.ok(lt.pages[id], `${locale}: sayfa adı ${id}`)
      assert.ok(templates.pagePaths[id], `sayfa yolu ${id}`)
    }
  }
  assert.deepEqual(Object.keys(templates.locales.tr.fallbacks).sort(), Object.keys(templates.locales.en.fallbacks).sort())
})

test('şablon geri dönüş metinleri contentTexts.ts ile aynı (depo içinde, Node tip soyma)', async (t) => {
  if (!canImportTs || !fs.existsSync(STORE_CONTENT_TS)) return t.skip('contentTexts.ts yok ya da Node TS içe aktaramıyor')
  const ct = await import(STORE_CONTENT_TS)
  const check = (locale, texts, info) => {
    const fb = templates.locales[locale].fallbacks
    for (const [key, value] of Object.entries(fb)) {
      const [, slug, idx] = key.split('.')
      const raw = key.startsWith('info.') ? info[slug][Number(idx)] : texts[key]
      // SSS bölümleri tam metin (FAQPage için), diğer bilgi sayfalarında ilk leadMax karakter
      const expected = key.startsWith('info.') && slug !== 'sss' ? raw.slice(0, templates.leadMax) : raw
      assert.equal(value, expected, `${locale} ${key}`)
    }
  }
  check('tr', ct.contentTexts, ct.infoSectionTexts)
  check('en', ct.contentTextsEn, ct.infoSectionTextsEn)
})

/* ---------------- TS ↔ JS eşitliği ---------------- */

test('pageMeta: src/seo/seo.ts (TS) ile services/seo.js (JS) aynı çıktıyı verir (depo içinde)', async (t) => {
  if (!canImportTs || !fs.existsSync(STORE_SEO_TS)) return t.skip('seo.ts yok ya da Node TS içe aktaramıyor')
  const ts = await import(STORE_SEO_TS)
  const routes = [
    { kind: 'home' },
    { kind: 'collection', categoryId: 'tum-urunler' },
    { kind: 'collection', categoryId: 'elbiseler' },
    { kind: 'collection', categoryId: 'yok' },
    { kind: 'product', slug: 'urun-01' },
    { kind: 'product', slug: 'urun-07' },
    { kind: 'product', slug: 'urun-99' },
    { kind: 'info', slug: 'hakkimizda' },
    { kind: 'info', slug: 'sss' },
    { kind: 'info', slug: 'iletisim' },
    { kind: 'info', slug: 'gizlilik' },
    { kind: 'info', slug: 'alisveris-kosullari' },
    { kind: 'info', slug: 'yok' },
    { kind: 'page', id: 'cart' },
    { kind: 'page', id: 'checkoutResult' },
    { kind: 'notFound' },
  ]
  let n = 0
  for (const locale of ['tr', 'en']) {
    for (const route of routes) {
      for (const brand of [BRAND, EMPTY_BRAND]) {
        const data = dataFor(route, locale, { brand })
        assert.deepEqual(ts.pageMeta(route, data, env(locale)), pageMeta(route, data, env(locale)), `${locale} ${JSON.stringify(route)}`)
        n++
      }
    }
  }
  assert.ok(n >= 60)
  for (const [raw, max] of [['Akışkan **midi** elbise. ' + 'x'.repeat(300), 155], ['kısa', 155]]) assert.equal(ts.excerpt(raw, max), excerpt(raw, max))
  assert.equal(ts.normalizePhone('0507 600 6124'), normalizePhone('0507 600 6124'))
  assert.deepEqual(ts.parseAddress(BRAND.address), parseAddress(BRAND.address))
})

test('parseFaq: parseFaq.ts (TS) ile JS kopyası aynı sonucu verir (depo içinde)', async (t) => {
  if (!canImportTs || !fs.existsSync(STORE_FAQ_TS)) return t.skip('parseFaq.ts yok ya da Node TS içe aktaramıyor')
  const ts = await import(STORE_FAQ_TS)
  for (const text of [FAQ_TEXT, 'Giriş paragrafı.\n\nQ: One?\nA: Yes.\nMore.\n\nQ: Two\nkalan soru\nA: Two answer', '', null, 'C: sorusuz cevap']) {
    assert.deepEqual(ts.parseFaq(text), parseFaq(text), JSON.stringify(text))
  }
})

/* ---------------- Metin / kuruluş yardımcıları ---------------- */

test('cleanText/excerpt: markdown temizlenir, kelime sınırında kesilir, "Son güncelleme" satırı atılır', () => {
  assert.equal(cleanText('*Son güncelleme: 28 Eylül 2026*\n\n## MADDE 1\n\n**Marka:** TESHVIKIYE\n---\n- madde'), 'MADDE 1 Marka: TESHVIKIYE madde')
  const e = excerpt(BRAND.collectionIntro, 155)
  assert.ok(e.length <= 155, `uzunluk ${e.length}`)
  assert.ok(e.endsWith('…'))
  assert.ok(!e.includes('  '))
  assert.equal(excerpt('kısa metin', 155), 'kısa metin')
})

test('normalizePhone / parseAddress / socialLinks', () => {
  assert.equal(normalizePhone('0507 600 6124'), '+90 507 600 61 24')
  assert.equal(normalizePhone('+90 507 600 6124'), '+90 507 600 61 24')
  assert.equal(normalizePhone('5076006124'), '+90 507 600 61 24')
  assert.equal(normalizePhone('12345'), null)
  assert.equal(normalizePhone(null), null)
  assert.deepEqual(parseAddress(BRAND.address), { '@type': 'PostalAddress', streetAddress: 'Çağlayan Mahallesi Cihanşah Sokak No:15 K:4', addressLocality: 'Kağıthane', addressRegion: 'İstanbul', addressCountry: 'TR' })
  assert.equal(parseAddress(`${BRAND.address}, Türkiye`).addressRegion, 'İstanbul')
  assert.deepEqual(parseAddress('Tek satır adres'), { '@type': 'PostalAddress', streetAddress: 'Tek satır adres', addressCountry: 'TR' })
  assert.deepEqual(socialLinks(SOCIAL), ['https://www.instagram.com/teshvikiye/', 'https://www.pinterest.com/teshvikiye/'])
  assert.deepEqual(socialLinks({ instagram: '@teshvikiye/', tiktok: ' ' }), ['https://www.instagram.com/teshvikiye/'])
  assert.deepEqual(socialLinks(null), [])
})

/* ---------------- pageMeta ---------------- */

test('home: koleksiyon adlı başlık, intro açıklaması, Organization + WebSite JSON-LD, hreflang', () => {
  const m = pageMeta({ kind: 'home' }, dataFor({ kind: 'home' }), env())
  assert.equal(m.status, 200)
  assert.equal(m.title, 'Teshvikiye | Kadın Giyim — Sonbahar / Kış 2026 Koleksiyonu')
  assert.ok(m.description.startsWith('Bu sonbahar-kış sezonunda Teshvikiye'))
  assert.ok(m.description.length <= 155)
  assert.equal(m.canonical, 'https://teshvikiye.com/')
  assert.deepEqual(m.alternates, { tr: 'https://teshvikiye.com/', en: 'https://teshvikiye.com/en' })
  assert.equal(m.robots, 'index,follow')
  assert.equal(m.og.type, 'website')
  assert.equal(m.og.image, 'https://teshvikiye.com/logos/teshvikiye-og.png')
  assert.equal(m.og.imageWidth, 1200)
  assert.deepEqual(jsonLdTypes(m), ['Organization', 'WebSite'])
  const org = m.jsonLd[0]
  assert.equal(org.legalName, BRAND.companyName)
  assert.equal(org.address.addressLocality, 'Kağıthane')
  assert.equal(org.contactPoint[0].telephone, '+90 507 600 61 24')
  assert.equal(org.logo.url, 'https://teshvikiye.com/logos/teshvikiye-logo.png')
  assert.deepEqual(org.sameAs, ['https://www.instagram.com/teshvikiye/', 'https://www.pinterest.com/teshvikiye/'])
  const site = m.jsonLd[1]
  assert.equal(site.potentialAction.target.urlTemplate, 'https://teshvikiye.com/arama?q={search_term_string}')
})

test('home: marka alanları boşken şablon geri dönüşleri; sosyal bağlantı yoksa sameAs yok', () => {
  const m = pageMeta({ kind: 'home' }, { brand: EMPTY_BRAND, social: { instagram: null, tiktok: null, pinterest: null } }, env())
  assert.equal(m.title, 'Teshvikiye | Kadın Giyim — Sonbahar / Kış 2026 Koleksiyonu')
  const org = m.jsonLd[0]
  assert.equal(org.legalName, 'Biçeroğlu Tekstil Konfeksiyon Sanayi Dış Ticaret Limited Şirketi')
  assert.equal(org.contactPoint[0].telephone, '+90 507 600 61 24')
  assert.ok(!('sameAs' in org))
  // Yer tutucu etiketleri gerçek metin sayılmaz
  const m2 = pageMeta({ kind: 'home' }, { brand: { ...EMPTY_BRAND, collectionTitle: 'Koleksiyon adı alanı', collectionIntro: 'içerik eklenecek' } }, env())
  assert.equal(m2.title, 'Teshvikiye | Kadın Giyim — Sonbahar / Kış 2026 Koleksiyonu')
})

test('ürün: başlık, gerçek açıklama kesiti, og:product + fiyat, Product JSON-LD (offers, iade politikası), breadcrumb', () => {
  const route = { kind: 'product', slug: 'urun-01' }
  const m = pageMeta(route, dataFor(route), env())
  assert.equal(m.title, 'Siyah Midi Elbise | Teshvikiye')
  assert.equal(m.description, 'Akışkan dokulu, midi boy siyah elbise. Yuvarlak yaka, uzun kol. Günden geceye taşınan sade bir siluet.')
  assert.equal(m.canonical, 'https://teshvikiye.com/urun/urun-01')
  assert.equal(m.og.type, 'product')
  assert.equal(m.og.image, 'https://teshvikiye.com/uploads/urun-01-on.jpg')
  assert.equal(m.og.imageWidth, null)
  assert.deepEqual(m.og.price, { amount: '4250.00', currency: 'TRY' })
  assert.deepEqual(jsonLdTypes(m), ['BreadcrumbList', 'Product'])
  const crumbs = m.jsonLd[0].itemListElement.map((i) => i.name)
  assert.deepEqual(crumbs, ['Ana Sayfa', 'Koleksiyon', 'Elbiseler', 'Siyah Midi Elbise'])
  const p = m.jsonLd[1]
  assert.equal(p.sku, 'urun-01')
  assert.deepEqual(p.image, [`${ORIGIN}/uploads/urun-01-on.jpg`, `${ORIGIN}/uploads/urun-01-arka.jpg`])
  assert.equal(p.brand.name, 'Teshvikiye')
  assert.equal(p.offers.price, '4250.00')
  assert.equal(p.offers.priceCurrency, 'TRY')
  assert.equal(p.offers.availability, 'https://schema.org/InStock')
  assert.equal(p.offers.itemCondition, 'https://schema.org/NewCondition')
  assert.equal(p.offers.hasMerchantReturnPolicy.merchantReturnDays, 14)
  assert.equal(p.offers.hasMerchantReturnPolicy.returnPolicyCategory, 'https://schema.org/MerchantReturnFiniteReturnWindow')
  assert.ok(!('returnFees' in p.offers.hasMerchantReturnPolicy))
  assert.ok(!('color' in p))
})

test('ürün: yer tutucu açıklama → şablon açıklaması; görsel yoksa varsayılan og görseli ve image alanı yok; stok yoksa OutOfStock', () => {
  const m = pageMeta({ kind: 'product', slug: 'urun-07' }, dataFor({ kind: 'product', slug: 'urun-07' }), env())
  assert.equal(m.description, "Ürün 07 — Ürün adı: Üst Giyim · Teshvikiye'nin monokrom kadın giyim koleksiyonundan. 3 renk, XS–XL.")
  assert.equal(m.og.image, 'https://teshvikiye.com/logos/teshvikiye-og.png')
  assert.ok(!('image' in m.jsonLd[1]))
  const out = pageMeta({ kind: 'product', slug: 'urun-02' }, dataFor({ kind: 'product', slug: 'urun-02' }), env())
  assert.equal(out.jsonLd[1].offers.availability, 'https://schema.org/OutOfStock')
  assert.ok(out.description.includes('1 renk'))
})

test('ürün bulunamadı → 404, noindex, "Sayfa bulunamadı", canonical yok', () => {
  const m = pageMeta({ kind: 'product', slug: 'urun-99' }, dataFor({ kind: 'product', slug: 'urun-99' }), env())
  assert.equal(m.status, 404)
  assert.equal(m.robots, 'noindex,nofollow')
  assert.equal(m.title, 'Sayfa bulunamadı | Teshvikiye')
  assert.equal(m.canonical, null)
  assert.equal(m.alternates, null)
  assert.deepEqual(m.jsonLd, [])
})

test('koleksiyon: /koleksiyon canonical (tum-urunler), kategori sayfası, CollectionPage + ItemList ≤ 24', () => {
  const all = pageMeta({ kind: 'collection', categoryId: 'tum-urunler' }, dataFor({ kind: 'collection', categoryId: 'tum-urunler' }), env())
  assert.equal(all.title, 'Koleksiyon | Teshvikiye')
  assert.equal(all.canonical, 'https://teshvikiye.com/koleksiyon')
  assert.ok(all.description.startsWith('Koleksiyon: Bu sonbahar-kış'))
  assert.ok(all.description.length <= 155)
  assert.deepEqual(jsonLdTypes(all), ['BreadcrumbList', 'CollectionPage'])
  assert.equal(all.jsonLd[1].mainEntity['@type'], 'ItemList')
  assert.equal(all.jsonLd[1].mainEntity.numberOfItems, 3)
  const cat = pageMeta({ kind: 'collection', categoryId: 'elbiseler' }, dataFor({ kind: 'collection', categoryId: 'elbiseler' }), env())
  assert.equal(cat.title, 'Elbiseler | Teshvikiye')
  assert.equal(cat.canonical, 'https://teshvikiye.com/koleksiyon/elbiseler')
  assert.deepEqual(cat.jsonLd[0].itemListElement.map((i) => i.name), ['Ana Sayfa', 'Koleksiyon', 'Elbiseler'])
  assert.equal(cat.jsonLd[1].mainEntity.itemListElement[0].url, 'https://teshvikiye.com/urun/urun-01')
  const many = Array.from({ length: 30 }, (_, i) => product({ slug: `urun-${i}` }))
  const capped = pageMeta({ kind: 'collection', categoryId: 'tum-urunler' }, { brand: BRAND, products: many }, env())
  assert.equal(capped.jsonLd[1].mainEntity.numberOfItems, 24)
  assert.equal(pageMeta({ kind: 'collection', categoryId: 'yok' }, dataFor({ kind: 'collection', categoryId: 'yok' }), env()).status, 404)
})

test('bilgi sayfaları: WebPage, SSS → FAQPage, iletişim açıklaması, takma ad, bilinmeyen → 404', () => {
  const about = pageMeta({ kind: 'info', slug: 'hakkimizda' }, dataFor({ kind: 'info', slug: 'hakkimizda' }), env())
  assert.equal(about.title, 'Hakkımızda | Teshvikiye')
  assert.ok(about.description.startsWith('Teshvikiye ismini'))
  assert.deepEqual(jsonLdTypes(about), ['BreadcrumbList', 'WebPage'])
  const faq = pageMeta({ kind: 'info', slug: 'sss' }, dataFor({ kind: 'info', slug: 'sss' }), env())
  assert.equal(faq.description, templates.locales.tr.info.faqDescription)
  assert.deepEqual(jsonLdTypes(faq), ['BreadcrumbList', 'FAQPage'])
  assert.equal(faq.jsonLd[1].mainEntity.length, 2)
  assert.equal(faq.jsonLd[1].mainEntity[0].name, 'Siparişimi nasıl takip edebilirim?')
  assert.equal(faq.jsonLd[1].mainEntity[0].acceptedAnswer.text, 'Hesabım → Siparişlerim sayfasından.\nİkinci satır.')
  const contact = pageMeta({ kind: 'info', slug: 'iletisim' }, dataFor({ kind: 'info', slug: 'iletisim' }), env())
  assert.ok(contact.description.startsWith('Teshvikiye iletişim bilgileri: Biçeroğlu'))
  assert.ok(contact.description.length <= 155)
  const alias = pageMeta({ kind: 'info', slug: 'alisveris-kosullari' }, dataFor({ kind: 'info', slug: 'alisveris-kosullari' }), env())
  assert.equal(alias.canonical, 'https://teshvikiye.com/bilgi/mesafeli-satis-sozlesmesi')
  // Bölüm metni boş → şablondaki geri dönüş (contentTexts.ts) kullanılır
  const privacy = pageMeta({ kind: 'info', slug: 'gizlilik' }, dataFor({ kind: 'info', slug: 'gizlilik' }), env())
  assert.ok(privacy.description.startsWith('Biçeroğlu Tekstil'))
  assert.equal(pageMeta({ kind: 'info', slug: 'yok' }, dataFor({ kind: 'info', slug: 'yok' }), env()).status, 404)
})

test('noindex sayfalar: sepet/ödeme/giriş … noindex,nofollow + canonical + breadcrumb', () => {
  for (const id of templates.noindexPages) {
    const m = pageMeta({ kind: 'page', id }, dataFor({ kind: 'page', id }), env())
    assert.equal(m.robots, 'noindex,nofollow', id)
    assert.equal(m.status, 200)
    assert.ok(m.canonical.startsWith('https://teshvikiye.com/'), id)
    assert.equal(m.alternates, null)
    assert.deepEqual(jsonLdTypes(m), ['BreadcrumbList'])
  }
  const cart = pageMeta({ kind: 'page', id: 'cart' }, dataFor({ kind: 'page', id: 'cart' }), env())
  assert.equal(cart.title, 'Sepet | Teshvikiye')
  assert.equal(cart.canonical, 'https://teshvikiye.com/sepet')
})

test('EN: başlıklar İngilizce, canonical /en/…, og:locale en_US, hreflang çifti', () => {
  const home = pageMeta({ kind: 'home' }, dataFor({ kind: 'home' }, 'en'), env('en'))
  assert.equal(home.title, "Teshvikiye | Women's Clothing — Sonbahar / Kış 2026 Koleksiyonu")
  assert.equal(home.canonical, 'https://teshvikiye.com/en')
  assert.equal(home.ogLocale, 'en_US')
  assert.equal(home.lang, 'en')
  const enHome = pageMeta({ kind: 'home' }, { brand: EMPTY_BRAND }, env('en'))
  assert.equal(enHome.title, "Teshvikiye | Women's Clothing — Autumn / Winter 2026 Collection")
  const p = pageMeta({ kind: 'product', slug: 'urun-07' }, dataFor({ kind: 'product', slug: 'urun-07' }, 'en'), env('en'))
  assert.equal(p.canonical, 'https://teshvikiye.com/en/urun/urun-07')
  assert.deepEqual(p.alternates, { tr: 'https://teshvikiye.com/urun/urun-07', en: 'https://teshvikiye.com/en/urun/urun-07' })
  assert.ok(p.description.includes("from Teshvikiye's monochrome womenswear collection. 3 colours, XS–XL."))
  assert.deepEqual(p.jsonLd[0].itemListElement.map((i) => i.name), ['Home', 'Collection', 'Tops', 'Ürün 07 — Ürün adı'])
  const cat = pageMeta({ kind: 'collection', categoryId: 'elbiseler' }, dataFor({ kind: 'collection', categoryId: 'elbiseler' }, 'en'), env('en'))
  assert.equal(cat.title, 'Dresses | Teshvikiye')
  assert.equal(cat.jsonLd[1].mainEntity.itemListElement[0].url, 'https://teshvikiye.com/en/urun/urun-01')
  const site = home.jsonLd[1]
  assert.equal(site.potentialAction.target.urlTemplate, 'https://teshvikiye.com/en/arama?q={search_term_string}')
})

/* ---------------- DB satırı dönüştürücüleri ---------------- */

test('toSeoProduct: EN alanı seçimi, yer tutucu yerelleştirme, yüklenmiş görsel → mutlak URL, stok', () => {
  const row = {
    id: 'urun-01', number: '01', slug: 'urun-01', name: 'Ürün 01 — Ürün adı', nameEn: null, category: 'elbiseler', price: '4250.00', isNew: true, updatedAt: '2026-10-07 11:46:08',
    colors: [{ id: 'renk-1', label: 'Renk 1' }, { id: 'renk-2', label: 'Renk 2' }],
    stock: { 'renk-1': { XS: 0, S: 0 }, 'renk-2': { M: 2 } },
    media: [{ kind: 'front', src: '/uploads/a.jpg' }, { kind: 'back', src: null }, { kind: 'model', src: 'https://cdn.example.com/m.jpg' }, { kind: 'fabric', src: '/uploads/k.jpg' }],
    content: { description: 'Ürün 01 — Ürün açıklaması alanı', descriptionEn: 'Real EN description' },
  }
  const tr = toSeoProduct(row, 'tr', ORIGIN)
  assert.equal(tr.name, 'Ürün 01 — Ürün adı')
  assert.equal(tr.description, 'Ürün 01 — Ürün açıklaması alanı')
  assert.equal(tr.price, 4250)
  assert.equal(tr.colorCount, 2)
  assert.equal(tr.inStock, true)
  assert.deepEqual(tr.images, [`${ORIGIN}/uploads/a.jpg`, 'https://cdn.example.com/m.jpg'])
  const en = toSeoProduct(row, 'en', ORIGIN)
  assert.equal(en.name, 'Product 01 — Product name')
  assert.equal(en.description, 'Real EN description')
  const none = toSeoProduct({ ...row, stock: { 'renk-1': { XS: 0 } }, media: [] }, 'tr', ORIGIN)
  assert.equal(none.inStock, false)
  assert.deepEqual(none.images, [])
})

test('resolveContentField/infoSections: content_fields > geri dönüş; EN zinciri TR\'ye düşer', () => {
  const fields = { 'brand.collectionTitle': 'DB Koleksiyon', 'brand.phone': null, 'info.hakkimizda.0': 'DB hakkımızda', 'info.hakkimizda.1': null }
  const fieldsEn = { 'brand.collectionTitle': 'DB Collection' }
  assert.equal(resolveContentField('brand.collectionTitle', fields, fieldsEn, 'tr'), 'DB Koleksiyon')
  assert.equal(resolveContentField('brand.collectionTitle', fields, fieldsEn, 'en'), 'DB Collection')
  assert.equal(resolveContentField('brand.phone', fields, fieldsEn, 'tr'), '0507 600 6124')
  assert.equal(resolveContentField('brand.phone', fields, fieldsEn, 'en'), '+90 507 600 6124')
  assert.equal(resolveContentField('info.hakkimizda.1', fields, {}, 'en'), null)
  const sections = infoSections('hakkimizda', fields, fieldsEn, 'tr')
  assert.equal(sections[0], 'DB hakkımızda')
  assert.equal(sections.length, 2)
  assert.equal(infoSections('iletisim', {}, {}, 'tr')[2], '0507 600 6124')
  const faqSections = infoSections('sss', {}, {}, 'tr')
  assert.equal(faqSections.length, 4, 'SSS: dört bölüm şablon geri dönüşünden gelir (FAQPage için)')
  assert.ok(faqSections.every((t) => /^S: /.test(t)))
  assert.ok(infoSections('sss', {}, {}, 'en').every((t) => /^Q: /.test(t)))
})

/* ---------------- Yol / rota ---------------- */

test('validatePath: güvenli karakter kümesi, ≤200, sorgu yok', () => {
  for (const ok of ['/', '/urun/urun-01', '/en/bilgi/sss', '/koleksiyon/dis-giyim/', '/a.b_c~d']) assert.equal(validatePath(ok), ok)
  for (const bad of ['', 'urun/x', '/urun?x=1', '/ürün', '/a b', '/a%20b', '/x#y', `/${'a'.repeat(200)}`, undefined, 5, ['/']]) assert.equal(validatePath(bad), null, String(bad))
})

test('resolveRoute: dil öneki, sondaki /, rotalar, bilinmeyen → notFound', () => {
  assert.deepEqual(resolveRoute('/'), { locale: 'tr', route: { kind: 'home' } })
  assert.deepEqual(resolveRoute('/en'), { locale: 'en', route: { kind: 'home' } })
  assert.deepEqual(resolveRoute('/en/'), { locale: 'en', route: { kind: 'home' } })
  assert.deepEqual(resolveRoute('/koleksiyon'), { locale: 'tr', route: { kind: 'collection', categoryId: 'tum-urunler' } })
  assert.deepEqual(resolveRoute('/koleksiyon/elbiseler/'), { locale: 'tr', route: { kind: 'collection', categoryId: 'elbiseler' } })
  assert.deepEqual(resolveRoute('/en/urun/urun-01'), { locale: 'en', route: { kind: 'product', slug: 'urun-01' } })
  assert.deepEqual(resolveRoute('/bilgi/sss'), { locale: 'tr', route: { kind: 'info', slug: 'sss' } })
  assert.deepEqual(resolveRoute('/sepet'), { locale: 'tr', route: { kind: 'page', id: 'cart' } })
  assert.deepEqual(resolveRoute('/odeme/sonuc/ORD-1'), { locale: 'tr', route: { kind: 'page', id: 'checkoutResult' } })
  assert.deepEqual(resolveRoute('/hesap/dogrula'), { locale: 'tr', route: { kind: 'page', id: 'verifyEmail' } })
  assert.deepEqual(resolveRoute('/entry'), { locale: 'tr', route: { kind: 'notFound' } })
  assert.deepEqual(resolveRoute('/urun/a/b'), { locale: 'tr', route: { kind: 'notFound' } })
  assert.deepEqual(resolveRoute('/admin/urunler'), { locale: 'tr', route: { kind: 'notFound' } })
})

/* ---------------- Head enjeksiyonu ---------------- */

const INDEX = `<!doctype html>
<html lang="tr">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <title>Teshvikiye | Kadın Giyim</title>
    <meta name="description" content="Varsayılan" data-seo />
    <meta property="og:image" content="https://teshvikiye.com/logos/teshvikiye-og.png" data-seo />
    <script type="module" crossorigin src="/assets/index-abc.js"></script>
  </head>
  <body><div id="root"></div></body>
</html>
`

test('injectHead: title değişir, varsayılan data-seo etiketleri kalkar, yeni etiketler ve JSON-LD eklenir, lang ayarlanır', () => {
  const m = pageMeta({ kind: 'product', slug: 'urun-01' }, dataFor({ kind: 'product', slug: 'urun-01' }, 'en', { product: product({ name: 'A "quoted" <name> & co' }) }), env('en'))
  const html = injectHead(INDEX, m)
  assert.ok(html.includes('<title>A &quot;quoted&quot; &lt;name&gt; &amp; co | Teshvikiye</title>'))
  assert.equal((html.match(/<title>/g) || []).length, 1)
  assert.ok(!html.includes('content="Varsayılan"'))
  assert.equal((html.match(/name="description"/g) || []).length, 1)
  assert.equal((html.match(/property="og:image"/g) || []).length, 1)
  assert.ok(html.includes('<html lang="en">'))
  assert.ok(html.includes('<link rel="canonical" href="https://teshvikiye.com/en/urun/urun-01" data-seo>'))
  assert.ok(html.includes('hreflang="x-default" href="https://teshvikiye.com/urun/urun-01"'))
  assert.ok(html.includes('<meta property="product:price:amount" content="4250.00" data-seo>'))
  assert.ok(html.includes('<link rel="icon" type="image/svg+xml" href="/favicon.svg" />'), 'işaretsiz etiketler korunur')
  assert.ok(html.includes('/assets/index-abc.js'))
  const scripts = [...html.matchAll(/<script type="application\/ld\+json" data-seo>([\s\S]*?)<\/script>/g)].map((x) => JSON.parse(x[1]))
  assert.deepEqual(scripts.map((s) => s['@type']), ['BreadcrumbList', 'Product'])
  assert.equal(scripts[1].name, 'A "quoted" <name> & co')
  assert.ok(!html.includes('<name>'), 'JSON-LD içinde < kaçışlı olmalı')
  assert.ok(html.includes('\\u003cname>'))
  assert.ok(html.indexOf('data-seo>') < html.indexOf('</head>'))
})

test('injectHead: </head> yoksa sona ekler; renderHead noindex sayfada hreflang basmaz', () => {
  const m = pageMeta({ kind: 'page', id: 'cart' }, dataFor({ kind: 'page', id: 'cart' }), env())
  const head = renderHead(m)
  assert.ok(head.includes('<meta name="robots" content="noindex,nofollow" data-seo>'))
  assert.ok(!head.includes('hreflang'))
  assert.ok(injectHead('<title>x</title>', m).includes('<title>Sepet | Teshvikiye</title>'))
})

/* ---------------- Sitemap / feed XML ---------------- */

function xmllint(xml) {
  const r = spawnSync('xmllint', ['--noout', '-'], { input: xml, encoding: 'utf8' })
  if (r.error?.code === 'ENOENT') return null
  return r.status === 0 ? true : r.stderr
}

const ROWS = [
  { id: 'urun-01', slug: 'urun-01', hidden: false, updatedAt: '2026-10-07 11:46:08' },
  { id: 'urun-02', slug: 'urun-02', hidden: false, updatedAt: new Date('2026-09-30T08:00:00Z') },
  { id: 'urun-03', slug: 'urun-03', hidden: true, updatedAt: '2026-10-01 00:00:00' },
]

test('sitemap: yol listesi (ana, koleksiyon, 6 kategori, görünür ürünler, 11 bilgi sayfası), lastmod yalnızca ürünlerde', () => {
  const entries = sitemapEntries(ROWS)
  const paths = entries.map((e) => e.path)
  assert.equal(paths[0], '/')
  assert.equal(paths[1], '/koleksiyon')
  assert.ok(!paths.includes('/koleksiyon/tum-urunler'))
  assert.ok(paths.includes('/koleksiyon/yeni-gelenler'))
  assert.ok(paths.includes('/koleksiyon/dis-giyim'))
  assert.ok(paths.includes('/urun/urun-01') && paths.includes('/urun/urun-02'))
  assert.ok(!paths.includes('/urun/urun-03'), 'gizli ürün girmez')
  assert.ok(paths.includes('/bilgi/iletisim') && paths.includes('/bilgi/on-bilgilendirme-formu'))
  assert.ok(!paths.includes('/bilgi/alisveris-kosullari'))
  assert.equal(entries.length, 1 + 1 + 6 + 2 + 11)
  assert.equal(entries.find((e) => e.path === '/urun/urun-01').lastmod, '2026-10-07')
  assert.equal(entries.find((e) => e.path === '/urun/urun-02').lastmod, '2026-09-30')
  assert.equal(entries.find((e) => e.path === '/bilgi/sss').lastmod, undefined)
  assert.equal(isoDate('bozuk'), null)
})

test('sitemap XML: geçerli, her yol için TR+EN <url>, üçlü hreflang, kök dışı sondaki / yok', () => {
  const xml = buildSitemapXml(sitemapEntries(ROWS), ORIGIN)
  const lint = xmllint(xml)
  if (lint !== null) assert.equal(lint, true, String(lint))
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">'))
  const urls = (xml.match(/<url>/g) || []).length
  assert.equal(urls, 2 * 21)
  assert.equal((xml.match(/<xhtml:link /g) || []).length, 3 * urls)
  assert.ok(xml.includes('<loc>https://teshvikiye.com/</loc>'))
  assert.ok(xml.includes('<loc>https://teshvikiye.com/en</loc>'))
  assert.ok(xml.includes('<loc>https://teshvikiye.com/en/urun/urun-01</loc>'))
  assert.ok(xml.includes('<lastmod>2026-10-07</lastmod>'))
  assert.ok(!xml.includes('changefreq') && !xml.includes('priority'))
  assert.ok(!/<loc>[^<]+\/<\/loc>/.test(xml.replace('<loc>https://teshvikiye.com/</loc>', '')), 'kök dışında sondaki / olmamalı')
})

test('Google Merchant feed: geçerli RSS, alanlar, görselsiz üründe g:image_link yok, XML kaçışı', () => {
  const list = [product({ name: 'Elbise & "Kombin" <A>' }), placeholderProduct]
  const xml = buildMerchantFeedXml(list, ORIGIN)
  const lint = xmllint(xml)
  if (lint !== null) assert.equal(lint, true, String(lint))
  assert.ok(xml.includes('<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">'))
  const items = xml.split('<item>').slice(1)
  assert.equal(items.length, 2)
  const first = items[0]
  assert.ok(first.includes('<g:id>urun-01</g:id>'))
  assert.ok(first.includes('<title>Elbise &amp; &quot;Kombin&quot; &lt;A&gt;</title>'))
  assert.ok(first.includes('<link>https://teshvikiye.com/urun/urun-01</link>'))
  assert.ok(first.includes('<g:image_link>https://teshvikiye.com/uploads/urun-01-on.jpg</g:image_link>'))
  assert.ok(first.includes('<g:additional_image_link>https://teshvikiye.com/uploads/urun-01-arka.jpg</g:additional_image_link>'))
  assert.ok(first.includes('<g:availability>in_stock</g:availability>'))
  assert.ok(first.includes('<g:price>4250.00 TRY</g:price>'))
  assert.ok(first.includes('<g:brand>Teshvikiye</g:brand>'))
  assert.ok(first.includes('<g:condition>new</g:condition>'))
  assert.ok(first.includes('<g:product_type>Elbiseler</g:product_type>'))
  assert.ok(first.includes('<g:gender>female</g:gender>') && first.includes('<g:age_group>adult</g:age_group>'))
  assert.ok(first.includes('midi boy siyah elbise') && !first.includes('**'), 'açıklama markdown temizlenmiş')
  const second = items[1]
  assert.ok(!second.includes('g:image_link'))
  assert.ok(second.includes('Teshvikiye&apos;nin monokrom kadın giyim koleksiyonundan'), 'şablon açıklaması, XML kaçışlı')
  assert.ok(second.includes('<g:product_type>Üst Giyim</g:product_type>'))
})
