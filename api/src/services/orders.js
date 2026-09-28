/** Sipariş oluşturma, sorgulama ve durum güncelleme — fiyat/stok/toplamlar sunucuda hesaplanır. */
import crypto from 'node:crypto'
import { pool } from '../db.js'
import { badRequest, conflict, notFound } from '../errors.js'
import { getSetting } from './settings.js'
import { lockAndCheckCouponInTx, redeemCouponInTx, releaseCouponForOrderInTx, reapplyCouponForOrderInTx } from './coupons.js'
import { trackingUrl } from './shipping.js'

export const ORDER_STATUSES = ['demo', 'new', 'pending_payment', 'paid', 'shipped', 'cancelled']

/**
 * "Aktif" sipariş durumları: üyelik indiriminin İLK SİPARİŞ kuralında sayılan siparişler.
 * İptal edilen ('cancelled') ve 'demo' siparişler sayılmaz — ilk sipariş iptal edilirse hak geri gelir.
 * 'pending_payment' (çevrim içi ödeme bekleyen) AKTİF sayılır: aksi halde ödeme sayfasındayken ikinci
 * bir indirimli sipariş oluşturulabilirdi. Ödenmeyen sipariş 30 dk sonra 'cancelled'a düşer (bkz.
 * services/payments/service.js → sweepExpiredPendingOrders) ve hak geri gelir.
 */
export const ACTIVE_ORDER_STATUSES = ['new', 'pending_payment', 'paid', 'shipped']
const ACTIVE_STATUS_SQL = ACTIVE_ORDER_STATUSES.map((s) => `'${s}'`).join(', ')

/** Üyelik indirimi yalnızca ilk siparişte mi? Alan yoksa/tanımsızsa varsayılan `true` (kesin kural). */
export function isFirstOrderOnly(memberDiscount) {
  return memberDiscount?.firstOrderOnly !== false
}

/**
 * Müşterinin ilk sipariş hakkını tüketen aktif (iptal edilmemiş) siparişi var mı? `db` bir transaction
 * bağlantısı veya havuz olabilir. Kupon uygulanıp üyelik indirimi UYGULANMAYAN siparişler sayılmaz
 * (kupon ile üyelik indirimi birlikte uygulanmaz; hak yalnızca üyelik indirimi gerçekten kullanıldığında
 * tüketilir). Kuponsuz siparişlerde davranış öncekiyle aynıdır.
 */
export async function customerHasActiveOrder(db, customerId) {
  const [rows] = await db.query(
    `SELECT id FROM orders WHERE customer_id = ? AND status IN (${ACTIVE_STATUS_SQL})
        AND NOT (coupon_code IS NOT NULL AND discount_amount = 0) LIMIT 1`,
    [customerId],
  )
  return !!rows[0]
}

function toKurus(n) {
  return Math.round(Number(n) * 100)
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

/**
 * @param {object} input doğrulanmış sipariş gövdesi
 * @param {{id:number}|null} customer oturumdaki müşteri
 * @param {{ initialStatus?: 'new'|'pending_payment' }} [opts] çevrim içi ödeme etkinse 'pending_payment'
 */
export async function createOrder(input, customer, { initialStatus = 'new' } = {}) {
  if (initialStatus !== 'new' && initialStatus !== 'pending_payment') throw new Error('Geçersiz başlangıç durumu')
  const lines = normalizeLines(input.lines)

  const memberDiscount = (await getSetting('memberDiscount')) ?? {}
  const shippingAmount = await getSetting('shipping.amount')
  const freeOver = await getSetting('shipping.freeOver')
  const email = String(input.contact.email).trim()
  const couponCode = typeof input.couponCode === 'string' && input.couponCode.trim() ? input.couponCode : null

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
    let subtotalKurus = 0
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
      // İç kimlik (urun-NN) kullanıcıya gösterilmez; gizlenmiş üründe adı verilir. details.productId istemci içindir.
      if (!product || product.hidden) {
        const err = badRequest(
          product ? `Sepetinizdeki bir ürün artık satışta değil: ${product.name}` : 'Sepetinizdeki bir ürün artık satışta değil.',
          'invalid_product',
        )
        err.details = { productId: line.productId }
        throw err
      }

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
      subtotalKurus += toKurus(unitPrice) * line.qty
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

    const subtotal = subtotalKurus / 100
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
    let memberKurus = Math.round((subtotalKurus * discountPercent) / 100)

    // Kupon: kilitlenir (FOR UPDATE, kilit sırası müşteri → ürün/stok → kupon) ve doğrulanır; geçersizse
    // 400/409 kupon hatası. Üyelik indirimi ile birlikte UYGULANMAZ: yüksek olan uygulanır; eşitlikte kupon
    // (üyenin ilk sipariş hakkı korunur). Üyelik indirimi daha yüksekse kupon sessizce düşer (kaydedilmez).
    let appliedCoupon = null
    let couponKurus = 0
    if (couponCode) {
      const checked = await lockAndCheckCouponInTx(conn, { code: couponCode, subtotal, customerId: customer?.id ?? null, email })
      const candidateKurus = toKurus(checked.discountAmount)
      if (candidateKurus > 0 && candidateKurus >= memberKurus) {
        appliedCoupon = checked.coupon
        couponKurus = candidateKurus
        discountPercent = 0
        memberKurus = 0
      }
    }

    // Kargo: shipping.amount tanımsızsa (null) "bildirilecek" kalır. Tanımlıysa, shipping.freeOver eşiği
    // (indirimler SONRASI ara toplam ≥ eşik) karşılanıyorsa 0, aksi hâlde shipping.amount.
    const afterDiscountKurus = subtotalKurus - memberKurus - couponKurus
    let shippingKurus = null
    if (typeof shippingAmount === 'number') {
      shippingKurus = typeof freeOver === 'number' && afterDiscountKurus >= toKurus(freeOver) ? 0 : toKurus(shippingAmount)
    }
    const totalKurus = afterDiscountKurus + (shippingKurus ?? 0)
    if (initialStatus === 'pending_payment' && totalKurus <= 0) {
      throw badRequest('Tahsil edilecek tutar sıfır olduğundan çevrim içi ödeme başlatılamaz.', 'zero_total')
    }
    // Eski sekme / bayat katalog koruması: istemcinin gösterdiği genel toplam sunucu hesabından 1 kuruştan
    // fazla farklıysa sipariş oluşturulmaz; güncel birim fiyatlar döner (istemci özeti tazeleyip yeniden onaylatır).
    if (input.expectedTotal != null && Math.abs(toKurus(input.expectedTotal) - totalKurus) > 1) {
      throw conflict('Fiyatlar güncellendi, lütfen siparişi yeniden onaylayın.', 'price_changed', {
        expectedTotal: Number(input.expectedTotal),
        currentTotal: totalKurus / 100,
        lines: items.map((i) => ({ productId: i.productId, colorId: i.colorId, size: i.size, unitPrice: i.unitPrice })),
      })
    }
    const discountAmount = memberKurus / 100
    const couponDiscount = couponKurus / 100
    const shipping = shippingKurus == null ? null : shippingKurus / 100
    const total = totalKurus / 100

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
        (id, customer_id, status, email, phone, first_name, last_name, address, district, city, postal_code, country, note, locale,
         subtotal, discount_percent, discount_amount, coupon_code, coupon_discount, shipping, total, access_token_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderId,
        customer?.id ?? null,
        initialStatus,
        email,
        input.contact.phone,
        input.delivery.firstName,
        input.delivery.lastName,
        input.delivery.address,
        input.delivery.district,
        input.delivery.city,
        input.delivery.postalCode,
        input.delivery.country,
        input.delivery.note || null,
        input.locale === 'en' ? 'en' : 'tr',
        subtotal,
        discountPercent,
        discountAmount,
        appliedCoupon ? appliedCoupon.code : null,
        couponDiscount,
        shipping,
        total,
        accessTokenHash,
      ],
    )

    if (appliedCoupon) {
      await redeemCouponInTx(conn, { couponId: appliedCoupon.id, orderId, customerId: customer?.id ?? null, email })
    }

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
    delete order.adminNote // müşteri yanıtı
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
  // Müşteri/erişim token'ı yolu: yönetici notu ASLA dönmez.
  return formatOrder(row, itemRows, { includeAdminNote: false })
}

/**
 * Yönetici sipariş listesi. Filtreler: status, q (sipariş no / e-posta / ad-soyad), from/to (tarih,
 * 'YYYY-MM-DD' İstanbul günü ya da ISO; epoch saniyesiyle karşılaştırılır → sunucu saat diliminden bağımsız).
 * page/pageSize verilmezse eşleşen TÜM siparişler döner (geriye uyumlu).
 * @returns {Promise<{orders:object[], total:number, page:number, pageSize:number}>}
 */
export async function listOrders({ status, q, from, to, page, pageSize } = {}) {
  const params = []
  const where = []
  if (status) {
    if (!ORDER_STATUSES.includes(status)) throw badRequest('Geçersiz sipariş durumu', 'validation_error')
    where.push('status = ?')
    params.push(status)
  }
  if (q && String(q).trim()) {
    const term = `%${String(q).trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`
    where.push("(id LIKE ? OR email LIKE ? OR CONCAT(first_name, ' ', last_name) LIKE ?)")
    params.push(term, term, term)
  }
  const fromTs = parseDateBoundary(from, 'start')
  const toTs = parseDateBoundary(to, 'end')
  if (fromTs != null) {
    where.push('created_at >= FROM_UNIXTIME(?)')
    params.push(fromTs)
  }
  if (toTs != null) {
    where.push('created_at < FROM_UNIXTIME(?)')
    params.push(toTs)
  }
  const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : ''
  const [[{ n }]] = await pool.query(`SELECT COUNT(*) AS n FROM orders${whereSql}`, params)
  const total = Number(n)
  const paginate = page !== undefined || pageSize !== undefined
  const size = paginate ? Math.min(200, Math.max(1, Number.parseInt(pageSize, 10) || 50)) : total
  const pageNo = paginate ? Math.max(1, Number.parseInt(page, 10) || 1) : 1
  const limitSql = paginate ? ' LIMIT ? OFFSET ?' : ''
  const [rows] = await pool.query(
    `SELECT * FROM orders${whereSql} ORDER BY created_at DESC, id DESC${limitSql}`,
    paginate ? [...params, size, (pageNo - 1) * size] : params,
  )
  return { orders: rows.map((r) => formatOrder(r, null)), total, page: pageNo, pageSize: paginate ? size : total }
}

/** Europe/Istanbul için verilen anın UTC ofseti (dakika). */
function istanbulOffsetMinutes(date) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Istanbul', timeZoneName: 'shortOffset' }).formatToParts(date)
  const tz = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+3'
  const m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(tz)
  if (!m) return 180
  return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0))
}

/** İstanbul yerel gününün (y, m, d) 00:00'ının epoch saniyesi. */
export function istanbulDayStartEpoch(y, m, d) {
  const guess = Date.UTC(y, m - 1, d)
  return Math.floor((guess - istanbulOffsetMinutes(new Date(guess)) * 60_000) / 1000)
}

/** Şu anın İstanbul takvim bileşenleri. */
export function istanbulToday(now = new Date()) {
  const [y, m, d] = istanbulDateStamp(now).match(/(\d{4})(\d{2})(\d{2})/).slice(1).map(Number)
  return { y, m, d }
}

/** 'YYYY-MM-DD' → İstanbul gün başı (start) ya da ertesi gün başı (end, dışlayıcı); ISO → o an. Geçersiz → 400. */
function parseDateBoundary(value, kind) {
  if (value == null || value === '') return null
  const s = String(value)
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (day) {
    const [y, m, d] = day.slice(1).map(Number)
    return istanbulDayStartEpoch(y, m, d + (kind === 'end' ? 1 : 0))
  }
  const t = Date.parse(s)
  if (Number.isNaN(t)) throw badRequest(`Geçersiz tarih: ${s}`, 'validation_error')
  return Math.floor(t / 1000)
}

/**
 * Sipariş durumunu günceller. Bir sipariş 'cancelled' durumuna geçerken (ve daha önce zaten iptal
 * edilmemişse) satırdaki ürünler için düşülen stok, aynı transaction içinde geri yüklenir — aksi
 * halde iptal edilen siparişlerin stoğu kalıcı olarak "kilitli" kalır. İptal GERİ
 * ALINIRSA (cancelled → new/paid/shipped) stok aynı transaction'da yeniden ayrılır (yetmezse 409
 * insufficient_stock, hiçbir şey değişmez) ve kupon kullanımı yeniden kaydedilir.
 */
export async function updateOrderStatus(id, status, { guard } = {}) {
  if (!ORDER_STATUSES.includes(status)) throw badRequest('Geçersiz sipariş durumu', 'validation_error')

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    const [rows] = await conn.query('SELECT status FROM orders WHERE id = ? LIMIT 1 FOR UPDATE', [id])
    const current = rows[0]
    if (!current) throw notFound('Sipariş bulunamadı')
    // İsteğe bağlı iş kuralı denetimi (ör. yönetici paneli geçiş kuralları) — kilit altında, güncel durumla.
    if (guard) await guard(conn, current.status)

    await setOrderStatusInTx(conn, id, current.status, status)

    await conn.commit()
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }

  return getOrderById(id)
}

/**
 * Kilitli (FOR UPDATE) bir sipariş satırının durumunu transaction içinde değiştirir; 'cancelled'a
 * GEÇİŞTE stok geri yüklenir (idempotent: zaten iptal ise stoğa dokunulmaz).
 */
export async function setOrderStatusInTx(conn, id, currentStatus, status) {
  await conn.query('UPDATE orders SET status = ? WHERE id = ?', [status, id])
  if (status === 'shipped' && currentStatus !== 'shipped') {
    await conn.query('UPDATE orders SET shipped_at = COALESCE(shipped_at, UTC_TIMESTAMP()) WHERE id = ?', [id])
  }
  if (currentStatus === 'cancelled' && status !== 'cancelled') {
    // İptalden çıkış: iptalde geri yüklenen stok YENİDEN ayrılır; yetmezse 409 (çağıran transaction'ı geri alır).
    if (!(await reserveOrderStockInTx(conn, id))) {
      throw conflict('İptal edilen siparişin stoğu artık yeterli değil; sipariş yeniden açılamaz.', 'insufficient_stock')
    }
    await reapplyCouponForOrderInTx(conn, id)
  }
  if (status === 'cancelled' && currentStatus !== 'cancelled') {
    const [items] = await conn.query('SELECT product_id, color_id, size, qty FROM order_items WHERE order_id = ?', [id])
    for (const item of items) {
      await conn.query(
        `INSERT INTO product_stock (product_id, color_id, size, qty) VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE qty = qty + VALUES(qty)`,
        [item.product_id, item.color_id, item.size, item.qty],
      )
    }
    // Kupon kullanımı geri alınır — stok satırlarından SONRA (kilit sırası sipariş → stok → kupon, createOrder ile aynı).
    await releaseCouponForOrderInTx(conn, id)
  }
}

/**
 * Yönetici güncellemesi: durum (isteğe bağlı, `guard` ile iş kuralı denetimi), kargo firması, takip no,
 * yönetici notu — tek transaction. Dönüş: { order, becameShipped } — çağıran `becameShipped` ise (commit
 * SONRASI) müşteriye orderShipped e-postası gönderir.
 */
export async function updateOrderAdmin(id, { status, carrier, trackingNumber, adminNote }, { guard } = {}) {
  if (status !== undefined && !ORDER_STATUSES.includes(status)) throw badRequest('Geçersiz sipariş durumu', 'validation_error')
  let becameShipped = false
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const [rows] = await conn.query('SELECT status FROM orders WHERE id = ? LIMIT 1 FOR UPDATE', [id])
    const current = rows[0]
    if (!current) throw notFound('Sipariş bulunamadı')
    const sets = []
    const vals = []
    const put = (col, v) => {
      sets.push(`${col} = ?`)
      vals.push(v === undefined ? null : typeof v === 'string' ? v.trim() || null : v)
    }
    if (carrier !== undefined) put('carrier', carrier)
    if (trackingNumber !== undefined) put('tracking_number', trackingNumber)
    if (adminNote !== undefined) put('admin_note', adminNote)
    if (sets.length) await conn.query(`UPDATE orders SET ${sets.join(', ')} WHERE id = ?`, [...vals, id])
    if (status !== undefined && status !== current.status) {
      if (guard) await guard(conn, current.status)
      await setOrderStatusInTx(conn, id, current.status, status)
      becameShipped = status === 'shipped'
    } else if (status !== undefined && guard) {
      await guard(conn, current.status)
    }
    await conn.commit()
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
  return { order: await getOrderById(id), becameShipped }
}

/**
 * İptal edilmiş bir siparişin stoğunu YENİDEN rezerve etmeye çalışır (ödeme süresi dolup iptal edildikten
 * sonra gelen geç başarılı ödeme için). Hepsi düşülebilirse true; biri bile yetersizse false döner —
 * çağıran transaction'ı geri almalıdır.
 */
export async function reserveOrderStockInTx(conn, id) {
  const [items] = await conn.query('SELECT product_id, color_id, size, qty FROM order_items WHERE order_id = ? ORDER BY product_id, color_id, size', [id])
  for (const item of items) {
    const [result] = await conn.query(
      'UPDATE product_stock SET qty = qty - ? WHERE product_id = ? AND color_id = ? AND size = ? AND qty >= ?',
      [item.qty, item.product_id, item.color_id, item.size, item.qty],
    )
    if (result.affectedRows !== 1) return false
  }
  return true
}

/** Erişim doğrulaması (sahibi müşteri oturumu ya da accessToken) — ham satırı döndürür; yoksa/yetkisizse null. */
export async function getOrderRowForAccess(id, { customerId, token } = {}) {
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
  return ownerMatch || tokenMatch ? row : null
}

export { formatOrder }

/** Müşterinin siparişleri (yeniden eskiye), kalemleriyle; sipariş sayısından bağımsız iki sorgu. */
export async function listOrdersByCustomer(customerId, limit = 50, { includeAdminNote = false } = {}) {
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
  return orderRows.map((row) => formatOrder(row, byOrder.get(row.id) ?? [], { includeAdminNote }))
}

/**
 * API sipariş biçimi. `includeAdminNote: false` müşteri yanıtları içindir (yönetici notu çıkarılır).
 * Tarihler: shipped_at UTC DATETIME olarak saklanır → ISO 'Z'.
 */
function formatOrder(row, itemRows, { includeAdminNote = true } = {}) {
  const couponDiscount = Number(row.coupon_discount ?? 0)
  const out = {
    id: row.id,
    customerId: row.customer_id,
    status: row.status,
    locale: row.locale === 'en' ? 'en' : 'tr',
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
      couponDiscount,
      shipping: row.shipping === null ? null : Number(row.shipping),
      total: Number(row.total),
    },
    coupon: row.coupon_code ? { code: row.coupon_code, discount: couponDiscount } : null,
    shipping: {
      carrier: row.carrier ?? null,
      trackingNumber: row.tracking_number ?? null,
      trackingUrl: trackingUrl(row.carrier, row.tracking_number),
      shippedAt: row.shipped_at ? new Date(`${String(row.shipped_at).replace(' ', 'T')}Z`).toISOString() : null,
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
  if (includeAdminNote) out.adminNote = row.admin_note ?? null
  return out
}
