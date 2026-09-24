# Teshvikiye (teshvikiye.com) — e-ticaret sitesi

Kadın giyim markası Teshvikiye (eski çalışma adı: The Sister Code Official) için masaüstü ve telefonda çalışan, monokrom (siyah / beyaz / çok açık gri) bir mağaza arayüzü ve alışveriş prototipi. Marka görselleri, logo, üretim videosu ve ticari metinler henüz hazır olmadığı için her görsel/metin alanı, o alana gelecek içeriğin adıyla gösterilir. Üyelik, ödeme ve indirim hesaplamaları **demo** olarak çalışır; gerçek servis bağlanmamıştır.

## Çalıştırma

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # tip kontrolü + üretim derlemesi (dist/)
npm run preview    # derlenmiş sürümü yerelde aç
npm run typecheck  # yalnızca TypeScript kontrolü
```

Node 20+ önerilir. Ek servis, veritabanı veya ortam değişkeni gerekmez.

## Yapı

```
src/
  config/settings.ts      Merkezi ayarlar: marka, dil/para birimi, kargo, %10 kampanya, destek, teklif zamanlaması
  data/catalog.ts         DEMO katalog (24 ürün, kategoriler, renk/beden/stok) — gerçek marka verisi değildir
  data/content.ts         İçerik alanları: marka bilgileri, bilgi sayfaları, üretim bölümü, footer grupları, çerez metni
  i18n/tr.ts              Arayüz metinleri (dil değişimi için aynı anahtarlarla yeni dosya eklenir)
  lib/                    Saf yardımcılar: fiyat biçimi, sepet hesabı, filtre/sıralama/arama, güvenli depolama
  services/               Gerçek servis sınırları: auth (demo), checkout/ödeme (demo), analitik (izne bağlı)
  state/                  React context'leri: paneller (öncelik), sepet, favoriler, hesap, çerez onayı
  components/ui           Temel bileşenler: Button, Icon, MediaSlot, Accordion, Drawer, Field, QuantityStepper, Price
  components/layout       DemoBar, Header (+ Alışveriş paneli), MobileMenu, Footer, Layout
  components/cart         Sepet paneli (drawer), satır, tutar özeti
  components/product      Ürün kartı/ızgara, galeri, beden/renk seçimi, mobil satın alma çubuğu
  components/collection   Kategori şeridi, filtre paneli, sıralama, etkin filtreler
  components/panels       Çerez çubuğu ve tercihleri, WhatsApp destek, %10 indirim teklifi, arama
  components/production   Üretim bölümü (video ve aşama alanları)
  pages/                  Ana sayfa, koleksiyon, ürün, sepet, ödeme, sonuç, giriş, kayıt, hesap, favoriler, arama, bilgi
public/fonts/             Cabin font dosyaları (woff2, kendi sunucumuzdan; bkz. src/styles/fonts.css)
```

## Marka görselleri (fotoğraf boru hattı)

Fotoğraflar `src/assets/media/` altına ad kuralıyla konur ve derlemede otomatik bağlanır (`src/data/media.ts`); dosya yokken alan etiketli yer tutucu olarak kalır. Beklenen dosyalar: `acilis-masaustu.jpg`, `acilis-mobil.jpg` (ana sayfa açılışı), `koleksiyon.jpg`, `giris.jpg` (giriş/kayıt görseli), `logo.svg`, `uretim-video.mp4` (+ `uretim-video-kapak.jpg`), `uretim-kesim.jpg`, `uretim-dikim.jpg`, `uretim-kalite.jpg`, `urun-01-on.jpg` / `-arka` / `-model` / `-kumas` (01–24). Ayrıntı: `src/assets/media/README.md`.

**Geçici mock fotoğraflar:** Marka fotoğrafları henüz sağlanmadığı için klasör, kullanıcının kararıyla Unsplash'ten (Unsplash License) indirilen serbest lisanslı fotoğraflarla dolduruldu — `python3 scripts/fetch-mock-media.py`. Kaynak/fotoğrafçı listesi `src/assets/media/CREDITS.md`. Bu fotoğraflar markanın ürünlerini veya koleksiyonunu temsil etmez; gerçek fotoğraflar aynı dosya adlarıyla üzerine yazıldığında otomatik değişir. Referans mağazaların görselleri kullanılmamıştır.

## Yönetici paneli (demo)

`/admin` — giriş backend API ile (`POST /api/auth/login`, httpOnly çerez). Yerelde API yokken `.env.local` içindeki `VITE_DEV_ADMIN_*` değerleri yalnızca geliştirme derlemesinde geçerlidir; üretim derlemesine hiçbir parola girmez. Modüller: Ürünler (ad, fiyat, kategori, stok matrisi, ilişkiler, görsel yükleme), İçerik (marka bilgileri, bilgi sayfaları, çerez ve üretim metinleri), Ayarlar (%10 kampanya, kargo, WhatsApp, sosyal, marka görselleri), Demo siparişler, Veri (JSON dışa/içe aktarma, sıfırlama). Değişiklikler yalnızca bu tarayıcıda saklanır (`localStorage` `tsc.admin.v1`, görseller IndexedDB `tsc-media`) ve mağazaya sayfa yenilenince uygulanır (`src/admin/adminStore.ts`). Gerçek servis bağlanınca bu katman bir API istemcisiyle değiştirilir; JSON dışa aktarma taşıma içindir.

## Yayın (teshvikiye.com)

- Sunucu: cPanel/CloudLinux (Apache + Passenger), docroot `/home/teshvikiyeadmin/public_html`, HTTPS Let's Encrypt (AutoSSL). Erişim SSH anahtarıyla; `deploy.env` (git dışı) sunucu bilgilerini tutar, parola içermez.
- Mağaza: `scripts/deploy.sh` → `npm run build` + `tar | ssh` (sunucuda rsync yok); `public/.htaccess` SPA yönlendirmesi, HTTP→HTTPS, `/api` hariç tutma, cPanel PHP blokları ve önbellek başlıklarını içerir.
- API: `api/` (Node 22 + Express + MySQL), sunucuda `~/api`, Passenger ile `https://teshvikiye.com/api`; `scripts/deploy-api.sh` yükler, `npm install`, migration ve seed çalıştırır, uygulamayı yeniden başlatır. Veritabanı `teshvikiyeadmin_shop` (MariaDB 10.11), gizli değerler yalnızca sunucudaki `~/api/.env` içinde.
- Not: Passenger uygulama dizini `public_html/api` 755 olmalı (700 ise Apache 403 verir ve `.htaccess`'i okuyamaz).

## İlk ziyaret önizlemesi (yalnızca geliştirme)

`http://localhost:5173/?onizleme=ilk-ziyaret` — çerez çubuğu ve %10 teklifi sıfırdan, tarayıcıdaki kayıtlı tercihlere/sepete/hesaba dokunmadan (bellekte) izlenir. Üretim derlemesinde devre dışıdır.

## Çerez ve %10 teklif kuralları

- Çerez çubuğu yalnızca karar verilmemişken görünür; karar `localStorage` (`tsc.consent.v1`) içinde saklanır, footer "Çerez Tercihleri" paneli yeniden açar. Gerçek politika metni gelene kadar demo kapsamına uygun kısa açıklama gösterilir.
- Teklif, çerez kararından 6 sn sonra (`siteSettings.offerPanel`), başka panel açık değilken ve form/sepet/ödeme/hesap sayfaları dışında kendiliğinden açılır. Yalnızca X/Escape veya "Hesap Oluştur" reddetme sayılır (`sessionStorage` `tsc.offer.v2`); rota/panel nedeniyle kesilen teklif uygun ekrana dönünce en fazla 2 kez yeniden sunulur. Üyeye kendiliğinden gösterilmez; üst şerit ve footer'dan her zaman elle erişilir. Teklif açıkken destek düğmesi gizlenir.

## Tasarım kararları

- Renkler yalnızca `#000000`, `#FFFFFF`, `#F5F5F5`, `#EEEEEE` (`src/styles/tokens.css`). Durumlar metin ve ikonla anlatılır.
- Header'da logo dosyası gelene kadar iki satırlı metin wordmark (`Teşvikiye`) kullanılır.
- Tipografi: `"Cabin", "Gill Sans Nova", "Gill Sans", "Gill Sans MT", sans-serif`. Cabin (SIL OFL) `public/fonts/` altından kendi sunucumuzdan servis edilir; Türkçe İ/ı glifleri düzgündür. Lisanslı Gill Sans Nova dosyaları gelirse `src/styles/fonts.css` içine `@font-face` olarak eklenip zincirin başına alınabilir.
- Görsel alanları `MediaSlot` bileşeniyle 3:4 (ürün), 16:9 (video) gibi sabit oranlarda tutulur; gerçek görsel `src` verildiğinde yerleşim değişmeden içeriği kaplar.
- Ürün adları, açıklamalar, şirket bilgileri ve yasal metinler kesinleşene kadar alan adıyla gösterilir (`src/data/content.ts`).

## Demo varsayımları

- **%10 üyelik indirimi:** sitede hesap oluşturan kullanıcıya verilir; e-posta bülteni koşul değildir. Demo hesaplamada indirim sepet ara toplamına **otomatik** uygulanır; minimum sepet, son kullanım tarihi ve kullanım sınırı **tanımlı değildir** (null). Bu değerler `siteSettings.memberDiscount` altından yönetilir (`mode: 'automatic' | 'code'`).
- **Kargo:** ücret tanımlı değil (`shipping.amount: null`); ücretsiz sayılmaz, "Kargo ücreti tanımlanacak" gösterilir ve toplam **kargo hariç** verilir.
- **Üyelik:** demo hesap yalnızca tarayıcının localStorage'ında tutulur; şifre saklanmaz, loglanmaz, sunucuya gönderilmez. Giriş, yalnızca aynı tarayıcıda oluşturulmuş demo hesaplar için çalışır.
- **Ödeme:** kart bilgisi istenmez; "Demo sipariş" sonucu sessionStorage'da tutulur. Gerçek sağlayıcı için `src/services/checkout.ts` içindeki `PaymentProvider` arayüzü uygulanır.
- **Çerezler:** tercih localStorage'da saklanır; analitik/pazarlama servisleri yalnızca izin verilince `src/services/analytics.ts` üzerinden başlatılır (şu an boş sınır).
- **WhatsApp:** numara tanımlı değil (`support.whatsappNumber: null`); tanımlanınca sohbeti kullanıcı başlatır (`wa.me`).

## Bağlanmayı bekleyen gerçek içerik ve servisler

Logo dosyası, ürün fotoğrafları (ön/arka/model/kumaş), koleksiyon tanıtım görseli ve adı, üretim videosu ve aşama görselleri, ürün adları/açıklamaları/kumaş-bakım bilgileri, gerçek fiyat ve stok, şirket unvanı/adres/telefon/e-posta, teslimat-iade-gizlilik-çerez-alışveriş koşulları metinleri, beden tablosu, WhatsApp numarası, sosyal medya bağlantıları, üyelik servisi, ödeme sağlayıcısı, kargo ücreti ve kampanya koşulları.
