/** JWT/cookie yardımcıları ve yetkilendirme ara katmanları. */
import jwt from 'jsonwebtoken'
import { env, isProd, corsOrigins } from './env.js'
import { pool } from './db.js'
import { unauthorized, forbidden } from './errors.js'

export const ADMIN_COOKIE = 'tsc_admin'
export const CUSTOMER_COOKIE = 'tsc_customer'

const ADMIN_TTL_SEC = 12 * 60 * 60 // 12 saat
const CUSTOMER_TTL_SEC = 30 * 24 * 60 * 60 // 30 gün

// JWT imza/algoritma sabitlenir (HS256) — algoritma karışıklığı saldırılarına (ör. "none" veya
// asimetrik/simetrik karışıklığı) karşı imzalarken ve doğrularken açıkça tek algoritmaya kilitlenir.
const JWT_ALGORITHM = 'HS256'

function cookieOptions(maxAgeMs) {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeMs,
  }
}

/* ---------------- Yönetici oturumu ---------------- */

export function signAdminToken(admin) {
  return jwt.sign({ type: 'admin', sub: admin.id, username: admin.username, role: admin.role }, env.SESSION_SECRET, {
    algorithm: JWT_ALGORITHM,
    expiresIn: ADMIN_TTL_SEC,
  })
}

export function setAdminCookie(res, token) {
  res.cookie(ADMIN_COOKIE, token, cookieOptions(ADMIN_TTL_SEC * 1000))
}

export function clearAdminCookie(res) {
  res.clearCookie(ADMIN_COOKIE, { path: '/' })
}

/**
 * JWT (12 saate kadar geçerli) yalnızca kimliği doğrular; rol/aktiflik her istekte DB'den tazelenir.
 * Aksi halde `PATCH /admin/users/:id` ile yapılan bir devre dışı bırakma veya rol düşürme, token
 * süresi dolana kadar (12 saate kadar) etkisiz kalırdı.
 */
export async function requireAdmin(req, res, next) {
  const token = req.cookies?.[ADMIN_COOKIE]
  if (!token) return next(unauthorized('Yönetici girişi gerekli'))
  try {
    const payload = jwt.verify(token, env.SESSION_SECRET, { algorithms: [JWT_ALGORITHM] })
    if (payload.type !== 'admin') throw new Error('invalid token type')

    const [rows] = await pool.query('SELECT id, username, role, is_active FROM admin_users WHERE id = ? LIMIT 1', [
      payload.sub,
    ])
    const user = rows[0]
    if (!user || !user.is_active) return next(unauthorized('Oturum geçersiz veya süresi dolmuş'))

    req.admin = { id: user.id, username: user.username, role: user.role }
    next()
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError || err instanceof jwt.TokenExpiredError) {
      return next(unauthorized('Oturum geçersiz veya süresi dolmuş'))
    }
    next(err) // beklenmeyen DB hatası — 500 olarak işlenir
  }
}

/** Yalnızca owner rolündeki yöneticilere izin verir; requireAdmin'den SONRA kullanılmalı. */
export function requireOwner(req, res, next) {
  if (req.admin?.role !== 'owner') return next(forbidden('Bu işlem yalnızca hesap sahibi (owner) tarafından yapılabilir'))
  next()
}

/* ---------------- Müşteri oturumu ---------------- */

export function signCustomerToken(customer) {
  return jwt.sign({ type: 'customer', sub: customer.id, email: customer.email }, env.SESSION_SECRET, {
    algorithm: JWT_ALGORITHM,
    expiresIn: CUSTOMER_TTL_SEC,
  })
}

export function setCustomerCookie(res, token) {
  res.cookie(CUSTOMER_COOKIE, token, cookieOptions(CUSTOMER_TTL_SEC * 1000))
}

export function clearCustomerCookie(res) {
  res.clearCookie(CUSTOMER_COOKIE, { path: '/' })
}

export function requireCustomer(req, res, next) {
  const token = req.cookies?.[CUSTOMER_COOKIE]
  if (!token) return next(unauthorized('Üye girişi gerekli'))
  try {
    const payload = jwt.verify(token, env.SESSION_SECRET, { algorithms: [JWT_ALGORITHM] })
    if (payload.type !== 'customer') throw new Error('invalid token type')
    req.customer = { id: payload.sub, email: payload.email }
    next()
  } catch {
    next(unauthorized('Oturum geçersiz veya süresi dolmuş'))
  }
}

/** Cookie varsa müşteri kimliğini req.customer'a koyar; yoksa/ geçersizse sessizce geçer (misafir sipariş için). */
export function optionalCustomer(req, res, next) {
  const token = req.cookies?.[CUSTOMER_COOKIE]
  if (!token) return next()
  try {
    const payload = jwt.verify(token, env.SESSION_SECRET, { algorithms: [JWT_ALGORITHM] })
    if (payload.type === 'customer') req.customer = { id: payload.sub, email: payload.email }
  } catch {
    // geçersiz/eski token — misafir olarak devam
  }
  next()
}

/* ---------------- CSRF: SameSite=Lax + Origin/Referer kontrolü ---------------- */

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/** Origin header yoksa Referer'ın origin kısmına düşer (bazı istemciler/eski tarayıcılar Origin göndermez). */
function extractRequestOrigin(req) {
  const origin = req.get('origin')
  if (origin) return origin
  const referer = req.get('referer')
  if (!referer) return null
  try {
    return new URL(referer).origin
  } catch {
    return null
  }
}

/**
 * Mutasyon isteklerinde Origin/Referer kontrolü yapar:
 *  - Origin/Referer gönderilmişse CORS_ORIGIN listesiyle eşleşmesi ZORUNLUDUR.
 *  - Çerezle kimlik doğrulanan istekte (tsc_admin/tsc_customer çerezi mevcutsa) Origin/Referer'ın
 *    VAR OLMASI da zorunludur — aksi halde çerezi olan ama Origin/Referer göndermeyen bir istek
 *    (klasik CSRF <form> senaryosuna karşı savunmanın atlanabileceği bir boşluk) reddedilir.
 *  - Çerezsiz (ör. misafir sipariş/kayıt) isteklerde Origin/Referer yoksa (tarayıcı dışı istemci/eski
 *    tarayıcı) SameSite=Lax çerez korumasına güvenilerek geçilir.
 */
export function originCheck(req, res, next) {
  if (!MUTATING_METHODS.has(req.method.toUpperCase())) return next()

  const requestOrigin = extractRequestOrigin(req)
  const hasSessionCookie = Boolean(req.cookies?.[ADMIN_COOKIE] || req.cookies?.[CUSTOMER_COOKIE])

  if (requestOrigin) {
    if (!corsOrigins.includes(requestOrigin)) {
      return next(forbidden('Geçersiz istek kaynağı', 'origin_mismatch'))
    }
  } else if (hasSessionCookie) {
    return next(forbidden('Geçersiz istek kaynağı', 'origin_missing'))
  }

  next()
}
