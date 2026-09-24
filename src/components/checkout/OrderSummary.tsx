import type { CartLine, CartTotals } from '../../data/types'
import { S } from '../../i18n'
import { lineProduct, lineTotal } from '../../lib/cart'
import { CartSummary } from '../cart/CartSummary'
import { MediaSlot } from '../ui/MediaSlot'
import { Price } from '../ui/Price'
import styles from './Checkout.module.css'

/** Sunucudan dönen sipariş kalemi anlık görüntüsü (bkz. src/services/ordersApi.ts → ApiOrderItem). */
export interface OrderSummaryItem {
  key: string
  name: string
  colorLabel: string
  size: string
  qty: number
  /** Sipariş anındaki birim fiyat (sunucudan) — güncel katalog fiyatı değil. */
  unitPrice: number
  mediaSrc?: string | null
  mediaLabel?: string
}

interface OrderSummaryProps {
  /** Sepet satırları (checkout formu) — ürün/fiyat güncel katalogdan okunur. */
  lines?: CartLine[]
  /** Sipariş sonucu sayfası için sunucu anlık görüntüsü — `lines` yerine kullanılır. */
  items?: OrderSummaryItem[]
  totals: CartTotals
}

interface Row {
  key: string
  name: string
  variant: string
  total: number
  mediaSrc: string | null
  mediaLabel: string
}

function rowsFromLines(lines: CartLine[]): Row[] {
  return lines.flatMap((line) => {
    const product = lineProduct(line)
    if (!product) return []
    const color = product.colors.find((c) => c.id === line.colorId)
    const front = product.media[0]
    return [
      {
        key: line.key,
        name: product.name,
        variant: `${S.cart.variant(color?.label ?? line.colorId, line.size)} · ×${line.qty}`,
        total: lineTotal(line),
        mediaSrc: front.src,
        mediaLabel: front.label,
      },
    ]
  })
}

function rowsFromItems(items: OrderSummaryItem[]): Row[] {
  return items.map((item) => ({
    key: item.key,
    name: item.name,
    variant: `${S.cart.variant(item.colorLabel, item.size)} · ×${item.qty}`,
    total: item.unitPrice * item.qty,
    mediaSrc: item.mediaSrc ?? null,
    mediaLabel: item.mediaLabel ?? item.name,
  }))
}

/** Checkout ve sipariş sonucu için ortak ürün listesi + tutar özeti. */
export function OrderSummary({ lines, items, totals }: OrderSummaryProps) {
  const rows = items ? rowsFromItems(items) : rowsFromLines(lines ?? [])
  return (
    <div>
      <ul className={styles.orderLines}>
        {rows.map((row) => (
          <li key={row.key} className={styles.orderLine}>
            <MediaSlot label={row.mediaLabel} src={row.mediaSrc} ratio="3 / 4" captionSize="sm" className={styles.orderMedia} />
            <div className={styles.orderLineBody}>
              <span className={styles.orderName}>{row.name}</span>
              <span className={styles.orderVariant}>{row.variant}</span>
            </div>
            <Price amount={row.total} className={styles.orderPrice} />
          </li>
        ))}
      </ul>
      <CartSummary totals={totals} showDiscountHint={false} />
    </div>
  )
}
