/**
 * Site ayarları (settings) servis katmanı.
 *
 * `value` sütunu MySQL 8'de JSON tipidir (mysql2 bunu otomatik ayrıştırır); MariaDB'de ise JSON,
 * LONGTEXT takma adıdır ve mysql2 düz metin döner. Bu iki durumu tek bir kod yolunda GÜVENLE
 * ayırt etmenin yolu yok: MySQL 8'in ayrıştırdığı bir JSON string değeri (örn. "905551234567")
 * ile MariaDB'nin ham JSON metni birbirinden typeof ile ayırt edilemez — biri zaten string,
 * diğeri de string'dir, ama biri TEKRAR JSON.parse edilirse (örn. rakamlardan oluşan bir string)
 * sessizce sayıya döner ve veri bozulur. Çözüm: `CAST(value AS CHAR)` ile HER İKİ motorda da
 * her zaman ham JSON metnini almak, ardından JSON.parse'ı TAM OLARAK BİR KEZ uygulamak.
 */
import { pool } from '../db.js'

function parseOnce(text) {
  if (text === null || text === undefined) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export async function getSettings() {
  const [rows] = await pool.query('SELECT `key`, CAST(value AS CHAR) AS value FROM settings')
  return Object.fromEntries(rows.map((r) => [r.key, parseOnce(r.value)]))
}

export async function getSetting(key) {
  const [rows] = await pool.query('SELECT CAST(value AS CHAR) AS value FROM settings WHERE `key` = ? LIMIT 1', [key])
  return rows[0] ? parseOnce(rows[0].value) : null
}

export async function updateSettings(patch) {
  const entries = Object.entries(patch ?? {})
  if (!entries.length) return getSettings()
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    for (const [key, value] of entries) {
      // JSON.stringify edilmiş metin doğrudan bağlanır: MySQL 8'de JSON sütunu bunu otomatik
      // ayrıştırıp saklar; MariaDB'de (JSON = LONGTEXT) zaten düz metin olarak saklanır.
      await conn.query(
        'INSERT INTO settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)',
        [key, JSON.stringify(value ?? null)],
      )
    }
    await conn.commit()
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
  return getSettings()
}
