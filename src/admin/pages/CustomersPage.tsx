import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiErrorMessage } from '../../i18n/apiMessages'
import { getAdminCustomer, isUnavailable, listAdminCustomers, updateAdminCustomer, useApiMode, type AdminCustomer } from '../adminApi'
import { AS } from '../adminStrings'
import { Btn } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { DataTable, type Column } from '../ui/DataTable'
import { Drawer } from '../ui/Drawer'
import { FilterBar } from '../ui/FilterBar'
import { SwitchField } from '../ui/Form'
import { EmptyState, ErrorState, PageHeader, UnavailableState } from '../ui/Page'
import { StatusBadge } from '../ui/StatusBadge'
import { orderStatusTone } from '../ui/tones'
import { formatDate, formatPrice, formatWhen } from '../ui/format'
import { useToast } from '../ui/toastContext'
import { useLoader } from '../ui/useLoader'
import ui from '../ui/ui.module.css'
import styles from '../admin.module.css'

const PAGE_SIZE = 20

function discountBadge(c: AdminCustomer) {
  if (c.discountUsed) return <StatusBadge tone="neutral">{AS.customers.discountUsed}</StatusBadge>
  if (c.discountEligible) return <StatusBadge tone="success">{AS.customers.discountEligible}</StatusBadge>
  return <StatusBadge tone="outline" dot={false}>{AS.customers.discountNone}</StatusBadge>
}

/** `/admin/musteriler` — arama, tablo, satır → drawer (siparişler, adresler, indirim hakkı). */
export function CustomersPage() {
  if (!useApiMode) {
    return (
      <div>
        <PageHeader title={AS.customers.title} description={AS.customers.subtitle} />
        <div className={ui.card}>
          <EmptyState icon="customers" title={AS.ui.localOnlyTitle} text={AS.ui.localOnlyText(AS.customers.feature)} />
        </div>
      </div>
    )
  }
  return <ApiCustomersPage />
}

function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms)
    return () => window.clearTimeout(t)
  }, [value, ms])
  return v
}

function ApiCustomersPage() {
  const [q, setQ] = useState('')
  const dq = useDebounced(q)
  const [page, setPage] = useState(1)
  const [prevQ, setPrevQ] = useState(dq)
  if (prevQ !== dq) {
    setPrevQ(dq)
    setPage(1)
  }
  const [activeId, setActiveId] = useState<number | null>(null)
  const list = useLoader(() => listAdminCustomers({ q: dq, page, pageSize: PAGE_SIZE }), `${dq}|${page}`)

  if (list.error && !list.data) {
    return (
      <div>
        <PageHeader title={AS.customers.title} description={AS.customers.subtitle} />
        {isUnavailable(list.error) ? <UnavailableState feature={AS.customers.feature} /> : <ErrorState message={apiErrorMessage(list.error)} onRetry={list.reload} />}
      </div>
    )
  }

  const data = list.data
  const needle = dq.trim().toLocaleLowerCase('tr-TR')
  // Sunucu sayfalıyorsa satırlar o sayfanındır; değilse istemcide süz.
  const rows = !data || (list.loading && !data) ? null : data.serverPaged ? data.customers : data.customers.filter((c) => !needle || c.name.toLocaleLowerCase('tr-TR').includes(needle) || c.email.toLowerCase().includes(needle))

  function onUpdated(c: AdminCustomer) {
    list.setData((d) => (d ? { ...d, customers: d.customers.map((x) => (x.id === c.id ? c : x)) } : d))
  }

  const columns: Column<AdminCustomer>[] = [
    {
      key: 'name',
      header: AS.customers.colName,
      primary: true,
      sortValue: (c) => c.name,
      render: (c) => (
        <div style={{ minWidth: 0 }}>
          <div className={ui.cellTitle}>{c.name}</div>
          <div className={ui.cellSub}>{c.email}</div>
        </div>
      ),
    },
    { key: 'created', header: AS.customers.colCreated, sortValue: (c) => c.createdAt, render: (c) => formatDate(c.createdAt) },
    { key: 'orders', header: AS.customers.colOrders, align: 'right', sortValue: (c) => c.ordersCount, render: (c) => <span className={ui.num}>{c.ordersCount}</span> },
    { key: 'total', header: AS.customers.colTotal, align: 'right', sortValue: (c) => c.totalSpent, render: (c) => <span className={ui.num}>{formatPrice(c.totalSpent)}</span> },
    { key: 'discount', header: AS.customers.colDiscount, sortValue: (c) => (c.discountUsed ? 1 : c.discountEligible ? 0 : 2), render: discountBadge },
  ]

  return (
    <div>
      <PageHeader title={AS.customers.title} description={AS.customers.subtitle} />
      <FilterBar search={{ value: q, onChange: setQ, placeholder: AS.customers.searchPlaceholder }} active={!!q} onClear={() => setQ('')} />
      <DataTable
        caption={AS.customers.title}
        columns={columns}
        rows={rows}
        rowKey={(c) => String(c.id)}
        resetKey={dq}
        server={data?.serverPaged ? { page, total: data.total, onPage: setPage } : undefined}
        onRowClick={(c) => setActiveId(c.id)}
        rowLabel={(c) => AS.customers.viewDetail(c.name)}
        isRowSelected={(c) => c.id === activeId}
        empty={<EmptyState icon="customers" title={q ? AS.customers.emptyFiltered : AS.customers.empty} />}
      />
      {activeId != null ? <CustomerDrawer key={activeId} id={activeId} onClose={() => setActiveId(null)} onUpdated={onUpdated} /> : null}
    </div>
  )
}

function CustomerDrawer({ id, onClose, onUpdated }: { id: number; onClose: () => void; onUpdated: (c: AdminCustomer) => void }) {
  const toast = useToast()
  const navigate = useNavigate()
  const detail = useLoader(() => getAdminCustomer(id), String(id))
  const [confirmOff, setConfirmOff] = useState(false)
  const [pending, setPending] = useState(false)
  const d = detail.data

  async function setEligible(on: boolean) {
    if (!d) return
    setPending(true)
    try {
      const customer = await updateAdminCustomer(id, { discountEligible: on })
      detail.setData((x) => (x ? { ...x, customer } : x))
      onUpdated(customer)
      toast.success(AS.customers.discountSaved(on))
    } catch (e) {
      toast.error(apiErrorMessage(e))
    } finally {
      setPending(false)
      setConfirmOff(false)
    }
  }

  return (
    <>
      <Drawer open onClose={onClose} title={d?.customer.name ?? AS.common.loading} subtitle={d?.customer.email} wide>
        {detail.error && !d ? (
          <ErrorState message={apiErrorMessage(detail.error)} onRetry={detail.reload} />
        ) : !d ? (
          <div className={ui.stackSm}>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={ui.skeleton} style={{ width: `${90 - i * 12}%` }} />
            ))}
          </div>
        ) : (
          <>
            <section className={styles.drawerSection}>
              <h3 className={ui.subTitle}>{AS.customers.detailSummary}</h3>
              <dl className={ui.dl}>
                <dt>{AS.customers.colCreated}</dt>
                <dd>{formatDate(d.customer.createdAt)}</dd>
                <dt>{AS.customers.colOrders}</dt>
                <dd>{d.customer.ordersCount}</dd>
                <dt>{AS.customers.colTotal}</dt>
                <dd>{formatPrice(d.customer.totalSpent)}</dd>
                <dt>{AS.customers.lastOrder}</dt>
                <dd>{d.customer.lastOrderAt ? formatWhen(d.customer.lastOrderAt) : AS.common.none}</dd>
              </dl>
            </section>

            <section className={styles.drawerSection}>
              <h3 className={ui.subTitle}>{AS.customers.discountTitle}</h3>
              <div className={ui.stackSm}>
                <div className={ui.row}>{discountBadge(d.customer)}</div>
                <SwitchField
                  label={AS.customers.discountToggle}
                  hint={AS.customers.discountHint}
                  checked={d.customer.discountEligible}
                  disabled={pending}
                  onChange={(e) => (e.target.checked ? void setEligible(true) : setConfirmOff(true))}
                />
              </div>
            </section>

            <section className={styles.drawerSection}>
              <h3 className={ui.subTitle}>{AS.customers.detailOrders}</h3>
              {d.orders.length === 0 ? (
                <p className={ui.muted}>{AS.customers.detailNoOrders}</p>
              ) : (
                <ul className={styles.itemList}>
                  {d.orders.map((o) => (
                    <li key={o.id} className={styles.item} style={{ gridTemplateColumns: 'minmax(0,1fr) auto auto' }}>
                      <div>
                        <div className={styles.itemName}>{o.id}</div>
                        <div className={styles.itemMeta}>{formatWhen(o.createdAt)}</div>
                      </div>
                      <StatusBadge tone={orderStatusTone(o.status)}>{AS.ordersApi.statusLabels[o.status] ?? o.status}</StatusBadge>
                      <div className={styles.itemPrice}>
                        {formatPrice(o.totals.total)}
                        <div>
                          <Btn size="sm" variant="ghost" onClick={() => navigate(`/admin/siparisler?id=${encodeURIComponent(o.id)}`)}>
                            {AS.customers.openOrder}
                          </Btn>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className={styles.drawerSection}>
              <h3 className={ui.subTitle}>{AS.customers.detailAddresses}</h3>
              {d.addresses.length === 0 ? (
                <p className={ui.muted}>{AS.customers.detailNoAddresses}</p>
              ) : (
                <div className={ui.formGrid}>
                  {d.addresses.map((a) => (
                    <div key={a.id} className={ui.card} style={{ padding: 12 }}>
                      <div className={ui.row} style={{ justifyContent: 'space-between', marginBottom: 4 }}>
                        <strong>{a.label || `${a.firstName ?? ''} ${a.lastName ?? ''}`.trim()}</strong>
                        {a.isDefault ? <StatusBadge tone="neutral">{AS.customers.detailDefault}</StatusBadge> : null}
                      </div>
                      <address style={{ fontStyle: 'normal', fontSize: 13, lineHeight: 1.55 }} className={ui.muted}>
                        {a.label ? (
                          <>
                            {a.firstName} {a.lastName}
                            <br />
                          </>
                        ) : null}
                        {a.address}
                        <br />
                        {[a.district, a.city].filter(Boolean).join(' / ')} {a.postalCode}
                        <br />
                        {a.country}
                        {a.phone ? (
                          <>
                            <br />
                            {a.phone}
                          </>
                        ) : null}
                      </address>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </Drawer>
      <ConfirmDialog
        open={confirmOff}
        title={AS.customers.discountConfirmOffTitle}
        message={AS.customers.discountConfirmOffText}
        tone="danger"
        pending={pending}
        onCancel={() => setConfirmOff(false)}
        onConfirm={() => void setEligible(false)}
      />
    </>
  )
}
