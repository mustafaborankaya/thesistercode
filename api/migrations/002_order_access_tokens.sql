-- 002_order_access_tokens.sql — sipariş görüntüleme erişimini id numaralandırmasına karşı kapatır.
--
-- `GET /orders/:id` artık yalnızca sipariş id'si ile herkese açık değildir: erişim, siparişi
-- oluşturan müşterinin oturumuna VEYA sipariş oluşturulurken üretilip yanıtta bir kez dönen gizli
-- `accessToken`'a bağlıdır. Token'ın kendisi DB'de asla düz metin saklanmaz — yalnızca SHA-256
-- hash'i (64 hex karakter) saklanır (bkz. api/src/services/orders.js).

ALTER TABLE orders
  ADD COLUMN access_token_hash VARCHAR(64) NULL AFTER customer_id;

CREATE INDEX idx_orders_access_token_hash ON orders (access_token_hash);
