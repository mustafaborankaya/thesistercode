/**
 * Ödeme / sipariş servisi sınırı.
 * Demo sağlayıcı gerçek tahsilat yapmaz ve kart bilgisi istemez;
 * yalnızca localStorage'da hesap geçmişine bağlı demo siparişleri tutar. Gerçek ödeme sağlayıcısı bağlanınca
 * `paymentProvider` ataması değiştirilir.
 */

import type { CartLine, CartTotals } from '../data/types'
import { readJSON, storageKeys } from '../lib/storage'
import { persistCustomerData } from '../lib/customerStorage'
import { productById } from '../data/catalog'

export type OrderStatus = 'placed' | 'preparing' | 'shipped' | 'delivered' | 'cancelled'
export type RequestKind = 'cancel' | 'return' | 'exchange'
export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'completed'
export interface ServiceRequest {
  id: string
  kind: RequestKind
  reason: string
  status: RequestStatus
  createdAt: string
  updatedAt: string
  reply: string
}
export interface OrderEvent { id: string; createdAt: string; message: string }
export interface OrderItemSnapshot { key: string; name: string; color: string; size: string; qty: number; unitPrice: number }

export interface CheckoutInput {
  contact: { email: string; phone: string }
  delivery: { firstName: string; lastName: string; address: string; district: string; city: string; postalCode: string; country: string; note?: string }
  lines: CartLine[]
  totals: CartTotals
  accountEmail: string | null
}

export interface DemoOrder {
  id: string
  createdAt: string
  demo: true
  input: Omit<CheckoutInput, 'lines'> & { lines: CartLine[] }
  status?: OrderStatus
  trackingNumber?: string
  requests?: ServiceRequest[]
  events?: OrderEvent[]
  items?: OrderItemSnapshot[]
}

export type CheckoutResult = { ok: true; order: DemoOrder } | { ok: false; error: 'empty-cart' | 'unknown' }

export interface PaymentProvider {
  createOrder(input: CheckoutInput): Promise<CheckoutResult>
  getOrder(id: string): DemoOrder | null
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

function demoOrderId(): string {
  const d = new Date()
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `DEMO-${stamp}-${rand}`
}

const demoPaymentProvider: PaymentProvider = {
  async createOrder(input) {
    await wait(800)
    if (input.lines.length === 0) return { ok: false, error: 'empty-cart' }
    const id = demoOrderId()
    const createdAt = new Date().toISOString()
    const order: DemoOrder = {
      id, createdAt, demo: true, input: structuredClone(input), status: 'placed', requests: [],
      events: [{ id: `${id}:placed`, createdAt, message: 'Siparişiniz alındı.' }],
      items: input.lines.map((line) => {
        const product = productById[line.productId]
        return { key: line.key, name: product?.name ?? line.productId, color: product?.colors.find((c) => c.id === line.colorId)?.label ?? line.colorId, size: line.size, qty: line.qty, unitPrice: product?.price ?? 0 }
      }),
    }
    const orders = readJSON<DemoOrder[]>(storageKeys.demoOrders, [])
    try {
      // Keep history instead of silently deleting older customer orders.
      persistCustomerData(storageKeys.demoOrders, [...orders, order])
    } catch {
      return { ok: false, error: 'unknown' }
    }
    return { ok: true, order }
  },
  getOrder(id) {
    return readJSON<DemoOrder[]>(storageKeys.demoOrders, []).find((o) => o.id === id) ?? null
  },
}

/** Yönetici paneli için: bu tarayıcıda oluşturulmuş demo siparişler (en yeni önce). */
export function listDemoOrders(): DemoOrder[] {
  return [...readJSON<DemoOrder[]>(storageKeys.demoOrders, [])].reverse()
}

export const paymentProvider: PaymentProvider = demoPaymentProvider
