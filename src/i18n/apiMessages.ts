/**
 * BACKEND API HATA MESAJLARI — yardımcı mantık.
 * Metinlerin kendisi tr.ts/en.ts içindeki `S.api` bölümündedir (tek kanonik sözlük); bu dosya yalnızca
 * bir `ApiError`'ı kullanıcıya gösterilecek kısa mesaja çeviren `apiErrorMessage()` mantığını taşır.
 * `api/` (Node/Express) hataları Türkçe döner (bkz. api/src/errors.js) — TR arayüzde bilinmeyen kodlar
 * için sunucu mesajı doğrudan gösterilebilir; EN arayüzde `ApiError.code`'a göre `S.api`'den karşılığı
 * kullanılır.
 */
import { locale, S } from './index'
import { ApiError } from '../services/api'

const M = S.api

/** Sunucu mesajı ürün/stok adı gibi bağlama özgü ayrıntı taşır (örn. "Yetersiz stok: Ürün 01 (Renk 1, M)") — TR arayüzde sözlük yerine bu ayrıntı korunur. */
const DETAILED_CODES = new Set(['insufficient_stock', 'invalid_product', 'invalid_variant', 'validation_error'])

/**
 * `ApiError` (ya da bilinmeyen bir hata) için kullanıcıya gösterilecek kısa mesajı üretir.
 * Konsola ham hata detayı yazılmaz — yalnızca bu kısa mesaj arayüzde gösterilir.
 */
export function apiErrorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (locale === 'tr' && e.message && DETAILED_CODES.has(e.code)) return e.message
    const known = (M as Record<string, string>)[e.code]
    if (known) return known
    // TR arayüzde sunucu mesajı zaten Türkçedir; EN arayüzde bilinmeyen kod için jenerik mesaja düşülür.
    if (locale === 'tr' && e.message) return e.message
    return M.default
  }
  return M.default
}
