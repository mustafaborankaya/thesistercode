/**
 * SEO SERVİS KATMANI — saf fonksiyonlar (DB yok).
 *
 * `pageMeta` ve metin/URL yardımcıları mağazadaki `src/seo/seo.ts` ile BİREBİR aynı kuralları uygular
 * (iki taraf aynı şablon JSON'unu kullanır: `seo-templates.json` = `src/seo/templates.json`;
 * `test/seo.test.js` hem JSON eşitliğini hem de aynı girdi için iki uygulamanın aynı çıktıyı
 * verdiğini doğrular). Burada bir kural değiştiğinde TS tarafı da aynı şekilde güncellenmelidir.
 *
 * Sunucuya özgü ek işler: yol doğrulama/çözümleme (`/api/seo/render?path=`), index.html'e head
 * enjeksiyonu, sitemap ve Google Merchant feed XML'i, SSS ayrıştırıcısı (src/components/info/parseFaq.ts
 * ile aynı kurallar) ve DB ürün/içerik satırlarını `pageMeta` girdisine çeviren dönüştürücüler.
 * Bağımlılık eklenmez: XML elle üretilir (`escapeXml`).
 * Bot gövdesi (`renderBody`, `renderMarkdown`, `injectBody`) ve `/llms.txt` (`buildLlmsTxt`) yalnızca sunucuda
 * üretilir; bölüm 2'dedir ve TS tarafına yansıtılmaz.
 */
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
/** Başlık/açıklama şablonları — src/seo/templates.json ile aynı içerik. */
export const templates = require('./seo-templates.json')

/* =====================================================================================
 * 1) src/seo/seo.ts ile birebir aynı bölüm
 * ===================================================================================== */

/* ---------------- Metin yardımcıları ---------------- */

/** `{anahtar}` yer tutucularını doldurur; tanımsız anahtar boş kalır. */
export function fill(template, vars) {
  return template.replace(/\{(\w+)\}/g, (_, key) => (vars[key] === undefined ? '' : String(vars[key])))
}

/** HTML/markdown işaretlerini temizler, boşlukları tekler. "Son güncelleme" satırı (yasal metinler) atılır. */
export function cleanText(text) {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^\s*\*?\s*(Son güncelleme|Last updated)\b[^\n]*$/gim, ' ')
    .replace(/^\s*#{1,6}\s+/gm, '')
    .replace(/^\s*(-{3,}|\*{3,}|_{3,})\s*$/gm, ' ')
    .replace(/^\s*[-•*]\s+/gm, '')
    .replace(/[*`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Temizlenmiş metnin ilk `max` karakteri — kelime sınırında kesilir, sona "…" eklenir. */
export function excerpt(text, max) {
  const clean = cleanText(text)
  if (clean.length <= max) return clean
  let cut = clean.slice(0, max - 1)
  const lastSpace = cut.lastIndexOf(' ')
  if (lastSpace > max * 0.6) cut = cut.slice(0, lastSpace)
  cut = cut.replace(/[\s,;:·—–-]+$/, '')
  return `${cut}…`
}

/** Yer tutucu mu? (boş, "Ürün NN — …", "… alanı", "içerik eklenecek" vb. — bkz. templates.placeholderPatterns) */
export function isPlaceholder(text, patterns) {
  if (!text || !text.trim()) return true
  return patterns.some((p) => new RegExp(p, 'u').test(text.trim()))
}

/** Gerçek metin ya da null. */
export function realText(text, patterns) {
  return isPlaceholder(text, patterns) ? null : text.trim()
}

/** Fiyat: 2 ondalık, nokta ayırıcı (JSON-LD / feed). */
export function formatPrice(amount) {
  return (Math.round(amount * 100) / 100).toFixed(2)
}

/* ---------------- URL yardımcıları ---------------- */

/** Yolu dile göre öneklendirir: en → `/en` + yol (ana sayfa `/en`), tr → yol. */
export function localizedPath(path, locale) {
  const bare = path.replace(/\/+$/, '') || '/'
  if (locale === 'en') return bare === '/' ? '/en' : `/en${bare}`
  return bare
}

/** Mutlak URL — sorgu dizesi yok. */
export function absoluteUrl(path, env, locale = env.locale) {
  return `${env.origin}${localizedPath(path, locale)}`
}

function alternatesFor(path, env) {
  return { tr: absoluteUrl(path, env, 'tr'), en: absoluteUrl(path, env, 'en') }
}

/* ---------------- Kuruluş bilgisi ---------------- */

/** "0507 600 6124" / "+90 507 600 6124" → "+90 507 600 61 24"; biçimlenemiyorsa null. */
export function normalizePhone(raw) {
  if (!raw) return null
  let digits = raw.replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('90')) digits = digits.slice(2)
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1)
  if (digits.length !== 10) return null
  return `+90 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 8)} ${digits.slice(8, 10)}`
}

/** "Çağlayan Mah. … K:4 Kağıthane / İstanbul" → sokak / ilçe / il. Ayrıştırılamazsa tamamı streetAddress. */
export function parseAddress(raw) {
  const cleaned = raw.replace(/,?\s*(Türkiye|Turkey|Turkiye)\s*$/iu, '').trim()
  const parts = cleaned.split(/\s*\/\s*/)
  if (parts.length >= 2) {
    const region = parts[parts.length - 1].trim()
    const left = parts.slice(0, -1).join(' / ').trim()
    const words = left.split(/\s+/)
    if (words.length > 1) {
      return { '@type': 'PostalAddress', streetAddress: words.slice(0, -1).join(' '), addressLocality: words[words.length - 1], addressRegion: region, addressCountry: 'TR' }
    }
    return { '@type': 'PostalAddress', streetAddress: left, addressLocality: region, addressRegion: region, addressCountry: 'TR' }
  }
  return { '@type': 'PostalAddress', streetAddress: cleaned, addressCountry: 'TR' }
}

const SOCIAL_BASE = {
  instagram: (h) => `https://www.instagram.com/${h}/`,
  tiktok: (h) => `https://www.tiktok.com/@${h}`,
  pinterest: (h) => `https://www.pinterest.com/${h}/`,
}

/** Ayarlardaki sosyal hesaplar → mutlak URL listesi (yalnızca dolu olanlar; kullanıcı adı ya da tam URL kabul edilir). */
export function socialLinks(social) {
  if (!social) return []
  const out = []
  for (const key of ['instagram', 'tiktok', 'pinterest']) {
    const value = social[key]
    if (typeof value !== 'string' || !value.trim()) continue
    const v = value.trim()
    out.push(/^https?:\/\//i.test(v) ? v : SOCIAL_BASE[key](v.replace(/^@/, '').replace(/\/+$/, '')))
  }
  return out
}

/* ---------------- JSON-LD ---------------- */

function organizationJsonLd(env, data, lt) {
  const t = env.templates
  const patterns = t.placeholderPatterns
  const fb = lt.fallbacks
  const legalName = realText(data.brand.companyName, patterns) ?? realText(fb['brand.companyName'], patterns)
  const address = realText(data.brand.address, patterns) ?? realText(fb['brand.address'], patterns)
  const phone = normalizePhone(realText(data.brand.phone, patterns) ?? realText(fb['brand.phone'], patterns))
  const email = realText(data.brand.email, patterns) ?? realText(fb['brand.email'], patterns)
  const org = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${env.origin}/#organization`,
    name: t.siteName,
    url: `${env.origin}/`,
    logo: { '@type': 'ImageObject', url: `${env.origin}${t.paths.logo}` },
  }
  if (legalName) org.legalName = legalName
  if (address) org.address = parseAddress(address)
  if (email) org.email = email
  if (phone || email) {
    const cp = { '@type': 'ContactPoint', contactType: lt.organization.contactType, availableLanguage: lt.organization.availableLanguage }
    if (phone) cp.telephone = phone
    if (email) cp.email = email
    org.contactPoint = [cp]
  }
  const sameAs = socialLinks(data.social)
  if (sameAs.length) org.sameAs = sameAs
  return org
}

function webSiteJsonLd(env, lt) {
  const t = env.templates
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${env.origin}/#website`,
    name: t.siteName,
    url: absoluteUrl('/', env),
    inLanguage: lt.inLanguage,
    publisher: { '@id': `${env.origin}/#organization` },
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${absoluteUrl(t.paths.search, env)}?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  }
}

function breadcrumbJsonLd(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: it.url })),
  }
}

function productJsonLd(env, lt, product, canonical, description) {
  const t = env.templates
  const out = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description,
    sku: product.id,
    brand: { '@type': 'Brand', name: t.siteName },
    category: lt.categories[product.category] ?? product.category,
    url: canonical,
    offers: {
      '@type': 'Offer',
      url: canonical,
      price: formatPrice(product.price),
      priceCurrency: t.currency,
      availability: product.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      hasMerchantReturnPolicy: {
        '@type': 'MerchantReturnPolicy',
        applicableCountry: t.returnPolicy.country,
        returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
        merchantReturnDays: t.returnPolicy.days,
        returnMethod: 'https://schema.org/ReturnByMail',
      },
    },
  }
  if (product.images.length) out.image = product.images
  return out
}

function collectionJsonLd(env, lt, name, canonical, description, products) {
  const t = env.templates
  const items = products.slice(0, t.itemListMax)
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name,
    url: canonical,
    description,
    inLanguage: lt.inLanguage,
    isPartOf: { '@id': `${env.origin}/#website` },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: items.length,
      itemListElement: items.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: absoluteUrl(`${t.paths.product}/${p.slug}`, env) })),
    },
  }
}

function faqJsonLd(name, canonical, faq) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    name,
    url: canonical,
    mainEntity: faq.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer.join('\n\n') },
    })),
  }
}

function webPageJsonLd(env, lt, name, canonical, description) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name,
    url: canonical,
    description,
    inLanguage: lt.inLanguage,
    isPartOf: { '@id': `${env.origin}/#website` },
  }
}

/* ---------------- Sayfa metası ---------------- */

function baseMeta(env, lt) {
  const t = env.templates
  return {
    status: 200,
    siteName: t.siteName,
    title: t.siteName,
    description: lt.home.description,
    canonical: null,
    alternates: null,
    // max-image-preview:large → Google/Discover büyük görsel önizlemesi; max-snippet:-1 → snippet uzunluğu sınırsız (AI Overviews alıntıları).
    robots: 'index,follow,max-image-preview:large,max-snippet:-1',
    lang: lt.lang,
    ogLocale: lt.ogLocale,
    og: {
      type: 'website',
      url: null,
      title: t.siteName,
      description: lt.home.description,
      image: `${env.origin}${t.paths.ogImage}`,
      imageAlt: t.siteName,
      imageWidth: t.ogImage.width,
      imageHeight: t.ogImage.height,
      price: null,
    },
    jsonLd: [],
  }
}

function finish(meta, title, description) {
  meta.title = title
  meta.description = description
  meta.og.title = title
  meta.og.description = description
  meta.og.url = meta.canonical
  return meta
}

function withTitle(page, t) {
  return `${page}${t.titleSeparator}${t.siteName}`
}

function notFoundMeta(env, lt) {
  const meta = baseMeta(env, lt)
  meta.status = 404
  meta.robots = 'noindex,nofollow'
  return finish(meta, withTitle(lt.notFound.title, env.templates), lt.notFound.description)
}

/**
 * Rota + normalize veri → sayfa metası. Çağıran taraf veriyi toplar (istemci: katalog modülleri; sunucu: DB);
 * burada yalnızca şablon kuralları uygulanır. Bilinmeyen ürün/kategori/sayfa → 404 + noindex.
 */
export function pageMeta(route, data, env) {
  const t = env.templates
  const lt = t.locales[env.locale]
  const patterns = t.placeholderPatterns
  const fb = lt.fallbacks
  const home = { name: lt.breadcrumb.home, url: absoluteUrl('/', env) }

  switch (route.kind) {
    case 'home': {
      const meta = baseMeta(env, lt)
      meta.canonical = absoluteUrl('/', env)
      meta.alternates = alternatesFor('/', env)
      const collectionTitle = realText(data.brand.collectionTitle, patterns) ?? realText(fb['brand.collectionTitle'], patterns)
      const intro = realText(data.brand.collectionIntro, patterns) ?? realText(fb['brand.collectionIntro'], patterns)
      const title = collectionTitle ? fill(lt.home.title, { siteName: t.siteName, collectionTitle }) : fill(lt.home.titleNoCollection, { siteName: t.siteName })
      const description = intro ? excerpt(intro, t.descriptionMax) : lt.home.description
      meta.jsonLd = [organizationJsonLd(env, data, lt), webSiteJsonLd(env, lt)]
      return finish(meta, title, description)
    }

    case 'collection': {
      const categoryId = route.categoryId
      const label = lt.categories[categoryId]
      if (!label || !t.categories.includes(categoryId)) return notFoundMeta(env, lt)
      const isAll = categoryId === 'tum-urunler'
      const path = isAll ? t.paths.collection : `${t.paths.collection}/${categoryId}`
      const name = isAll ? lt.collection.title : label
      const meta = baseMeta(env, lt)
      meta.canonical = absoluteUrl(path, env)
      meta.alternates = alternatesFor(path, env)
      const intro = realText(data.brand.collectionIntro, patterns) ?? realText(fb['brand.collectionIntro'], patterns)
      const description = intro ? excerpt(fill(lt.collection.description, { category: name, intro }), t.descriptionMax) : fill(lt.collection.descriptionNoIntro, { category: name })
      const crumbs = [home, { name: lt.breadcrumb.collection, url: absoluteUrl(t.paths.collection, env) }]
      if (!isAll) crumbs.push({ name, url: meta.canonical })
      meta.jsonLd = [breadcrumbJsonLd(crumbs), collectionJsonLd(env, lt, name, meta.canonical, description, data.products ?? [])]
      return finish(meta, withTitle(name, t), description)
    }

    case 'product': {
      const product = data.product
      if (!product) return notFoundMeta(env, lt)
      const path = `${t.paths.product}/${product.slug}`
      const categoryLabel = lt.categories[product.category] ?? product.category
      const meta = baseMeta(env, lt)
      meta.canonical = absoluteUrl(path, env)
      meta.alternates = alternatesFor(path, env)
      const real = realText(product.description, patterns)
      const colors = product.colorCount === 1 ? lt.product.colorsOne : fill(lt.product.colorsMany, { n: product.colorCount })
      const description = real
        ? excerpt(real, t.descriptionMax)
        : fill(lt.product.description, { name: product.name, category: categoryLabel, colors, sizes: t.sizes })
      meta.og.type = 'product'
      meta.og.price = { amount: formatPrice(product.price), currency: t.currency }
      if (product.images.length) {
        meta.og.image = product.images[0]
        meta.og.imageWidth = null
        meta.og.imageHeight = null
      }
      meta.og.imageAlt = fill(lt.product.imageAlt, { name: product.name })
      const crumbs = [
        home,
        { name: lt.breadcrumb.collection, url: absoluteUrl(t.paths.collection, env) },
        { name: categoryLabel, url: absoluteUrl(`${t.paths.collection}/${product.category}`, env) },
        { name: product.name, url: meta.canonical },
      ]
      meta.jsonLd = [breadcrumbJsonLd(crumbs), productJsonLd(env, lt, product, meta.canonical, description)]
      return finish(meta, withTitle(product.name, t), description)
    }

    case 'info': {
      const slug = t.infoAliases[route.slug] ?? route.slug
      const title = lt.info.titles[slug]
      if (!title || !data.info || !t.infoSlugs.includes(slug)) return notFoundMeta(env, lt)
      const path = `${t.paths.info}/${slug}`
      const meta = baseMeta(env, lt)
      meta.canonical = absoluteUrl(path, env)
      meta.alternates = alternatesFor(path, env)
      let description
      if (slug === 'sss') {
        description = lt.info.faqDescription
      } else if (slug === 'iletisim') {
        const details = [data.brand.companyName, data.brand.address, data.brand.phone, data.brand.email]
          .map((v, i) => realText(v, patterns) ?? realText(fb[['brand.companyName', 'brand.address', 'brand.phone', 'brand.email'][i]], patterns))
          .filter((v) => !!v)
        description = details.length ? excerpt(fill(lt.info.contactDescription, { siteName: t.siteName, details: details.join(' · ') }), t.descriptionMax) : fill(lt.info.contactDescriptionEmpty, { siteName: t.siteName })
      } else {
        const lead = realText(data.info.sections[0], patterns) ?? realText(fb[`info.${slug}.0`], patterns)
        description = lead ? excerpt(lead, t.descriptionMax) : fill(lt.info.descriptionEmpty, { title, siteName: t.siteName })
      }
      const crumbs = [home, { name: title, url: meta.canonical }]
      const faq = slug === 'sss' ? (data.faq ?? []) : []
      meta.jsonLd = [breadcrumbJsonLd(crumbs), faq.length ? faqJsonLd(title, meta.canonical, faq) : webPageJsonLd(env, lt, title, meta.canonical, description)]
      return finish(meta, withTitle(title, t), description)
    }

    case 'page': {
      const name = lt.pages[route.id]
      const path = t.pagePaths[route.id]
      if (!name || !path) return notFoundMeta(env, lt)
      const meta = baseMeta(env, lt)
      meta.canonical = absoluteUrl(path, env)
      meta.robots = 'noindex,nofollow'
      meta.jsonLd = [breadcrumbJsonLd([home, { name, url: meta.canonical }])]
      return finish(meta, withTitle(name, t), lt.home.description)
    }

    case 'notFound':
    default:
      return notFoundMeta(env, lt)
  }
}

/* =====================================================================================
 * 2) Sunucuya özgü yardımcılar
 * ===================================================================================== */

/* ---------------- SSS ayrıştırıcısı (src/components/info/parseFaq.ts ile aynı kurallar) ---------------- */

const Q_RE = /^(?:S|Q)\s*:\s*(.*)$/i
const A_RE = /^(?:C|A)\s*:\s*(.*)$/i

/** `S:`/`C:` (TR) ya da `Q:`/`A:` (EN) düz metni → { intro, items:[{question, answer[]}] }. */
export function parseFaq(text) {
  const intro = []
  const items = []
  if (!text) return { intro, items }

  let current = null
  let para = []

  const flush = () => {
    if (!para.length) return
    const joined = para.join('\n').trim()
    para = []
    if (!joined) return
    if (current) current.answer.push(joined)
    else intro.push(joined)
  }
  const close = () => {
    flush()
    if (current && current.question) items.push({ question: current.question, answer: current.answer })
    current = null
  }

  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim()
    if (!line) {
      flush()
      continue
    }
    const q = Q_RE.exec(line)
    if (q) {
      close()
      current = { question: q[1].trim(), answer: [], inAnswer: false }
      continue
    }
    const a = A_RE.exec(line)
    if (a && current) {
      flush()
      current.inAnswer = true
      if (a[1].trim()) para.push(a[1].trim())
      continue
    }
    if (current && !current.inAnswer) {
      current.question = [current.question, line].filter(Boolean).join(' ')
      continue
    }
    para.push(a && !current ? a[1].trim() || line : line)
  }
  close()

  return { intro, items }
}

/* ---------------- Yol doğrulama / rota çözümleme ---------------- */

export const PATH_RE = /^\/[A-Za-z0-9\-/._~]*$/
export const PATH_MAX = 200

/** `?path=` değeri: `/` ile başlar, yalnızca güvenli karakterler, ≤200, sorgu yok. Geçersizse null. */
export function validatePath(raw) {
  if (typeof raw !== 'string' || raw.length > PATH_MAX || !PATH_RE.test(raw)) return null
  return raw
}

/** Yol → { locale, route } (bkz. src/App.tsx rotaları + `/en` öneki). Bilinmeyen yol → notFound. */
export function resolveRoute(path) {
  let locale = 'tr'
  let p = path
  if (p === '/en' || p.startsWith('/en/')) {
    locale = 'en'
    p = p.slice(3) || '/'
  }
  p = p.replace(/\/+$/, '') || '/'
  const seg = p.split('/').slice(1)
  const pages = templates.pagePaths

  let route = { kind: 'notFound' }
  if (p === '/') route = { kind: 'home' }
  else if (seg[0] === 'koleksiyon' && seg.length === 1) route = { kind: 'collection', categoryId: 'tum-urunler' }
  else if (seg[0] === 'koleksiyon' && seg.length === 2) route = { kind: 'collection', categoryId: seg[1] }
  else if (seg[0] === 'urun' && seg.length === 2) route = { kind: 'product', slug: seg[1] }
  else if (seg[0] === 'bilgi' && seg.length === 2) route = { kind: 'info', slug: seg[1] }
  else if (seg[0] === 'odeme' && seg[1] === 'sonuc' && seg.length === 3) route = { kind: 'page', id: 'checkoutResult' }
  else {
    for (const [id, pagePath] of Object.entries(pages)) {
      if (p === pagePath) {
        route = { kind: 'page', id }
        break
      }
    }
  }
  return { locale, route }
}

/* ---------------- DB satırı → pageMeta girdisi ---------------- */

const PRODUCT_NAME_PLACEHOLDER_RE = /^Ürün (\d+) — Ürün adı$/
const DESCRIPTION_PLACEHOLDER_RE = /^Ürün (\d+) — Ürün açıklaması alanı$/

/** Pakete gömülü görsellerin URL'si API'de bilinmez; yalnızca yüklenmiş (`/uploads/…`) ya da tam URL. */
function absoluteImage(src, origin) {
  if (typeof src !== 'string' || !src.trim()) return null
  if (/^https?:\/\//i.test(src)) return src
  if (src.startsWith('/')) return `${origin}${src}`
  return null
}

/**
 * API ürünü (services/products.js → toProduct) → SeoProduct. Mağazayla (src/data/catalog.ts →
 * buildProductFromRemote) aynı seçim: EN sitede dolu EN alanı, aksi halde TR değer; yer tutucu desenler
 * dile göre yerelleştirilir.
 */
export function toSeoProduct(p, locale, origin) {
  const lt = templates.locales[locale]
  const number = p.number
  const localizeName = (name) => (PRODUCT_NAME_PLACEHOLDER_RE.test(name) ? fill(lt.placeholders.productName, { n: number }) : name)
  const localizeDescription = (text) => (DESCRIPTION_PLACEHOLDER_RE.test(text) ? fill(lt.placeholders.productDescription, { n: number }) : text)
  const pickEn = (v) => (locale === 'en' && typeof v === 'string' && v.trim() ? v.trim() : null)
  const bySlot = Object.fromEntries((p.media ?? []).map((m) => [m.kind, m.src]))
  return {
    id: p.id,
    slug: p.slug,
    name: pickEn(p.nameEn) ?? localizeName(p.name ?? ''),
    category: p.category,
    price: Number(p.price),
    colorCount: (p.colors ?? []).length,
    inStock: Object.values(p.stock ?? {}).some((sizes) => Object.values(sizes).some((qty) => (qty ?? 0) > 0)),
    images: ['front', 'back', 'model'].map((kind) => absoluteImage(bySlot[kind], origin)).filter(Boolean),
    description: pickEn(p.content?.descriptionEn) ?? localizeDescription(p.content?.description ?? ''),
    isNew: !!p.isNew,
    updatedAt: p.updatedAt ?? null,
  }
}

/** Mağazanın sanal/gerçek kategori süzmesi (src/lib/catalog.ts → productInCategory). */
export function productsForCategory(products, categoryId) {
  if (categoryId === 'tum-urunler') return products
  if (categoryId === 'yeni-gelenler') return products.filter((p) => p.isNew)
  return products.filter((p) => p.category === categoryId)
}

const blank = (v) => (typeof v === 'string' && v.trim() ? v : null)

/**
 * İçerik alanı — mağazadaki `ov()` zinciriyle aynı öncelik (src/data/content.ts):
 * EN: fieldsEn > EN geri dönüş metni > TR zinciri; TR: content_fields > TR geri dönüş metni > null.
 */
export function resolveContentField(key, fields, fieldsEn, locale) {
  const fbTr = templates.locales.tr.fallbacks
  const fbEn = templates.locales.en.fallbacks
  const trChain = () => blank(fields?.[key]) ?? blank(fbTr[key]) ?? null
  if (locale === 'en') return blank(fieldsEn?.[key]) ?? blank(fbEn[key]) ?? trChain()
  return trChain()
}

export function brandFromFields(fields, fieldsEn, locale) {
  const get = (k) => resolveContentField(`brand.${k}`, fields, fieldsEn, locale)
  return { collectionTitle: get('collectionTitle'), collectionIntro: get('collectionIntro'), companyName: get('companyName'), address: get('address'), phone: get('phone'), email: get('email') }
}

/** Bilgi sayfası bölüm metinleri (`info.<slug>.<i>`); iletişim sayfası brand alanlarından oluşur. */
export function infoSections(slug, fields, fieldsEn, locale) {
  if (slug === 'iletisim') {
    const b = brandFromFields(fields, fieldsEn, locale)
    return [b.companyName, b.address, b.phone, b.email]
  }
  const out = []
  for (let i = 0; i < 8; i++) {
    const key = `info.${slug}.${i}`
    const v = resolveContentField(key, fields, fieldsEn, locale)
    const exists = (fields && key in fields) || key in templates.locales.tr.fallbacks || key in templates.locales.en.fallbacks
    if (!exists && v === null) break
    out.push(v)
  }
  return out
}

/* ---------------- HTML / XML kaçışları ---------------- */

export function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

export function escapeXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

/* ---------------- Head enjeksiyonu (bot önizlemesi) ---------------- */

/** PageMeta → head etiketleri (src/seo/dom.ts ile aynı küme), `data-seo` işaretli. */
export function renderHead(meta) {
  const lines = []
  const m = (name, content) => lines.push(`<meta name="${escapeHtml(name)}" content="${escapeHtml(content)}" data-seo>`)
  const p = (property, content) => lines.push(`<meta property="${escapeHtml(property)}" content="${escapeHtml(content)}" data-seo>`)
  m('description', meta.description)
  m('robots', meta.robots)
  if (meta.canonical) lines.push(`<link rel="canonical" href="${escapeHtml(meta.canonical)}" data-seo>`)
  if (meta.alternates) {
    for (const [hreflang, href] of [['tr', meta.alternates.tr], ['en', meta.alternates.en], ['x-default', meta.alternates.tr]]) {
      lines.push(`<link rel="alternate" hreflang="${hreflang}" href="${escapeHtml(href)}" data-seo>`)
    }
  }
  p('og:site_name', meta.siteName)
  p('og:locale', meta.ogLocale)
  p('og:type', meta.og.type)
  if (meta.og.url) p('og:url', meta.og.url)
  p('og:title', meta.og.title)
  p('og:description', meta.og.description)
  p('og:image', meta.og.image)
  p('og:image:alt', meta.og.imageAlt)
  if (meta.og.imageWidth) p('og:image:width', String(meta.og.imageWidth))
  if (meta.og.imageHeight) p('og:image:height', String(meta.og.imageHeight))
  if (meta.og.price) {
    p('product:price:amount', meta.og.price.amount)
    p('product:price:currency', meta.og.price.currency)
  }
  m('twitter:card', 'summary_large_image')
  m('twitter:title', meta.og.title)
  m('twitter:description', meta.og.description)
  m('twitter:image', meta.og.image)
  m('twitter:image:alt', meta.og.imageAlt)
  for (const obj of meta.jsonLd) {
    lines.push(`<script type="application/ld+json" data-seo>${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`)
  }
  return lines.map((l) => `    ${l}`).join('\n')
}

/**
 * index.html'e sayfa metasını işler: `<title>` değiştirilir, `data-seo` işaretli varsayılan meta/link
 * etiketleri kaldırılır, `<html lang>` dile göre ayarlanır ve yeni etiketler `</head>` öncesine eklenir.
 */
export function injectHead(indexHtml, meta) {
  let html = indexHtml
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(meta.title)}</title>`)
  html = html.replace(/[ \t]*<(?:meta|link)\b[^>]*\bdata-seo\b[^>]*>[ \t]*\r?\n?/gi, '')
  html = html.replace(/<html\b([^>]*)\blang="[^"]*"/i, `<html$1lang="${escapeHtml(meta.lang)}"`)
  const head = renderHead(meta)
  return html.includes('</head>') ? html.replace('</head>', `${head}\n  </head>`) : `${html}\n${head}`
}

/* ---------------- Sitemap ---------------- */

/** Sitemap'e giren yollar (dil öneksiz) + ürünler için lastmod. Gizli ürünler çağıran tarafta süzülmüş olmalı. */
export function sitemapEntries(products) {
  const t = templates
  const entries = [{ path: '/' }, { path: t.paths.collection }]
  for (const id of t.categories) if (id !== 'tum-urunler') entries.push({ path: `${t.paths.collection}/${id}` })
  for (const p of products) {
    if (p.hidden) continue
    entries.push({ path: `${t.paths.product}/${p.slug}`, lastmod: isoDate(p.updatedAt) })
  }
  for (const slug of t.infoSlugs) entries.push({ path: `${t.paths.info}/${slug}` })
  return entries
}

/** "2026-10-07 11:46:08" / Date / ISO → "2026-10-07"; çözülemezse null. */
export function isoDate(value) {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(String(value).replace(' ', 'T'))
  return Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : null
}

/** urlset + xhtml:link hreflang (tr, en, x-default) — her yol için TR ve EN URL'si ayrı <url>. */
export function buildSitemapXml(entries, origin) {
  const env = { origin, locale: 'tr', templates }
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">']
  for (const e of entries) {
    const tr = absoluteUrl(e.path, env, 'tr')
    const en = absoluteUrl(e.path, env, 'en')
    for (const loc of [tr, en]) {
      lines.push('  <url>')
      lines.push(`    <loc>${escapeXml(loc)}</loc>`)
      if (e.lastmod) lines.push(`    <lastmod>${escapeXml(e.lastmod)}</lastmod>`)
      lines.push(`    <xhtml:link rel="alternate" hreflang="tr" href="${escapeXml(tr)}"/>`)
      lines.push(`    <xhtml:link rel="alternate" hreflang="en" href="${escapeXml(en)}"/>`)
      lines.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(tr)}"/>`)
      lines.push('  </url>')
    }
  }
  lines.push('</urlset>')
  return `${lines.join('\n')}\n`
}

/* ---------------- Google Merchant feed (RSS 2.0 + g: ad alanı) ---------------- */

/** SeoProduct listesi (TR) → RSS. Görseli yüklenmemiş üründe g:image_link basılmaz (Merchant Center uyarır). */
export function buildMerchantFeedXml(products, origin) {
  const t = templates
  const lt = t.locales.tr
  const env = { origin, locale: 'tr', templates }
  const patterns = t.placeholderPatterns
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
    '  <channel>',
    `    <title>${escapeXml(t.siteName)}</title>`,
    `    <link>${escapeXml(absoluteUrl('/', env))}</link>`,
    `    <description>${escapeXml(lt.home.description)}</description>`,
  ]
  for (const p of products) {
    const link = absoluteUrl(`${t.paths.product}/${p.slug}`, env)
    const categoryLabel = lt.categories[p.category] ?? p.category
    const real = realText(p.description, patterns)
    const colors = p.colorCount === 1 ? lt.product.colorsOne : fill(lt.product.colorsMany, { n: p.colorCount })
    const description = real ? cleanText(real).slice(0, 5000) : fill(lt.product.description, { name: p.name, category: categoryLabel, colors, sizes: t.sizes })
    lines.push('    <item>')
    lines.push(`      <g:id>${escapeXml(p.id)}</g:id>`)
    lines.push(`      <title>${escapeXml(p.name)}</title>`)
    lines.push(`      <description>${escapeXml(description)}</description>`)
    lines.push(`      <link>${escapeXml(link)}</link>`)
    if (p.images[0]) lines.push(`      <g:image_link>${escapeXml(p.images[0])}</g:image_link>`)
    for (const extra of p.images.slice(1)) lines.push(`      <g:additional_image_link>${escapeXml(extra)}</g:additional_image_link>`)
    lines.push(`      <g:availability>${p.inStock ? 'in_stock' : 'out_of_stock'}</g:availability>`)
    lines.push(`      <g:price>${formatPrice(p.price)} ${t.currency}</g:price>`)
    lines.push(`      <g:brand>${escapeXml(t.siteName)}</g:brand>`)
    lines.push('      <g:condition>new</g:condition>')
    lines.push(`      <g:product_type>${escapeXml(categoryLabel)}</g:product_type>`)
    lines.push('      <g:gender>female</g:gender>')
    lines.push('      <g:age_group>adult</g:age_group>')
    lines.push('    </item>')
  }
  lines.push('  </channel>', '</rss>')
  return `${lines.join('\n')}\n`
}

/* ---------------- Bot gövdesi (dynamic rendering) ----------------
 * JS çalıştırmayan tarayıcılar (LLM tarayıcıları, link önizlemeleri) için `<div id="root">` içine sayfada
 * gerçekten görünen içeriğin anlamsal HTML karşılığı basılır. Yalnızca sunucuda üretilir (TS karşılığı yok).
 * `data`'dan gelen her metin `escapeHtml`'den geçer; bağlantılar dil önekli ve göreli yoldur.
 */

/** Okunur fiyat: TR `2.650,00`, EN `2,650.00` (Intl yok — Node sürümleri arasında ICU farkı olmasın). */
export function formatPriceHuman(amount, locale) {
  const [intPart, dec] = formatPrice(amount).split('.')
  const negative = intPart.startsWith('-')
  const digits = negative ? intPart.slice(1) : intPart
  const [thousands, decimal] = locale === 'en' ? [',', '.'] : ['.', ',']
  return `${negative ? '-' : ''}${digits.replace(/\B(?=(\d{3})+(?!\d))/g, thousands)}${decimal}${dec}`
}

/** Bağlantı hedefi güvenli mi? Yalnızca http(s):// ya da site içi `/yol` (protokolsüz `//alan` değil). */
function safeHref(url) {
  return /^https?:\/\//i.test(url) || /^\/(?!\/)/.test(url)
}

/** Satır içi işaretler — girdi önceden kaçışlanmış metindir. */
function inlineMarkdown(escaped) {
  const links = []
  let out = escaped.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (_, label, url) => {
    // Yer tutucu: Unicode özel kullanım alanı karakteri (girdiden önceden silinir). Güvensiz hedef (javascript:, data: …) bağlantı olmaz; yalnızca etiket düz metin kalır.
    links.push(safeHref(url) ? `<a href="${url}">${label}</a>` : label)
    return `\uE000${links.length - 1}\uE000`
  })
  out = out.replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>')
  out = out.replace(/(^|[^*\w])\*([^*\s][^*\n]*?)\*(?![*\w])/g, '$1<em>$2</em>')
  return out.replace(/\uE000(\d+)\uE000/g, (_, i) => links[Number(i)])
}

/**
 * Küçük ve güvenli markdown → HTML (src/components/ui/LegalText.tsx'e yakın kurallar). Önce kaçışlanır, ham
 * HTML asla geçmez. `#`/`##` → h2, `###` → h3, `####`+ → h4; `---`/`***`/`___` → hr; `- `/`* `/`• ` → ul;
 * `1. ` → ol; diğer satırlar paragraf (boş satır paragraf böler, tek satır sonu → br).
 */
export function renderMarkdown(text) {
  if (text === null || text === undefined || !String(text).trim()) return ''
  const lines = escapeHtml(String(text).replace(/\uE000/g, '').replace(/\r\n?/g, '\n')).split('\n')
  const out = []
  let para = []
  let list = null
  const flushPara = () => {
    if (para.length) out.push(`<p>${para.map(inlineMarkdown).join('<br>')}</p>`)
    para = []
  }
  const flushList = () => {
    if (list) out.push(`<${list.tag}>${list.items.map((it) => `<li>${inlineMarkdown(it)}</li>`).join('')}</${list.tag}>`)
    list = null
  }
  const addItem = (tag, item) => {
    flushPara()
    if (list && list.tag !== tag) flushList()
    if (!list) list = { tag, items: [] }
    list.items.push(item)
  }
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) {
      flushPara()
      flushList()
      continue
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      flushPara()
      flushList()
      out.push('<hr>')
      continue
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading) {
      flushPara()
      flushList()
      const level = heading[1].length <= 2 ? 2 : heading[1].length === 3 ? 3 : 4
      out.push(`<h${level}>${inlineMarkdown(heading[2].trim())}</h${level}>`)
      continue
    }
    const bullet = /^[-*•]\s+(.*)$/.exec(line)
    if (bullet) {
      addItem('ul', bullet[1])
      continue
    }
    const ordered = /^\d+[.)]\s+(.*)$/.exec(line)
    if (ordered) {
      addItem('ol', ordered[1])
      continue
    }
    flushList()
    para.push(line)
  }
  flushPara()
  flushList()
  return out.join('\n')
}

/** `<div id="root"></div>` içine gövdeyi koyar; kök yoksa `</body>` önüne, o da yoksa sona ekler. `injectHead` sonrası çağrılır. */
export function injectBody(html, bodyHtml) {
  const root = `<div id="root">${bodyHtml}</div>`
  if (/<div id="root">\s*<\/div>/.test(html)) return html.replace(/<div id="root">\s*<\/div>/, () => root)
  if (html.includes('</body>')) return html.replace('</body>', () => `${root}\n</body>`)
  return `${html}\n${root}`
}

/** Ana sayfa "Üretim" bölümü metinleri (`production.*` içerik alanları; boşsa contentTexts.ts geri dönüşü). */
export function productionContent(fields, fieldsEn, locale) {
  const get = (k) => resolveContentField(`production.${k}`, fields, fieldsEn, locale)
  return {
    intro: get('intro'),
    steps: ['kesim', 'dikim', 'kalite'].map((s) => ({ title: get(`${s}.title`), text: get(`${s}.text`) })),
  }
}

/**
 * Şablondaki bilgi sayfası geri dönüşleri contentTexts.ts metninin ilk `leadMax` karakteridir (meta için).
 * İçerik alanı DB'de boşsa gövdeye bu kesik metin gelir; kelime ortasında bitmesin diye son tam satıra kadar alınır.
 */
function wholeLines(text, fallback, max) {
  if (!text || text !== fallback || text.length < max) return text
  const cut = text.lastIndexOf('\n')
  return cut > 0 ? text.slice(0, cut).trim() : text
}

const SIZE_ROW_RE = /^(XS|S|M|L|XL):\s*(.*)$/

/** Beden tablosu metni ("XS: Göğüs 80–84 cm · Bel …") → `<table>`; tablo satırı yoksa markdown. */
function renderSizeGuide(text, sizeLabel) {
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n').map((l) => l.trim())
  const rows = lines.map((l) => SIZE_ROW_RE.exec(l)).filter(Boolean)
  if (!rows.length) return renderMarkdown(text)
  const cells = rows.map((m) => m[2].split(/\s*·\s*/).filter(Boolean))
  // Sütun etiketleri ("Göğüs 80–84 cm" → "Göğüs") her satırda aynı sırada çıkarılabiliyorsa başlık satırı basılır.
  const split = (c) => /^(\D+?)\s+(\d.*)$/.exec(c)
  const labels = cells[0].map((c) => split(c)?.[1] ?? null)
  const uniform = labels.every(Boolean) && cells.every((r) => r.length === labels.length && r.every((c, i) => split(c)?.[1] === labels[i]))
  const head = uniform ? `<thead><tr><th scope="col">${escapeHtml(sizeLabel)}</th>${labels.map((l) => `<th scope="col">${escapeHtml(l)}</th>`).join('')}</tr></thead>` : ''
  const body = rows
    .map((m, r) => `<tr><th scope="row">${escapeHtml(m[1])}</th>${cells[r].map((c) => `<td>${escapeHtml(uniform ? split(c)[2] : c)}</td>`).join('')}</tr>`)
    .join('')
  const table = `<table>${head}<tbody>${body}</tbody></table>`
  const firstRow = lines.findIndex((l) => SIZE_ROW_RE.test(l))
  let lastRow = -1
  lines.forEach((l, i) => {
    if (SIZE_ROW_RE.test(l)) lastRow = i
  })
  const para = (ls) => ls.filter(Boolean).map((l) => `<p>${inlineMarkdown(escapeHtml(l))}</p>`)
  const middle = lines.slice(firstRow, lastRow + 1).filter((l) => l && !SIZE_ROW_RE.test(l))
  return [...para(lines.slice(0, firstRow)), table, ...para(middle), ...para(lines.slice(lastRow + 1))].join('\n')
}

/**
 * Rota + veri → `<div id="root">` içine konacak anlamsal HTML (header / main / footer). Veri `pageMeta` ile
 * aynıdır; ek alanlar: home → `products` (SeoProduct[]), `production` ({intro, steps[]}); product →
 * `related` (SeoProduct[]), `delivery` ({shipping, returns}). Bilinmeyen sayfa → "Sayfa bulunamadı" gövdesi.
 */
export function renderBody(route, data, env) {
  const t = env.templates
  const locale = env.locale
  const lt = t.locales[locale]
  const b = lt.bot
  const patterns = t.placeholderPatterns
  const fb = lt.fallbacks
  const e = escapeHtml
  const href = (path) => e(localizedPath(path, locale))
  const link = (path, text) => `<a href="${href(path)}">${e(text)}</a>`
  const real = (v, fbKey) => realText(v, patterns) ?? (fbKey ? realText(fb[fbKey], patterns) : null)
  const brand = (k) => real(data.brand?.[k], `brand.${k}`)
  const price = (amount) => fill(b.priceFormat, { amount: formatPriceHuman(amount, locale) })
  const categoryName = (id) => lt.categories[id] ?? id
  const colorsText = (n) => (n === 1 ? lt.product.colorsOne : fill(lt.product.colorsMany, { n }))
  const productPath = (p) => `${t.paths.product}/${p.slug}`
  const crumbs = (items) =>
    `<nav aria-label="${e(b.breadcrumb)}"><ol>${items
      .map((it, i) => (i === items.length - 1 ? `<li aria-current="page">${e(it.name)}</li>` : `<li>${link(it.path, it.name)}</li>`))
      .join('')}</ol></nav>`
  const homeCrumb = { name: lt.breadcrumb.home, path: '/' }
  const collectionCrumb = { name: lt.breadcrumb.collection, path: t.paths.collection }
  const contactLines = (values) => {
    const [company, address, phone, email] = values
    const out = []
    if (company) out.push(e(company))
    if (address) out.push(e(address))
    if (phone) out.push(`<a href="tel:${e((normalizePhone(phone) ?? phone).replace(/[^\d+]/g, ''))}">${e(phone)}</a>`)
    if (email) out.push(`<a href="mailto:${e(email)}">${e(email)}</a>`)
    return out.length ? `<address>${out.join('<br>')}</address>` : ''
  }
  const notFound = () => `<h1>${e(lt.notFound.title)}</h1>\n<p>${e(lt.notFound.description)}</p>`

  const main = (() => {
    switch (route.kind) {
      case 'home': {
        const collectionTitle = brand('collectionTitle')
        const intro = brand('collectionIntro')
        const out = [`<h1>${e(collectionTitle ?? `${t.siteName} — ${b.siteTagline}`)}</h1>`]
        if (intro) out.push(`<p>${e(intro)}</p>`)
        const products = [...(data.products ?? [])].sort((x, y) => Number(!!y.isNew) - Number(!!x.isNew)).slice(0, t.itemListMax)
        if (products.length) {
          const items = products.map((p) => `<li>${link(productPath(p), p.name)} — ${e(price(p.price))} · ${e(categoryName(p.category))}</li>`)
          out.push(`<section><h2>${e(b.featured)}</h2><ul>${items.join('')}</ul></section>`)
        }
        out.push(`<p>${link(t.paths.collection, b.allProducts)}</p>`)
        const production = data.production ?? productionContent(null, null, locale)
        const steps = (production.steps ?? [])
          .map((s) => ({ title: realText(s.title, patterns), text: realText(s.text, patterns) }))
          .filter((s) => s.title || s.text)
          .map((s) => `${s.title ? `<h3>${e(s.title)}</h3>` : ''}${s.text ? `<p>${e(s.text)}</p>` : ''}`)
        const productionIntro = realText(production.intro, patterns)
        if (productionIntro || steps.length) {
          out.push(`<section id="uretim"><h2>${e(b.production)}</h2>${productionIntro ? `<p>${e(productionIntro)}</p>` : ''}${steps.join('')}</section>`)
        }
        return out.join('\n')
      }

      case 'collection': {
        const categoryId = route.categoryId
        if (!lt.categories[categoryId] || !t.categories.includes(categoryId)) return notFound()
        const isAll = categoryId === 'tum-urunler'
        const name = isAll ? lt.collection.title : lt.categories[categoryId]
        const path = isAll ? t.paths.collection : `${t.paths.collection}/${categoryId}`
        const out = [crumbs(isAll ? [homeCrumb, collectionCrumb] : [homeCrumb, collectionCrumb, { name, path }]), `<h1>${e(name)}</h1>`]
        const intro = brand('collectionIntro')
        if (intro) out.push(`<p>${e(intro)}</p>`)
        const items = (data.products ?? []).map(
          (p) => `<li>${link(productPath(p), p.name)} — ${e(price(p.price))} · ${e(colorsText(p.colorCount))} · ${e(p.inStock ? b.inStock : b.outOfStock)}</li>`,
        )
        if (items.length) out.push(`<ul>${items.join('')}</ul>`)
        return out.join('\n')
      }

      case 'product': {
        const p = data.product
        if (!p) return notFound()
        const category = categoryName(p.category)
        const categoryPath = `${t.paths.collection}/${p.category}`
        const out = [
          crumbs([homeCrumb, collectionCrumb, { name: category, path: categoryPath }, { name: p.name, path: productPath(p) }]),
          `<h1>${e(p.name)}</h1>`,
          `<p>${e(b.price)}: ${e(price(p.price))}</p>`,
          `<p>${e(p.inStock ? b.inStock : b.outOfStock)}</p>`,
          `<dl><dt>${e(b.category)}</dt><dd>${link(categoryPath, category)}</dd><dt>${e(b.colors)}</dt><dd>${e(colorsText(p.colorCount))}</dd><dt>${e(b.sizes)}</dt><dd>${e(t.sizes)}</dd></dl>`,
        ]
        const alt = fill(lt.product.imageAlt, { name: p.name })
        for (const src of (p.images ?? []).slice(0, 3)) out.push(`<img src="${e(src)}" alt="${e(alt)}">`)
        const description = realText(p.description, patterns)
        if (description) out.push(`<section><h2>${e(b.description)}</h2>${renderMarkdown(description)}</section>`)
        const shipping = renderMarkdown(realText(data.delivery?.shipping, patterns))
        const returns = renderMarkdown(realText(data.delivery?.returns, patterns))
        out.push(`<section><h2>${e(b.deliveryReturns)}</h2>${shipping}${returns}<p>${link(`${t.paths.info}/teslimat-ve-iade`, b.deliveryPolicyLink)}</p></section>`)
        const related = (data.related ?? []).slice(0, 4)
        if (related.length) {
          const items = related.map((r) => `<li>${link(productPath(r), r.name)} — ${e(price(r.price))}</li>`)
          out.push(`<section><h2>${e(b.related)}</h2><ul>${items.join('')}</ul></section>`)
        }
        return out.join('\n')
      }

      case 'info': {
        const slug = t.infoAliases[route.slug] ?? route.slug
        const title = lt.info.titles[slug]
        if (!title || !data.info || !t.infoSlugs.includes(slug)) return notFound()
        const out = [crumbs([homeCrumb, { name: title, path: `${t.paths.info}/${slug}` }]), `<h1>${e(title)}</h1>`]
        const sections = data.info.sections ?? []
        if (slug === 'iletisim') {
          const keys = ['companyName', 'address', 'phone', 'email']
          out.push(contactLines(keys.map((k, i) => real(sections[i], `brand.${k}`))))
          return out.join('\n')
        }
        const texts = sections.map((s, i) => wholeLines(real(s, `info.${slug}.${i}`), fb[`info.${slug}.${i}`], t.leadMax)).filter(Boolean)
        if (slug === 'sss') {
          const parsed = texts.map((s) => parseFaq(s))
          if (parsed.some((f) => f.items.length)) {
            out.push(`<p>${e(lt.info.faqDescription)}</p>`)
            for (const f of parsed) {
              for (const para of f.intro) out.push(`<p>${e(para)}</p>`)
              for (const item of f.items) out.push(`<section><h2>${e(item.question)}</h2>${item.answer.map((a) => `<p>${e(a)}</p>`).join('')}</section>`)
            }
            return out.join('\n')
          }
        }
        const render = (s) => (slug === 'beden-rehberi' ? renderSizeGuide(s, b.sizes) : renderMarkdown(s))
        if (texts.length > 1) for (const s of texts) out.push(`<section>${render(s)}</section>`)
        else if (texts.length === 1) out.push(render(texts[0]))
        return out.join('\n')
      }

      case 'page': {
        const name = lt.pages[route.id]
        if (!name || !t.pagePaths[route.id]) return notFound()
        return `<h1>${e(name)}</h1>`
      }

      case 'notFound':
      default:
        return notFound()
    }
  })()

  const mainNav = [`<li>${link(t.paths.collection, lt.collection.title)}</li>`]
  for (const id of t.categories) if (id !== 'tum-urunler') mainNav.push(`<li>${link(`${t.paths.collection}/${id}`, categoryName(id))}</li>`)
  const infoNav = t.infoSlugs.map((slug) => `<li>${link(`${t.paths.info}/${slug}`, lt.info.titles[slug])}</li>`)
  return [
    `<header><p>${link('/', t.siteName)} — ${e(b.siteTagline)}</p><nav aria-label="${e(b.mainNav)}"><ul>${mainNav.join('')}</ul></nav></header>`,
    `<main>\n${main}\n</main>`,
    `<footer><nav aria-label="${e(b.infoNav)}"><ul>${infoNav.join('')}</ul></nav>${contactLines(['companyName', 'address', 'phone', 'email'].map(brand))}</footer>`,
  ].join('\n')
}

/* ---------------- /llms.txt ---------------- */

/** Markdown bağlantı metni için tek satır, köşeli parantezler kaçışlı. */
function mdText(s) {
  return String(s).replace(/\s+/g, ' ').trim().replace(/([[\]\\])/g, '\\$1')
}

/**
 * llms.txt (https://llmstxt.org) — sitenin düz metin özeti. `data = { brand, products (SeoProduct[]),
 * info: { [slug]: bölüm metinleri[] } }`; boş alanlar şablon geri dönüşlerine düşer. URL'ler mutlaktır.
 */
export function buildLlmsTxt(data, env) {
  const t = env.templates
  const locale = env.locale
  const lt = t.locales[locale]
  const b = lt.bot
  const patterns = t.placeholderPatterns
  const fb = lt.fallbacks
  const real = (v, fbKey) => realText(v, patterns) ?? realText(fb[fbKey], patterns)
  const products = data.products ?? []
  const lines = [`# ${t.siteName}`, '', `> ${b.llmsIntro}`, '']

  lines.push(`## ${lt.collection.title}`, '')
  for (const id of t.categories) {
    if (id === 'tum-urunler') continue
    const name = lt.categories[id]
    const count = productsForCategory(products, id).length
    lines.push(`- [${mdText(name)}](${absoluteUrl(`${t.paths.collection}/${id}`, env)}): ${fill(lt.collection.descriptionNoIntro, { category: name })} (${fill(b.productCount, { n: count })})`)
  }
  lines.push('')

  if (products.length) {
    lines.push(`## ${b.products}`, '')
    for (const p of products) {
      const parts = [lt.categories[p.category] ?? p.category, fill(b.priceFormat, { amount: formatPriceHuman(p.price, locale) })]
      const description = realText(p.description, patterns)
      if (description) parts.push(excerpt(description, 160))
      lines.push(`- [${mdText(p.name)}](${absoluteUrl(`${t.paths.product}/${p.slug}`, env)}): ${parts.join(' · ')}`)
    }
    lines.push('')
  }

  const brand = (k) => real(data.brand?.[k], `brand.${k}`)
  const contact = [brand('companyName'), brand('address'), brand('phone'), brand('email')]
  lines.push(`## ${b.infoNav}`, '')
  for (const slug of t.infoSlugs) {
    const title = lt.info.titles[slug]
    let summary
    if (slug === 'sss') summary = lt.info.faqDescription
    else if (slug === 'iletisim') summary = contact.filter(Boolean).join(' · ')
    else summary = real(data.info?.[slug]?.[0], `info.${slug}.0`)
    const url = absoluteUrl(`${t.paths.info}/${slug}`, env)
    lines.push(summary ? `- [${mdText(title)}](${url}): ${excerpt(summary, 160)}` : `- [${mdText(title)}](${url})`)
  }
  lines.push('')

  if (contact.some(Boolean)) {
    lines.push(`## ${b.contact}`, '')
    const [company, address, phone, email] = contact
    if (company) lines.push(`- ${cleanText(company)}`)
    if (address) lines.push(`- ${cleanText(address)}`)
    if (phone) lines.push(`- ${normalizePhone(phone) ?? cleanText(phone)}`)
    if (email) lines.push(`- ${cleanText(email)}`)
    lines.push('')
  }

  lines.push(`## ${b.languages}`, '', `- TR: ${absoluteUrl('/', env, 'tr')}`, `- EN: ${absoluteUrl('/', env, 'en')}`, `- Sitemap: ${env.origin}/sitemap.xml`)
  return `${lines.join('\n')}\n`
}
