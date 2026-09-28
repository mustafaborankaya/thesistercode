-- 009_orders_shipping.sql — kargo takibi ve yönetici notu.
--  carrier / tracking_number: yönetici panelinden (PATCH /admin/orders/:id) girilir.
--  shipped_at: sipariş 'shipped' durumuna GEÇTİĞİNDE set edilir (müşteriye orderShipped e-postası gider).
--  admin_note: yalnızca yönetici yanıtlarında görünür; müşteri uç noktalarında asla dönmez.

ALTER TABLE orders
  ADD COLUMN carrier VARCHAR(60) NULL AFTER total,
  ADD COLUMN tracking_number VARCHAR(100) NULL AFTER carrier,
  ADD COLUMN shipped_at DATETIME NULL AFTER tracking_number,
  ADD COLUMN admin_note TEXT NULL AFTER shipped_at;
