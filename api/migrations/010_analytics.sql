-- 010_analytics.sql — birinci taraf analitik olayları (POST /events → GET /admin/analytics).
--
-- Gizlilik: ham User-Agent ve IP adresi SAKLANMAZ; UA'dan yalnızca cihaz sınıfı / tarayıcı / işletim
-- sistemi adı türetilir (bkz. services/analytics.js → parseUserAgent). visitor_id / session_id
-- yalnızca analitik çerez onayı varsa istemciden gelir (onay yoksa NULL); is_member müşteri çerezi
-- geçerliyse 1'dir (müşteri kimliği saklanmaz). referrer_host yalnızca giriş (is_entry=1) page_view'de
-- anlamlıdır; kendi alan adımız NULL'a (doğrudan ziyaret) çevrilir.
-- Saklama: `analytics.retentionDays` ayarı (varsayılan 400 gün) — ingest her ~200 istekte bir
-- eski satırları siler. Gün/saat kovaları İstanbul (UTC+3) saatine göre hesaplanır (ts UTC'dir).
-- MySQL 8 / MariaDB 10.11 uyumlu (meta: MySQL'de JSON, MariaDB'de LONGTEXT takma adı).

CREATE TABLE IF NOT EXISTS analytics_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ts TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  type VARCHAR(24) NOT NULL,
  visitor_id CHAR(32) NULL,
  session_id CHAR(32) NULL,
  is_entry TINYINT(1) NOT NULL DEFAULT 0,
  is_member TINYINT(1) NOT NULL DEFAULT 0,
  path VARCHAR(255) NULL,
  locale CHAR(2) NULL,
  referrer_host VARCHAR(120) NULL,
  utm_source VARCHAR(80) NULL, utm_medium VARCHAR(80) NULL, utm_campaign VARCHAR(120) NULL,
  device ENUM('desktop','mobile','tablet','other') NOT NULL DEFAULT 'other',
  browser VARCHAR(40) NULL, os VARCHAR(40) NULL,
  vw SMALLINT UNSIGNED NULL,
  product_id VARCHAR(64) NULL,
  query VARCHAR(120) NULL,
  value DECIMAL(10,2) NULL,
  meta JSON NULL,
  KEY idx_ae_ts (ts), KEY idx_ae_type_ts (type, ts), KEY idx_ae_product (product_id, ts),
  KEY idx_ae_session (session_id), KEY idx_ae_visitor (visitor_id, ts)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
