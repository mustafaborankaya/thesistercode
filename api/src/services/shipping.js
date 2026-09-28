/**
 * Kargo firması takip bağlantıları. Bilinen firmalar ad eşleşmesiyle (Türkçe karakter/büyük-küçük harf
 * duyarsız) tanınır; bilinmeyen firmada bağlantı üretilmez (null). NOT: firmaların takip sayfası adresleri
 * zamanla değişebilir — canlıya almadan önce her kalıbı gerçek bir takip numarasıyla doğrulayın.
 */
const CARRIERS = [
  { key: 'yurtici', match: ['yurtici', 'yurt ici'], url: (n) => `https://www.yurticikargo.com/tr/online-servisler/gonderi-sorgula?code=${n}` },
  { key: 'aras', match: ['aras'], url: (n) => `https://kargotakip.araskargo.com.tr/mainpage.aspx?code=${n}` },
  { key: 'mng', match: ['mng', 'dhl ecommerce'], url: (n) => `https://www.mngkargo.com.tr/gonderi-takip/?code=${n}` },
  { key: 'ptt', match: ['ptt'], url: (n) => `https://gonderitakip.ptt.gov.tr/Track/Verify?q=${n}` },
  { key: 'surat', match: ['surat'], url: (n) => `https://www.suratkargo.com.tr/KargoTakip/?kargotakipno=${n}` },
  { key: 'ups', match: ['ups'], url: (n) => `https://www.ups.com/track?tracknum=${n}` },
]

function fold(s) {
  return String(s ?? '')
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
}

export function trackingUrl(carrier, trackingNumber) {
  if (!carrier || !trackingNumber) return null
  const c = fold(carrier)
  const found = CARRIERS.find((k) => k.match.some((m) => c.includes(m)))
  return found ? found.url(encodeURIComponent(String(trackingNumber).trim())) : null
}
