/**
 * SEO META ÜRETİMİ — saf yardımcılar (DOM yok, veri modülü importu yok).
 *
 * Aynı mantık API tarafında `api/src/services/seo.js` içinde (JS) birebir tekrarlanır: iki taraf da aynı
 * şablon JSON'unu kullanır (`src/seo/templates.json` = `api/src/services/seo-templates.json`) ve
 * `api/test/seo.test.js` hem iki JSON'un eşitliğini hem de aynı girdi için iki uygulamanın aynı çıktıyı
 * verdiğini doğrular (Node tip soyma ile bu dosyayı doğrudan içe aktarır). Burada bir kural değiştiğinde
 * JS tarafı da aynı şekilde güncellenmelidir.
 *
 * Bu dosya yalnızca `import type` kullanır; çalışma zamanında hiçbir modüle bağımlı değildir (Node testi
 * ve Vite aynı dosyayı sorunsuz yükler). Veri toplama `RouteSeo.tsx`'te (istemci) ve `api/src/routes/seo.js`'te
 * (sunucu) yapılır; buradaki `pageMeta` yalnızca normalize edilmiş veriyi başlık/açıklama/JSON-LD'ye çevirir.
 */
import type templatesJson from './templates.json'

export type SeoTemplates = typeof templatesJson
export type SeoLocale = 'tr' | 'en'
export type SeoPageId = 'search' | 'cart' | 'checkout' | 'checkoutResult' | 'login' | 'register' | 'passwordReset' | 'verifyEmail' | 'account' | 'favorites'

/** Rota — `pageMeta` için normalize edilmiş sayfa kimliği (yol ayrıştırması çağıranın işidir). */
export type SeoRoute =
  | { kind: 'home' }
  | { kind: 'collection'; categoryId: string }
  | { kind: 'product'; slug: string }
  | { kind: 'info'; slug: string }
  | { kind: 'page'; id: SeoPageId }
  | { kind: 'notFound' }

export interface SeoEnv {
  /** Mutlak URL kökü — canlıda `https://teshvikiye.com`, istemcide `window.location.origin`. Sondaki `/` olmadan. */
  origin: string
  locale: SeoLocale
  templates: SeoTemplates
}

export interface SeoProduct {
  id: string
  slug: string
  name: string
  category: string
  price: number
  colorCount: number
  inStock: boolean
  /** Mutlak görsel URL'leri, sırayla ön / arka / model — yalnızca gerçek görseli olanlar. */
  images: string[]
  description: string | null
}

export interface SeoBrand {
  collectionTitle: string | null
  collectionIntro: string | null
  companyName: string | null
  address: string | null
  phone: string | null
  email: string | null
}

export interface SeoSocial {
  instagram?: string | null
  tiktok?: string | null
  pinterest?: string | null
}

export interface SeoFaqItem {
  question: string
  answer: string[]
}

export interface SeoInfo {
  slug: string
  /** Bölüm metinleri (null → şablondaki geri dönüş metni). */
  sections: (string | null)[]
}

export interface SeoData {
  brand: SeoBrand
  social?: SeoSocial | null
  /** Ürün rotası: ürün (null → bulunamadı). */
  product?: SeoProduct | null
  /** Koleksiyon rotası: kategoriye göre süzülmüş ürünler, katalog sırasıyla. */
  products?: SeoProduct[]
  /** Bilgi rotası: sayfa (null → bulunamadı). */
  info?: SeoInfo | null
  /** `/bilgi/sss`: ayrıştırılmış sorular (bkz. src/components/info/parseFaq.ts). */
  faq?: SeoFaqItem[]
}

export interface PageMeta {
  status: 200 | 404
  siteName: string
  title: string
  description: string
  canonical: string | null
  alternates: { tr: string; en: string } | null
  robots: 'index,follow' | 'noindex,nofollow'
  lang: string
  ogLocale: string
  og: {
    type: 'website' | 'product'
    url: string | null
    title: string
    description: string
    image: string
    imageAlt: string
    imageWidth: number | null
    imageHeight: number | null
    price: { amount: string; currency: string } | null
  }
  jsonLd: Record<string, unknown>[]
}

type LocaleTemplates = SeoTemplates['locales'][SeoLocale]

/* ---------------- Metin yardımcıları ---------------- */

/** `{anahtar}` yer tutucularını doldurur; tanımsız anahtar boş kalır. */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => (vars[key] === undefined ? '' : String(vars[key])))
}

/** HTML/markdown işaretlerini temizler, boşlukları tekler. "Son güncelleme" satırı (yasal metinler) atılır. */
export function cleanText(text: string): string {
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
export function excerpt(text: string, max: number): string {
  const clean = cleanText(text)
  if (clean.length <= max) return clean
  let cut = clean.slice(0, max - 1)
  const lastSpace = cut.lastIndexOf(' ')
  if (lastSpace > max * 0.6) cut = cut.slice(0, lastSpace)
  cut = cut.replace(/[\s,;:·—–-]+$/, '')
  return `${cut}…`
}

/** Yer tutucu mu? (boş, "Ürün NN — …", "… alanı", "içerik eklenecek" vb. — bkz. templates.placeholderPatterns) */
export function isPlaceholder(text: string | null | undefined, patterns: string[]): boolean {
  if (!text || !text.trim()) return true
  return patterns.some((p) => new RegExp(p, 'u').test(text.trim()))
}

/** Gerçek metin ya da null. */
export function realText(text: string | null | undefined, patterns: string[]): string | null {
  return isPlaceholder(text, patterns) ? null : text!.trim()
}

/** Fiyat: 2 ondalık, nokta ayırıcı (JSON-LD / feed). */
export function formatPrice(amount: number): string {
  return (Math.round(amount * 100) / 100).toFixed(2)
}

/* ---------------- URL yardımcıları ---------------- */

/** Yolu dile göre öneklendirir: en → `/en` + yol (ana sayfa `/en`), tr → yol. */
export function localizedPath(path: string, locale: SeoLocale): string {
  const bare = path.replace(/\/+$/, '') || '/'
  if (locale === 'en') return bare === '/' ? '/en' : `/en${bare}`
  return bare
}

/** Mutlak URL — sorgu dizesi yok. */
export function absoluteUrl(path: string, env: SeoEnv, locale: SeoLocale = env.locale): string {
  return `${env.origin}${localizedPath(path, locale)}`
}

function alternatesFor(path: string, env: SeoEnv): { tr: string; en: string } {
  return { tr: absoluteUrl(path, env, 'tr'), en: absoluteUrl(path, env, 'en') }
}

/* ---------------- Kuruluş bilgisi ---------------- */

/** "0507 600 6124" / "+90 507 600 6124" → "+90 507 600 61 24"; biçimlenemiyorsa null. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  let digits = raw.replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('90')) digits = digits.slice(2)
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1)
  if (digits.length !== 10) return null
  return `+90 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 8)} ${digits.slice(8, 10)}`
}

export interface PostalAddress {
  '@type': 'PostalAddress'
  streetAddress: string
  addressLocality?: string
  addressRegion?: string
  addressCountry: 'TR'
}

/** "Çağlayan Mah. … K:4 Kağıthane / İstanbul" → sokak / ilçe / il. Ayrıştırılamazsa tamamı streetAddress. */
export function parseAddress(raw: string): PostalAddress {
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

const SOCIAL_BASE: Record<keyof SeoSocial, (handle: string) => string> = {
  instagram: (h) => `https://www.instagram.com/${h}/`,
  tiktok: (h) => `https://www.tiktok.com/@${h}`,
  pinterest: (h) => `https://www.pinterest.com/${h}/`,
}

/** Ayarlardaki sosyal hesaplar → mutlak URL listesi (yalnızca dolu olanlar; kullanıcı adı ya da tam URL kabul edilir). */
export function socialLinks(social: SeoSocial | null | undefined): string[] {
  if (!social) return []
  const out: string[] = []
  for (const key of ['instagram', 'tiktok', 'pinterest'] as const) {
    const value = social[key]
    if (typeof value !== 'string' || !value.trim()) continue
    const v = value.trim()
    out.push(/^https?:\/\//i.test(v) ? v : SOCIAL_BASE[key](v.replace(/^@/, '').replace(/\/+$/, '')))
  }
  return out
}

/* ---------------- JSON-LD ---------------- */

function organizationJsonLd(env: SeoEnv, data: SeoData, lt: LocaleTemplates): Record<string, unknown> {
  const t = env.templates
  const patterns = t.placeholderPatterns
  const fb = lt.fallbacks as Record<string, string | undefined>
  const legalName = realText(data.brand.companyName, patterns) ?? realText(fb['brand.companyName'], patterns)
  const address = realText(data.brand.address, patterns) ?? realText(fb['brand.address'], patterns)
  const phone = normalizePhone(realText(data.brand.phone, patterns) ?? realText(fb['brand.phone'], patterns))
  const email = realText(data.brand.email, patterns) ?? realText(fb['brand.email'], patterns)
  const org: Record<string, unknown> = {
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
    const cp: Record<string, unknown> = { '@type': 'ContactPoint', contactType: lt.organization.contactType, availableLanguage: lt.organization.availableLanguage }
    if (phone) cp.telephone = phone
    if (email) cp.email = email
    org.contactPoint = [cp]
  }
  const sameAs = socialLinks(data.social)
  if (sameAs.length) org.sameAs = sameAs
  return org
}

function webSiteJsonLd(env: SeoEnv, lt: LocaleTemplates): Record<string, unknown> {
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

function breadcrumbJsonLd(items: { name: string; url: string }[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: it.url })),
  }
}

function productJsonLd(env: SeoEnv, lt: LocaleTemplates, product: SeoProduct, canonical: string, description: string): Record<string, unknown> {
  const t = env.templates
  const out: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description,
    sku: product.id,
    brand: { '@type': 'Brand', name: t.siteName },
    category: (lt.categories as Record<string, string>)[product.category] ?? product.category,
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

function collectionJsonLd(env: SeoEnv, lt: LocaleTemplates, name: string, canonical: string, description: string, products: SeoProduct[]): Record<string, unknown> {
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

function faqJsonLd(name: string, canonical: string, faq: SeoFaqItem[]): Record<string, unknown> {
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

function webPageJsonLd(env: SeoEnv, lt: LocaleTemplates, name: string, canonical: string, description: string): Record<string, unknown> {
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

function baseMeta(env: SeoEnv, lt: LocaleTemplates): PageMeta {
  const t = env.templates
  return {
    status: 200,
    siteName: t.siteName,
    title: t.siteName,
    description: lt.home.description,
    canonical: null,
    alternates: null,
    robots: 'index,follow',
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

function finish(meta: PageMeta, title: string, description: string): PageMeta {
  meta.title = title
  meta.description = description
  meta.og.title = title
  meta.og.description = description
  meta.og.url = meta.canonical
  return meta
}

function withTitle(page: string, t: SeoTemplates): string {
  return `${page}${t.titleSeparator}${t.siteName}`
}

function notFoundMeta(env: SeoEnv, lt: LocaleTemplates): PageMeta {
  const meta = baseMeta(env, lt)
  meta.status = 404
  meta.robots = 'noindex,nofollow'
  return finish(meta, withTitle(lt.notFound.title, env.templates), lt.notFound.description)
}

/**
 * Rota + normalize veri → sayfa metası. Çağıran taraf veriyi toplar (istemci: katalog modülleri; sunucu: DB);
 * burada yalnızca şablon kuralları uygulanır. Bilinmeyen ürün/kategori/sayfa → 404 + noindex.
 */
export function pageMeta(route: SeoRoute, data: SeoData, env: SeoEnv): PageMeta {
  const t = env.templates
  const lt = t.locales[env.locale]
  const patterns = t.placeholderPatterns
  const fb = lt.fallbacks as Record<string, string | undefined>
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
      const label = (lt.categories as Record<string, string | undefined>)[categoryId]
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
      const categoryLabel = (lt.categories as Record<string, string | undefined>)[product.category] ?? product.category
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
      const slug = (t.infoAliases as Record<string, string | undefined>)[route.slug] ?? route.slug
      const title = (lt.info.titles as Record<string, string | undefined>)[slug]
      if (!title || !data.info || !t.infoSlugs.includes(slug)) return notFoundMeta(env, lt)
      const path = `${t.paths.info}/${slug}`
      const meta = baseMeta(env, lt)
      meta.canonical = absoluteUrl(path, env)
      meta.alternates = alternatesFor(path, env)
      let description: string
      if (slug === 'sss') {
        description = lt.info.faqDescription
      } else if (slug === 'iletisim') {
        const details = [data.brand.companyName, data.brand.address, data.brand.phone, data.brand.email]
          .map((v, i) => realText(v, patterns) ?? realText(fb[['brand.companyName', 'brand.address', 'brand.phone', 'brand.email'][i]], patterns))
          .filter((v): v is string => !!v)
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
      const name = (lt.pages as Record<string, string | undefined>)[route.id]
      const path = (t.pagePaths as Record<string, string | undefined>)[route.id]
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
