import { useState, type FormEvent } from 'react'
import type { DemoOrder, RequestStatus, ServiceRequest } from '../../services/checkout'
import { allowedOrderStatuses, orderStatusLabels, requestKindLabels, requestStatusLabels, respondToRequest, setOrderStatus } from '../../services/customer'
import { Button } from '../../components/ui/Button'
import { Field, SelectField, TextareaField } from '../../components/ui/Field'

function RequestReply({ orderId, request }: { orderId: string; request: ServiceRequest }) {
  const [reply, setReply] = useState('')
  const [decision, setDecision] = useState<'approved' | 'rejected'>('approved')
  const [error, setError] = useState('')
  const editable = request.status === 'pending' || request.status === 'approved'
  function submit(event: FormEvent) {
    event.preventDefault()
    const next: Exclude<RequestStatus, 'pending'> = request.status === 'approved' ? 'completed' : decision
    try { respondToRequest(orderId, request.id, next, reply); setReply(''); setError('') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Talep güncellenemedi.') }
  }
  return <section className="stack">
    <strong>{requestKindLabels[request.kind]} talebi — {requestStatusLabels[request.status]}</strong>
    <p className="text-sm" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{request.reason}</p>
    {request.reply && <p className="text-sm" style={{ overflowWrap: 'anywhere' }}>Son yanıt: {request.reply}</p>}
    {editable && <form className="stack" onSubmit={submit}>
      {request.status === 'pending' && <SelectField label="Talep kararı" value={decision} onChange={(event) => setDecision(event.target.value as 'approved' | 'rejected')}><option value="approved">Onayla</option><option value="rejected">Reddet</option></SelectField>}
      <TextareaField label="Müşteriye açıklama" value={reply} onChange={(event) => setReply(event.target.value)} minLength={5} maxLength={1500} rows={3} required />
      {error && <p role="alert">{error}</p>}
      <Button type="submit" small>{request.status === 'approved' ? 'Talebi tamamlandı olarak işaretle' : 'Yanıtı kaydet'}</Button>
    </form>}
  </section>
}

export function OrderServiceControls({ order }: { order: DemoOrder }) {
  const [tracking, setTracking] = useState(order.trackingNumber ?? '')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const next = allowedOrderStatuses(order)[0]
  function updateStatus(event: FormEvent) {
    event.preventDefault()
    if (!next) return
    try { setOrderStatus(order.id, next, tracking); setMessage('Sipariş durumu güncellendi.'); setError('') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Durum güncellenemedi.') }
  }
  return <section className="stack" aria-label="Sipariş ve talepler">
    <h2 className="h-block">Sipariş ve talepler</h2>
    <p>Durum: <strong>{orderStatusLabels[order.status ?? 'placed']}</strong></p>
    {order.trackingNumber && <p>Kargo takip numarası: {order.trackingNumber}</p>}
    <p className="text-soft text-xs">Bu demo işlemler hesap içi bildirim oluşturur; gerçek kargo gönderimi veya para iadesi yapmaz.</p>
    {next && <form className="stack" onSubmit={updateStatus}>
      {next === 'shipped' && <Field label="Kargo takip numarası" value={tracking} onChange={(event) => setTracking(event.target.value)} required maxLength={100} />}
      <Button type="submit" small variant="secondary">{orderStatusLabels[next]} olarak işaretle</Button>
    </form>}
    {message && <p role="status">{message}</p>}
    {error && <p role="alert">{error}</p>}
    {order.requests?.some((request) => request.kind === 'cancel' && request.status === 'pending') && <p className="text-sm">Sevkiyata devam etmeden önce iptal talebini yanıtlayın.</p>}
    {!order.requests?.length && <p className="text-soft text-sm">Bu sipariş için talep bulunmuyor.</p>}
    {order.requests?.map((request) => <RequestReply key={request.id} orderId={order.id} request={request} />)}
  </section>
}
