import { useEffect, useReducer, useState } from 'react'
import { Drawer } from '../../components/ui/Drawer'
import { allProducts } from '../../data/catalog'
import { formatPrice } from '../../lib/format'
import { listDemoOrders } from '../../services/checkout'
import { subscribeCustomer, orderStatusLabels } from '../../services/customer'
import { OrderServiceControls } from '../components/OrderServiceControls'
import { AS } from '../adminStrings'
import styles from '../admin.module.css'

const productMap = Object.fromEntries(allProducts.map((p) => [p.id, p]))

/** `/admin/siparisler` — bu tarayıcıda oluşturulmuş demo siparişlerin listesi ve detayı. */
export function OrdersPage() {
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
