#!/usr/bin/env node
/**
 * api/migrations/*.sql dosyalarını ada göre sıralı uygular; her biri schema_migrations tablosuna
 * kaydedilir, böylece `node scripts/migrate.js` tekrar çalıştırıldığında yalnızca yeni dosyalar
 * uygulanır.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'
import { env } from '../src/env.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const migrationsDir = path.join(__dirname, '..', 'migrations')

async function main() {
  const connection = await mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    multipleStatements: true,
    charset: 'utf8mb4_unicode_ci',
  })

  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    const [appliedRows] = await connection.query('SELECT id FROM schema_migrations')
    const applied = new Set(appliedRows.map((r) => r.id))

    const files = (await fs.readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort()

    if (!files.length) {
      console.log('[migrate] migrations/ klasöründe .sql dosyası bulunamadı.')
      return
    }

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`[migrate] atlandı (uygulanmış): ${file}`)
        continue
      }
      const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8')
      console.log(`[migrate] uygulanıyor: ${file}`)
      await connection.query(sql)
      await connection.query('INSERT INTO schema_migrations (id) VALUES (?)', [file])
      console.log(`[migrate] tamamlandı: ${file}`)
    }

    console.log('[migrate] tüm migrationlar güncel.')
  } finally {
    await connection.end()
  }
}

main().catch((err) => {
  console.error('[migrate] hata:', err.message)
  process.exitCode = 1
})
