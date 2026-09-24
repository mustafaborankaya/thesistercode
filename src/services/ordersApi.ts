/**
 * Gerçek sipariş servisi (backend API — `POST /orders`, `GET /orders/:id`).
 * Yanıt şekli api/src/services/orders.js → formatOrder ile birebir aynıdır.
 */
import type { CartLine } from '../data/types'
import { locale } from '../i18n'
import { api, ApiError } from './api'

export interface ApiOrderItem {
  productId: string
  productName: string
  colorId: string
  colorLabel: string
  size: string
  qty: number
  unitPrice: number
}

export interface ApiOrder {
  id: string
  customerId: number | null
  status: string
  contact: { email: string; phone: string }
  delivery: {
    firstName: string
    lastName: string
    address: string
    district: string
    city: string
    postalCode: string
    country: string
    note: string | null
  }
  totals: {
    subtotal: number
    discountPercent: number
    discountAmount: number
    shipping: number | null
    total: number
  }
  items?: ApiOrderItem[]
  createdAt: string
  updatedAt: string
}

export interface CreateOrderInput {
  contact: { email: string; phone: string }
  delivery: { firstName: string; lastName: string; address: string; district: string; city: string; postalCode: string; country: string; note?: string }
  lines: CartLine[]
}

export type CreateOrderResult = { ok: true; order: ApiOrder } | { ok: false; error: ApiError }

const orderTokenKey = (orderId: string) => `tsc.order-token.${orderId}`

/** Sipariş erişim jetonunu (varsa) bu sekme için sessionStorage'da saklar — sonuç sayfası bunu okur. */
function saveOrderToken(orderId: string, token: string): void {
  try {
    window.sessionStorage.setItem(orderTokenKey(orderId), token)
  } catch {
    /* depolama engelliyse jeton yalnızca çerezli erişim (girişli müşteri) için kaybolur */
  }
}

function readOrderToken(orderId: string): string | null {
  try {
    return window.sessionStorage.getItem(orderTokenKey(orderId))
  } catch {
    return null
  }
}

/** `POST /orders` — fiyat/stok/toplamlar sunucuda hesaplanır; yanıt `{ order, accessToken? }` olabilir. */
export async function createApiOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  try {
    const res = await api<{ order: ApiOrder; accessToken?: string }>('/orders', {
      method: 'POST',
      body: {
        contact: input.contact,
        delivery: input.delivery,
        lines: input.lines.map((l) => ({ productId: l.productId, colorId: l.colorId, size: l.size, qty: l.qty })),
        // Sipariş onay e-postasının dili — sunucu isteğe bağlı kabul eder.
        locale,
      },
    })
    if (res.accessToken) saveOrderToken(res.order.id, res.accessToken)
    return { ok: true, order: res.order }
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e : new ApiError(0, 'network', 'Sunucuya ulaşılamadı.') }
  }
}

/**
 * `GET /orders/:id` — bu uç nokta demo amaçlı kimlik doğrulaması gerektirmeden çalışır (bkz.
 * api/README.md "Bilinen sınırlar"); güvenlik ajanı `Authorization: Bearer <token>` başlığı ile
 * doğrulama ekliyor olabilir (bkz. api/src/routes/orders.js). Jeton ASLA URL sorgu parametresine
 * konmaz — sunucu erişim günlüklerine ve `Referer` başlığına düşmemesi için `Authorization` başlığıyla
 * gönderilir. Jeton yoksa da (mevcut API şekliyle, girişli müşteri çerezi ya da doğrulamasız erişim
 * için) istek başlıksız yapılır.
 */
export async function getApiOrder(id: string): Promise<ApiOrder | null> {
  const token = readOrderToken(id)
  try {
    const res = await api<{ order: ApiOrder }>(`/orders/${encodeURIComponent(id)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
    return res.order
  } catch {
    return null
  }
}
