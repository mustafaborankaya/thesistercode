import { S } from '../../i18n'
import { formatPrice } from '../../lib/format'

interface PriceProps {
  amount: number
  className?: string
  /** Ekran okuyucuya "Demo fiyat" bilgisini ekler; üst çubuk zaten görünür uyarı verir. */
  withDemoHint?: boolean
}

export function Price({ amount, className, withDemoHint = true }: PriceProps) {
  return (
    <span className={className}>
      {formatPrice(amount)}
      {withDemoHint ? <span className="sr-only"> ({S.common.demoPrice})</span> : null}
    </span>
  )
}
