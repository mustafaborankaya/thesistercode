/** İçerik alanları (content_fields) ve marka görselleri (brand_media) servis katmanı. */
import { pool } from '../db.js'

export async function getFields() {
  const [rows] = await pool.query('SELECT `key`, value FROM content_fields')
  return Object.fromEntries(rows.map((r) => [r.key, r.value]))
}

export async function updateFields(patch) {
  const entries = Object.entries(patch ?? {})
  if (!entries.length) return getFields()
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    for (const [key, value] of entries) {
      await conn.query(
        'INSERT INTO content_fields (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)',
        [key, value === undefined ? null : value],
      )
    }
    await conn.commit()
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
  return getFields()
}

export async function getBrandMedia() {
  const [rows] = await pool.query('SELECT name, url FROM brand_media')
  return Object.fromEntries(rows.map((r) => [r.name, r.url]))
}

export async function updateBrandMedia(patch) {
  const entries = Object.entries(patch ?? {})
  if (!entries.length) return getBrandMedia()
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    for (const [name, url] of entries) {
      await conn.query(
        'INSERT INTO brand_media (name, url) VALUES (?, ?) ON DUPLICATE KEY UPDATE url = VALUES(url)',
        [name, url === undefined ? null : url],
      )
    }
    await conn.commit()
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
  return getBrandMedia()
}
