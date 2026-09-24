-- 005_content_locale.sql — yönetici panelinden girilen içerik için İngilizce (EN) değerler.
--
-- Türkçe sütunlar (value, name, description, fabric_care, label) varsayılan dil olarak kalır;
-- *_en sütunları NULL ise mağaza `/en` sitesinde Türkçe değere (ya da yerleşik İngilizce varsayılan
-- metne) düşer. Bu migration 004'e bağımlı değildir. Düz `ADD COLUMN` kullanılır (MySQL 8 ve
-- MariaDB 10.11 uyumlu); tekrar çalıştırmayı scripts/migrate.js → schema_migrations engeller.

ALTER TABLE content_fields
  ADD COLUMN value_en TEXT NULL AFTER value;

ALTER TABLE products
  ADD COLUMN name_en VARCHAR(200) NULL AFTER name,
  ADD COLUMN description_en TEXT NULL AFTER description,
  ADD COLUMN fabric_care_en TEXT NULL AFTER fabric_care;

ALTER TABLE product_colors
  ADD COLUMN label_en VARCHAR(64) NULL AFTER label;
