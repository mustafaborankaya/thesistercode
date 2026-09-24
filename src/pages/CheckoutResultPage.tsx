import { useParams } from 'react-router-dom'
import { OrderSummary } from '../components/checkout/OrderSummary'
import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import { S } from '../i18n'
import { paymentProvider } from '../services/checkout'
import styles from './CheckoutPage.module.css'
import pageStyles from './Page.module.css'

export function CheckoutResultPage() {
  const { orderId } = useParams()
  const order = orderId ? paymentProvider.getOrder(orderId) : null

  if (!order) {
    return (
      <div className={[pageStyles.page, pageStyles.narrow].join(' ')}>
        <h1 className={pageStyles.title}>{S.checkout.resultTitle}</h1>
        <p>{S.checkout.resultNotFound}</p>
        <div className={styles.submitRow}>
          <Button variant="secondary" to="/koleksiyon">
            {S.common.continueShopping}
          </Button>
        </div>
      </div>
    )
  }

  const { delivery, lines, totals } = order.input

  return (
    <div className={[pageStyles.page, pageStyles.narrow].join(' ')}>
      <div className={styles.resultHeader}>
        <Icon name="check" size={28} />
        <h1 className={pageStyles.title} style={{ marginBottom: 0 }}>
          {S.checkout.resultTitle}
        </h1>
      </div>
      <p>{S.checkout.resultText}</p>
      <p className={styles.orderNumber}>
        {S.checkout.orderNumber}: <strong>{order.id}</strong>
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
        <OrderSummary lines={lines} totals={totals} />
      </section>

      <Button variant="primary" to="/koleksiyon">
        {S.checkout.backToShop}
      </Button>
    </div>
  )
}
