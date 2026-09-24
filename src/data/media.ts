/**
 * MARKA GÖRSELLERİ — otomatik bağlama
 *
 * Öncelik sırası:
 *   1. Yönetici panelinden yüklenen görsel (IndexedDB → object URL, bkz. src/admin/adminStore.ts)
 *   2. `src/assets/media/` klasöründeki dosya (ad kuralı aşağıda)
 *   3. Yoksa null → alan etiketli yer tutucu olarak kalır
 *
 *   acilis-masaustu.jpg      Ana sayfa açılış fotoğrafı (masaüstü kırpımı, ~1440×560 önerilir)
 *   acilis-mobil.jpg         Ana sayfa açılış fotoğrafı (mobil kırpımı, ~780×840 önerilir)
 *   koleksiyon.jpg           Koleksiyon tanıtım görseli (16:10)
 *   giris.jpg                Giriş/kayıt sayfası görsel alanı (3:4)
 *   logo.svg | logo.png      Header logosu
 *   uretim-video.mp4         Üretim videosu · uretim-video-kapak.jpg kapak görseli
 *   uretim-kesim.jpg         Kumaş kesim aşaması görseli (4:5)
 *   uretim-dikim.jpg         Dikim aşaması görseli (4:5)
 *   uretim-kalite.jpg        Kalite kontrol görseli (4:5)
 *   urun-01-on.jpg           Ürün 01 ön görünüş (3:4) · -arka · -model · -kumas aynı ürünün diğer görünüşleri
 *
 * Uzantılar: jpg, jpeg, png, webp, avif, svg, mp4, webm.
 * Kaynak/lisans bilgisi: src/assets/media/CREDITS.md
 */

import { mediaOverrideUrls } from '../admin/adminStore'
import { remote } from './remote'
import type { MediaKind } from './types'

const files = import.meta.glob('../assets/media/*.{jpg,jpeg,png,webp,avif,svg,mp4,webm}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

const byBaseName: Record<string, string> = {}
for (const [path, url] of Object.entries(files)) {
  const base = path.split('/').pop()!.replace(/\.[^.]+$/, '')
  byBaseName[base] = url
}

/**
 * Dosya adına göre (uzantısız) kaynak URL'si. Öncelik: API (brand_media, yalnızca marka görselleri
 * için anlamlı — ürün adları için remote sözlükte karşılık yoktur ve zincir sessizce devam eder) >
 * yönetici panel override'ı (IndexedDB → object URL) > src/assets/media/ dosyası > null.
 */
export function mediaByName(name: string): string | null {
  const fromRemote = remote?.content.brandMedia[name]
  if (fromRemote) return fromRemote
  const override = mediaOverrideUrls[name]
  if (override) return override.startsWith('blob:') || override.startsWith('http') || override.startsWith('data:') || override.startsWith('/') ? override : (byBaseName[override] ?? null)
  return byBaseName[name] ?? null
}

/** Klasördeki dosya adları — teslim notunda "hangi görseller var" bilgisi için. */
export const availableMediaNames: string[] = Object.keys(byBaseName).sort()

export const kindSuffix: Record<MediaKind, string> = { front: 'on', back: 'arka', model: 'model', fabric: 'kumas' }

/** Ürün görselinin medya adı: urun-01-on */
export function productMediaName(number: string, kind: MediaKind): string {
  return `urun-${number}-${kindSuffix[kind]}`
}

/** Ürün görseli: urun-01-on.jpg gibi dosya adından çözümlenir. */
export function resolveProductMedia(number: string, kind: MediaKind): string | null {
  return mediaByName(productMediaName(number, kind))
}

export const brandMediaNames = {
  heroDesktop: 'acilis-masaustu',
  heroMobile: 'acilis-mobil',
  collection: 'koleksiyon',
  auth: 'giris',
  logo: 'logo',
  productionVideo: 'uretim-video',
  productionVideoPoster: 'uretim-video-kapak',
  productionCutting: 'uretim-kesim',
  productionSewing: 'uretim-dikim',
  productionQuality: 'uretim-kalite',
} as const

export const brandMedia: Record<keyof typeof brandMediaNames, string | null> = Object.fromEntries(
  Object.entries(brandMediaNames).map(([key, name]) => [key, mediaByName(name)]),
) as Record<keyof typeof brandMediaNames, string | null>

/** Eksik marka görsellerinin dosya adları (teslim notu ve yönetici paneli için). */
export function missingBrandMedia(): string[] {
  return (Object.keys(brandMediaNames) as (keyof typeof brandMediaNames)[])
    .filter((key) => key !== 'productionVideoPoster' && !brandMedia[key])
    .map((key) => `${brandMediaNames[key]}.${key === 'logo' ? 'svg' : key === 'productionVideo' ? 'mp4' : 'jpg'}`)
}
