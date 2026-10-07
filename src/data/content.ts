/**
 * İÇERİK ALANLARI
 * Marka bilgileri, bilgi sayfaları, üretim bölümü ve çerez metni kesinleşmediği için
 * her alan, o alana gelecek içeriğin adıyla gösterilir. Gerçek metinler geldiğinde bu dosya
 * ya da yönetici paneli (src/admin/adminStore.ts → content) üzerinden doldurulur; bileşenler değişmez.
 */

import { useSyncExternalStore } from 'react'
import { readAdminData } from '../admin/adminStore'
import { S, locale } from '../i18n'
import { brandMedia } from './media'
import { remote } from './remote'
import { contentTexts, contentTextsEn, infoSectionTexts, infoSectionTextsEn } from './contentTexts'

export interface ContentField {
  /**
   * API içerik anahtarı (`brand.collectionTitle`, `info.sss.0` …) — yönetici panelinin önizlemesi alanı bununla
   * eşler; mağaza bileşenleri `data-content-key` olarak basar. Metin olmayan (logo/görsel/video) alanlarda null.
   */
  key: string | null
  /** Alanın kullanıcıya görünen adı — örn. "Şirket adresi alanı". */
  label: string
  /** Gerçek metin geldiğinde buraya yazılır; null iken alan adı gösterilir. Önizlemede taslak değer öne geçer. */
  readonly value: string | null
}

const overrides = readAdminData().content
const clean = (v: string | null | undefined): string | null => (v && v.trim() ? v : null)

/* ---------------- İçerik önizlemesi (yönetici paneli iframe'i) ---------------- */

/**
 * Panelden gelen taslak değerler: anahtar → metin ya da null (alan boşaltıldı → yer tutucu görünür).
 * Map'te OLMAYAN anahtar için override yoktur, normal zincir çalışır. Yalnızca `?onizleme=icerik`
 * modunda, ContentPreviewBridge tarafından doldurulur; normal ziyarette hep boştur.
 */
const previewOverrides = new Map<string, string | null>()
let previewVersion = 0
const previewListeners = new Set<() => void>()

/** Taslak kümesini BÜTÜNÜYLE değiştirir (önceki anahtarlar düşer) ve abone bileşenleri yeniden çizdirir. */
export function setPreviewOverrides(entries: Record<string, string | null | undefined>): void {
  previewOverrides.clear()
  for (const [key, value] of Object.entries(entries)) previewOverrides.set(key, clean(value))
  previewVersion++
  for (const cb of previewListeners) cb()
}

export function subscribePreview(cb: () => void): () => void {
  previewListeners.add(cb)
  return () => {
    previewListeners.delete(cb)
  }
}

const getPreviewVersion = () => previewVersion

/** İçerik değerini doğrudan okuyan bileşenler bunu çağırır: önizleme taslağı değişince yeniden çizilirler. */
export function usePreviewVersion(): number {
  return useSyncExternalStore(subscribePreview, getPreviewVersion, getPreviewVersion)
}

/** `value` bir getter'dır: önizleme taslağı varsa o, yoksa açılışta çözülen değer. */
const field = (label: string, value: string | null = null, key: string | null = null): ContentField => {
  const resolved = clean(value)
  return {
    key,
    label,
    get value(): string | null {
      if (key !== null && previewOverrides.has(key)) return previewOverrides.get(key) ?? null
      return resolved
    },
  }
}

const isEn = locale === 'en'
/** Yapısal etiket/başlık seçimi (sayfa başlıkları, bölüm adları) — içerik değeri değildir. */
const tl = (tr: string, en: string): string => (isEn ? en : tr)

/**
 * İngilizce varsayılanlar, API anahtarlarıyla düz sözlük: contentTextsEn + `info.<slug>.<i>` → infoSectionTextsEn.
 * Yönetici panelindeki EN alanlarının ön dolumu için de kullanılır (bkz. admin/pages/ContentPage.tsx).
 */
export const contentDefaultsEn: Record<string, string> = { ...contentTextsEn }
for (const [slug, sections] of Object.entries(infoSectionTextsEn)) sections.forEach((text, i) => (contentDefaultsEn[`info.${slug}.${i}`] = text))
const defaultsEn = contentDefaultsEn

/** EN sitede: API `fieldsEn` > panel EN override'ı (localStorage) > contentTextsEn/infoSectionTextsEn > null (→ Türkçe zincir). */
const enValue = (key: string): string | null => clean(remote?.content.fieldsEn?.[key]) ?? clean(overrides.en?.[key]) ?? clean(defaultsEn[key])

/**
 * Öncelik (TR): API (content_fields) > yönetici paneli override'ı (localStorage) > contentTexts.ts metni > null.
 * EN sitede önce `enValue` zinciri denenir; hiçbiri yoksa aynı Türkçe zincire düşülür.
 */
const ov = (value: string | null | undefined, key: string): string | undefined =>
  (isEn ? enValue(key) : null) ?? clean(remote?.content.fields[key]) ?? clean(value) ?? contentTexts[key]

/** brandContent alan anahtarları — yönetici panelindeki "Marka bilgileri" formu bu listeyi kullanır. */
export const brandContentKeys = ['collectionTitle', 'collectionIntro', 'heroCta', 'popularSearches', 'companyName', 'address', 'phone', 'email', 'registry', 'workingHours'] as const
export type BrandContentKey = (typeof brandContentKeys)[number]

const b = overrides.brand ?? {}

/** Anahtarlı metin alanı: `ov()` zinciri + aynı API anahtarı (önizleme eşlemesi için). */
const keyed = (label: string, local: string | null | undefined, key: string): ContentField => field(label, ov(local, key), key)

export const brandContent = {
  logo: field(tl('Teshvikiye — Logo alanı', 'Teshvikiye — Logo area')),
  collectionTitle: keyed(tl('Koleksiyon adı alanı', 'Collection name field'), b.collectionTitle, 'brand.collectionTitle'),
  collectionIntro: keyed(tl('Koleksiyon tanıtım metni alanı', 'Collection introduction text field'), b.collectionIntro, 'brand.collectionIntro'),
  collectionVisual: field(tl('Koleksiyon tanıtım görseli', 'Collection introduction image')),
  /** Ana sayfa açılış görselinin altındaki tek bağlantı yazısı; boşsa S.common.heroDiscover. */
  heroCta: keyed(tl('Açılış görseli üzerindeki yazı', 'Text on the opening image'), b.heroCta, 'brand.heroCta'),
  /** Arama panelindeki "Popüler aramalar" listesi (virgülle ayrılır); boşsa S.search.popularDefault. */
  popularSearches: keyed(tl('Popüler aramalar (virgülle ayır)', 'Popular searches (comma separated)'), b.popularSearches, 'brand.popularSearches'),
  // companyName/address/phone/email: gerçek işletme bilgisi gerektirir, contentTexts.ts'te tanımlı değildir — API ya da panel override'ı ile dolar.
  companyName: keyed(tl('Şirket unvanı', 'Company name'), b.companyName, 'brand.companyName'),
  address: keyed(tl('Adres', 'Address'), b.address, 'brand.address'),
  phone: keyed(tl('Telefon', 'Phone'), b.phone, 'brand.phone'),
  email: keyed(tl('E-posta', 'E-mail'), b.email, 'brand.email'),
  registry: keyed(tl('Vergi ve MERSİS numarası', 'Tax and MERSIS numbers'), b.registry, 'brand.registry'),
  workingHours: keyed(tl('Çalışma saatleri', 'Business hours'), b.workingHours, 'brand.workingHours'),
}

const p = overrides.production ?? {}

export const productionContent = {
  title: tl('Üretim', 'Production'),
  intro: keyed(tl('Üretim süreci açıklaması', 'Production process description'), p.intro, 'production.intro'),
  /** src/assets/media/uretim-video.mp4 sağlanınca (ya da panelden yüklenince) value otomatik dolar. */
  video: field(tl('Üretim videosu', 'Production video'), brandMedia.productionVideo),
  videoPoster: brandMedia.productionVideoPoster,
  videoNote: tl('Üretim videosu eklenecek', 'Production video coming soon'),
  steps: [
    {
      id: 'kesim',
      title: keyed(tl('Kumaş kesim aşaması başlığı', 'Fabric cutting stage title'), p.steps?.kesim?.title, 'production.kesim.title'),
      media: tl('Kumaş kesim aşaması görseli', 'Fabric cutting stage image'),
      src: brandMedia.productionCutting,
      text: keyed(tl('Kumaş kesim aşaması açıklaması', 'Fabric cutting stage description'), p.steps?.kesim?.text, 'production.kesim.text'),
    },
    {
      id: 'dikim',
      title: keyed(tl('Dikim aşaması başlığı', 'Sewing stage title'), p.steps?.dikim?.title, 'production.dikim.title'),
      media: tl('Dikim aşaması görseli', 'Sewing stage image'),
      src: brandMedia.productionSewing,
      text: keyed(tl('Dikim aşaması açıklaması', 'Sewing stage description'), p.steps?.dikim?.text, 'production.dikim.text'),
    },
    {
      id: 'kalite',
      title: keyed(tl('Kalite kontrol başlığı', 'Quality control title'), p.steps?.kalite?.title, 'production.kalite.title'),
      media: tl('Kalite kontrol görseli', 'Quality control image'),
      src: brandMedia.productionQuality,
      text: keyed(tl('Kalite kontrol açıklaması', 'Quality control description'), p.steps?.kalite?.text, 'production.kalite.text'),
    },
  ],
}

export interface InfoPageDef {
  slug: string
  title: string
  /** Sayfadaki içerik blokları; her biri adıyla gösterilen bir alan. */
  sections: ContentField[]
}

const infoDefsTr: { slug: string; title: string; labels: string[] }[] = [
  { slug: 'hakkimizda', title: 'Hakkımızda', labels: ['Marka hikâyesi', 'Tasarım yaklaşımı'] },
  { slug: 'teslimat', title: 'Teslimat', labels: ['Teslimat süresi bilgisi', 'Kargo ücreti bilgisi', 'Teslimat bölgeleri bilgisi'] },
  { slug: 'iade-degisim', title: 'İade ve Değişim', labels: ['İade koşulları', 'Değişim koşulları', 'İade süreci adımları'] },
  { slug: 'beden-rehberi', title: 'Beden Rehberi', labels: ['Beden ölçü tablosu', 'Ölçü alma açıklaması'] },
  { slug: 'sss', title: 'Sıkça Sorulan Sorular', labels: ['Sipariş soruları', 'Teslimat soruları', 'İade soruları', 'Üyelik soruları'] },
  { slug: 'gizlilik', title: 'Gizlilik Politikası', labels: ['Gizlilik politikası', 'KVKK aydınlatma bildirimi'] },
  { slug: 'cerez-politikasi', title: 'Çerez Politikası', labels: ['Çerezler hakkında'] },
  // iyzico üye işyeri kriterleri: mesafeli satış sözleşmesi ve ön bilgilendirme formu ayrı sayfalar olarak yayında olmalı.
  {
    slug: 'mesafeli-satis-sozlesmesi',
    title: 'Mesafeli Satış Sözleşmesi',
    labels: ['Sözleşme metni'],
  },
  { slug: 'teslimat-ve-iade', title: 'Teslimat ve İade Politikası', labels: ['Politika metni'] },
  {
    slug: 'on-bilgilendirme-formu',
    title: 'Ön Bilgilendirme Formu',
    labels: ['Satıcı bilgileri', 'Ürün, fiyat ve teslimat bilgileri', 'Cayma hakkı ve iade', 'Şikâyet ve uyuşmazlık başvuruları'],
  },
]

/** `/en` sitesi için aynı sayfa/bölüm başlıkları (slug'lar ve sıra birebir aynı). */
const infoDefsEn: Record<string, { title: string; labels: string[] }> = {
  hakkimizda: { title: 'About Us', labels: ['Our story', 'Our design approach'] },
  teslimat: { title: 'Delivery', labels: ['Delivery times', 'Shipping fees', 'Delivery areas'] },
  'iade-degisim': { title: 'Returns & Exchanges', labels: ['Return conditions', 'Exchange conditions', 'How to return'] },
  'beden-rehberi': { title: 'Size Guide', labels: ['Size chart', 'How to measure'] },
  sss: { title: 'Frequently Asked Questions', labels: ['Orders', 'Delivery', 'Returns', 'Membership'] },
  gizlilik: { title: 'Privacy Policy', labels: ['Privacy policy', 'Personal data protection notice (KVKK)'] },
  'cerez-politikasi': { title: 'Cookie Policy', labels: ['About cookies'] },
  'mesafeli-satis-sozlesmesi': {
    title: 'Distance Sales Contract',
    labels: ['Contract text'],
  },
  'teslimat-ve-iade': { title: 'Delivery and Returns Policy', labels: ['Policy text'] },
  'on-bilgilendirme-formu': {
    title: 'Pre-Information Form',
    labels: ['Seller details', 'Product, price and delivery details', 'Right of withdrawal and returns', 'Complaints and disputes'],
  },
}

const infoDefs = isEn ? infoDefsTr.map((d) => ({ ...d, ...(infoDefsEn[d.slug] ?? {}) })) : infoDefsTr

// Öncelik: API (content_fields anahtarı `info.<slug>.<i>`) > panel override'ı > infoSectionTexts.ts metni > null.
// NOT: önceki sürüm burada `ov()`'u atlayıp doğrudan `clean(overrides...) ?? infoSectionTexts[...]` kullanıyordu —
// bu, yönetici panelinin API'ye kaydettiği bilgi sayfası metinlerinin mağazada HİÇ görünmemesine yol açan bir
// hataydı (remote hiç okunmuyordu).
const infoField = (label: string, slug: string, i: number, fallback: string | undefined) => field(label, ov(clean(overrides.infoPages?.[slug]?.[i]), `info.${slug}.${i}`) ?? fallback, `info.${slug}.${i}`)

export const infoPages: InfoPageDef[] = [
  ...infoDefs.slice(0, 1).map((d) => ({ slug: d.slug, title: d.title, sections: d.labels.map((l, i) => infoField(l, d.slug, i, infoSectionTexts[d.slug]?.[i])) })),
  { slug: 'iletisim', title: tl('İletişim', 'Contact'), sections: [brandContent.companyName, brandContent.address, brandContent.phone, brandContent.email, brandContent.registry, brandContent.workingHours] },
  ...infoDefs.slice(1).map((d) => ({ slug: d.slug, title: d.title, sections: d.labels.map((l, i) => infoField(l, d.slug, i, infoSectionTexts[d.slug]?.[i])) })),
]

export const infoPageBySlug: Record<string, InfoPageDef> = Object.fromEntries(infoPages.map((pg) => [pg.slug, pg]))

export interface FooterLink {
  label: string
  /** İç yol, sayfa içi bağlantı (#uretim) veya özel eylem. */
  to?: string
  action?: 'cookie-preferences' | 'discount-offer' | 'support'
}

export interface FooterGroup {
  id: string
  title: string
  links: FooterLink[]
}

export const footerGroups: FooterGroup[] = [
  {
    id: 'marka',
    title: tl('Marka', 'Brand'),
    links: [
      { label: tl('Hakkımızda', 'About Us'), to: '/bilgi/hakkimizda' },
      { label: tl('Üretim', 'Production'), to: '/#uretim' },
      { label: tl('Koleksiyonlar', 'Collections'), to: '/koleksiyon' },
      { label: tl('İletişim', 'Contact'), to: '/bilgi/iletisim' },
    ],
  },
  {
    id: 'musteri-hizmetleri',
    title: tl('Müşteri Hizmetleri', 'Customer Service'),
    links: [
      { label: tl('Teslimat ve İade Politikası', 'Delivery & Returns Policy'), to: '/bilgi/teslimat-ve-iade' },
      { label: tl('Beden Rehberi', 'Size Guide'), to: '/bilgi/beden-rehberi' },
      { label: tl('Sıkça Sorulan Sorular', 'Frequently Asked Questions'), to: '/bilgi/sss' },
      { label: tl('WhatsApp Destek', 'WhatsApp Support'), action: 'support' },
    ],
  },
  {
    id: 'hesabim',
    title: tl('Hesabım', 'My Account'),
    links: [
      { label: tl('Giriş Yap', 'Log In'), to: '/giris' },
      { label: tl('Hesap Oluştur', 'Create Account'), to: '/kayit' },
      { label: S.header.createAccountOffer, action: 'discount-offer' },
      { label: tl('Favoriler', 'Wishlist'), to: '/favoriler' },
      { label: tl('Sepet', 'Cart'), to: '/sepet' },
    ],
  },
  {
    id: 'bilgilendirme',
    title: tl('Bilgilendirme', 'Information'),
    links: [
      { label: tl('Gizlilik Politikası', 'Privacy Policy'), to: '/bilgi/gizlilik' },
      { label: tl('Çerez Politikası', 'Cookie Policy'), to: '/bilgi/cerez-politikasi' },
      { label: tl('Çerez Tercihleri', 'Cookie Preferences'), action: 'cookie-preferences' },
      { label: tl('Mesafeli Satış Sözleşmesi', 'Distance Sales Contract'), to: '/bilgi/mesafeli-satis-sozlesmesi' },
      { label: tl('Ön Bilgilendirme Formu', 'Pre-Information Form'), to: '/bilgi/on-bilgilendirme-formu' },
    ],
  },
]

const cc = overrides.cookieCategories ?? {}

export const cookieContent = {
  /** Gerçek çerez açıklama metni ayrı içerik alanından gelir. */
  bannerText: keyed(tl('Çerez açıklama metni', 'Cookie notice text'), overrides.cookieText, 'cookie.bannerText'),
  categories: [
    { id: 'necessary', label: tl('Gerekli çerezler', 'Necessary cookies'), description: keyed(tl('Gerekli çerezler açıklaması', 'Necessary cookies description'), cc.necessary, 'cookie.necessary'), required: true },
    { id: 'analytics', label: tl('Analitik çerezler', 'Analytics cookies'), description: keyed(tl('Analitik çerezler açıklaması', 'Analytics cookies description'), cc.analytics, 'cookie.analytics'), required: false },
    { id: 'marketing', label: tl('Pazarlama çerezleri', 'Marketing cookies'), description: keyed(tl('Pazarlama çerezleri açıklaması', 'Marketing cookies description'), cc.marketing, 'cookie.marketing'), required: false },
  ] as const,
}

export const sizeGuideContent = {
  title: tl('Beden Rehberi', 'Size Guide'),
  table: keyed(tl('Beden ölçü tablosu', 'Size chart'), overrides.sizeGuide?.table, 'sizeGuide.table'),
  note: keyed(tl('Ölçü alma açıklaması', 'How to measure'), overrides.sizeGuide?.note, 'sizeGuide.note'),
}
