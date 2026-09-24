/** Yönetici giriş/çıkış ve oturum bilgisi. */
import { Router } from 'express'
import bcrypt from 'bcryptjs'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { pool } from '../db.js'
import { signAdminToken, setAdminCookie, clearAdminCookie, requireAdmin } from '../auth.js'
import { parseBody, unauthorized } from '../errors.js'

const router = Router()

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'rate_limited', message: 'Çok fazla deneme yapıldı. Lütfen 15 dakika sonra tekrar deneyin.' } },
})

const loginSchema = z.object({
  username: z.string().min(1, 'Kullanıcı adı gerekli'),
  password: z.string().min(1, 'Parola gerekli'),
})

router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { username, password } = parseBody(loginSchema, req.body)

    const [rows] = await pool.query(
      'SELECT id, username, password_hash, role, is_active FROM admin_users WHERE username = ? LIMIT 1',
      [username],
    )
    const user = rows[0]
    if (!user || !user.is_active) return next(unauthorized('Kullanıcı adı veya parola hatalı', 'invalid_credentials'))

    const ok = await bcrypt.compare(password, user.password_hash)
    if (!ok) return next(unauthorized('Kullanıcı adı veya parola hatalı', 'invalid_credentials'))

    await pool.query('UPDATE admin_users SET last_login_at = NOW() WHERE id = ?', [user.id])

    const token = signAdminToken(user)
    setAdminCookie(res, token)
    res.json({ admin: { id: user.id, username: user.username, role: user.role } })
  } catch (err) {
    next(err)
  }
})

router.post('/logout', (req, res) => {
  clearAdminCookie(res)
  res.json({ ok: true })
})

router.get('/me', requireAdmin, (req, res) => {
  res.json({ admin: req.admin })
})

export default router
