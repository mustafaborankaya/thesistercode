import { isAdminSession } from '../admin/adminStore'
import { persistCustomerData } from '../lib/customerStorage'
import { readJSON, storageKeys } from '../lib/storage'
import { listDemoOrders, type DemoOrder, type OrderStatus, type RequestKind, type RequestStatus } from './checkout'
export { subscribeCustomer } from '../lib/customerStorage'

export interface SavedAddress {
  id: string
  label: string
  firstName: string
  lastName: string
  phone: string
  address: string
  district: string
  city: string
  postalCode: string
  country: string
  isDefault: boolean
}
export type AddressInput = Omit<SavedAddress, 'id'>
const ADDRESS_KEY = 'tsc.customer-addresses.v1'
const READ_KEY = 'tsc.customer-read.v1'
const normalizeEmail = (email: string) => email.trim().toLowerCase()

// This is account separation within the existing demo, not server authorization.
function ownsSession(email: string): boolean {
  const account = readJSON<{ current?: { email?: string } }>(storageKeys.account, {})
  return !!email && normalizeEmail(account.current?.email ?? '') === normalizeEmail(email)
}
function requireSession(email: string): string {
  if (!ownsSession(email)) throw new Error('Bu işlem için hesabınıza giriş yapın.')
  return normalizeEmail(email)
}
function addressStore(): Record<string, SavedAddress[]> {
  return readJSON(ADDRESS_KEY, {})
}
export function listAddresses(email: string): SavedAddress[] {
  return ownsSession(email) ? addressStore()[normalizeEmail(email)] ?? [] : []
}
export function saveAddress(email: string, input: AddressInput, id?: string): void {
  const owner = requireSession(email)
  const store = addressStore()
  const list = store[owner] ?? []
  if (id && !list.some((address) => address.id === id)) throw new Error('Adres bulunamadı. Listeyi yenileyin.')
  const address: SavedAddress = { ...input, id: id ?? crypto.randomUUID() }
  for (const field of ['label', 'firstName', 'lastName', 'phone', 'address', 'district', 'city', 'country'] as const) {
    address[field] = address[field].trim()
    if (!address[field]) throw new Error('Zorunlu adres alanlarını doldurun.')
  }
  if (address.phone.replace(/\D/g, '').length < 10) throw new Error('Geçerli bir telefon numarası girin.')
  if (!list.length) address.isDefault = true
  let next = id ? list.map((item) => item.id === id ? address : item) : [...list, address]
  if (address.isDefault) next = next.map((item) => ({ ...item, isDefault: item.id === address.id }))
  if (!next.some((item) => item.isDefault)) next[0] = { ...next[0], isDefault: true }
  persistCustomerData(ADDRESS_KEY, { ...store, [owner]: next })
}
export function removeAddress(email: string, id: string): void {
  const owner = requireSession(email)
  const store = addressStore()
  const next = (store[owner] ?? []).filter((item) => item.id !== id)
  if (next.length && !next.some((item) => item.isDefault)) next[0] = { ...next[0], isDefault: true }
  persistCustomerData(ADDRESS_KEY, { ...store, [owner]: next })
}

export const orderStatusLabels: Record<OrderStatus, string> = { placed: 'Sipariş alındı', preparing: 'Hazırlanıyor', shipped: 'Kargoya verildi', delivered: 'Teslim edildi', cancelled: 'İptal edildi' }
export const requestKindLabels: Record<RequestKind, string> = { cancel: 'İptal', return: 'İade', exchange: 'Değişim' }
export const requestStatusLabels: Record<RequestStatus, string> = { pending: 'İnceleniyor', approved: 'Onaylandı', rejected: 'Reddedildi', completed: 'Tamamlandı' }

export function listCustomerOrders(email: string): DemoOrder[] {
  if (!ownsSession(email)) return []
  // A guest contact email is not proof that the order belongs to this account.
  return listDemoOrders().filter((order) => order.input.accountEmail != null && normalizeEmail(order.input.accountEmail) === normalizeEmail(email))
}
export function availableRequests(order: DemoOrder): RequestKind[] {
  if (order.requests?.some((request) => request.status !== 'rejected')) return []
  const status = order.status ?? 'placed'
  if (status === 'placed' || status === 'preparing') return ['cancel']
  if (status === 'delivered') return ['return', 'exchange']
  return []
}
function updateOrder(order: DemoOrder): void {
  const orders = [...listDemoOrders()].reverse()
  if (!orders.some((item) => item.id === order.id)) throw new Error('Sipariş bulunamadı.')
  persistCustomerData(storageKeys.demoOrders, orders.map((item) => item.id === order.id ? order : item))
}
function addEvent(order: DemoOrder, message: string): DemoOrder {
  const history = order.events ?? [{ id: `${order.id}:placed`, createdAt: order.createdAt, message: 'Siparişiniz alındı.' }]
  return { ...order, events: [...history, { id: crypto.randomUUID(), createdAt: new Date().toISOString(), message }] }
}
export function createServiceRequest(email: string, orderId: string, kind: RequestKind, reason: string): void {
  requireSession(email)
  const order = listCustomerOrders(email).find((item) => item.id === orderId)
  if (!order) throw new Error('Sipariş bulunamadı.')
  if (!availableRequests(order).includes(kind)) throw new Error('Bu sipariş için seçilen talep şu anda oluşturulamıyor.')
  if (reason.trim().length < 5 || reason.trim().length > 1500) throw new Error('Talebinizi 5–1500 karakter arasında açıklayın.')
  const now = new Date().toISOString()
  const next = { ...order, requests: [...(order.requests ?? []), { id: crypto.randomUUID(), kind, reason: reason.trim(), status: 'pending' as const, createdAt: now, updatedAt: now, reply: '' }] }
  updateOrder(addEvent(next, `${requestKindLabels[kind]} talebiniz alındı.`))
}

const nextStatuses: Record<OrderStatus, OrderStatus[]> = { placed: ['preparing'], preparing: ['shipped'], shipped: ['delivered'], delivered: [], cancelled: [] }
export function allowedOrderStatuses(order: DemoOrder): OrderStatus[] {
  if (order.requests?.some((request) => request.kind === 'cancel' && request.status === 'pending')) return []
  return nextStatuses[order.status ?? 'placed']
}
export function setOrderStatus(orderId: string, status: OrderStatus, trackingNumber: string): void {
  if (!isAdminSession()) throw new Error('Yönetici girişi gerekli.')
  const order = listDemoOrders().find((item) => item.id === orderId)
  if (!order || !allowedOrderStatuses(order).includes(status)) throw new Error('Sipariş durumu değişti; yeniden kontrol edin.')
  if (status === 'shipped' && !trackingNumber.trim()) throw new Error('Kargo takip numarası girin.')
  updateOrder(addEvent({ ...order, status, trackingNumber: status === 'shipped' ? trackingNumber.trim() : order.trackingNumber }, orderStatusLabels[status] + '.'))
}
export function respondToRequest(orderId: string, requestId: string, status: Exclude<RequestStatus, 'pending'>, reply: string): void {
  if (!isAdminSession()) throw new Error('Yönetici girişi gerekli.')
  const order = listDemoOrders().find((item) => item.id === orderId)
  const request = order?.requests?.find((item) => item.id === requestId)
  if (!order || !request) throw new Error('Talep bulunamadı.')
  const valid = request.status === 'pending' ? status === 'approved' || status === 'rejected' : request.status === 'approved' && status === 'completed'
  if (!valid) throw new Error('Talep durumu değişti; yeniden kontrol edin.')
  if (reply.trim().length < 5 || reply.trim().length > 1500) throw new Error('Müşteriye iletilecek açıklamayı 5–1500 karakter arasında girin.')
  const next = { ...order, status: request.kind === 'cancel' && status === 'approved' ? 'cancelled' as const : order.status, requests: order.requests!.map((item) => item.id === requestId ? { ...item, status, reply: reply.trim(), updatedAt: new Date().toISOString() } : item) }
  updateOrder(addEvent(next, `${requestKindLabels[request.kind]} talebiniz: ${requestStatusLabels[status]}. ${reply.trim()}`))
}

export function listNotifications(email: string) {
  const reads = readJSON<Record<string, string[]>>(READ_KEY, {})[normalizeEmail(email)] ?? []
  return listCustomerOrders(email).flatMap((order) => (order.events ?? [{ id: `${order.id}:placed`, createdAt: order.createdAt, message: 'Siparişiniz alındı.' }]).map((event) => ({ ...event, orderId: order.id, read: reads.includes(event.id) }))).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
export function markNotificationsRead(email: string): void {
  const owner = requireSession(email)
  const store = readJSON<Record<string, string[]>>(READ_KEY, {})
  persistCustomerData(READ_KEY, { ...store, [owner]: listNotifications(email).map((item) => item.id) })
}
