/**
 * Yönetici gösterge paneli istatistikleri (GET /admin/stats).
 * Zaman pencereleri Europe/Istanbul takvimine göre JS'te epoch saniyesi olarak hesaplanır ve
 * `created_at >= FROM_UNIXTIME(?)` ile karşılaştırılır (sunucu/oturum saat diliminden bağımsız):
 *   today = bugün 00:00'dan, week = son 7 gün (bugün dahil, 6 gün önceki 00:00'dan), month = ayın 1'i 00:00'dan.
 * Sipariş sayısı ve ciro aynı durum kümesinden sayılır: paid + shipped (+ includeNew ise 'new').
 */
import { pool } from '../db.js'
import { getOrderById, istanbulDayStartEpoch, istanbulToday } from './orders.js'
import { revenueStatuses } from './customers.js'
import { getInventorySummary } from './products.js'

export async function getStats({ includeNew = false } = {}) {
  const { y, m, d } = istanbulToday()
  const windows = {
    today: istanbulDayStartEpoch(y, m, d),
    week: istanbulDayStartEpoch(y, m, d - 6),
    month: istanbulDayStartEpoch(y, m, 1),
  }
  const statuses = revenueStatuses(includeNew)
  const inList = statuses.map(() => '?').join(', ')
  const out = {}
  for (const [key, since] of Object.entries(windows)) {
    const [[row]] = await pool.query(
      `SELECT COUNT(*) AS orders, COALESCE(SUM(total), 0) AS revenue FROM orders WHERE status IN (${inList}) AND created_at >= FROM_UNIXTIME(?)`,
      [...statuses, since],
    )
    out[key] = { orders: Number(row.orders), revenue: Math.round(Number(row.revenue) * 100) / 100 }
  }
  const [[pending]] = await pool.query("SELECT COUNT(*) AS n FROM orders WHERE status = 'pending_payment'")
  // lowStock: /admin/inventory → lowStockCount ile aynı tanım (gizliler dahil, 0 < qty ≤ eşik varyant sayısı).
  const inventory = await getInventorySummary()
  const [recent] = await pool.query("SELECT id FROM orders WHERE status <> 'demo' ORDER BY created_at DESC, id DESC LIMIT 10")
  const recentOrders = []
  for (const r of recent) recentOrders.push(await getOrderById(r.id))
  return { ...out, pendingPayment: Number(pending.n), lowStock: inventory.lowStockCount, lowStockThreshold: inventory.threshold, includeNew, recentOrders }
}
