import { S } from '../../i18n'
import { Icon } from './Icon'
import styles from './QuantityStepper.module.css'

interface QuantityStepperProps {
  value: number
  min?: number
  max: number
  onIncrement: () => void
  onDecrement: () => void
  /** Ekran okuyucu için ürün adı. */
  itemLabel?: string
}

export function QuantityStepper({ value, min = 1, max, onIncrement, onDecrement, itemLabel }: QuantityStepperProps) {
  const suffix = itemLabel ? ` — ${itemLabel}` : ''
  return (
    <div className={styles.stepper} role="group" aria-label={`${S.cart.qty}${suffix}`}>
      <button type="button" className={styles.btn} onClick={onDecrement} disabled={value <= min} aria-label={`${S.cart.decrease}${suffix}`}>
        <Icon name="minus" size={14} />
      </button>
      <span className={styles.value} aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        className={styles.btn}
        onClick={onIncrement}
        disabled={value >= max}
        aria-label={`${S.cart.increase}${suffix}`}
        title={value >= max ? S.cart.maxReached : undefined}
      >
        <Icon name="plus" size={14} />
      </button>
    </div>
  )
}
