/** Yönetici hesapları (admin_users) — listeleme herkese açık (admin için), oluşturma/değiştirme owner'a özel. */
import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { pool } from '../db.js'
import { requireAdmin, requireOwner } from '../auth.js'
import { parseBody, conflict, notFound, badRequest } from '../errors.js'

/** Değişiklik sonrası en az bir aktif owner kalmasını garanti eder (kilitlenmeyi önler). */
async function assertActiveOwnerRemains(conn, targetId, patch) {
  const demotesOrDeactivates = patch.role === 'editor' || patch.is_active === false
  if (!demotesOrDeactivates) return
  const [rows] = await conn.query(
    "SELECT COUNT(*) AS n FROM admin_users WHERE role = 'owner' AND is_active = 1 AND id != ?",
    [targetId],
  )
  if (rows[0].n === 0) {
    throw conflict('En az bir aktif owner hesabı kalmalı; bu değişiklik son owner\'ı devre dışı bırakır/düşürür', 'last_owner')
  }
}

const router = Router()
router.use(requireAdmin)

const createSchema = z.object({
  username: z.string().min(3, 'Kullanıcı adı en az 3 karakter olmalı').max(64),
  password: z.string().min(8, 'Parola en az 8 karakter olmalı').max(200),
  role: z.enum(['owner', 'editor']).default('editor'),
})

const updateSchema = z.object({
  password: z.string().min(8).max(200).optional(),
  is_active: z.boolean().optional(),
  role: z.enum(['owner', 'editor']).optional(),
})

router.get('/', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, username, role, is_active, last_login_at, created_at FROM admin_users ORDER BY id ASC',
    )
    res.json({ users: rows })
  } catch (err) {
    next(err)
  }
})

router.post('/', requireOwner, async (req, res, next) => {
  try {
    const { username, password, role } = parseBody(createSchema, req.body)
    const [existing] = await pool.query('SELECT id FROM admin_users WHERE username = ? LIMIT 1', [username])
    if (existing[0]) throw conflict('Bu kullanıcı adı zaten kullanılıyor', 'username_taken')

    const passwordHash = await bcrypt.hash(password, 12)
    const [result] = await pool.query(
      'INSERT INTO admin_users (username, password_hash, role, is_active) VALUES (?, ?, ?, 1)',
      [username, passwordHash, role],
    )
    res.status(201).json({ user: { id: result.insertId, username, role, is_active: 1 } })
  } catch (err) {
    next(err)
  }
})

router.patch('/:id', requireOwner, async (req, res, next) => {
  const conn = await pool.getConnection()
  try {
    // Route parametresi her zaman string'dir; burada BİR KEZ Number'a çevrilip (id sütunu INT)
    // aşağıdaki TÜM sorgularda aynı değer kullanılır — aksi halde `assertActiveOwnerRemains`
    // (Number) ile UPDATE/SELECT (ham string) farklı temsillerle çalışıp tutarsız davranabilirdi.
    if (!/^\d+$/.test(req.params.id)) throw badRequest('Geçersiz kullanıcı id biçimi', 'validation_error')
    const targetId = Number(req.params.id)

    const patch = parseBody(updateSchema, req.body)
    const fields = []
    const values = []

    if (patch.password !== undefined) {
      fields.push('password_hash = ?')
      values.push(await bcrypt.hash(patch.password, 12))
    }
    if (patch.is_active !== undefined) {
      fields.push('is_active = ?')
      values.push(patch.is_active ? 1 : 0)
    }
    if (patch.role !== undefined) {
      fields.push('role = ?')
      values.push(patch.role)
    }
    if (!fields.length) throw badRequest('Güncellenecek alan belirtilmedi', 'no_fields')

    await conn.beginTransaction()
    await assertActiveOwnerRemains(conn, targetId, patch)

    const [result] = await conn.query(`UPDATE admin_users SET ${fields.join(', ')} WHERE id = ?`, [
      ...values,
      targetId,
    ])
    if (result.affectedRows === 0) throw notFound('Kullanıcı bulunamadı')

    const [rows] = await conn.query(
      'SELECT id, username, role, is_active, last_login_at, created_at FROM admin_users WHERE id = ? LIMIT 1',
      [targetId],
    )
    await conn.commit()
    res.json({ user: rows[0] })
  } catch (err) {
    await conn.rollback()
    next(err)
  } finally {
    conn.release()
  }
})

export default router
