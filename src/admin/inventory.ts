/**
 * YÖNETİCİ PANELİ — STOK YARDIMCILARI
 * Kural API ile birebir aynı (bkz. api/src/services/products.js → getInventorySummary):
 * qty = 0 → tükendi, 1..eşik → düşük stok. Yalnızca ürünün tanımlı renkleri × bedenler sayılır.
 */
import { defaultSettings, siteSettings } from '../config/settings'
import type { Product } from '../data/types'
import type { AdminInventory } from './adminApi'

export const MAX_STOCK_QTY = 9999

export type StockLevel = 'out' | 'low' | 'ok'

export function stockLevel(qty: number, threshold: number): StockLevel {
  if (qty <= 0) return 'out'
  return qty <= threshold ? 'low' : 'ok'
}

/** Ürünün tanımlı renkleri × bedenleri üzerinden toplam stok ve en kötü seviye. */
export function productStockInfo(product: Pick<Product, 'colors' | 'sizes' | 'stock'>, threshold: number) {
  let total = 0
  let low = 0
  let out = 0
  for (const c of product.colors) {
    for (const s of product.sizes) {
      const qty = product.stock[c.id]?.[s] ?? 0
      total += qty
      const level = stockLevel(qty, threshold)
      if (level === 'low') low++
      else if (level === 'out') out++
    }
  }
  const variants = product.colors.length * product.sizes.length
  return { total, low, out, variants, soldOut: variants > 0 && out === variants }
}

/** Ayar değerini temizler: tam sayı ve aralık içindeyse o, değilse varsayılan (API ile aynı). */
export function intSetting(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max ? value : fallback
}

export interface InventoryConfig {
  lowStockThreshold: number
  newBadgeDays: number
}

/** `GET /admin/settings` ham yanıtından stok/rozet ayarları. */
export function inventoryConfigFrom(raw: Record<string, unknown>): InventoryConfig {
  return {
    lowStockThreshold: intSetting(raw['inventory.lowStockThreshold'], defaultSettings.inventory.lowStockThreshold, 0, MAX_STOCK_QTY),
    newBadgeDays: intSetting(raw['catalog.newBadgeDays'], defaultSettings.catalog.newBadgeDays, 0, 3650),
  }
}

/** Yerel (API'siz) mod: ayarlar siteSettings'ten. */
export function localInventoryConfig(): InventoryConfig {
  return {
    lowStockThreshold: intSetting(siteSettings.inventory.lowStockThreshold, defaultSettings.inventory.lowStockThreshold, 0, MAX_STOCK_QTY),
    newBadgeDays: intSetting(siteSettings.catalog.newBadgeDays, defaultSettings.catalog.newBadgeDays, 0, 3650),
  }
}

/** Yerel (API'siz) mod için `GET /admin/inventory` ile aynı şekilde özet. */
export function summarizeInventory(products: Product[], threshold: number): AdminInventory {
  let lowStockCount = 0
  let outOfStockCount = 0
  let totalUnits = 0
  const rows = products.map((p) => {
    const lowStockVariants: AdminInventory['products'][number]['lowStockVariants'] = []
    let total = 0
    let outOfStockVariants = 0
    for (const c of p.colors) {
      for (const size of p.sizes) {
        const qty = p.stock[c.id]?.[size] ?? 0
        total += qty
        const level = stockLevel(qty, threshold)
        if (level === 'out') outOfStockVariants++
        else if (level === 'low') lowStockVariants.push({ productId: p.id, colorId: c.id, colorLabel: c.label, size, qty })
      }
    }
    lowStockCount += lowStockVariants.length
    outOfStockCount += outOfStockVariants
    totalUnits += total
    return {
      productId: p.id,
      number: p.number,
      name: p.name,
      hidden: !!p.hidden,
      totalStock: total,
      variantCount: p.colors.length * p.sizes.length,
      outOfStockVariants,
      lowStockVariants,
    }
  })
  return { threshold, totalUnits, lowStockCount, outOfStockCount, products: rows }
}
