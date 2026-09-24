import { Link } from 'react-router-dom'
import type { CartLine } from '../../data/types'
import { S } from '../../i18n'
import { lineProduct, lineTotal } from '../../lib/cart'
import { useCart } from '../../state/CartContext'
import { MediaSlot } from '../ui/MediaSlot'
import { Price } from '../ui/Price'
import { QuantityStepper } from '../ui/QuantityStepper'
import styles from './Cart.module.css'

interface CartLineItemProps {
  line: CartLine
  /** Sepet sayfasında daha geniş görsel. */
  wide?: boolean
}

export function CartLineItem({ line, wide }: CartLineItemProps) {
  const { increment, decrement, removeLine, maxQty } = useCart()
  const product = lineProduct(line)
  if (!product) return null
  const color = product.colors.find((c) => c.id === line.colorId)
  const front = product.media[0]
  const max = maxQty(line.key)

  return (
    <li className={[styles.line, wide ? styles.lineWide : ''].join(' ').trim()} data-line-key={line.key}>
      <Link to={`/urun/${product.slug}`} tabIndex={-1} aria-hidden="true">
        <MediaSlot label={front.label} src={front.src} ratio="3 / 4" captionSize="sm" />
      </Link>
      <div className={styles.lineBody}>
        <div className={styles.lineTop}>
          <div>
            <Link to={`/urun/${product.slug}`} className={styles.name}>
              {product.name}
            </Link>
            <div className={styles.variant}>{S.cart.variant(color?.label ?? line.colorId, line.size)}</div>
          </div>
          <Price amount={product.price} className={styles.unit} />
        </div>
        {line.qty >= max ? <div className={styles.stockNote}>{S.product.stockLimit}</div> : null}
        <div className={styles.lineBottom}>
          <QuantityStepper value={line.qty} max={max} onIncrement={() => increment(line.key)} onDecrement={() => decrement(line.key)} itemLabel={product.name} />
          <Price amount={lineTotal(line)} className={styles.lineTotal} />
        </div>
        <button type="button" className={styles.remove} onClick={() => removeLine(line.key)} aria-label={S.cart.removeLine(product.name)}>
          {S.common.remove}
        </button>
      </div>
    </li>
  )
}
