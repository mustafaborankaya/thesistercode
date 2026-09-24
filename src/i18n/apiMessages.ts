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

/** `409 insufficient_stock` → `error.details[]` öğesi (bkz. api/README.md "Stok takibi"). */
export interface StockShortage {
  productId: string
  colorId: string
  size: string
  requested: number
  available: number
}

/** Hata `insufficient_stock` ise geçerli `details` öğelerini döndürür; değilse (ya da eski API) boş dizi. */
export function stockShortages(e: unknown): StockShortage[] {
  if (!(e instanceof ApiError) || e.code !== 'insufficient_stock' || !Array.isArray(e.details)) return []
  return e.details.filter(
    (d): d is StockShortage =>
      !!d &&
      typeof d === 'object' &&
      typeof (d as StockShortage).productId === 'string' &&
      typeof (d as StockShortage).colorId === 'string' &&
      typeof (d as StockShortage).size === 'string' &&
      Number.isFinite((d as StockShortage).available),
  )
}

/**
 * Yetersiz stok satırı için yerelleştirilmiş kısa mesaj — sunucu mesajı yalnızca Türkçe olduğundan
 * ürün/renk adı mağazanın (dile göre yerelleştirilmiş) katalogundan verilir.
 */
export function stockShortageMessage(name: string, variant: string, available: number): string {
  return available > 0 ? S.checkout.stockLeft(name, variant, available) : S.checkout.stockGone(name, variant)
}
