-- 007_payments.sql — çevrim içi ödeme (iyzico Ödeme Formu) altyapısı.
--
-- 1) orders.status: 'pending_payment' eklenir (mevcut değerler aynen korunur). Ödeme sağlayıcısı
--    etkinken (PAYMENT_PROVIDER=iyzico|fake) sipariş bu durumda oluşur; stok rezerve edilir ve
--    üyelik indirimi hakkı "kullanılmış" sayılır (ACTIVE_ORDER_STATUSES). Ödeme başarılı → 'paid';
--    30 dk içinde ödenmezse → 'cancelled' (stok ve indirim hakkı geri gelir).
-- 2) orders.locale: siparişin dili ('tr'|'en') — iyzico ödeme sayfası dili, e-posta dili ve
--    ödeme sonrası mağazaya dönüş adresi (/en öneki) için.
-- 3) payments: her ödeme denemesi bir satır. Kart verisi ASLA saklanmaz; yalnızca sağlayıcının
--    döndürdüğü maskeli/özet alanlar (kart ailesi, son 4 hane) ve beyaz listeli sonuç özeti.

ALTER TABLE orders
  MODIFY COLUMN status ENUM('demo','new','pending_payment','paid','shipped','cancelled') NOT NULL DEFAULT 'new';

ALTER TABLE orders
  ADD COLUMN locale VARCHAR(5) NOT NULL DEFAULT 'tr' AFTER note;

CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id VARCHAR(32) NOT NULL,
  provider VARCHAR(16) NOT NULL,
  conversation_id VARCHAR(64) NOT NULL,
  -- Ödeme formu token'ı (iyzico checkoutFormInitialize yanıtı); callback bununla eşleştirilir.
  token VARCHAR(128) NULL,
  payment_id VARCHAR(64) NULL,
  -- JSON: [{ "id": "<paymentTransactionId>", "paidPrice": 12.5 }, ...] — iade için.
  payment_transaction_ids TEXT NULL,
  -- JSON: iadesi tamamlanan paymentTransactionId listesi (kısmi başarısız iadenin güvenle tekrarlanması için).
  refunded_transaction_ids TEXT NULL,
  status ENUM('initialized','success','failure','refunded') NOT NULL DEFAULT 'initialized',
  price DECIMAL(10,2) NOT NULL,
  paid_price DECIMAL(10,2) NOT NULL,
  installment TINYINT UNSIGNED NULL,
  card_association VARCHAR(32) NULL,
  card_family VARCHAR(32) NULL,
  last_four CHAR(4) NULL,
  -- iyzico fraudStatus: 1 onaylı, 0 incelemede (kargolama bekletilmeli), -1 red.
  fraud_status TINYINT NULL,
  error_code VARCHAR(64) NULL,
  error_message VARCHAR(500) NULL,
  -- Beyaz listeli sonuç özeti (JSON); kart numarası/token/cardUserKey içermez.
  raw_result TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_payments_token (token),
  KEY idx_payments_order (order_id),
  KEY idx_payments_status_created (status, created_at),
  CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
