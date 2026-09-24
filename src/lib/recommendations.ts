/**
 * "Kombini Tamamla" ve "Benzer Ürünler" için saf öneri fonksiyonları.
 * Yalnızca merkezi demo katalogdaki açık ilişkileri (Product.similarProductIds /
 * Product.completeLookProductIds) kullanır — bkz. src/data/catalog.ts üstündeki not.
 * Tarayıcıya/loglara kişisel veri yazan bir öneri servisi değildir.
 */
import { productById, products } from '../data/catalog'
import type { Product } from '../data/types'

/** Ürünün tüm renk × beden kombinasyonları stoksuz mu (tamamen tükenmiş)? */
export function isFullySoldOut(product: Product): boolean {
  return product.colors.every((color) => {
    const bySize = product.stock[color.id] ?? {}
    return product.sizes.every((size) => (bySize[size] ?? 0) <= 0)
  })
}

/**
 * "Kombini Tamamla" — yalnızca açık `completeLookProductIds` kullanılır, kategori doldurma YOK.
 * Ana ürün, geçersiz id, yinelenen ve tamamen tükenmiş ürünler elenir; belirtilen sıra korunur.
 */
export function getCompleteLook(product: Product, max = 3): Product[] {
  const ids = product.completeLookProductIds ?? []
  const seen = new Set<string>()
  const out: Product[] = []

  for (const id of ids) {
    if (out.length >= max) break
    if (id === product.id || seen.has(id)) continue
    const candidate = productById[id]
    if (!candidate) continue
    if (isFullySoldOut(candidate)) continue
    seen.add(id)
    out.push(candidate)
  }

  return out
}

/**
 * "Benzer Ürünler" — önce açık `similarProductIds`, ardından aynı kategoriden katalog sırasıyla
 * deterministik doldurma. Farklı kategoriden doldurma YOK. Ana ürün, `exclude` (genelde aynı
 * ürünün "Kombini Tamamla" listesi — NOT: ProductPage her iki bölüm için de max=3 çağırır; bu
 * değer değişirse iki bölümde aynı ürünün görünmesini önleyen değişmez de güncellenmelidir),
 * geçersiz, yinelenen ve tamamen tükenmiş ürünler elenir.
 */
export function getSimilar(product: Product, max = 4, exclude: string[] = []): Product[] {
  const excludeSet = new Set(exclude)
  const seen = new Set<string>([product.id])
  const out: Product[] = []

  const tryAdd = (candidate: Product | undefined) => {
    if (!candidate || out.length >= max) return
    if (seen.has(candidate.id) || excludeSet.has(candidate.id)) return
    if (isFullySoldOut(candidate)) return
    seen.add(candidate.id)
    out.push(candidate)
  }

  for (const id of product.similarProductIds ?? []) {
    if (out.length >= max) break
    tryAdd(productById[id])
  }

  if (out.length < max) {
    for (const candidate of products) {
      if (out.length >= max) break
      if (candidate.category !== product.category) continue
      tryAdd(candidate)
    }
  }

  return out
}
