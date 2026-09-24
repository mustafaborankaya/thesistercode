/**
 * Yönetici: toplu dışa/içe aktarma.
 *
 * KAPSAM (bilinçli sınırlama): yalnızca katalog + içerik + ayarlar dışa/içe aktarılır — ürünler
 * (renk/stok/görsel/ilişkiler dahil), content_fields, settings, brand_media. admin_users
 * (parola hash'i), customers (kişisel veri) ve orders/order_items (muhasebe/stok geçmişi) bu uç
 * noktaya DAHİL EDİLMEZ; bunların kendi özel uç noktaları var ve toplu JSON dışa aktarımında
 * dolaşmaları güvenlik/gizlilik açısından uygun değildir. Süpervizör "tüm veri" beklentisini
 * genişletmek isterse bu dosya güncellenebilir.
 */
import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db.js'
import * as productsService from '../services/products.js'
import * as contentService from '../services/content.js'
import * as settingsService from '../services/settings.js'
import { requireAdmin, requireOwner } from '../auth.js'
import { parseBody } from '../errors.js'

const router = Router()
router.use(requireAdmin)

// Export/import yalnızca owner'a özeldir (spesifikasyon gereği) — bir editor hesabı ele geçirilse
// bile tüm katalog/içerik/ayarları tek istekte dışa aktaramaz.
router.get('/export', requireOwner, async (req, res, next) => {
  try {
    const [products, fields, fieldsEn, brandMedia, settings] = await Promise.all([
      productsService.listProducts({ includeHidden: true }),
      contentService.getFields(),
      contentService.getFieldsEn(),
      contentService.getBrandMedia(),
      settingsService.getSettings(),
    ])
    res.json({
      format: 'teshvikiye-api-export',
      version: 1,
      exportedAt: new Date().toISOString(),
      // Ürünlerin EN alanları (nameEn, content.descriptionEn/fabricCareEn, colors[].labelEn) listProducts'tan gelir.
      data: { products, content: { fields, fieldsEn, brandMedia }, settings },
    })
  } catch (err) {
    next(err)
  }
})

// Ürün girdileri, katalog uç noktalarının (admin-products.js) kabul ettiği alanlarla tutarlı ve
// sıkı biçimde doğrulanır — genel `z.record(unknown)` yerine: bozuk/kötü niyetli bir içe aktarma
// dosyasının şema dışı alanlarla veritabanını bozmasını (ör. eksik id, geçersiz kategori) önler.
const productImportSchema = z.object({
  id: z.string().regex(/^urun-\d{2,4}$/, "id 'urun-NN' biçiminde olmalı"),
  number: z.string().min(1).max(8),
  slug: z.string().min(1).max(80).optional(),
  name: z.string().min(1).max(200),
  nameEn: z.string().max(200).nullable().optional(),
  category: z.enum(productsService.CATEGORIES),
  isNew: z.boolean().optional(),
  price: z.number().min(0),
  hidden: z.boolean().optional(),
  content: z
    .object({
      description: z.string().nullable().optional(),
      descriptionEn: z.string().nullable().optional(),
      fabricCare: z.string().nullable().optional(),
      fabricCareEn: z.string().nullable().optional(),
      deliveryReturns: z.string().nullable().optional(),
    })
    .optional(),
  colors: z
    .array(z.object({ id: z.string().min(1).max(32), label: z.string().min(1).max(64), labelEn: z.string().max(64).nullable().optional() }))
    .max(20)
    .optional(),
  stock: z.record(z.string(), z.record(z.string(), z.number().int().min(0).max(100000))).optional(),
  media: z
    .array(z.object({ kind: z.enum(productsService.MEDIA_KINDS), src: z.string().max(500).nullable().optional() }))
    .max(20)
    .optional(),
  similarProductIds: z.array(z.string().max(32)).max(50).optional(),
  completeLookProductIds: z.array(z.string().max(32)).max(50).optional(),
})

const importSchema = z.object({
  format: z.literal('teshvikiye-api-export').optional(),
  data: z.object({
    // Boyut sınırı: tek bir istekte en fazla 2000 ürün — hem patolojik/DoS amaçlı çok satırlı
    // yüklerin önüne geçer hem de genel JSON gövde limitiyle (1 MB) birlikte savunma derinliği sağlar.
    products: z.array(productImportSchema).max(2000).optional(),
    content: z
      .object({
        fields: z.record(z.string().max(120), z.string().nullable()).optional(),
        // İngilizce içerik değerleri (value_en); yoksa mevcut EN değerlerine dokunulmaz.
        fieldsEn: z.record(z.string().max(120), z.string().nullable()).optional(),
        brandMedia: z.record(z.string().max(64), z.string().nullable()).optional(),
      })
      .optional(),
    settings: z.record(z.string().max(120), z.unknown()).optional(),
  }),
})

router.post('/import', requireOwner, async (req, res, next) => {
  try {
    const { data } = parseBody(importSchema, req.body)
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      if (Array.isArray(data.products)) {
        await conn.query('DELETE FROM product_relations')
        await conn.query('DELETE FROM product_media')
        await conn.query('DELETE FROM product_stock')
        await conn.query('DELETE FROM product_colors')
        await conn.query('DELETE FROM products')

        let sortOrder = 0
        for (const p of data.products) {
          await conn.query(
            `INSERT INTO products (id, number, slug, name, name_en, category, is_new, price, description, description_en, fabric_care, fabric_care_en, delivery_returns, hidden, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              p.id,
              p.number,
              p.slug ?? p.id,
              p.name,
              productsService.enOrNull(p.nameEn),
              p.category,
              p.isNew ? 1 : 0,
              p.price,
              p.content?.description ?? null,
              productsService.enOrNull(p.content?.descriptionEn),
              p.content?.fabricCare ?? null,
              productsService.enOrNull(p.content?.fabricCareEn),
              p.content?.deliveryReturns ?? null,
              p.hidden ? 1 : 0,
              sortOrder++,
            ],
          )
          let i = 0
          for (const c of p.colors ?? []) {
            await conn.query(
              'INSERT INTO product_colors (product_id, color_id, label, label_en, sort_order) VALUES (?, ?, ?, ?, ?)',
              [p.id, c.id, c.label, productsService.enOrNull(c.labelEn), i++],
            )
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
          for (const m of p.media ?? []) {
            if (m?.src) {
              await conn.query('INSERT INTO product_media (product_id, kind, url) VALUES (?, ?, ?)', [p.id, m.kind, m.src])
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
        }
      }

      if (data.content?.fields) {
        for (const [key, value] of Object.entries(data.content.fields)) {
          await conn.query(
            'INSERT INTO content_fields (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)',
            [key, value],
          )
        }
      }
      if (data.content?.fieldsEn) {
        for (const [key, value] of Object.entries(data.content.fieldsEn)) {
          await conn.query(
            'INSERT INTO content_fields (`key`, value, value_en) VALUES (?, NULL, ?) ON DUPLICATE KEY UPDATE value_en = VALUES(value_en)',
            [key, contentService.blankToNull(value)],
          )
        }
      }
      if (data.content?.brandMedia) {
        for (const [name, url] of Object.entries(data.content.brandMedia)) {
          await conn.query('INSERT INTO brand_media (name, url) VALUES (?, ?) ON DUPLICATE KEY UPDATE url = VALUES(url)', [
            name,
            url,
          ])
        }
      }
      if (data.settings) {
        for (const [key, value] of Object.entries(data.settings)) {
          await conn.query(
            'INSERT INTO settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)',
            [key, JSON.stringify(value ?? null)],
          )
        }
      }

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      throw err
    } finally {
      conn.release()
    }

    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

export default router
