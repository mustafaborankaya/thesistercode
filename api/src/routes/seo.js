/**
 * SEO uç noktaları (herkese açık, kimlik doğrulamasız):
 *   GET /sitemap.xml                 — Apache `/sitemap.xml` → buraya rewrite eder (public/.htaccess)
 *   GET /feeds/google-merchant.xml   — Google Merchant ürün akışı (RSS 2.0)
 *   GET /seo/render?path=/urun/x     — bot önizlemesi: index.html'e sayfa metası işlenmiş HTML
 *                                      (WhatsApp/Facebook/Twitter/Telegram JS çalıştırmaz; Apache bot
 *                                      UA'larını buraya yönlendirir). Bilinmeyen sayfa → 404 + noindex.
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
  buildSitemapXml,
  infoSections,
  injectHead,
  pageMeta,
  parseFaq,
  productsForCategory,
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

/** Rota için gereken veriyi bağlamdan derler (services/seo.js → pageMeta girdisi). */
function dataForRoute(route, locale, ctx) {
  const { fields, fieldsEn, settings } = ctx
  const data = { brand: brandFromFields(fields, fieldsEn, locale), social: settings?.social ?? null }
  const seoProducts = () => ctx.products.map((p) => toSeoProduct(p, locale, siteUrl))
  if (route.kind === 'product') {
    const row = ctx.products.find((p) => p.slug === route.slug)
    data.product = row ? toSeoProduct(row, locale, siteUrl) : null
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

router.get('/seo/render', async (req, res, next) => {
  try {
    const path = validatePath(req.query.path)
    if (!path) return next(badRequest('path geçersiz', 'invalid_path'))
    const { locale, route } = resolveRoute(path)
    const [ctx, indexHtml] = await Promise.all([getContext(), readIndexHtml()])
    const meta = pageMeta(route, dataForRoute(route, locale, ctx), { origin: siteUrl, locale, templates })
    res.status(meta.status)
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 'public, max-age=300')
    res.setHeader('Vary', 'User-Agent')
    res.send(injectHead(indexHtml, meta))
  } catch (err) {
    next(err)
  }
})

export default router
