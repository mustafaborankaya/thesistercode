import { Link, useNavigate } from 'react-router-dom'
import { allProducts } from '../../data/catalog'
import { missingBrandMedia } from '../../data/media'
import { apiErrorMessage } from '../../i18n/apiMessages'
import { listDemoOrders } from '../../services/checkout'
import { getAdminAnalytics, getAdminInventory, getAdminStats, isUnavailable, queryAdminOrders, useApiMode, type AdminInventory, type AdminStats, type AnalyticsOverview, type ApiOrder } from '../adminApi'
import { currentAdmin } from '../adminAuth'
import { readAdminData } from '../adminStore'
import { AS } from '../adminStrings'
import { localInventoryConfig, summarizeInventory } from '../inventory'
import { AdminIcon } from '../ui/AdminIcon'
import { Btn } from '../ui/Button'
import { fmtInt } from '../ui/charts'
import { DataTable, type Column } from '../ui/DataTable'
import { FormSection } from '../ui/FormSection'
import { KpiCard } from '../ui/KpiCard'
import { EmptyState, Notice, PageHeader } from '../ui/Page'
import { StatusBadge } from '../ui/StatusBadge'
import { orderStatusTone } from '../ui/tones'
import { formatDateTime, formatPrice, formatWhen } from '../ui/format'
import { useLoader } from '../ui/useLoader'
import ui from '../ui/ui.module.css'
import styles from '../admin.module.css'

/** Ciroya sayılan durumlar (yedek hesap): yeni, ödendi, kargoda. İptal, ödeme bekleyen ve demo hariç. */
const REVENUE_STATUSES = new Set(['new', 'paid', 'shipped'])

interface Bucket {
  orders: number
  revenue: number
}

function periodStarts(now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const week = new Date(today)
  week.setDate(today.getDate() - ((today.getDay() + 6) % 7)) // pazartesi
  const month = new Date(now.getFullYear(), now.getMonth(), 1)
  return { today: today.getTime(), week: week.getTime(), month: month.getTime() }
}

/** `GET /admin/stats` yoksa (eski sunucu) sipariş listesinden aynı özet. */
function computeStats(orders: { createdAt: string; status: string; total: number }[], lowStock: number): Omit<AdminStats, 'recentOrders'> {
  const starts = periodStarts()
  const b = (): Bucket => ({ orders: 0, revenue: 0 })
  const out = { today: b(), week: b(), month: b() }
  let pendingPayment = 0
  for (const o of orders) {
    if (o.status === 'pending_payment') pendingPayment++
    const t = new Date(o.createdAt).getTime()
    const counts = REVENUE_STATUSES.has(o.status)
    for (const key of ['today', 'week', 'month'] as const) {
      if (t >= starts[key]) {
        out[key].orders++
        if (counts) out[key].revenue += o.total
      }
    }
  }
  return { ...out, pendingPayment, lowStock }
}

interface DashData {
  stats: Omit<AdminStats, 'recentOrders'>
  recent: ApiOrder[] | null
  computed: boolean
}

async function loadApiDashboard(inventory: Promise<AdminInventory | null>): Promise<DashData> {
  try {
    const s = await getAdminStats()
    return { stats: s, recent: s.recentOrders ?? [], computed: false }
  } catch (e) {
    if (!isUnavailable(e)) throw e
    const [res, inv] = await Promise.all([queryAdminOrders({}), inventory])
    const orders = res.orders
    const recent = [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 10)
    return {
      stats: computeStats(
        orders.map((o) => ({ createdAt: o.createdAt, status: o.status, total: o.totals.total })),
        inv?.lowStockCount ?? 0,
      ),
      recent,
      computed: true,
    }
  }
}

function loadLocalDashboard(): DashData {
  const inv = summarizeInventory(allProducts, localInventoryConfig().lowStockThreshold)
  const orders = listDemoOrders()
  return {
    stats: computeStats(
      orders.map((o) => ({ createdAt: o.createdAt, status: o.status === 'cancelled' ? 'cancelled' : 'new', total: o.input.totals.total })),
      inv.lowStockCount,
    ),
    recent: null,
    computed: true,
  }
}

/** `/admin` — KPI'lar, son siparişler, düşük stok, hızlı eylemler. */
export function Dashboard() {
  const navigate = useNavigate()
  const inventory = useLoader<AdminInventory>(() => (useApiMode ? getAdminInventory() : Promise.resolve(summarizeInventory(allProducts, localInventoryConfig().lowStockThreshold))))
  const dash = useLoader<DashData>(() =>
    useApiMode ? loadApiDashboard(getAdminInventory().catch(() => null)) : Promise.resolve(loadLocalDashboard()),
  )
  // Son 7 günün ziyaret özeti (analitik uç noktası yoksa/hata verirse kart gizlenir).
  const traffic = useLoader<AnalyticsOverview | null>(() => (useApiMode ? getAdminAnalytics('7d').catch(() => null) : Promise.resolve(null)))
  const stats = dash.data?.stats
  const loading = !dash.data && !dash.error
  const threshold = inventory.data?.threshold ?? localInventoryConfig().lowStockThreshold
  const lowRows = inventory.data
    ? inventory.data.products
        .flatMap((p) => p.lowStockVariants.map((v) => ({ ...v, name: p.name, number: p.number })))
        .sort((a, b) => a.qty - b.qty)
    : []
  const hiddenCount = allProducts.filter((p) => p.hidden).length
  const missing = missingBrandMedia()
  const updatedAt = useApiMode ? null : readAdminData().updatedAt

  const recentColumns: Column<ApiOrder>[] = [
    {
      key: 'id',
      header: AS.orders.no,
      primary: true,
      render: (o) => (
        <div>
          <div className={ui.cellTitle}>{o.id}</div>
          <div className={ui.cellSub}>{formatWhen(o.createdAt)}</div>
        </div>
      ),
    },
    { key: 'customer', header: AS.orders.customer, render: (o) => `${o.delivery.firstName} ${o.delivery.lastName}` },
    { key: 'total', header: AS.orders.total, align: 'right', render: (o) => <span className={ui.num}>{formatPrice(o.totals.total)}</span> },
    { key: 'status', header: AS.ordersApi.statusLabel, render: (o) => <StatusBadge tone={orderStatusTone(o.status)}>{AS.ordersApi.statusLabels[o.status] ?? o.status}</StatusBadge> },
  ]

  const money = (b?: Bucket) => (b ? formatPrice(b.revenue) : '—')

  return (
    <div>
      <PageHeader
        title={AS.dashboard.greeting(currentAdmin?.username ?? null)}
        description={AS.dashboard.subtitle}
        actions={
          <div className={styles.quickActions} role="group" aria-label={AS.dashboard.quickActions}>
            {useApiMode ? (
              <Btn variant="primary" icon="plus" to="/admin/urunler?yeni=1">
                {AS.dashboard.newProduct}
              </Btn>
            ) : null}
            <Btn icon="coupons" to="/admin/kuponlar?yeni=1">
              {AS.dashboard.newCoupon}
            </Btn>
            <Btn icon="orders" to="/admin/siparisler">
              {AS.dashboard.viewOrders}
            </Btn>
          </div>
        }
      />

      {dash.error ? <Notice tone="danger">{apiErrorMessage(dash.error)}</Notice> : null}

      <div className={ui.kpiGrid}>
        <KpiCard label={AS.dashboard.today} icon="wallet" value={money(stats?.today)} sub={stats ? AS.dashboard.ordersSub(stats.today.orders) : undefined} loading={loading} />
        <KpiCard label={AS.dashboard.week} icon="wallet" value={money(stats?.week)} sub={stats ? AS.dashboard.ordersSub(stats.week.orders) : undefined} loading={loading} />
        <KpiCard label={AS.dashboard.month} icon="wallet" value={money(stats?.month)} sub={stats ? AS.dashboard.ordersSub(stats.month.orders) : undefined} loading={loading} />
        <KpiCard
          label={AS.dashboard.pendingPayment}
          icon="clock"
          value={stats ? stats.pendingPayment : '—'}
          sub={AS.dashboard.pendingPaymentSub}
          tone={stats && stats.pendingPayment > 0 ? 'warning' : undefined}
          to={useApiMode ? '/admin/siparisler?durum=pending_payment' : undefined}
          loading={loading}
        />
        <KpiCard
          label={AS.dashboard.lowStock}
          icon="box"
          value={stats ? stats.lowStock : '—'}
          sub={AS.dashboard.lowStockSub(threshold)}
          tone={stats && stats.lowStock > 0 ? 'warning' : undefined}
          to="/admin/urunler?stok=low"
          loading={loading}
        />
        {traffic.data ? (
          <KpiCard
            label={AS.dashboard.visits7d}
            icon="chart"
            value={fmtInt(traffic.data.kpis.visits.value)}
            sub={AS.dashboard.visits7dSub(traffic.data.kpis.pageviews.value)}
            to="/admin/analitik?aralik=7d"
          />
        ) : null}
      </div>
      {dash.data?.computed ? <p className={[ui.hint].join(' ')} style={{ margin: '-4px 0 16px' }}>{useApiMode ? AS.dashboard.computedNote : AS.dashboard.demoOrdersNote}</p> : null}

      <div className={styles.dashGrid}>
        <div>
          {useApiMode ? (
            <FormSection
              title={AS.dashboard.recentOrders}
              flush
              actions={
                <Btn size="sm" variant="ghost" to="/admin/siparisler">
                  {AS.dashboard.allOrders}
                </Btn>
              }
            >
              <div style={{ margin: -1 }}>
                <DataTable
                  caption={AS.dashboard.recentOrders}
                  columns={recentColumns}
                  rows={dash.data ? (dash.data.recent ?? []) : dash.error ? [] : null}
                  rowKey={(o) => o.id}
                  pageSize={10}
                  onRowClick={(o) => navigate(`/admin/siparisler?id=${encodeURIComponent(o.id)}`)}
                  rowLabel={(o) => AS.orders.viewDetail(o.id)}
                  empty={<EmptyState icon="orders" title={AS.dashboard.noOrders} />}
                />
              </div>
            </FormSection>
          ) : null}

          <FormSection title={AS.dashboard.catalogTitle}>
            <div className={ui.stack}>
              <div className={ui.row} style={{ gap: 12 }}>
                <StatusBadge tone="success">{AS.dashboard.visibleCount(allProducts.length - hiddenCount)}</StatusBadge>
                <StatusBadge tone="neutral">{AS.dashboard.hiddenCount(hiddenCount)}</StatusBadge>
              </div>
              <div>
                <div className={ui.label} style={{ marginBottom: 6 }}>
                  {AS.dashboard.missingMedia}
                </div>
                {missing.length === 0 ? (
                  <p className={ui.row} style={{ gap: 6, color: 'var(--a-success)' }}>
                    <AdminIcon name="check" size={16} /> {AS.dashboard.allMediaPresent}
                  </p>
                ) : (
                  <div className={ui.row} style={{ gap: 6 }}>
                    {missing.map((name) => (
                      <StatusBadge key={name} tone="warning">
                        {name}
                      </StatusBadge>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <Btn size="sm" icon="images" to="/admin/gorseller">
                  {AS.dashboard.manageMedia}
                </Btn>
              </div>
              {updatedAt !== null || !useApiMode ? (
                <p className={ui.hint}>
                  {AS.dashboard.lastUpdate}: {updatedAt ? formatDateTime(updatedAt) : AS.dashboard.neverUpdated}
                </p>
              ) : null}
            </div>
          </FormSection>
        </div>

        <FormSection
          title={AS.dashboard.lowStockTitle}
          description={AS.dashboard.lowStockSub(threshold)}
          actions={lowRows.length ? <StatusBadge tone="warning">{lowRows.length}</StatusBadge> : null}
        >
          {inventory.error && !inventory.data ? (
            <p className={ui.muted}>{apiErrorMessage(inventory.error)}</p>
          ) : !inventory.data ? (
            <div className={ui.stackSm}>
              {[0, 1, 2].map((i) => (
                <span key={i} className={ui.skeleton} style={{ width: `${80 - i * 15}%` }} />
              ))}
            </div>
          ) : lowRows.length === 0 ? (
            <p className={ui.row} style={{ gap: 6, color: 'var(--a-success)' }}>
              <AdminIcon name="check" size={16} /> {AS.dashboard.lowStockEmpty}
            </p>
          ) : (
            <>
              <ul className={styles.lowList}>
                {lowRows.slice(0, 8).map((v) => (
                  <li key={`${v.productId}:${v.colorId}:${v.size}`}>
                    <span className={styles.lowName}>
                      <Link to={`/admin/urunler/${v.productId}`}>{v.name}</Link>
                      <span className={ui.cellSub} style={{ display: 'block' }}>
                        {AS.dashboard.lowStockRow(v.colorLabel, v.size)}
                      </span>
                    </span>
                    <StatusBadge tone="warning">{AS.dashboard.qty(v.qty)}</StatusBadge>
                  </li>
                ))}
              </ul>
              {lowRows.length > 8 ? (
                <p className={ui.hint} style={{ marginTop: 8 }}>
                  <Link className={ui.link} to="/admin/urunler?stok=low">
                    {AS.dashboard.lowStockMore(lowRows.length - 8)}
                  </Link>
                </p>
              ) : null}
            </>
          )}
        </FormSection>
      </div>
    </div>
  )
}
