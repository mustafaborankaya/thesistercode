-- 008_coupons.sql — indirim kuponları (yönetici panelinden yönetilir) ve sipariş kupon alanları.
--
-- Kurallar (bkz. api/src/services/coupons.js ve services/orders.js → createOrder):
--  - code: büyük harf, [A-Z0-9_-], 4..40 karakter (kısa kodlar numaralandırmaya açık olduğundan).
--  - percent: value 0 < v ≤ 100; fixed: min(value, ara toplam). Kuruş yuvarlama.
--  - starts_at / expires_at: UTC olarak saklanır (API ISO 8601 'Z' ile okur/yazar).
--  - used_count: aktif (iptal edilmemiş) kullanım sayısı; sipariş iptalinde azaltılır ve o siparişin
--    coupon_redemptions satırı silinir (orders.coupon_code tarihçe olarak kalır).
--  - Üyelik (ilk sipariş) indirimi ile kupon birlikte uygulanmaz: yüksek olan uygulanır.
-- MySQL 8 / MariaDB 10.11 uyumlu.

CREATE TABLE IF NOT EXISTS coupons (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(40) NOT NULL,
  type ENUM('percent','fixed') NOT NULL,
  value DECIMAL(10,2) NOT NULL,
  min_subtotal DECIMAL(10,2) NULL,
  usage_limit INT NULL,
  per_customer_limit INT NULL,
  starts_at DATETIME NULL,
  expires_at DATETIME NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  used_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_coupons_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  coupon_id INT NOT NULL,
  order_id VARCHAR(40) NOT NULL,
  customer_id INT NULL,
  email VARCHAR(190) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_coupon_redemptions_order (order_id),
  KEY idx_coupon_redemptions_coupon_customer (coupon_id, customer_id),
  KEY idx_coupon_redemptions_coupon_email (coupon_id, email),
  CONSTRAINT fk_coupon_redemptions_coupon FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE RESTRICT,
  CONSTRAINT fk_coupon_redemptions_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_coupon_redemptions_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE orders
  ADD COLUMN coupon_code VARCHAR(40) NULL AFTER discount_amount,
  ADD COLUMN coupon_discount DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER coupon_code;
