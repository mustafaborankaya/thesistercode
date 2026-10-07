import { useMemo, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { categories, productBySlug } from '../../data/catalog'
import { apiErrorMessage } from '../../i18n/apiMessages'
import { getAdminAnalytics, isUnavailable, useApiMode, type AnalyticsDelta, type AnalyticsOverview, type AnalyticsRange } from '../adminApi'
import { AS } from '../adminStrings'
import { Btn } from '../ui/Button'
import { BarChart, DonutChart, FunnelChart, HBarList, Heatmap, LineChart, Sparkline, fmtDayLong, fmtDayShort, fmtInt, fmtMonthLong, fmtMonthShort, fmtPct, parseDay, sharePct, type HBarItem } from '../ui/charts'
import { DataTable, type Column } from '../ui/DataTable'
import { FormSection } from '../ui/FormSection'
import { KpiCard } from '../ui/KpiCard'
import { EmptyState, ErrorState, Notice, PageHeader, UnavailableState } from '../ui/Page'
import { StatusBadge } from '../ui/StatusBadge'
import { orderStatusTone } from '../ui/tones'
import { formatDateTime, formatPrice, isoDay } from '../ui/format'
import { useLoader } from '../ui/useLoader'
import ui from '../ui/ui.module.css'
import styles from './AnalyticsPage.module.css'

const A = AS.analytics
const RANGES: AnalyticsRange[] = ['7d', '30d', '90d', '12m']

function parseRange(v: string | null): AnalyticsRange {
  return (RANGES as string[]).includes(v ?? '') ? (v as AnalyticsRange) : '30d'
}

/** `/admin/analitik` — ziyaret, davranış ve satış analitiği; aralık `?aralik=7d|30d|90d|12m` ile URL'de tutulur. */
export function AnalyticsPage() {
  if (!useApiMode) {
    return (
      <div>
        <PageHeader title={A.title} description={A.subtitle} />
        <div className={ui.card}>
          <EmptyState icon="chart" title={A.localOnlyTitle} text={A.localOnlyText} />
        </div>
      </div>
    )
  }
  return <ApiAnalyticsPage />
}

/* ---------------- Yardımcılar ---------------- */

type Bucket = 'day' | 'week' | 'month'

/** 7/30 gün günlük, 90 gün haftalık, 12 ay aylık kovalar (çubuk grafikler için; çizgi grafik hep günlük). */
function bucketFor(range: AnalyticsRange): Bucket {
  return range === '12m' ? 'month' : range === '90d' ? 'week' : 'day'
}

function bucketNote(b: Bucket): string {
  return b === 'month' ? A.traffic.bucketMonthly : b === 'week' ? A.traffic.bucketWeekly : A.traffic.bucketDaily
}

interface Bucketed {
  labels: string[]
  longLabels: string[]
  values: number[]
}

function bucketize(rows: { date: string; value: number }[], bucket: Bucket): Bucketed {
  if (bucket === 'day') return { labels: rows.map((r) => fmtDayShort(r.date)), longLabels: rows.map((r) => fmtDayLong(r.date)), values: rows.map((r) => r.value) }
  const groups = new Map<string, { start: string; value: number }>()
  for (const r of rows) {
    let key: string
    if (bucket === 'month') key = `${r.date.slice(0, 7)}-01`
    else {
      const d = parseDay(r.date)
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7)) // pazartesi
      key = isoDay(d)
    }
    const g = groups.get(key)
    if (g) g.value += r.value
    else groups.set(key, { start: key, value: r.value })
  }
  const list = [...groups.values()]
  return {
    labels: list.map((g) => (bucket === 'month' ? fmtMonthShort(g.start) : fmtDayShort(g.start))),
    longLabels: list.map((g) => (bucket === 'month' ? fmtMonthLong(g.start) : A.traffic.weekOf(fmtDayShort(g.start)))),
    values: list.map((g) => g.value),
  }
}

function slugTitle(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toLocaleUpperCase('tr-TR') + w.slice(1))
    .join(' ')
}

/** Ham yol → okunur etiket ('/' → Ana sayfa, '/koleksiyon/x' → Koleksiyon · …, '/urun/x' → ürün adı/slug). */
function pageLabel(path: string): string {
  const c = A.content
  if (path === '/' || path === '') return c.pageHome
  const named = c.pageNames[path]
  if (named) return named
  if (path === '/koleksiyon') return c.pageCollection
  if (path.startsWith('/koleksiyon/')) {
    const slug = path.slice('/koleksiyon/'.length)
    const cat = categories.find((x) => x.id === slug)
    return `${c.pageCollection} · ${cat ? cat.label : slugTitle(slug)}`
  }
  if (path.startsWith('/urun/')) {
    const slug = path.slice('/urun/'.length)
    return `${c.pageProduct} · ${productBySlug[slug]?.name ?? slug}`
  }
  if (path.startsWith('/odeme/sonuc')) return c.pageCheckoutResult
  if (path.startsWith('/bilgi/')) return `${c.pageInfo} · ${slugTitle(path.slice('/bilgi/'.length))}`
  return path
}

const money = (n: number) => formatPrice(n)

/** Önceki döneme göre değişim: ▲/▼ yüzde (yeşil/kırmızı); önceki dönem yoksa ya da 0 ise "—". */
function Delta({ d }: { d: AnalyticsDelta }) {
  if (d.previous == null || d.previous === 0) return <span className={ui.faint}>{A.kpi.deltaNone}</span>
  const pct = ((d.value - d.previous) / d.previous) * 100
  if (Math.abs(pct) < 0.05) return <span className={ui.faint}>{A.kpi.deltaFlat}</span>
  const up = pct > 0
  const text = fmtPct(Math.abs(pct))
  return (
    <span className={up ? ui.kpiDeltaUp : ui.kpiDeltaDown}>
      <span className="sr-only">{A.kpi.deltaAria(text, up)}</span>
      <span aria-hidden="true">{up ? A.kpi.deltaUp(text) : A.kpi.deltaDown(text)}</span>
    </span>
  )
}

function Block({ title, meta, desc, children }: { title: string; meta?: string; desc?: string; children: ReactNode }) {
  return (
    <div className={styles.block}>
      <h3 className={styles.blockTitle}>
        {title}
        {meta ? <span className={styles.blockMeta}>{meta}</span> : null}
      </h3>
      {desc ? <p className={styles.blockDesc}>{desc}</p> : null}
      {children}
    </div>
  )
}

function MiniKpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className={styles.miniKpi}>
      <span className={styles.miniKpiLabel}>{label}</span>
      <span className={styles.miniKpiValue}>{value}</span>
      {sub ? <span className={styles.miniKpiSub}>{sub}</span> : null}
    </div>
  )
}

/* ---------------- Sayfa ---------------- */

function ApiAnalyticsPage() {
  const [params, setParams] = useSearchParams()
  const range = parseRange(params.get('aralik'))
  const load = useLoader(() => getAdminAnalytics(range), range)
  const data = load.data

  function setRange(r: AnalyticsRange) {
    const next = new URLSearchParams(params)
    next.set('aralik', r)
    setParams(next, { replace: true })
  }

  const header = (
    <PageHeader
      title={A.title}
      description={A.subtitle}
      meta={
        data ? (
          <StatusBadge tone="outline" dot={false}>
            {A.periodNote(fmtDayShort(data.from), fmtDayShort(data.to), data.days)}
          </StatusBadge>
        ) : null
      }
      actions={
        <>
          <div className={ui.segmented} role="group" aria-label={A.rangeLabel}>
            {RANGES.map((r) => (
              <button key={r} type="button" aria-pressed={r === range} onClick={() => setRange(r)}>
                {A.ranges[r]}
              </button>
            ))}
          </div>
          <Btn icon="refresh" onClick={load.reload} loading={load.loading && !!data}>
            {AS.common.refresh}
          </Btn>
        </>
      }
    />
  )

  if (load.error && !data) {
    return (
      <div>
        {header}
        {isUnavailable(load.error) ? <UnavailableState feature={A.feature} /> : <ErrorState message={apiErrorMessage(load.error)} onRetry={load.reload} />}
      </div>
    )
  }

  if (!data) {
    return (
      <div aria-busy="true">
        {header}
        <div className={styles.kpiGrid}>
          {(['pageviews', 'visits', 'visitors', 'sessions', 'orders', 'revenue', 'conversion', 'aov'] as const).map((k) => (
            <KpiCard key={k} label={A.kpi[k]} value="" sub=" " loading />
          ))}
        </div>
        {[0, 1].map((i) => (
          <div key={i} className={[ui.card, styles.skeletonCard].join(' ')} aria-hidden="true">
            <span className={ui.skeleton} style={{ width: '30%' }} />
            <span className={ui.skeleton} style={{ width: '100%', height: 160 }} />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div>
      {header}
      {load.error ? <Notice tone="danger">{apiErrorMessage(load.error)}</Notice> : null}
      <div className={load.loading ? styles.stale : undefined} aria-busy={load.loading || undefined}>
        <Report data={data} range={range} />
      </div>
    </div>
  )
}

function Report({ data, range }: { data: AnalyticsOverview; range: AnalyticsRange }) {
  const navigate = useNavigate()
  const bucket = bucketFor(range)
  const noData = data.tracking.since === null
  const k = data.kpis

  const d = useMemo(() => {
    const dates = data.series.map((r) => r.date)
    const pick = (f: (r: AnalyticsOverview['series'][number]) => number) => data.series.map(f)
    const orders = pick((r) => r.orders)
    const revenue = pick((r) => r.revenue)
    const visits = pick((r) => r.visits)
    return {
      dates,
      pageviews: pick((r) => r.pageviews),
      visits,
      visitors: pick((r) => r.visitors),
      orders,
      revenue,
      conversion: visits.map((v, i) => (v > 0 ? (orders[i] / v) * 100 : 0)),
      aov: orders.map((o, i) => (o > 0 ? revenue[i] / o : 0)),
      revenueB: bucketize(data.series.map((r) => ({ date: r.date, value: r.revenue })), bucket),
      ordersB: bucketize(data.series.map((r) => ({ date: r.date, value: r.orders })), bucket),
      newB: bucketize(data.customers.newSeries.map((r) => ({ date: r.date, value: r.count })), bucket),
    }
  }, [data, bucket])

  const hourLabels = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'))
  const hourLong = Array.from({ length: 24 }, (_, h) => A.time.hourRange(h))
  const weekdayShort = [...A.time.weekdayShort]
  const weekdayLong = [...A.time.weekdayLong]

  const productColumns: Column<AnalyticsOverview['products'][number]>[] = [
    {
      key: 'name',
      header: A.content.colProduct,
      primary: true,
      sortValue: (p) => p.name ?? p.productId,
      render: (p) => (
        <div style={{ minWidth: 0 }}>
          <div className={ui.cellTitle}>{p.name ?? p.productId}</div>
          {p.name ? <div className={ui.cellSub}>{p.productId}</div> : null}
        </div>
      ),
    },
    { key: 'views', header: A.content.colViews, align: 'right', sortValue: (p) => p.views, render: (p) => <span className={ui.num}>{fmtInt(p.views)}</span> },
    { key: 'atc', header: A.content.colAddToCart, align: 'right', sortValue: (p) => p.addToCarts, render: (p) => <span className={ui.num}>{fmtInt(p.addToCarts)}</span> },
    { key: 'rate', header: A.content.colAddRate, align: 'right', sortValue: (p) => (p.views > 0 ? p.addToCarts / p.views : 0), render: (p) => <span className={ui.num}>{p.views > 0 ? fmtPct((p.addToCarts / p.views) * 100) : AS.common.none}</span> },
    { key: 'ordered', header: A.content.colOrdered, align: 'right', sortValue: (p) => p.ordered, render: (p) => <span className={ui.num}>{fmtInt(p.ordered)}</span> },
    { key: 'revenue', header: A.content.colRevenue, align: 'right', sortValue: (p) => p.revenue, render: (p) => <span className={ui.num}>{money(p.revenue)}</span> },
  ]

  const funnelSteps = (['pageview', 'productView', 'addToCart', 'checkout', 'order'] as const).map((key) => ({ key, label: A.funnel.steps[key], value: data.funnel[key] }))

  const referrerItems: HBarItem[] = data.referrers.map((r) => ({ key: r.host ?? '__direct', label: r.host ?? A.sources.direct, value: r.visits }))
  const campaignItems: HBarItem[] = data.campaigns.map((c, i) => ({
    key: `${c.source}|${c.medium ?? ''}|${c.campaign ?? ''}|${i}`,
    label: c.source,
    sub: [c.medium, c.campaign].filter(Boolean).join(' · ') || undefined,
    value: c.visits,
  }))
  const pageItems: HBarItem[] = data.pages.map((p) => ({ key: p.path, label: pageLabel(p.path), sub: p.path, value: p.pageviews, badge: p.visitors > 0 ? <span className={ui.cellSub}>{A.content.visitorsUnit(p.visitors)}</span> : undefined }))
  const searchItems: HBarItem[] = data.searches.map((q) => ({
    key: q.query,
    label: q.query,
    value: q.count,
    badge: q.zeroResults > 0 ? <StatusBadge tone="warning">{A.content.zeroResults(q.zeroResults)}</StatusBadge> : undefined,
  }))
  const statusItems: HBarItem[] = data.sales.byStatus.map((st) => ({
    key: st.status,
    label: <StatusBadge tone={orderStatusTone(st.status)}>{AS.ordersApi.statusLabels[st.status] ?? st.status}</StatusBadge>,
    sub: money(st.revenue),
    value: st.count,
  }))
  const couponItems: HBarItem[] = data.sales.topCoupons.map((c) => ({ key: c.code, label: c.code, sub: A.sales.couponDiscount(money(c.discount)), value: c.count }))
  const cityItems: HBarItem[] = data.sales.byCity.map((c) => ({ key: c.city, label: c.city, value: c.count }))
  const consentItems = [
    { key: 'all', label: A.consent.acceptAll, count: data.consent.acceptAll },
    { key: 'necessary', label: A.consent.necessaryOnly, count: data.consent.necessaryOnly },
    { key: 'custom', label: A.consent.custom, count: data.consent.custom },
  ]

  return (
    <>
      <div className={styles.kpiGrid}>
        <KpiCard label={A.kpi.pageviews} icon="eye" value={fmtInt(k.pageviews.value)} sub={A.kpi.everyone} delta={<Delta d={k.pageviews} />} trend={<Sparkline values={d.pageviews} width={72} />} />
        <KpiCard label={A.kpi.visits} icon="external" value={fmtInt(k.visits.value)} sub={A.kpi.everyone} delta={<Delta d={k.visits} />} trend={<Sparkline values={d.visits} width={72} />} />
        <KpiCard label={A.kpi.visitors} icon="customers" value={fmtInt(k.visitors.value)} sub={A.kpi.consentedOnly} delta={<Delta d={k.visitors} />} trend={<Sparkline values={d.visitors} width={72} />} />
        <KpiCard label={A.kpi.sessions} icon="clock" value={fmtInt(k.sessions.value)} sub={A.kpi.consentedOnly} delta={<Delta d={k.sessions} />} />
        <KpiCard label={A.kpi.orders} icon="orders" value={fmtInt(k.orders.value)} sub={A.traffic.ordersDesc.split(';')[0]} delta={<Delta d={k.orders} />} trend={<Sparkline values={d.orders} width={72} />} />
        <KpiCard label={A.kpi.revenue} icon="wallet" value={money(k.revenue.value)} sub={A.traffic.ordersDesc.split(';')[0]} delta={<Delta d={k.revenue} />} trend={<Sparkline values={d.revenue} width={72} />} />
        <KpiCard label={A.kpi.conversion} icon="check" value={fmtPct(k.conversion.value, 2)} sub={A.kpi.conversionSub} delta={<Delta d={k.conversion} />} trend={<Sparkline values={d.conversion} width={72} />} />
        <KpiCard label={A.kpi.aov} icon="card" value={money(k.aov.value)} sub={A.kpi.aovSub} delta={<Delta d={k.aov} />} trend={<Sparkline values={d.aov} width={72} />} />
      </div>

      {noData ? (
        <div className={ui.card} style={{ marginBottom: 16 }}>
          <EmptyState icon="chart" title={A.noDataTitle} text={A.noDataText} />
        </div>
      ) : (
        <>
          <FormSection title={A.traffic.title} description={A.traffic.desc}>
            <LineChart
              title={A.traffic.title}
              dates={d.dates}
              series={[
                { key: 'pageviews', label: A.kpi.pageviews, values: d.pageviews, tone: 'ink', area: true },
                { key: 'visits', label: A.kpi.visits, values: d.visits, tone: 'soft' },
                { key: 'visitors', label: A.kpi.visitors, values: d.visitors, tone: 'faint' },
              ]}
              height={240}
              tableCaption={A.traffic.title}
            />
          </FormSection>

          <FormSection title={A.traffic.ordersTitle} description={A.traffic.ordersDesc}>
            <div className={styles.grid2}>
              <Block title={A.traffic.revenueChart} meta={bucketNote(bucket)}>
                <BarChart title={A.traffic.revenueChart} labels={d.revenueB.labels} longLabels={d.revenueB.longLabels} values={d.revenueB.values} valueLabel={A.traffic.revenueChart} format={money} tableCaption={A.traffic.revenueChart} />
              </Block>
              <Block title={A.traffic.ordersChart} meta={bucketNote(bucket)}>
                <BarChart title={A.traffic.ordersChart} labels={d.ordersB.labels} longLabels={d.ordersB.longLabels} values={d.ordersB.values} valueLabel={A.traffic.ordersChart} tableCaption={A.traffic.ordersChart} />
              </Block>
            </div>
          </FormSection>

          <FormSection title={A.funnel.title} description={A.funnel.desc}>
            <div className={styles.grid21}>
              <FunnelChart steps={funnelSteps} rateLabel={A.funnel.stepRate} overallLabel={A.funnel.overall} />
              <Notice tone="neutral">{data.funnel.basis === 'sessions' ? A.funnel.basisSessions : A.funnel.basisEvents}</Notice>
            </div>
          </FormSection>

          <FormSection title={A.sources.title} description={A.sources.desc}>
            <div className={styles.grid3}>
              <Block title={A.sources.referrers}>
                <HBarList ariaLabel={A.sources.referrers} items={referrerItems} emptyText={A.sources.noReferrers} />
              </Block>
              <Block title={A.sources.campaigns}>
                <HBarList ariaLabel={A.sources.campaigns} items={campaignItems} emptyText={A.sources.noCampaigns} />
              </Block>
              <Block title={A.sources.locales}>
                <DonutChart title={A.sources.locales} items={data.locales} centerLabel={A.kpi.pageviews.toLocaleLowerCase('tr-TR')} />
              </Block>
            </div>
          </FormSection>

          <FormSection title={A.devices.title} description={A.devices.desc}>
            <div className={styles.grid3}>
              <Block title={A.devices.devices}>
                <DonutChart title={A.devices.devices} items={data.devices} centerLabel={A.kpi.pageviews.toLocaleLowerCase('tr-TR')} />
              </Block>
              <Block title={A.devices.browsers}>
                <HBarList ariaLabel={A.devices.browsers} items={data.browsers.map((b) => ({ key: b.key, label: b.label, value: b.count }))} />
              </Block>
              <Block title={A.devices.os}>
                <HBarList ariaLabel={A.devices.os} items={data.os.map((o) => ({ key: o.key, label: o.label, value: o.count }))} />
              </Block>
            </div>
          </FormSection>

          <FormSection title={A.time.title} description={A.time.desc}>
            <div className={styles.grid21}>
              <Block title={A.time.heatmap}>
                <Heatmap
                  title={A.time.heatmap}
                  rowLabels={weekdayShort}
                  rowLongLabels={weekdayLong}
                  colLabels={hourLabels}
                  colLongLabels={hourLong}
                  values={data.heatmap}
                  valueLabel={A.kpi.pageviews}
                  tableCaption={A.time.heatmap}
                  lessLabel={A.time.less}
                  moreLabel={A.time.more}
                />
              </Block>
              <Block title={A.time.weekdays}>
                <BarChart title={A.time.weekdays} labels={weekdayShort} longLabels={weekdayLong} values={data.weekdays} valueLabel={A.kpi.pageviews} height={160} allLabels tableCaption={A.time.weekdays} />
              </Block>
            </div>
          </FormSection>

          <FormSection title={A.content.title} description={A.content.desc}>
            <div className={styles.stack}>
              <div className={styles.grid2}>
                <Block title={A.content.pages}>
                  <HBarList ariaLabel={A.content.pages} items={pageItems} total={k.pageviews.value} />
                </Block>
                <Block title={A.content.searches}>
                  <HBarList ariaLabel={A.content.searches} items={searchItems} emptyText={A.content.noSearches} />
                </Block>
              </div>
              <Block title={A.content.products}>
                <DataTable
                  caption={A.content.products}
                  columns={productColumns}
                  rows={data.products}
                  rowKey={(p) => p.productId}
                  pageSize={10}
                  initialSort={{ key: 'views', dir: 'desc' }}
                  onRowClick={(p) => navigate(`/admin/urunler/${encodeURIComponent(p.productId)}`)}
                  rowLabel={(p) => A.content.openProduct(p.name ?? p.productId)}
                  empty={<EmptyState icon="products" title={A.content.noProducts} />}
                />
              </Block>
            </div>
          </FormSection>

          <FormSection title={A.sales.title} description={A.sales.desc}>
            <div className={styles.stack}>
              <div className={styles.miniKpis}>
                <MiniKpi label={A.sales.memberOrders} value={fmtInt(data.sales.memberOrders)} />
                <MiniKpi label={A.sales.guestOrders} value={fmtInt(data.sales.guestOrders)} />
                <MiniKpi label={A.sales.couponOrders} value={fmtInt(data.sales.couponOrders)} />
                <MiniKpi label={A.sales.firstOrderDiscountOrders} value={fmtInt(data.sales.firstOrderDiscountOrders)} />
              </div>
              <div className={styles.grid3}>
                <Block title={A.sales.byStatus}>
                  <HBarList ariaLabel={A.sales.byStatus} items={statusItems} />
                </Block>
                <Block title={A.sales.topCoupons}>
                  <HBarList ariaLabel={A.sales.topCoupons} items={couponItems} emptyText={A.sales.noCoupons} hideShare />
                </Block>
                <Block title={A.sales.byCity}>
                  <HBarList ariaLabel={A.sales.byCity} items={cityItems} emptyText={A.sales.noCities} />
                </Block>
              </div>
              <div className={styles.grid21}>
                <Block title={A.sales.byHour}>
                  <BarChart title={A.sales.byHour} labels={hourLabels} longLabels={hourLong} values={data.sales.byHour} valueLabel={A.kpi.orders} height={160} tableCaption={A.sales.byHour} />
                </Block>
                <Block title={A.sales.byLocale}>
                  <DonutChart title={A.sales.byLocale} items={data.sales.byLocale} centerLabel={A.kpi.orders.toLocaleLowerCase('tr-TR')} />
                </Block>
              </div>
            </div>
          </FormSection>

          <FormSection title={A.customers.title} description={A.customers.desc}>
            <div className={styles.grid21}>
              <Block title={A.customers.newSeries} meta={bucketNote(bucket)}>
                <BarChart title={A.customers.newSeries} labels={d.newB.labels} longLabels={d.newB.longLabels} values={d.newB.values} valueLabel={A.customers.newSeries} height={160} tableCaption={A.customers.newSeries} />
              </Block>
              <div className={styles.miniKpis}>
                <MiniKpi label={A.customers.total} value={fmtInt(data.customers.total)} />
                <MiniKpi label={A.customers.newInRange} value={fmtInt(data.customers.newInRange)} />
                <MiniKpi label={A.customers.buyersInRange} value={fmtInt(data.customers.buyersInRange)} sub={A.customers.buyersSub} />
                <MiniKpi label={A.customers.repeatBuyers} value={fmtInt(data.customers.repeatBuyers)} sub={A.customers.repeatSub} />
              </div>
            </div>
          </FormSection>

          <FormSection title={A.consent.title} description={A.consent.desc}>
            <div className={styles.stack}>
              <div className={styles.grid21}>
                <Block title={A.consent.decisions}>
                  <DonutChart title={A.consent.decisions} items={consentItems} centerLabel={A.consent.decisions.toLocaleLowerCase('tr-TR')} emptyText={A.consent.noDecisions} />
                </Block>
                <div className={styles.miniKpis}>
                  <MiniKpi label={A.consent.optIn} value={sharePct(data.consent.analyticsOptIn, data.consent.decisions)} sub={A.consent.optInSub(data.consent.analyticsOptIn, data.consent.decisions)} />
                </div>
              </div>
              <Notice tone="neutral">
                {A.consent.consentedShare(fmtPct(data.tracking.consentedShare * 100))} {A.consent.note}
              </Notice>
            </div>
          </FormSection>
        </>
      )}

      <p className={styles.footer}>
        {A.footer(formatDateTime(data.generatedAt), data.tracking.retentionDays, data.tracking.since ? formatDateTime(data.tracking.since) : AS.common.none)} · {A.eventsInRange(data.tracking.events)}
      </p>
    </>
  )
}
