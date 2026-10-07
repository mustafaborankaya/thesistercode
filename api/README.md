# Teşvikiye API

`teshvikiye.com/api` altında çalışan Node.js 22 + Express + MySQL backend'i. Mağaza kodu (`src/`)
bu klasörden bağımsızdır; bu API şu an mağazaya bağlı değildir (bağlanma işi ayrı bir aşamadır).

## Kurulum (sunucuda, cPanel/Passenger)

1. `~/api` altına bu klasörün içeriğini yükleyin (Node uygulama kökü `~/api`, başlangıç dosyası
   `server.js`).
2. cPanel "Setup Node.js App" ile Node 22 seçin, uygulama kökünü `~/api`, başlangıç dosyasını
   `server.js` olarak ayarlayın.
3. `~/api/.env` dosyasını `.env.example`'a göre gerçek değerlerle oluşturun (bkz. aşağıdaki liste).
4. cPanel panelindeki "Run NPM Install" ile bağımlılıkları kurun (ya da `cd ~/api && npm install`).
5. Migration'ları uygulayın: `npm run migrate` (`node scripts/migrate.js`).
6. İlk verileri yükleyin: `npm run seed` (`node scripts/seed.js`) — ilk yönetici hesabını
   (ADMIN_USERNAME/ADMIN_PASSWORD) ve 24 demo ürünü oluşturur.
7. Uygulamayı Passenger üzerinden yeniden başlatın ("Restart").
8. Doğrulama: `curl https://teshvikiye.com/api/health` → `{"ok":true,"db":true,"version":"1.0.0"}`

Ek yönetici eklemek için: `node scripts/create-admin.js <username> <password> [owner|editor]`

## Passenger notu

Passenger, `PassengerBaseURI /api` ile gelen isteği bazı kurulumlarda `/api/...`, bazılarında yalnızca
`/...` olarak uygulamaya iletir. Bu belirsizlik nedeniyle router **her iki önekte de** bağlıdır
(`app.use('/api', router)` ve `app.use('/', router)`), yani hem `GET /health` hem `GET /api/health`
çalışır. `server.js`, `PORT` ortam değişkeni yoksa 3000'e düşer; Passenger genelde kendi portunu
enjekte eder.

`server.js`, `src/env.js` ve `src/db.js` içinde bilinçli olarak top-level await
kullanılmaz: Passenger/Phusion loader bazı kurulumlarda `server.js`'i `require()` ile yükleyebilir ve
Node 22'de `require()` edilen bir ESM modülünün import zincirinde top-level await bulunması
desteklenmez.

## Ortam değişkenleri (`.env`)

| Değişken | Açıklama |
| --- | --- |
| `NODE_ENV` | `production` / `development` / `test` |
| `PORT` | Passenger yoksayabilir; yerel çalıştırma için |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | MySQL bağlantısı |
| `SESSION_SECRET` | JWT imzalama anahtarı — en az 16 karakter, rastgele |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | `scripts/seed.js` ilk owner hesabını bundan oluşturur |
| `UPLOAD_DIR` | Yüklenen medyanın diskteki hedefi (`/home/teshvikiyeadmin/public_html/uploads`) |
| `UPLOAD_PUBLIC_BASE` | Yüklenen medyanın genel URL öneki (`/uploads`) |
| `CORS_ORIGIN` | CORS + CSRF Origin kontrolü için izinli kaynak (`https://teshvikiye.com`) |
| `PAYMENT_PROVIDER` | `none` (varsayılan) / `iyzico` / `fake` (yalnızca yerel test) — bkz. "Ödeme (iyzico)" |
| `IYZICO_API_KEY`, `IYZICO_SECRET_KEY` | iyzico anahtarları (`iyzico` iken zorunlu) |
| `IYZICO_BASE_URL` | `https://sandbox-api.iyzipay.com` (varsayılan) / `https://api.iyzipay.com` |
| `PAYMENT_INSTALLMENTS` | Taksit seçenekleri, ör. `1,2,3,6,9` (varsayılan `1`) |

## Güvenlik

- Parolalar **bcrypt** (cost 12) ile saklanır; hiçbir yerde düz metin loglanmaz.
- Oturumlar httpOnly + Secure (production) + SameSite=Lax cookie içinde JWT: yönetici `tsc_admin`
  (12 saat), müşteri `tsc_customer` (30 gün).
- CSRF: SameSite=Lax + mutasyon (POST/PUT/PATCH/DELETE) isteklerinde `Origin` header'ı varsa
  `CORS_ORIGIN` ile eşleşmesi zorunludur; eşleşmezse `403 origin_mismatch`.
- `POST /auth/login`: IP başına 15 dakikada 10 deneme sınırı (`express-rate-limit`).
- Girdi doğrulama: `zod`. SQL: yalnızca parametreli sorgular (`mysql2` placeholder'ları).
- `helmet` güvenlik başlıkları etkin.

## Uç noktalar

Tüm hatalar `{ error: { code, message } }` biçiminde, mesajlar Türkçedir.

### Herkese açık

- `GET /health` → `{ ok, db, version }`
- `GET /products?category=&includeHidden=0|1` — `includeHidden=1` yalnızca geçerli bir yönetici
  oturumu (cookie) varsa etkilidir; aksi halde yok sayılır (gizli ürünler asla sızmaz).
- `GET /products/:slug`
- `GET /content` → `{ fields, brandMedia }`
- `GET /settings` → `{ settings }`
- `POST /coupons/validate` `{ code, subtotal }` — indirim kodu doğrulama (30 / 15 dk / IP; bkz. "Kuponlar")
- `POST /orders` — sipariş oluşturur; fiyat/stok DB'den doğrulanır, toplamlar sunucuda hesaplanır
  (üyelik indirimi yalnızca oturumu açık ve `discount_eligible` müşteri için), stok transaction
  içinde düşülür.
- **Üyelik indirimi — yalnızca ilk sipariş:** `memberDiscount.firstOrderOnly` (varsayılan `true`;
  alan yoksa da `true` sayılır) açıkken indirim, müşterinin `status IN ('new','paid','shipped')`
  (007 sonrası `'pending_payment'` de sayılır) hiçbir siparişi yoksa uygulanır (iptal edilenler sayılmaz → ilk sipariş iptal edilirse hak geri
  gelir). `createOrder` müşteri satırını `FOR UPDATE` kilitler; aynı müşterinin eşzamanlı iki
  siparişinden yalnızca biri indirim alır. `GET /account/me` → `discountEligible` bu kurala göre
  dinamik hesaplanır, ek alan `discountUsed` (aktif siparişi var mı). `false` → eski davranış
  (bayrak 1 olan üyeye her siparişte). Kural durum listesi: `services/orders.js → ACTIVE_ORDER_STATUSES`.
- `POST /orders` yanıtı `{ order, accessToken }` — `accessToken` yalnızca bu anda, bir kez döner
  (DB'de yalnızca SHA-256 hash'i). İstek gövdesine isteğe bağlı `locale: 'tr'|'en'` eklenebilir
  (sipariş onay e-postasının dili). Sipariş sonrası müşteriye onay, `ADMIN_NOTIFY_EMAIL`
  tanımlıysa yöneticiye bildirim e-postası kuyruğa alınır (yanıtı bekletmez).
- `GET /orders/:id` — yalnızca (a) siparişi oluşturan müşterinin oturumu veya
  (b) `Authorization: Bearer <accessToken>` başlığı ile; yetkisiz/yanlış/yok → ayırt edilemez 404.
  Sorgu parametresiyle token KABUL EDİLMEZ (erişim günlüklerine düşmesin diye).
- `POST /account/register` (`{ name, email, password, locale? }`; hoş geldin + e-posta doğrulama
  e-postası kuyruğa alınır), `POST /account/login`, `POST /account/logout`, `GET /account/me`
- `POST /account/verify-email/request` (oturum gerekli; yeni doğrulama bağlantısı),
  `POST /account/verify-email` `{ token }`, `GET /account/verify-email/status` (oturum gerekli)
- `POST /account/password/forgot` `{ email, locale? }` — hesap var/yok sızdırılmaz, her zaman
  `{ ok: true }`; 60 dk geçerli tek kullanımlık bağlantı `SITE_URL/sifre-sifirla?token=…`
- `POST /account/password/reset` `{ token, password }` — token tek kullanımlık; çerez temizlenir.
- `GET /account/orders` (oturum gerekli) → `{ orders }` — oturumdaki müşterinin siparişleri, yeniden
  eskiye, en fazla 50, `GET /orders/:id` ile aynı biçimde (`items` dahil). Misafir siparişleri
  (customer_id NULL) hesaba bağlanmaz.
- Adres defteri (oturum gerekli, tablo `customer_addresses`, migration `004`):
  `GET /account/addresses` → `{ addresses }` (varsayılan önce);
  `POST /account/addresses` → `201 { address }`; `PUT /account/addresses/:id` → `{ address }`;
  `DELETE /account/addresses/:id` → `{ ok }`; `POST /account/addresses/:id/default` → `{ address }`.
  Gövde: `{ label?, firstName, lastName, phone, address, district, city, postalCode, country?, isDefault? }`
  (kurallar `POST /orders` → `delivery` ile aynı; telefon 5–32 karakter). Müşteri başına en fazla
  10 adres → `409 address_limit`. İlk adres otomatik varsayılan olur; varsayılan silinirse en eski
  kalan adres varsayılan olur. Başkasına ait / olmayan / sayısal olmayan id → ayırt edilemez `404`.

### Yönetici (`requireAdmin`, cookie `tsc_admin`)

- `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`
- `GET /admin/products` (gizliler dahil)
- `PUT /admin/products/:id` (kısmi güncelleme)
- `POST /admin/products` (yeni ürün; id `urun-NN` otomatik üretilir)
- `GET /admin/content`, `PUT /admin/content`, `PUT /admin/brand-media`
- `GET /admin/settings`, `PUT /admin/settings`
- `POST /admin/upload` (multipart: `file` + `name`; `name` alanı formda `file`'dan ÖNCE olmalı)
- `GET /admin/orders?q=&status=&from=&to=&page=&pageSize=`, `GET /admin/orders/:id`,
  `PATCH /admin/orders/:id` `{status?, carrier?, trackingNumber?, adminNote?}` (bkz. "Kargo takibi"),
  `POST /admin/orders/:id/refund` (bkz. "Ödeme (iyzico)")
- `GET /admin/users`
- `POST /admin/users`, `PATCH /admin/users/:id` — **yalnızca owner** (`requireOwner`)
- `GET /admin/export`, `POST /admin/import` (yalnızca owner) — bkz. "Bilinen sınırlar"
- `GET /admin/inventory` — stok özeti (bkz. "Stok takibi")
- `GET/POST /admin/coupons`, `PUT/DELETE /admin/coupons/:id` (bkz. "Kuponlar")
- `GET /admin/customers`, `GET/PATCH /admin/customers/:id`, `GET /admin/stats` (bkz. "Müşteriler ve istatistik")
- `GET /admin/analytics?range=7d|30d|90d|12m` (bkz. "Analitik")

## Analitik

Birinci taraf, çerez onayına saygılı olay toplama. Migration `010_analytics.sql` (`analytics_events`),
servis `src/services/analytics.js`, rotalar `src/routes/events.js` ve `src/routes/admin-analytics.js`.

- **`POST /events`** (herkese açık; `originCheck`'ten geçer, auth yok): gövde `{ events: [ … ] }`, tek istekte en
  fazla 20 olay. Olay türleri: `page_view | product_view | add_to_cart | search | checkout_start | order_complete |
  consent | favorite_add`; alanlar `path` (`/` ile başlar, sorgu/hash yok, ≤255), `locale`, `vid`/`sid` (32 hex ya da
  null), `entry`, `ref`, `utm{source,medium,campaign}`, `vw`, `productId`, `query` (≤120), `value` (0..9.999.999),
  `meta` (düz JSON nesnesi, ≤1 KB). Yanıt her zaman **204**; yalnızca geçersiz gövde **400 `validation_error`**.
  Bot UA'ları (`bot|crawler|spider|headless|lighthouse|curl|wget|python-requests`) sessizce 204 ile atlanır.
  Hız sınırı **120 istek / dk / IP**.
- **Gizlilik:** IP adresi ve ham User-Agent **saklanmaz** — UA'dan yalnızca cihaz sınıfı (`desktop|mobile|tablet|other`),
  tarayıcı ve işletim sistemi adı türetilir (`parseUserAgent`; UA belirsizse `vw` yedek). Ziyaretçi/oturum kimlikleri
  (`vid`/`sid`) yalnızca mağazada analitik çerez onayı varsa gelir, onaysız ziyaretçi NULL ile sayılır (sayfa
  görüntüleme/ziyaret yine sayılır, ziyaretçi/oturum sayılmaz). `is_member` yalnızca "müşteri çerezi geçerli mi"
  bayrağıdır; müşteri kimliği olaya yazılmaz. Kendi alan adımızdan gelen `ref` (CORS_ORIGIN/SITE_URL host'ları) NULL
  (doğrudan ziyaret) sayılır; `www.` öneki atılır.
- **Saklama süresi:** ayar `analytics.retentionDays` (yalnızca `GET/PUT /admin/settings`; varsayılan 400, en az 30).
  Ingest her ~200 istekte bir süresi dolan satırlardan en fazla 5000'ini siler (`maybePrune`).
- **`GET /admin/analytics?range=7d|30d|90d|12m`** (`requireAdmin`; varsayılan `30d`, geçersiz → 400): `AnalyticsOverview`
  — `tracking` (ilk olay, olay sayısı, onaylı pay, saklama günü), `kpis` (pageviews, visits, visitors, sessions, orders,
  revenue, conversion, aov; her biri `{ value, previous }`, önceki dönem yoksa `previous: null`), günlük `series` (boş
  günler 0), `hours`/`weekdays`/`heatmap` (page_view), `devices`/`browsers`/`os`/`locales`, `referrers`, `campaigns`,
  `pages`, `products` (ad `products` tablosundan; satış `order_items`), `searches`, `funnel` (onaylı oturum varsa
  `basis:'sessions'`, yoksa `'events'`), `consent`, `sales` (durum/kupon/şehir/saat/dil), `customers`. Sipariş metrikleri
  `status IN ('new','paid','shipped')` ile sayılır; `sales.byStatus` demo hariç tüm durumları içerir. Gün/saat kovaları
  İstanbul (UTC+3) takvimine göredir; aralık sınırları `istanbulDayStartEpoch` ile epoch olarak hesaplanır, kovalar
  `UNIX_TIMESTAMP` üzerinden türetilir (DB oturum saat diliminden bağımsız). Yanıt ~25 parametreli sorguyla üretilir.
- **"Beni hatırla"**: `POST /account/login` gövdesine `remember: true` eklenirse müşteri çerezi 30 gün kalıcı
  (`Max-Age=2592000`) ve JWT 30 gün; verilmezse **oturum çerezi** (Max-Age/Expires yok) + 24 saatlik JWT.
  `POST /account/register` her zaman 30 gün kalıcı oturum açar.

## Stok takibi

- **Aşırı satış yok:** `POST /orders` aynı varyantın satırlarını toplar, her `product_stock` satırını
  sabit sırada `SELECT … FOR UPDATE` ile kilitler ve `qty >= istenen` kontrol eder. Yetersiz varyantların
  TÜMÜ tek yanıtta döner, transaction geri alınır:
  `409 { error: { code: 'insufficient_stock', message, details: [{ productId, colorId, size, requested, available }] } }`.
  Düşüm ayrıca `UPDATE … WHERE qty >= ?` ile korunur. Paralel siparişler stoğu aşamaz (MariaDB 10.11:
  stok 3'e 6 paralel 1'er adet → 3×201 + 3×409, stok 0). Sipariş `cancelled` olunca stok geri yüklenir.
- **Stok yazımı:** `PUT /admin/products/:id` `{ stock: { [colorId]: { [size]: qty } } }` — qty 0..9999 tam
  sayı; negatif/ondalık/bilinmeyen beden → `400 validation_error`. Ayrı bir `/stock` uç noktası yoktur.
- **`GET /admin/inventory`** → `{ threshold, totalUnits, lowStockCount, outOfStockCount, products: [{ productId,
  number, name, hidden, totalStock, variantCount, outOfStockVariants, lowStockVariants: [{ productId, colorId,
  colorLabel, size, qty }] }] }`. Kural: `qty = 0` tükendi, `1..threshold` düşük stok (örtüşmez). Yalnızca
  ürünün tanımlı renkleri × `XS..XL` sayılır.
- **Ayarlar** (yalnızca `GET /admin/settings`; public `/settings`'e girmez): `inventory.lowStockThreshold`
  (varsayılan 3), `catalog.newBadgeDays` (varsayılan 30). Anahtar yoksa/geçersizse varsayılan kullanılır;
  `npm run seed` dolu tabloda yalnızca eksik varsayılan anahtarları ekler.
- **"Yeni" rozeti** (`migrations/006_inventory.sql`, `products.new_badge_auto`): ürün yanıtında
  `newBadge: 'on' | 'auto' | 'off'`, `isNewManual` (ham `is_new`), `createdAt` ve etkin `isNew`
  (`on` → true; `auto` → `created_at` son `catalog.newBadgeDays` gün içindeyse; `off` → false).
  `PUT/POST /admin/products` `newBadge` ya da boolean `isNew` (true → `on`, false → `off`) kabul eder.
  Mevcut ürünler migration'da `on/off` olarak kalır (davranış değişmez); panelden yeni eklenen ürün
  varsayılan `auto`. `GET /products?category=yeni-gelenler` aynı kuralla süzülür.

## Çok dilli içerik

Panelden girilen içerik Türkçe (varsayılan) + isteğe bağlı İngilizce saklanır
(`migrations/005_content_locale.sql`): `content_fields.value_en`, `products.name_en` /
`description_en` / `fabric_care_en`, `product_colors.label_en`. EN değeri NULL ya da boşsa mağaza
`/en` sitesinde yerleşik İngilizce varsayılan metne (`src/data/contentTexts.ts → contentTextsEn`),
o da yoksa Türkçe değere düşer. Sunucu boş EN metni her zaman `null` olarak saklar.

- `GET /content`, `GET /admin/content` → `{ fields, fieldsEn, brandMedia }`; `fieldsEn` yalnızca DOLU
  EN değerleri içerir (geriye uyumlu ek alan).
- `PUT /admin/content` gövdesi eskisi gibi düz `anahtar → metin|null` (TR) sözlüğüdür; ek olarak
  `fieldsEn: { anahtar: metin|null }` kabul eder (null EN değerini temizler). Yanıt `{ fields, fieldsEn }`.
  Bir dilin yazılması diğer dile dokunmaz.
- Ürün nesnesi (`GET /products`, `/products/:slug`, `/admin/products`): `nameEn`,
  `content.descriptionEn`, `content.fabricCareEn`, `colors[].labelEn` (her biri `string | null`).
- `PUT/POST /admin/products`: `nameEn`, `descriptionEn`, `fabricCareEn`, `colors[].labelEn`
  (opsiyonel; null/boş temizler). `colors` gönderilip bir rengin `labelEn`'i verilmezse o rengin
  mevcut EN etiketi korunur.
- `GET /admin/export` / `POST /admin/import`: `data.content.fieldsEn` ve ürün EN alanları taşınır
  (export → import → export birebir aynı; MariaDB 10.11 ile doğrulandı).
- Sınır: `delivery_returns` için EN sütunu yoktur; sipariş kalemleri (`order_items`) ve e-postalar
  ürün/renk adını Türkçe saklar.

## Ödeme (iyzico)

iyzico **Ödeme Formu (Checkout Form)** — yönlendirme modeli. Kart verisi sunucumuza hiç gelmez: müşteri
iyzico'nun barındırdığı sayfada kartını girer (3D Secure iyzico tarafından yürütülür). Sayfa mağazaya
gömülmez (CSP `script-src 'self'`, `form-action 'self'`); tarayıcı `paymentPageUrl`'e yönlendirilir.
Kod: `src/services/payments/` (`index.js` sağlayıcı seçimi, `iyzico.js` SDK, `fake.js` yerel test,
`service.js` akış), `src/routes/payments.js`, `migrations/007_payments.sql`, `scripts/sweep-pending.js`.

### Akış

```
Mağaza                         API                                   iyzico
POST /orders ───────────────▶ sipariş 'pending_payment' (stok ayrıldı, indirim hakkı "kullanıldı")
          ◀── { order, accessToken, payment: { required: true } }
POST /payments/init ────────▶ checkoutFormInitialize ─────────────▶ { token, paymentPageUrl }
   (Bearer accessToken)       payments satırı 'initialized'
          ◀── { paymentPageUrl }
window.location.assign(paymentPageUrl) ───────────────────────────▶ kart + 3D Secure
                              POST /payments/iyzico/callback ◀───── tarayıcı, form-urlencoded token
                              checkoutFormRetrieve ───────────────▶ sonuç (+ imza)
                              doğrula → 'paid' + e-postalar | 'failure' (sipariş pending kalır)
          ◀── 302 {SITE_URL}[/en]/odeme/sonuc/<id>?odeme=basarili|basarisiz
```

### Uç noktalar

- `POST /orders` — `PAYMENT_PROVIDER` ≠ none iken sipariş `pending_payment` oluşur, yanıt
  `{ order, accessToken, payment: { required: true } }`; onay e-postaları ödeme BAŞARILI olunca gider.
  `none` iken eski davranış (`new`, e-postalar hemen; `payment.required: false`).
- `POST /payments/init` `{ orderId }` + `Authorization: Bearer <accessToken>` ya da sahibi müşteri
  oturumu → `{ paymentPageUrl }`. Hatalar: `404` (yetkisiz/yok), `409 already_paid | order_not_payable |
  payments_disabled`, `429 too_many_attempts` (sipariş başına 10 deneme), `502 payment_init_failed`.
  20 istek / 15 dk / IP.
- `POST /payments/iyzico/callback` — iyzico'nun (tarayıcı üzerinden) form-urlencoded `token` POST'u.
  **originCheck/CSRF'den muaftır ve çerez okumaz** (app.js'de `express.json`/`originCheck`'ten önce
  bağlanır); güvenlik, token'ın bizim `payments` kaydımızda olmasından ve sunucudan sunucuya
  `retrieve` doğrulamasından gelir. Bilinmeyen token sağlayıcıya hiç sorulmaz. Yanıt her durumda `302`.
  60 istek / 15 dk / IP.
- `GET /payments/status/:orderId` (Bearer / oturum) → `{ status, paymentStatus, lastError }`.
- `GET /admin/orders`, `GET /admin/orders/:id` → her siparişte `payment` (durum, paymentId, taksit,
  kart kuruluşu/ailesi, son 4 hane, fraudStatus, hata) ve `paymentAttempts`.
- `POST /admin/orders/:id/refund` — tam iade: önce `cancel` (aynı gün, gün sonu mutabakatından önce;
  ekstreye yansımaz), olmazsa her `paymentTransactionId` için `refund` (365 güne kadar). Başarıda
  sipariş `cancelled` (stok geri) + `payments.status='refunded'`. Kısmen başarısız iade tekrar
  denenebilir (tamamlanan kalemler `refunded_transaction_ids`'te tutulur, yeniden iade edilmez).
  Yetki: tüm yöneticiler (sipariş durum değişikliğiyle aynı kural).
- `PATCH /admin/orders/:id` kuralları: `pending_payment` elle seçilemez; `pending_payment` sipariş elle
  yalnızca `cancelled` yapılabilir; sağlayıcı etkinken `paid` elle seçilemez; iade edilmemiş başarılı
  ödemesi olan sipariş durum seçiciyle iptal edilemez (`409 use_refund` → iade uç noktası).
- `GET /settings` → `payment.provider` (env'deki gerçek değer: none|iyzico|fake; tabloya yazılmaz,
  `PUT /admin/settings` ile yazılamaz) ve `payment.installments` (panel ayarı > env).

### Doğrulama kuralları (callback)

`status=success`, `paymentStatus=SUCCESS`, `currency=TRY`, `conversationId` = `basketId` = sipariş no,
`token` eşleşmesi, `fraudStatus ≠ -1`, `price` (sepet toplamı) birebir, `paidPrice` tek çekimde birebir.
Taksitte (installment > 1) vade farkı müşteriye yansıtılıyorsa `paidPrice` büyük olabilir:
`beklenen ≤ paidPrice ≤ beklenen × 1,5` kabul edilir, gerçek tahsilat `payments.paid_price`'a yazılır.
Yanıt imzası (HMAC-SHA256, secret key; `paymentStatus:paymentId:currency:basketId:conversationId:paidPrice:price:token`,
fiyatların sondaki sıfırları atılarak) varsa doğrulanır, yanlışsa reddedilir. Tutarlar kuruş (tam sayı)
ile karşılaştırılır. Sepet: her satır `birim fiyat × adet`; kargo > 0 ise ayrı "Kargo" kalemi;
`price` = ara toplam + kargo, `paidPrice` = indirim sonrası genel toplam. Callback tekrarları
idempotenttir (durum ve e-posta bir kez). `fraudStatus=0` (incelemede) ödeme kabul edilir ama
yöneticiye "onay gelmeden kargolamayın" uyarısı gider ve panelde gösterilir.

### Süre dolumu (30 dk)

Ödenmeyen `pending_payment` sipariş, oluşturulmasından 30 dk sonra `cancelled` olur (stok ve üyelik
indirimi hakkı geri gelir). Son 30 dk içinde başlatılmış açık bir ödeme denemesi varsa sipariş o
deneme bitene kadar korunur (en fazla ~60 dk). Başarılı ödemesi olan sipariş asla süpürülmez.
Süpürme: `POST /orders`, `POST /payments/init`, `GET /admin/orders` çağrılarında tembel (süreç
başına dakikada en fazla bir kez) + cron:

```
*/5 * * * * cd ~/api && /home/teshvikiyeadmin/nodevenv/api/22/bin/node scripts/sweep-pending.js >> ~/logs/sweep-pending.log 2>&1
```

(Node yolu cPanel "Setup Node.js App" ekranındaki sanal ortamdan alınmalıdır.) İptalden SONRA gelen
başarılı ödeme: stok yeniden ayrılabiliyorsa sipariş `paid` olur (`late_payment_recovered`); ayrılamıyorsa
ödeme otomatik iade edilir (`late_payment_refunded`) ve yöneticiye bildirim gider.

### Kurulum ve sandbox → canlı

1. `npm install` (`iyzipay` bağımlılığı), `npm run migrate` (007), `npm run seed` (eksik ayar anahtarı eklenir).
2. **Sandbox:** sandbox-merchant.iyzipay.com'da hesap aç → API/secret anahtarı → `.env`:
   `PAYMENT_PROVIDER=iyzico`, `IYZICO_API_KEY`, `IYZICO_SECRET_KEY`, `IYZICO_BASE_URL=https://sandbox-api.iyzipay.com`,
   `SITE_URL=https://teshvikiye.com` (callback adresi buradan üretilir) → Passenger restart.
3. Sandbox test kartları (SKT gelecekte herhangi bir tarih, CVC herhangi 3 hane):
   başarılı `5526 0800 0000 0006` (Akbank MC kredi), `5890 0400 0000 0016` (Akbank MC banka),
   `4766 6200 0000 0001` (Denizbank Visa); başarısız `4111 1111 1111 1129` (yetersiz bakiye),
   `4129 1111 1111 1111` (banka reddi), `4124 1111 1111 1116` (geçersiz CVC),
   `4151 1111 1111 1112` (3DS başlatılamadı).
4. **Canlı:** merchant.iyzipay.com canlı anahtarları + `IYZICO_BASE_URL=https://api.iyzipay.com` → restart.
   Canlıda iyzico üye işyeri onayı (web sitesi denetimi: mesafeli satış sözleşmesi, iade koşulları,
   iletişim bilgisi, iyzico logosu) tamamlanmış olmalıdır.
5. Cron satırını ekleyin (yukarıda). `ADMIN_NOTIFY_EMAIL` tanımlayın (ödeme uyarıları buraya gider).
6. Sağlayıcıyı kapatmak için `PAYMENT_PROVIDER=none` + restart (bekleyen siparişler süpürmeyle düşer —
   cron ya da `npm run sweep-pending`).

### Güvenlik notları

- Anahtarlar yalnızca `.env`; hiçbir yanıt/logda anahtar ya da kart verisi yoktur. `payments.raw_result`
  beyaz listeli özettir (kart token'ı, BIN, `cardUserKey` saklanmaz); yalnızca kart kuruluşu/ailesi ve son 4 hane.
- Tutar, para birimi ve sipariş eşleşmesi daima sunucuda DB'deki `payments` satırına göre doğrulanır;
  istemcinin gönderdiği hiçbir tutar kullanılmaz.
- `buyer.identityNumber`: TC kimlik no toplanmadığı için iyzico'nun kabul ettiği yer tutucu
  `11111111111` gönderilir (bkz. `iyzico.js` → `PLACEHOLDER_IDENTITY_NUMBER`).
- `fake` sağlayıcı yalnızca `NODE_ENV!=='production'`de açılır (env doğrulaması üretimde reddeder); sahte
  ödeme uç noktası `GET /payments/fake/pay?token=…&result=success|failure|amount_mismatch|fraud` da yalnızca
  o zaman bağlanır. Durumu süreç belleğindedir (tek süreç, yeniden başlatmada sıfırlanır).
- `npm audit`, iyzipay'in bağımlılığı `postman-request` zincirinde uyarılar gösterir (SDK'nın kendi
  bağımlılığı; `audit fix --force` SDK'yı bozacağından uygulanmadı).

### Test

- `npm test` — iyzico sağlayıcısı birim testleri (ağsız): istek gövdesi/tutar kuralları, sahte SDK istemcisiyle
  initialize/retrieve/cancel/refund parametreleri, openssl ile bağımsız hesaplanmış imza vektörleri, GERÇEK
  iyzipay SDK'sının yerel sahte sunucuya gönderdiği gövde/uç nokta/`IYZWSv2` başlığı, `validateRetrieve` kuralları.
- Uçtan uca: `PAYMENT_PROVIDER=fake` + MariaDB 10.11 ile sipariş → init → callback (başarı/başarısızlık/tutar
  uyuşmazlığı/fraud/tekrar), süre dolumu, geç ödeme, iade ve durum kuralları doğrulandı (24.09.2026).

## Kuponlar

Migration `008_coupons.sql`: `coupons`, `coupon_redemptions` (sipariş başına en fazla bir satır), `orders.coupon_code`,
`orders.coupon_discount`. Servis: `src/services/coupons.js`.

| Uç nokta | Yetki | Gövde / yanıt |
| --- | --- | --- |
| `POST /coupons/validate` | herkese açık, isteğe bağlı müşteri oturumu; **30 / 15 dk / IP** | `{ code, subtotal }` → `{ valid, code, type, value, minSubtotal, discountAmount }`; geçersizde **200** + `{ valid:false, code, discountAmount:0, reason, message }` |
| `GET /admin/coupons` | `requireAdmin` | `{ coupons:[{ id, code, type, value, minSubtotal, usageLimit, perCustomerLimit, startsAt, expiresAt, active, usedCount, createdAt }] }` |
| `POST /admin/coupons` | `requireAdmin` | `{ code, type:'percent'\|'fixed', value, minSubtotal?, usageLimit?, perCustomerLimit?, startsAt?, expiresAt?, active? }` → 201 `{ coupon }` |
| `PUT /admin/coupons/:id` | `requireAdmin` | aynı alanlar, kısmi → `{ coupon }` |
| `DELETE /admin/coupons/:id` | `requireAdmin` | kullanılmamışsa silinir → `{ ok:true }`; kullanılmışsa `active=0` → `{ ok:true, deactivated:true }` |

Kurallar:
- **Kod** büyük harfe çevrilir; 4–40 karakter, `[A-Z0-9_-]` (kısa kodlar tahmine açık). Tarihler ISO 8601; DB'de UTC saklanır, `…Z` döner.
- **İndirim**: `percent` → ara toplam × değer / 100 (0 < değer ≤ 100), `fixed` → min(değer, ara toplam). Hesap kuruş cinsinden tam sayıyla.
- **Doğrulama sırası**: aktif → başlangıç → bitiş → `minSubtotal` → `usageLimit` (`used_count`) → `perCustomerLimit`
  (aynı `customer_id` **veya** aynı e-posta — küçük harfe çevrilir — ile yapılmış kullanımlar). Hata kodları:
  `coupon_not_found`, `coupon_inactive`, `coupon_not_started`, `coupon_expired`, `coupon_min_subtotal` (400);
  `coupon_usage_limit`, `coupon_customer_limit` (409).
- **`POST /orders` → `couponCode?`**: kupon transaction içinde `FOR UPDATE` kilitlenir (sıra: müşteri → ürün/stok → kupon),
  doğrulanır, `used_count` artar ve `coupon_redemptions` satırı yazılır. Geçersiz kod siparişi 400/409 ile reddeder.
- **Üyelik (ilk sipariş) indirimi ile kupon birlikte uygulanmaz**: yüksek olan uygulanır, eşitlikte kupon. Üyelik indirimi
  kazanırsa kupon sessizce düşer (`order.coupon = null`, kullanım yazılmaz). Kupon kazanırsa `discountPercent = 0` ve
  üyenin ilk sipariş hakkı **tüketilmez**: `customerHasActiveOrder` kupon uygulanıp üyelik indirimi uygulanmayan
  siparişleri saymaz (kuponsuz siparişlerde davranış eskisiyle aynı).
- **İptal** (`setOrderStatusInTx` → yönetici, süre dolumu, iade): kullanım satırı silinir, `used_count` azalır.
  İptal geri alınırsa (yönetici ya da süresi dolmuş siparişe geç ödeme) kullanım limit denetimi olmadan yeniden yazılır.
- **Yanıt**: `formatOrder` → `coupon: { code, discount } | null`, `totals.couponDiscount`. Sipariş e-postalarında kupon satırı.
- **iyzico**: `price` = kalemler + kargo (değişmez), `paidPrice` = `totals.total` (kupon/üyelik indirimi sonrası + kargo).
  Tahsil edilecek tutar 0 olacaksa (ör. %100 kupon ve kargo tanımsız) çevrim içi ödemede sipariş **400 `zero_total`**.
- **`POST /orders` → `expectedTotal?`**: mağazanın gösterdiği genel toplam; sunucu hesabından 0,01 TL'den fazla farklıysa
  **409 `price_changed`** + `details: { expectedTotal, currentTotal, lines:[{ productId, colorId, size, unitPrice }] }`.
- **Ücretsiz kargo**: ayar `shipping.freeOver` (sayı | null; public). `shipping.amount` null ise kargo "bildirilecek" kalır
  (değişmedi). Tanımlıysa, indirimler SONRASI ara toplam ≥ `freeOver` → kargo 0; aksi hâlde `shipping.amount`.
  Mağaza (`src/lib/cart.ts`) aynı kuralı uygular ve "Ücretsiz kargo" gösterir.

## Kargo takibi

Migration `009_orders_shipping.sql`: `orders.carrier`, `tracking_number`, `shipped_at` (UTC), `admin_note`.

- `PATCH /admin/orders/:id` gövde `{ status?, carrier?, trackingNumber?, adminNote? }` (en az biri; boş metin → null).
  Durum kuralları korunur; ek olarak `demo` gerçek siparişe verilemez ve demo sipariş başka duruma alınamaz (409
  `status_not_allowed`). **İptalden çıkışta** (`cancelled → …`) stok aynı transaction'da yeniden ayrılır; yetmezse
  **409 `insufficient_stock`** ve hiçbir şey değişmez.
- `shipped`'e **geçişte** `shipped_at` set edilir ve commit sonrası müşteriye `orderShipped` e-postası (TR/EN; firma, takip
  no, varsa takip bağlantısı) gider; zaten `shipped` olan siparişe tekrar gönderilmez.
- `formatOrder` → `shipping: { carrier, trackingNumber, trackingUrl, shippedAt }`. `trackingUrl` Yurtiçi/Aras/MNG/PTT/
  Sürat/UPS için ad eşleşmesiyle üretilir (`src/services/shipping.js`; kalıplar canlıda gerçek numarayla doğrulanmalı),
  bilinmeyen firmada null. `adminNote` yalnızca yönetici yanıtlarında; `POST /orders`, `GET /orders/:id`,
  `GET /account/orders` yanıtlarında alan hiç yoktur.
- `GET /admin/orders?q=&status=&from=&to=&page=&pageSize=` → `{ orders, total, page, pageSize }`. `q`: sipariş no /
  e-posta / "ad soyad" (LIKE). `from`/`to`: `YYYY-MM-DD` (İstanbul günü, `to` dahil) ya da ISO. `page`/`pageSize`
  verilmezse eşleşen tüm siparişler döner (geriye uyumlu); `pageSize` en fazla 200.

## Müşteriler ve istatistik

- `GET /admin/customers?q=&page=&pageSize=` → `{ customers:[{ id, name, email, createdAt, ordersCount, totalSpent,
  discountEligible, discountUsed, lastOrderAt }], total, page, pageSize }`. `q`: ad / e-posta. `ordersCount`: demo hariç tüm
  siparişler; `totalSpent`: `paid`+`shipped` (+ `PAYMENT_PROVIDER=none` iken `new`) toplamı. `discountEligible` yöneticinin
  bayrağıdır (`customers.discount_eligible`); fiili hak = bayrak && !`discountUsed`.
- `GET /admin/customers/:id` → `{ customer, orders (formatOrder + payment, adminNote dahil), addresses }`.
- `PATCH /admin/customers/:id` `{ discountEligible: boolean }` → `{ customer }`. Parola hash'i hiçbir yanıtta yoktur.
- `GET /admin/stats[?includeNew=1|0]` → `{ today:{orders,revenue}, week:{…}, month:{…}, pendingPayment, lowStock,
  lowStockThreshold, includeNew, recentOrders }`. Sayılan durumlar: `paid`+`shipped` (+ `includeNew` ise `new`;
  parametre yoksa `PAYMENT_PROVIDER=none` iken açık). Pencereler İstanbul takvimine göre: bugün 00:00'dan, son 7 gün
  (6 gün önceki 00:00'dan), ayın 1'inden. `lowStock`: sayı — `GET /admin/inventory` → `lowStockCount` ile aynı tanım
  (0 < adet ≤ `inventory.lowStockThreshold` varyant sayısı). `recentOrders`: demo hariç son 10 sipariş.
- **Ürün görseli kaldırma**: `PUT /admin/products/:id` → `media: { front: null }` o yuvanın `product_media` satırını siler;
  dosya yalnızca `UPLOAD_PUBLIC_BASE` altındaki düz bir dosya adıysa, `UPLOAD_DIR` içine çözümleniyorsa ve başka hiçbir
  ürün/marka görseli kullanmıyorsa silinir.
- **Ürün iyimser kilidi**: ürün yanıtında `updatedAt`; `PUT /admin/products/:id` → `expectedUpdatedAt?` DB'dekinden farklıysa
  409 `conflict` + `details.updatedAt`. Her güncelleme `updated_at`'i en az 1 sn ilerletir. Renk listesinden çıkarılan
  rengin stok satırları silinir. Fiyat / kargo ücreti: ≤ 99.999.999,99 ve en fazla 2 ondalık (Türkçe hata mesajları).
- `POST /admin/import` ürünlerde `createdAt`'i (`YYYY-MM-DD HH:MM:SS` ya da ISO) korur; yoksa NOW().
- Giriş hız sınırları (`/auth/login`, `/account/login`) yalnızca başarısız denemeleri sayar (`skipSuccessfulRequests`).

## Bilinen sınırlar / bilinçli tasarım kararları

- **`GET /orders/:id` erişimi** (24.09.2026 güvenlik denetimi): sipariş id'si tek başına yeterli
  değildir; 32 baytlık rastgele `accessToken` (yalnızca oluşturma yanıtında döner, DB'de SHA-256
  hash'i) ya da sahibi müşteri oturumu gerekir. Bulunamayan/yetkisiz durumlar aynı 404'ü döner.
  Bu migration'dan önce oluşturulmuş siparişlerin `access_token_hash` alanı NULL'dır; onlara yalnızca
  sahibi müşteri veya yönetici erişebilir.
- **`/admin/export` ve `/admin/import` kapsamı** (yalnızca owner): ürün katalogu + içerik alanları +
  ayarlar + marka görselleri. `admin_users`, `customers`, `orders`/`order_items` bilinçli olarak
  DIŞARIDA (kişisel veri / parola hash'i / muhasebe geçmişi toplu JSON'da dolaşmasın).
- `POST /admin/users` ve `PATCH /admin/users/:id` yalnızca owner.
- **Sipariş iptali stoğu geri yükler** (`cancelled` → transaction içinde `FOR UPDATE`, idempotent).
  İptalin geri alınması (cancelled → new/paid) stoğu otomatik tekrar düşürmez.
- **Origin/Referer kontrolü**: `CORS_ORIGIN` virgülle ayrılmış birden çok köken alabilir
  (apex + www). Çerezle kimliği doğrulanan mutasyon isteklerinde Origin ya da Referer zorunludur.
- **Parola sıfırlama mevcut oturumları düşürmez**: müşteri JWT'leri durumsuzdur; başka cihazlardaki
  oturumlar süresi dolana kadar geçerli kalır. Gerekirse `customers` tablosuna bir `token_version`
  sütunu eklenip JWT'ye yazılarak zorla çıkış sağlanabilir.
- **`POST /account/register`** `409 email_taken` döndürür (hesap numaralandırmasına açık; 10/15 dk
  hız sınırı var). Login/forgot uç noktaları hesap var/yok farkını sızdırmaz.
- **E-posta sağlayıcı yok** (`MAIL_PROVIDER=none`): tüm e-postalar `mail_log` tablosuna
  `skipped` olarak yazılır, gönderilmez. SMTP hesabı gelince `.env`'de `MAIL_PROVIDER=smtp` +
  `SMTP_*`/`MAIL_FROM` tanımlanır; `nodemailer` yalnızca bu modda dinamik olarak yüklenir.
  Sıfırlama/doğrulama bağlantılarının hedef sayfaları (`/sifre-sifirla`, `/hesap/dogrula`)
  mağaza tarafında henüz yok; API hazır.
- **Passenger'ın `server.js`'i `require()` ile yükleme ihtimali**: Node ≥22.12 bunu ESM için
  destekler; `ERR_REQUIRE_ESM` alınırsa `import('./server.js')` içeren küçük bir `server.cjs`
  yeterli olur. `server.js`/`src/env.js`/`src/db.js` bu yüzden top-level await KULLANMAZ.
- **`trust proxy 1`**: Apache/Passenger'ın `X-Forwarded-For`'u tek güvenilir hop olarak set
  ettiği varsayılır; yerel testte doğrulandı, üretimde gerçek istemci IP'siyle teyit edilmeli.
- `express-rate-limit`'in bellek içi sayacı Passenger'ın her worker sürecine özeldir; çoklu
  worker kurulumunda etkin limit, worker sayısı × ilgili limit olabilir.
- **SVG yüklemesi reddedilir** (`POST /admin/upload`; magic-byte doğrulaması: jpeg/png/webp/avif/
  mp4/webm). Gerekirse ileride yalnızca sunucu tarafında temizlenmiş ayrı bir uç noktada.
- **`GET /settings`** beyaz listelidir (`brand.*`, `memberDiscount` [code/usageLimit hariç],
  `shipping.amount`, `support.*`, `social`, `offerPanel.*`); diğer anahtarlar yalnızca
  `GET /admin/settings` ile görünür.
- Ayar/içerik değerlerinin tam şekli (`memberDiscount`, `social` vb.) `src/config/settings.ts` ve
  `src/data/content.ts` okunarak birebir alınmıştır; `scripts/seed.js` bu varsayılanları yükler.
- MariaDB uyumluluğu: `settings.value` sütunu MySQL 8'de `JSON` tipindedir; MariaDB'de bu, düz metin
  (`LONGTEXT`) olarak davranabilir — `src/services/settings.js` okurken güvenli `JSON.parse`
  denemesi yapar.

## Doğrulama (yerelde MySQL olmadan)

- `cd api && npm install`
- `node --check <dosya>` — tüm `.js` dosyaları
- Dummy env değerleriyle: `node -e "import('./src/app.js').then(()=>console.log('ok'))"` (gerçek
  `.env` olmadan da app kurulabilir; DB havuzu tembeldir, ilk sorguya kadar bağlanmaz)
- Gerçek MySQL/MariaDB varsa: `npm run migrate && npm run seed` ardından `GET /health` içinde
  `db:true` görülmelidir.
