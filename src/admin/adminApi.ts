/**
 * YÖNETİCİ PANELİ — API İSTEMCİSİ
 * Backend API'ye ulaşılabiliyorsa (`remote !== null`, bkz. src/data/remote.ts) panel sayfaları bu
 * modülü kullanarak doğrudan sunucudan okur/yazar. API'ye ulaşılamıyorsa (yalnızca yerel geliştirme)
 * sayfalar `adminStore.ts`'teki localStorage tabanlı eski davranışa düşer — bkz. her sayfadaki
 * `remote ? ... : ...` dallanması.
 */
import { isApiMode } from '../data/remote'
import type { CategoryId, MediaKind, Product, SizeId } from '../data/types'
import { api } from '../services/api'
import type { ApiOrder } from '../services/ordersApi'

/**
 * Panel için API/yerel mod anahtarı (bkz. src/data/remote.ts → isApiMode). Yalnızca yerel
 * geliştirmede API kapalıyken false olur; bu durumda sayfalar adminStore.ts'teki eski localStorage
 * davranışına düşer (bkz. her sayfadaki `useApiMode ? ... : ...` dallanması).
 */
export const useApiMode: boolean = isApiMode()

/* ---------------- Ürünler ---------------- */

export type AdminProductPatch = Partial<{
  name: string
  price: number
  category: Exclude<CategoryId, 'tum-urunler' | 'yeni-gelenler'>
  isNew: boolean
  hidden: boolean
  colors: { id: string; label: string }[]
  stock: Record<string, Partial<Record<SizeId, number>>>
  description: string | null
  fabricCare: string | null
  deliveryReturns: string | null
  similarProductIds: string[]
  completeLookProductIds: string[]
  media: Partial<Record<MediaKind, string>>
}>

export async function listAdminProducts(): Promise<Product[]> {
  const res = await api<{ products: Product[] }>('/admin/products')
  return res.products
}

export async function updateAdminProduct(id: string, patch: AdminProductPatch): Promise<Product> {
  const res = await api<{ product: Product }>(`/admin/products/${encodeURIComponent(id)}`, { method: 'PUT', body: patch })
  return res.product
}

export interface AdminProductCreateInput {
  name?: string
  category: Exclude<CategoryId, 'tum-urunler' | 'yeni-gelenler'>
  price: number
  isNew?: boolean
  hidden?: boolean
  colors?: { id: string; label: string }[]
  stock?: Record<string, Partial<Record<SizeId, number>>>
  description?: string
  fabricCare?: string
  deliveryReturns?: string
}

export async function createAdminProduct(data: AdminProductCreateInput): Promise<Product> {
  const res = await api<{ product: Product }>('/admin/products', { method: 'POST', body: data })
  return res.product
}

/* ---------------- İçerik + marka görselleri ---------------- */

export interface AdminContent {
  fields: Record<string, string | null>
  brandMedia: Record<string, string | null>
}

export async function getAdminContent(): Promise<AdminContent> {
  return api<AdminContent>('/admin/content')
}

export async function updateAdminContentFields(patch: Record<string, string | null>): Promise<Record<string, string | null>> {
  const res = await api<{ fields: Record<string, string | null> }>('/admin/content', { method: 'PUT', body: patch })
  return res.fields
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
    products: Product[]
    content: { fields: Record<string, string | null>; brandMedia: Record<string, string | null> }
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
