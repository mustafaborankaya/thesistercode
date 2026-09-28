/**
 * Müşteri hesabı verileri: adres defteri (customer_addresses) ve sipariş geçmişi.
 * Tüm sorgular oturumdaki müşterinin id'siyle sınırlanır; başka müşterinin kaydı "bulunamadı"
 * ile ayırt edilemez biçimde (null) döner.
 */
import { pool } from '../db.js'
import { conflict } from '../errors.js'
import { listOrdersByCustomer, ACTIVE_ORDER_STATUSES } from './orders.js'

export const MAX_ADDRESSES = 10
export const MAX_ACCOUNT_ORDERS = 50

const ADDRESS_COLUMNS =
  'id, label, first_name, last_name, phone, address, district, city, postal_code, country, is_default, created_at, updated_at'

function formatAddress(row) {
  return {
    id: row.id,
    label: row.label,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    address: row.address,
    district: row.district,
    city: row.city,
    postalCode: row.postal_code,
    country: row.country,
    isDefault: !!row.is_default,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function addressValues(input) {
  return [
    input.label || null,
    input.firstName,
    input.lastName,
    input.phone,
    input.address,
    input.district,
    input.city,
    input.postalCode,
    input.country,
  ]
}

async function getAddressRow(conn, customerId, id, { lock = false } = {}) {
  const [rows] = await conn.query(
    `SELECT ${ADDRESS_COLUMNS} FROM customer_addresses WHERE id = ? AND customer_id = ? LIMIT 1${lock ? ' FOR UPDATE' : ''}`,
    [id, customerId],
  )
  return rows[0] ?? null
}

/** Transaction yardımcı: fn(conn) başarılıysa commit, aksi halde rollback. */
async function inTransaction(fn) {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const result = await fn(conn)
    await conn.commit()
    return result
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

/** Varsayılan önce, ardından eklenme sırasına göre. */
export async function listAddresses(customerId) {
  const [rows] = await pool.query(
    `SELECT ${ADDRESS_COLUMNS} FROM customer_addresses WHERE customer_id = ? ORDER BY is_default DESC, id ASC`,
    [customerId],
  )
  return rows.map(formatAddress)
}

export async function createAddress(customerId, input) {
  return inTransaction(async (conn) => {
    // Müşteri satırı kilitlenir: aynı müşterinin eşzamanlı eklemeleri sıraya girer (10 adres sınırı
    // yarış koşuluyla aşılamaz). Müşteri silinmişse satır yoktur → FK hatası yerine sayım 0'dan devam
    // eder ve INSERT FK ile reddedilir.
    await conn.query('SELECT id FROM customers WHERE id = ? FOR UPDATE', [customerId])
    const [[{ n }]] = await conn.query('SELECT COUNT(*) AS n FROM customer_addresses WHERE customer_id = ?', [customerId])
    if (Number(n) >= MAX_ADDRESSES) {
      throw conflict(`En fazla ${MAX_ADDRESSES} adres kaydedebilirsiniz.`, 'address_limit')
    }
    const makeDefault = Number(n) === 0 || input.isDefault === true
    if (makeDefault) {
      await conn.query('UPDATE customer_addresses SET is_default = 0 WHERE customer_id = ?', [customerId])
    }
    const [result] = await conn.query(
      `INSERT INTO customer_addresses
        (customer_id, label, first_name, last_name, phone, address, district, city, postal_code, country, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [customerId, ...addressValues(input), makeDefault ? 1 : 0],
    )
    return formatAddress(await getAddressRow(conn, customerId, result.insertId))
  })
}

/** Sahibi değilse / yoksa null. `isDefault: true` verilirse varsayılan yapılır; false yok sayılır (varsayılan kaldırılamaz, başkası seçilir). */
export async function updateAddress(customerId, id, input) {
  return inTransaction(async (conn) => {
    const existing = await getAddressRow(conn, customerId, id, { lock: true })
    if (!existing) return null
    await conn.query(
      `UPDATE customer_addresses
          SET label = ?, first_name = ?, last_name = ?, phone = ?, address = ?, district = ?, city = ?, postal_code = ?, country = ?
        WHERE id = ? AND customer_id = ?`,
      [...addressValues(input), id, customerId],
    )
    if (input.isDefault === true && !existing.is_default) {
      await conn.query('UPDATE customer_addresses SET is_default = (id = ?) WHERE customer_id = ?', [id, customerId])
    }
    return formatAddress(await getAddressRow(conn, customerId, id))
  })
}

/** Sahibi değilse / yoksa false. Varsayılan silinirse en eski kalan adres varsayılan olur. */
export async function deleteAddress(customerId, id) {
  return inTransaction(async (conn) => {
    const existing = await getAddressRow(conn, customerId, id, { lock: true })
    if (!existing) return false
    await conn.query('DELETE FROM customer_addresses WHERE id = ? AND customer_id = ?', [id, customerId])
    if (existing.is_default) {
      await conn.query(
        'UPDATE customer_addresses SET is_default = 1 WHERE customer_id = ? ORDER BY id ASC LIMIT 1',
        [customerId],
      )
    }
    return true
  })
}

/** Önce hedef doğrulanır/kilitlenir, SONRA diğerleri sıfırlanır — yabancı id ile sahibinin varsayılanı silinemez. */
export async function setDefaultAddress(customerId, id) {
  return inTransaction(async (conn) => {
    const existing = await getAddressRow(conn, customerId, id, { lock: true })
    if (!existing) return null
    await conn.query('UPDATE customer_addresses SET is_default = (id = ?) WHERE customer_id = ?', [id, customerId])
    return formatAddress(await getAddressRow(conn, customerId, id))
  })
}

/**
 * Oturumdaki müşterinin siparişleri (yeniden eskiye, en fazla 50), `formatOrder` biçiminde (items dahil).
 * formatOrder services/orders.js'te dışa aktarılmadığı için biçim tutarlılığı adına her sipariş
 * services/orders.js → listOrdersByCustomer (iki sorgu) ile okunur.
 */
export async function listOrdersForCustomer(customerId) {
  return listOrdersByCustomer(customerId, MAX_ACCOUNT_ORDERS)
}

/* ---------------- Yönetici: müşteriler ---------------- */

/** Ciro sayılan durumlar: paid + shipped; `includeNew` (ödeme sağlayıcısı yokken) 'new' de. */
export function revenueStatuses(includeNew) {
  return includeNew ? ['new', 'paid', 'shipped'] : ['paid', 'shipped']
}

const FIRST_ORDER_USED_SQL = `EXISTS (SELECT 1 FROM orders o2 WHERE o2.customer_id = c.id
  AND o2.status IN (${ACTIVE_ORDER_STATUSES.map((s) => `'${s}'`).join(', ')})
  AND NOT (o2.coupon_code IS NOT NULL AND o2.discount_amount = 0))`

function formatAdminCustomer(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    createdAt: row.created_at,
    ordersCount: Number(row.orders_count ?? 0),
    totalSpent: Number(row.total_spent ?? 0),
    // Yöneticinin açıp kapattığı bayrak (customers.discount_eligible); fiili hak = bayrak && !discountUsed.
    discountEligible: !!row.discount_eligible,
    discountUsed: !!row.discount_used,
    lastOrderAt: row.last_order_at ?? null,
  }
}

function customerSelect(includeNew) {
  const rs = revenueStatuses(includeNew)
    .map((s) => `'${s}'`)
    .join(', ')
  // Parola hash'i SEÇİLMEZ. ordersCount: demo hariç tüm siparişler (iptaller dahil).
  return `SELECT c.id, c.name, c.email, c.created_at, c.discount_eligible,
      (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id AND o.status <> 'demo') AS orders_count,
      (SELECT COALESCE(SUM(o.total), 0) FROM orders o WHERE o.customer_id = c.id AND o.status IN (${rs})) AS total_spent,
      (SELECT MAX(o.created_at) FROM orders o WHERE o.customer_id = c.id AND o.status <> 'demo') AS last_order_at,
      ${FIRST_ORDER_USED_SQL} AS discount_used
    FROM customers c`
}

export async function adminListCustomers({ q, page, pageSize, includeNew = false } = {}) {
  const params = []
  let where = ''
  if (q && String(q).trim()) {
    const term = `%${String(q).trim().replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`
    where = ' WHERE (c.name LIKE ? OR c.email LIKE ?)'
    params.push(term, term)
  }
  const [[{ n }]] = await pool.query(`SELECT COUNT(*) AS n FROM customers c${where}`, params)
  const size = Math.min(200, Math.max(1, Number.parseInt(pageSize, 10) || 50))
  const pageNo = Math.max(1, Number.parseInt(page, 10) || 1)
  const [rows] = await pool.query(`${customerSelect(includeNew)}${where} ORDER BY c.created_at DESC, c.id DESC LIMIT ? OFFSET ?`, [
    ...params,
    size,
    (pageNo - 1) * size,
  ])
  return { customers: rows.map(formatAdminCustomer), total: Number(n), page: pageNo, pageSize: size }
}

export async function adminGetCustomer(id, { includeNew = false } = {}) {
  const [rows] = await pool.query(`${customerSelect(includeNew)} WHERE c.id = ? LIMIT 1`, [id])
  if (!rows[0]) return null
  const [orders, addresses] = await Promise.all([listOrdersByCustomer(id, 200, { includeAdminNote: true }), listAddresses(id)])
  return { customer: formatAdminCustomer(rows[0]), orders, addresses }
}

export async function adminSetDiscountEligible(id, discountEligible, { includeNew = false } = {}) {
  const [result] = await pool.query('UPDATE customers SET discount_eligible = ? WHERE id = ?', [discountEligible ? 1 : 0, id])
  if (!result.affectedRows) return null
  const [rows] = await pool.query(`${customerSelect(includeNew)} WHERE c.id = ? LIMIT 1`, [id])
  return formatAdminCustomer(rows[0])
}
