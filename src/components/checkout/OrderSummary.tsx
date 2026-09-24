import type { CartLine, CartTotals } from '../../data/types'
import { S } from '../../i18n'
import { lineProduct, lineTotal } from '../../lib/cart'
import { CartSummary } from '../cart/CartSummary'
import { MediaSlot } from '../ui/MediaSlot'
import { Price } from '../ui/Price'
import styles from './Checkout.module.css'

interface OrderSummaryProps {
  lines: CartLine[]
  totals: CartTotals
}

/** Checkout ve sipariş sonucu için ortak ürün listesi + tutar özeti. */
export function OrderSummary({ lines, totals }: OrderSummaryProps) {
  return (
    <div>
      <ul className={styles.orderLines}>
        {lines.map((line) => {
          const product = lineProduct(line)
          if (!product) return null
          const color = product.colors.find((c) => c.id === line.colorId)
          const front = product.media[0]
          return (
            <li key={line.key} className={styles.orderLine}>
              <MediaSlot label={front.label} src={front.src} ratio="3 / 4" captionSize="sm" className={styles.orderMedia} />
              <div className={styles.orderLineBody}>
                <span className={styles.orderName}>{product.name}</span>
                <span className={styles.orderVariant}>
                  {S.cart.variant(color?.label ?? line.colorId, line.size)} · ×{line.qty}
                </span>
              </div>
              <Price amount={lineTotal(line)} className={styles.orderPrice} />
            </li>
          )
        })}
      </ul>
      <CartSummary totals={totals} showDiscountHint={false} />
    </div>
  )
}
