import { useEffect, useRef, useState } from 'react'
import { useLocation, useParams, useSearchParams } from 'react-router-dom'
import { OrderSummary, type OrderSummaryItem } from '../components/checkout/OrderSummary'
import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import { allProducts } from '../data/catalog'
import { isApiMode } from '../data/remote'
import type { CartTotals } from '../data/types'
import { S } from '../i18n'
import { paymentProvider, type DemoOrder } from '../services/checkout'
import { apiErrorMessage } from '../i18n/apiMessages'
import { getApiOrder, getPaymentStatus, initPayment, onlinePaymentEnabled, type ApiOrder } from '../services/ordersApi'
import { useCart } from '../state/CartContext'
import styles from './CheckoutPage.module.css'
import pageStyles from './Page.module.css'

const productById = Object.fromEntries(allProducts.map((p) => [p.id, p]))

/** Sunucu sipariş kalemlerini OrderSummary'nin beklediği anlık görüntüye çevirir; görsel varsa katalogdan tamamlanır. */
function itemsFromApiOrder(order: ApiOrder): OrderSummaryItem[] {
  return (order.items ?? []).map((item) => {
    const product = productById[item.productId]
    const front = product?.media[0]
    return {
      key: `${item.productId}:${item.colorId}:${item.size}`,
      name: item.productName,
      colorLabel: item.colorLabel,
      size: item.size,
      qty: item.qty,
      unitPrice: item.unitPrice,
      mediaSrc: front?.src ?? null,
      mediaLabel: front?.label ?? item.productName,
    }
  })
}

function totalsFromApiOrder(order: ApiOrder): CartTotals {
  const itemCount = (order.items ?? []).reduce((n, item) => n + item.qty, 0)
  return {
    itemCount,
    subtotal: order.totals.subtotal,
    discountPercent: order.totals.discountPercent,
    discountAmount: order.totals.discountAmount,
    shipping: order.totals.shipping,
    total: order.totals.total,
  }
}

type PaymentView = 'paid' | 'failed' | 'pending' | 'cancelled'

/**
 * Sunucu sipariş durumu + iyzico dönüş ipucundan gösterilecek ödeme görünümü. null → eski (tahsilatsız)
 * sonuç görünümü. 'pending_payment' her zaman ödeme görünümüdür (hesap geçmişinden açılsa bile "ödeme bekleniyor").
 */
function paymentViewFor(status: string, hint: string | null, online: boolean): PaymentView | null {
  if (status === 'pending_payment') return hint === 'basarisiz' ? 'failed' : 'pending'
  // İpucu yoksa (ör. iyzico'dan "Geri" ile dönüş) çevrim içi ödeme modunda yine sunucu durumu esas alınır.
  if (!hint && !online) return null
  if (status === 'paid') return 'paid'
  if (status === 'cancelled') return 'cancelled'
  return null
}

const PAYMENT_TITLES: Record<PaymentView, () => string> = {
  paid: () => S.checkout.paidTitle,
  failed: () => S.checkout.paymentFailedTitle,
  pending: () => S.checkout.paymentPendingTitle,
  cancelled: () => S.checkout.orderCancelledTitle,
}
const PAYMENT_TEXTS: Record<PaymentView, () => string> = {
  paid: () => S.checkout.paidText,
  failed: () => S.checkout.paymentFailedText,
  pending: () => S.checkout.paymentPendingText,
  cancelled: () => S.checkout.orderCancelledText,
}

type LoadState = { status: 'loading' } | { status: 'not-found' } | { status: 'api'; order: ApiOrder } | { status: 'demo'; order: DemoOrder }

export function CheckoutResultPage() {
  // Hesaptaki sipariş geçmişinden açıldığında "oluşturuldu" mesajı yerine sipariş detayı gösterilir.
  const location = useLocation()
  const navState = location.state as { view?: boolean; initError?: string } | null
  const viewOnly = Boolean(navState?.view)
  const { orderId } = useParams()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  // iyzico dönüşü: ?odeme=basarili|basarisiz yalnızca hangi mesajın gösterileceğine dair İPUCU; gerçek durum sunucudadır.
  const [searchParams] = useSearchParams()
  const payHint = searchParams.get('odeme')
  const { clear } = useCart()
  const clearedRef = useRef(false)
  const [lastError, setLastError] = useState<string | null>(navState?.initError ?? null)
  const [retrying, setRetrying] = useState(false)

  const apiOrder = state.status === 'api' ? state.order : null
  // Sepet yalnızca ödeme GERÇEKTEN alındıysa boşalır (sunucu durumu 'paid' + iyzico dönüşü); hesap
  // geçmişinden açılan eski bir ödenmiş sipariş (view) mevcut sepeti boşaltmaz.
  useEffect(() => {
    if (!apiOrder || clearedRef.current || viewOnly) return
    if (payHint === 'basarili' && apiOrder.status === 'paid') {
      clearedRef.current = true
      clear()
    }
  }, [apiOrder, payHint, viewOnly, clear])

  // Başarısız dönüşte son denemenin hata mesajı (iyzico'nun kullanıcıya dönük açıklaması) gösterilir.
  useEffect(() => {
    if (!apiOrder || apiOrder.status !== 'pending_payment' || payHint !== 'basarisiz' || navState?.initError) return
    let cancelled = false
    getPaymentStatus(apiOrder.id).then((st) => {
      if (!cancelled && st?.lastError?.message) setLastError(st.lastError.message)
    })
    return () => {
      cancelled = true
    }
  }, [apiOrder, payHint, navState?.initError])

  // iyzico'dan tarayıcı "Geri" ile dönüldüğünde sayfa bfcache'ten eski durumla geri gelebilir;
  // sipariş/ödeme durumu sunucudan tazelensin diye yeniden yüklenir.
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) window.location.reload()
    }
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [])

  async function retryPayment() {
    if (!apiOrder || retrying) return
    setRetrying(true)
    const init = await initPayment(apiOrder.id)
    if (init.ok) {
      window.location.assign(init.paymentPageUrl)
      return
    }
    setRetrying(false)
    setLastError(apiErrorMessage(init.error))
  }

  useEffect(() => {
    let cancelled = false
    if (!orderId) {
      setState({ status: 'not-found' })
      return
    }
    if (isApiMode()) {
      getApiOrder(orderId).then((order) => {
        if (cancelled) return
        setState(order ? { status: 'api', order } : { status: 'not-found' })
      })
    } else {
      const order = paymentProvider.getOrder(orderId)
      setState(order ? { status: 'demo', order } : { status: 'not-found' })
    }
    return () => {
      cancelled = true
    }
  }, [orderId])

  if (state.status === 'loading') {
    return (
      <div className={[pageStyles.page, pageStyles.narrow].join(' ')}>
        <h1 className={pageStyles.title}>{S.checkout.resultTitle}</h1>
        <p>{S.common.loading}</p>
      </div>
    )
  }

  if (state.status === 'not-found') {
    return (
      <div className={[pageStyles.page, pageStyles.narrow].join(' ')}>
        <h1 className={pageStyles.title}>{S.checkout.resultTitle}</h1>
        <p>{isApiMode() ? S.api.orderNotFound : S.checkout.resultNotFound}</p>
        <div className={styles.submitRow}>
          <Button variant="secondary" to="/koleksiyon">
            {S.common.continueShopping}
          </Button>
        </div>
      </div>
    )
  }

  const paymentView = state.status === 'api' ? paymentViewFor(state.order.status, payHint, onlinePaymentEnabled()) : null
  const delivery = state.status === 'api' ? state.order.delivery : state.order.input.delivery
  const orderNumber = state.order.id
  const summary =
    state.status === 'api' ? (
      <OrderSummary items={itemsFromApiOrder(state.order)} totals={totalsFromApiOrder(state.order)} />
    ) : (
      <OrderSummary lines={state.order.input.lines} totals={state.order.input.totals} />
    )

  return (
    <div className={[pageStyles.page, pageStyles.narrow].join(' ')}>
      {paymentView && !(viewOnly && paymentView === 'paid') ? (
        <>
          <div className={styles.resultHeader}>
            {paymentView === 'paid' ? <Icon name="check" size={28} /> : <Icon name="info" size={28} />}
            <h1 className={pageStyles.title} style={{ marginBottom: 0 }}>
              {PAYMENT_TITLES[paymentView]()}
            </h1>
          </div>
          <p>{PAYMENT_TEXTS[paymentView]()}</p>
          {paymentView === 'failed' || paymentView === 'pending' ? (
            <div className={styles.resultSection}>
              {lastError ? (
                <p role="alert" className={styles.formError}>
                  <Icon name="info" size={14} />
                  <span>{navState?.initError ? lastError : S.checkout.paymentLastError(lastError)}</span>
                </p>
              ) : null}
              <p className="text-soft text-sm">{S.checkout.paymentExpiryNote}</p>
              <div className={styles.submitRow}>
                <Button variant="primary" onClick={() => void retryPayment()} disabled={retrying}>
                  {retrying ? S.checkout.redirecting : S.checkout.retryPayment}
                </Button>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <div className={styles.resultHeader}>
            {viewOnly ? null : <Icon name="check" size={28} />}
            <h1 className={pageStyles.title} style={{ marginBottom: 0 }}>
              {viewOnly ? S.account.orderDetailTitle : S.checkout.resultTitle}
            </h1>
          </div>
          {viewOnly ? null : <p>{state.status === 'api' ? S.api.resultText : S.checkout.resultText}</p>}
        </>
      )}
      <p className={styles.orderNumber}>
        {state.status === 'api' && (paymentView || onlinePaymentEnabled()) ? S.checkout.orderNumberReal : S.checkout.orderNumber}: <strong>{orderNumber}</strong>
      </p>

      <section className={styles.resultSection}>
        <h2 className="h-block">{S.checkout.steps.delivery}</h2>
        <div className={styles.deliverySummary}>
          <p>
            {delivery.firstName} {delivery.lastName}
          </p>
          <p>{delivery.address}</p>
          <p>
            {delivery.district} / {delivery.city}
          </p>
        </div>
      </section>

      <section className={styles.resultSection}>
        <h2 className="h-block">{S.checkout.orderSummary}</h2>
        {summary}
      </section>

      <Button variant="primary" to="/koleksiyon">
        {S.checkout.backToShop}
      </Button>
    </div>
  )
}
