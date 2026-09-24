/** Sipariş oluşturma, sorgulama ve durum güncelleme — fiyat/stok/toplamlar sunucuda hesaplanır. */
import { pool } from '../db.js'
import { badRequest, conflict, notFound } from '../errors.js'
import { getSetting } from './settings.js'

export const ORDER_STATUSES = ['demo', 'new', 'paid', 'shipped', 'cancelled']

function round2(n) {
  return Math.round(n * 100) / 100
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

    let discountEligible = false
    if (customer) {
      const [customerRows] = await conn.query('SELECT discount_eligible FROM customers WHERE id = ? LIMIT 1', [customer.id])
      discountEligible = !!customerRows[0]?.discount_eligible
    }

    const items = []
    let subtotal = 0

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
      const stockQty = stockRows[0]?.qty ?? 0
      if (stockQty < line.qty) {
        throw conflict(`Yetersiz stok: ${product.name} (${color.label}, ${line.size})`, 'insufficient_stock')
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

    await conn.query(
      `INSERT INTO orders
        (id, customer_id, status, email, phone, first_name, last_name, address, district, city, postal_code, country, note,
         subtotal, discount_percent, discount_amount, shipping, total)
       VALUES (?, ?, 'new', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        throw conflict(`Yetersiz stok: ${item.productName} (${item.colorLabel}, ${item.size})`, 'insufficient_stock')
      }
    }

    await conn.commit()
    return getOrderById(orderId)
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

export async function updateOrderStatus(id, status) {
  if (!ORDER_STATUSES.includes(status)) throw badRequest('Geçersiz sipariş durumu', 'validation_error')
  const [result] = await pool.query('UPDATE orders SET status = ? WHERE id = ?', [status, id])
  if (result.affectedRows === 0) throw notFound('Sipariş bulunamadı')
  return getOrderById(id)
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
