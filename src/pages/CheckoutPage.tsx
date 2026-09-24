import { useEffect, useReducer, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckoutForm } from '../components/checkout/CheckoutForm'
import { OrderSummary } from '../components/checkout/OrderSummary'
import { focusFirstCheckoutError, initialCheckoutValues, validateCheckout, type CheckoutErrors, type CheckoutFormValues } from '../components/checkout/validation'
import { AccordionItem } from '../components/ui/Accordion'
import { Button } from '../components/ui/Button'
import { Checkbox } from '../components/ui/Field'
import { Icon } from '../components/ui/Icon'
import { productById } from '../data/catalog'
import { isApiMode } from '../data/remote'
import type { SizeId } from '../data/types'
import { S } from '../i18n'
import { apiErrorMessage, stockShortageMessage, stockShortages } from '../i18n/apiMessages'
import { applyKnownStock, lineKey } from '../lib/cart'
import { formatPrice } from '../lib/format'
import { paymentProvider } from '../services/checkout'
import { listAddresses, loadAddresses, sameAddress, saveAddress, subscribeCustomer, type SavedAddress } from '../services/customer'
import { createApiOrder } from '../services/ordersApi'
import { useAccount } from '../state/AccountContext'
import { useCart } from '../state/CartContext'
import styles from './CheckoutPage.module.css'
import pageStyles from './Page.module.css'

const DELIVERY_FIELDS = ['firstName', 'lastName', 'address', 'district', 'city', 'postalCode'] as const

/**
 * Teslimat alanlarının HİÇBİRİ henüz doldurulmamışsa varsayılan (yoksa ilk) kayıtlı adresle doldurur;
 * kullanıcı yazmaya başladıysa dokunmaz (değişiklik yoksa aynı nesneyi döndürür). Telefon yalnızca boşsa doldurulur.
 */
function withDefaultAddress(values: CheckoutFormValues, addresses: SavedAddress[]): CheckoutFormValues {
  const preferred = addresses.find((a) => a.isDefault) ?? addresses[0]
  if (!preferred || DELIVERY_FIELDS.some((k) => values[k].trim())) return values
  return {
    ...values,
    firstName: preferred.firstName,
    lastName: preferred.lastName,
    address: preferred.address,
    district: preferred.district,
    city: preferred.city,
    postalCode: preferred.postalCode,
    country: preferred.country || values.country,
    phone: values.phone.trim() ? values.phone : preferred.phone,
  }
}

export function CheckoutPage() {
  const { lines, totals, clear, setQty, removeLine } = useCart()
  const { isLoggedIn, account, refresh: refreshAccount } = useAccount()
  const navigate = useNavigate()
  // Sipariş verildikten sonra clear() sepeti boşaltır; bu bayrak "sepet boş" ekranının
  // yönlendirmeden önce bir an için yanıp sönmesini engeller.
  const placedRef = useRef(false)

  const accountEmail = isLoggedIn && account ? account.email : null
  const [values, setValues] = useState<CheckoutFormValues>(() =>
    withDefaultAddress(initialCheckoutValues(accountEmail), accountEmail ? listAddresses(accountEmail) : []),
  )
  const [errors, setErrors] = useState<CheckoutErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  /** 409 insufficient_stock sonrası satır bazlı açıklamalar (sepet otomatik olarak mevcut stoğa indirildi). */
  const [stockIssues, setStockIssues] = useState<string[]>([])
  const [pending, setPending] = useState(false)
  const [saveNewAddress, setSaveNewAddress] = useState(false)
  const [, refreshAddresses] = useReducer((n: number) => n + 1, 0)

  // Kayıtlı adresler (API modunda sunucudan) yüklenir; teslimat alanları hâlâ boşsa varsayılan adresle
  // doldurulur. Seçici checkout/SavedAddressPicker aynı önbelleği okur (CUSTOMER_CHANGED ile tazelenir).
  useEffect(() => subscribeCustomer(refreshAddresses), [])
  // Ödeme özetindeki üyelik indirimi sunucunun güncel kuralıyla eşleşsin (ör. başka sekmede verilmiş ilk sipariş).
  useEffect(() => {
    if (isLoggedIn && isApiMode()) void refreshAccount()
  }, [isLoggedIn, refreshAccount])
  useEffect(() => {
    if (!accountEmail) return
    let cancelled = false
    loadAddresses(accountEmail).then(
      (list) => {
        if (!cancelled) setValues((v) => withDefaultAddress(v, list))
      },
      () => undefined, // adresler yüklenemezse form elle doldurulur; sipariş akışı etkilenmez
    )
    return () => {
      cancelled = true
    }
  }, [accountEmail])

  const deliveryInput = {
    firstName: values.firstName,
    lastName: values.lastName,
    phone: values.phone,
    address: values.address,
    district: values.district,
    city: values.city,
    postalCode: values.postalCode,
    country: values.country,
  }
  const alreadySaved = accountEmail ? listAddresses(accountEmail).some((a) => sameAddress(a, deliveryInput)) : true

  if (lines.length === 0 && !placedRef.current) {
    return (
      <div className={pageStyles.page}>
        <h1 className={pageStyles.title}>{S.checkout.title}</h1>
        <div className={styles.empty}>
          <p>{S.checkout.emptyCart}</p>
          {stockIssues.length ? (
            // Yetersiz stok nedeniyle tüm satırlar kaldırıldıysa kullanıcıya nedeni yine söylenir.
            <ul role="alert" className="text-soft" style={{ margin: 0, paddingLeft: '1.1em', fontSize: 'var(--fs-xs)' }}>
              {stockIssues.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          ) : null}
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
    setStockIssues([])
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
    const shouldSaveAddress = !!accountEmail && saveNewAddress && !alreadySaved
    // Sipariş başarılı olduktan sonra çağrılır; kayıt hatası (örn. 10 adres sınırı) siparişi/yönlendirmeyi etkilemez.
    const saveDeliveryAddress = () => {
      if (!shouldSaveAddress || !accountEmail) return
      void saveAddress(accountEmail, {
        label: `${delivery.district} / ${delivery.city}`.slice(0, 60),
        firstName: delivery.firstName,
        lastName: delivery.lastName,
        phone: contact.phone,
        address: delivery.address,
        district: delivery.district,
        city: delivery.city,
        postalCode: delivery.postalCode,
        country: delivery.country,
        isDefault: false,
      }).catch(() => undefined)
    }

    // API modundaysak (bkz. src/data/remote.ts → isApiMode) gerçek sipariş oluşturulur (fiyat/stok/
    // toplamlar sunucuda doğrulanır); yalnızca yerel geliştirmede API gerçekten kapalıyken demo
    // sağlayıcıya düşülür — üretimde asla sessizce yerel demo siparişe düşülmez.
    if (isApiMode()) {
      const result = await createApiOrder({ contact, delivery, lines })
      setPending(false)
      if (result.ok) {
        placedRef.current = true
        saveDeliveryAddress()
        clear()
        // İlk sipariş indirimi kullanıldı: /account/me yeniden okunur ki sepet artık indirim göstermesin.
        if (isLoggedIn) void refreshAccount()
        navigate(`/odeme/sonuc/${result.order.id}`, { replace: true })
        return
      }
      const shortages = stockShortages(result.error)
      if (shortages.length) {
        // Sunucunun bildirdiği güncel stok bellekteki kataloğa yazılır (adet sınırı/beden seçici bunu
        // görsün), ardından sepet satırı mevcut stoğa indirilir; 0 ise satır kaldırılır.
        const notes: string[] = []
        for (const d of shortages) {
          const size = d.size as SizeId
          applyKnownStock(d.productId, d.colorId, size, d.available)
          const key = lineKey(d.productId, d.colorId, size)
          const product = productById[d.productId]
          const name = product?.name ?? d.productId
          const color = product?.colors.find((c) => c.id === d.colorId)?.label ?? d.colorId
          if (d.available > 0) setQty(key, d.available)
          else removeLine(key)
          notes.push(stockShortageMessage(name, S.cart.variant(color, d.size), d.available))
        }
        setSubmitError(S.checkout.stockChangedTitle)
        setStockIssues(notes)
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
      saveDeliveryAddress()
      clear()
      if (isLoggedIn) void refreshAccount({ orderPlaced: true })
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
          {accountEmail && !alreadySaved ? (
            <Checkbox
              id="checkout-saveAddress"
              label={S.checkout.saveAddress}
              checked={saveNewAddress}
              onChange={(e) => setSaveNewAddress(e.target.checked)}
            />
          ) : null}
          {submitError ? (
            <div role="alert" className={styles.formError} style={stockIssues.length ? { alignItems: 'flex-start' } : undefined}>
              <Icon name="info" size={14} />
              <span>
                {submitError}
                {stockIssues.length ? (
                  <ul style={{ margin: 'var(--sp-2) 0 0', paddingLeft: '1.1em' }}>
                    {stockIssues.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                ) : null}
              </span>
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
