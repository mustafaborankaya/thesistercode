/**
 * SEO uç noktaları (herkese açık, kimlik doğrulamasız):
 *   GET /sitemap.xml                 — Apache `/sitemap.xml` → buraya rewrite eder (public/.htaccess)
 *   GET /feeds/google-merchant.xml   — Google Merchant ürün akışı (RSS 2.0)
 *   GET /seo/render?path=/urun/x     — bot önizlemesi: index.html'e sayfa metası işlenmiş HTML
 *                                      (WhatsApp/Facebook/Twitter/Telegram JS çalıştırmaz; Apache bot
 *                                      UA'larını buraya yönlendirir). Bilinmeyen sayfa → 404 + noindex.
 *                                      `<div id="root">` içine sayfadaki içeriğin anlamsal HTML'i basılır
 *                                      (JS çalıştırmayan LLM tarayıcıları da metni görsün).
 *   GET /llms.txt                    — LLM tarayıcıları için site özeti (TR; Apache `/llms.txt` → buraya)
 * Meta kuralları mağazadaki src/seo/seo.ts ile aynıdır (bkz. services/seo.js).
 */
import fsp from 'node:fs/promises'
import { Router } from 'express'
import { siteUrl, spaIndexPath } from '../env.js'
import { badRequest } from '../errors.js'
import * as productsService from '../services/products.js'
import * as contentService from '../services/content.js'
import * as settingsService from '../services/settings.js'
import {
  brandFromFields,
  buildMerchantFeedXml,
  buildLlmsTxt,
  buildSitemapXml,
  infoSections,
  injectBody,
  injectHead,
  pageMeta,
  parseFaq,
  productionContent,
  productsForCategory,
  realText,
  renderBody,
  resolveContentField,
  resolveRoute,
  sitemapEntries,
  templates,
  toSeoProduct,
  validatePath,
} from '../services/seo.js'

const router = Router()

/** Bot dalgalarında DB'yi yormamak için ürün/içerik/ayar bağlamı kısa süre bellekte tutulur. */
const CONTEXT_TTL_MS = 30_000
let contextCache = null

async function loadContext() {
  const [products, fields, fieldsEn, settings] = await Promise.all([
    productsService.listProducts({ includeHidden: false }),
    contentService.getFields(),
    contentService.getFieldsEn(),
    settingsService.getSettings(),
  ])
  return { products, fields, fieldsEn, settings }
}

function getContext() {
  const now = Date.now()
  if (contextCache && now - contextCache.at < CONTEXT_TTL_MS) return contextCache.promise
  const promise = loadContext().catch((err) => {
    contextCache = null // başarısız yükleme önbelleğe alınmaz
    throw err
  })
  contextCache = { at: now, promise }
  return promise
}

/** SPA index.html — mtime değişmedikçe diskten yeniden okunmaz. Dosya yoksa en küçük iskelet (bir kez loglanır). */
const FALLBACK_INDEX = '<!doctype html>\n<html lang="tr">\n  <head>\n    <meta charset="UTF-8" />\n    <title>Teshvikiye</title>\n  </head>\n  <body></body>\n</html>\n'
let indexCache = { mtimeMs: -1, html: null }
let indexWarned = false

async function readIndexHtml() {
  try {
    const stat = await fsp.stat(spaIndexPath)
    if (indexCache.html !== null && stat.mtimeMs === indexCache.mtimeMs) return indexCache.html
    const html = await fsp.readFile(spaIndexPath, 'utf8')
    indexCache = { mtimeMs: stat.mtimeMs, html }
    return html
  } catch (err) {
    if (!indexWarned) {
      indexWarned = true
      console.error(`[seo] SPA_INDEX_PATH okunamadı (${spaIndexPath}): ${err?.message || err} — iskelet HTML kullanılıyor`)
    }
    return FALLBACK_INDEX
  }
}

/**
 * "Benzer Ürünler" — mağazadaki getSimilar ile aynı seçim (src/lib/recommendations.ts): panelde tanımlı
 * benzer ürünler varsa yalnızca onlar, yoksa aynı kategoriden diğerleri; tükenenler ve "Kombini Tamamla"
 * listesindekiler atlanır, en çok 4.
 */
function relatedRows(row, rows, toSeo) {
  const exclude = new Set([row.id, ...(row.completeLookProductIds ?? [])])
  const byId = new Map(rows.map((r) => [r.id, r]))
  const explicit = row.similarProductIds ?? []
  const candidates = explicit.length ? explicit.map((id) => byId.get(id)).filter(Boolean) : rows.filter((r) => r.category === row.category)
  const out = []
  for (const r of candidates) {
    if (out.length >= 4) break
    if (exclude.has(r.id)) continue
    const p = toSeo(r)
    if (!p.inStock) continue
    exclude.add(r.id)
    out.push(p)
  }
  return out
}

/** Rota için gereken veriyi bağlamdan derler (services/seo.js → pageMeta / renderBody girdisi). */
function dataForRoute(route, locale, ctx) {
  const { fields, fieldsEn, settings } = ctx
  const data = { brand: brandFromFields(fields, fieldsEn, locale), social: settings?.social ?? null }
  const toSeo = (p) => toSeoProduct(p, locale, siteUrl)
  const seoProducts = () => ctx.products.map(toSeo)
  if (route.kind === 'home') {
    data.products = seoProducts()
    data.production = productionContent(fields, fieldsEn, locale)
  } else if (route.kind === 'product') {
    const row = ctx.products.find((p) => p.slug === route.slug)
    data.product = row ? toSeo(row) : null
    if (row) {
      data.related = relatedRows(row, ctx.products, toSeo)
      // Ürüne özel teslimat/iade metni (yalnızca TR alanı var) doluysa sayfada o görünür; yoksa genel metinler.
      const own = locale === 'tr' ? realText(row.content?.deliveryReturns ?? '', templates.placeholderPatterns) : null
      data.delivery = own
        ? { shipping: own, returns: null }
        : {
            shipping: resolveContentField('info.teslimat.0', fields, fieldsEn, locale),
            returns: resolveContentField('info.iade-degisim.0', fields, fieldsEn, locale),
          }
    }
  } else if (route.kind === 'collection') {
    data.products = templates.categories.includes(route.categoryId) ? productsForCategory(seoProducts(), route.categoryId) : []
  } else if (route.kind === 'info') {
    const slug = templates.infoAliases[route.slug] ?? route.slug
    if (templates.infoSlugs.includes(slug)) {
      const sections = infoSections(slug, fields, fieldsEn, locale)
      data.info = { slug, sections }
      if (slug === 'sss') data.faq = sections.flatMap((s) => parseFaq(s).items)
    } else {
      data.info = null
    }
  }
  return data
}

router.get('/sitemap.xml', async (req, res, next) => {
  try {
    const ctx = await getContext()
    const xml = buildSitemapXml(sitemapEntries(ctx.products), siteUrl)
    res.setHeader('Content-Type', 'application/xml; charset=utf-8')
    res.setHeader('Cache-Control', 'public, max-age=3600')
    res.send(xml)
  } catch (err) {
    next(err)
  }
})

router.get('/feeds/google-merchant.xml', async (req, res, next) => {
  try {
    const ctx = await getContext()
    const products = ctx.products.map((p) => toSeoProduct(p, 'tr', siteUrl))
    const xml = buildMerchantFeedXml(products, siteUrl)
    res.setHeader('Content-Type', 'application/xml; charset=utf-8')
    res.setHeader('Cache-Control', 'public, max-age=3600')
    res.send(xml)
  } catch (err) {
    next(err)
  }
})

router.get('/llms.txt', async (req, res, next) => {
  try {
    const ctx = await getContext()
    const { fields, fieldsEn } = ctx
    const info = Object.fromEntries(templates.infoSlugs.map((slug) => [slug, infoSections(slug, fields, fieldsEn, 'tr')]))
    const data = { brand: brandFromFields(fields, fieldsEn, 'tr'), products: ctx.products.map((p) => toSeoProduct(p, 'tr', siteUrl)), info }
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.setHeader('Cache-Control', 'public, max-age=3600')
    res.send(buildLlmsTxt(data, { origin: siteUrl, locale: 'tr', templates }))
  } catch (err) {
    next(err)
  }
})

router.get('/seo/render', async (req, res, next) => {
  try {
    const path = validatePath(req.query.path)
    if (!path) return next(badRequest('path geçersiz', 'invalid_path'))
    const { locale, route } = resolveRoute(path)
    const [ctx, indexHtml] = await Promise.all([getContext(), readIndexHtml()])
    const env = { origin: siteUrl, locale, templates }
    const data = dataForRoute(route, locale, ctx)
    const meta = pageMeta(route, data, env)
    res.status(meta.status)
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 'public, max-age=300')
    res.setHeader('Vary', 'User-Agent')
    // 404'te de gövde basılır ("Sayfa bulunamadı").
    res.send(injectBody(injectHead(indexHtml, meta), renderBody(route, data, env)))
  } catch (err) {
    next(err)
  }
})

export default router
