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

export interface TotalsInput {
  lines: CartLine[]
  /** Kullanıcının üyelik indirimi hakkı var mı (hesap oluşturmuş). */
  memberDiscountEligible: boolean
}

export function computeTotals({ lines, memberDiscountEligible }: TotalsInput): CartTotals {
  const itemCount = lines.reduce((n, l) => n + l.qty, 0)
  const subtotal = lines.reduce((sum, l) => sum + lineTotal(l), 0)

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
  const discountAmount = round2((subtotal * discountPercent) / 100)

  const shipping = siteSettings.shipping.amount
  // Kargo tanımlı değilse ücretsiz sayılmaz: toplam kargo hariç verilir, arayüz bunu belirtir.
  const total = round2(subtotal - discountAmount + (shipping ?? 0))

  return { itemCount, subtotal, discountPercent, discountAmount, shipping, total }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
