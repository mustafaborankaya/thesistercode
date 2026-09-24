/**
 * UZAK VERİ MODÜLÜ
 * Canlıda (`https://teshvikiye.com/api`) çalışan backend'den ürün/içerik/ayar verisini çeker.
 * API'ye ulaşılamazsa (yerel geliştirme, kesinti) `remote` null kalır ve mağaza yerel demo veriye
 * düşer (bkz. src/data/catalog.ts, content.ts, media.ts, src/config/settings.ts).
 *
 * main.tsx, uygulama ağacı içe aktarılmadan önce `loadRemoteData()`'ı bekler; bu yüzden aşağıdaki
 * modüller `remote` değişkenini modül yüklenirken (top-level) güvenle okuyabilir.
 */
import { api } from '../services/api'
import type { ColorOption, Product } from './types'

/** API renk seçeneği: TR `label` + isteğe bağlı İngilizce `labelEn` (null → Türkçeye düşülür). */
export interface RemoteColorOption extends ColorOption {
  labelEn?: string | null
}

/**
 * API ürünü (GET /products, /admin/products): mağazanın `Product` tipi + İngilizce alanlar
 * (bkz. api/migrations/005_content_locale.sql). EN alanları null/eksikse mağaza Türkçe değere düşer.
 * Eski bir API sürümü bu alanları hiç göndermeyebilir — bu yüzden hepsi opsiyoneldir.
 */
export interface RemoteProduct extends Omit<Product, 'colors' | 'content'> {
  nameEn?: string | null
  /**
   * "Yeni" rozeti (bkz. api/README.md "Stok takibi"): `isNew` sunucunun hesapladığı ETKİN rozettir
   * (manuel açık ya da otomatik kural); `newBadge` mod, `isNewManual` ham bayrak. Eski API'de yoktur.
   */
  newBadge?: 'on' | 'auto' | 'off'
  isNewManual?: boolean
  createdAt?: string | null
  colors: RemoteColorOption[]
  content: Product['content'] & { descriptionEn?: string | null; fabricCareEn?: string | null }
}

export interface RemoteContent {
  /** content_fields tablosu: anahtar → metin ya da null (henüz girilmemiş). */
  fields: Record<string, string | null>
  /** content_fields.value_en — yalnızca DOLU İngilizce değerler (eski API'de yoksa boş nesne). */
  fieldsEn: Record<string, string>
  /** brand_media tablosu: görsel adı → URL ya da null. */
  brandMedia: Record<string, string | null>
}

export interface RemoteData {
  /** GET /products?includeHidden=1 — mağazanın Product tipiyle aynı şekil (bkz. api/README.md). */
  products: RemoteProduct[]
  content: RemoteContent
  /** GET /settings — nokta ayraçlı düz anahtarlar (örn. "brand.name") ve iç içe nesneler (memberDiscount, social) karışık döner. */
  settings: Record<string, unknown>
  loadedAt: string
}

/** API'den başarıyla yüklenen veri; API yoksa/erişilemezse null. */
export let remote: RemoteData | null = null

/**
 * Hesap/sipariş katmanı için mod anahtarı: `remote` doluysa (açılışta API'ye ulaşıldıysa) YA DA
 * üretimdeyse (üretimde API zorunludur — sessiz yerel demo geri dönüşü YOK; boot sırasında `remote`
 * bir zaman aşımıyla null kalsa bile gerçek istekler denenir) true döner. Yalnızca yerel geliştirmede
 * API gerçekten kapalıyken false olur. Katalog/içerik/ayar modülleri kasıtlı olarak bunu KULLANMAZ —
 * onlar için "açılışta veri geldi mi" (`remote`) yeterli ve doğru sinyaldir; demo tohum veri gerçek
 * DB id'leriyle birebir eşleştiği ve sunucu fiyat/stoğu yeniden hesapladığı için sipariş yine geçerlidir.
 * Fonksiyon olarak tanımlanır (sabit DEĞİL) çünkü `remote` boot sırasında `loadRemoteData()` tarafından
 * ASENKRON doldurulur; bu modülün KENDİSİ ilk import edildiğinde henüz `null`dır — bir üst seviye sabit
 * bu değeri erken donduracağından yanlış olurdu. Çağıranlar bunu KENDİ üst seviyelerinde (main.tsx'in
 * `Promise.all` beklemesinden sonra, Root import zincirinde) çağırmalıdır.
 */
export function isApiMode(): boolean {
  return remote !== null || !import.meta.env.DEV
}

const TIMEOUT_MS = 4000

function withTimeout<T>(run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const ctrl = new AbortController()
  const timer = window.setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  return run(ctrl.signal).finally(() => window.clearTimeout(timer))
}

/** main.tsx tarafından uygulama ağacı yüklenmeden önce çağrılır. Hata durumunda `remote` null kalır. */
export async function loadRemoteData(): Promise<void> {
  try {
    const [productsRes, contentRes, settingsRes] = await Promise.all([
      withTimeout((signal) => api<{ products: RemoteProduct[] }>('/products?includeHidden=1', { signal })),
      withTimeout((signal) => api<Omit<RemoteContent, 'fieldsEn'> & { fieldsEn?: Record<string, string> }>('/content', { signal })),
      withTimeout((signal) => api<{ settings: Record<string, unknown> }>('/settings', { signal })),
    ])
    remote = {
      products: productsRes.products,
      content: { fields: contentRes.fields, fieldsEn: contentRes.fieldsEn ?? {}, brandMedia: contentRes.brandMedia },
      settings: settingsRes.settings,
      loadedAt: new Date().toISOString(),
    }
  } catch {
    // Ağ hatası, zaman aşımı ya da API kapalı — mağaza yerel demo veriye düşer.
    remote = null
  }
}
