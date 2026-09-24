/** Müşteri hesabı: kayıt, giriş, çıkış, oturum bilgisi. */
import { Router } from 'express'
import bcrypt from 'bcryptjs'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { pool } from '../db.js'
import { signCustomerToken, setCustomerCookie, clearCustomerCookie, requireCustomer } from '../auth.js'
import { parseBody, unauthorized, conflict } from '../errors.js'

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
})

const loginSchema = z.object({
  email: z.string().email('Geçerli bir e-posta girin'),
  password: z.string().min(1, 'Parola gerekli'),
})

router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const { name, email, password } = parseBody(registerSchema, req.body)
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
    res.json({ customer: { id: user.id, email: user.email, name: user.name, discountEligible: !!user.discount_eligible } })
  } catch (err) {
    next(err)
  }
})

export default router
