/**
 * İndirim kodu doğrulama — `POST /coupons/validate` (herkese açık, IP başına 30 / 15 dk).
 * Geçersiz kodda sunucu 200 + `valid:false` döner; `reason` hata koduna göre yerelleştirilmiş mesaj gösterilir.
 */
import { api, ApiError } from './api'
import type { AppliedCoupon } from '../lib/cart'

export interface CouponValidation {
  valid: boolean
  code: string
  type?: 'percent' | 'fixed'
  value?: number
  minSubtotal?: number | null
  discountAmount: number
  /** valid:false → coupon_not_found | coupon_inactive | coupon_not_started | coupon_expired | coupon_min_subtotal | coupon_usage_limit | coupon_customer_limit */
  reason?: string
  message?: string
}

export type ValidateCouponResult = { ok: true; coupon: AppliedCoupon; discountAmount: number } | { ok: false; reason: string; message?: string; error?: ApiError }

export async function validateCouponApi(code: string, subtotal: number): Promise<ValidateCouponResult> {
  try {
    const res = await api<CouponValidation>('/coupons/validate', { method: 'POST', body: { code, subtotal } })
    if (res.valid && res.type && typeof res.value === 'number') {
      return { ok: true, coupon: { code: res.code, type: res.type, value: res.value, minSubtotal: res.minSubtotal ?? null }, discountAmount: res.discountAmount }
    }
    return { ok: false, reason: res.reason ?? 'coupon_not_found', message: res.message }
  } catch (e) {
    const error = e instanceof ApiError ? e : new ApiError(0, 'network', 'Sunucuya ulaşılamadı.')
    return { ok: false, reason: error.code, error }
  }
}
