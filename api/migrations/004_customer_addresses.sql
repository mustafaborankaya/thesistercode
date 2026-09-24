-- 004_customer_addresses.sql — müşteri adres defteri (önceden yalnızca tarayıcı localStorage'ındaydı).
-- Müşteri başına en fazla 10 adres uygulama katmanında (api/src/services/customers.js) sınırlanır;
-- varsayılan adres tekilliği de transaction içinde uygulama tarafından korunur.
-- MySQL 8 / MariaDB 10.11 uyumlu, idempotent (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS customer_addresses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  label VARCHAR(60) NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(32) NOT NULL,
  address TEXT NOT NULL,
  district VARCHAR(100) NOT NULL,
  city VARCHAR(100) NOT NULL,
  postal_code VARCHAR(20) NOT NULL,
  country VARCHAR(100) NOT NULL DEFAULT 'Türkiye',
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_customer_addresses_customer (customer_id),
  CONSTRAINT fk_customer_addresses_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
