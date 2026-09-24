/**
 * YÖNETİCİ PANELİ — API İSTEMCİSİ
 * Backend API'ye ulaşılabiliyorsa (`remote !== null`, bkz. src/data/remote.ts) panel sayfaları bu
 * modülü kullanarak doğrudan sunucudan okur/yazar. API'ye ulaşılamıyorsa (yalnızca yerel geliştirme)
 * sayfalar `adminStore.ts`'teki localStorage tabanlı eski davranışa düşer — bkz. her sayfadaki
 * `remote ? ... : ...` dallanması.
 */
import { isApiMode, type RemoteProduct } from '../data/remote'
import type { CategoryId, MediaKind, SizeId } from '../data/types'
import { api } from '../services/api'
import type { ApiOrder } from '../services/ordersApi'

/**
 * Panel için API/yerel mod anahtarı (bkz. src/data/remote.ts → isApiMode). Yalnızca yerel
 * geliştirmede API kapalıyken false olur; bu durumda sayfalar adminStore.ts'teki eski localStorage
 * davranışına düşer (bkz. her sayfadaki `useApiMode ? ... : ...` dallanması).
 */
export const useApiMode: boolean = isApiMode()

/* ---------------- Ürünler ---------------- */

/** Panelin gördüğü ürün: API ham şekli (TR alanlar + `nameEn`, `content.descriptionEn/fabricCareEn`, `colors[].labelEn`). */
export type AdminProduct = RemoteProduct

/** Renk yazımı: `labelEn` verilmezse sunucu o rengin mevcut EN etiketini korur; null temizler. */
export type AdminColorInput = { id: string; label: string; labelEn?: string | null }

export type AdminProductPatch = Partial<{
  name: string
  /** İngilizce alanlar: null ya da boş metin temizler (mağaza `/en` sitesinde Türkçeye düşer). */
  nameEn: string | null
  descriptionEn: string | null
  fabricCareEn: string | null
  price: number
  category: Exclude<CategoryId, 'tum-urunler' | 'yeni-gelenler'>
  isNew: boolean
  /** "Yeni" rozeti modu: 'on' manuel açık, 'auto' son N gün kuralı, 'off' kapalı (isNew'dan önceliklidir). */
  newBadge: NewBadgeMode
  hidden: boolean
  colors: AdminColorInput[]
  stock: Record<string, Partial<Record<SizeId, number>>>
  description: string | null
  fabricCare: string | null
  deliveryReturns: string | null
  similarProductIds: string[]
  completeLookProductIds: string[]
  media: Partial<Record<MediaKind, string>>
}>

export type NewBadgeMode = 'on' | 'auto' | 'off'

export async function listAdminProducts(): Promise<AdminProduct[]> {
  const res = await api<{ products: AdminProduct[] }>('/admin/products')
  return res.products
}

export async function updateAdminProduct(id: string, patch: AdminProductPatch): Promise<AdminProduct> {
  const res = await api<{ product: AdminProduct }>(`/admin/products/${encodeURIComponent(id)}`, { method: 'PUT', body: patch })
  return res.product
}

export interface AdminProductCreateInput {
  name?: string
  nameEn?: string | null
  descriptionEn?: string | null
  fabricCareEn?: string | null
  category: Exclude<CategoryId, 'tum-urunler' | 'yeni-gelenler'>
  price: number
  isNew?: boolean
  hidden?: boolean
  colors?: AdminColorInput[]
  stock?: Record<string, Partial<Record<SizeId, number>>>
  description?: string
  fabricCare?: string
  deliveryReturns?: string
}

export async function createAdminProduct(data: AdminProductCreateInput): Promise<AdminProduct> {
  const res = await api<{ product: AdminProduct }>('/admin/products', { method: 'POST', body: data })
  return res.product
}

/* ---------------- Stok özeti ---------------- */

/** `GET /admin/inventory` — kural: 0 tükendi, 1..threshold düşük stok (bkz. api/README.md "Stok takibi"). */
export interface AdminInventory {
  threshold: number
  totalUnits: number
  lowStockCount: number
  outOfStockCount: number
  products: {
    productId: string
    number: string
    name: string
    hidden: boolean
    totalStock: number
    variantCount: number
    outOfStockVariants: number
    lowStockVariants: { productId: string; colorId: string; colorLabel: string; size: string; qty: number }[]
  }[]
}

export async function getAdminInventory(): Promise<AdminInventory> {
  return api<AdminInventory>('/admin/inventory')
}

/* ---------------- İçerik + marka görselleri ---------------- */

export interface AdminContent {
  fields: Record<string, string | null>
  /** Yalnızca DOLU İngilizce değerler (content_fields.value_en). Eski API sürümünde boş nesne. */
  fieldsEn: Record<string, string>
  brandMedia: Record<string, string | null>
}

export async function getAdminContent(): Promise<AdminContent> {
  const res = await api<Omit<AdminContent, 'fieldsEn'> & { fieldsEn?: Record<string, string> }>('/admin/content')
  return { ...res, fieldsEn: res.fieldsEn ?? {} }
}

/**
 * TR (`patch`) ve isteğe bağlı EN (`patchEn`) alanlarını yazar. Gövde geriye uyumludur: TR anahtarları
 * düz sözlük, EN değerleri `fieldsEn` anahtarı altında (null → EN değerini temizler).
 */
export async function updateAdminContentFields(
  patch: Record<string, string | null>,
  patchEn: Record<string, string | null> = {},
): Promise<{ fields: Record<string, string | null>; fieldsEn: Record<string, string> }> {
  const body = Object.keys(patchEn).length ? { ...patch, fieldsEn: patchEn } : patch
  const res = await api<{ fields: Record<string, string | null>; fieldsEn?: Record<string, string> }>('/admin/content', { method: 'PUT', body })
  return { fields: res.fields, fieldsEn: res.fieldsEn ?? {} }
}

export async function updateAdminBrandMedia(patch: Record<string, string | null>): Promise<Record<string, string | null>> {
  const res = await api<{ brandMedia: Record<string, string | null> }>('/admin/brand-media', { method: 'PUT', body: patch })
  return res.brandMedia
}

/* ---------------- Ayarlar ---------------- */

export async function getAdminSettings(): Promise<Record<string, unknown>> {
  const res = await api<{ settings: Record<string, unknown> }>('/admin/settings')
  return res.settings
}

/**
 * `PUT /admin/settings` her anahtarın DEĞERİNİ BÜTÜNÜYLE değiştirir (kısmi birleştirme yapmaz) —
 * bu yüzden `memberDiscount` ve `social` gibi nesne değerli anahtarlar her zaman TAM olarak
 * gönderilmelidir; eksik alan sessizce kaybolur (bkz. api/src/services/settings.js).
 */
export async function updateAdminSettings(patch: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await api<{ settings: Record<string, unknown> }>('/admin/settings', { method: 'PUT', body: patch })
  return res.settings
}

/* ---------------- Yükleme ---------------- */

export async function uploadAdminMedia(file: File, name: string): Promise<{ name: string; url: string }> {
  const form = new FormData()
  // NOT: `name` alanı `file`'dan ÖNCE eklenmeli — multer alanları akış sırasına göre işler.
  form.append('name', name)
  form.append('file', file)
  return api<{ name: string; url: string }>('/admin/upload', { method: 'POST', form })
}

/* ---------------- Siparişler ---------------- */

export async function listAdminOrders(status?: string): Promise<ApiOrder[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : ''
  const res = await api<{ orders: ApiOrder[] }>(`/admin/orders${query}`)
  return res.orders
}

export async function getAdminOrder(id: string): Promise<ApiOrder> {
  const res = await api<{ order: ApiOrder }>(`/admin/orders/${encodeURIComponent(id)}`)
  return res.order
}

export async function updateAdminOrderStatus(id: string, status: string): Promise<ApiOrder> {
  const res = await api<{ order: ApiOrder }>(`/admin/orders/${encodeURIComponent(id)}`, { method: 'PATCH', body: { status } })
  return res.order
}

/** API sipariş durumları — yerel demo durumlarından (placed/preparing/...) farklıdır. */
export const ADMIN_ORDER_STATUSES = ['demo', 'new', 'paid', 'shipped', 'cancelled'] as const
export type AdminOrderStatus = (typeof ADMIN_ORDER_STATUSES)[number]

/* ---------------- Yönetici kullanıcıları ---------------- */

export interface AdminUserRow {
  id: number
  username: string
  role: 'owner' | 'editor'
  is_active: 0 | 1
  last_login_at: string | null
  created_at: string
}

export async function listAdminUsers(): Promise<AdminUserRow[]> {
  const res = await api<{ users: AdminUserRow[] }>('/admin/users')
  return res.users
}

/** Yalnızca owner çağırabilir; editor 403 alır. */
export async function createAdminUser(data: { username: string; password: string; role: 'owner' | 'editor' }): Promise<AdminUserRow> {
  const res = await api<{ user: AdminUserRow }>('/admin/users', { method: 'POST', body: data })
  return res.user
}

/** Yalnızca owner çağırabilir; editor 403 alır. */
export async function updateAdminUser(id: number, patch: Partial<{ password: string; is_active: boolean; role: 'owner' | 'editor' }>): Promise<AdminUserRow> {
  const res = await api<{ user: AdminUserRow }>(`/admin/users/${id}`, { method: 'PATCH', body: patch })
  return res.user
}

/* ---------------- Toplu dışa / içe aktarma ---------------- */

export interface AdminExportPayload {
  format: 'teshvikiye-api-export'
  version: 1
  exportedAt: string
  data: {
    products: AdminProduct[]
    content: { fields: Record<string, string | null>; fieldsEn?: Record<string, string>; brandMedia: Record<string, string | null> }
    settings: Record<string, unknown>
  }
}

export async function exportAdminData(): Promise<AdminExportPayload> {
  return api<AdminExportPayload>('/admin/export')
}

/** Yalnızca owner çağırabilir; editor 403 alır. Kapsam: ürünler + içerik + ayarlar (kullanıcı/müşteri/sipariş dahil değil). */
export async function importAdminData(payload: unknown): Promise<void> {
  await api('/admin/import', { method: 'POST', body: payload })
}
