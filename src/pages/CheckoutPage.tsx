import { useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckoutForm } from '../components/checkout/CheckoutForm'
import { OrderSummary } from '../components/checkout/OrderSummary'
import { focusFirstCheckoutError, initialCheckoutValues, validateCheckout, type CheckoutErrors, type CheckoutFormValues } from '../components/checkout/validation'
import { AccordionItem } from '../components/ui/Accordion'
import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import { isApiMode } from '../data/remote'
import { S } from '../i18n'
import { apiErrorMessage } from '../i18n/apiMessages'
import { formatPrice } from '../lib/format'
import { paymentProvider } from '../services/checkout'
import { createApiOrder } from '../services/ordersApi'
import { useAccount } from '../state/AccountContext'
import { useCart } from '../state/CartContext'
import styles from './CheckoutPage.module.css'
import pageStyles from './Page.module.css'

export function CheckoutPage() {
  const { lines, totals, clear } = useCart()
  const { isLoggedIn, account } = useAccount()
  const navigate = useNavigate()
  // Sipariş verildikten sonra clear() sepeti boşaltır; bu bayrak "sepet boş" ekranının
  // yönlendirmeden önce bir an için yanıp sönmesini engeller.
  const placedRef = useRef(false)

  const [values, setValues] = useState<CheckoutFormValues>(() => initialCheckoutValues(isLoggedIn && account ? account.email : null))
  const [errors, setErrors] = useState<CheckoutErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  if (lines.length === 0 && !placedRef.current) {
    return (
      <div className={pageStyles.page}>
        <h1 className={pageStyles.title}>{S.checkout.title}</h1>
        <div className={styles.empty}>
          <p>{S.checkout.emptyCart}</p>
          <Button variant="secondary" to="/koleksiyon">
            {S.common.continueShopping}
          </Button>
        </div>
      </div>
    )
  }

  function handleChange<K extends keyof CheckoutFormValues>(field: K, value: CheckoutFormValues[K]) {
    setValues((v) => ({ ...v, [field]: value }))
    setErrors((e) => (e[field] ? { ...e, [field]: undefined } : e))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (pending) return
    const nextErrors = validateCheckout(values)
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      focusFirstCheckoutError(nextErrors)
      return
    }
    setSubmitError(null)
    setPending(true)
    const delivery = {
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      address: values.address.trim(),
      district: values.district.trim(),
      city: values.city.trim(),
      postalCode: values.postalCode.trim(),
      country: values.country.trim(),
      note: values.note.trim() || undefined,
    }
    const contact = { email: values.email.trim(), phone: values.phone.trim() }

    // API modundaysak (bkz. src/data/remote.ts → isApiMode) gerçek sipariş oluşturulur (fiyat/stok/
    // toplamlar sunucuda doğrulanır); yalnızca yerel geliştirmede API gerçekten kapalıyken demo
    // sağlayıcıya düşülür — üretimde asla sessizce yerel demo siparişe düşülmez.
    if (isApiMode()) {
      const result = await createApiOrder({ contact, delivery, lines })
      setPending(false)
      if (result.ok) {
        placedRef.current = true
        clear()
        navigate(`/odeme/sonuc/${result.order.id}`, { replace: true })
        return
      }
      setSubmitError(apiErrorMessage(result.error))
      return
    }

    const result = await paymentProvider.createOrder({
      contact,
      delivery,
      lines,
      totals,
      accountEmail: isLoggedIn && account ? account.email : null,
    })
    setPending(false)
    if (result.ok) {
      placedRef.current = true
      clear()
      navigate(`/odeme/sonuc/${result.order.id}`, { replace: true })
      return
    }
    setSubmitError(S.checkout.orderFailed)
  }

  return (
    <div className={pageStyles.page}>
      <h1 className={pageStyles.title}>{S.checkout.title}</h1>

      <div className={styles.demoBanner} role="note">
        <Icon name="info" size={18} />
        <span>{isApiMode() ? S.api.checkoutBanner : S.checkout.demoBanner}</span>
      </div>

      <div className={styles.mobileSummary}>
        <AccordionItem title={`${S.checkout.orderSummary} · ${formatPrice(totals.total)}`}>
          <OrderSummary lines={lines} totals={totals} />
        </AccordionItem>
      </div>

      <div className={styles.layout}>
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <CheckoutForm values={values} errors={errors} onChange={handleChange} />
          {submitError ? (
            <div role="alert" className={styles.formError}>
              <Icon name="info" size={14} />
              <span>{submitError}</span>
            </div>
          ) : null}
          <div className={styles.submitRow}>
            <Button type="submit" variant="primary" block disabled={pending}>
              {pending ? S.checkout.processing : S.checkout.placeOrder}
            </Button>
          </div>
        </form>

        <aside className={styles.summaryColumn}>
          <div className={styles.summarySticky}>
            <h2 className="h-block">{S.checkout.orderSummary}</h2>
            <OrderSummary lines={lines} totals={totals} />
          </div>
        </aside>
      </div>
    </div>
  )
}
