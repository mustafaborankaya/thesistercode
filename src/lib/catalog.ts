/** Katalog filtreleme, sıralama ve arama yardımcıları — saf fonksiyonlar. */

import { categories, products } from '../data/catalog'
import type { CategoryId, CollectionFilters, Product, SizeId, SortId } from '../data/types'
import { getSimilar } from './recommendations'

export const emptyFilters: CollectionFilters = {
  sizes: [],
  colors: [],
  categories: [],
  priceMin: null,
  priceMax: null,
}

export function isCategoryId(id: string | undefined): id is CategoryId {
  return !!id && categories.some((c) => c.id === id)
}

export function productInCategory(product: Product, categoryId: CategoryId): boolean {
  if (categoryId === 'tum-urunler') return true
  if (categoryId === 'yeni-gelenler') return product.isNew
  return product.category === categoryId
}

/** Herhangi bir renkte bu beden stokta mı? */
export function hasSizeInStock(product: Product, size: SizeId): boolean {
  return product.colors.some((c) => (product.stock[c.id]?.[size] ?? 0) > 0)
}

export function hasColor(product: Product, colorId: string): boolean {
  return product.colors.some((c) => c.id === colorId)
}

export function applyFilters(list: Product[], filters: CollectionFilters): Product[] {
  return list.filter((p) => {
    if (filters.sizes.length && !filters.sizes.some((s) => hasSizeInStock(p, s))) return false
    if (filters.colors.length && !filters.colors.some((c) => hasColor(p, c))) return false
    if (filters.categories.length && !filters.categories.some((c) => productInCategory(p, c))) return false
    if (filters.priceMin != null && p.price < filters.priceMin) return false
    if (filters.priceMax != null && p.price > filters.priceMax) return false
    return true
  })
}

export function sortProducts(list: Product[], sort: SortId): Product[] {
  const arr = [...list]
  switch (sort) {
    case 'artan-fiyat':
      return arr.sort((a, b) => a.price - b.price)
    case 'azalan-fiyat':
      return arr.sort((a, b) => b.price - a.price)
    case 'en-yeniler':
      return arr.sort((a, b) => Number(b.isNew) - Number(a.isNew) || b.number.localeCompare(a.number))
    case 'onerilen':
    default:
      return arr // katalog sırası = önerilen (demo)
  }
}

export function getCollection(categoryId: CategoryId, filters: CollectionFilters, sort: SortId): Product[] {
  const base = products.filter((p) => productInCategory(p, categoryId))
  return sortProducts(applyFilters(base, filters), sort)
}

export function activeFilterCount(filters: CollectionFilters): number {
  return (
    filters.sizes.length +
    filters.colors.length +
    filters.categories.length +
    (filters.priceMin != null ? 1 : 0) +
    (filters.priceMax != null ? 1 : 0)
  )
}

function normalize(s: string): string {
  return s
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .trim()
}

/** Ürün numarası, ürün adı, kategori adı ve renk etiketine göre arama. */
export function searchProducts(query: string): Product[] {
  const q = normalize(query)
  if (!q) return []
  const tokens = q.split(/\s+/).filter(Boolean)
  return products.filter((p) => {
    const cat = categories.find((c) => c.id === p.category)
    const haystack = normalize(
      [p.number, p.name, p.slug, cat?.label ?? '', p.isNew ? 'yeni gelenler yeni' : '', ...p.colors.map((c) => c.label)].join(' '),
    )
    return tokens.every((t) => haystack.includes(t))
  })
}

/**
 * @deprecated Ürün sayfası artık src/lib/recommendations.ts içindeki getSimilar/getCompleteLook'u
 * doğrudan kullanır. Bu sarmalayıcı geriye dönük uyumluluk için tutulur ve farklı kategoriden
 * doldurma YAPMAZ (getSimilar'a delege eder).
 */
export function similarProducts(product: Product, limit = 4): Product[] {
  return getSimilar(product, limit)
}
