/** İçerik alanları (content_fields) ve marka görselleri (brand_media) servis katmanı. */
import { pool } from '../db.js'

export async function getFields() {
  const [rows] = await pool.query('SELECT `key`, value FROM content_fields')
  return Object.fromEntries(rows.map((r) => [r.key, r.value]))
}

/**
 * İngilizce değerler (value_en). Yalnızca DOLU (boş/boşluk olmayan) EN değerleri döner — boş olan
 * anahtarlar yanıtta hiç yer almaz; mağaza bu durumda Türkçe zincire düşer.
 */
export async function getFieldsEn() {
  const [rows] = await pool.query('SELECT `key`, value_en FROM content_fields WHERE value_en IS NOT NULL')
  return Object.fromEntries(rows.filter((r) => String(r.value_en).trim()).map((r) => [r.key, r.value_en]))
}

/** Boş/boşluk metin → null (EN değeri "yok" demektir; mağaza Türkçeye düşer). */
export const blankToNull = (v) => (typeof v === 'string' && v.trim() ? v : null)

/**
 * TR (`patch` → value) ve EN (`patchEn` → value_en) alanlarını tek transaction'da yazar. İkisi de
 * kısmidir: yalnızca verilen anahtarlar değişir; bir dilin yazılması diğer dildeki değeri ASLA ezmez
 * (yeni anahtar oluşturulurken karşı dil NULL kalır). Dönüş: `{ fields, fieldsEn }`.
 */
export async function updateFields(patch, patchEn) {
  const entries = Object.entries(patch ?? {})
  const entriesEn = Object.entries(patchEn ?? {})
  if (entries.length || entriesEn.length) {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()
      for (const [key, value] of entries) {
        await conn.query(
          'INSERT INTO content_fields (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)',
          [key, value === undefined ? null : value],
        )
      }
      for (const [key, value] of entriesEn) {
        await conn.query(
          'INSERT INTO content_fields (`key`, value, value_en) VALUES (?, NULL, ?) ON DUPLICATE KEY UPDATE value_en = VALUES(value_en)',
          [key, blankToNull(value)],
        )
      }
      await conn.commit()
    } catch (err) {
      await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
  }
  const [fields, fieldsEn] = await Promise.all([getFields(), getFieldsEn()])
  return { fields, fieldsEn }
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
