/**
 * DEMO KATALOG VERİSİ
 * Ürün adları, renkler, fiyatlar ve stoklar gerçek marka verisi değildir; sepet hesaplamalarını
 * ve listeleme davranışlarını denemek için hazırlanmış örneklerdir. Gerçek katalog bağlandığında
 * bu dosya yerine servis katmanı kullanılacaktır (bkz. src/services/catalog.ts).
 */

import { readAdminData, type ProductOverride } from '../admin/adminStore'
import { mediaByName, resolveProductMedia } from './media'
import type { Category, ColorOption, MediaSlotData, Product, SizeId } from './types'

/** Yönetici panelinden gelen ürün override'ları (localStorage) — modül yüklenirken uygulanır. */
const productOverrides: Record<string, ProductOverride> = readAdminData().products

export const categories: Category[] = [
  { id: 'tum-urunler', label: 'Tüm Ürünler', virtual: 'all' },
  { id: 'yeni-gelenler', label: 'Yeni Gelenler', virtual: 'new' },
  { id: 'elbiseler', label: 'Elbiseler' },
  { id: 'ust-giyim', label: 'Üst Giyim' },
  { id: 'alt-giyim', label: 'Alt Giyim' },
  { id: 'takimlar', label: 'Takımlar' },
  { id: 'dis-giyim', label: 'Dış Giyim' },
]

export const allSizes: SizeId[] = ['XS', 'S', 'M', 'L', 'XL']

/** Demo renk seçenekleri — gerçek renk adları kesinleşince güncellenir. */
export const colorOptions: ColorOption[] = [
  { id: 'renk-1', label: 'Renk 1' },
  { id: 'renk-2', label: 'Renk 2' },
  { id: 'renk-3', label: 'Renk 3' },
]

const colorById = Object.fromEntries(colorOptions.map((c) => [c.id, c]))

const mediaKinds: { kind: MediaSlotData['kind']; label: string }[] = [
  { kind: 'front', label: 'Ön görünüş fotoğrafı' },
  { kind: 'back', label: 'Arka görünüş fotoğrafı' },
  { kind: 'model', label: 'Model üzerindeki fotoğraf' },
  { kind: 'fabric', label: 'Kumaş detay fotoğrafı' },
]

interface ProductSeed {
  n: number
  category: Product['category']
  price: number
  isNew?: boolean
  colors?: string[]
  /** size → stok; belirtilmeyen bedenler varsayılan 4 adet. 0 → tükendi. */
  stock?: Partial<Record<SizeId, number>>
  /** Renk bazlı özel stok (ikinci renk için) */
  stockByColor?: Record<string, Partial<Record<SizeId, number>>>
  /** "Benzer Ürünler" — bkz. src/lib/recommendations.ts. Demo eşleştirme, gerçek stilist/müşteri verisi değildir. */
  similarProductIds?: string[]
  /** "Kombini Tamamla" — bkz. src/lib/recommendations.ts. Demo eşleştirme, gerçek stilist/müşteri verisi değildir. */
  completeLookProductIds?: string[]
}

function buildProduct(seed: ProductSeed): Product {
  const number = String(seed.n).padStart(2, '0')
  const id = `urun-${number}`
  const o = productOverrides[id] ?? {}
  const colorIds = (o.colors?.length ? o.colors : seed.colors ?? ['renk-1']).filter((c) => colorById[c])
  const stock: Product['stock'] = {}
  for (const colorId of colorIds) {
    const base: Partial<Record<SizeId, number>> = {}
    for (const size of allSizes) base[size] = 4
    Object.assign(base, seed.stock ?? {}, seed.stockByColor?.[colorId] ?? {}, o.stock?.[colorId] ?? {})
    stock[colorId] = base
  }
  return {
    id,
    number,
    slug: id,
    name: o.name?.trim() || `Ürün ${number} — Ürün adı`,
    category: o.category ?? seed.category,
    isNew: o.isNew ?? seed.isNew ?? false,
    price: typeof o.price === 'number' && o.price >= 0 ? o.price : seed.price,
    colors: colorIds.map((cid) => colorById[cid]),
    sizes: allSizes,
    stock,
    // Gerçek fotoğraf: yönetici panelinden yüklenen görsel > src/assets/media/urun-XX-on.jpg > etiketli alan.
    media: mediaKinds.map((m) => ({
      kind: m.kind,
      label: `Ürün ${number} — ${m.label}`,
      src: o.media?.[m.kind] ? (mediaByName(o.media[m.kind]!) ?? o.media[m.kind]!) : resolveProductMedia(number, m.kind),
    })),
    content: {
      description: o.description?.trim() || `Ürün ${number} — Ürün açıklaması alanı`,
      fabricCare: o.fabricCare?.trim() || `Ürün ${number} — Kumaş ve bakım bilgisi alanı`,
      deliveryReturns: o.deliveryReturns?.trim() || 'Teslimat ve iade bilgisi alanı',
    },
    colorNote: colorIds.length > 1 ? `${colorIds.length} renk seçeneği` : undefined,
    similarProductIds: o.similarProductIds ?? seed.similarProductIds,
    completeLookProductIds: o.completeLookProductIds ?? seed.completeLookProductIds,
    hidden: o.hidden ?? false,
  }
}

/**
 * "Kombini Tamamla" ve "Benzer Ürünler" ilişkileri (similarProductIds / completeLookProductIds) demo
 * amaçlıdır — gerçek stilist seçimi veya gerçek müşteri alışveriş verisi değildir. Kural: üst giyim ↔
 * alt giyim, elbise → dış giyim, takım → dış giyim/üst. bkz. src/lib/recommendations.ts.
 */
const seeds: ProductSeed[] = [
  {
    n: 1,
    category: 'elbiseler',
    price: 4250,
    isNew: true,
    colors: ['renk-1', 'renk-2'],
    stock: { XS: 0 },
    completeLookProductIds: ['urun-05'],
    similarProductIds: ['urun-09', 'urun-13', 'urun-16'],
  },
  {
    n: 2,
    category: 'ust-giyim',
    price: 1890,
    isNew: true,
    colors: ['renk-1'],
    completeLookProductIds: ['urun-08', 'urun-10'],
    similarProductIds: ['urun-07', 'urun-12', 'urun-20'],
  },
  {
    n: 3,
    category: 'alt-giyim',
    price: 2650,
    isNew: true,
    colors: ['renk-2', 'renk-3'],
    stock: { XL: 0 },
    completeLookProductIds: ['urun-02'],
    similarProductIds: ['urun-08', 'urun-14', 'urun-19'],
  },
  { n: 4, category: 'takimlar', price: 6900, isNew: true, colors: ['renk-1'], stock: { S: 1, M: 2 }, completeLookProductIds: ['urun-11'] },
  { n: 5, category: 'dis-giyim', price: 8750, isNew: true, colors: ['renk-1', 'renk-3'], similarProductIds: ['urun-11', 'urun-17', 'urun-22'] },
  { n: 6, category: 'elbiseler', price: 3480, isNew: true, colors: ['renk-3'], stock: { XS: 0, S: 0 }, completeLookProductIds: ['urun-17'] },
  {
    n: 7,
    category: 'ust-giyim',
    price: 2150,
    colors: ['renk-1', 'renk-2', 'renk-3'],
    // Zorunlu demo örneği: hem "Kombini Tamamla" hem "Benzer Ürünler" gösteren ürün.
    completeLookProductIds: ['urun-08', 'urun-10'],
    similarProductIds: ['urun-02', 'urun-12', 'urun-15'],
  },
  { n: 8, category: 'alt-giyim', price: 2990, colors: ['renk-1'], stock: { L: 0 } },
  { n: 9, category: 'elbiseler', price: 5200, colors: ['renk-2'], completeLookProductIds: ['urun-22'] },
  {
    n: 10,
    category: 'takimlar',
    price: 7400,
    colors: ['renk-1', 'renk-2'],
    stockByColor: { 'renk-2': { M: 0, L: 0 } },
    similarProductIds: ['urun-04', 'urun-18', 'urun-23'],
  },
  { n: 11, category: 'dis-giyim', price: 9900, colors: ['renk-1'], stock: { XS: 0, XL: 0 } },
  { n: 12, category: 'ust-giyim', price: 1650, isNew: true, colors: ['renk-2'] },
  { n: 13, category: 'elbiseler', price: 3950, colors: ['renk-1', 'renk-3'], stock: { XL: 1 }, completeLookProductIds: ['urun-11'] },
  { n: 14, category: 'alt-giyim', price: 2380, colors: ['renk-3'], completeLookProductIds: ['urun-12', 'urun-15'] },
  { n: 15, category: 'ust-giyim', price: 2790, colors: ['renk-1'], stock: { M: 0 } },
  { n: 16, category: 'elbiseler', price: 6150, colors: ['renk-2', 'renk-3'] },
  { n: 17, category: 'dis-giyim', price: 11200, colors: ['renk-1'], stock: { S: 2 } },
  { n: 18, category: 'takimlar', price: 5850, colors: ['renk-3'], stock: { XS: 0 }, completeLookProductIds: ['urun-05'] },
  { n: 19, category: 'alt-giyim', price: 3120, isNew: true, colors: ['renk-1', 'renk-2'] },
  { n: 20, category: 'ust-giyim', price: 1990, colors: ['renk-3'], stock: { L: 0, XL: 0 } },
  { n: 21, category: 'elbiseler', price: 4780, colors: ['renk-1'] },
  { n: 22, category: 'dis-giyim', price: 7650, colors: ['renk-2'], stock: { M: 1 } },
  { n: 23, category: 'takimlar', price: 8200, colors: ['renk-1', 'renk-3'] },
  { n: 24, category: 'alt-giyim', price: 2540, colors: ['renk-2'] },
]

/** Gizlenmiş ürünler dahil tüm katalog — yönetici paneli için. */
export const allProducts: Product[] = seeds.map(buildProduct)

/** Mağazada görünen ürünler (yönetici panelinden gizlenenler hariç). */
export const products: Product[] = allProducts.filter((p) => !p.hidden)

export const productById: Record<string, Product> = Object.fromEntries(products.map((p) => [p.id, p]))
export const productBySlug: Record<string, Product> = Object.fromEntries(products.map((p) => [p.slug, p]))

/** Kaynak katalogdaki (override'sız) değerler — panelde "varsayılana dön" için. */
export const baseSeeds = seeds.map((s) => ({ id: `urun-${String(s.n).padStart(2, '0')}`, ...s }))

/** Demo fiyat aralığı — filtre kaydırıcılarının sınırları için. */
export const priceBounds = {
  min: Math.min(...products.map((p) => p.price)),
  max: Math.max(...products.map((p) => p.price)),
}
