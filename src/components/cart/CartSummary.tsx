import { useId, useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { siteSettings } from '../../config/settings'
import { isApiMode } from '../../data/remote'
import type { CartTotals } from '../../data/types'
import { S } from '../../i18n'
import { couponReasonMessage } from '../../i18n/apiMessages'
import type { SummaryTotals } from '../../lib/cart'
import { formatPrice } from '../../lib/format'
import { useAccount } from '../../state/AccountContext'
import { useCart } from '../../state/CartContext'
import { Button } from '../ui/Button'
import { Field } from '../ui/Field'
import { Price } from '../ui/Price'
import styles from './Cart.module.css'

interface CartSummaryProps {
  totals: CartTotals | SummaryTotals
  /** Üyelik indirimi ipucunu göster (sepet panelinde ve sayfasında). */
  showDiscountHint?: boolean
  /** "İndirim kodu" alanını göster (sepet paneli, sepet sayfası, ödeme formu). Sipariş sonucu özetinde kapalı. */
  showCouponInput?: boolean
  className?: string
}

/** İndirim kodu girişi — `POST /coupons/validate`; kupon CartContext'te (sessionStorage) tutulur. */
function CouponField({ ignored }: { ignored: boolean }) {
  const { coupon, applyCoupon, removeCoupon } = useCart()
  const id = useId()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function apply() {
    if (pending) return
    const value = code.trim()
    if (!value) {
      setError(S.cart.couponEmpty)
      return
    }
    setPending(true)
    setError(null)
    const result = await applyCoupon(value)
    setPending(false)
    if (result.ok) setCode('')
    else setError(couponReasonMessage(result.reason, result.message))
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    // Ödeme sayfasında iç içe <form> olmaması için alan bir <div>; Enter ile uygula.
    if (e.key === 'Enter') {
      e.preventDefault()
      void apply()
    }
  }

  if (coupon) {
    return (
      <div className={styles.couponApplied} data-coupon-applied>
        {/* Kupon saklı ama uygulanmıyorsa (üyelik indirimi yüksek / alt limit altı) "uygulandı" denmez; neden aşağıda. */}
        <span>{ignored ? S.cart.couponLabel + ': ' + coupon.code : S.cart.couponApplied(coupon.code)}</span>
        <button type="button" className={styles.remove} onClick={removeCoupon}>
          {S.cart.couponRemove}
        </button>
      </div>
    )
  }

  const errorId = `coupon-${id}-error`
  return (
    <div data-coupon-field>
      <div className={styles.coupon}>
        <Field
          id={`coupon-${id}`}
          label={S.cart.couponLabel}
          value={code}
          onChange={(e) => {
            setCode(e.target.value)
            if (error) setError(null)
          }}
          onKeyDown={onKeyDown}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={40}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={styles.couponInput}
        />
        <Button variant="secondary" small onClick={() => void apply()} disabled={pending} className={styles.couponButton}>
          {pending ? S.cart.couponApplying : S.cart.couponApply}
        </Button>
      </div>
      {error ? (
        <p id={errorId} className={styles.hint} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

/** Sepet paneli, sepet sayfası ve checkout'un ortak tutar özeti. */
export function CartSummary({ totals, showDiscountHint = true, showCouponInput = true, className }: CartSummaryProps) {
  const { isLoggedIn, discountEligible } = useAccount()
  const campaign = siteSettings.memberDiscount
  const shippingDefined = totals.shipping != null
  const t = totals as SummaryTotals
  const couponDiscount = t.couponDiscount ?? 0
  const freeShipping = shippingDefined && (t.freeShipping === true || totals.shipping === 0)
  const { coupon } = useCart()

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
      {couponDiscount > 0 && t.couponCode ? (
        <div className={styles.row} data-coupon-line>
          <span>{S.cart.couponLine(t.couponCode)}</span>
          <span>
            −<Price amount={couponDiscount} />
          </span>
        </div>
      ) : null}
      <div className={[styles.row, styles.rowSoft].join(' ')}>
        <span>{S.cart.shipping}</span>
        <span>{freeShipping ? S.cart.freeShipping : shippingDefined ? <Price amount={totals.shipping as number} /> : S.cart.shippingUndefined}</span>
      </div>
      <div className={[styles.row, styles.rowTotal].join(' ')}>
        <span>{shippingDefined ? S.cart.total : S.cart.totalExShipping}</span>
        <Price amount={totals.total} />
      </div>
      {showCouponInput && isApiMode() ? <CouponField ignored={!!t.couponIgnored} /> : null}
      {showCouponInput && coupon && t.couponIgnored === 'member' ? <p className={styles.hint}>{S.cart.couponMemberBetter(coupon.code)}</p> : null}
      {showCouponInput && coupon && t.couponIgnored === 'minSubtotal' && coupon.minSubtotal != null ? (
        <p className={styles.hint}>{S.cart.couponBelowMin(coupon.code, formatPrice(coupon.minSubtotal))}</p>
      ) : null}
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
