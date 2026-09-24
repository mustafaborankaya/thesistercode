import { Link } from 'react-router-dom'
import { siteSettings } from '../../config/settings'
import type { CartTotals } from '../../data/types'
import { S } from '../../i18n'
import { useAccount } from '../../state/AccountContext'
import { Price } from '../ui/Price'
import styles from './Cart.module.css'

interface CartSummaryProps {
  totals: CartTotals
  /** Üyelik indirimi ipucunu göster (sepet panelinde ve sayfasında). */
  showDiscountHint?: boolean
  className?: string
}

/** Sepet paneli, sepet sayfası ve checkout'un ortak tutar özeti. */
export function CartSummary({ totals, showDiscountHint = true, className }: CartSummaryProps) {
  const { isLoggedIn, discountEligible } = useAccount()
  const campaign = siteSettings.memberDiscount
  const shippingDefined = totals.shipping != null

  return (
    <div className={[styles.summary, className ?? ''].join(' ').trim()} data-cart-summary>
      <div className={styles.row}>
        <span>{S.cart.subtotal}</span>
        <Price amount={totals.subtotal} />
      </div>
      {totals.discountAmount > 0 ? (
        <div className={styles.row} data-discount-line>
          <span>{S.cart.memberDiscount(totals.discountPercent, campaign.firstOrderOnly !== false)}</span>
          <span>
            −<Price amount={totals.discountAmount} />
          </span>
        </div>
      ) : null}
      <div className={[styles.row, styles.rowSoft].join(' ')}>
        <span>{S.cart.shipping}</span>
        <span>{shippingDefined ? <Price amount={totals.shipping as number} /> : S.cart.shippingUndefined}</span>
      </div>
      <div className={[styles.row, styles.rowTotal].join(' ')}>
        <span>{shippingDefined ? S.cart.total : S.cart.totalExShipping}</span>
        <Price amount={totals.total} />
      </div>
      <p className={styles.hint}>{S.cart.demoNote}</p>
      {/* Kayıt ipucu yalnızca misafire: ilk sipariş indirimini kullanmış üyeye "hesap oluştur" denmez. */}
      {showDiscountHint && campaign.enabled && !isLoggedIn ? (
        <p className={styles.hint}>
          {S.cart.discountHint} <Link to="/kayit" className="link">{S.account.register}</Link>
        </p>
      ) : null}
      {showDiscountHint && discountEligible && totals.discountAmount > 0 ? <p className={styles.hint}>{S.cart.discountApplied}</p> : null}
    </div>
  )
}
