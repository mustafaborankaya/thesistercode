import { useEffect, type RefObject } from 'react'
import type { SizeId } from '../../data/types'
import { useReducedMotion } from '../../hooks/useMediaQuery'
import { S } from '../../i18n'
import { Button } from '../ui/Button'
import { Price } from '../ui/Price'
import styles from './MobileBuyBar.module.css'

interface MobileBuyBarProps {
  price: number
  size: SizeId | null
  pending: boolean
  onAddToCart: () => void
  sizeGroupRef: RefObject<HTMLDivElement | null>
}

/**
 * Mobilde ekranın altında sabit satın alma çubuğu.
 * Yalnızca <1024px'te render edilir (bkz. ProductPage); mount/unmount body.dataset.mobileCta'yı yönetir
 * — WhatsApp butonu bunu okuyup yukarı kayar.
 */
export function MobileBuyBar({ price, size, pending, onAddToCart, sizeGroupRef }: MobileBuyBarProps) {
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    document.body.dataset.mobileCta = 'true'
    return () => {
      delete document.body.dataset.mobileCta
    }
  }, [])

  const handleClick = () => {
    if (!size) {
      sizeGroupRef.current?.scrollIntoView({ block: 'center', behavior: reducedMotion ? 'auto' : 'smooth' })
    }
    onAddToCart()
  }

  return (
    <div className={styles.bar} data-mobile-buy-bar>
      <div className={styles.info}>
        <Price amount={price} className={styles.price} />
        <span className={styles.size}>{size ?? S.product.selectSize}</span>
      </div>
      <Button variant="primary" className={styles.button} onClick={handleClick} disabled={pending} aria-busy={pending}>
        {S.product.addToCart}
      </Button>
    </div>
  )
}
