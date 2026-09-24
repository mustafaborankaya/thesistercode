/**
 * Gerçek sipariş servisi (backend API — `POST /orders`, `GET /orders/:id`).
 * Yanıt şekli api/src/services/orders.js → formatOrder ile birebir aynıdır.
 */
import type { CartLine } from '../data/types'
import { locale } from '../i18n'
import { api, ApiError } from './api'
import { isApiMode } from '../data/remote'
import { siteSettings } from '../config/settings'

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
  /** Siparişin dili (ödeme sayfası / e-posta); eski API'de yok. */
  locale?: 'tr' | 'en'
  /** Yalnızca yönetici uç noktalarında: en anlamlı ödeme denemesi (başarılı/iadeli, yoksa en son). */
  payment?: ApiPayment | null
  paymentAttempts?: number
  createdAt: string
  updatedAt: string
}

/** Yönetici sipariş yanıtındaki ödeme özeti (kart verisi içermez; yalnızca kart ailesi ve son 4 hane). */
export interface ApiPayment {
  id: number
  provider: string
  status: 'initialized' | 'success' | 'failure' | 'refunded'
  paymentId: string | null
  price: number
  paidPrice: number
  installment: number | null
  cardAssociation: string | null
  cardFamily: string | null
  lastFour: string | null
  fraudStatus: number | null
  errorCode: string | null
  errorMessage: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateOrderInput {
  contact: { email: string; phone: string }
  delivery: { firstName: string; lastName: string; address: string; district: string; city: string; postalCode: string; country: string; note?: string }
  lines: CartLine[]
}

/** `paymentRequired`: sunucu siparişi 'pending_payment' oluşturdu → istemci `initPayment` ile ödeme sayfasına gitmeli. */
export type CreateOrderResult = { ok: true; order: ApiOrder; paymentRequired: boolean } | { ok: false; error: ApiError }

/**
 * Mağaza çevrim içi ödeme (iyzico) modunda mı? Sunucunun /settings yanıtındaki `payment.provider`'a
 * dayanır — yalnızca arayüz metni/seçeneği için. Akışın kendisi `POST /orders` yanıtındaki
 * `payment.required`'a göre yürür (ayarlar açılışta yüklenemese bile doğru davranır).
 */
export function onlinePaymentEnabled(): boolean {
  return isApiMode() && siteSettings.payment.provider !== 'none'
}

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
    const res = await api<{ order: ApiOrder; accessToken?: string; payment?: { required?: boolean } }>('/orders', {
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
    return { ok: true, order: res.order, paymentRequired: res.payment?.required === true || res.order.status === 'pending_payment' }
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

function orderAuthHeaders(orderId: string): Record<string, string> | undefined {
  const token = readOrderToken(orderId)
  return token ? { Authorization: `Bearer ${token}` } : undefined
}

export type InitPaymentResult = { ok: true; paymentPageUrl: string } | { ok: false; error: ApiError }

/**
 * `POST /payments/init` — iyzico ödeme formunu başlatır ve güvenli ödeme sayfasının adresini döndürür.
 * Yetki: sipariş oluşturulurken sessionStorage'a yazılan erişim jetonu (Bearer) ya da sahibi müşteri çerezi.
 * Sayfa gömülmez (CSP: script-src/form-action 'self'); çağıran `window.location.assign` ile yönlendirir.
 */
export async function initPayment(orderId: string): Promise<InitPaymentResult> {
  try {
    const res = await api<{ paymentPageUrl: string }>('/payments/init', { method: 'POST', body: { orderId }, headers: orderAuthHeaders(orderId) })
    return { ok: true, paymentPageUrl: res.paymentPageUrl }
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e : new ApiError(0, 'network', 'Sunucuya ulaşılamadı.') }
  }
}

export interface PaymentStatus {
  status: string
  paymentStatus: 'initialized' | 'success' | 'failure' | 'refunded' | null
  lastError: { code: string | null; message: string | null } | null
}

/** `GET /payments/status/:orderId` — son ödeme denemesinin durumu ve hatası. */
export async function getPaymentStatus(orderId: string): Promise<PaymentStatus | null> {
  try {
    return await api<PaymentStatus>(`/payments/status/${encodeURIComponent(orderId)}`, { headers: orderAuthHeaders(orderId) })
  } catch {
    return null
  }
}
