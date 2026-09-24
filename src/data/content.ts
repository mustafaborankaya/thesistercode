/**
 * İÇERİK ALANLARI
 * Marka bilgileri, bilgi sayfaları, üretim bölümü ve çerez metni kesinleşmediği için
 * her alan, o alana gelecek içeriğin adıyla gösterilir. Gerçek metinler geldiğinde bu dosya
 * ya da yönetici paneli (src/admin/adminStore.ts → content) üzerinden doldurulur; bileşenler değişmez.
 */

import { readAdminData } from '../admin/adminStore'
import { S, locale } from '../i18n'
import { brandMedia } from './media'
import { remote } from './remote'
import { contentTexts, contentTextsEn, infoSectionTexts, infoSectionTextsEn } from './contentTexts'

export interface ContentField {
  /** Alanın kullanıcıya görünen adı — örn. "Şirket adresi alanı". */
  label: string
  /** Gerçek metin geldiğinde buraya yazılır; null iken alan adı gösterilir. */
  value: string | null
}

const overrides = readAdminData().content
const clean = (v: string | null | undefined): string | null => (v && v.trim() ? v : null)
const field = (label: string, value: string | null = null): ContentField => ({ label, value: clean(value) })

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
export const brandContentKeys = ['collectionTitle', 'collectionIntro', 'heroCta', 'popularSearches', 'companyName', 'address', 'phone', 'email', 'workingHours'] as const
export type BrandContentKey = (typeof brandContentKeys)[number]

const b = overrides.brand ?? {}

export const brandContent = {
  logo: field(tl('Teshvikiye — Logo alanı', 'Teshvikiye — Logo area')),
  collectionTitle: field(tl('Koleksiyon adı alanı', 'Collection name field'), ov(b.collectionTitle, 'brand.collectionTitle')),
  collectionIntro: field(tl('Koleksiyon tanıtım metni alanı', 'Collection introduction text field'), ov(b.collectionIntro, 'brand.collectionIntro')),
  collectionVisual: field(tl('Koleksiyon tanıtım görseli', 'Collection introduction image')),
  /** Ana sayfa açılış görselinin altındaki tek bağlantı yazısı; boşsa S.common.heroDiscover. */
  heroCta: field(tl('Açılış görseli üzerindeki yazı', 'Text on the opening image'), ov(b.heroCta, 'brand.heroCta')),
  /** Arama panelindeki "Popüler aramalar" listesi (virgülle ayrılır); boşsa S.search.popularDefault. */
  popularSearches: field(tl('Popüler aramalar (virgülle ayır)', 'Popular searches (comma separated)'), ov(b.popularSearches, 'brand.popularSearches')),
  // companyName/address/phone/email: gerçek işletme bilgisi gerektirir, contentTexts.ts'te tanımlı değildir — API ya da panel override'ı ile dolar.
  companyName: field(tl('Şirket unvanı alanı', 'Company name field'), ov(b.companyName, 'brand.companyName')),
  address: field(tl('Şirket adresi alanı', 'Company address field'), ov(b.address, 'brand.address')),
  phone: field(tl('Telefon numarası alanı', 'Phone number field'), ov(b.phone, 'brand.phone')),
  email: field(tl('E-posta adresi alanı', 'E-mail address field'), ov(b.email, 'brand.email')),
  workingHours: field(tl('Çalışma saatleri alanı', 'Business hours field'), ov(b.workingHours, 'brand.workingHours')),
}

const p = overrides.production ?? {}

export const productionContent = {
  title: tl('Üretim', 'Production'),
  intro: field(tl('Üretim süreci açıklaması', 'Production process description'), ov(p.intro, 'production.intro')),
  /** src/assets/media/uretim-video.mp4 sağlanınca (ya da panelden yüklenince) value otomatik dolar. */
  video: field(tl('Üretim videosu', 'Production video'), brandMedia.productionVideo),
  videoPoster: brandMedia.productionVideoPoster,
  videoNote: tl('Üretim videosu eklenecek', 'Production video coming soon'),
  steps: [
    {
      id: 'kesim',
      title: field(tl('Kumaş kesim aşaması başlığı', 'Fabric cutting stage title'), ov(p.steps?.kesim?.title, 'production.kesim.title')),
      media: tl('Kumaş kesim aşaması görseli', 'Fabric cutting stage image'),
      src: brandMedia.productionCutting,
      text: field(tl('Kumaş kesim aşaması açıklaması', 'Fabric cutting stage description'), ov(p.steps?.kesim?.text, 'production.kesim.text')),
    },
    {
      id: 'dikim',
      title: field(tl('Dikim aşaması başlığı', 'Sewing stage title'), ov(p.steps?.dikim?.title, 'production.dikim.title')),
      media: tl('Dikim aşaması görseli', 'Sewing stage image'),
      src: brandMedia.productionSewing,
      text: field(tl('Dikim aşaması açıklaması', 'Sewing stage description'), ov(p.steps?.dikim?.text, 'production.dikim.text')),
    },
    {
      id: 'kalite',
      title: field(tl('Kalite kontrol başlığı', 'Quality control title'), ov(p.steps?.kalite?.title, 'production.kalite.title')),
      media: tl('Kalite kontrol görseli', 'Quality control image'),
      src: brandMedia.productionQuality,
      text: field(tl('Kalite kontrol açıklaması', 'Quality control description'), ov(p.steps?.kalite?.text, 'production.kalite.text')),
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
  { slug: 'hakkimizda', title: 'Hakkımızda', labels: ['Marka hikâyesi metni', 'Tasarım yaklaşımı metni'] },
  { slug: 'teslimat', title: 'Teslimat', labels: ['Teslimat süresi bilgisi', 'Kargo ücreti bilgisi', 'Teslimat bölgeleri bilgisi'] },
  { slug: 'iade-degisim', title: 'İade ve Değişim', labels: ['İade koşulları metni', 'Değişim koşulları metni', 'İade süreci adımları'] },
  { slug: 'beden-rehberi', title: 'Beden Rehberi', labels: ['Beden ölçü tablosu', 'Ölçü alma açıklaması'] },
  { slug: 'sss', title: 'Sıkça Sorulan Sorular', labels: ['Sipariş soruları', 'Teslimat soruları', 'İade soruları', 'Üyelik soruları'] },
  { slug: 'gizlilik', title: 'Gizlilik Politikası', labels: ['Gizlilik politikası metni', 'Kişisel verilerin korunması aydınlatma metni'] },
  { slug: 'cerez-politikasi', title: 'Çerez Politikası', labels: ['Çerez açıklama metni'] },
  { slug: 'alisveris-kosullari', title: 'Alışveriş Koşulları', labels: ['Mesafeli satış sözleşmesi metni', 'Kullanım koşulları metni'] },
]

/** `/en` sitesi için aynı sayfa/bölüm başlıkları (slug'lar ve sıra birebir aynı). */
const infoDefsEn: Record<string, { title: string; labels: string[] }> = {
  hakkimizda: { title: 'About Us', labels: ['Our story', 'Our design approach'] },
  teslimat: { title: 'Delivery', labels: ['Delivery times', 'Shipping fees', 'Delivery areas'] },
  'iade-degisim': { title: 'Returns & Exchanges', labels: ['Return conditions', 'Exchange conditions', 'How to return'] },
  'beden-rehberi': { title: 'Size Guide', labels: ['Size chart', 'How to measure'] },
  sss: { title: 'Frequently Asked Questions', labels: ['Orders', 'Delivery', 'Returns', 'Membership'] },
  gizlilik: { title: 'Privacy Policy', labels: ['Privacy policy', 'Personal data protection notice'] },
  'cerez-politikasi': { title: 'Cookie Policy', labels: ['About cookies'] },
  'alisveris-kosullari': { title: 'Terms of Sale', labels: ['Distance sales contract', 'Terms of use'] },
}

const infoDefs = isEn ? infoDefsTr.map((d) => ({ ...d, ...(infoDefsEn[d.slug] ?? {}) })) : infoDefsTr

// Öncelik: API (content_fields anahtarı `info.<slug>.<i>`) > panel override'ı > infoSectionTexts.ts metni > null.
// NOT: önceki sürüm burada `ov()`'u atlayıp doğrudan `clean(overrides...) ?? infoSectionTexts[...]` kullanıyordu —
// bu, yönetici panelinin API'ye kaydettiği bilgi sayfası metinlerinin mağazada HİÇ görünmemesine yol açan bir
// hataydı (remote hiç okunmuyordu).
const infoField = (label: string, slug: string, i: number, fallback: string | undefined) => field(label, ov(clean(overrides.infoPages?.[slug]?.[i]), `info.${slug}.${i}`) ?? fallback)

export const infoPages: InfoPageDef[] = [
  ...infoDefs.slice(0, 1).map((d) => ({ slug: d.slug, title: d.title, sections: d.labels.map((l, i) => infoField(l, d.slug, i, infoSectionTexts[d.slug]?.[i])) })),
  { slug: 'iletisim', title: tl('İletişim', 'Contact'), sections: [brandContent.companyName, brandContent.address, brandContent.phone, brandContent.email, brandContent.workingHours] },
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
      { label: tl('Teslimat', 'Delivery'), to: '/bilgi/teslimat' },
      { label: tl('İade ve Değişim', 'Returns & Exchanges'), to: '/bilgi/iade-degisim' },
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
      { label: tl('Alışveriş Koşulları', 'Terms of Sale'), to: '/bilgi/alisveris-kosullari' },
    ],
  },
]

const cc = overrides.cookieCategories ?? {}

export const cookieContent = {
  /** Gerçek çerez açıklama metni ayrı içerik alanından gelir. */
  bannerText: field(tl('Çerez açıklama metni', 'Cookie notice text'), ov(overrides.cookieText, 'cookie.bannerText')),
  categories: [
    { id: 'necessary', label: tl('Gerekli çerezler', 'Necessary cookies'), description: field(tl('Gerekli çerezler açıklaması', 'Necessary cookies description'), ov(cc.necessary, 'cookie.necessary')), required: true },
    { id: 'analytics', label: tl('Analitik çerezler', 'Analytics cookies'), description: field(tl('Analitik çerezler açıklaması', 'Analytics cookies description'), ov(cc.analytics, 'cookie.analytics')), required: false },
    { id: 'marketing', label: tl('Pazarlama çerezleri', 'Marketing cookies'), description: field(tl('Pazarlama çerezleri açıklaması', 'Marketing cookies description'), ov(cc.marketing, 'cookie.marketing')), required: false },
  ] as const,
}

export const sizeGuideContent = {
  title: tl('Beden Rehberi', 'Size Guide'),
  table: field(tl('Beden ölçü tablosu', 'Size chart'), ov(overrides.sizeGuide?.table, 'sizeGuide.table')),
  note: field(tl('Ölçü alma açıklaması', 'How to measure'), ov(overrides.sizeGuide?.note, 'sizeGuide.note')),
}
