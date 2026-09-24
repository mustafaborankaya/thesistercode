import { CartLineItem } from '../components/cart/CartLineItem'
import { CartSummary } from '../components/cart/CartSummary'
import { Button } from '../components/ui/Button'
import { S } from '../i18n'
import { useCart } from '../state/CartContext'
import styles from './CartPage.module.css'
import pageStyles from './Page.module.css'

export function CartPage() {
  const { lines, totals } = useCart()

  if (lines.length === 0) {
    return (
      <div className={pageStyles.page}>
        <h1 className={pageStyles.title}>{S.cart.pageTitle}</h1>
        <div className={styles.empty}>
          <p>{S.cart.empty}</p>
          <p className="text-soft text-sm">{S.cart.emptyHint}</p>
          <Button variant="secondary" to="/koleksiyon">
            {S.common.continueShopping}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className={pageStyles.page}>
      <h1 className={pageStyles.title}>
        {S.cart.pageTitle}
        <span className={styles.count}>{S.cart.itemCount(totals.itemCount)}</span>
      </h1>
      <div className={styles.layout}>
        <ul className={styles.lines}>
          {lines.map((line) => (
            <CartLineItem key={line.key} line={line} wide />
          ))}
        </ul>
        <aside className={styles.summaryColumn}>
          <div className={styles.summaryBox}>
            <CartSummary totals={totals} />
            <div className={styles.actions}>
              <Button variant="primary" block to="/odeme">
                {S.cart.checkout}
              </Button>
              <Button variant="secondary" block to="/koleksiyon">
                {S.common.continueShopping}
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
