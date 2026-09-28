/** Saf sepet hesaplamaları — arayüzden bağımsız, test edilebilir. */

import { siteSettings } from '../config/settings'
import { productById } from '../data/catalog'
import type { CartLine, CartTotals, Product, SizeId } from '../data/types'

export function lineKey(productId: string, colorId: string, size: SizeId): string {
  return `${productId}:${colorId}:${size}`
}

export function variantStock(product: Product, colorId: string, size: SizeId): number {
  return product.stock[colorId]?.[size] ?? 0
}

/**
 * Düşük stok eşiği — kural API ile aynı: 0 tükendi, 1..eşik düşük stok (bkz. api/README.md "Stok takibi").
 * Eşik yalnızca yönetici ayarıdır (public /settings'e girmez); mağaza varsayılanı kullanır.
 */
export function lowStockThreshold(): number {
  const t = siteSettings.inventory?.lowStockThreshold
  return typeof t === 'number' && Number.isInteger(t) && t >= 0 ? t : 3
}

export function isLowStock(qty: number): boolean {
  return qty > 0 && qty <= lowStockThreshold()
}

/**
 * Sunucudan öğrenilen güncel stok (örn. `POST /orders` → 409 insufficient_stock `details[].available`)
 * bellekteki katalog nesnesine yazılır — aksi halde `maxQty`/beden seçici açılış anındaki stoğu
 * görmeye devam eder ve kullanıcı adedi tekrar artırabilirdi.
 */
export function applyKnownStock(productId: string, colorId: string, size: SizeId, qty: number): void {
  const product = productById[productId]
  if (!product) return
  const row = product.stock[colorId] ?? (product.stock[colorId] = {})
  row[size] = Math.max(0, Math.floor(qty))
}

/**
 * Sunucunun bildirdiği güncel birim fiyatı (`POST /orders` → 409 price_changed `details.lines[].unitPrice`)
 * bellekteki katalog nesnesine yazar; sepet toplamı bir sonraki hesapta güncel fiyatı kullanır.
 */
export function applyKnownPrice(productId: string, unitPrice: number): void {
  const product = productById[productId]
  if (!product || !Number.isFinite(unitPrice) || unitPrice < 0) return
  product.price = unitPrice
}

export function lineProduct(line: CartLine): Product | undefined {
  return productById[line.productId]
}

export function lineUnitPrice(line: CartLine): number {
  return lineProduct(line)?.price ?? 0
}

export function lineTotal(line: CartLine): number {
  return lineUnitPrice(line) * line.qty
}

/** Sepetteki geçersiz satırları (silinmiş ürün, stok üstü adet) düzeltir. */
export function normalizeLines(lines: CartLine[]): CartLine[] {
  const out: CartLine[] = []
  for (const line of lines) {
    const product = productById[line.productId]
    if (!product) continue
    const max = variantStock(product, line.colorId, line.size)
    if (max <= 0) continue
    out.push({ ...line, qty: Math.min(Math.max(1, Math.floor(line.qty)), max) })
  }
  return out
}

/** `POST /coupons/validate` ile doğrulanmış kupon (sepette sessionStorage'da tutulur). */
export interface AppliedCoupon {
  code: string
  type: 'percent' | 'fixed'
  value: number
  minSubtotal: number | null
}

/** Sepet/ödeme özeti toplamları — kupon ve ücretsiz kargo alanlarıyla genişletilmiş `CartTotals`. */
export interface SummaryTotals extends CartTotals {
  /** Uygulanan kupon kodu (indirim > 0 ise); yoksa null. */
  couponCode?: string | null
  couponDiscount?: number
  /** Kupon girildi ama uygulanmadı: üyelik indirimi daha yüksek ya da alt limit altında. */
  couponIgnored?: 'member' | 'minSubtotal' | null
  /** Ücretsiz kargo eşiği karşılandı (kargo 0). */
  freeShipping?: boolean
}

export interface TotalsInput {
  lines: CartLine[]
  /** Kullanıcının üyelik indirimi hakkı var mı (hesap oluşturmuş). */
  memberDiscountEligible: boolean
  /** Doğrulanmış kupon (varsa). */
  coupon?: AppliedCoupon | null
}

const toKurus = (n: number) => Math.round(n * 100)

/** Kupon indirimi (kuruş) — sunucuyla aynı: yüzde → ara toplam × değer / 100 (kuruş yuvarlama), sabit → min(değer, ara toplam). */
function couponKurus(coupon: AppliedCoupon, subtotalKurus: number): number {
  const k = coupon.type === 'percent' ? Math.round((subtotalKurus * coupon.value) / 100) : Math.min(toKurus(coupon.value), subtotalKurus)
  return Math.max(0, Math.min(k, subtotalKurus))
}

/**
 * Sepet toplamları — kurallar sunucuyla birebir (api/src/services/orders.js → createOrder):
 *  - Üyelik indirimi ile kupon birlikte uygulanmaz; yüksek olan uygulanır, eşitlikte kupon.
 *  - Kargo: `shipping.amount` null → tanımsız (toplam kargo hariç). Tanımlıysa, `shipping.freeOver` eşiği
 *    (indirimler sonrası ara toplam ≥ eşik) karşılanıyorsa 0.
 * Ödeme adımında son söz sunucunundur; sipariş sonrası özet sunucu yanıtındaki toplamları gösterir.
 */
export function computeTotals({ lines, memberDiscountEligible, coupon = null }: TotalsInput): SummaryTotals {
  const itemCount = lines.reduce((n, l) => n + l.qty, 0)
  const subtotalKurus = lines.reduce((sum, l) => sum + toKurus(lineUnitPrice(l)) * l.qty, 0)
  const subtotal = subtotalKurus / 100

  const campaign = siteSettings.memberDiscount
  let discountPercent = 0
  if (
    campaign.enabled &&
    memberDiscountEligible &&
    campaign.mode === 'automatic' &&
    (campaign.minSubtotal == null || subtotal >= campaign.minSubtotal) &&
    (campaign.expiresAt == null || Date.now() < Date.parse(campaign.expiresAt))
  ) {
    discountPercent = campaign.percent
  }
  let memberKurus = Math.round((subtotalKurus * discountPercent) / 100)

  let couponCode: string | null = null
  let appliedCouponKurus = 0
  let couponIgnored: SummaryTotals['couponIgnored'] = null
  if (coupon) {
    if (coupon.minSubtotal != null && subtotalKurus < toKurus(coupon.minSubtotal)) {
      couponIgnored = 'minSubtotal'
    } else {
      const k = couponKurus(coupon, subtotalKurus)
      if (k > 0 && k >= memberKurus) {
        couponCode = coupon.code
        appliedCouponKurus = k
        discountPercent = 0
        memberKurus = 0
      } else {
        couponIgnored = 'member'
      }
    }
  }

  const afterDiscountKurus = subtotalKurus - memberKurus - appliedCouponKurus
  const amount = siteSettings.shipping.amount
  const freeOver = siteSettings.shipping.freeOver
  // Kargo tanımlı değilse ücretsiz sayılmaz: toplam kargo hariç verilir, arayüz bunu belirtir.
  let shippingKurus: number | null = null
  let freeShipping = false
  if (typeof amount === 'number') {
    freeShipping = typeof freeOver === 'number' && afterDiscountKurus >= toKurus(freeOver)
    shippingKurus = freeShipping ? 0 : toKurus(amount)
  }
  const total = (afterDiscountKurus + (shippingKurus ?? 0)) / 100

  return {
    itemCount,
    subtotal,
    discountPercent,
    discountAmount: memberKurus / 100,
    shipping: shippingKurus == null ? null : shippingKurus / 100,
    total,
    couponCode,
    couponDiscount: appliedCouponKurus / 100,
    couponIgnored,
    freeShipping,
  }
}
