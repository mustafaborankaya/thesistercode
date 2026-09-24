/** Yönetici giriş/çıkış ve oturum bilgisi. */
import { Router } from 'express'
import bcrypt from 'bcryptjs'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { pool } from '../db.js'
import { signAdminToken, setAdminCookie, clearAdminCookie, requireAdmin } from '../auth.js'
import { parseBody, unauthorized } from '../errors.js'

const router = Router()

// Kullanıcı adı var/yok farkını zamanlama yoluyla sızdırmamak için: kullanıcı bulunamadığında da
// bcrypt.compare sabit bir dummy hash'e karşı çalıştırılır (gerçek bir hesaba ait değildir).
const DUMMY_BCRYPT_HASH = '$2a$12$oWcBklGjt/lEvHodTlzNN.Ocym9eOM4mqoPGQGEA27kG/atloM1uW'

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
    // Kullanıcı yoksa/pasifse de bcrypt.compare çalıştırılır (dummy hash'e karşı) — böylece yanıt
    // süresi var olan/olmayan kullanıcı adı için ayırt edilemez kalır (kullanıcı adı numaralandırması önlenir).
    const ok = await bcrypt.compare(password, user?.password_hash ?? DUMMY_BCRYPT_HASH)
    if (!user || !user.is_active || !ok) {
      return next(unauthorized('Kullanıcı adı veya parola hatalı', 'invalid_credentials'))
    }

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
