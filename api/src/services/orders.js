/** Sipariş oluşturma, sorgulama ve durum güncelleme — fiyat/stok/toplamlar sunucuda hesaplanır. */
import crypto from 'node:crypto'
import { pool } from '../db.js'
import { badRequest, conflict, notFound } from '../errors.js'
import { getSetting } from './settings.js'

export const ORDER_STATUSES = ['demo', 'new', 'paid', 'shipped', 'cancelled']

/**
 * "Aktif" sipariş durumları: üyelik indiriminin İLK SİPARİŞ kuralında sayılan siparişler.
 * İptal edilen ('cancelled') ve 'demo' siparişler sayılmaz — ilk sipariş iptal edilirse hak geri gelir.
 * Yeni bir durum eklenirse (ör. ödeme bekleyen) burada da değerlendirilmelidir.
 */
export const ACTIVE_ORDER_STATUSES = ['new', 'paid', 'shipped']
const ACTIVE_STATUS_SQL = ACTIVE_ORDER_STATUSES.map((s) => `'${s}'`).join(', ')

/** Üyelik indirimi yalnızca ilk siparişte mi? Alan yoksa/tanımsızsa varsayılan `true` (kesin kural). */
export function isFirstOrderOnly(memberDiscount) {
  return memberDiscount?.firstOrderOnly !== false
}

/** Müşterinin aktif (iptal edilmemiş) siparişi var mı? `db` bir transaction bağlantısı veya havuz olabilir. */
export async function customerHasActiveOrder(db, customerId) {
  const [rows] = await db.query(`SELECT id FROM orders WHERE customer_id = ? AND status IN (${ACTIVE_STATUS_SQL}) LIMIT 1`, [customerId])
  return !!rows[0]
}

function round2(n) {
  return Math.round(n * 100) / 100
}

/**
 * Sipariş erişim token'ı: sipariş oluşturulurken üretilir, yalnızca yanıt gövdesinde BİR KEZ
 * döner (raw), DB'de asla düz metin saklanmaz — yalnızca SHA-256 hash'i (`access_token_hash`)
 * saklanır. `GET /orders/:id` bu token (query `?token=` veya `Authorization: Bearer`) veya
 * siparişi oluşturan müşterinin oturumu ile doğrulanmadan sipariş bilgisini döndürmez.
 */
function generateAccessToken() {
  const raw = crypto.randomBytes(32).toString('hex') // 256 bit rastgelelik, 64 hex karakter
  return { raw, hash: hashAccessToken(raw) }
}

function hashAccessToken(raw) {
  return crypto.createHash('sha256').update(String(raw)).digest('hex')
}

/** Zamanlama saldırılarına karşı sabit süreli hex karşılaştırma. */
function safeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'))
  } catch {
    return false
  }
}

function istanbulDateStamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const get = (t) => parts.find((p) => p.type === t).value
  return `${get('year')}${get('month')}${get('day')}`
}

function randomOrderId() {
  const rand = String(Math.floor(Math.random() * 10000)).padStart(4, '0')
  return `TSV-${istanbulDateStamp()}-${rand}`
}

/** Aynı ürün/renk/beden satırlarını birleştirir, ardından kilitleme sırasını sabitler (deadlock önleme). */
function normalizeLines(lines) {
  const merged = new Map()
  for (const line of lines) {
    const key = `${line.productId}:${line.colorId}:${line.size}`
    const existing = merged.get(key)
    if (existing) existing.qty += line.qty
    else merged.set(key, { ...line })
  }
  return [...merged.values()].sort((a, b) => (a.productId + a.colorId + a.size).localeCompare(b.productId + b.colorId + b.size))
}

export async function createOrder(input, customer) {
  const lines = normalizeLines(input.lines)

  const memberDiscount = (await getSetting('memberDiscount')) ?? {}
  const shippingAmount = await getSetting('shipping.amount')

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    // Üyelik indirimi hakkı: bayrak (discount_eligible) + "yalnızca ilk sipariş" kuralı. Müşteri satırı
    // `FOR UPDATE` ile transaction sonuna kadar kilitlenir; aynı müşterinin eşzamanlı iki siparişi sıraya
    // girer ve ikincisi, ilkinin commit'inden SONRA onun aktif siparişini görür (ikisi birden indirim alamaz).
    // Kilit sırası her zaman: önce müşteri, sonra ürün/stok satırları.
    let discountEligible = false
    if (customer) {
      const [customerRows] = await conn.query('SELECT discount_eligible FROM customers WHERE id = ? LIMIT 1 FOR UPDATE', [customer.id])
      discountEligible = !!customerRows[0]?.discount_eligible
      if (discountEligible && isFirstOrderOnly(memberDiscount) && (await customerHasActiveOrder(conn, customer.id))) {
        discountEligible = false
      }
    }

    const items = []
    let subtotal = 0
    /** Yetersiz stoklu TÜM varyantlar toplanır; kontrol bitince tek bir 409 ile döner (istemci sepeti tek seferde düzeltir). */
    const shortages = []

    // Satırlar normalizeLines ile birleştirilmiş (aynı varyant → tek satır, qty toplamı) ve sabit sırada
    // kilitlenir: product_stock satırı `FOR UPDATE` ile transaction sonuna kadar kilitli kalır, böylece
    // eşzamanlı iki sipariş aynı stoğu ikisi birden okuyup düşemez (ikincisi ilkinin commit'ini bekler).
    for (const line of lines) {
      const [productRows] = await conn.query('SELECT id, name, price, hidden FROM products WHERE id = ? FOR UPDATE', [
        line.productId,
      ])
      const product = productRows[0]
      if (!product || product.hidden) throw badRequest(`Ürün bulunamadı: ${line.productId}`, 'invalid_product')

      const [colorRows] = await conn.query(
        'SELECT color_id, label FROM product_colors WHERE product_id = ? AND color_id = ? LIMIT 1',
        [line.productId, line.colorId],
      )
      const color = colorRows[0]
      if (!color) throw badRequest(`Geçersiz renk seçimi: ${line.productId}/${line.colorId}`, 'invalid_variant')

      const [stockRows] = await conn.query(
        'SELECT qty FROM product_stock WHERE product_id = ? AND color_id = ? AND size = ? FOR UPDATE',
        [line.productId, line.colorId, line.size],
      )
      const stockQty = Math.max(0, stockRows[0]?.qty ?? 0)
      if (stockQty < line.qty) {
        shortages.push({
          productId: line.productId,
          colorId: line.colorId,
          size: line.size,
          requested: line.qty,
          available: stockQty,
          label: `${product.name} (${color.label}, ${line.size})`,
        })
        continue
      }

      const unitPrice = Number(product.price)
      subtotal += unitPrice * line.qty
      items.push({
        productId: line.productId,
        productName: product.name,
        colorId: line.colorId,
        colorLabel: color.label,
        size: line.size,
        qty: line.qty,
        unitPrice,
      })
    }

    if (shortages.length) {
      const message = `Yetersiz stok: ${shortages.map((s) => `${s.label} — kalan ${s.available}`).join('; ')}`
      throw conflict(
        message,
        'insufficient_stock',
        shortages.map((s) => ({ productId: s.productId, colorId: s.colorId, size: s.size, requested: s.requested, available: s.available })),
      )
    }

    let discountPercent = 0
    if (
      memberDiscount.enabled &&
      discountEligible &&
      memberDiscount.mode === 'automatic' &&
      (memberDiscount.minSubtotal == null || subtotal >= memberDiscount.minSubtotal) &&
      (memberDiscount.expiresAt == null || Date.now() < Date.parse(memberDiscount.expiresAt))
    ) {
      discountPercent = memberDiscount.percent ?? 0
    }
    const discountAmount = round2((subtotal * discountPercent) / 100)
    const shipping = typeof shippingAmount === 'number' ? shippingAmount : null
    const total = round2(subtotal - discountAmount + (shipping ?? 0))

    let orderId = null
    for (let attempt = 0; attempt < 5 && !orderId; attempt++) {
      const candidate = randomOrderId()
      const [existing] = await conn.query('SELECT id FROM orders WHERE id = ? LIMIT 1', [candidate])
      if (!existing[0]) orderId = candidate
    }
    if (!orderId) throw new Error('Sipariş numarası üretilemedi')

    const { raw: accessToken, hash: accessTokenHash } = generateAccessToken()

    await conn.query(
      `INSERT INTO orders
        (id, customer_id, status, email, phone, first_name, last_name, address, district, city, postal_code, country, note,
         subtotal, discount_percent, discount_amount, shipping, total, access_token_hash)
       VALUES (?, ?, 'new', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderId,
        customer?.id ?? null,
        input.contact.email,
        input.contact.phone,
        input.delivery.firstName,
        input.delivery.lastName,
        input.delivery.address,
        input.delivery.district,
        input.delivery.city,
        input.delivery.postalCode,
        input.delivery.country,
        input.delivery.note || null,
        subtotal,
        discountPercent,
        discountAmount,
        shipping,
        total,
        accessTokenHash,
      ],
    )

    for (const item of items) {
      await conn.query(
        `INSERT INTO order_items (order_id, product_id, product_name, color_id, color_label, size, qty, unit_price)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [orderId, item.productId, item.productName, item.colorId, item.colorLabel, item.size, item.qty, item.unitPrice],
      )

      const [result] = await conn.query(
        'UPDATE product_stock SET qty = qty - ? WHERE product_id = ? AND color_id = ? AND size = ? AND qty >= ?',
        [item.qty, item.productId, item.colorId, item.size, item.qty],
      )
      if (result.affectedRows !== 1) {
        // Savunma derinliği: satır kilitli olduğundan buraya normalde düşülmez.
        const [again] = await conn.query('SELECT qty FROM product_stock WHERE product_id = ? AND color_id = ? AND size = ?', [
          item.productId,
          item.colorId,
          item.size,
        ])
        throw conflict(`Yetersiz stok: ${item.productName} (${item.colorLabel}, ${item.size})`, 'insufficient_stock', [
          { productId: item.productId, colorId: item.colorId, size: item.size, requested: item.qty, available: Math.max(0, again[0]?.qty ?? 0) },
        ])
      }
    }

    await conn.commit()
    const order = await getOrderById(orderId)
    // accessToken yalnızca burada, oluşturma anında düz metin olarak döner; DB'de yalnızca hash'i
    // saklanır ve bir daha asla API yanıtında görünmez (kaybedilirse yeniden üretilemez).
    return { order, accessToken }
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

export async function getOrderById(id) {
  const [orderRows] = await pool.query('SELECT * FROM orders WHERE id = ? LIMIT 1', [id])
  const order = orderRows[0]
  if (!order) return null
  const [itemRows] = await pool.query(
    'SELECT product_id, product_name, color_id, color_label, size, qty, unit_price FROM order_items WHERE order_id = ? ORDER BY id ASC',
    [id],
  )
  return formatOrder(order, itemRows)
}

/**
 * Genel (kimlik doğrulamasız/token'sız) `GET /orders/:id` için TEK giriş noktası. Siparişi yalnızca
 * (a) siparişi oluşturan müşterinin oturumu (customerId eşleşmesi) veya (b) sipariş oluşturulurken
 * üretilen tek seferlik erişim token'ı (accessToken) doğrulanırsa döndürür. Yetkisiz/bulunamayan
 * durumlar arasında AYIRT EDİCİ olmayan (her ikisinde de null) bir sonuç döner — böylece yanıt,
 * sipariş kimliğinin var olup olmadığını sızdırmaz (ID enumeration bilgi sızıntısını önler).
 */
export async function getOrderByIdForAccess(id, { customerId, token } = {}) {
  const [orderRows] = await pool.query('SELECT * FROM orders WHERE id = ? LIMIT 1', [id])
  const row = orderRows[0]
  if (!row) return null

  const ownerMatch = customerId != null && row.customer_id === customerId
  const tokenMatch =
    !ownerMatch &&
    typeof token === 'string' &&
    token.length > 0 &&
    token.length <= 128 &&
    row.access_token_hash &&
    safeEqualHex(hashAccessToken(token), row.access_token_hash)

  if (!ownerMatch && !tokenMatch) return null

  const [itemRows] = await pool.query(
    'SELECT product_id, product_name, color_id, color_label, size, qty, unit_price FROM order_items WHERE order_id = ? ORDER BY id ASC',
    [id],
  )
  return formatOrder(row, itemRows)
}

export async function listOrders({ status } = {}) {
  const params = []
  let where = ''
  if (status) {
    if (!ORDER_STATUSES.includes(status)) throw badRequest('Geçersiz sipariş durumu', 'validation_error')
    where = ' WHERE status = ?'
    params.push(status)
  }
  const [rows] = await pool.query(`SELECT * FROM orders${where} ORDER BY created_at DESC`, params)
  return rows.map((r) => formatOrder(r, null))
}

/**
 * Sipariş durumunu günceller. Bir sipariş 'cancelled' durumuna geçerken (ve daha önce zaten iptal
 * edilmemişse) satırdaki ürünler için düşülen stok, aynı transaction içinde geri yüklenir — aksi
 * halde iptal edilen siparişlerin stoğu kalıcı olarak "kilitli" kalır. Bilinen sınır: bir siparişin
 * iptali GERİ ALINIRSA (cancelled → new/paid/…) stok tekrar OTOMATİK düşülmez; bu, mevcut spesifikasyon
 * kapsamının dışındadır ve operatörün stoğu manuel doğrulaması gerekir.
 */
export async function updateOrderStatus(id, status) {
  if (!ORDER_STATUSES.includes(status)) throw badRequest('Geçersiz sipariş durumu', 'validation_error')

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    const [rows] = await conn.query('SELECT status FROM orders WHERE id = ? LIMIT 1 FOR UPDATE', [id])
    const current = rows[0]
    if (!current) throw notFound('Sipariş bulunamadı')

    const becomingCancelled = status === 'cancelled' && current.status !== 'cancelled'

    await conn.query('UPDATE orders SET status = ? WHERE id = ?', [status, id])

    if (becomingCancelled) {
      const [items] = await conn.query('SELECT product_id, color_id, size, qty FROM order_items WHERE order_id = ?', [id])
      for (const item of items) {
        await conn.query(
          `INSERT INTO product_stock (product_id, color_id, size, qty) VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE qty = qty + VALUES(qty)`,
          [item.product_id, item.color_id, item.size, item.qty],
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

  return getOrderById(id)
}

/** Müşterinin siparişleri (yeniden eskiye), kalemleriyle; sipariş sayısından bağımsız iki sorgu. */
export async function listOrdersByCustomer(customerId, limit = 50) {
  const [orderRows] = await pool.query('SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC, id DESC LIMIT ?', [customerId, limit])
  if (!orderRows.length) return []
  const ids = orderRows.map((r) => r.id)
  const [itemRows] = await pool.query(
    `SELECT order_id, product_id, product_name, color_id, color_label, size, qty, unit_price FROM order_items WHERE order_id IN (${ids.map(() => '?').join(',')}) ORDER BY id ASC`,
    ids,
  )
  const byOrder = new Map()
  for (const item of itemRows) {
    if (!byOrder.has(item.order_id)) byOrder.set(item.order_id, [])
    byOrder.get(item.order_id).push(item)
  }
  return orderRows.map((row) => formatOrder(row, byOrder.get(row.id) ?? []))
}

function formatOrder(row, itemRows) {
  return {
    id: row.id,
    customerId: row.customer_id,
    status: row.status,
    contact: { email: row.email, phone: row.phone },
    delivery: {
      firstName: row.first_name,
      lastName: row.last_name,
      address: row.address,
      district: row.district,
      city: row.city,
      postalCode: row.postal_code,
      country: row.country,
      note: row.note,
    },
    totals: {
      subtotal: Number(row.subtotal),
      discountPercent: row.discount_percent,
      discountAmount: Number(row.discount_amount),
      shipping: row.shipping === null ? null : Number(row.shipping),
      total: Number(row.total),
    },
    items: itemRows
      ? itemRows.map((i) => ({
          productId: i.product_id,
          productName: i.product_name,
          colorId: i.color_id,
          colorLabel: i.color_label,
          size: i.size,
          qty: i.qty,
          unitPrice: Number(i.unit_price),
        }))
      : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
