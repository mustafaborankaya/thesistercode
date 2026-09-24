/** Ürün SQL sorguları ve mağaza `Product` tipiyle aynı şekle dönüştürme. */
import { pool } from '../db.js'
import { badRequest, conflict, notFound } from '../errors.js'

export const SIZES = ['XS', 'S', 'M', 'L', 'XL']
export const CATEGORIES = ['elbiseler', 'ust-giyim', 'alt-giyim', 'takimlar', 'dis-giyim']
export const MEDIA_KINDS = ['front', 'back', 'model', 'fabric']

/** Boş/boşluk EN metni → null: EN alanı "yok" demektir, mağaza Türkçe değere düşer. */
export const enOrNull = (v) => (typeof v === 'string' && v.trim() ? v : null)

const MEDIA_LABELS = {
  front: 'Ön görünüş fotoğrafı',
  back: 'Arka görünüş fotoğrafı',
  model: 'Model üzerindeki fotoğraf',
  fabric: 'Kumaş detay fotoğrafı',
}

/** Aynı ürün grubu için satırları product_id'ye göre gruplar. */
function groupBy(rows, key) {
  const map = new Map()
  for (const row of rows) {
    const k = row[key]
    if (!map.has(k)) map.set(k, [])
    map.get(k).push(row)
  }
  return map
}

async function fetchRelated(productIds) {
  if (productIds.length === 0) {
    return { colors: new Map(), stock: new Map(), media: new Map(), relations: new Map() }
  }
  const placeholders = productIds.map(() => '?').join(',')
  const [colorRows] = await pool.query(
    `SELECT product_id, color_id, label, label_en, sort_order FROM product_colors WHERE product_id IN (${placeholders}) ORDER BY product_id, sort_order, color_id`,
    productIds,
  )
  const [stockRows] = await pool.query(
    `SELECT product_id, color_id, size, qty FROM product_stock WHERE product_id IN (${placeholders})`,
    productIds,
  )
  const [mediaRows] = await pool.query(
    `SELECT product_id, kind, url FROM product_media WHERE product_id IN (${placeholders})`,
    productIds,
  )
  const [relationRows] = await pool.query(
    `SELECT product_id, related_id, type, sort_order FROM product_relations WHERE product_id IN (${placeholders}) ORDER BY product_id, type, sort_order`,
    productIds,
  )
  return {
    colors: groupBy(colorRows, 'product_id'),
    stock: groupBy(stockRows, 'product_id'),
    media: groupBy(mediaRows, 'product_id'),
    relations: groupBy(relationRows, 'product_id'),
  }
}

/** DB satırlarını mağazanın `Product` tipiyle aynı şekle çevirir (bkz. src/data/types.ts). */
function toProduct(row, related) {
  const colorRows = related.colors.get(row.id) ?? []
  const colors = colorRows.map((c) => ({ id: c.color_id, label: c.label, labelEn: enOrNull(c.label_en) }))

  const stockRows = related.stock.get(row.id) ?? []
  const stock = {}
  for (const c of colorRows) stock[c.color_id] = Object.fromEntries(SIZES.map((s) => [s, 0]))
  for (const s of stockRows) {
    if (!stock[s.color_id]) stock[s.color_id] = Object.fromEntries(SIZES.map((sz) => [sz, 0]))
    stock[s.color_id][s.size] = s.qty
  }

  const mediaRows = related.media.get(row.id) ?? []
  const mediaByKind = Object.fromEntries(mediaRows.map((m) => [m.kind, m.url]))
  const media = MEDIA_KINDS.map((kind) => ({
    kind,
    label: `Ürün ${row.number} — ${MEDIA_LABELS[kind]}`,
    src: mediaByKind[kind] ?? null,
  }))

  const relationRows = related.relations.get(row.id) ?? []
  const similarProductIds = relationRows.filter((r) => r.type === 'similar').map((r) => r.related_id)
  const completeLookProductIds = relationRows.filter((r) => r.type === 'complete_look').map((r) => r.related_id)

  const product = {
    id: row.id,
    number: row.number,
    slug: row.slug,
    name: row.name,
    nameEn: enOrNull(row.name_en),
    category: row.category,
    isNew: !!row.is_new,
    price: Number(row.price),
    colors,
    sizes: SIZES,
    stock,
    media,
    content: {
      description: row.description ?? '',
      fabricCare: row.fabric_care ?? '',
      deliveryReturns: row.delivery_returns ?? '',
      descriptionEn: enOrNull(row.description_en),
      fabricCareEn: enOrNull(row.fabric_care_en),
    },
    hidden: !!row.hidden,
  }
  // Mağazadaki demo katalogla birebir davranış: ilişki tanımlı değilse alan hiç eklenmez.
  if (similarProductIds.length) product.similarProductIds = similarProductIds
  if (completeLookProductIds.length) product.completeLookProductIds = completeLookProductIds
  return product
}

/** Kategori değerini gerçek kategori veya sanal kategori (tum-urunler / yeni-gelenler) olarak yorumlar. */
function categoryFilter(category) {
  if (!category || category === 'tum-urunler') return { where: '', params: [] }
  if (category === 'yeni-gelenler') return { where: ' AND is_new = 1', params: [] }
  if (CATEGORIES.includes(category)) return { where: ' AND category = ?', params: [category] }
  return { where: ' AND 1=0', params: [] } // bilinmeyen kategori → boş sonuç
}

export async function listProducts({ category, includeHidden = false } = {}) {
  const { where, params } = categoryFilter(category)
  const hiddenClause = includeHidden ? '' : ' AND hidden = 0'
  const [rows] = await pool.query(
    `SELECT * FROM products WHERE 1=1${hiddenClause}${where} ORDER BY sort_order ASC, id ASC`,
    params,
  )
  const related = await fetchRelated(rows.map((r) => r.id))
  return rows.map((r) => toProduct(r, related))
}

export async function getProductBySlug(slug, { includeHidden = false } = {}) {
  const [rows] = await pool.query('SELECT * FROM products WHERE slug = ? LIMIT 1', [slug])
  const row = rows[0]
  if (!row) return null
  if (row.hidden && !includeHidden) return null
  const related = await fetchRelated([row.id])
  return toProduct(row, related)
}

export async function getProductById(id) {
  const [rows] = await pool.query('SELECT * FROM products WHERE id = ? LIMIT 1', [id])
  const row = rows[0]
  if (!row) return null
  const related = await fetchRelated([row.id])
  return toProduct(row, related)
}

/** Admin panel: fiyat/stok/renk gibi satır bazlı veriler için ham ürün satırını da doğrular. */
async function assertProductExists(id) {
  const [rows] = await pool.query('SELECT id, number, price FROM products WHERE id = ? LIMIT 1', [id])
  if (!rows[0]) throw notFound('Ürün bulunamadı')
  return rows[0]
}

export async function updateProduct(id, patch) {
  await assertProductExists(id)
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    const fields = []
    const values = []
    const map = {
      name: 'name',
      price: 'price',
      category: 'category',
      isNew: 'is_new',
      hidden: 'hidden',
      description: 'description',
      fabricCare: 'fabric_care',
      deliveryReturns: 'delivery_returns',
    }
    for (const [key, column] of Object.entries(map)) {
      if (patch[key] === undefined) continue
      fields.push(`${column} = ?`)
      values.push(typeof patch[key] === 'boolean' ? (patch[key] ? 1 : 0) : patch[key])
    }
    // İngilizce alanlar: null ya da boş metin temizler (mağaza Türkçeye düşer).
    const mapEn = { nameEn: 'name_en', descriptionEn: 'description_en', fabricCareEn: 'fabric_care_en' }
    for (const [key, column] of Object.entries(mapEn)) {
      if (patch[key] === undefined) continue
      fields.push(`${column} = ?`)
      values.push(enOrNull(patch[key]))
    }
    if (fields.length) {
      await conn.query(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`, [...values, id])
    }

    if (Array.isArray(patch.colors)) {
      // Renkler sil-yeniden-ekle ile yazılır; `labelEn` gönderilmeyen (undefined) renkte önceki EN etiketi
      // korunur, null/boş gönderilirse temizlenir — aksi halde yalnızca TR renk listesini gönderen eski
      // istemciler EN etiketlerini sessizce silerdi.
      const [prevRows] = await conn.query('SELECT color_id, label_en FROM product_colors WHERE product_id = ?', [id])
      const prevEn = new Map(prevRows.map((r) => [r.color_id, r.label_en]))
      await conn.query('DELETE FROM product_colors WHERE product_id = ?', [id])
      let i = 0
      for (const c of patch.colors) {
        const labelEn = c.labelEn === undefined ? (prevEn.get(c.id) ?? null) : enOrNull(c.labelEn)
        await conn.query(
          'INSERT INTO product_colors (product_id, color_id, label, label_en, sort_order) VALUES (?, ?, ?, ?, ?)',
          [id, c.id, c.label, labelEn, i++],
        )
      }
    }

    if (patch.stock && typeof patch.stock === 'object') {
      for (const [colorId, bySize] of Object.entries(patch.stock)) {
        for (const [size, qty] of Object.entries(bySize)) {
          if (!SIZES.includes(size)) continue
          await conn.query(
            'INSERT INTO product_stock (product_id, color_id, size, qty) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE qty = VALUES(qty)',
            [id, colorId, size, Number(qty) || 0],
          )
        }
      }
    }

    if (Array.isArray(patch.similarProductIds)) {
      await conn.query("DELETE FROM product_relations WHERE product_id = ? AND type = 'similar'", [id])
      let i = 0
      for (const relatedId of patch.similarProductIds) {
        await conn.query(
          "INSERT INTO product_relations (product_id, related_id, type, sort_order) VALUES (?, ?, 'similar', ?)",
          [id, relatedId, i++],
        )
      }
    }
    if (Array.isArray(patch.completeLookProductIds)) {
      await conn.query("DELETE FROM product_relations WHERE product_id = ? AND type = 'complete_look'", [id])
      let i = 0
      for (const relatedId of patch.completeLookProductIds) {
        await conn.query(
          "INSERT INTO product_relations (product_id, related_id, type, sort_order) VALUES (?, ?, 'complete_look', ?)",
          [id, relatedId, i++],
        )
      }
    }

    if (patch.media && typeof patch.media === 'object') {
      for (const [kind, url] of Object.entries(patch.media)) {
        if (!MEDIA_KINDS.includes(kind)) continue
        await conn.query(
          'INSERT INTO product_media (product_id, kind, url) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE url = VALUES(url)',
          [id, kind, url],
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

  return getProductById(id)
}

/** Yeni ürün oluşturur; id'yi otomatik `urun-NN` biçiminde üretir. */
export async function createProduct(data) {
  if (!data.category || !CATEGORIES.includes(data.category)) {
    throw badRequest('Geçerli bir kategori seçin', 'validation_error')
  }
  if (typeof data.price !== 'number' || data.price < 0) {
    throw badRequest('Geçerli bir fiyat girin', 'validation_error')
  }

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    const [maxRows] = await conn.query(
      "SELECT MAX(CAST(number AS UNSIGNED)) AS maxNumber FROM products WHERE id REGEXP '^urun-[0-9]+$'",
    )
    const nextN = (maxRows[0]?.maxNumber || 0) + 1
    const number = String(nextN).padStart(2, '0')
    const id = `urun-${number}`
    const slug = id

    const [maxSort] = await conn.query('SELECT MAX(sort_order) AS maxSort FROM products')
    const sortOrder = (maxSort[0]?.maxSort ?? -1) + 1

    await conn.query(
      `INSERT INTO products (id, number, slug, name, name_en, category, is_new, price, description, description_en, fabric_care, fabric_care_en, delivery_returns, hidden, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        number,
        slug,
        data.name?.trim() || `Ürün ${number} — Ürün adı`,
        enOrNull(data.nameEn),
        data.category,
        data.isNew ? 1 : 0,
        data.price,
        data.description ?? null,
        enOrNull(data.descriptionEn),
        data.fabricCare ?? null,
        enOrNull(data.fabricCareEn),
        data.deliveryReturns ?? null,
        data.hidden ? 1 : 0,
        sortOrder,
      ],
    )

    const colors = Array.isArray(data.colors) && data.colors.length ? data.colors : [{ id: 'renk-1', label: 'Renk 1' }]
    let i = 0
    for (const c of colors) {
      await conn.query(
        'INSERT INTO product_colors (product_id, color_id, label, label_en, sort_order) VALUES (?, ?, ?, ?, ?)',
        [id, c.id, c.label, enOrNull(c.labelEn), i++],
      )
      for (const size of SIZES) {
        const qty = data.stock?.[c.id]?.[size]
        await conn.query('INSERT INTO product_stock (product_id, color_id, size, qty) VALUES (?, ?, ?, ?)', [
          id,
          c.id,
          size,
          Number.isFinite(qty) ? qty : 0,
        ])
      }
    }

    await conn.commit()
    return getProductById(id)
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

export async function assertProductsExist(ids) {
  if (ids.length === 0) return
  const placeholders = ids.map(() => '?').join(',')
  const [rows] = await pool.query(`SELECT id FROM products WHERE id IN (${placeholders})`, ids)
  const found = new Set(rows.map((r) => r.id))
  const missing = ids.filter((id) => !found.has(id))
  if (missing.length) throw conflict(`Ürün bulunamadı: ${missing.join(', ')}`)
}
