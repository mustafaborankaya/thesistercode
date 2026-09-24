/**
 * KATALOG VERİSİ
 * `remote.products` doluysa (backend API'ye ulaşıldıysa) katalog doğrudan API'den kurulur — DB gerçek
 * kaynaktır. API'ye ulaşılamazsa (yerel geliştirme, kesinti) aşağıdaki DEMO tohum veriye düşülür; ürün
 * adları, renkler, fiyatlar ve stoklar bu durumda gerçek marka verisi değildir.
 * Yönetici panelinin localStorage override katmanı (readAdminData) yalnızca remote YOKKEN uygulanır;
 * remote varken panel doğrudan API'ye yazar (bkz. src/admin/adminApi.ts).
 */

import { readAdminData, type ProductOverride } from '../admin/adminStore'
import { S } from '../i18n'
import { mediaByName, resolveProductMedia } from './media'
import { remote } from './remote'
import type { Category, ColorOption, MediaKind, MediaSlotData, Product, SizeId } from './types'

/** Yönetici panelinden gelen ürün override'ları (localStorage) — yalnızca remote yokken uygulanır. */
const productOverrides: Record<string, ProductOverride> = remote ? {} : readAdminData().products

export const categories: Category[] = [
  { id: 'tum-urunler', label: S.data.categories['tum-urunler'], virtual: 'all' },
  { id: 'yeni-gelenler', label: S.data.categories['yeni-gelenler'], virtual: 'new' },
  { id: 'elbiseler', label: S.data.categories.elbiseler },
  { id: 'ust-giyim', label: S.data.categories['ust-giyim'] },
  { id: 'alt-giyim', label: S.data.categories['alt-giyim'] },
  { id: 'takimlar', label: S.data.categories.takimlar },
  { id: 'dis-giyim', label: S.data.categories['dis-giyim'] },
]

export const allSizes: SizeId[] = ['XS', 'S', 'M', 'L', 'XL']

/** Demo/API renk seçenekleri — gerçek renk adları kesinleşince (API'den) güncellenir. */
export const colorOptions: ColorOption[] = [
  { id: 'renk-1', label: S.data.colorLabel(1) },
  { id: 'renk-2', label: S.data.colorLabel(2) },
  { id: 'renk-3', label: S.data.colorLabel(3) },
]

const colorById = Object.fromEntries(colorOptions.map((c) => [c.id, c]))

const mediaKinds: MediaKind[] = ['front', 'back', 'model', 'fabric']

function mediaSlotLabel(number: string, kind: MediaKind): string {
  return S.data.productMediaLabel(number, S.data.media[kind])
}

/* ---------------- Yer tutucu desenleri (yalnızca API/demo yer tutucusu eşleşirse yerelleştirilir; gerçek marka metni olduğu gibi kalır) ---------------- */

const PRODUCT_NAME_PLACEHOLDER_RE = /^Ürün (\d+) — Ürün adı$/
const COLOR_LABEL_PLACEHOLDER_RE = /^Renk (\d+)$/
const DESCRIPTION_PLACEHOLDER_RE = /^Ürün (\d+) — Ürün açıklaması alanı$/
const FABRIC_CARE_PLACEHOLDER_RE = /^Ürün (\d+) — Kumaş ve bakım bilgisi alanı$/
const DELIVERY_RETURNS_PLACEHOLDER = 'Teslimat ve iade bilgisi alanı'

function localizeProductName(name: string, number: string): string {
  return PRODUCT_NAME_PLACEHOLDER_RE.test(name) ? S.data.productName(number) : name
}

function localizeColorLabel(label: string): string {
  const m = COLOR_LABEL_PLACEHOLDER_RE.exec(label)
  return m ? S.data.colorLabel(Number(m[1])) : label
}

function localizeDescription(text: string, number: string): string {
  return DESCRIPTION_PLACEHOLDER_RE.test(text) ? S.data.productContent.description(number) : text
}

function localizeFabricCare(text: string, number: string): string {
  return FABRIC_CARE_PLACEHOLDER_RE.test(text) ? S.data.productContent.fabricCare(number) : text
}

function localizeDeliveryReturns(text: string): string {
  return text === DELIVERY_RETURNS_PLACEHOLDER ? S.data.productContent.deliveryReturns : text
}

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
  const colorCount = colorIds.length
  return {
    id,
    number,
    slug: id,
    name: o.name?.trim() || S.data.productName(number),
    category: o.category ?? seed.category,
    isNew: o.isNew ?? seed.isNew ?? false,
    price: typeof o.price === 'number' && o.price >= 0 ? o.price : seed.price,
    colors: colorIds.map((cid) => colorById[cid]),
    sizes: allSizes,
    stock,
    // Gerçek fotoğraf: yönetici panelinden yüklenen görsel > src/assets/media/urun-XX-on.jpg > etiketli alan.
    media: mediaKinds.map((kind) => ({
      kind,
      label: mediaSlotLabel(number, kind),
      src: o.media?.[kind] ? (mediaByName(o.media[kind]!) ?? o.media[kind]!) : resolveProductMedia(number, kind),
    })),
    content: {
      description: o.description?.trim() || S.data.productContent.description(number),
      fabricCare: o.fabricCare?.trim() || S.data.productContent.fabricCare(number),
      deliveryReturns: o.deliveryReturns?.trim() || S.data.productContent.deliveryReturns,
    },
    colorNote: colorCount > 1 ? S.data.colorNote(colorCount) : undefined,
    similarProductIds: o.similarProductIds ?? seed.similarProductIds,
    completeLookProductIds: o.completeLookProductIds ?? seed.completeLookProductIds,
    hidden: o.hidden ?? false,
  }
}

/** API'den gelen ürünü mağaza şekline dönüştürür: yer tutucu desenleri yerelleştirir, görselleri tamamlar. */
function buildProductFromRemote(row: Product): Product {
  const colors = row.colors.map((c) => ({ id: c.id, label: localizeColorLabel(c.label) }))
  const media: MediaSlotData[] = row.media.map((m) => ({
    kind: m.kind,
    // API etiketleri her zaman Türkçe üretilir (bkz. api/src/services/products.js) — burada yeniden üretilir.
    label: mediaSlotLabel(row.number, m.kind),
    src: m.src ?? resolveProductMedia(row.number, m.kind),
  }))
  return {
    ...row,
    name: localizeProductName(row.name, row.number),
    colors,
    media,
    content: {
      description: localizeDescription(row.content.description, row.number),
      fabricCare: localizeFabricCare(row.content.fabricCare, row.number),
      deliveryReturns: localizeDeliveryReturns(row.content.deliveryReturns),
    },
    colorNote: colors.length > 1 ? S.data.colorNote(colors.length) : undefined,
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

/** Gizlenmiş ürünler dahil tüm katalog — yönetici paneli için. API varsa doğrudan API'den, yoksa demo tohumdan. */
export const allProducts: Product[] = remote ? remote.products.map(buildProductFromRemote) : seeds.map(buildProduct)

/** Mağazada görünen ürünler (yönetici panelinden gizlenenler hariç). */
export const products: Product[] = allProducts.filter((p) => !p.hidden)

export const productById: Record<string, Product> = Object.fromEntries(products.map((p) => [p.id, p]))
export const productBySlug: Record<string, Product> = Object.fromEntries(products.map((p) => [p.slug, p]))

/** Kaynak katalogdaki (override'sız) değerler — yalnızca remote yokken panelde "varsayılana dön" için anlamlı. */
export const baseSeeds = seeds.map((s) => ({ id: `urun-${String(s.n).padStart(2, '0')}`, ...s }))

/** Fiyat aralığı — filtre kaydırıcılarının sınırları için. */
export const priceBounds = {
  min: products.length ? Math.min(...products.map((p) => p.price)) : 0,
  max: products.length ? Math.max(...products.map((p) => p.price)) : 0,
}
