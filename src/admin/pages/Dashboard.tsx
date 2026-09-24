import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../../components/ui/Icon'
import { allProducts } from '../../data/catalog'
import { missingBrandMedia } from '../../data/media'
import { listDemoOrders } from '../../services/checkout'
import { getAdminInventory, listAdminOrders, useApiMode, type AdminInventory } from '../adminApi'
import { localInventoryConfig, summarizeInventory } from '../inventory'
import { readAdminData } from '../adminStore'
import { AS } from '../adminStrings'
import styles from '../admin.module.css'

/** `/admin` — özet göstergeler ve hızlı bağlantılar. */
export function Dashboard() {
  const hiddenCount = allProducts.filter((p) => p.hidden).length
  const visibleCount = allProducts.length - hiddenCount
  const missing = missingBrandMedia()
  const updatedAt = readAdminData().updatedAt

  // API modunda sipariş sayısı için ayrı bir istek gerekir (yerel demo sipariş deposu API modunda kullanılmaz).
  const [apiOrderCount, setApiOrderCount] = useState<number | null>(null)
  useEffect(() => {
    if (!useApiMode) return
    listAdminOrders()
      .then((orders) => setApiOrderCount(orders.length))
      .catch(() => setApiOrderCount(null))
  }, [])
  const orderCount = useApiMode ? apiOrderCount : listDemoOrders().length

  // Stok özeti: API modunda GET /admin/inventory (eşik yönetici ayarından); yerelde katalogdan.
  const [apiInventory, setApiInventory] = useState<AdminInventory | null>(null)
  const [inventoryError, setInventoryError] = useState(false)
  useEffect(() => {
    if (!useApiMode) return
    getAdminInventory()
      .then(setApiInventory)
      .catch(() => setInventoryError(true))
  }, [])
  const inventory = useApiMode ? apiInventory : summarizeInventory(allProducts, localInventoryConfig().lowStockThreshold)
  const lowRows = inventory
    ? inventory.products.flatMap((p) => p.lowStockVariants.map((v) => ({ ...v, number: p.number }))).sort((a, b) => a.qty - b.qty)
    : []

  return (
    <div>
      <div className={styles.pageHead}>
        <h1 className={styles.pageTitle}>{AS.dashboard.title}</h1>
      </div>
      {useApiMode ? null : <p className={styles.demoNotice}>{AS.demoNotice}</p>}

      <div className={styles.grid}>
        <div className={styles.card}>
          <div className={styles.sectionTitle}>{AS.dashboard.productsCard}</div>
          <p>{AS.dashboard.visibleCount(visibleCount)}</p>
          <p className="text-soft">{AS.dashboard.hiddenCount(hiddenCount)}</p>
          <Link className="link" to="/admin/urunler">
            {AS.dashboard.manageProducts}
          </Link>
        </div>

        <div className={styles.card}>
          <div className={styles.sectionTitle}>{useApiMode ? AS.nav.orders : AS.dashboard.ordersCard}</div>
          <p>{orderCount == null ? AS.common.loading : AS.dashboard.orderCount(orderCount)}</p>
          <Link className="link" to="/admin/siparisler">
            {AS.dashboard.viewOrders}
          </Link>
        </div>

        <div className={styles.card}>
          <div className={styles.sectionTitle}>{AS.dashboard.lowStockCard}</div>
          {inventory ? (
            <>
              <p>
                <span className={inventory.lowStockCount ? styles.stockFlag : undefined} style={{ fontSize: 'inherit' }}>{AS.dashboard.lowStockCount(inventory.lowStockCount)}</span>
              </p>
              <p className="text-soft">
                {AS.dashboard.outOfStockCount(inventory.outOfStockCount)} · {AS.dashboard.lowStockThreshold(inventory.threshold)}
              </p>
              {lowRows.length === 0 ? (
                <p className={styles.statusMuted}>{AS.dashboard.lowStockNone}</p>
              ) : (
                <ul className={styles.plainList} style={{ marginTop: 'var(--sp-3)' }}>
                  {lowRows.slice(0, 5).map((v) => (
                    <li key={`${v.productId}:${v.colorId}:${v.size}`}>
                      <Link className="link" to={`/admin/urunler/${v.productId}`}>
                        {AS.dashboard.lowStockRow(v.number, v.colorLabel, v.size, v.qty)}
                      </Link>
                    </li>
                  ))}
                  {lowRows.length > 5 ? <li className="text-soft">{AS.dashboard.lowStockMore(lowRows.length - 5)}</li> : null}
                </ul>
              )}
            </>
          ) : (
            <p>{inventoryError ? AS.apiNotice.loadError : AS.common.loading}</p>
          )}
          <Link className="link" to="/admin/urunler">
            {AS.dashboard.manageProducts}
          </Link>
        </div>

        <div className={styles.card}>
          <div className={styles.sectionTitle}>{AS.dashboard.missingMedia}</div>
          {missing.length === 0 ? (
            <p className={styles.status}>
              <Icon name="check" size={14} /> {AS.dashboard.allMediaPresent}
            </p>
          ) : (
            <ul style={{ listStyle: 'none', margin: '0 0 12px', padding: 0, display: 'grid', gap: 6 }}>
              {missing.map((name) => (
                <li key={name} className={styles.statusMuted} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="info" size={14} /> {name}
                </li>
              ))}
            </ul>
          )}
          <Link className="link" to="/admin/ayarlar">
            {AS.dashboard.manageMedia}
          </Link>
        </div>

        {useApiMode ? null : (
          <div className={styles.card}>
            <div className={styles.sectionTitle}>{AS.dashboard.lastUpdate}</div>
            <p>{updatedAt ? new Date(updatedAt).toLocaleString('tr-TR') : AS.dashboard.neverUpdated}</p>
          </div>
        )}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>{AS.dashboard.quickLinks}</div>
        <div className={styles.pageActions}>
          <Link className="link" to="/admin/urunler">
            {AS.nav.products}
          </Link>
          <Link className="link" to="/admin/icerik">
            {AS.nav.content}
          </Link>
          <Link className="link" to="/admin/ayarlar">
            {AS.nav.settings}
          </Link>
          <Link className="link" to="/admin/siparisler">
            {AS.nav.orders}
          </Link>
          {useApiMode ? (
            <Link className="link" to="/admin/kullanicilar">
              {AS.nav.users}
            </Link>
          ) : null}
          <Link className="link" to="/admin/veri">
            {AS.nav.data}
          </Link>
        </div>
      </div>
    </div>
  )
}
