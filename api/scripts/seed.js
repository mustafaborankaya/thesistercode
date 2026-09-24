#!/usr/bin/env node
/**
 * İlk veri yükleme (idempotent — her tablo yalnızca BOŞSA doldurulur):
 *   1) admin_users boşsa ADMIN_USERNAME/ADMIN_PASSWORD ile owner hesabı (bcrypt cost 12)
 *   2) products boşsa api/seed/catalog.json'dan 24 ürün (src/data/catalog.ts ile birebir üretildi)
 *   3) content_fields boşsa mağazanın kullandığı anahtarlar NULL değerle (bkz. src/data/content.ts)
 *   4) settings boşsa mağazanın varsayılanları (bkz. src/config/settings.ts → defaultSettings)
 *   5) brand_media boşsa bilinen görsel adları NULL url ile (bkz. src/data/media.ts → brandMediaNames)
 * `node scripts/seed.js`
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import bcrypt from 'bcryptjs'
import { pool } from '../src/db.js'
import { env } from '../src/env.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function tableCount(table) {
  const [rows] = await pool.query(`SELECT COUNT(*) AS n FROM ${table}`)
  return rows[0].n
}

async function seedAdmin() {
  const count = await tableCount('admin_users')
  if (count > 0) {
    console.log('[seed] admin_users zaten dolu, atlanıyor.')
    return
  }
  const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 12)
  await pool.query('INSERT INTO admin_users (username, password_hash, role, is_active) VALUES (?, ?, \'owner\', 1)', [
    env.ADMIN_USERNAME,
    passwordHash,
  ])
  console.log(`[seed] admin_users: owner hesabı oluşturuldu (${env.ADMIN_USERNAME}).`)
}

async function seedProducts() {
  const count = await tableCount('products')
  if (count > 0) {
    console.log('[seed] products zaten dolu, atlanıyor.')
    return
  }
  const catalogPath = path.join(__dirname, '..', 'seed', 'catalog.json')
  const catalog = JSON.parse(await fs.readFile(catalogPath, 'utf8'))

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    let sortOrder = 0
    for (const p of catalog) {
      await conn.query(
        `INSERT INTO products (id, number, slug, name, category, is_new, price, description, fabric_care, delivery_returns, hidden, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          p.id,
          p.number,
          p.slug,
          p.name,
          p.category,
          p.isNew ? 1 : 0,
          p.price,
          p.content?.description ?? null,
          p.content?.fabricCare ?? null,
          p.content?.deliveryReturns ?? null,
          p.hidden ? 1 : 0,
          sortOrder++,
        ],
      )
      let i = 0
      for (const c of p.colors ?? []) {
        await conn.query('INSERT INTO product_colors (product_id, color_id, label, sort_order) VALUES (?, ?, ?, ?)', [
          p.id,
          c.id,
          c.label,
          i++,
        ])
      }
      for (const [colorId, bySize] of Object.entries(p.stock ?? {})) {
        for (const [size, qty] of Object.entries(bySize)) {
          await conn.query('INSERT INTO product_stock (product_id, color_id, size, qty) VALUES (?, ?, ?, ?)', [
            p.id,
            colorId,
            size,
            Number(qty) || 0,
          ])
        }
      }
      let si = 0
      for (const relatedId of p.similarProductIds ?? []) {
        await conn.query(
          "INSERT INTO product_relations (product_id, related_id, type, sort_order) VALUES (?, ?, 'similar', ?)",
          [p.id, relatedId, si++],
        )
      }
      let ci = 0
      for (const relatedId of p.completeLookProductIds ?? []) {
        await conn.query(
          "INSERT INTO product_relations (product_id, related_id, type, sort_order) VALUES (?, ?, 'complete_look', ?)",
          [p.id, relatedId, ci++],
        )
      }
      // Görsel URL'leri kasıtlı olarak boş bırakılır: hiçbir görsel yüklenmediği sürece
      // GET /products yanıtında ilgili media alanı src:null ile döner (mağaza yer tutucu gösterir).
    }
    await conn.commit()
    console.log(`[seed] products: ${catalog.length} ürün yüklendi.`)
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

// bkz. src/data/content.ts — brandContentKeys, productionContent, sizeGuideContent, cookieContent, infoDefs
const CONTENT_FIELD_KEYS = [
  'brand.companyName',
  'brand.address',
  'brand.phone',
  'brand.email',
  'brand.workingHours',
  'brand.collectionTitle',
  'brand.collectionIntro',
  'cookie.bannerText',
  'cookie.necessary',
  'cookie.analytics',
  'cookie.marketing',
  'production.intro',
  'production.kesim.title',
  'production.kesim.text',
  'production.dikim.title',
  'production.dikim.text',
  'production.kalite.title',
  'production.kalite.text',
  'sizeGuide.table',
  'sizeGuide.note',
  'info.hakkimizda.0',
  'info.hakkimizda.1',
  'info.teslimat.0',
  'info.teslimat.1',
  'info.teslimat.2',
  'info.iade-degisim.0',
  'info.iade-degisim.1',
  'info.iade-degisim.2',
  'info.beden-rehberi.0',
  'info.beden-rehberi.1',
  'info.sss.0',
  'info.sss.1',
  'info.sss.2',
  'info.sss.3',
  'info.gizlilik.0',
  'info.gizlilik.1',
  'info.cerez-politikasi.0',
  'info.alisveris-kosullari.0',
  'info.alisveris-kosullari.1',
]

async function seedContentFields() {
  const count = await tableCount('content_fields')
  if (count > 0) {
    console.log('[seed] content_fields zaten dolu, atlanıyor.')
    return
  }
  for (const key of CONTENT_FIELD_KEYS) {
    await pool.query('INSERT INTO content_fields (`key`, value) VALUES (?, NULL)', [key])
  }
  console.log(`[seed] content_fields: ${CONTENT_FIELD_KEYS.length} anahtar NULL değerle oluşturuldu.`)
}

// bkz. src/config/settings.ts → defaultSettings (mağazanın istemci tarafı varsayılanlarıyla birebir)
const DEFAULT_SETTINGS = {
  'brand.name': 'Teshvikiye',
  'brand.shortName': 'Teshvikiye',
  memberDiscount: {
    enabled: true,
    percent: 10,
    mode: 'automatic',
    code: null,
    minSubtotal: null,
    usageLimit: null,
    expiresAt: null,
    /** true → indirim yalnızca üyenin İLK (iptal edilmemiş) siparişine uygulanır; false → her siparişte. */
    firstOrderOnly: true,
  },
  'shipping.amount': null,
  'support.whatsappNumber': null,
  'support.email': null,
  social: { instagram: null, tiktok: null, pinterest: null },
  'offerPanel.delayAfterConsentMs': 6000,
  // Stok takibi: 1..eşik adet "düşük stok", 0 "tükendi" (yalnızca yönetici ayarı — public /settings'e girmez).
  'inventory.lowStockThreshold': 3,
  // "Yeni" rozeti otomatik kuralı: created_at son N gün içindeyse (bkz. migrations/006_inventory.sql).
  'catalog.newBadgeDays': 30,
  // Çevrim içi ödeme taksit seçenekleri (iyzico: 1,2,3,6,9,12). null → env PAYMENT_INSTALLMENTS (varsayılan 1).
  // Sağlayıcı (payment.provider) bilinçli olarak burada YOK: env PAYMENT_PROVIDER'dan gelir.
  'payment.installments': null,
}

async function seedSettings() {
  const count = await tableCount('settings')
  if (count > 0) {
    // Dolu tabloda mevcut değerlere DOKUNULMAZ; yalnızca sonradan eklenen varsayılan anahtarlar
    // (örn. inventory.lowStockThreshold, catalog.newBadgeDays) eksikse eklenir.
    let added = 0
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      const [result] = await pool.query('INSERT IGNORE INTO settings (`key`, value) VALUES (?, ?)', [key, JSON.stringify(value)])
      added += result.affectedRows
    }
    // Nesne değerli anahtarlara sonradan eklenen alanlar (örn. memberDiscount.firstOrderOnly): mevcut
    // alanların değerleri KORUNUR, yalnızca eksik alanlar varsayılanla tamamlanır.
    let merged = 0
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) continue
      const [rows] = await pool.query('SELECT CAST(value AS CHAR) AS value FROM settings WHERE `key` = ? LIMIT 1', [key])
      if (!rows[0]) continue
      let current
      try {
        current = JSON.parse(rows[0].value)
      } catch {
        continue
      }
      if (!current || typeof current !== 'object' || Array.isArray(current)) continue
      const missing = Object.keys(value).filter((k) => !(k in current))
      if (!missing.length) continue
      const next = { ...current }
      for (const k of missing) next[k] = value[k]
      await pool.query('UPDATE settings SET value = ? WHERE `key` = ?', [JSON.stringify(next), key])
      merged += missing.length
    }
    console.log(`[seed] settings zaten dolu; eksik ${added} varsayılan anahtar, ${merged} eksik alan eklendi.`)
    return
  }
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await pool.query('INSERT INTO settings (`key`, value) VALUES (?, ?)', [key, JSON.stringify(value)])
  }
  console.log(`[seed] settings: ${Object.keys(DEFAULT_SETTINGS).length} varsayılan anahtar oluşturuldu.`)
}

// bkz. src/data/media.ts → brandMediaNames
const BRAND_MEDIA_NAMES = [
  'acilis-masaustu',
  'acilis-mobil',
  'koleksiyon',
  'giris',
  'logo',
  'uretim-video',
  'uretim-video-kapak',
  'uretim-kesim',
  'uretim-dikim',
  'uretim-kalite',
]

async function seedBrandMedia() {
  const count = await tableCount('brand_media')
  if (count > 0) {
    console.log('[seed] brand_media zaten dolu, atlanıyor.')
    return
  }
  for (const name of BRAND_MEDIA_NAMES) {
    await pool.query('INSERT INTO brand_media (name, url) VALUES (?, NULL)', [name])
  }
  console.log(`[seed] brand_media: ${BRAND_MEDIA_NAMES.length} görsel adı NULL url ile oluşturuldu.`)
}

async function main() {
  await seedAdmin()
  await seedProducts()
  await seedContentFields()
  await seedSettings()
  await seedBrandMedia()
  console.log('[seed] tamamlandı.')
}

main()
  .catch((err) => {
    console.error('[seed] hata:', err.message)
    process.exitCode = 1
  })
  .finally(() => pool.end())
