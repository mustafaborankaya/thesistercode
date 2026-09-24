import { useEffect, useReducer, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { availableRequests, createServiceRequest, listAccountOrders, listCustomerOrders, listNotifications, markNotificationsRead, orderStatusLabels, requestKindLabels, requestStatusLabels, subscribeCustomer } from '../../services/customer'
import type { DemoOrder, RequestKind } from '../../services/checkout'
import type { ApiOrder } from '../../services/ordersApi'
import { isApiMode } from '../../data/remote'
import { locale, localeMeta, S } from '../../i18n'
import { formatPrice } from '../../lib/format'
import { Button } from '../ui/Button'
import { TextareaField } from '../ui/Field'
import styles from './CustomerOrders.module.css'

function useCustomerUpdates() {
  const [, refresh] = useReducer((value: number) => value + 1, 0)
  useEffect(() => subscribeCustomer(refresh), [])
}
const date = (value: string) => new Date(value).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' })

function RequestForm({ email, order, onClose }: { email: string; order: DemoOrder; onClose: () => void }) {
  const choices = availableRequests(order)
  const [kind, setKind] = useState<RequestKind>(choices[0] ?? 'cancel')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  function submit(event: FormEvent) {
    event.preventDefault()
    try {
      createServiceRequest(email, order.id, kind, reason)
      onClose()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Talep kaydedilemedi.') }
  }
  if (!choices.length) return null
  return <form className={styles.form} onSubmit={submit}>
    <fieldset>
      <legend>Talep türü</legend>
      <div className={styles.actions}>{choices.map((value) => <label key={value}>
        <input type="radio" name={`request-${order.id}`} checked={kind === value} onChange={() => setKind(value)} /> {requestKindLabels[value]}
      </label>)}</div>
    </fieldset>
    <p className={styles.meta}>Bu talep siparişin tamamı içindir. Talebiniz incelendikten sonra sonucu hesabınızdan takip edebilirsiniz.</p>
    <TextareaField label={kind === 'exchange' ? 'Değişim nedeni ve istediğiniz ürün / beden' : 'Talep açıklaması'} value={reason} onChange={(event) => { setReason(event.target.value); setError('') }} rows={3} minLength={5} maxLength={1500} required />
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <div className={styles.actions}><Button type="submit" small>Talebi gönder</Button><Button small variant="ghost" onClick={onClose}>Vazgeç</Button></div>
  </form>
}

function CustomerOrder({ email, order }: { email: string; order: DemoOrder }) {
  const [expanded, setExpanded] = useState(false)
  const [requestOpen, setRequestOpen] = useState(false)
  const choices = availableRequests(order)
  return <article className={styles.card} aria-label={`Sipariş ${order.id}`} id={`order-${order.id}`}>
    <div className={styles.head}><div><strong>{order.id}</strong><p className={styles.meta}>{date(order.createdAt)}</p></div><span className={styles.status}>{orderStatusLabels[order.status ?? 'placed']}</span></div>
    <p>{order.input.totals.itemCount} ürün · <strong>{formatPrice(order.input.totals.total)}</strong>{order.input.totals.shipping == null ? ' (kargo hariç)' : ''}</p>
    {order.trackingNumber && <p className={styles.text}>Kargo takip numarası: {order.trackingNumber}</p>}
    <Button small variant="secondary" aria-expanded={expanded} aria-controls={`detail-${order.id}`} onClick={() => setExpanded(!expanded)}>{expanded ? 'Detayı kapat' : 'Sipariş detayı'}</Button>
    <div id={`detail-${order.id}`} hidden={!expanded}>
      <ul className={styles.items}>
        {order.items ? order.items.map((item) => <li key={item.key} className={styles.item}><span>{item.name} · {item.color} / {item.size} × {item.qty}</span><span>{formatPrice(item.unitPrice * item.qty)}</span></li>) : order.input.lines.map((line) => <li key={line.key}>{line.productId} · {line.colorId} / {line.size} × {line.qty}</li>)}
      </ul>
      {!order.items && <p className={styles.meta}>Bu eski siparişin ürün fiyatları ayrı kaydedilmemiştir; aşağıdaki toplam sipariş kaydındaki tutardır.</p>}
      <div className={styles.request}>
        <p>Ara toplam: {formatPrice(order.input.totals.subtotal)}</p>
        <p>İndirim: {formatPrice(order.input.totals.discountAmount)}</p>
        <p>Kargo: {order.input.totals.shipping == null ? 'Tanımlanmadı' : formatPrice(order.input.totals.shipping)}</p>
        <p><strong>Toplam: {formatPrice(order.input.totals.total)}</strong></p>
        <p className={styles.text}>{order.input.delivery.firstName} {order.input.delivery.lastName}{'\n'}{order.input.delivery.address}{'\n'}{order.input.delivery.district} / {order.input.delivery.city}, {order.input.delivery.country}</p>
      </div>
    </div>
    {order.requests?.map((request) => <div key={request.id} className={styles.request}>
      <strong>{requestKindLabels[request.kind]} talebi · {requestStatusLabels[request.status]}</strong>
      <p className={styles.meta}>{date(request.createdAt)}</p><p className={styles.text}>{request.reason}</p>
      {request.reply && <p className={styles.text}>Yanıt: {request.reply}</p>}
    </div>)}
    {choices.length > 0 && !requestOpen && <Button small variant="ghost" onClick={() => setRequestOpen(true)}>{choices[0] === 'cancel' ? 'İptal talebi oluştur' : 'İade / değişim talebi oluştur'}</Button>}
    {requestOpen && <RequestForm email={email} order={order} onClose={() => setRequestOpen(false)} />}
    {(order.status === 'shipped') && <p className={styles.meta}>İade ve değişim taleplerinizi teslimattan sonra buradan oluşturabilirsiniz.</p>}
  </article>
}

/** API tarih biçimi `YYYY-MM-DD HH:MM:SS` (mysql2 dateStrings) — Safari boşluklu biçimi ayrıştıramadığı için T ile birleştirilir. */
function formatApiDate(value: string): string {
  const parsed = new Date(value.includes('T') ? value : value.replace(' ', 'T'))
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString(localeMeta[locale].intlLocale, { dateStyle: 'medium', timeStyle: 'short' })
}

type ApiOrdersState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; orders: ApiOrder[] }

/** API modu: `GET /account/orders` — sunucudaki gerçek sipariş geçmişi (yeniden eskiye, en fazla 50). */
function ApiCustomerOrders() {
  const [state, setState] = useState<ApiOrdersState>({ status: 'loading' })
  useEffect(() => {
    let cancelled = false
    listAccountOrders().then(
      (orders) => { if (!cancelled) setState({ status: 'ready', orders }) },
      () => { if (!cancelled) setState({ status: 'error' }) },
    )
    return () => { cancelled = true }
  }, [])
  function retry() {
    setState({ status: 'loading' })
    listAccountOrders().then((orders) => setState({ status: 'ready', orders }), () => setState({ status: 'error' }))
  }
  if (state.status === 'loading') return <p className="text-soft text-sm" role="status">{S.account.ordersLoading}</p>
  if (state.status === 'error') return <div className={styles.head} role="alert"><p className="text-sm">{S.account.ordersError}</p><Button small variant="secondary" onClick={retry}>{S.account.retry}</Button></div>
  if (!state.orders.length) return <p className="text-soft text-sm">{S.account.ordersEmpty}</p>
  return <div className={styles.list}>{state.orders.map((order) => {
    const itemCount = (order.items ?? []).reduce((n, item) => n + item.qty, 0)
    return <article key={order.id} className={styles.card} aria-label={order.id}>
      <div className={styles.head}>
        <div><strong>{order.id}</strong><p className={styles.meta}>{formatApiDate(order.createdAt)}</p></div>
        <span className={styles.status}>{S.account.orderStatus[order.status] ?? order.status}</span>
      </div>
      <div className={styles.head}>
        <p>{S.account.orderItemCount(itemCount)} · <strong>{formatPrice(order.totals.total)}</strong></p>
        <Link to={`/odeme/sonuc/${encodeURIComponent(order.id)}`} state={{ view: true }} className="link text-sm" aria-label={S.account.orderViewAria(order.id)}>{S.account.orderView}</Link>
      </div>
    </article>
  })}</div>
}

function DemoCustomerOrders({ email }: { email: string }) {
  useCustomerUpdates()
  const orders = listCustomerOrders(email)
  if (!orders.length) return <p className="text-soft text-sm">{S.account.ordersEmpty}</p>
  return <div className={styles.list}>{orders.map((order) => <CustomerOrder key={order.id} email={email} order={order} />)}</div>
}

export function CustomerOrders({ email }: { email: string }) {
  return isApiMode() ? <ApiCustomerOrders key={email} /> : <DemoCustomerOrders email={email} />
}

export function CustomerNotifications({ email }: { email: string }) {
  useCustomerUpdates()
  const notifications = listNotifications(email)
  const [error, setError] = useState('')
  const unread = notifications.filter((item) => !item.read).length
  function markRead() {
    try { markNotificationsRead(email); setError('') } catch (cause) { setError(cause instanceof Error ? cause.message : 'Bildirimler güncellenemedi.') }
  }
  return <div className={styles.list}>
    {unread > 0 && <div className={styles.head}><p aria-live="polite">{unread} okunmamış bildirim</p><Button small variant="ghost" onClick={markRead}>Tümünü okundu işaretle</Button></div>}
    {error && <p role="alert">{error}</p>}
    {!notifications.length && <p className="text-soft text-sm">Sipariş ve taleplerinizle ilgili güncellemeler burada görünecek.</p>}
    {notifications.map((item) => <article className={styles.card} key={item.id}><p className={item.read ? '' : styles.unread}>{!item.read && <span className={styles.meta}>Yeni · </span>}{item.orderId}</p><p className={styles.text}>{item.message}</p><p className={styles.meta}>{date(item.createdAt)}</p></article>)}
  </div>
}
