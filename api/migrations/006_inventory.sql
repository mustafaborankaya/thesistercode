-- 006_inventory.sql — "Yeni" rozeti için üç durumlu kural (manuel açık / otomatik / kapalı).
--
-- is_new = 1                       → manuel AÇIK (rozet her zaman görünür)
-- is_new = 0 AND new_badge_auto = 1 → OTOMATİK: created_at son `catalog.newBadgeDays` gün içindeyse rozet
-- is_new = 0 AND new_badge_auto = 0 → KAPALI
--
-- Varsayılan 0: mevcut (ve içe aktarılan) ürünlerin rozeti bugünkü davranışla birebir aynı kalır —
-- canlı katalog yakın tarihte tohumlandığı için varsayılanı "otomatik" yapmak tüm ürünlere 30 gün
-- boyunca YENİ rozeti koyardı. Yalnızca panelden yeni oluşturulan ürünler otomatik kurala girer
-- (bkz. services/products.js → createProduct). Stok tablosunda şema değişikliği yoktur.

ALTER TABLE products
  ADD COLUMN new_badge_auto TINYINT(1) NOT NULL DEFAULT 0 AFTER is_new;
