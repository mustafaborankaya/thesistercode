import { before, beforeEach, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'

let server, customer, checkout, catalog, admin
let local, session
const owner = 'customer@example.test'
function storage(map) { return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), removeItem: (key) => map.delete(key) } }
function signIn(email = owner) { local.set('tsc.account.v1', JSON.stringify({ current: { email } })) }
const address = { label: 'Ev', firstName: 'Deneme', lastName: 'Müşteri', phone: '05000000000', address: 'Test adresi', district: 'Test ilçe', city: 'Test şehir', postalCode: '', country: 'Türkiye', isDefault: false }
function seedOrder(id = 'ORDER-1', email = owner) {
  const order = { id, createdAt: '2026-09-21T08:00:00Z', demo: true, status: 'placed', input: { accountEmail: email, contact: { email: owner, phone: address.phone }, delivery: { ...address }, lines: [{ key: 'urun-01:renk-1:S', productId: 'urun-01', colorId: 'renk-1', size: 'S', qty: 1 }], totals: { subtotal: 4250, total: 4250, shipping: null, discountAmount: 0, discountPercent: 0, itemCount: 1 } }, requests: [], events: [] }
  const orders = JSON.parse(local.get('tsc.demo-orders.v1') ?? '[]')
  local.set('tsc.demo-orders.v1', JSON.stringify([...orders, order]))
  return order
}
before(async () => {
  globalThis.window = Object.assign(new EventTarget(), { localStorage: storage(new Map()), sessionStorage: storage(new Map()) })
  server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
  customer = await server.ssrLoadModule('/src/services/customer.ts')
  checkout = await server.ssrLoadModule('/src/services/checkout.ts')
  catalog = await server.ssrLoadModule('/src/data/catalog.ts')
  admin = await server.ssrLoadModule('/src/admin/adminStore.ts')
})
beforeEach(() => {
  local = new Map(); session = new Map()
  window.localStorage = storage(local); window.sessionStorage = storage(session)
  signIn()
})
after(async () => { await server.close(); delete globalThis.window })

test('address CRUD preserves one default and isolates accounts', () => {
  customer.saveAddress(owner, address)
  const first = customer.listAddresses(owner)[0]
  assert.equal(first.isDefault, true)
  customer.saveAddress(owner, { ...address, label: 'İş', isDefault: true })
  let list = customer.listAddresses(owner)
  assert.equal(list.filter((item) => item.isDefault).length, 1)
  const second = list.find((item) => item.label === 'İş')
  customer.saveAddress(owner, { ...address, label: 'Yeni ev' }, first.id)
  assert.equal(customer.listAddresses(owner)[0].label, 'Yeni ev')
  assert.deepEqual(customer.listAddresses('other@example.test'), [])
  assert.throws(() => customer.saveAddress('other@example.test', address))
  customer.removeAddress(owner, second.id)
  assert.equal(customer.listAddresses(owner)[0].isDefault, true)
  assert.throws(() => customer.saveAddress(owner, address, 'missing'))
})
test('only explicitly owned orders appear, never matching guest contact emails', () => {
  seedOrder(); seedOrder('OTHER', 'other@example.test'); seedOrder('GUEST', null)
  assert.deepEqual(customer.listCustomerOrders(owner).map((item) => item.id), ['ORDER-1'])
  assert.equal(customer.listCustomerOrders('other@example.test').length, 0)
  signIn('other@example.test')
  assert.deepEqual(customer.listCustomerOrders('other@example.test').map((item) => item.id), ['OTHER'])
})
test('requests reject wrong owner, invalid state and duplicates', () => {
  seedOrder()
  assert.throws(() => customer.createServiceRequest('other@example.test', 'ORDER-1', 'cancel', 'Test iptal'))
  assert.throws(() => customer.createServiceRequest(owner, 'ORDER-1', 'return', 'Test iade'))
  assert.throws(() => customer.createServiceRequest(owner, 'ORDER-1', 'cancel', 'x'))
  customer.createServiceRequest(owner, 'ORDER-1', 'cancel', 'Siparişi iptal etmek istiyorum.')
  assert.throws(() => customer.createServiceRequest(owner, 'ORDER-1', 'cancel', 'İkinci talep'))
  assert.equal(customer.listCustomerOrders(owner)[0].requests.length, 1)
  assert.equal(customer.listNotifications(owner).length, 1)
})
test('cancellation approval updates order, rejects stale decisions and notifies', () => {
  seedOrder(); customer.createServiceRequest(owner, 'ORDER-1', 'cancel', 'İptal etmek istiyorum.')
  const request = customer.listCustomerOrders(owner)[0].requests[0]
  assert.throws(() => customer.respondToRequest('ORDER-1', request.id, 'approved', 'Talebiniz onaylandı.'))
  admin.setAdminSession(true)
  assert.throws(() => customer.setOrderStatus('ORDER-1', 'preparing', ''))
  customer.respondToRequest('ORDER-1', request.id, 'approved', 'Talebiniz onaylandı.')
  assert.equal(customer.listCustomerOrders(owner)[0].status, 'cancelled')
  assert.throws(() => customer.respondToRequest('ORDER-1', request.id, 'rejected', 'Eski karar değiştirilemez.'))
  assert.equal(customer.listNotifications(owner).length, 2)
  customer.markNotificationsRead(owner)
  assert.equal(customer.listNotifications(owner).filter((item) => !item.read).length, 0)
})
test('delivery transitions require tracking and allow return/exchange review', () => {
  seedOrder(); admin.setAdminSession(true)
  assert.throws(() => customer.setOrderStatus('ORDER-1', 'delivered', ''))
  customer.setOrderStatus('ORDER-1', 'preparing', '')
  assert.throws(() => customer.setOrderStatus('ORDER-1', 'shipped', ''))
  customer.setOrderStatus('ORDER-1', 'shipped', 'DEMO-TRACKING')
  customer.setOrderStatus('ORDER-1', 'delivered', 'STALE-HIDDEN-DRAFT')
  assert.equal(customer.listCustomerOrders(owner)[0].trackingNumber, 'DEMO-TRACKING')
  assert.deepEqual(customer.availableRequests(customer.listCustomerOrders(owner)[0]), ['return', 'exchange'])
  customer.createServiceRequest(owner, 'ORDER-1', 'exchange', 'Bir büyük beden ile değiştirmek istiyorum.')
  const request = customer.listCustomerOrders(owner)[0].requests[0]
  customer.respondToRequest('ORDER-1', request.id, 'approved', 'Değişim talebiniz onaylandı.')
  customer.respondToRequest('ORDER-1', request.id, 'completed', 'Değişim işleminiz tamamlandı.')
  assert.equal(customer.listCustomerOrders(owner)[0].requests[0].status, 'completed')
  assert.deepEqual(customer.availableRequests(customer.listCustomerOrders(owner)[0]), [])
})
test('failed persistence never reports successful request or address save', () => {
  seedOrder()
  window.localStorage.setItem = () => { throw new Error('quota') }
  assert.throws(() => customer.saveAddress(owner, address), /kaydedilemedi/)
  assert.throws(() => customer.createServiceRequest(owner, 'ORDER-1', 'cancel', 'İptal talebi'), /kaydedilemedi/)
  assert.equal(customer.listCustomerOrders(owner)[0].requests.length, 0)
})
test('new orders persist independent price snapshot and survive 50-order history', async () => {
  const input = seedOrder().input
  for (let i = 0; i < 50; i++) seedOrder(`OLD-${i}`)
  const result = await checkout.paymentProvider.createOrder(input)
  assert.equal(result.ok, true)
  assert.equal(checkout.listDemoOrders().length, 52)
  const original = catalog.productById['urun-01'].price
  try {
    catalog.productById['urun-01'].price = 1
    input.delivery.firstName = 'Changed later'
    const saved = checkout.paymentProvider.getOrder(result.order.id)
    assert.equal(saved.items[0].unitPrice, original)
    assert.equal(saved.input.delivery.firstName, 'Deneme')
    assert.equal(saved.events[0].message, 'Siparişiniz alındı.')
  } finally { catalog.productById['urun-01'].price = original }
})
test('checkout returns failure if order cannot be stored', async () => {
  const input = seedOrder().input
  window.localStorage.setItem = () => { throw new Error('quota') }
  assert.equal((await checkout.paymentProvider.createOrder(input)).ok, false)
})
test('legacy order defaults remain visible and notifications are account-scoped', () => {
  const order = seedOrder()
  delete order.status; delete order.events; delete order.requests
  local.set('tsc.demo-orders.v1', JSON.stringify([order]))
  assert.deepEqual(customer.availableRequests(order), ['cancel'])
  assert.equal(customer.listNotifications(owner).length, 1)
  customer.markNotificationsRead(owner)
  customer.createServiceRequest(owner, order.id, 'cancel', 'Eski sipariş iptal talebi')
  assert.equal(customer.listNotifications(owner).length, 2)
  assert.equal(customer.listNotifications(owner).find((item) => item.id === `${order.id}:placed`).read, true)
  signIn('other@example.test')
  assert.deepEqual(customer.listNotifications('other@example.test'), [])
})
test('subscriptions refresh on mutations and unsubscribe cleanly', () => {
  let calls = 0
  const unsubscribe = customer.subscribeCustomer(() => calls++)
  customer.saveAddress(owner, address)
  assert.equal(calls, 1)
  unsubscribe()
  customer.saveAddress(owner, { ...address, label: 'Diğer' })
  assert.equal(calls, 1)
})
