# Teshvikiye — Kalanlar

Güncelleme: 08.10.2026. Tamamlanan her madde işaretlenip tarih yazılır.

> **Askıda:** 08.10.2026 itibarıyla 10.11.2026'ya kadar sitede çalışma yok. Son durum: main `a0efc08` canlıda, çalışma ağacı temiz. Devam edince önce bu dosya, sonra bekleyen girdiler.

## Sizden beklenenler

- [ ] **iyzico sözleşmesi ve canlı anahtarlar** — onay gelince: API key + secret key (bana iletin), satıcı panelinde "bildirim adresi" alanına vereceğim URL'yi girin, taksit ve 3D Secure seçeneklerini açın.
- [ ] **SMTP hesabı** (e-posta gönderimi) — bu olmadan sipariş onayı, parola sıfırlama, e-posta doğrulama ve kargo bildirimi gitmiyor. Gerekenler: sunucu adresi, port, kullanıcı adı, parola, gönderen adres (örn. siparis@teshvikiye.com). cPanel'de e-posta hesabı açmak yeterli.
- [ ] **Anlaşmalı kargo firması ve iade kodu** — sözleşme ve iade politikasındaki `[KARGO FİRMASI]` ve `[İADE KODU]` boşlukları için. Entegrasyon ayrı iş, metin boşluğu gerçek satıştan önce dolmalı.
- [ ] **Kargo ücreti ve ücretsiz kargo eşiği** — panel › Ayarlar'dan iki sayı.
- [ ] **Gerçek ürünler** — ad (TR ve mümkünse EN), kısa açıklama, fotoğraflar (ön/arka/model). Şu an 25 ürünün tamamı yer tutucu; Google'a "Ürün 01 — Ürün adı" gidiyor.
- [ ] **Sosyal medya bağlantıları** (isteğe bağlı) — panel › Ayarlar; girilince altbilgiye ve yapısal veriye otomatik eklenir.
- [ ] **Marka görselleri** — açılış (masaüstü/mobil), koleksiyon, giriş sayfası fotoğrafları. Şu an pakette gelen geçici görseller kullanılıyor.
- [ ] **Çerez metni** — panel › İçerik › Çerez: "analitik" açıklaması varsayılan metinle gidiyor; hukuk kontrolü önerilir (onaysız kimliksiz sayım).
- [ ] **Bekleyen sipariş** `TSV-20260928-6484` (das dasdsa, 8.020 TL) — gerçek değilse panelden iptal edin.

## Ürünler girilince (SEO — hatırlatacağım)

- [ ] Google Search Console: `teshvikiye.com` alan adı mülkü, DNS TXT ile doğrulama, site haritası gönderimi (`https://teshvikiye.com/sitemap.xml`).
- [ ] "URL denetimi" ile ana sayfa ve bir ürün için dizine ekleme isteği.
- [ ] Google Merchant Center: akış adresi `https://teshvikiye.com/feeds/google-merchant.xml` (görseller yüklenmeden reddeder).
- [ ] Facebook/WhatsApp link önizleme ve Google Rich Results testi ile bir ürün sayfası kontrolü.
- [ ] Bing Webmaster Tools: Search Console'dan içe aktarma.

## Benim yapacaklarım (girdiler geldikçe)

- [ ] **iyzico ödeme mutabakatı** — bekleyen siparişi iptal etmeden önce iyzico'ya sorma, sunucudan sunucuya bildirim (webhook) uç noktası, güvenlik duvarı istisnası, günlük karşılaştırma. Test anahtarlarıyla şimdiden yazılabilir.
- [ ] **Canlıya geçiş** — anahtarları sunucuya işleme, adresi sandbox'tan canlıya çevirme, gerçek kartla 1 TL deneme ve iade.
- [ ] **SMTP bağlama** — hesap gelince sunucu ayarı + tüm e-posta şablonlarının gerçek gönderim testi.
- [ ] **Kargo entegrasyonu** — firma API'si ile gönderi oluşturma, etiket PDF, durum güncellemeleri; iade kodu akışı.
- [ ] **Yetki daraltma** — iade, üyelik indirimi, kargo ücreti ve taksit ayarlarını yalnızca "sahip" rolüne kısıtlama.
- [ ] **Güvenlik takipleri** — sipariş başına adet sınırı ve adres sayısı sınırı, gerçek istemci IP'siyle hız sınırı testi, indirimin doğrulanmış e-postaya bağlanması (SMTP sonrası).
- [ ] **Küçük işler** — onay penceresine erişilebilirlik rolü, kullanılmayan iki panel fonksiyonunun temizliği.

## Tamamlananlar (özet)

- 07.10: "Beni hatırla"; birinci taraf analitik ve panelde Analitik sayfası; ürün silme; "Ürün NN" temizliği; ilişkili ürünlerde yalnızca seçilenler; görsellerde varsayılan rozeti; sınırsız renk; içerik canlı önizleme (çerçeve izni aynı kökene açıldı); SEO (meta, yapısal veri, sitemap, bot önizlemesi, Merchant akışı).
- Öncesi: tasarım yenileme ve logo, Cabin fontu, iyzico sandbox entegrasyonu, kuponlar, stok takibi, kargo takibi, hesap/adres/sipariş geçmişi, e-posta altyapısı (SMTP bekliyor), yasal metinler ve "okudum onaylıyorum", şirket kimliği, yönetici paneli v2, güvenlik sertleştirmesi.
