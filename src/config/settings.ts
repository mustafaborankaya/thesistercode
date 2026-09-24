/**
 * Merkezi site ayarları.
 * Dil, para birimi, kampanya, kargo ve destek ayarları buradan yönetilir. Yönetici panelinden yapılan
 * değişiklikler (src/admin/adminStore.ts) modül yüklenirken bu varsayılanların üzerine uygulanır.
 * Gerçek servis bilgileri (WhatsApp numarası, kargo ücreti vb.) tanımlanmadıkça
 * uygulama bunları "tanımlanacak" olarak gösterir; uydurma değer kullanmaz.
 */

import { readAdminData } from '../admin/adminStore'
import { remote } from '../data/remote'

export const defaultSettings = {
  brand: {
    name: 'Teshvikiye',
    shortName: 'Teshvikiye',
    /** Logo dosyası sağlanınca yolu buraya yazılır; boşken metin wordmark gösterilir. */
    logoSrc: null as string | null,
  },

  locale: {
    /** Arayüz dili — metinler src/i18n altından gelir. */
    language: 'tr' as const,
    /** Intl biçimlendirme yereli. */
    intlLocale: 'tr-TR',
  },

  currency: {
    code: 'TRY',
    /** Fiyat yanında gösterilecek işaret; referans mağazalarda "TL" son eki kullanılıyor. */
    symbol: 'TL',
    position: 'suffix' as 'prefix' | 'suffix',
    decimals: 2,
  },

  /** Kargo ücreti henüz tanımlanmadı; null iken ücretsiz gibi hesaplanmaz, "tanımlanacak" gösterilir. */
  shipping: {
    amount: null as number | null,
  },

  /**
   * Hesap oluşturana İLK SİPARİŞTE %10 indirim kampanyası.
   * Demo varsayımı: kampanya sepet ara toplamına otomatik uygulanır; minimum sepet, son kullanım
   * tarihi ve kullanım sınırı tanımlı değildir (null). Bu değerler marka tarafından kesinleşince
   * burada veya yönetici panelinden güncellenir. Hak kuralı sunucudadır (api/src/services/orders.js);
   * mağaza yalnızca `GET /account/me` → `discountEligible`'ı gösterir.
   */
  memberDiscount: {
    enabled: true,
    percent: 10,
    /** 'automatic' → hesap açınca sepete kendiliğinden uygulanır; 'code' → kullanıcı kodu girer. */
    mode: 'automatic' as 'automatic' | 'code',
    code: null as string | null,
    minSubtotal: null as number | null,
    usageLimit: null as number | null,
    expiresAt: null as string | null,
    /** true → yalnızca üyenin ilk (iptal edilmemiş) siparişine uygulanır; false → her siparişte. */
    firstOrderOnly: true as boolean,
  },

  support: {
    /** Gerçek numara tanımlanınca uluslararası biçimde yazılır (örn. "9053..."); null iken "eklenecek" gösterilir. */
    whatsappNumber: null as string | null,
    email: null as string | null,
  },

  /** İndirim teklifi paneli zamanlaması (ms). Çerez kararı verildikten sonra bekleme süresi. */
  offerPanel: {
    delayAfterConsentMs: 6000,
    /** Kullanıcı bir form alanındayken erteleme süresi. */
    retryMs: 8000,
  },

  catalog: {
    /** Listeleme başına gösterilecek ürün sayısı ("Daha Fazla Göster" adımı). */
    pageSize: 12,
    /** Ürün görsel alanı başlangıç oranı. */
    mediaRatio: '3 / 4',
    /** "Yeni" rozeti otomatik kuralı: ürün oluşturulduktan sonraki gün sayısı (API hesaplar; bkz. api/README.md "Stok takibi"). */
    newBadgeDays: 30,
  },

  /**
   * Stok takibi. Eşik yalnızca yönetici ayarıdır (`GET /admin/settings`, public /settings'e girmez);
   * mağaza "Son N adet" notu için bu varsayılanı kullanır. Kural: 0 tükendi, 1..eşik düşük stok.
   */
  inventory: {
    lowStockThreshold: 3,
  },

  /** Sosyal hesaplar henüz yok; null iken alan adıyla yer tutucu gösterilir. */
  social: {
    instagram: null as string | null,
    tiktok: null as string | null,
    pinterest: null as string | null,
  },

  /**
   * Çevrim içi ödeme. Sağlayıcı sunucunun ortam değişkeninden (PAYMENT_PROVIDER) gelir ve `GET /settings`
   * ile yansıtılır: 'none' → demo/tahsilatsız akış; 'iyzico' (ya da yerel test için 'fake') → iyzico güvenli
   * ödeme sayfasına yönlendirme. Taksitler yalnızca bilgi notu içindir; asıl seçenekleri iyzico sayfası sunar.
   */
  payment: {
    provider: 'none' as 'none' | 'iyzico' | 'fake',
    installments: [1] as number[],
  },

  /** Kurulacak gerçek servisler bağlanana kadar demo modu açık kalır. */
  demo: {
    enabled: true,
  },

} as const

type Widen<T> = T extends string ? string : T extends number ? number : T extends boolean ? boolean : T extends null ? null : { -readonly [K in keyof T]: Widen<T[K]> }

export type SiteSettings = Widen<typeof defaultSettings>

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Yalnızca tanımlı (undefined olmayan) override alanlarını derinlemesine uygular. */
export function mergeSettings<T>(base: T, patch: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(patch)) return (patch === undefined ? base : (patch as T))
  const out: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue
    out[key] = isPlainObject(value) && isPlainObject(out[key]) ? mergeSettings(out[key], value) : value
  }
  return out as T
}

/**
 * API'nin `GET /settings` yanıtı nokta ayraçlı düz anahtarlarla (`"brand.name"`, `"shipping.amount"`,
 * `"offerPanel.delayAfterConsentMs"`) ve zaten iç içe nesnelerle (`memberDiscount`, `social`) karışık
 * döner (bkz. api/src/routes/admin-settings.js → KNOWN_SETTINGS_SCHEMAS). Nokta ayraçlı anahtarları
 * `mergeSettings` ile birleştirilebilmesi için iç içe nesneye çevirir; zaten iç içe olan anahtarlar
 * (nokta içermeyen) olduğu gibi tek seviyeli bir alan olarak kalır.
 */
function unflattenSettings(flat: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split('.')
    let node = out
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]
      if (typeof node[part] !== 'object' || node[part] === null) node[part] = {}
      node = node[part] as Record<string, unknown>
    }
    node[parts[parts.length - 1]] = value
  }
  return out
}

const withLocalOverrides = mergeSettings(defaultSettings as unknown as SiteSettings, readAdminData().settings)

/** Öncelik: API (settings tablosu) > yönetici paneli override'ı (localStorage) > varsayılanlar. */
export const siteSettings: SiteSettings = remote ? mergeSettings(withLocalOverrides, unflattenSettings(remote.settings)) : withLocalOverrides
