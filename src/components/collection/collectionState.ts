/**
 * Koleksiyon URL durumu.
 * Filtre, sıralama ve gösterilen ürün adedi URL search param'larında tutulur; böylece ürün
 * detayından geri dönüldüğünde durum korunur ve bağlantı paylaşılabilir kalır.
 *
 * Param şeması:
 *   beden=S,M            → CollectionFilters.sizes
 *   renk=renk-1,renk-2   → CollectionFilters.colors
 *   kategori=elbiseler   → CollectionFilters.categories (yalnızca tüm-ürünler/yeni-gelenler görünümünde kullanılır)
 *   min= / max=          → CollectionFilters.priceMin / priceMax
 *   sirala=artan-fiyat   → SortId ("onerilen" varsayılan olduğundan hiç yazılmaz)
 *   goster=24            → gösterilen ürün adedi (settings.catalog.pageSize varsayılan olduğundan hiç yazılmaz)
 *
 * Kaydırma konumu: sessionStorage'da tek bir slotta (storageKeys.collectionState) tutulur;
 * CollectionView bileşenden ayrılırken (ör. ürün sayfasına geçerken) konumunu buraya yazar,
 * geri dönüşte (POP gezinme) anahtar eşleşirse konum geri yüklenir.
 */
import { siteSettings } from '../../config/settings'
import { allSizes, categories, colorOptions } from '../../data/catalog'
import type { CategoryId, CollectionFilters, SizeId, SortId } from '../../data/types'
import { readJSON, storageKeys, writeJSON } from '../../lib/storage'

const KEYS = {
  size: 'beden',
  color: 'renk',
  category: 'kategori',
  priceMin: 'min',
  priceMax: 'max',
  sort: 'sirala',
  shown: 'goster',
} as const

const SORT_IDS: SortId[] = ['onerilen', 'en-yeniler', 'artan-fiyat', 'azalan-fiyat']

function splitParam(value: string | null): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function setOrDelete(params: URLSearchParams, key: string, value: string): void {
  if (value) params.set(key, value)
  else params.delete(key)
}

export function filtersFromSearchParams(params: URLSearchParams): CollectionFilters {
  const validSizes = new Set<string>(allSizes)
  const validColors = new Set(colorOptions.map((c) => c.id))
  const validCategories = new Set<string>(categories.filter((c) => !c.virtual).map((c) => c.id))

  const sizes = splitParam(params.get(KEYS.size)).filter((s): s is SizeId => validSizes.has(s))
  const colors = splitParam(params.get(KEYS.color)).filter((c) => validColors.has(c))
  const filterCategories = splitParam(params.get(KEYS.category)).filter((c): c is CategoryId => validCategories.has(c))

  const minRaw = params.get(KEYS.priceMin)
  const maxRaw = params.get(KEYS.priceMax)
  const priceMin = minRaw && !Number.isNaN(Number(minRaw)) ? Number(minRaw) : null
  const priceMax = maxRaw && !Number.isNaN(Number(maxRaw)) ? Number(maxRaw) : null

  return { sizes, colors, categories: filterCategories, priceMin, priceMax }
}

export function sortFromSearchParams(params: URLSearchParams): SortId {
  const raw = params.get(KEYS.sort)
  return raw && (SORT_IDS as string[]).includes(raw) ? (raw as SortId) : 'onerilen'
}

export function shownFromSearchParams(params: URLSearchParams): number {
  const raw = params.get(KEYS.shown)
  const n = raw ? Number.parseInt(raw, 10) : NaN
  return Number.isFinite(n) && n > 0 ? n : siteSettings.catalog.pageSize
}

/** Filtreleri URL'ye yazar. Gösterilen adet, filtre değişince ilk sayfaya döner. */
export function writeFiltersToParams(params: URLSearchParams, filters: CollectionFilters): URLSearchParams {
  const next = new URLSearchParams(params)
  setOrDelete(next, KEYS.size, filters.sizes.join(','))
  setOrDelete(next, KEYS.color, filters.colors.join(','))
  setOrDelete(next, KEYS.category, filters.categories.join(','))
  setOrDelete(next, KEYS.priceMin, filters.priceMin != null ? String(filters.priceMin) : '')
  setOrDelete(next, KEYS.priceMax, filters.priceMax != null ? String(filters.priceMax) : '')
  next.delete(KEYS.shown)
  return next
}

/** Sıralamayı URL'ye yazar. Gösterilen adet, sıralama değişince ilk sayfaya döner. */
export function writeSortToParams(params: URLSearchParams, sort: SortId): URLSearchParams {
  const next = new URLSearchParams(params)
  if (sort === 'onerilen') next.delete(KEYS.sort)
  else next.set(KEYS.sort, sort)
  next.delete(KEYS.shown)
  return next
}

export function writeShownToParams(params: URLSearchParams, shown: number): URLSearchParams {
  const next = new URLSearchParams(params)
  if (shown <= siteSettings.catalog.pageSize) next.delete(KEYS.shown)
  else next.set(KEYS.shown, String(shown))
  return next
}

/* ---- Kaydırma konumu ---- */

interface StoredScrollState {
  key: string
  y: number
}

export function saveScrollPosition(key: string, y: number): void {
  writeJSON(storageKeys.collectionState, { key, y } satisfies StoredScrollState, 'session')
}

export function readScrollPosition(key: string): number | null {
  const state = readJSON<StoredScrollState | null>(storageKeys.collectionState, null, 'session')
  return state && state.key === key ? state.y : null
}
