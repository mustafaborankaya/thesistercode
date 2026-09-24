import { useEffect, useReducer, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Drawer } from '../../components/ui/Drawer'
import { allProducts } from '../../data/catalog'
import { apiErrorMessage } from '../../i18n/apiMessages'
import { formatPrice } from '../../lib/format'
import { listDemoOrders } from '../../services/checkout'
import { subscribeCustomer, orderStatusLabels } from '../../services/customer'
import { ADMIN_ORDER_STATUSES, listAdminOrders, refundAdminOrder, updateAdminOrderStatus, useApiMode, type AdminOrderStatus } from '../adminApi'
import { siteSettings } from '../../config/settings'
import { OrderServiceControls } from '../components/OrderServiceControls'
import { AS } from '../adminStrings'
import styles from '../admin.module.css'
import type { ApiOrder, ApiPayment } from '../../services/ordersApi'

/** Ödeme sağlayıcısı etkinken 'paid' yalnızca sağlayıcı sonucuyla gelir; 'pending_payment' hiçbir zaman elle seçilmez. */
function statusOptionDisabled(option: AdminOrderStatus, current: string): boolean {
  if (option === current) return false
  if (option === 'pending_payment') return true
  if (option === 'paid' && siteSettings.payment.provider !== 'none') return true
  if (current === 'pending_payment' && option !== 'cancelled') return true
  return false
}

function paymentCell(p: ApiPayment | null | undefined): string {
  if (!p) return AS.ordersApi.paymentNone
  const status = AS.ordersApi.paymentStatus[p.status] ?? p.status
  return p.lastFour ? `${status} · **** ${p.lastFour}` : status
}

const productMap = Object.fromEntries(allProducts.map((p) => [p.id, p]))

/** `/admin/siparisler` — API varsa gerçek siparişler (GET/PATCH /admin/orders); yoksa bu tarayıcıdaki demo siparişler. */
export function OrdersPage() {
  return useApiMode ? <ApiOrdersPage /> : <LocalOrdersPage />
}

/* ==================== API modu ==================== */

function ApiOrdersPage() {
  const [orders, setOrders] = useState<ApiOrder[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [statusPending, setStatusPending] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [refundConfirm, setRefundConfirm] = useState(false)
  const [refundPending, setRefundPending] = useState(false)
  const [refundMessage, setRefundMessage] = useState<string | null>(null)

  function refresh() {
    setError(null)
    listAdminOrders()
      .then(setOrders)
      .catch((e) => setError(apiErrorMessage(e)))
  }

  useEffect(refresh, [])

  const active = orders?.find((o) => o.id === activeId) ?? null

  async function handleRefund() {
    if (!active) return
    setRefundPending(true)
    setRefundMessage(null)
    try {
      const updated = await refundAdminOrder(active.id)
      setOrders((list) => (list ? list.map((o) => (o.id === updated.id ? updated : o)) : list))
      setRefundMessage(AS.ordersApi.refunded)
      setRefundConfirm(false)
    } catch (e) {
      setRefundMessage(apiErrorMessage(e))
    } finally {
      setRefundPending(false)
    }
  }

  async function handleStatusChange(status: AdminOrderStatus) {
    if (!active) return
    setStatusPending(true)
    setStatusError(null)
    try {
      const updated = await updateAdminOrderStatus(active.id, status)
      setOrders((list) => (list ? list.map((o) => (o.id === updated.id ? updated : o)) : list))
    } catch (e) {
      setStatusError(apiErrorMessage(e))
    } finally {
      setStatusPending(false)
    }
  }

  return (
    <div>
      <div className={styles.pageHead}>
        <h1 className={styles.pageTitle}>{AS.orders.title}</h1>
      </div>
      <p className="text-soft text-sm" style={{ marginBottom: 'var(--sp-4)' }}>
        {AS.ordersApi.missingFeatures}
      </p>

      {error ? (
        <p className={styles.empty} role="alert">
          {error}
        </p>
      ) : !orders ? (
        <p className={styles.empty}>{AS.common.loading}</p>
      ) : orders.length === 0 ? (
        <p className={styles.empty}>{AS.orders.empty}</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{AS.orders.no}</th>
                <th scope="col">{AS.orders.date}</th>
                <th scope="col">{AS.orders.customer}</th>
                <th scope="col">{AS.orders.total}</th>
                <th scope="col">{AS.ordersApi.statusLabel}</th>
                <th scope="col">{AS.ordersApi.paymentLabel}</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr
                  key={order.id}
                  className={styles.rowLink}
                  tabIndex={0}
                  role="button"
                  aria-label={AS.orders.viewDetail(order.id)}
                  onClick={() => setActiveId(order.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setActiveId(order.id)
                    }
                  }}
                >
                  <td>{order.id}</td>
                  <td>{new Date(order.createdAt).toLocaleString('tr-TR')}</td>
                  <td>
                    {order.delivery.firstName} {order.delivery.lastName}
                    <br />
                    <span className="text-soft text-xs">{order.contact.email}</span>
                  </td>
                  <td>{formatPrice(order.totals.total)}</td>
                  <td>{AS.ordersApi.statusLabels[order.status] ?? order.status}</td>
                  <td>{paymentCell(order.payment)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Drawer
        open={active != null}
        onClose={() => {
          setActiveId(null)
          setStatusError(null)
          setRefundConfirm(false)
          setRefundMessage(null)
        }}
        title={active ? active.id : ''}
      >
        {active ? (
          <div className="stack">
            <div>
              <div className={styles.sectionTitle}>{AS.ordersApi.statusLabel}</div>
              <select
                value={active.status}
                disabled={statusPending}
                onChange={(e) => void handleStatusChange(e.target.value as AdminOrderStatus)}
              >
                {ADMIN_ORDER_STATUSES.map((status) => (
                  <option key={status} value={status} disabled={statusOptionDisabled(status, active.status)}>
                    {AS.ordersApi.statusLabels[status] ?? status}
                  </option>
                ))}
              </select>
              {active.payment ? <p className="text-soft text-xs">{AS.ordersApi.statusLockedHint}</p> : null}
              {statusError ? (
                <p role="alert" className="text-sm">
                  {statusError}
                </p>
              ) : null}
            </div>

            {active.payment ? (
              <div>
                <div className={styles.sectionTitle}>{AS.ordersApi.paymentTitle}</div>
                <p>
                  {AS.ordersApi.paymentStatus[active.payment.status] ?? active.payment.status} · {active.payment.provider}
                  {active.paymentAttempts && active.paymentAttempts > 1 ? ` · ${AS.ordersApi.paymentAttempts(active.paymentAttempts)}` : ''}
                </p>
                {active.payment.paymentId ? (
                  <p>
                    {AS.ordersApi.paymentId}: {active.payment.paymentId}
                  </p>
                ) : null}
                {active.payment.status === 'success' || active.payment.status === 'refunded' ? (
                  <>
                    <p>
                      {AS.ordersApi.paymentPaid}: {formatPrice(active.payment.paidPrice)}
                      {active.payment.installment ? ` · ${AS.ordersApi.paymentInstallment}: ${active.payment.installment}` : ''}
                    </p>
                    {active.payment.lastFour ? (
                      <p>
                        {AS.ordersApi.paymentCard}: {[active.payment.cardAssociation, active.payment.cardFamily].filter(Boolean).join(' / ')} **** {active.payment.lastFour}
                      </p>
                    ) : null}
                  </>
                ) : null}
                {active.payment.fraudStatus === 0 ? <p role="alert">{AS.ordersApi.fraudReview}</p> : null}
                {active.payment.errorCode ? (
                  <p className="text-soft text-sm">
                    {AS.ordersApi.paymentError}: {active.payment.errorCode}
                    {active.payment.errorMessage ? ` — ${active.payment.errorMessage}` : ''}
                  </p>
                ) : null}
                {active.payment.status === 'success' ? (
                  refundConfirm ? (
                    <div role="group" aria-label={AS.ordersApi.refund} className="stack">
                      <p>{AS.ordersApi.refundConfirm(formatPrice(active.payment.paidPrice))}</p>
                      <div className={styles.twoStepConfirm}>
                        <Button variant="primary" small disabled={refundPending} onClick={() => void handleRefund()}>
                          {refundPending ? AS.ordersApi.refunding : AS.ordersApi.refundYes}
                        </Button>
                        <Button variant="ghost" small disabled={refundPending} onClick={() => setRefundConfirm(false)}>
                          {AS.ordersApi.refundNo}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button variant="secondary" small onClick={() => setRefundConfirm(true)}>
                      {AS.ordersApi.refund}
                    </Button>
                  )
                ) : null}
                {refundMessage ? (
                  <p role="status" className="text-sm">
                    {refundMessage}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div>
              <div className={styles.sectionTitle}>{AS.orders.items}</div>
              <ul className="stack">
                {(active.items ?? []).map((item) => (
                  <li key={`${item.productId}:${item.colorId}:${item.size}`}>
                    {item.productName} — {item.colorLabel} / {item.size} × {item.qty} — {formatPrice(item.unitPrice * item.qty)}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className={styles.sectionTitle}>{AS.orders.delivery}</div>
              <p>
                {active.delivery.firstName} {active.delivery.lastName}
              </p>
              <p>{active.delivery.address}</p>
              <p>
                {active.delivery.district} / {active.delivery.city} {active.delivery.postalCode}
              </p>
              <p>{active.delivery.country}</p>
              {active.delivery.note ? <p className="text-soft">{active.delivery.note}</p> : null}
              <p className="text-soft text-sm">{active.contact.email} · {active.contact.phone}</p>
            </div>

            <div>
              <div className={styles.sectionTitle}>{AS.orders.totalsTitle}</div>
              <p>
                {AS.orders.subtotal}: {formatPrice(active.totals.subtotal)}
              </p>
              <p>
                {AS.orders.discount}: {formatPrice(active.totals.discountAmount)}
              </p>
              <p>
                {AS.orders.shipping}: {active.totals.shipping == null ? AS.orders.shippingUndefined : formatPrice(active.totals.shipping)}
              </p>
              <p>
                {AS.orders.grandTotal}: {formatPrice(active.totals.total)}
              </p>
            </div>
          </div>
        ) : null}
      </Drawer>
    </div>
  )
}

/* ==================== Yerel (localStorage) modu — yalnızca API yokken (DEV) ==================== */

function LocalOrdersPage() {
  const [, refresh] = useReducer((value: number) => value + 1, 0)
  useEffect(() => subscribeCustomer(refresh), [])
  const orders = listDemoOrders()
  const [activeId, setActiveId] = useState<string | null>(null)
  const active = orders.find((order) => order.id === activeId) ?? null

  return (
    <div>
      <div className={styles.pageHead}>
        <h1 className={styles.pageTitle}>{AS.orders.title}</h1>
      </div>
      <p className={styles.demoNotice}>{AS.orders.demoNotice}</p>

      {orders.length === 0 ? (
        <p className={styles.empty}>{AS.orders.empty}</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{AS.orders.no}</th>
                <th scope="col">{AS.orders.date}</th>
                <th scope="col">{AS.orders.customer}</th>
                <th scope="col">{AS.orders.itemCount}</th>
                <th scope="col">{AS.orders.total}</th>
                <th scope="col">Durum / Talepler</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr
                  key={order.id}
                  className={styles.rowLink}
                  tabIndex={0}
                  role="button"
                  aria-label={AS.orders.viewDetail(order.id)}
                  onClick={() => setActiveId(order.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setActiveId(order.id)
                    }
                  }}
                >
                  <td>{order.id}</td>
                  <td>{new Date(order.createdAt).toLocaleString('tr-TR')}</td>
                  <td>
                    {order.input.delivery.firstName} {order.input.delivery.lastName}
                    <br />
                    <span className="text-soft text-xs">{order.input.contact.email}</span>
                  </td>
                  <td>{order.input.totals.itemCount}</td>
                  <td>{formatPrice(order.input.totals.total)}</td>
                  <td>{orderStatusLabels[order.status ?? 'placed']}{order.requests?.some((request) => request.status === 'pending') ? ' · Bekleyen talep' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Drawer open={active != null} onClose={() => setActiveId(null)} title={active ? active.id : ''}>
        {active ? (
          <div className="stack">
            <p className={styles.demoNotice}>{AS.orders.demoNotice}</p>
            <OrderServiceControls key={active.id} order={active} />

            <div>
              <div className={styles.sectionTitle}>{AS.orders.items}</div>
              <ul className="stack">
                {active.input.lines.map((line) => {
                  const product = productMap[line.productId]
                  const snapshot = active.items?.find((item) => item.key === line.key)
                  return (
                    <li key={line.key}>
                      {snapshot?.name ?? product?.name ?? line.productId} — {line.colorId} / {line.size} × {line.qty}
                      {snapshot ? ` — ${formatPrice(snapshot.unitPrice * snapshot.qty)}` : ''}
                    </li>
                  )
                })}
              </ul>
            </div>

            <div>
              <div className={styles.sectionTitle}>{AS.orders.delivery}</div>
              <p>
                {active.input.delivery.firstName} {active.input.delivery.lastName}
              </p>
              <p>{active.input.delivery.address}</p>
              <p>
                {active.input.delivery.district} / {active.input.delivery.city} {active.input.delivery.postalCode}
              </p>
              <p>{active.input.delivery.country}</p>
              {active.input.delivery.note ? <p className="text-soft">{active.input.delivery.note}</p> : null}
            </div>

            <div>
              <div className={styles.sectionTitle}>{AS.orders.totalsTitle}</div>
              <p>
                {AS.orders.subtotal}: {formatPrice(active.input.totals.subtotal)}
              </p>
              <p>
                {AS.orders.discount}: {formatPrice(active.input.totals.discountAmount)}
              </p>
              <p>
                {AS.orders.shipping}: {active.input.totals.shipping == null ? AS.orders.shippingUndefined : formatPrice(active.input.totals.shipping)}
              </p>
              <p>
                {AS.orders.grandTotal}: {formatPrice(active.input.totals.total)}
              </p>
            </div>
          </div>
        ) : null}
      </Drawer>
    </div>
  )
}
