#!/usr/bin/env node
/**
 * Süresi dolan 'pending_payment' siparişleri iptal eder (stok + üyelik indirimi hakkı geri gelir).
 * API zaten POST /orders, POST /payments/init ve GET /admin/orders çağrılarında tembel süpürme yapar;
 * bu betik trafik olmasa da stoğun zamanında serbest kalması için cron ile çalıştırılır:
 *
 *   * /5 * * * * cd ~/api && /home/teshvikiyeadmin/nodevenv/api/22/bin/node scripts/sweep-pending.js >> ~/logs/sweep-pending.log 2>&1
 *   (Blok yorumu kapanmasın diye "* /5" boşluklu yazıldı; gerçek crontab satırında boşluk YOK — bkz. README.
 *    cPanel'deki Node yolu "Setup Node.js App" ekranında görünür; yukarıdaki örnektir.)
 */
import { pool } from '../src/db.js'
import { sweepExpiredPendingOrders, PENDING_TTL_MINUTES } from '../src/services/payments/service.js'

try {
  const cancelled = await sweepExpiredPendingOrders()
  console.log(`[sweep-pending] ${new Date().toISOString()} — ${PENDING_TTL_MINUTES} dk kuralı: ${cancelled.length} sipariş iptal edildi${cancelled.length ? `: ${cancelled.join(', ')}` : ''}`)
  process.exitCode = 0
} catch (err) {
  console.error('[sweep-pending] hata:', err?.message || err)
  process.exitCode = 1
} finally {
  await pool.end()
}
