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
const DETAILED_CODES = new Set(['insufficient_stock', 'invalid_product', 'invalid_variant', 'validation_error', 'coupon_min_subtotal'])

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

/** İndirim kodu hata kodu mu? (`POST /orders` 400/409 ya da `/coupons/validate` → reason) */
export function isCouponError(code: string | undefined | null): boolean {
  return typeof code === 'string' && code.startsWith('coupon_')
}

/** `/coupons/validate` → valid:false `reason` için yerelleştirilmiş mesaj (TR'de sunucu mesajı ayrıntılıysa o). */
export function couponReasonMessage(reason: string, serverMessage?: string): string {
  if (locale === 'tr' && serverMessage && reason === 'coupon_min_subtotal') return serverMessage
  const known = (M as Record<string, string>)[reason]
  return known ?? apiErrorMessage(new ApiError(400, reason, serverMessage ?? ''))
}

/** `409 price_changed` → `error.details` (bkz. api/README.md "Kuponlar"). */
export interface PriceChangedDetails {
  expectedTotal: number
  currentTotal: number
  lines: { productId: string; colorId: string; size: string; unitPrice: number }[]
}

export function priceChangedDetails(e: unknown): PriceChangedDetails | null {
  if (!(e instanceof ApiError) || e.code !== 'price_changed' || !e.details || typeof e.details !== 'object') return null
  const d = e.details as PriceChangedDetails
  if (!Number.isFinite(d.currentTotal) || !Array.isArray(d.lines)) return null
  return { expectedTotal: Number(d.expectedTotal), currentTotal: Number(d.currentTotal), lines: d.lines.filter((l) => l && typeof l.productId === 'string' && Number.isFinite(l.unitPrice)) }
}
