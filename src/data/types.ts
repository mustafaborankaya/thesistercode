/** Katalog ve içerik veri tipleri. Demo veriler src/data/catalog.ts içindedir. */

export type CategoryId =
  | 'tum-urunler'
  | 'yeni-gelenler'
  | 'elbiseler'
  | 'ust-giyim'
  | 'alt-giyim'
  | 'takimlar'
  | 'dis-giyim'

export interface Category {
  id: CategoryId
  label: string
  /** Sanal kategoriler (tümü, yeni gelenler) ürün alanından değil kuraldan türer. */
  virtual?: 'all' | 'new'
}

export type SizeId = 'XS' | 'S' | 'M' | 'L' | 'XL'

export interface ColorOption {
  id: string
  /** Gerçek renk adı kesinleşene kadar "Renk 1" gibi demo etiketi. */
  label: string
}

export type MediaKind = 'front' | 'back' | 'model' | 'fabric'

export interface MediaSlotData {
  kind: MediaKind
  /** Alana gelecek içeriğin adı — örn. "Ürün 01 — Ön görünüş fotoğrafı". */
  label: string
  /** Gerçek görsel sağlanınca yolu; null iken etiketli alan gösterilir. */
  src: string | null
}

export interface Product {
  id: string
  /** Görünen ürün numarası, örn. "01". */
  number: string
  slug: string
  /** Kesinleşmemiş ürün adı — açıklayıcı alan adı olarak gösterilir. */
  name: string
  category: Exclude<CategoryId, 'tum-urunler' | 'yeni-gelenler'>
  isNew: boolean
  /** Demo fiyat (TL). Gerçek fiyat değildir. */
  price: number
  colors: ColorOption[]
  sizes: SizeId[]
  /** stok[colorId][size] → adet. 0 → tükendi. */
  stock: Record<string, Partial<Record<SizeId, number>>>
  media: MediaSlotData[]
  /** İçerik alanları — metinler kesinleşene kadar alan adı gösterilir. */
  content: {
    description: string
    fabricCare: string
    deliveryReturns: string
  }
  /** Öne çıkan renk bilgisi (kart üzerinde kısa bilgi). */
  colorNote?: string
  /** "Benzer Ürünler" için açık eşleştirme — bkz. src/lib/recommendations.ts. Demo veridir. */
  similarProductIds?: string[]
  /** "Kombini Tamamla" için açık eşleştirme — bkz. src/lib/recommendations.ts. Demo veridir. */
  completeLookProductIds?: string[]
  /** Yönetici panelinden gizlenmiş ürün (mağazada listelenmez). */
  hidden?: boolean
}

export interface CartLine {
  /** `${productId}:${colorId}:${size}` */
  key: string
  productId: string
  colorId: string
  size: SizeId
  qty: number
}

export interface CartTotals {
  itemCount: number
  subtotal: number
  discountPercent: number
  discountAmount: number
  /** null → kargo ücreti tanımlı değil; toplam kargo hariç hesaplanır. */
  shipping: number | null
  total: number
}

export type SortId = 'onerilen' | 'en-yeniler' | 'artan-fiyat' | 'azalan-fiyat'

export interface CollectionFilters {
  sizes: SizeId[]
  colors: string[]
  categories: CategoryId[]
  priceMin: number | null
  priceMax: number | null
}
