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
- `POST /orders` — sipariş oluşturur; fiyat/stok DB'den doğrulanır, toplamlar sunucuda hesaplanır
  (üyelik indirimi yalnızca oturumu açık ve `discount_eligible` müşteri için), stok transaction
  içinde düşülür.
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
- `GET /admin/orders?status=`, `GET /admin/orders/:id`, `PATCH /admin/orders/:id` `{status}`
- `GET /admin/users`
- `POST /admin/users`, `PATCH /admin/users/:id` — **yalnızca owner** (`requireOwner`)
- `GET /admin/export`, `POST /admin/import` (yalnızca owner) — bkz. "Bilinen sınırlar"

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
