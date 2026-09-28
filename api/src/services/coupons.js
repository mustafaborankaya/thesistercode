/**
 * İndirim kuponları — doğrulama, indirim hesabı, kullanım kaydı ve yönetici CRUD.
 *
 * Tüm para hesapları kuruş cinsinden tam sayıyla yapılır (iyzico paidPrice ile birebir tutarlılık).
 * Tarihler (starts_at/expires_at) DB'de UTC 'YYYY-MM-DD HH:MM:SS' olarak saklanır; API ISO 8601 ('Z') konuşur.
 *
 * Kilit sırası (createOrder): müşteri → ürün/stok → kupon. İptal (setOrderStatusInTx): sipariş → stok → kupon.
 */
import { pool } from '../db.js'
import { ApiError, badRequest } from '../errors.js'

export const COUPON_TYPES = ['percent', 'fixed']
export const COUPON_CODE_RE = /^[A-Z0-9_-]{4,40}$/

export function normalizeCode(code) {
  return String(code ?? '')
    .trim()
    .toLocaleUpperCase('en-US')
}

export function toKurus(value) {
  return Math.round(Number(value) * 100)
}

/** ISO/Date → UTC DATETIME metni (ya da null). */
export function toDbDate(value) {
  if (value == null || value === '') return null
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) throw badRequest('Geçersiz tarih', 'validation_error')
  return d.toISOString().slice(0, 19).replace('T', ' ')
}

/** UTC DATETIME metni → ISO 'Z' (ya da null). */
export function fromDbDate(value) {
  if (value == null) return null
  const s = String(value)
  const d = new Date(s.includes('T') ? s : `${s.replace(' ', 'T')}Z`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/** İndirim tutarı (TL, kuruş yuvarlamalı). percent: ara toplam × değer / 100; fixed: min(değer, ara toplam). */
export function couponDiscountAmount(coupon, subtotal) {
  const subKurus = Math.max(0, toKurus(subtotal))
  const value = Number(coupon.value)
  let kurus = coupon.type === 'percent' ? Math.round((subKurus * value) / 100) : Math.min(toKurus(value), subKurus)
  kurus = Math.max(0, Math.min(kurus, subKurus))
  return kurus / 100
}

export function formatCoupon(row) {
  return {
    id: row.id,
    code: row.code,
    type: row.type,
    value: Number(row.value),
    minSubtotal: row.min_subtotal == null ? null : Number(row.min_subtotal),
    usageLimit: row.usage_limit,
    perCustomerLimit: row.per_customer_limit,
    startsAt: fromDbDate(row.starts_at),
    expiresAt: fromDbDate(row.expires_at),
    active: !!row.active,
    usedCount: row.used_count,
    createdAt: row.created_at,
  }
}

/** Kupon hata kodları → HTTP durumu ve Türkçe mesaj. Limit aşımı 409, diğerleri 400. */
const REASONS = {
  coupon_not_found: [400, 'İndirim kodu geçersiz.'],
  coupon_inactive: [400, 'Bu indirim kodu artık geçerli değil.'],
  coupon_not_started: [400, 'Bu indirim kodu henüz geçerli değil.'],
  coupon_expired: [400, 'Bu indirim kodunun süresi dolmuş.'],
  coupon_min_subtotal: [400, 'Sepet tutarı bu indirim kodu için yetersiz.'],
  coupon_usage_limit: [409, 'Bu indirim kodunun kullanım sınırı doldu.'],
  coupon_customer_limit: [409, 'Bu indirim kodunu kullanım hakkınız doldu.'],
}

export function couponError(reason, extra) {
  const [status, message] = REASONS[reason] ?? REASONS.coupon_not_found
  return new ApiError(status, reason, extra ? `${message} ${extra}` : message)
}

function reasonMessage(reason, row) {
  if (reason === 'coupon_min_subtotal' && row?.min_subtotal != null) {
    return `${REASONS[reason][1]} (en az ${Number(row.min_subtotal).toFixed(2)} TL)`
  }
  return (REASONS[reason] ?? REASONS.coupon_not_found)[1]
}

/**
 * Satır üzerinde kural denetimi. `db` kilitli transaction bağlantısı ya da havuz olabilir.
 * Döner: { ok:true, discountAmount } | { ok:false, reason }.
 */
async function checkRow(db, row, { subtotal, customerId, email, now = Date.now(), lock = false }) {
  if (!row) return { ok: false, reason: 'coupon_not_found' }
  if (!row.active) return { ok: false, reason: 'coupon_inactive' }
  const startsAt = fromDbDate(row.starts_at)
  const expiresAt = fromDbDate(row.expires_at)
  if (startsAt && now < Date.parse(startsAt)) return { ok: false, reason: 'coupon_not_started' }
  if (expiresAt && now >= Date.parse(expiresAt)) return { ok: false, reason: 'coupon_expired' }
  if (row.min_subtotal != null && toKurus(subtotal) < toKurus(row.min_subtotal)) return { ok: false, reason: 'coupon_min_subtotal' }
  if (row.usage_limit != null && row.used_count >= row.usage_limit) return { ok: false, reason: 'coupon_usage_limit' }
  if (row.per_customer_limit != null && (customerId != null || email)) {
    const conds = []
    const params = [row.id]
    if (customerId != null) {
      conds.push('customer_id = ?')
      params.push(customerId)
    }
    if (email) {
      conds.push('email = ?')
      params.push(String(email).trim().toLowerCase())
    }
    // lock: transaction içinde güncel (kilitli) okuma — REPEATABLE READ'in eski görüntüsü eşzamanlı kullanımı kaçırmasın.
    const [[{ n }]] = await db.query(
      `SELECT COUNT(*) AS n FROM coupon_redemptions WHERE coupon_id = ? AND (${conds.join(' OR ')})${lock ? ' FOR UPDATE' : ''}`,
      params,
    )
    if (Number(n) >= row.per_customer_limit) return { ok: false, reason: 'coupon_customer_limit' }
  }
  return { ok: true, discountAmount: couponDiscountAmount(row, subtotal) }
}

/**
 * Kupon doğrulama (salt okunur; herkese açık `POST /coupons/validate` ve testler).
 * @returns {Promise<{valid:boolean, code:string, type?:string, value?:number, minSubtotal?:number|null, discountAmount:number, reason?:string, message?:string}>}
 */
export async function validateCoupon({ code, subtotal, customerId = null, email = null }) {
  const normalized = normalizeCode(code)
  if (!COUPON_CODE_RE.test(normalized)) {
    return { valid: false, code: normalized, discountAmount: 0, reason: 'coupon_not_found', message: reasonMessage('coupon_not_found') }
  }
  const [rows] = await pool.query('SELECT * FROM coupons WHERE code = ? LIMIT 1', [normalized])
  const row = rows[0]
  const result = await checkRow(pool, row, { subtotal, customerId, email })
  if (!result.ok) {
    const out = { valid: false, code: normalized, discountAmount: 0, reason: result.reason, message: reasonMessage(result.reason, row) }
    // Var olmayan kodun ayrıntısı (tür/değer) sızdırılmaz.
    if (row && result.reason === 'coupon_min_subtotal') out.minSubtotal = Number(row.min_subtotal)
    return out
  }
  return {
    valid: true,
    code: row.code,
    type: row.type,
    value: Number(row.value),
    minSubtotal: row.min_subtotal == null ? null : Number(row.min_subtotal),
    discountAmount: result.discountAmount,
  }
}

/**
 * createOrder içinde: kuponu `FOR UPDATE` ile kilitler ve doğrular; geçersizse ApiError fırlatır.
 * Kullanım KAYDI ayrıdır (redeemCouponInTx) — üye indirimi daha yüksekse kupon uygulanmaz ve kaydedilmez.
 */
export async function lockAndCheckCouponInTx(conn, { code, subtotal, customerId, email }) {
  const normalized = normalizeCode(code)
  if (!COUPON_CODE_RE.test(normalized)) throw couponError('coupon_not_found')
  const [rows] = await conn.query('SELECT * FROM coupons WHERE code = ? LIMIT 1 FOR UPDATE', [normalized])
  const row = rows[0]
  const result = await checkRow(conn, row, { subtotal, customerId, email, lock: true })
  if (!result.ok) throw new ApiError(REASONS[result.reason][0], result.reason, reasonMessage(result.reason, row))
  return { coupon: row, discountAmount: result.discountAmount }
}

export async function redeemCouponInTx(conn, { couponId, orderId, customerId, email }) {
  await conn.query('UPDATE coupons SET used_count = used_count + 1 WHERE id = ?', [couponId])
  await conn.query('INSERT INTO coupon_redemptions (coupon_id, order_id, customer_id, email) VALUES (?, ?, ?, ?)', [
    couponId,
    orderId,
    customerId ?? null,
    String(email).trim().toLowerCase(),
  ])
}

/** Sipariş iptalinde: kullanım kaydını siler ve sayacı (silinen satır kadar) geri alır. İdempotent. */
export async function releaseCouponForOrderInTx(conn, orderId) {
  // Kilit sırası createOrder ile aynı: önce kupon satırı, sonra kullanım kaydı (tersi kilitlenme yaratırdı).
  const [plain] = await conn.query('SELECT DISTINCT coupon_id FROM coupon_redemptions WHERE order_id = ?', [orderId])
  if (!plain.length) return
  await conn.query(`SELECT id FROM coupons WHERE id IN (${plain.map(() => '?').join(', ')}) ORDER BY id FOR UPDATE`, plain.map((r) => r.coupon_id))
  const [rows] = await conn.query('SELECT id, coupon_id FROM coupon_redemptions WHERE order_id = ? FOR UPDATE', [orderId])
  for (const r of rows) {
    const [del] = await conn.query('DELETE FROM coupon_redemptions WHERE id = ?', [r.id])
    if (del.affectedRows) {
      await conn.query('UPDATE coupons SET used_count = GREATEST(used_count - ?, 0) WHERE id = ?', [del.affectedRows, r.coupon_id])
    }
  }
}

/**
 * İptal edilmiş bir sipariş yeniden canlanınca (geç ödeme / yöneticinin iptali geri alması) kupon kullanımı
 * yeniden kaydedilir. Limitler DENETLENMEZ (ödeme alınmış/yönetici kararı); kupon silinmişse atlanır. İdempotent.
 */
export async function reapplyCouponForOrderInTx(conn, orderId) {
  const [orows] = await conn.query('SELECT coupon_code, coupon_discount, customer_id, email FROM orders WHERE id = ?', [orderId])
  const o = orows[0]
  if (!o?.coupon_code || !(Number(o.coupon_discount) > 0)) return
  const [existing] = await conn.query('SELECT id FROM coupon_redemptions WHERE order_id = ? LIMIT 1', [orderId])
  if (existing[0]) return
  const [crows] = await conn.query('SELECT id FROM coupons WHERE code = ? LIMIT 1 FOR UPDATE', [o.coupon_code])
  if (!crows[0]) return
  await redeemCouponInTx(conn, { couponId: crows[0].id, orderId, customerId: o.customer_id, email: o.email })
}

/* ---------------- Yönetici CRUD ---------------- */

export async function listCoupons() {
  const [rows] = await pool.query('SELECT * FROM coupons ORDER BY created_at DESC, id DESC')
  return rows.map(formatCoupon)
}

export async function getCoupon(id) {
  const [rows] = await pool.query('SELECT * FROM coupons WHERE id = ? LIMIT 1', [id])
  return rows[0] ? formatCoupon(rows[0]) : null
}

function assertCouponShape({ code, type, value, startsAt, expiresAt }) {
  if (code !== undefined && !COUPON_CODE_RE.test(code)) {
    throw badRequest('Kod 4–40 karakter olmalı; yalnızca harf (A–Z), rakam, - ve _ içerebilir', 'validation_error')
  }
  if (type === 'percent' && value !== undefined && !(value > 0 && value <= 100)) throw badRequest('Yüzde değeri 0–100 arasında olmalı', 'validation_error')
  if (type === 'fixed' && value !== undefined && !(value > 0)) throw badRequest('Tutar 0’dan büyük olmalı', 'validation_error')
  if (startsAt && expiresAt && Date.parse(startsAt) >= Date.parse(expiresAt)) {
    throw badRequest('Bitiş tarihi başlangıçtan sonra olmalı', 'validation_error')
  }
}

const COLUMN_MAP = {
  code: 'code',
  type: 'type',
  value: 'value',
  minSubtotal: 'min_subtotal',
  usageLimit: 'usage_limit',
  perCustomerLimit: 'per_customer_limit',
  startsAt: 'starts_at',
  expiresAt: 'expires_at',
  active: 'active',
}

function columnValue(key, v) {
  if (key === 'startsAt' || key === 'expiresAt') return toDbDate(v)
  if (key === 'active') return v ? 1 : 0
  return v
}

export async function createCoupon(data) {
  const input = { ...data, code: normalizeCode(data.code) }
  assertCouponShape(input)
  const cols = []
  const vals = []
  for (const [key, col] of Object.entries(COLUMN_MAP)) {
    if (input[key] === undefined) continue
    cols.push(col)
    vals.push(columnValue(key, input[key]))
  }
  const [result] = await pool.query(`INSERT INTO coupons (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, vals)
  return getCoupon(result.insertId)
}

export async function updateCoupon(id, patch) {
  const [rows] = await pool.query('SELECT * FROM coupons WHERE id = ? LIMIT 1', [id])
  const current = rows[0]
  if (!current) return null
  const input = { ...patch }
  if (input.code !== undefined) input.code = normalizeCode(input.code)
  const merged = {
    code: input.code,
    type: input.type ?? current.type,
    value: input.value ?? Number(current.value),
    startsAt: input.startsAt === undefined ? fromDbDate(current.starts_at) : input.startsAt,
    expiresAt: input.expiresAt === undefined ? fromDbDate(current.expires_at) : input.expiresAt,
  }
  assertCouponShape(merged)
  const sets = []
  const vals = []
  for (const [key, col] of Object.entries(COLUMN_MAP)) {
    if (input[key] === undefined) continue
    sets.push(`${col} = ?`)
    vals.push(columnValue(key, input[key]))
  }
  if (sets.length) await pool.query(`UPDATE coupons SET ${sets.join(', ')} WHERE id = ?`, [...vals, id])
  return getCoupon(id)
}

/** Kullanılmış (sayaç > 0, kullanım kaydı ya da siparişte kodu geçen) kupon silinmez, pasifleştirilir. */
export async function deleteCoupon(id) {
  const [rows] = await pool.query('SELECT id, code, used_count FROM coupons WHERE id = ? LIMIT 1', [id])
  const row = rows[0]
  if (!row) return null
  const [[{ r }]] = await pool.query('SELECT COUNT(*) AS r FROM coupon_redemptions WHERE coupon_id = ?', [id])
  const [[{ o }]] = await pool.query('SELECT COUNT(*) AS o FROM orders WHERE coupon_code = ?', [row.code])
  if (row.used_count > 0 || Number(r) > 0 || Number(o) > 0) {
    await pool.query('UPDATE coupons SET active = 0 WHERE id = ?', [id])
    return { ok: true, deactivated: true }
  }
  await pool.query('DELETE FROM coupons WHERE id = ?', [id])
  return { ok: true }
}

