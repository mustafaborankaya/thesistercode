-- E-posta altyapısı: gönderim günlüğü, parola sıfırlama ve e-posta doğrulama belirteçleri.
-- Tüm tablolar idempotent (IF NOT EXISTS). Belirteçler yalnızca SHA-256 hash olarak saklanır.

CREATE TABLE IF NOT EXISTS mail_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  to_email VARCHAR(190) NOT NULL,
  template VARCHAR(64) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  locale VARCHAR(5) NOT NULL DEFAULT 'tr',
  status ENUM('queued','sent','skipped','failed') NOT NULL DEFAULT 'queued',
  provider VARCHAR(32) NOT NULL DEFAULT 'none',
  error VARCHAR(500) NULL,
  ref_type VARCHAR(32) NULL,
  ref_id VARCHAR(64) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMP NULL,
  KEY idx_mail_log_created (created_at),
  KEY idx_mail_log_ref (ref_type, ref_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS password_resets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_password_resets_token (token_hash),
  KEY idx_password_resets_customer (customer_id),
  CONSTRAINT fk_password_resets_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS email_verifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  verified_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_email_verifications_token (token_hash),
  KEY idx_email_verifications_customer (customer_id),
  CONSTRAINT fk_email_verifications_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
