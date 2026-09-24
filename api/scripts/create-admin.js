#!/usr/bin/env node
/**
 * Ek yönetici hesabı oluşturur.
 * Kullanım: node scripts/create-admin.js <username> <password> [owner|editor]
 */
import bcrypt from 'bcryptjs'
import { pool } from '../src/db.js'

async function main() {
  const [, , username, password, role = 'editor'] = process.argv

  if (!username || !password) {
    console.error('Kullanım: node scripts/create-admin.js <username> <password> [owner|editor]')
    process.exitCode = 1
    return
  }
  if (password.length < 8) {
    console.error('[create-admin] Parola en az 8 karakter olmalı.')
    process.exitCode = 1
    return
  }
  if (!['owner', 'editor'].includes(role)) {
    console.error('[create-admin] Rol "owner" veya "editor" olmalı.')
    process.exitCode = 1
    return
  }

  const [existing] = await pool.query('SELECT id FROM admin_users WHERE username = ? LIMIT 1', [username])
  if (existing[0]) {
    console.error(`[create-admin] "${username}" kullanıcı adı zaten mevcut.`)
    process.exitCode = 1
    return
  }

  const passwordHash = await bcrypt.hash(password, 12)
  await pool.query('INSERT INTO admin_users (username, password_hash, role, is_active) VALUES (?, ?, ?, 1)', [
    username,
    passwordHash,
    role,
  ])
  console.log(`[create-admin] "${username}" (${role}) oluşturuldu.`)
}

main()
  .catch((err) => {
    console.error('[create-admin] hata:', err.message)
    process.exitCode = 1
  })
  .finally(() => pool.end())
