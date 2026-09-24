# Güvenlik — teshvikiye.com

## Uygulananlar (2026-09-24)

**Erişim ve gizli bilgiler**
- Sunucuya yalnızca SSH anahtarıyla erişilir; parola hiçbir betikte, dosyada veya depoda yok. `deploy.env` ve `.env.local` git dışıdır.
- Veritabanı parolası ve oturum gizli anahtarı sunucuda üretildi ve yalnızca `~/api/.env` (600) içinde durur; depoya veya sohbete hiç girmedi.
- Yönetici paneli kimlik bilgisi derlemede yok: giriş backend API'de doğrulanır (bcrypt), yerel geliştirme kimliği `.env.local` içindedir ve yalnızca `import.meta.env.DEV` iken kullanılır.
- Üretim derlemesi kaynak haritası içermez; `dist/` gizli değer taraması temiz.

**Web sunucusu (`public/.htaccess`)**
- HTTP → HTTPS 301, HSTS (1 yıl, includeSubDomains), Let's Encrypt sertifikası (AutoSSL).
- Content-Security-Policy: yalnızca kendi kaynak; satır içi script yok; `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`.
- X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy (kamera/mikrofon/konum/ödeme kapalı), COOP/CORP same-origin, X-Powered-By kaldırıldı, ServerSignature Off.
- Dizin listesi kapalı; `.env*`, `.git*`, `.htaccess`, `php.ini`, `.user.ini`, `*.sql/.log/.bak/.sh/.md/.json/.map` web'den 403; nokta ile başlayan yollar (ACME hariç) 403; TRACE/TRACK kapalı.
- `uploads/` dizininde script çalıştırma kapalı (PHP engine off, handler yok), yalnızca görsel/video servis edilir ve `CSP: sandbox` ile gönderilir.
- `robots.txt`: `/admin`, `/api`, `/odeme`, `/sepet`, `/hesap` taranmaz.

**Sunucu hesabı**
- `~/api` 711, `~/api/.env` 600, `~/.ssh` 700, `authorized_keys` 600, `~/backups` 700.
- Gece 03:15 otomatik `mysqldump` (gzip, 600 izin, docroot dışında `~/backups`, 14 gün saklama) — `server/backup-db.sh`.
- Sunucuda Imunify360 mevcut (barındırıcı yönetiminde).

**API (Node/Express, Passenger)** — kod teslim olunca uygulanan/denetlenen kurallar
- helmet; oturum httpOnly + Secure + SameSite=Lax çerez (JWT, 12 saat); mutasyonlarda Origin kontrolü; giriş uç noktalarında IP başına hız sınırı; zod ile giriş doğrulama; yalnızca parametreli SQL; bcrypt (cost 12); üretimde hata ayrıntısı/yığın izi dönmez; gövde boyutu sınırı; yükleme MIME/uzantı/boyut kontrolü ve güvenli dosya adı; DB kullanıcısı yalnızca kendi veritabanına yetkili.

## Senin yapman gerekenler (bizim erişemediğimiz katman)
1. **cPanel parolasını hemen değiştir** — sohbette paylaşıldı; artık kullanılmıyor ama ifşa olmuş sayılmalı. Mümkünse parola girişini kapatıp yalnızca anahtar bırak (cPanel → SSH Access).
2. cPanel'de **iki faktörlü doğrulama** (Güvenlik → Two-Factor Authentication) aç.
3. Kullanılmıyorsa **FTP hesaplarını** kapat; cPanel oturum IP kısıtı (varsa) uygula.
4. Barındırıcıdan (crewmedya) doğrula: ModSecurity/Imunify360 WAF etkin, otomatik güncellemeler açık, sunucu düzeyinde günlük yedek alınıyor.
5. Yönetici parolasını panel üzerinden değiştir; yönetici hesabını yalnızca gerekli kişilerle paylaş.

## İlk yayın öncesi kontrol listesi
- `curl -sI https://teshvikiye.com` → HSTS/CSP başlıkları görünür
- `https://teshvikiye.com/.env` → 403; `/uploads/` → 403
- API: `POST /api/auth/login` yanlış parola ile 10+ denemede 429; `GET /api/auth/me` çerezsiz 401
