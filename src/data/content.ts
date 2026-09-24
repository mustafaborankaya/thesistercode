/**
 * İÇERİK ALANLARI
 * Marka bilgileri, bilgi sayfaları, üretim bölümü ve çerez metni kesinleşmediği için
 * her alan, o alana gelecek içeriğin adıyla gösterilir. Gerçek metinler geldiğinde bu dosya
 * ya da yönetici paneli (src/admin/adminStore.ts → content) üzerinden doldurulur; bileşenler değişmez.
 */

import { readAdminData } from '../admin/adminStore'
import { brandMedia } from './media'
import { contentTexts, infoSectionTexts } from './contentTexts'

export interface ContentField {
  /** Alanın kullanıcıya görünen adı — örn. "Şirket adresi alanı". */
  label: string
  /** Gerçek metin geldiğinde buraya yazılır; null iken alan adı gösterilir. */
  value: string | null
}

const overrides = readAdminData().content
const clean = (v: string | null | undefined): string | null => (v && v.trim() ? v : null)
const field = (label: string, value: string | null = null): ContentField => ({ label, value: clean(value) })
/** Öncelik: yönetici paneli override'ı (boş/undefined ise yok sayılır) > contentTexts.ts metni > null. */
const ov = (value: string | null | undefined, key: string): string | undefined => clean(value) ?? contentTexts[key]

/** brandContent alan anahtarları — yönetici panelindeki "Marka bilgileri" formu bu listeyi kullanır. */
export const brandContentKeys = ['collectionTitle', 'collectionIntro', 'companyName', 'address', 'phone', 'email', 'workingHours'] as const
export type BrandContentKey = (typeof brandContentKeys)[number]

const b = overrides.brand ?? {}

export const brandContent = {
  logo: field('Teshvikiye — Logo alanı'),
  collectionTitle: field('Koleksiyon adı alanı', ov(b.collectionTitle, 'brand.collectionTitle')),
  collectionIntro: field('Koleksiyon tanıtım metni alanı', ov(b.collectionIntro, 'brand.collectionIntro')),
  collectionVisual: field('Koleksiyon tanıtım görseli'),
  // companyName/address/phone/email: gerçek işletme bilgisi gerektirir, contentTexts.ts'te tanımlı değildir — yalnızca panel override'ı ile dolar.
  companyName: field('Şirket unvanı alanı', b.companyName),
  address: field('Şirket adresi alanı', b.address),
  phone: field('Telefon numarası alanı', b.phone),
  email: field('E-posta adresi alanı', b.email),
  workingHours: field('Çalışma saatleri alanı', ov(b.workingHours, 'brand.workingHours')),
}

const p = overrides.production ?? {}

export const productionContent = {
  title: 'Üretim',
  intro: field('Üretim süreci açıklaması', ov(p.intro, 'production.intro')),
  /** src/assets/media/uretim-video.mp4 sağlanınca (ya da panelden yüklenince) value otomatik dolar. */
  video: field('Üretim videosu', brandMedia.productionVideo),
  videoPoster: brandMedia.productionVideoPoster,
  videoNote: 'Üretim videosu eklenecek',
  steps: [
    {
      id: 'kesim',
      title: field('Kumaş kesim aşaması başlığı', ov(p.steps?.kesim?.title, 'production.kesim.title')),
      media: 'Kumaş kesim aşaması görseli',
      src: brandMedia.productionCutting,
      text: field('Kumaş kesim aşaması açıklaması', ov(p.steps?.kesim?.text, 'production.kesim.text')),
    },
    {
      id: 'dikim',
      title: field('Dikim aşaması başlığı', ov(p.steps?.dikim?.title, 'production.dikim.title')),
      media: 'Dikim aşaması görseli',
      src: brandMedia.productionSewing,
      text: field('Dikim aşaması açıklaması', ov(p.steps?.dikim?.text, 'production.dikim.text')),
    },
    {
      id: 'kalite',
      title: field('Kalite kontrol başlığı', ov(p.steps?.kalite?.title, 'production.kalite.title')),
      media: 'Kalite kontrol görseli',
      src: brandMedia.productionQuality,
      text: field('Kalite kontrol açıklaması', ov(p.steps?.kalite?.text, 'production.kalite.text')),
    },
  ],
}

export interface InfoPageDef {
  slug: string
  title: string
  /** Sayfadaki içerik blokları; her biri adıyla gösterilen bir alan. */
  sections: ContentField[]
}

const infoDefs: { slug: string; title: string; labels: string[] }[] = [
  { slug: 'hakkimizda', title: 'Hakkımızda', labels: ['Marka hikâyesi metni', 'Tasarım yaklaşımı metni'] },
  { slug: 'teslimat', title: 'Teslimat', labels: ['Teslimat süresi bilgisi', 'Kargo ücreti bilgisi', 'Teslimat bölgeleri bilgisi'] },
  { slug: 'iade-degisim', title: 'İade ve Değişim', labels: ['İade koşulları metni', 'Değişim koşulları metni', 'İade süreci adımları'] },
  { slug: 'beden-rehberi', title: 'Beden Rehberi', labels: ['Beden ölçü tablosu', 'Ölçü alma açıklaması'] },
  { slug: 'sss', title: 'Sıkça Sorulan Sorular', labels: ['Sipariş soruları', 'Teslimat soruları', 'İade soruları', 'Üyelik soruları'] },
  { slug: 'gizlilik', title: 'Gizlilik Politikası', labels: ['Gizlilik politikası metni', 'Kişisel verilerin korunması aydınlatma metni'] },
  { slug: 'cerez-politikasi', title: 'Çerez Politikası', labels: ['Çerez açıklama metni'] },
  { slug: 'alisveris-kosullari', title: 'Alışveriş Koşulları', labels: ['Mesafeli satış sözleşmesi metni', 'Kullanım koşulları metni'] },
]

export const infoPages: InfoPageDef[] = [
  ...infoDefs.slice(0, 1).map((d) => ({ slug: d.slug, title: d.title, sections: d.labels.map((l, i) => field(l, clean(overrides.infoPages?.[d.slug]?.[i]) ?? infoSectionTexts[d.slug]?.[i])) })),
  { slug: 'iletisim', title: 'İletişim', sections: [brandContent.companyName, brandContent.address, brandContent.phone, brandContent.email, brandContent.workingHours] },
  ...infoDefs.slice(1).map((d) => ({ slug: d.slug, title: d.title, sections: d.labels.map((l, i) => field(l, clean(overrides.infoPages?.[d.slug]?.[i]) ?? infoSectionTexts[d.slug]?.[i])) })),
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
    title: 'Marka',
    links: [
      { label: 'Hakkımızda', to: '/bilgi/hakkimizda' },
      { label: 'Üretim', to: '/#uretim' },
      { label: 'Koleksiyonlar', to: '/koleksiyon' },
      { label: 'İletişim', to: '/bilgi/iletisim' },
    ],
  },
  {
    id: 'musteri-hizmetleri',
    title: 'Müşteri Hizmetleri',
    links: [
      { label: 'Teslimat', to: '/bilgi/teslimat' },
      { label: 'İade ve Değişim', to: '/bilgi/iade-degisim' },
      { label: 'Beden Rehberi', to: '/bilgi/beden-rehberi' },
      { label: 'Sıkça Sorulan Sorular', to: '/bilgi/sss' },
      { label: 'WhatsApp Destek', action: 'support' },
    ],
  },
  {
    id: 'hesabim',
    title: 'Hesabım',
    links: [
      { label: 'Giriş Yap', to: '/giris' },
      { label: 'Hesap Oluştur', to: '/kayit' },
      { label: 'Hesap oluştur, %10 indirim kazan', action: 'discount-offer' },
      { label: 'Favoriler', to: '/favoriler' },
      { label: 'Sepet', to: '/sepet' },
    ],
  },
  {
    id: 'bilgilendirme',
    title: 'Bilgilendirme',
    links: [
      { label: 'Gizlilik Politikası', to: '/bilgi/gizlilik' },
      { label: 'Çerez Politikası', to: '/bilgi/cerez-politikasi' },
      { label: 'Çerez Tercihleri', action: 'cookie-preferences' },
      { label: 'Alışveriş Koşulları', to: '/bilgi/alisveris-kosullari' },
    ],
  },
]

const cc = overrides.cookieCategories ?? {}

export const cookieContent = {
  /** Gerçek çerez açıklama metni ayrı içerik alanından gelir. */
  bannerText: field('Çerez açıklama metni', ov(overrides.cookieText, 'cookie.bannerText')),
  categories: [
    { id: 'necessary', label: 'Gerekli çerezler', description: field('Gerekli çerezler açıklaması', ov(cc.necessary, 'cookie.necessary')), required: true },
    { id: 'analytics', label: 'Analitik çerezler', description: field('Analitik çerezler açıklaması', ov(cc.analytics, 'cookie.analytics')), required: false },
    { id: 'marketing', label: 'Pazarlama çerezleri', description: field('Pazarlama çerezleri açıklaması', ov(cc.marketing, 'cookie.marketing')), required: false },
  ] as const,
}

export const sizeGuideContent = {
  title: 'Beden Rehberi',
  table: field('Beden ölçü tablosu', ov(overrides.sizeGuide?.table, 'sizeGuide.table')),
  note: field('Ölçü alma açıklaması', ov(overrides.sizeGuide?.note, 'sizeGuide.note')),
}
