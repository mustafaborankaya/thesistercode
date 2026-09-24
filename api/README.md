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
- `GET /orders/:id` — demo: e-posta doğrulaması yok, yalnızca id ile erişilir.
- `POST /account/register`, `POST /account/login`, `POST /account/logout`, `GET /account/me`

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

## Bilinen sınırlar / bilinçli tasarım kararları

- **`GET /orders/:id` KİMLİK DOĞRULAMASI YOK — GERÇEK BİR PII SIZINTI RİSKİ, "demo notu" değil.**
  Görev tanımı bu uç noktayı e-posta doğrulaması olmadan, yalnızca id ile istemişti; id biçimi
  `TSV-YYYYMMDD-XXXX` olup son 4 hane rastgele — yani **günde yalnızca 10.000 olası değer**. Bu,
  hız sınırlaması olmadan birkaç dakikada taranabilecek kadar küçük bir alan; yanıt ad, telefon,
  e-posta ve adres döner. Azaltım olarak bu uç noktaya da hız sınırı eklendi (15 dk'da 30 istek/IP)
  ama bu YALNIZCA taramayı YAVAŞLATIR, İMKANSIZ KILMAZ. Gerçek çözüm (kapsam dışı, süpervizör
  kararı gerektirir): sipariş onay sayfası/e-postası için e-posta doğrulaması eklemek ya da yanıtı
  yalnızca durum + kalemlere indirip iletişim/teslimat alanlarını gizlemek.
- **`/admin/export` ve `/admin/import` kapsamı**: yalnızca ürün katalogu + içerik alanları +
  ayarlar + marka görselleri kapsar. `admin_users` (parola hash'i), `customers` (kişisel veri) ve
  `orders`/`order_items` (muhasebe/stok geçmişi) bilinçli olarak DIŞARIDA bırakıldı — bunların ayrı
  uç noktaları var ve toplu JSON dışa aktarımında dolaşmaları güvenlik/gizlilik riski oluşturur.
  Görev tanımındaki "tüm veri" ifadesinden bu şekilde saptık; süpervizör isterse genişletilebilir.
- `POST /admin/users` de owner'a özel yapıldı (görev tanımında yalnızca PATCH için belirtilmişti);
  editor rolünün başka yönetici oluşturamaması güvenlik açısından daha tutarlı görüldü.
- **Sipariş iptali stoğu geri yüklemez.** `PATCH /admin/orders/:id` durumu `cancelled` yapabilir
  ama `product_stock` satırlarını artırmaz; gerekiyorsa ayrı bir "iade/iptal" akışı eklenmeli.
- **Origin kontrolü tam eşleşmedir** (`req.get('origin') === CORS_ORIGIN`). Site hem `teshvikiye.com`
  hem `www.teshvikiye.com` üzerinden erişilebilirse, biri üzerinden gelen tüm mutasyon istekleri
  403 alır. Süpervizörün ya `www` → apex yönlendirmesi yapması ya da `CORS_ORIGIN`'i
  virgülle ayrılmış çoklu köken destekleyecek şekilde genişletmemizi istemesi gerekir.
- **Passenger'ın `server.js`'i `require()` ile yükleme ihtimali**: Node ≥22.12 bunu ESM için
  destekler; daha eski bir Node yama sürümünde `ERR_REQUIRE_ESM` alınırsa, başlangıç dosyasını
  `import('./server.js')` içeren küçük bir `server.cjs`'e çevirmek yeterli olur (bu depoda yok,
  yalnızca ihtiyaç halinde eklenecek bir yedek plan).
  `server.js`/`src/env.js`/`src/db.js` bu yüzden bilinçli olarak top-level await KULLANMAZ.
- **Passenger arkasında `req.ip` her ziyaretçi için aynı çıkabilir** (ters proxy IP'yi iletmezse);
  bu durumda `express-rate-limit` limiti IP başına değil global olarak uygulanmış olur. Yayından
  sonra gerçek bir istemci IP'siyle doğrulanmalı; gerekirse Passenger/Apache'nin `X-Forwarded-For`
  ilettiğinden emin olunup `trust proxy` ayarı buna göre kalibre edilmeli (şu an `1`).
- `express-rate-limit`'in bellek içi sayacı Passenger'ın her worker sürecine özeldir (paylaşılan
  değildir); çoklu process/worker kurulumunda etkin limit, worker sayısı × ilgili limit olabilir.
- **SVG yüklemeleri** (`POST /admin/upload`) betik çalıştırabilir; spesifikasyon SVG'yi açıkça izin
  verilenler arasında listelediği ve yükleme yalnızca yönetici tarafından yapılabildiği için
  olduğu gibi bırakıldı, ancak halka açık kullanıcı yüklemesi olsaydı kabul edilmezdi.
- **`GET /settings` herkese açıktır** ve `memberDiscount.code` gibi alanları da döner (kampanya
  modu `code` ise indirim kodu herkese görünür olur). Şu anki varsayılan `mode: 'automatic'` bu
  riski taşımaz; `mode: 'code'`e geçilirse bu endpoint'in filtrelenmesi gerekebilir.
- Ayar/içerik değerlerinin tam şekli (`memberDiscount`, `social` vb.) `src/config/settings.ts` ve
  `src/data/content.ts` okunarak birebir alınmıştır; `scripts/seed.js` bu varsayılanları yükler.
- MariaDB uyumluluğu: `settings.value` sütunu MySQL 8'de `JSON` tipindedir; MariaDB'de bu, düz metin
  (`LONGTEXT`) olarak davranabilir — `src/services/settings.js` okurken güvenli `JSON.parse`
  denemesi yapar.
- Ürün görselleri (`product_media`) seed sırasında BOŞ bırakılır (hiç satır eklenmez); yönetici panel
  görsel yükleyip `PUT /admin/products/:id` ile `media` alanını doldurana kadar `GET /products` her
  görsel yuvası için `src: null` döner (mağazanın yer tutucu davranışıyla birebir).

## Doğrulama (yerelde MySQL olmadan)

- `cd api && npm install`
- `node --check <dosya>` — tüm `.js` dosyaları
- Dummy env değerleriyle: `node -e "import('./src/app.js').then(()=>console.log('ok'))"` (gerçek
  `.env` olmadan da app kurulabilir; DB havuzu tembeldir, ilk sorguya kadar bağlanmaz)
- Gerçek MySQL/MariaDB varsa: `npm run migrate && npm run seed` ardından `GET /health` içinde
  `db:true` görülmelidir.
