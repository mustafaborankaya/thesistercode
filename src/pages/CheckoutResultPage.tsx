import { useEffect, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { OrderSummary, type OrderSummaryItem } from '../components/checkout/OrderSummary'
import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import { allProducts } from '../data/catalog'
import { isApiMode } from '../data/remote'
import type { CartTotals } from '../data/types'
import { S } from '../i18n'
import { paymentProvider, type DemoOrder } from '../services/checkout'
import { getApiOrder, type ApiOrder } from '../services/ordersApi'
import styles from './CheckoutPage.module.css'
import pageStyles from './Page.module.css'

const productById = Object.fromEntries(allProducts.map((p) => [p.id, p]))

/** Sunucu sipariş kalemlerini OrderSummary'nin beklediği anlık görüntüye çevirir; görsel varsa katalogdan tamamlanır. */
function itemsFromApiOrder(order: ApiOrder): OrderSummaryItem[] {
  return (order.items ?? []).map((item) => {
    const product = productById[item.productId]
    const front = product?.media[0]
    return {
      key: `${item.productId}:${item.colorId}:${item.size}`,
      name: item.productName,
      colorLabel: item.colorLabel,
      size: item.size,
      qty: item.qty,
      unitPrice: item.unitPrice,
      mediaSrc: front?.src ?? null,
      mediaLabel: front?.label ?? item.productName,
    }
  })
}

function totalsFromApiOrder(order: ApiOrder): CartTotals {
  const itemCount = (order.items ?? []).reduce((n, item) => n + item.qty, 0)
  return {
    itemCount,
    subtotal: order.totals.subtotal,
    discountPercent: order.totals.discountPercent,
    discountAmount: order.totals.discountAmount,
    shipping: order.totals.shipping,
    total: order.totals.total,
  }
}

type LoadState = { status: 'loading' } | { status: 'not-found' } | { status: 'api'; order: ApiOrder } | { status: 'demo'; order: DemoOrder }

export function CheckoutResultPage() {
  // Hesaptaki sipariş geçmişinden açıldığında "oluşturuldu" mesajı yerine sipariş detayı gösterilir.
  const location = useLocation()
  const viewOnly = Boolean((location.state as { view?: boolean } | null)?.view)
  const { orderId } = useParams()
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    if (!orderId) {
      setState({ status: 'not-found' })
      return
    }
    if (isApiMode()) {
      getApiOrder(orderId).then((order) => {
        if (cancelled) return
        setState(order ? { status: 'api', order } : { status: 'not-found' })
      })
    } else {
      const order = paymentProvider.getOrder(orderId)
      setState(order ? { status: 'demo', order } : { status: 'not-found' })
    }
    return () => {
      cancelled = true
    }
  }, [orderId])

  if (state.status === 'loading') {
    return (
      <div className={[pageStyles.page, pageStyles.narrow].join(' ')}>
        <h1 className={pageStyles.title}>{S.checkout.resultTitle}</h1>
        <p>{S.common.loading}</p>
      </div>
    )
  }

  if (state.status === 'not-found') {
    return (
      <div className={[pageStyles.page, pageStyles.narrow].join(' ')}>
        <h1 className={pageStyles.title}>{S.checkout.resultTitle}</h1>
        <p>{isApiMode() ? S.api.orderNotFound : S.checkout.resultNotFound}</p>
        <div className={styles.submitRow}>
          <Button variant="secondary" to="/koleksiyon">
            {S.common.continueShopping}
          </Button>
        </div>
      </div>
    )
  }

  const delivery = state.status === 'api' ? state.order.delivery : state.order.input.delivery
  const orderNumber = state.order.id
  const summary =
    state.status === 'api' ? (
      <OrderSummary items={itemsFromApiOrder(state.order)} totals={totalsFromApiOrder(state.order)} />
    ) : (
      <OrderSummary lines={state.order.input.lines} totals={state.order.input.totals} />
    )

  return (
    <div className={[pageStyles.page, pageStyles.narrow].join(' ')}>
      <div className={styles.resultHeader}>
        {viewOnly ? null : <Icon name="check" size={28} />}
        <h1 className={pageStyles.title} style={{ marginBottom: 0 }}>
          {viewOnly ? S.account.orderDetailTitle : S.checkout.resultTitle}
        </h1>
      </div>
      {viewOnly ? null : <p>{state.status === 'api' ? S.api.resultText : S.checkout.resultText}</p>}
      <p className={styles.orderNumber}>
        {S.checkout.orderNumber}: <strong>{orderNumber}</strong>
      </p>

      <section className={styles.resultSection}>
        <h2 className="h-block">{S.checkout.steps.delivery}</h2>
        <div className={styles.deliverySummary}>
          <p>
            {delivery.firstName} {delivery.lastName}
          </p>
          <p>{delivery.address}</p>
          <p>
            {delivery.district} / {delivery.city}
          </p>
        </div>
      </section>

      <section className={styles.resultSection}>
        <h2 className="h-block">{S.checkout.orderSummary}</h2>
        {summary}
      </section>

      <Button variant="primary" to="/koleksiyon">
        {S.checkout.backToShop}
      </Button>
    </div>
  )
}
