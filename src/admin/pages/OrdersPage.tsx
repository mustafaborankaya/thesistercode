import { useEffect, useReducer, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router-dom'
import { siteSettings } from '../../config/settings'
import { allProducts } from '../../data/catalog'
import { apiErrorMessage } from '../../i18n/apiMessages'
import { listDemoOrders, type DemoOrder } from '../../services/checkout'
import { orderStatusLabels, subscribeCustomer } from '../../services/customer'
import {
  ADMIN_ORDER_STATUSES,
  getAdminOrder,
  orderExtrasSupported,
  patchAdminOrder,
  queryAdminOrders,
  refundAdminOrder,
  useApiMode,
  type AdminOrderPatch,
  type AdminOrderStatus,
  type ApiOrder,
} from '../adminApi'
import { AS } from '../adminStrings'
import { OrderServiceControls } from '../components/OrderServiceControls'
import { AdminIcon } from '../ui/AdminIcon'
import { Btn } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { DataTable, type Column } from '../ui/DataTable'
import { Drawer } from '../ui/Drawer'
import { FilterBar, FilterDate, FilterSelect } from '../ui/FilterBar'
import { SelectField, TextAreaField, TextField } from '../ui/Form'
import { EmptyState, ErrorState, Notice, PageHeader } from '../ui/Page'
import { StatusBadge } from '../ui/StatusBadge'
import { orderStatusTone, paymentStatusTone } from '../ui/tones'
import { formatDateTime, formatPrice, formatWhen, isoDay } from '../ui/format'
import { useToast } from '../ui/toastContext'
import { useLoader } from '../ui/useLoader'
import ui from '../ui/ui.module.css'
import styles from '../admin.module.css'

const PAGE_SIZE = 20
const productMap = Object.fromEntries(allProducts.map((p) => [p.id, p]))
const statusLabel = (s: string) => AS.ordersApi.statusLabels[s] ?? s

/** Ödeme sağlayıcısı etkinken 'paid' yalnızca sağlayıcı sonucuyla gelir; 'pending_payment' hiçbir zaman elle seçilmez. */
function statusOptionDisabled(option: AdminOrderStatus, current: string): boolean {
  if (option === current) return false
  if (option === 'pending_payment') return true
  if (option === 'paid' && siteSettings.payment.provider !== 'none') return true
  if (current === 'pending_payment' && option !== 'cancelled') return true
  return false
}

function customerName(o: ApiOrder): string {
  return `${o.delivery.firstName} ${o.delivery.lastName}`.trim()
}

/** Eski sunucu sorguyu yok sayarsa istemcide süzme: sipariş no / e-posta / ad, durum, tarih aralığı (yerel gün). */
function matchesFilters(o: ApiOrder, f: { q: string; status: string; from: string; to: string }): boolean {
  if (f.status && o.status !== f.status) return false
  const day = isoDay(new Date(o.createdAt))
  if (f.from && day < f.from) return false
  if (f.to && day > f.to) return false
  const q = f.q.trim().toLocaleLowerCase('tr-TR')
  if (!q) return true
  return [o.id, o.contact.email, customerName(o), o.contact.phone].some((v) => (v ?? '').toLocaleLowerCase('tr-TR').includes(q))
}

function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms)
    return () => window.clearTimeout(t)
  }, [value, ms])
  return v
}

/** `/admin/siparisler` — API varsa gerçek siparişler; yoksa bu tarayıcıdaki demo siparişler. */
export function OrdersPage() {
  return useApiMode ? <ApiOrdersPage /> : <LocalOrdersPage />
}

/* ==================== API modu ==================== */

function ApiOrdersPage() {
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState(() => params.get('durum') ?? '')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const dq = useDebounced(q)
  const filters = { q: dq, status, from, to }
  const filterKey = JSON.stringify(filters)
  const [prevKey, setPrevKey] = useState(filterKey)
  if (prevKey !== filterKey) {
    setPrevKey(filterKey)
    setPage(1)
  }

  const res = useLoader(() => queryAdminOrders({ ...filters, page, pageSize: PAGE_SIZE }), `${filterKey}|${page}`)
  const serverPaged = res.data?.serverPaged ?? false
  const rows = !res.data ? null : serverPaged ? res.data.orders : res.data.orders.filter((o) => matchesFilters(o, filters))

  const activeId = params.get('id')
  const active = activeId ? (res.data?.orders.find((o) => o.id === activeId) ?? null) : null

  function open(id: string | null) {
    const next = new URLSearchParams(params)
    if (id) next.set('id', id)
    else next.delete('id')
    setParams(next, { replace: !id })
  }

  function onUpdated(order: ApiOrder) {
    res.setData((d) => (d ? { ...d, orders: d.orders.map((o) => (o.id === order.id ? order : o)) } : d))
  }

  const filtersActive = !!(q || status || from || to)
  const columns: Column<ApiOrder>[] = [
    {
      key: 'id',
      header: AS.orders.no,
      primary: true,
      sortValue: (o) => o.id,
      render: (o) => (
        <div>
          <div className={ui.cellTitle}>{o.id}</div>
          {o.items?.length ? <div className={ui.cellSub}>{AS.orders.itemsCount(o.items.reduce((n, i) => n + i.qty, 0))}</div> : null}
        </div>
      ),
    },
    { key: 'date', header: AS.orders.date, sortValue: (o) => o.createdAt, render: (o) => <span className={ui.num}>{formatWhen(o.createdAt)}</span> },
    {
      key: 'customer',
      header: AS.orders.customer,
      sortValue: (o) => customerName(o),
      render: (o) => (
        <div style={{ minWidth: 0 }}>
          <div>{customerName(o)}</div>
          <div className={ui.cellSub}>{o.contact.email}</div>
        </div>
      ),
    },
    { key: 'total', header: AS.orders.total, align: 'right', sortValue: (o) => o.totals.total, render: (o) => <span className={ui.num}>{formatPrice(o.totals.total)}</span> },
    { key: 'status', header: AS.ordersApi.statusLabel, sortValue: (o) => o.status, render: (o) => <StatusBadge tone={orderStatusTone(o.status)}>{statusLabel(o.status)}</StatusBadge> },
    {
      key: 'payment',
      header: AS.ordersApi.paymentLabel,
      sortValue: (o) => o.payment?.status ?? '',
      render: (o) =>
        o.payment ? (
          <span className={ui.row} style={{ gap: 6, flexWrap: 'nowrap' }}>
            <StatusBadge tone={paymentStatusTone(o.payment.status)}>{AS.ordersApi.paymentStatus[o.payment.status] ?? o.payment.status}</StatusBadge>
            {o.payment.lastFour ? <span className={ui.cellSub}>•••• {o.payment.lastFour}</span> : null}
          </span>
        ) : (
          <span className={ui.faint}>{AS.ordersApi.paymentNone}</span>
        ),
    },
  ]

  return (
    <div>
      <PageHeader title={AS.orders.title} description={AS.orders.subtitle} actions={<Btn icon="refresh" variant="ghost" onClick={res.reload} loading={res.loading && !!res.data}>{AS.common.refresh}</Btn>} />
      <FilterBar
        search={{ value: q, onChange: setQ, placeholder: AS.orders.searchPlaceholder }}
        active={filtersActive}
        onClear={() => {
          setQ('')
          setStatus('')
          setFrom('')
          setTo('')
        }}
      >
        <FilterSelect label={AS.orders.statusFilter} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{AS.common.all}</option>
          {ADMIN_ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </FilterSelect>
        <FilterDate label={AS.orders.fromLabel} value={from} max={to || undefined} onChange={setFrom} />
        <FilterDate label={AS.orders.toLabel} value={to} min={from || undefined} onChange={setTo} />
      </FilterBar>

      {res.error && !res.data ? (
        <ErrorState message={apiErrorMessage(res.error)} onRetry={res.reload} />
      ) : (
        <DataTable
          caption={AS.orders.title}
          columns={columns}
          rows={res.loading && !res.data ? null : rows}
          rowKey={(o) => o.id}
          initialSort={serverPaged ? undefined : { key: 'date', dir: 'desc' }}
          resetKey={filterKey}
          server={serverPaged && res.data ? { page, total: res.data.total, onPage: setPage } : undefined}
          onRowClick={(o) => open(o.id)}
          rowLabel={(o) => AS.orders.viewDetail(o.id)}
          isRowSelected={(o) => o.id === activeId}
          empty={<EmptyState icon="orders" title={filtersActive ? AS.orders.emptyFiltered : AS.orders.empty} />}
        />
      )}

      {activeId ? <OrderDrawer key={activeId} id={activeId} initial={active} onClose={() => open(null)} onUpdated={onUpdated} /> : null}
    </div>
  )
}

interface OrderDrawerProps {
  id: string
  initial: ApiOrder | null
  onClose: () => void
  onUpdated: (o: ApiOrder) => void
}

const CARRIERS = AS.ordersApi.carriers

function OrderDrawer({ id, initial, onClose, onUpdated }: OrderDrawerProps) {
  const toast = useToast()
  const loaded = useLoader(() => getAdminOrder(id), id)
  const [local, setLocal] = useState<ApiOrder | null>(null)
  const order = local ?? loaded.data ?? initial

  const extras = order ? orderExtrasSupported(order) : false
  const [nextStatus, setNextStatus] = useState('')
  const [carrierChoice, setCarrierChoice] = useState<string | null>(null)
  const [carrierCustom, setCarrierCustom] = useState<string | null>(null)
  const [tracking, setTracking] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [trackingError, setTrackingError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<'status' | 'refund' | null>(null)
  const [busy, setBusy] = useState<'status' | 'ship' | 'note' | 'refund' | null>(null)

  if (!order) {
    return (
      <Drawer open onClose={onClose} title={id}>
        {loaded.error ? <ErrorState message={apiErrorMessage(loaded.error)} onRetry={loaded.reload} /> : <EmptyState icon="refresh" title={AS.common.loading} />}
      </Drawer>
    )
  }

  const current = order
  const savedCarrier = current.shipping?.carrier ?? ''
  const carrierSel = carrierChoice ?? (savedCarrier ? (CARRIERS.includes(savedCarrier) ? savedCarrier : '__other') : '')
  const carrierText = carrierSel === '__other' ? (carrierCustom ?? (CARRIERS.includes(savedCarrier) ? '' : savedCarrier)) : carrierSel
  const trackingVal = tracking ?? current.shipping?.trackingNumber ?? ''
  const noteVal = note ?? current.adminNote ?? ''
  const shipDirty = carrierText.trim() !== savedCarrier || trackingVal.trim() !== (current.shipping?.trackingNumber ?? '')
  const noteDirty = noteVal.trim() !== (current.adminNote ?? '').trim()

  const statusOptions = ADMIN_ORDER_STATUSES.filter((s) => s !== 'demo' || current.status === 'demo')
  const target = nextStatus || current.status

  function apply(updated: ApiOrder) {
    setLocal(updated)
    onUpdated(updated)
  }

  function requestStatus() {
    if (target === current.status) return
    if (target === 'shipped' && extras && !trackingVal.trim()) {
      setTrackingError(AS.ordersApi.trackingRequired)
      return
    }
    setConfirm('status')
  }

  async function doStatus() {
    setBusy('status')
    const patch: AdminOrderPatch = { status: target }
    const sendShip = target === 'shipped' && extras
    if (sendShip) {
      patch.carrier = carrierText.trim() || null
      patch.trackingNumber = trackingVal.trim() || null
    }
    try {
      const updated = await patchAdminOrder(current.id, patch)
      apply(updated)
      setNextStatus('')
      setConfirm(null)
      if (sendShip && !updated.shipping) toast.warning(AS.ordersApi.extrasDropped)
      else toast.success(AS.ordersApi.statusUpdated)
    } catch (e) {
      toast.error(apiErrorMessage(e))
      setConfirm(null)
    } finally {
      setBusy(null)
    }
  }

  async function saveShipping() {
    setBusy('ship')
    try {
      const updated = await patchAdminOrder(current.id, { carrier: carrierText.trim() || null, trackingNumber: trackingVal.trim() || null })
      apply(updated)
      setCarrierChoice(null)
      setCarrierCustom(null)
      setTracking(null)
      toast.success(AS.ordersApi.shipSaved)
    } catch (e) {
      toast.error(apiErrorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  async function saveNote() {
    setBusy('note')
    try {
      const updated = await patchAdminOrder(current.id, { adminNote: noteVal.trim() || null })
      apply(updated)
      setNote(null)
      toast.success(AS.orders.notesSaved)
    } catch (e) {
      toast.error(apiErrorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  async function doRefund() {
    setBusy('refund')
    try {
      const updated = await refundAdminOrder(current.id)
      apply(updated)
      setConfirm(null)
      toast.success(AS.ordersApi.refunded)
    } catch (e) {
      toast.error(apiErrorMessage(e))
      setConfirm(null)
    } finally {
      setBusy(null)
    }
  }

  const p = current.payment
  const items = current.items ?? []
  const timeline: { label: string; at: string | null | undefined; done: boolean }[] = [
    { label: AS.orders.tlCreated, at: current.createdAt, done: true },
    ...(p ? [{ label: AS.orders.tlPaymentStarted, at: p.createdAt, done: true }] : []),
    ...(p && (p.status === 'success' || p.status === 'refunded') ? [{ label: AS.orders.tlPaid, at: p.updatedAt, done: true }] : []),
    ...(p && p.status === 'failure' ? [{ label: AS.orders.tlPaymentFailed, at: p.updatedAt, done: true }] : []),
    ...(current.shipping?.shippedAt ? [{ label: AS.orders.tlShipped, at: current.shipping.shippedAt, done: true }] : []),
    ...(p && p.status === 'refunded' ? [{ label: AS.orders.tlRefunded, at: p.updatedAt, done: true }] : []),
    ...(current.updatedAt && current.updatedAt !== current.createdAt ? [{ label: AS.orders.tlUpdated(statusLabel(current.status)), at: current.updatedAt, done: true }] : []),
  ]

  return (
    <>
      <Drawer
        open
        wide
        onClose={onClose}
        title={current.id}
        subtitle={formatDateTime(current.createdAt)}
        headerExtra={<StatusBadge tone={orderStatusTone(current.status)}>{statusLabel(current.status)}</StatusBadge>}
        footer={
          <>
            <Btn icon="printer" onClick={() => window.print()}>
              {AS.orders.printSlip}
            </Btn>
            <Btn variant="primary" onClick={onClose}>
              {AS.ui.close}
            </Btn>
          </>
        }
      >
        {p?.fraudStatus === 0 ? <Notice tone="danger">{AS.ordersApi.fraudReview}</Notice> : null}

        <section className={styles.drawerSection} aria-labelledby="od-status">
          <h3 id="od-status" className={ui.subTitle}>
            {AS.ordersApi.statusTitle}
          </h3>
          <div className={styles.statusRow}>
            <SelectField label={AS.ordersApi.newStatus} value={target} disabled={busy != null} onChange={(e) => setNextStatus(e.target.value)}>
              {statusOptions.map((s) => (
                <option key={s} value={s} disabled={statusOptionDisabled(s, current.status)}>
                  {statusLabel(s)}
                  {s === current.status ? ' (şu an)' : ''}
                </option>
              ))}
            </SelectField>
            <Btn variant="primary" disabled={target === current.status} loading={busy === 'status'} onClick={requestStatus}>
              {AS.ordersApi.changeStatus}
            </Btn>
          </div>
          {target === 'shipped' && current.status !== 'shipped' && extras ? (
            <div className={ui.formGrid} style={{ marginTop: 12 }}>
              <CarrierFields sel={carrierSel} text={carrierText} onSel={setCarrierChoice} onText={setCarrierCustom} />
              <TextField
                label={AS.ordersApi.trackingLabel}
                value={trackingVal}
                maxLength={100}
                error={trackingError}
                onChange={(e) => {
                  setTracking(e.target.value)
                  setTrackingError(null)
                }}
              />
            </div>
          ) : null}
          <p className={ui.hint} style={{ marginTop: 8 }}>
            {current.status === 'cancelled' ? AS.ordersApi.reopenHint : p ? AS.ordersApi.statusLockedHint : null}
          </p>
          {!extras ? (
            <Notice tone="neutral" icon="refresh">
              {AS.ordersApi.extrasUnavailable}
            </Notice>
          ) : null}
        </section>

        {extras && (current.status === 'shipped' || current.shipping?.trackingNumber || current.shipping?.carrier) ? (
        <section className={styles.drawerSection} aria-labelledby="od-ship">
          <h3 id="od-ship" className={ui.subTitle}>
            {AS.ordersApi.shipTitle}
          </h3>
            <div className={ui.stack}>
              <div className={ui.formGrid}>
                <CarrierFields sel={carrierSel} text={carrierText} onSel={setCarrierChoice} onText={setCarrierCustom} />
                <TextField label={AS.ordersApi.trackingLabel} value={trackingVal} maxLength={100} onChange={(e) => setTracking(e.target.value)} />
              </div>
              <div className={ui.row} style={{ justifyContent: 'space-between' }}>
                <span className={ui.small}>
                  {current.shipping?.shippedAt ? (
                    <span className={ui.muted}>
                      {AS.ordersApi.shippedAt}: {formatDateTime(current.shipping.shippedAt)}
                    </span>
                  ) : null}
                  {current.shipping?.trackingUrl ? (
                    <>
                      {' '}
                      <a className={ui.link} href={current.shipping.trackingUrl} target="_blank" rel="noopener noreferrer">
                        {AS.ordersApi.trackingLink}
                      </a>
                    </>
                  ) : null}
                </span>
                <Btn icon="truck" disabled={!shipDirty} loading={busy === 'ship'} onClick={() => void saveShipping()}>
                  {AS.ordersApi.shipSave}
                </Btn>
              </div>
            </div>
        </section>
        ) : null}

        <section className={styles.drawerSection} aria-labelledby="od-items">
          <h3 id="od-items" className={ui.subTitle}>
            {AS.orders.items}
          </h3>
          <ul className={styles.itemList}>
            {items.map((item) => {
              const prod = productMap[item.productId]
              const src = prod?.media.find((m) => m.kind === 'front')?.src ?? prod?.media[0]?.src ?? null
              return (
                <li key={`${item.productId}:${item.colorId}:${item.size}`} className={styles.item}>
                  {src ? (
                    <img className={ui.thumb} src={src} alt="" loading="lazy" />
                  ) : (
                    <span className={[ui.thumb, ui.thumbEmpty].join(' ')}>
                      <AdminIcon name="images" size={16} />
                    </span>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div className={styles.itemName}>{item.productName}</div>
                    <div className={styles.itemMeta}>
                      {item.colorLabel} · {item.size} · {AS.orders.unitPrice(item.qty, formatPrice(item.unitPrice))}
                    </div>
                  </div>
                  <div className={styles.itemPrice}>{formatPrice(item.unitPrice * item.qty)}</div>
                </li>
              )
            })}
          </ul>
          <dl className={styles.totals}>
            <dt>{AS.orders.subtotal}</dt>
            <dd>{formatPrice(current.totals.subtotal)}</dd>
            {current.totals.discountAmount ? (
              <>
                <dt>
                  {AS.orders.discount}
                  {current.totals.discountPercent ? ` (%${current.totals.discountPercent})` : ''}
                </dt>
                <dd>−{formatPrice(current.totals.discountAmount)}</dd>
              </>
            ) : null}
            <dt>{AS.orders.shipping}</dt>
            <dd>{current.totals.shipping == null ? AS.orders.shippingUndefined : formatPrice(current.totals.shipping)}</dd>
            <dt className={styles.totalsGrand}>{AS.orders.grandTotal}</dt>
            <dd className={styles.totalsGrand}>{formatPrice(current.totals.total)}</dd>
          </dl>
        </section>

        <section className={styles.drawerSection} aria-labelledby="od-delivery">
          <div className={ui.formGrid}>
            <div>
              <h3 id="od-delivery" className={ui.subTitle}>
                {AS.orders.delivery}
              </h3>
              <address style={{ fontStyle: 'normal', lineHeight: 1.6 }}>
                <strong>{customerName(current)}</strong>
                <br />
                {current.delivery.address}
                <br />
                {current.delivery.district} / {current.delivery.city} {current.delivery.postalCode}
                <br />
                {current.delivery.country}
              </address>
              {current.delivery.note ? <p className={ui.muted} style={{ marginTop: 6 }}>“{current.delivery.note}”</p> : null}
            </div>
            <div>
              <h3 className={ui.subTitle}>{AS.orders.contact}</h3>
              <p>
                <a className={ui.link} href={`mailto:${current.contact.email}`}>
                  {current.contact.email}
                </a>
              </p>
              <p>
                <a className={ui.link} href={`tel:${current.contact.phone}`}>
                  {current.contact.phone}
                </a>
              </p>
            </div>
          </div>
        </section>

        <section className={styles.drawerSection} aria-labelledby="od-pay">
          <h3 id="od-pay" className={ui.subTitle}>
            {AS.ordersApi.paymentTitle}
          </h3>
          {p ? (
            <div className={ui.stack}>
              <dl className={ui.dl}>
                <dt>{AS.ordersApi.statusLabel}</dt>
                <dd>
                  <StatusBadge tone={paymentStatusTone(p.status)}>{AS.ordersApi.paymentStatus[p.status] ?? p.status}</StatusBadge>
                  {current.paymentAttempts && current.paymentAttempts > 1 ? <span className={ui.muted}> · {AS.ordersApi.paymentAttempts(current.paymentAttempts)}</span> : null}
                </dd>
                <dt>{AS.ordersApi.paymentProvider}</dt>
                <dd>{p.provider}</dd>
                {p.paymentId ? (
                  <>
                    <dt>{AS.ordersApi.paymentId}</dt>
                    <dd className={ui.mono}>{p.paymentId}</dd>
                  </>
                ) : null}
                {p.status === 'success' || p.status === 'refunded' ? (
                  <>
                    <dt>{AS.ordersApi.paymentPaid}</dt>
                    <dd>{formatPrice(p.paidPrice)}</dd>
                    <dt>{AS.ordersApi.paymentInstallment}</dt>
                    <dd>{p.installment && p.installment > 1 ? `${p.installment}` : AS.ordersApi.paymentSingle}</dd>
                  </>
                ) : null}
                {p.lastFour ? (
                  <>
                    <dt>{AS.ordersApi.paymentCard}</dt>
                    <dd>
                      {[p.cardAssociation, p.cardFamily].filter(Boolean).join(' / ')} •••• {p.lastFour}
                    </dd>
                  </>
                ) : null}
                {p.errorCode ? (
                  <>
                    <dt>{AS.ordersApi.paymentError}</dt>
                    <dd>
                      {p.errorCode}
                      {p.errorMessage ? ` — ${p.errorMessage}` : ''}
                    </dd>
                  </>
                ) : null}
              </dl>
              {p.status === 'success' ? (
                <div>
                  <Btn variant="danger" icon="refresh" loading={busy === 'refund'} onClick={() => setConfirm('refund')}>
                    {AS.ordersApi.refund}
                  </Btn>
                </div>
              ) : null}
            </div>
          ) : (
            <p className={ui.muted}>{AS.ordersApi.paymentNone}</p>
          )}
        </section>

        <section className={styles.drawerSection} aria-labelledby="od-tl">
          <h3 id="od-tl" className={ui.subTitle}>
            {AS.orders.timeline}
          </h3>
          <ol className={styles.timeline}>
            {timeline.map((t, i) => (
              <li key={i} className={t.done ? styles.timelineDone : undefined}>
                {t.label}
                <span className={styles.timelineWhen}>{formatDateTime(t.at)}</span>
              </li>
            ))}
          </ol>
        </section>

        {extras ? (
          <section className={styles.drawerSection} aria-labelledby="od-note">
            <h3 id="od-note" className={ui.subTitle}>
              {AS.orders.notesTitle}
            </h3>
            <div className={ui.stack}>
              <TextAreaField label={AS.orders.notesTitle} hideLabel hint={AS.orders.notesHint} rows={3} maxLength={2000} value={noteVal} onChange={(e) => setNote(e.target.value)} />
              <div>
                <Btn icon="note" disabled={!noteDirty} loading={busy === 'note'} onClick={() => void saveNote()}>
                  {AS.orders.notesSave}
                </Btn>
              </div>
            </div>
          </section>
        ) : null}
      </Drawer>

      <ConfirmDialog
        open={confirm === 'status'}
        title={target === 'cancelled' ? AS.ordersApi.cancelConfirmTitle : AS.ordersApi.statusConfirmTitle(statusLabel(current.status), statusLabel(target))}
        message={target === 'cancelled' ? AS.ordersApi.cancelConfirmText : AS.ordersApi.statusConfirmText}
        confirmLabel={target === 'cancelled' ? AS.ordersApi.cancelConfirm : AS.ordersApi.changeStatus}
        tone={target === 'cancelled' ? 'danger' : 'default'}
        pending={busy === 'status'}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void doStatus()}
      />
      <ConfirmDialog
        open={confirm === 'refund'}
        title={AS.ordersApi.refundTitle}
        message={p ? AS.ordersApi.refundConfirm(formatPrice(p.paidPrice)) : ''}
        confirmLabel={AS.ordersApi.refundYes}
        cancelLabel={AS.ordersApi.refundNo}
        tone="danger"
        pending={busy === 'refund'}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void doRefund()}
      />
      <PackingSlip order={current} />
    </>
  )
}

function CarrierFields({ sel, text, onSel, onText }: { sel: string; text: string; onSel: (v: string) => void; onText: (v: string) => void }) {
  return (
    <>
      <SelectField label={AS.ordersApi.carrierLabel} value={sel} onChange={(e) => onSel(e.target.value)}>
        <option value="">{AS.ordersApi.carrierPlaceholder}</option>
        {CARRIERS.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
        <option value="__other">{AS.ordersApi.carrierOther}</option>
      </SelectField>
      {sel === '__other' ? <TextField label={AS.ordersApi.carrierCustom} value={text} maxLength={64} onChange={(e) => onText(e.target.value)} /> : null}
    </>
  )
}

/** Yazdırma için paketleme fişi — `body`'nin doğrudan çocuğu olarak çizilir; ekranda gizli, yazdırırken yalnızca o görünür. */
function PackingSlip({ order }: { order: ApiOrder }) {
  return createPortal(
    <div className={styles.printSlip} aria-hidden="true">
      <div className={styles.slipHead}>
        <div>
          <div className={styles.slipBrand}>{siteSettings.brand.name}</div>
          <div>{AS.orders.slipTitle}</div>
        </div>
        <div className={styles.slipMeta}>
          <div>
            {AS.orders.slipOrder}: <strong>{order.id}</strong>
          </div>
          <div>
            {AS.orders.slipDate}: {formatDateTime(order.createdAt)}
          </div>
          {order.shipping?.carrier || order.shipping?.trackingNumber ? (
            <div>
              {order.shipping?.carrier} {order.shipping?.trackingNumber}
            </div>
          ) : null}
        </div>
      </div>
      <div className={styles.slipGrid}>
        <div>
          <div className={styles.slipLabel}>{AS.orders.slipShipTo}</div>
          <div>
            <strong>{customerName(order)}</strong>
          </div>
          <div>{order.delivery.address}</div>
          <div>
            {order.delivery.district} / {order.delivery.city} {order.delivery.postalCode}
          </div>
          <div>{order.delivery.country}</div>
          <div>{order.contact.phone}</div>
        </div>
        {order.delivery.note ? (
          <div>
            <div className={styles.slipLabel}>{AS.orders.slipNote}</div>
            <div>{order.delivery.note}</div>
          </div>
        ) : null}
      </div>
      <table className={styles.slipTable}>
        <thead>
          <tr>
            <th>{AS.orders.slipProduct}</th>
            <th>{AS.orders.slipVariant}</th>
            <th>{AS.orders.slipQty}</th>
            <th>{AS.orders.slipCheck}</th>
          </tr>
        </thead>
        <tbody>
          {(order.items ?? []).map((i) => (
            <tr key={`${i.productId}:${i.colorId}:${i.size}`}>
              <td>{i.productName}</td>
              <td>
                {i.colorLabel} / {i.size}
              </td>
              <td>{i.qty}</td>
              <td>
                <span className={styles.slipBox} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>,
    document.body,
  )
}

/* ==================== Yerel (localStorage) modu — yalnızca API yokken (DEV) ==================== */

function LocalOrdersPage() {
  const [, refresh] = useReducer((value: number) => value + 1, 0)
  useEffect(() => subscribeCustomer(refresh), [])
  const orders = listDemoOrders()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const active = orders.find((order) => order.id === activeId) ?? null
  const needle = q.trim().toLocaleLowerCase('tr-TR')
  const rows = needle
    ? orders.filter((o) => [o.id, o.input.contact.email, `${o.input.delivery.firstName} ${o.input.delivery.lastName}`].some((v) => v.toLocaleLowerCase('tr-TR').includes(needle)))
    : orders

  const columns: Column<DemoOrder>[] = [
    { key: 'id', header: AS.orders.no, primary: true, sortValue: (o) => o.id, render: (o) => <span className={ui.cellTitle}>{o.id}</span> },
    { key: 'date', header: AS.orders.date, sortValue: (o) => o.createdAt, render: (o) => formatWhen(o.createdAt) },
    {
      key: 'customer',
      header: AS.orders.customer,
      render: (o) => (
        <div>
          <div>
            {o.input.delivery.firstName} {o.input.delivery.lastName}
          </div>
          <div className={ui.cellSub}>{o.input.contact.email}</div>
        </div>
      ),
    },
    { key: 'items', header: AS.orders.itemCount, align: 'right', render: (o) => o.input.totals.itemCount },
    { key: 'total', header: AS.orders.total, align: 'right', sortValue: (o) => o.input.totals.total, render: (o) => formatPrice(o.input.totals.total) },
    {
      key: 'status',
      header: AS.ordersApi.statusLabel,
      render: (o) => (
        <span className={ui.row} style={{ gap: 6 }}>
          <StatusBadge tone={o.status === 'cancelled' ? 'danger' : o.status === 'shipped' || o.status === 'delivered' ? 'success' : 'warning'}>{orderStatusLabels[o.status ?? 'placed']}</StatusBadge>
          {o.requests?.some((r) => r.status === 'pending') ? <StatusBadge tone="warning">Bekleyen talep</StatusBadge> : null}
        </span>
      ),
    },
  ]

  return (
    <div>
      <PageHeader title={AS.orders.title} description={AS.orders.subtitle} />
      <Notice tone="warning">{AS.orders.demoNotice}</Notice>
      <FilterBar search={{ value: q, onChange: setQ, placeholder: AS.orders.searchPlaceholder }} active={!!q} onClear={() => setQ('')} />
      <DataTable
        caption={AS.orders.title}
        columns={columns}
        rows={rows}
        rowKey={(o) => o.id}
        initialSort={{ key: 'date', dir: 'desc' }}
        resetKey={q}
        onRowClick={(o) => setActiveId(o.id)}
        rowLabel={(o) => AS.orders.viewDetail(o.id)}
        empty={<EmptyState icon="orders" title={q ? AS.orders.emptyFiltered : AS.orders.empty} />}
      />

      <Drawer open={active != null} onClose={() => setActiveId(null)} title={active ? active.id : ''} subtitle={active ? formatDateTime(active.createdAt) : undefined} wide>
        {active ? (
          <div>
            <Notice tone="warning">{AS.orders.demoNotice}</Notice>
            <section className={styles.drawerSection}>
              <OrderServiceControls key={active.id} order={active} />
            </section>
            <section className={styles.drawerSection}>
              <h3 className={ui.subTitle}>{AS.orders.items}</h3>
              <ul className={styles.itemList}>
                {active.input.lines.map((line) => {
                  const product = productMap[line.productId]
                  const snapshot = active.items?.find((item) => item.key === line.key)
                  return (
                    <li key={line.key} className={styles.item}>
                      <span className={[ui.thumb, ui.thumbEmpty].join(' ')}>
                        <AdminIcon name="box" size={16} />
                      </span>
                      <div>
                        <div className={styles.itemName}>{snapshot?.name ?? product?.name ?? line.productId}</div>
                        <div className={styles.itemMeta}>
                          {line.colorId} · {line.size} · × {line.qty}
                        </div>
                      </div>
                      <div className={styles.itemPrice}>{snapshot ? formatPrice(snapshot.unitPrice * snapshot.qty) : ''}</div>
                    </li>
                  )
                })}
              </ul>
              <dl className={styles.totals}>
                <dt>{AS.orders.subtotal}</dt>
                <dd>{formatPrice(active.input.totals.subtotal)}</dd>
                <dt>{AS.orders.discount}</dt>
                <dd>{formatPrice(active.input.totals.discountAmount)}</dd>
                <dt>{AS.orders.shipping}</dt>
                <dd>{active.input.totals.shipping == null ? AS.orders.shippingUndefined : formatPrice(active.input.totals.shipping)}</dd>
                <dt className={styles.totalsGrand}>{AS.orders.grandTotal}</dt>
                <dd className={styles.totalsGrand}>{formatPrice(active.input.totals.total)}</dd>
              </dl>
            </section>
            <section className={styles.drawerSection}>
              <h3 className={ui.subTitle}>{AS.orders.delivery}</h3>
              <address style={{ fontStyle: 'normal', lineHeight: 1.6 }}>
                <strong>
                  {active.input.delivery.firstName} {active.input.delivery.lastName}
                </strong>
                <br />
                {active.input.delivery.address}
                <br />
                {active.input.delivery.district} / {active.input.delivery.city} {active.input.delivery.postalCode}
                <br />
                {active.input.delivery.country}
              </address>
              {active.input.delivery.note ? <p className={ui.muted}>{active.input.delivery.note}</p> : null}
            </section>
          </div>
        ) : null}
      </Drawer>
    </div>
  )
}
