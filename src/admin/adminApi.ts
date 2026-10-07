/**
 * YÖNETİCİ PANELİ — API İSTEMCİSİ
 * Backend API'ye ulaşılabiliyorsa (`remote !== null`, bkz. src/data/remote.ts) panel sayfaları bu
 * modülü kullanarak doğrudan sunucudan okur/yazar. API'ye ulaşılamıyorsa (yalnızca yerel geliştirme)
 * sayfalar `adminStore.ts`'teki localStorage tabanlı eski davranışa düşer — bkz. her sayfadaki
 * `remote ? ... : ...` dallanması.
 */
import { isApiMode, type RemoteProduct } from '../data/remote'
import type { CategoryId, MediaKind, SizeId } from '../data/types'
import { api, ApiError } from '../services/api'
import type { ApiOrder as BaseApiOrder } from '../services/ordersApi'

/**
 * Uç nokta henüz sunucuda yok mu? (404/405/501). Yeni sözleşme uç noktaları (kupon, müşteri,
 * istatistik) eski sunucuda 404 döner — sayfalar bu durumda çökmeden "Sunucu güncellemesi bekleniyor"
 * boş durumunu gösterir. Diğer hatalar (401/403/5xx/ağ) gerçek hata olarak ele alınır.
 */
export function isUnavailable(e: unknown): boolean {
  return e instanceof ApiError && (e.status === 404 || e.status === 405 || e.status === 501)
}

/** Sipariş (panel görünümü): kargo bilgisi ve yönetici notu yeni sunucu sürümünde gelir; eski sürümde yoktur. */
export interface ApiOrder extends BaseApiOrder {
  shipping?: { carrier: string | null; trackingNumber: string | null; trackingUrl?: string | null; shippedAt: string | null } | null
  adminNote?: string | null
}

/** Sunucu bu siparişte kargo/not alanlarını destekliyor mu? (alanlar yanıtta hiç yoksa eski sürüm) */
export function orderExtrasSupported(order: ApiOrder): boolean {
  return 'shipping' in order || 'adminNote' in order
}

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
  /** Eşzamanlı düzenleme koruması: formun yüklendiği andaki `updatedAt` (değiştiyse sunucu 409 döner). */
  expectedUpdatedAt: string
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
  /** Bir yuvaya `null` göndermek o görseli kaldırır (yeni sunucu sürümü; eskisi 400 döner). */
  media: Partial<Record<MediaKind, string | null>>
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

/**
 * `DELETE /admin/products/:id` — yalnızca owner (editor 403 alır). Ürün ve renk/stok/görsel/ilişki
 * satırları kalıcı olarak silinir; geçmiş sipariş kalemleri korunur (`orderItems`: bilgi amaçlı sayı).
 */
export async function deleteAdminProduct(id: string): Promise<{ orderItems: number }> {
  const res = await api<{ ok: boolean; orderItems?: number } | null>(`/admin/products/${encodeURIComponent(id)}`, { method: 'DELETE' })
  return { orderItems: res?.orderItems ?? 0 }
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

export interface AdminOrderQuery {
  q?: string
  status?: string
  /** YYYY-MM-DD (dahil) */
  from?: string
  /** YYYY-MM-DD (dahil) */
  to?: string
  page?: number
  pageSize?: number
}

/**
 * `GET /admin/orders?q=&status=&from=&to=&page=&pageSize=` → `{ orders, total, page, pageSize }`.
 * Eski sunucu sorguyu yok sayar ve `total` göndermez — bu durumda `serverPaged: false` döner ve
 * çağıran süzme/sayfalamayı istemcide yapar (sunucunun süzdüğü varsayılmaz).
 */
export async function queryAdminOrders(query: AdminOrderQuery): Promise<{ orders: ApiOrder[]; total: number; serverPaged: boolean }> {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== '') params.set(k, String(v))
  const qs = params.toString()
  const res = await api<{ orders: ApiOrder[]; total?: number }>(`/admin/orders${qs ? `?${qs}` : ''}`)
  if (typeof res.total === 'number') return { orders: res.orders, total: res.total, serverPaged: true }
  return { orders: res.orders, total: res.orders.length, serverPaged: false }
}

export async function getAdminOrder(id: string): Promise<ApiOrder> {
  const res = await api<{ order: ApiOrder }>(`/admin/orders/${encodeURIComponent(id)}`)
  return res.order
}

export async function updateAdminOrderStatus(id: string, status: string): Promise<ApiOrder> {
  return patchAdminOrder(id, { status })
}

export interface AdminOrderPatch {
  status?: string
  carrier?: string | null
  trackingNumber?: string | null
  adminNote?: string | null
}

/**
 * `PATCH /admin/orders/:id` `{ status?, carrier?, trackingNumber?, adminNote? }` → `{ order }`.
 * Eski sunucu `status`'u zorunlu tutar ve diğer alanları sessizce atar — çağıran, yanıtta `shipping`/
 * `adminNote` alanlarının geldiğini doğrulamalıdır (bkz. orderExtrasSupported).
 */
export async function patchAdminOrder(id: string, patch: AdminOrderPatch): Promise<ApiOrder> {
  const res = await api<{ order: ApiOrder }>(`/admin/orders/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch })
  return res.order
}

/**
 * `POST /admin/orders/:id/refund` — ödemenin tamamını sağlayıcıda geri alır (aynı gün iptal, sonrasında
 * kalem bazında iade); sipariş 'cancelled' olur, stok geri yüklenir.
 */
export async function refundAdminOrder(id: string): Promise<ApiOrder> {
  const res = await api<{ order: ApiOrder }>(`/admin/orders/${encodeURIComponent(id)}/refund`, { method: 'POST' })
  return res.order
}

/**
 * API sipariş durumları — yerel demo durumlarından (placed/preparing/...) farklıdır.
 * 'pending_payment' elle seçilemez ve ödeme sağlayıcısı etkinken 'paid' yalnızca sağlayıcı sonucuyla gelir
 * (sunucu da reddeder: 409 status_not_allowed); seçici bu seçenekleri devre dışı gösterir.
 */
export const ADMIN_ORDER_STATUSES = ['demo', 'new', 'pending_payment', 'paid', 'shipped', 'cancelled'] as const
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

/* ---------------- Gösterge istatistikleri ---------------- */

export interface AdminStats {
  today: { orders: number; revenue: number }
  week: { orders: number; revenue: number }
  month: { orders: number; revenue: number }
  pendingPayment: number
  lowStock: number
  recentOrders: ApiOrder[]
}

/** `GET /admin/stats` — yoksa (404) çağıran mevcut verilerden hesaplar (bkz. pages/Dashboard.tsx). */
export async function getAdminStats(): Promise<AdminStats> {
  return api<AdminStats>('/admin/stats')
}

/* ---------------- Analitik ---------------- */

/** Rapor aralığı — `GET /admin/analytics?range=` (varsayılan 30d). */
export type AnalyticsRange = '7d' | '30d' | '90d' | '12m'

/** `previous`: aynı uzunluktaki önceki dönemin değeri (yoksa null). */
export interface AnalyticsDelta {
  value: number
  previous: number | null
}

export interface AnalyticsShare {
  key: string
  label: string
  count: number
}

/**
 * `GET /admin/analytics` yanıtı — birinci taraf olay tablosu (analytics_events) + siparişler/müşteriler.
 * Gün/saat kovaları İstanbul saatine göredir. Ziyaretçi/oturum sayıları yalnızca analitik çerez onayı
 * verenleri kapsar; sayfa görüntülemeleri herkesi. Sunucu eski sürümse 404 → `isUnavailable`.
 */
export interface AnalyticsOverview {
  range: AnalyticsRange
  /** 'YYYY-MM-DD' (İstanbul), dahil */
  from: string
  /** 'YYYY-MM-DD', dahil (bugün) */
  to: string
  days: number
  /** ISO */
  generatedAt: string
  /** since: ilk olayın ISO zamanı (hiç yoksa null); events: aralıktaki olay sayısı; consentedShare: vid'li page_view oranı 0..1 */
  tracking: { since: string | null; events: number; consentedShare: number; retentionDays: number }
  kpis: {
    /** page_view sayısı (herkes) */
    pageviews: AnalyticsDelta
    /** is_entry=1 page_view sayısı (tam sayfa yüklemesi ≈ ziyaret; herkes) */
    visits: AnalyticsDelta
    /** COUNT(DISTINCT visitor_id) (yalnızca onaylı) */
    visitors: AnalyticsDelta
    /** COUNT(DISTINCT session_id) (yalnızca onaylı) */
    sessions: AnalyticsDelta
    /** orders tablosu, status IN ('new','paid','shipped') */
    orders: AnalyticsDelta
    /** aynı siparişlerin SUM(total) */
    revenue: AnalyticsDelta
    /** orders / visits * 100 (visits 0 ise 0), yüzde, 2 ondalık */
    conversion: AnalyticsDelta
    /** ortalama sipariş tutarı */
    aov: AnalyticsDelta
  }
  /** Aralıktaki HER gün (boş günler 0). */
  series: { date: string; pageviews: number; visits: number; visitors: number; orders: number; revenue: number }[]
  /** 24 eleman, page_view (İstanbul saati) */
  hours: number[]
  /** 7 eleman, Pzt..Paz page_view */
  weekdays: number[]
  /** 7 x 24 page_view */
  heatmap: number[][]
  /** key: desktop|mobile|tablet|other, label TR, count = page_view */
  devices: AnalyticsShare[]
  /** ilk 6 + 'Diğer' */
  browsers: AnalyticsShare[]
  os: AnalyticsShare[]
  /** tr/en → 'Türkçe'/'English' */
  locales: AnalyticsShare[]
  /** entry page_view, host NULL = doğrudan; ilk 10 */
  referrers: { host: string | null; visits: number }[]
  /** utm_source dolu entry'ler; ilk 10 */
  campaigns: { source: string; medium: string | null; campaign: string | null; visits: number }[]
  /** ilk 10 (path '/' → ana sayfa; UI etiketler) */
  pages: { path: string; pageviews: number; visitors: number }[]
  /** views/addToCarts olaylardan; ordered/revenue order_items'tan; görüntülenmeye göre ilk 10; name products tablosundan (yoksa null) */
  products: { productId: string; name: string | null; views: number; addToCarts: number; ordered: number; revenue: number }[]
  /** LOWER(TRIM(query)) gruplu, ilk 15; zeroResults = meta.results = 0 olanlar */
  searches: { query: string; count: number; zeroResults: number }[]
  /** basis 'sessions': onaylı oturum varsa her adım COUNT(DISTINCT session_id); yoksa 'events' = olay sayıları */
  funnel: { basis: 'sessions' | 'events'; pageview: number; productView: number; addToCart: number; checkout: number; order: number }
  /** consent olaylarından (meta.choice) */
  consent: { decisions: number; acceptAll: number; necessaryOnly: number; custom: number; analyticsOptIn: number }
  sales: {
    /** aralıkta oluşturulan tüm siparişler (demo hariç), tüm durumlar */
    byStatus: { status: string; count: number; revenue: number }[]
    memberOrders: number
    guestOrders: number
    couponOrders: number
    /** discount_amount > 0 */
    firstOrderDiscountOrders: number
    /** orders.coupon_code, ilk 5 */
    topCoupons: { code: string; count: number; discount: number }[]
    /** ilk 8 */
    byCity: { city: string; count: number }[]
    /** 24, sipariş oluşturulma saati (İstanbul) */
    byHour: number[]
    /** orders.locale */
    byLocale: AnalyticsShare[]
  }
  /** repeatBuyers: aralıkta 2+ siparişi olan (e-posta bazlı) alıcı sayısı */
  customers: { total: number; newInRange: number; newSeries: { date: string; count: number }[]; buyersInRange: number; repeatBuyers: number }
}

/** `GET /admin/analytics?range=7d|30d|90d|12m` — eski sunucuda 404 (bkz. isUnavailable). */
export async function getAdminAnalytics(range: AnalyticsRange): Promise<AnalyticsOverview> {
  return api<AnalyticsOverview>(`/admin/analytics?range=${encodeURIComponent(range)}`)
}

/* ---------------- Kuponlar ---------------- */

export type CouponType = 'percent' | 'fixed'

export interface AdminCoupon {
  id: number
  code: string
  type: CouponType
  value: number
  minSubtotal: number | null
  usageLimit: number | null
  perCustomerLimit: number | null
  startsAt: string | null
  expiresAt: string | null
  active: boolean
  usedCount: number
  createdAt: string
}

export type AdminCouponInput = Omit<AdminCoupon, 'id' | 'usedCount' | 'createdAt'>

export async function listAdminCoupons(): Promise<AdminCoupon[]> {
  const res = await api<{ coupons: AdminCoupon[] }>('/admin/coupons')
  return res.coupons
}

export async function createAdminCoupon(data: AdminCouponInput): Promise<AdminCoupon> {
  const res = await api<{ coupon: AdminCoupon }>('/admin/coupons', { method: 'POST', body: data })
  return res.coupon
}

export async function updateAdminCoupon(id: number, patch: Partial<AdminCouponInput>): Promise<AdminCoupon> {
  const res = await api<{ coupon: AdminCoupon }>(`/admin/coupons/${id}`, { method: 'PUT', body: patch })
  return res.coupon
}

/** Kullanılmış kupon silinmez; sunucu pasifleştirir (`{ ok }`). */
export async function deleteAdminCoupon(id: number): Promise<{ deactivated: boolean }> {
  const res = await api<{ ok?: boolean; deactivated?: boolean } | null>(`/admin/coupons/${id}`, { method: 'DELETE' })
  return { deactivated: res?.deactivated === true }
}

/* ---------------- Müşteriler ---------------- */

export interface AdminCustomer {
  id: number
  name: string
  email: string
  createdAt: string
  ordersCount: number
  totalSpent: number
  discountEligible: boolean
  discountUsed: boolean
  lastOrderAt: string | null
}

/** Müşteri adresi — alan adları sunucu sürümüne göre değişebilir; panel yalnızca gösterir. */
export interface AdminCustomerAddress {
  id: number | string
  label?: string | null
  firstName?: string
  lastName?: string
  address?: string
  district?: string
  city?: string
  postalCode?: string
  country?: string
  phone?: string | null
  isDefault?: boolean
}

export async function listAdminCustomers(query: { q?: string; page?: number; pageSize?: number }): Promise<{ customers: AdminCustomer[]; total: number; serverPaged: boolean }> {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== '') params.set(k, String(v))
  const qs = params.toString()
  const res = await api<{ customers: AdminCustomer[]; total?: number }>(`/admin/customers${qs ? `?${qs}` : ''}`)
  if (typeof res.total === 'number') return { customers: res.customers, total: res.total, serverPaged: true }
  return { customers: res.customers, total: res.customers.length, serverPaged: false }
}

export async function getAdminCustomer(id: number): Promise<{ customer: AdminCustomer; orders: ApiOrder[]; addresses: AdminCustomerAddress[] }> {
  const res = await api<{ customer: AdminCustomer; orders?: ApiOrder[]; addresses?: AdminCustomerAddress[] }>(`/admin/customers/${id}`)
  return { customer: res.customer, orders: res.orders ?? [], addresses: res.addresses ?? [] }
}

export async function updateAdminCustomer(id: number, patch: { discountEligible: boolean }): Promise<AdminCustomer> {
  const res = await api<{ customer: AdminCustomer }>(`/admin/customers/${id}`, { method: 'PATCH', body: patch })
  return res.customer
}
