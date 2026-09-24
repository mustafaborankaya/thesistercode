/** Herkese açık uç noktalar: ürün katalogu, içerik alanları, site ayarları. */
import { Router } from 'express'
import * as productsService from '../services/products.js'
import * as contentService from '../services/content.js'
import * as settingsService from '../services/settings.js'
import { notFound } from '../errors.js'
import { ADMIN_COOKIE } from '../auth.js'
import jwt from 'jsonwebtoken'
import { env } from '../env.js'
import { pool } from '../db.js'

const router = Router()

const JWT_ALGORITHM = 'HS256'

/**
 * includeHidden=1 yalnızca geçerli VE aktif bir yönetici oturumu varsa etkilidir; aksi halde
 * sessizce yok sayılır. `requireAdmin` ile aynı mantık: JWT imzası doğrulanır VE rol/aktiflik her
 * istekte DB'den tazelenir — yalnızca imza doğrulaması yeterli değildir, aksi halde devre dışı
 * bırakılmış/rolü düşürülmüş bir yöneticinin token'ı (12 saate kadar) gizli ürünleri görmeye devam
 * edebilirdi.
 */
async function hasAdminSession(req) {
  const token = req.cookies?.[ADMIN_COOKIE]
  if (!token) return false
  try {
    const payload = jwt.verify(token, env.SESSION_SECRET, { algorithms: [JWT_ALGORITHM] })
    if (payload.type !== 'admin') return false
    const [rows] = await pool.query('SELECT is_active FROM admin_users WHERE id = ? LIMIT 1', [payload.sub])
    return !!rows[0]?.is_active
  } catch {
    return false
  }
}

router.get('/products', async (req, res, next) => {
  try {
    const category = typeof req.query.category === 'string' ? req.query.category : undefined
    const includeHidden = req.query.includeHidden === '1' && (await hasAdminSession(req))
    const products = await productsService.listProducts({ category, includeHidden })
    res.json({ products })
  } catch (err) {
    next(err)
  }
})

router.get('/products/:slug', async (req, res, next) => {
  try {
    const includeHidden = await hasAdminSession(req)
    const product = await productsService.getProductBySlug(req.params.slug, { includeHidden })
    if (!product) return next(notFound('Ürün bulunamadı'))
    res.json({ product })
  } catch (err) {
    next(err)
  }
})

router.get('/content', async (req, res, next) => {
  try {
    // `fieldsEn` yalnızca DOLU İngilizce değerleri içerir (geriye uyumlu ek alan; bkz. 005_content_locale.sql).
    const [fields, fieldsEn, brandMedia] = await Promise.all([
      contentService.getFields(),
      contentService.getFieldsEn(),
      contentService.getBrandMedia(),
    ])
    res.json({ fields, fieldsEn, brandMedia })
  } catch (err) {
    next(err)
  }
})

// Mağazanın (public, kimlik doğrulamasız) render için ihtiyaç duyduğu bilinen ayar anahtarları
// (bkz. admin-settings.js → KNOWN_SETTINGS_SCHEMAS). Bir admin `PUT /admin/settings` ile bu
// listede olmayan/operasyonel bir anahtar eklerse (ör. ileride bir entegrasyon anahtarı), bu
// varsayılan olarak PUBLİK yanıta DAHİL EDİLMEZ — "hiçbir şey sızmasın" ilkesi gereği izin
// listesi (whitelist) esas alınır, tüm `settings` tablosu ham olarak dökülmez.
const PUBLIC_SETTING_KEYS = [
  'brand.name',
  'brand.shortName',
  'memberDiscount',
  'shipping.amount',
  'support.whatsappNumber',
  'support.email',
  'social',
  'offerPanel.delayAfterConsentMs',
  // Mağazadaki "Son N adet" notu yöneticinin eşiğini kullansın (iş sırrı değildir).
  'inventory.lowStockThreshold',
]

// memberDiscount içindeki `code` (indirim/kupon kodu) ve `usageLimit` (iç kullanım sayacı) iş
// verisidir ve herkese açık bir uç noktada yayınlanmamalıdır; kod doğrulaması gerekiyorsa sunucu
// tarafında ayrı, kimlik doğrulamalı/hız sınırlı bir uç noktadan yapılmalıdır.
const PUBLIC_MEMBER_DISCOUNT_KEYS = ['enabled', 'percent', 'mode', 'minSubtotal', 'expiresAt']

function sanitizeSettingsForPublic(settings) {
  const out = {}
  for (const key of PUBLIC_SETTING_KEYS) {
    if (!(key in settings)) continue
    out[key] = settings[key]
  }
  if (out.memberDiscount && typeof out.memberDiscount === 'object') {
    const md = {}
    for (const k of PUBLIC_MEMBER_DISCOUNT_KEYS) md[k] = out.memberDiscount[k] ?? null
    out.memberDiscount = md
  }
  return out
}

router.get('/settings', async (req, res, next) => {
  try {
    const settings = await settingsService.getSettings()
    res.json({ settings: sanitizeSettingsForPublic(settings) })
  } catch (err) {
    next(err)
  }
})

export default router
