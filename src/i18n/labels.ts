/**
 * Veri katmanındaki gezinme/sayfa etiketleri (footer grupları, bilgi sayfası başlıkları, çerez kategorileri).
 * tr.ts/en.ts sözlüklerinden ayrı tutulur; her iki dil burada yan yana yönetilir.
 */
import { locale } from './index'

const labels = {
  tr: {
    footer: { marka: 'Marka', musteri: 'Müşteri Hizmetleri', hesap: 'Hesabım', bilgi: 'Bilgilendirme' },
    links: {
      hakkimizda: 'Hakkımızda', uretim: 'Üretim', koleksiyonlar: 'Koleksiyonlar', iletisim: 'İletişim',
      teslimat: 'Teslimat', iade: 'İade ve Değişim', beden: 'Beden Rehberi', sss: 'Sıkça Sorulan Sorular', whatsapp: 'WhatsApp Destek',
      giris: 'Giriş Yap', kayit: 'Hesap Oluştur', teklif: 'Hesap oluştur, %10 indirim kazan', favoriler: 'Favoriler', sepet: 'Sepet',
      gizlilik: 'Gizlilik Politikası', cerez: 'Çerez Politikası', cerezTercih: 'Çerez Tercihleri', kosullar: 'Alışveriş Koşulları',
      gizlilikKisa: 'Gizlilik',
    },
    pages: {
      hakkimizda: 'Hakkımızda', iletisim: 'İletişim', teslimat: 'Teslimat', 'iade-degisim': 'İade ve Değişim', 'beden-rehberi': 'Beden Rehberi',
      sss: 'Sıkça Sorulan Sorular', gizlilik: 'Gizlilik Politikası', 'cerez-politikasi': 'Çerez Politikası', 'alisveris-kosullari': 'Alışveriş Koşulları',
    },
    cookieCategories: { necessary: 'Gerekli çerezler', analytics: 'Analitik çerezler', marketing: 'Pazarlama çerezleri' },
    production: 'Üretim',
    sizeGuide: 'Beden Rehberi',
    social: 'Sosyal medya',
    navMain: 'Ana gezinme',
    navTools: 'Alışveriş araçları',
  },
  en: {
    footer: { marka: 'Brand', musteri: 'Customer care', hesap: 'Account', bilgi: 'Information' },
    links: {
      hakkimizda: 'About us', uretim: 'Production', koleksiyonlar: 'Collections', iletisim: 'Contact',
      teslimat: 'Delivery', iade: 'Returns & exchanges', beden: 'Size guide', sss: 'FAQ', whatsapp: 'WhatsApp support',
      giris: 'Sign in', kayit: 'Create account', teklif: 'Create an account, get 10% off', favoriler: 'Wishlist', sepet: 'Cart',
      gizlilik: 'Privacy policy', cerez: 'Cookie policy', cerezTercih: 'Cookie preferences', kosullar: 'Terms of purchase',
      gizlilikKisa: 'Privacy',
    },
    pages: {
      hakkimizda: 'About us', iletisim: 'Contact', teslimat: 'Delivery', 'iade-degisim': 'Returns & exchanges', 'beden-rehberi': 'Size guide',
      sss: 'FAQ', gizlilik: 'Privacy policy', 'cerez-politikasi': 'Cookie policy', 'alisveris-kosullari': 'Terms of purchase',
    },
    cookieCategories: { necessary: 'Essential cookies', analytics: 'Analytics cookies', marketing: 'Marketing cookies' },
    production: 'Production',
    sizeGuide: 'Size guide',
    social: 'Social media',
    navMain: 'Main navigation',
    navTools: 'Shopping tools',
  },
} as const

export const L = labels[locale]
