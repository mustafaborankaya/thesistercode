-- 001_init.sql — Teşvikiye API ilk şema (MySQL 8 / MariaDB uyumlu, utf8mb4)

CREATE TABLE IF NOT EXISTS schema_migrations (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(64) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('owner','editor') NOT NULL DEFAULT 'owner',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  last_login_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_admin_users_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(32) NOT NULL PRIMARY KEY,
  number VARCHAR(8) NOT NULL,
  slug VARCHAR(80) NOT NULL,
  name VARCHAR(200) NOT NULL,
  category VARCHAR(32) NOT NULL,
  is_new TINYINT(1) NOT NULL DEFAULT 0,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  description TEXT NULL,
  fabric_care TEXT NULL,
  delivery_returns TEXT NULL,
  hidden TINYINT(1) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_products_slug (slug),
  KEY idx_products_category (category),
  KEY idx_products_hidden (hidden)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_colors (
  product_id VARCHAR(32) NOT NULL,
  color_id VARCHAR(32) NOT NULL,
  label VARCHAR(64) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, color_id),
  CONSTRAINT fk_product_colors_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_stock (
  product_id VARCHAR(32) NOT NULL,
  color_id VARCHAR(32) NOT NULL,
  size VARCHAR(8) NOT NULL,
  qty INT NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, color_id, size),
  CONSTRAINT fk_product_stock_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_media (
  product_id VARCHAR(32) NOT NULL,
  kind ENUM('front','back','model','fabric') NOT NULL,
  url VARCHAR(500) NOT NULL,
  PRIMARY KEY (product_id, kind),
  CONSTRAINT fk_product_media_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_relations (
  product_id VARCHAR(32) NOT NULL,
  related_id VARCHAR(32) NOT NULL,
  type ENUM('similar','complete_look') NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, related_id, type),
  CONSTRAINT fk_product_relations_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS content_fields (
  `key` VARCHAR(120) NOT NULL PRIMARY KEY,
  value TEXT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS settings (
  `key` VARCHAR(120) NOT NULL PRIMARY KEY,
  value JSON NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS brand_media (
  name VARCHAR(64) NOT NULL PRIMARY KEY,
  url VARCHAR(500) NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(190) NOT NULL,
  name VARCHAR(200) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  discount_eligible TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_customers_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(40) NOT NULL PRIMARY KEY,
  customer_id INT NULL,
  status ENUM('demo','new','paid','shipped','cancelled') NOT NULL DEFAULT 'new',
  email VARCHAR(190) NOT NULL,
  phone VARCHAR(32) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  address TEXT NOT NULL,
  district VARCHAR(100) NOT NULL,
  city VARCHAR(100) NOT NULL,
  postal_code VARCHAR(20) NOT NULL,
  country VARCHAR(100) NOT NULL DEFAULT 'Türkiye',
  note TEXT NULL,
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount_percent INT NOT NULL DEFAULT 0,
  discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  shipping DECIMAL(10,2) NULL,
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  KEY idx_orders_status (status),
  KEY idx_orders_customer (customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id VARCHAR(40) NOT NULL,
  product_id VARCHAR(32) NOT NULL,
  product_name VARCHAR(200) NOT NULL,
  color_id VARCHAR(32) NOT NULL,
  color_label VARCHAR(64) NOT NULL,
  size VARCHAR(8) NOT NULL,
  qty INT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  KEY idx_order_items_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
