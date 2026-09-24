import { Link } from 'react-router-dom'
import { Icon } from '../../components/ui/Icon'
import { allProducts } from '../../data/catalog'
import { missingBrandMedia } from '../../data/media'
import { listDemoOrders } from '../../services/checkout'
import { readAdminData } from '../adminStore'
import { AS } from '../adminStrings'
import styles from '../admin.module.css'

/** `/admin` — özet göstergeler ve hızlı bağlantılar. */
export function Dashboard() {
  const hiddenCount = allProducts.filter((p) => p.hidden).length
  const visibleCount = allProducts.length - hiddenCount
  const orderCount = listDemoOrders().length
  const missing = missingBrandMedia()
  const updatedAt = readAdminData().updatedAt

  return (
    <div>
      <div className={styles.pageHead}>
        <h1 className={styles.pageTitle}>{AS.dashboard.title}</h1>
      </div>
      <p className={styles.demoNotice}>{AS.demoNotice}</p>

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
          <div className={styles.sectionTitle}>{AS.dashboard.ordersCard}</div>
          <p>{AS.dashboard.orderCount(orderCount)}</p>
          <Link className="link" to="/admin/siparisler">
            {AS.dashboard.viewOrders}
          </Link>
        </div>

        <div className={styles.card}>
          <div className={styles.sectionTitle}>{AS.dashboard.missingMedia}</div>
          {missing.length === 0 ? (
            <p className={styles.status}>
              <Icon name="check" size={14} /> {AS.dashboard.allMediaPresent}
            </p>
          ) : (
            <ul className="stack">
              {missing.map((name) => (
                <li key={name} className={styles.statusMuted}>
                  <Icon name="info" size={14} /> {name}
                </li>
              ))}
            </ul>
          )}
          <Link className="link" to="/admin/ayarlar">
            {AS.dashboard.manageMedia}
          </Link>
        </div>

        <div className={styles.card}>
          <div className={styles.sectionTitle}>{AS.dashboard.lastUpdate}</div>
          <p>{updatedAt ? new Date(updatedAt).toLocaleString('tr-TR') : AS.dashboard.neverUpdated}</p>
        </div>
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
          <Link className="link" to="/admin/veri">
            {AS.nav.data}
          </Link>
        </div>
      </div>
    </div>
  )
}
