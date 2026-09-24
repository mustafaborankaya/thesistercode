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

router.get('/export', async (req, res, next) => {
  try {
    const [products, fields, brandMedia, settings] = await Promise.all([
      productsService.listProducts({ includeHidden: true }),
      contentService.getFields(),
      contentService.getBrandMedia(),
      settingsService.getSettings(),
    ])
    res.json({
      format: 'teshvikiye-api-export',
      version: 1,
      exportedAt: new Date().toISOString(),
      data: { products, content: { fields, brandMedia }, settings },
    })
  } catch (err) {
    next(err)
  }
})

const importSchema = z.object({
  format: z.literal('teshvikiye-api-export').optional(),
  data: z.object({
    products: z.array(z.record(z.string(), z.unknown())).optional(),
    content: z
      .object({
        fields: z.record(z.string(), z.string().nullable()).optional(),
        brandMedia: z.record(z.string(), z.string().nullable()).optional(),
      })
      .optional(),
    settings: z.record(z.string(), z.unknown()).optional(),
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
            `INSERT INTO products (id, number, slug, name, category, is_new, price, description, fabric_care, delivery_returns, hidden, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              p.id,
              p.number,
              p.slug ?? p.id,
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
