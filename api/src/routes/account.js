/** Müşteri hesabı: kayıt, giriş, çıkış, oturum bilgisi, e-posta doğrulama, parola sıfırlama. */
import crypto from 'node:crypto'
import { Router } from 'express'
import bcrypt from 'bcryptjs'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { pool } from '../db.js'
import { signCustomerToken, setCustomerCookie, clearCustomerCookie, requireCustomer } from '../auth.js'
import { parseBody, unauthorized, conflict, badRequest } from '../errors.js'
import { sendMail } from '../services/mail.js'
import { siteUrl } from '../env.js'
import { listOrdersForCustomer } from '../services/customers.js'
import { customerHasActiveOrder, isFirstOrderOnly } from '../services/orders.js'
import { getSetting } from '../services/settings.js'

const router = Router()

// Kullanıcı adı/e-posta var/yok farkını zamanlama yoluyla sızdırmamak için: hesap bulunamadığında
// da bcrypt.compare sabit bir dummy hash'e karşı çalıştırılır (gerçek bir hesaba ait değildir).
const DUMMY_BCRYPT_HASH = '$2a$12$oWcBklGjt/lEvHodTlzNN.Ocym9eOM4mqoPGQGEA27kG/atloM1uW'

// Yönetici girişiyle aynı sınır (10/15dk/IP) — spesifikasyondaki "login'e rate limit" isteği
// müşteri girişi/kaydı için de mantıklı bir genişletmedir (kaba kuvvet/otomatik kayıt önleme).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'rate_limited', message: 'Çok fazla deneme yapıldı. Lütfen 15 dakika sonra tekrar deneyin.' } },
})

const registerSchema = z.object({
  name: z.string().min(1, 'Ad Soyad gerekli').max(200),
  email: z.string().email('Geçerli bir e-posta girin').max(190),
  password: z.string().min(8, 'Parola en az 8 karakter olmalı').max(200),
  /** E-posta dili (mağazanın /en önekinden gelir); yoksa Türkçe. */
  locale: z.enum(['tr', 'en']).optional(),
})

const localeSchema = z.enum(['tr', 'en']).optional()
const forgotSchema = z.object({ email: z.string().email('Geçerli bir e-posta girin').max(190), locale: localeSchema })
const resetSchema = z.object({ token: z.string().min(16).max(128), password: z.string().min(8, 'Parola en az 8 karakter olmalı').max(200) })
const verifySchema = z.object({ token: z.string().min(16).max(128) })

// Tek kullanımlık bağlantı token'ları: 32 byte rastgele; DB'de yalnızca SHA-256 hash'i saklanır.
function newLinkToken() {
  const raw = crypto.randomBytes(32).toString('base64url')
  return { raw, hash: hashLinkToken(raw) }
}
function hashLinkToken(raw) {
  return crypto.createHash('sha256').update(String(raw)).digest('hex')
}
function localePrefix(locale) {
  return locale === 'en' ? '/en' : ''
}

/** Doğrulama kaydı oluşturur ve doğrulama e-postasını kuyruğa koyar (yanıtı bekletmez). */
async function issueEmailVerification(customer, locale) {
  const { raw, hash } = newLinkToken()
  await pool.query(
    'INSERT INTO email_verifications (customer_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 48 HOUR))',
    [customer.id, hash],
  )
  const verifyUrl = `${siteUrl}${localePrefix(locale)}/hesap/dogrula?token=${raw}`
  sendMail({ to: customer.email, template: 'verifyEmail', data: { name: customer.name, verifyUrl }, locale, refType: 'customer', refId: String(customer.id) }).catch(() => undefined)
}

const loginSchema = z.object({
  email: z.string().email('Geçerli bir e-posta girin'),
  password: z.string().min(1, 'Parola gerekli'),
})

router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const { name, email, password, locale = 'tr' } = parseBody(registerSchema, req.body)
    const normalizedEmail = email.trim().toLowerCase()

    const [existing] = await pool.query('SELECT id FROM customers WHERE email = ? LIMIT 1', [normalizedEmail])
    if (existing[0]) throw conflict('Bu e-posta ile zaten bir hesap var', 'email_taken')

    const passwordHash = await bcrypt.hash(password, 12)
    const [result] = await pool.query(
      'INSERT INTO customers (email, name, password_hash, discount_eligible) VALUES (?, ?, ?, 1)',
      [normalizedEmail, name.trim(), passwordHash],
    )
    const customer = { id: result.insertId, email: normalizedEmail, name: name.trim() }

    const token = signCustomerToken(customer)
    setCustomerCookie(res, token)
    res.status(201).json({ customer })
    // Hoş geldin + e-posta doğrulama; sağlayıcı yoksa mail_log'a "skipped" yazılır, kayıt akışını etkilemez.
    sendMail({ to: customer.email, template: 'welcome', data: { name: customer.name }, locale, refType: 'customer', refId: String(customer.id) }).catch(() => undefined)
    issueEmailVerification(customer, locale).catch(() => undefined)
  } catch (err) {
    next(err)
  }
})

router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { email, password } = parseBody(loginSchema, req.body)
    const normalizedEmail = email.trim().toLowerCase()

    const [rows] = await pool.query('SELECT id, email, name, password_hash FROM customers WHERE email = ? LIMIT 1', [
      normalizedEmail,
    ])
    const user = rows[0]
    // Hesap yoksa da bcrypt.compare çalıştırılır (dummy hash'e karşı) — yanıt süresi var olan/olmayan
    // e-posta için ayırt edilemez kalır (hesap numaralandırması önlenir).
    const ok = await bcrypt.compare(password, user?.password_hash ?? DUMMY_BCRYPT_HASH)
    if (!user || !ok) return next(unauthorized('E-posta veya parola hatalı', 'invalid_credentials'))

    const token = signCustomerToken(user)
    setCustomerCookie(res, token)
    res.json({ customer: { id: user.id, email: user.email, name: user.name } })
  } catch (err) {
    next(err)
  }
})

router.post('/logout', (req, res) => {
  clearCustomerCookie(res)
  res.json({ ok: true })
})

router.get('/me', requireCustomer, async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT id, email, name, discount_eligible FROM customers WHERE id = ? LIMIT 1', [
      req.customer.id,
    ])
    const user = rows[0]
    if (!user) return next(unauthorized('Oturum geçersiz'))
    // discountEligible dinamiktir: bayrak 1 VE (ilk sipariş kuralı kapalı VEYA aktif — iptal edilmemiş —
    // siparişi yok). İlk sipariş iptal edilirse hak kendiliğinden geri gelir (bkz. services/orders.js).
    const discountUsed = await customerHasActiveOrder(pool, user.id)
    const firstOrderOnly = isFirstOrderOnly(await getSetting('memberDiscount'))
    const discountEligible = !!user.discount_eligible && (!firstOrderOnly || !discountUsed)
    res.json({ customer: { id: user.id, email: user.email, name: user.name, discountEligible, discountUsed } })
  } catch (err) {
    next(err)
  }
})

/** Oturumdaki müşterinin sipariş geçmişi — yeniden eskiye, en fazla 50, formatOrder biçiminde (items dahil). */
router.get('/orders', requireCustomer, async (req, res, next) => {
  try {
    res.json({ orders: await listOrdersForCustomer(req.customer.id) })
  } catch (err) {
    next(err)
  }
})


// ---- E-posta doğrulama ----

/** Oturumdaki müşteri için yeni doğrulama e-postası ister. */
router.post('/verify-email/request', authLimiter, requireCustomer, async (req, res, next) => {
  try {
    const locale = localeSchema.parse(req.body?.locale) ?? 'tr'
    const [rows] = await pool.query('SELECT id, email, name FROM customers WHERE id = ? LIMIT 1', [req.customer.id])
    if (!rows[0]) throw unauthorized()
    // Önceki açık kayıtlar geçersiz kılınır (tek geçerli bağlantı).
    await pool.query('UPDATE email_verifications SET expires_at = NOW() WHERE customer_id = ? AND verified_at IS NULL AND expires_at > NOW()', [rows[0].id])
    await issueEmailVerification(rows[0], locale)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

/** Doğrulama bağlantısındaki token'ı işler. Oturum gerekmez (bağlantı başka cihazda açılabilir). */
router.post('/verify-email', authLimiter, async (req, res, next) => {
  try {
    const { token } = parseBody(verifySchema, req.body)
    const [rows] = await pool.query(
      'SELECT id FROM email_verifications WHERE token_hash = ? AND verified_at IS NULL AND expires_at > NOW() LIMIT 1',
      [hashLinkToken(token)],
    )
    if (!rows[0]) throw badRequest('Bağlantı geçersiz veya süresi dolmuş', 'invalid_token')
    await pool.query('UPDATE email_verifications SET verified_at = NOW() WHERE id = ?', [rows[0].id])
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

/** Oturumdaki müşterinin e-posta doğrulama durumu. */
router.get('/verify-email/status', requireCustomer, async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT verified_at FROM email_verifications WHERE customer_id = ? AND verified_at IS NOT NULL ORDER BY verified_at DESC LIMIT 1', [req.customer.id])
    res.json({ verified: !!rows[0], verifiedAt: rows[0]?.verified_at ?? null })
  } catch (err) {
    next(err)
  }
})

// ---- Parola sıfırlama ----

/**
 * Sıfırlama bağlantısı ister. Hesap var/yok farkı sızdırılmaz: her durumda 200 { ok: true }
 * ve yanıt süresi hesap bulunamadığında da yaklaşık eşitlenir (dummy hash üretimi).
 */
router.post('/password/forgot', authLimiter, async (req, res, next) => {
  try {
    const { email, locale = 'tr' } = parseBody(forgotSchema, req.body)
    const normalizedEmail = email.trim().toLowerCase()
    const [rows] = await pool.query('SELECT id, name FROM customers WHERE email = ? LIMIT 1', [normalizedEmail])
    const user = rows[0]
    if (user) {
      const { raw, hash } = newLinkToken()
      // Önceki açık istekler geçersiz kılınır (aynı anda tek geçerli bağlantı).
      await pool.query('UPDATE password_resets SET used_at = NOW() WHERE customer_id = ? AND used_at IS NULL', [user.id])
      await pool.query(
        'INSERT INTO password_resets (customer_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 60 MINUTE))',
        [user.id, hash],
      )
      const resetUrl = `${siteUrl}${localePrefix(locale)}/sifre-sifirla?token=${raw}`
      await sendMail({ to: normalizedEmail, template: 'passwordReset', data: { name: user.name, resetUrl }, locale, refType: 'customer', refId: String(user.id) }).catch(() => undefined)
    } else {
      newLinkToken()
    }
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

/** Bağlantıdaki token ile yeni parola belirler; token tek kullanımlıktır. */
router.post('/password/reset', authLimiter, async (req, res, next) => {
  try {
    const { token, password } = parseBody(resetSchema, req.body)
    const [rows] = await pool.query(
      'SELECT id, customer_id FROM password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW() LIMIT 1',
      [hashLinkToken(token)],
    )
    const rec = rows[0]
    if (!rec) throw badRequest('Bağlantı geçersiz veya süresi dolmuş', 'invalid_token')
    const passwordHash = await bcrypt.hash(password, 12)
    await pool.query('UPDATE customers SET password_hash = ? WHERE id = ?', [passwordHash, rec.customer_id])
    await pool.query('UPDATE password_resets SET used_at = NOW() WHERE id = ?', [rec.id])
    // Not: müşteri JWT'leri durumsuz olduğundan başka cihazlardaki mevcut oturumlar süresi dolana
    // kadar geçerli kalır; bu istemcideki çerez temizlenir ve yeni parolayla giriş beklenir.
    clearCustomerCookie(res)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

export default router
