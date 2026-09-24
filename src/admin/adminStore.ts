/**
 * YÖNETİCİ PANELİ VERİ KATMANI (demo)
 *
 * Panelde yapılan değişiklikler gerçek bir sunucuya gitmez; tarayıcıda saklanır:
 *   - metin/sayı override'ları → localStorage `tsc.admin.v1`
 *   - yüklenen görseller → IndexedDB `tsc-media` (Blob), uygulama açılışında object URL'e çevrilir
 * Mağaza katmanı (catalog.ts, settings.ts, content.ts, media.ts) bu override'ları modül yüklenirken
 * uygular; bu yüzden main.tsx önce `hydrateAdminData()` bekler, sonra uygulamayı yükler.
 * Gerçek servis bağlanınca bu katman bir API istemcisiyle değiştirilir (bkz. exportAdminJson).
 */

import type { CategoryId, MediaKind, SizeId } from '../data/types'
import { readJSON, removeKey, writeJSON } from '../lib/storage'

export const ADMIN_KEY = 'tsc.admin.v1'
export const ADMIN_SESSION_KEY = 'tsc.admin.session.v1'
const DB_NAME = 'tsc-media'
const DB_STORE = 'blobs'

/** Ürün bazlı override; tanımsız alanlar demo katalogdaki değeri korur. */
export interface ProductOverride {
  name?: string
  /** İngilizce ad/açıklama/kumaş-bakım — yalnızca `/en` sitesinde kullanılır; boşsa Türkçeye düşülür. */
  nameEn?: string
  descriptionEn?: string
  fabricCareEn?: string
  price?: number
  category?: Exclude<CategoryId, 'tum-urunler' | 'yeni-gelenler'>
  isNew?: boolean
  /** Renk kimlikleri (renk-1 | renk-2 | renk-3); boş bırakılırsa katalogdaki. */
  colors?: string[]
  /** stok[colorId][size]; verilen hücreler katalogdakini ezer. */
  stock?: Record<string, Partial<Record<SizeId, number>>>
  similarProductIds?: string[]
  completeLookProductIds?: string[]
  /** Mağazada gizle. */
  hidden?: boolean
  description?: string
  fabricCare?: string
  deliveryReturns?: string
  /** Görsel override: değer, IndexedDB blob anahtarı (media adı) ya da harici URL. */
  media?: Partial<Record<MediaKind, string>>
}

export interface ContentOverrides {
  /** brandContent alan adı → metin (companyName, address, phone, email, workingHours, collectionTitle, collectionIntro) */
  brand?: Record<string, string>
  /** infoPages slug → bölüm metinleri (indeks sırasıyla) */
  infoPages?: Record<string, (string | null)[]>
  cookieText?: string
  cookieCategories?: Record<string, string>
  production?: { intro?: string; steps?: Record<string, { title?: string; text?: string }> }
  sizeGuide?: { table?: string; note?: string }
  /**
   * İngilizce değerler — API alan anahtarlarıyla düz sözlük (örn. "cookie.bannerText", "info.sss.0").
   * Yalnızca `/en` sitesinde kullanılır; boşsa İngilizce varsayılan metne, o da yoksa Türkçeye düşülür.
   */
  en?: Record<string, string>
}

export interface SettingsOverrides {
  brand?: { name?: string; shortName?: string }
  memberDiscount?: { enabled?: boolean; percent?: number; mode?: 'automatic' | 'code'; code?: string | null; minSubtotal?: number | null; usageLimit?: number | null; expiresAt?: string | null }
  shipping?: { amount?: number | null }
  support?: { whatsappNumber?: string | null; email?: string | null }
  social?: { instagram?: string | null; tiktok?: string | null; pinterest?: string | null }
  offerPanel?: { delayAfterConsentMs?: number }
  /** Stok takibi — düşük stok eşiği (bkz. src/admin/inventory.ts). */
  inventory?: { lowStockThreshold?: number }
  /** "Yeni" rozeti otomatik kural gün sayısı. */
  catalog?: { newBadgeDays?: number }
  /** Marka görselleri (acilis-masaustu, acilis-mobil, koleksiyon, giris, logo, uretim-*) → blob anahtarı ya da URL */
  media?: Record<string, string>
}

export interface AdminData {
  version: 1
  updatedAt: string | null
  products: Record<string, ProductOverride>
  content: ContentOverrides
  settings: SettingsOverrides
}

export const emptyAdminData: AdminData = { version: 1, updatedAt: null, products: {}, content: {}, settings: {} }

let cache: AdminData | null = null

export function readAdminData(): AdminData {
  if (cache) return cache
  const stored = readJSON<Partial<AdminData>>(ADMIN_KEY, emptyAdminData)
  cache = { ...emptyAdminData, ...stored, products: stored.products ?? {}, content: stored.content ?? {}, settings: stored.settings ?? {} }
  return cache
}

export function writeAdminData(data: AdminData): AdminData {
  const next = { ...data, version: 1 as const, updatedAt: new Date().toISOString() }
  cache = next
  writeJSON(ADMIN_KEY, next)
  return next
}

export function updateAdminData(patch: (current: AdminData) => AdminData): AdminData {
  return writeAdminData(patch(readAdminData()))
}

export function resetAdminData(): void {
  cache = null
  removeKey(ADMIN_KEY)
}

/* ---------------- Görsel blob deposu (IndexedDB) ---------------- */

/** Uygulama açılışında doldurulur: media adı → object URL. media.ts bunu dosya sisteminden önce kontrol eder. */
export const mediaOverrideUrls: Record<string, string> = {}

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise((resolve) => {
        if (!db) return resolve(null)
        const t = db.transaction(DB_STORE, mode)
        const req = run(t.objectStore(DB_STORE))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => resolve(null)
      }),
  )
}

export async function putMediaBlob(name: string, blob: Blob): Promise<void> {
  await tx('readwrite', (s) => s.put(blob, name))
  if (mediaOverrideUrls[name]) URL.revokeObjectURL(mediaOverrideUrls[name])
  mediaOverrideUrls[name] = URL.createObjectURL(blob)
}

export async function deleteMediaBlob(name: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(name))
  if (mediaOverrideUrls[name]) {
    URL.revokeObjectURL(mediaOverrideUrls[name])
    delete mediaOverrideUrls[name]
  }
}

export async function listMediaBlobNames(): Promise<string[]> {
  const keys = await tx<IDBValidKey[]>('readonly', (s) => s.getAllKeys())
  return (keys ?? []).map(String)
}

async function getMediaBlob(name: string): Promise<Blob | null> {
  return (await tx<Blob>('readonly', (s) => s.get(name))) ?? null
}

/** main.tsx tarafından uygulama yüklenmeden önce çağrılır. */
export async function hydrateAdminData(): Promise<void> {
  readAdminData()
  const names = await listMediaBlobNames()
  for (const name of names) {
    const blob = await getMediaBlob(name)
    if (blob) mediaOverrideUrls[name] = URL.createObjectURL(blob)
  }
}

/* ---------------- Dışa / içe aktarma ---------------- */

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl)
  return res.blob()
}

export interface AdminExport {
  format: 'the-sister-code-admin'
  version: 1
  exportedAt: string
  data: AdminData
  /** media adı → data URL */
  media: Record<string, string>
}

export async function exportAdminJson(): Promise<string> {
  const media: Record<string, string> = {}
  for (const name of await listMediaBlobNames()) {
    const blob = await getMediaBlob(name)
    if (blob) media[name] = await blobToDataUrl(blob)
  }
  const payload: AdminExport = { format: 'the-sister-code-admin', version: 1, exportedAt: new Date().toISOString(), data: readAdminData(), media }
  return JSON.stringify(payload, null, 2)
}

export async function importAdminJson(json: string): Promise<{ ok: true; mediaCount: number } | { ok: false; error: string }> {
  let parsed: AdminExport
  try {
    parsed = JSON.parse(json)
  } catch {
    return { ok: false, error: 'Geçersiz JSON' }
  }
  if (parsed?.format !== 'the-sister-code-admin' || !parsed.data) return { ok: false, error: 'Dosya bu panelin dışa aktarma biçiminde değil' }
  writeAdminData({ ...emptyAdminData, ...parsed.data })
  let mediaCount = 0
  for (const [name, dataUrl] of Object.entries(parsed.media ?? {})) {
    try {
      await putMediaBlob(name, await dataUrlToBlob(dataUrl))
      mediaCount += 1
    } catch {
      /* bozuk görsel atlanır */
    }
  }
  return { ok: true, mediaCount }
}

/** Panel oturumu (demo yetkilendirme — gerçek güvenlik sağlamaz). */
export function isAdminSession(): boolean {
  return readJSON<boolean>(ADMIN_SESSION_KEY, false, 'session')
}
export function setAdminSession(on: boolean): void {
  if (on) writeJSON(ADMIN_SESSION_KEY, true, 'session')
  else removeKey(ADMIN_SESSION_KEY, 'session')
}
