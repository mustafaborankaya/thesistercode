import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { productById } from '../data/catalog'
import type { CartLine, SizeId } from '../data/types'
import { applyKnownPrice, computeTotals, lineKey, normalizeLines, variantStock, type AppliedCoupon, type SummaryTotals } from '../lib/cart'
import { trackAddToCart } from '../services/analytics'
import { validateCouponApi, type ValidateCouponResult } from '../services/coupons'
import { readJSON, storageKeys, writeJSON } from '../lib/storage'
import { useAccount } from './AccountContext'
import { usePanels } from './PanelContext'

export type AddResult = { ok: true; key: string; qty: number } | { ok: false; reason: 'invalid' | 'sold-out' | 'stock-limit' | 'duplicate-click' }

interface CartContextValue {
  lines: CartLine[]
  totals: SummaryTotals
  /** Doğrulanmış indirim kodu (sekme boyunca sessionStorage'da). */
  coupon: AppliedCoupon | null
  /** `POST /coupons/validate` ile doğrular; geçerliyse sepete uygular. */
  applyCoupon: (code: string) => Promise<ValidateCouponResult>
  removeCoupon: () => void
  /** Sunucunun bildirdiği güncel birim fiyatları kataloğa yazar ve toplamları yeniden hesaplatır (409 price_changed). */
  repriceLines: (updates: { productId: string; unitPrice: number }[]) => void
  /** Geçerli varyantı sepete ekler ve sepet panelini açar. */
  addLine: (productId: string, colorId: string, size: SizeId, qty?: number) => AddResult
  setQty: (key: string, qty: number) => void
  increment: (key: string) => void
  decrement: (key: string) => void
  removeLine: (key: string) => void
  clear: () => void
  /** Bir satırın stok sınırı. */
  maxQty: (key: string) => number
  /** Son eklenen satır (panelde vurgulamak için). */
  lastAddedKey: string | null
}

const CartContext = createContext<CartContextValue | null>(null)

const COUPON_KEY = 'tsc.coupon'

function readCoupon(): AppliedCoupon | null {
  try {
    const raw = window.sessionStorage.getItem(COUPON_KEY)
    if (!raw) return null
    const c = JSON.parse(raw) as AppliedCoupon
    return c && typeof c.code === 'string' && (c.type === 'percent' || c.type === 'fixed') && typeof c.value === 'number' ? c : null
  } catch {
    return null
  }
}

function writeCoupon(c: AppliedCoupon | null): void {
  try {
    if (c) window.sessionStorage.setItem(COUPON_KEY, JSON.stringify(c))
    else window.sessionStorage.removeItem(COUPON_KEY)
  } catch {
    /* depolama engelliyse kupon yalnızca bu sayfa ömrü boyunca kalır */
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(() => normalizeLines(readJSON<CartLine[]>(storageKeys.cart, [])))
  const [lastAddedKey, setLastAddedKey] = useState<string | null>(null)
  const { discountEligible } = useAccount()
  const { openPanel } = usePanels()
  const lastAddRef = useRef<{ key: string; at: number } | null>(null)
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(() => readCoupon())
  /** Katalog fiyatı yerinde güncellendiğinde toplamları yeniden hesaplatmak için. */
  const [priceVersion, setPriceVersion] = useState(0)

  useEffect(() => {
    writeCoupon(coupon)
  }, [coupon])

  useEffect(() => {
    writeJSON(storageKeys.cart, lines)
  }, [lines])

  // Başka sekmede değişen sepeti yansıt.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKeys.cart) setLines(normalizeLines(readJSON<CartLine[]>(storageKeys.cart, [])))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const maxQty = useCallback((key: string) => {
    const [productId, colorId, size] = key.split(':') as [string, string, SizeId]
    const product = productById[productId]
    return product ? variantStock(product, colorId, size) : 0
  }, [])

  const addLine = useCallback(
    (productId: string, colorId: string, size: SizeId, qty = 1): AddResult => {
      const product = productById[productId]
      if (!product || !product.colors.some((c) => c.id === colorId) || !product.sizes.includes(size)) return { ok: false, reason: 'invalid' }
      const max = variantStock(product, colorId, size)
      if (max <= 0) return { ok: false, reason: 'sold-out' }
      const key = lineKey(productId, colorId, size)

      // Hızlı çift tıklama koruması: aynı varyant 500 ms içinde tekrar eklenmez.
      const now = Date.now()
      if (lastAddRef.current && lastAddRef.current.key === key && now - lastAddRef.current.at < 500) {
        return { ok: false, reason: 'duplicate-click' }
      }
      lastAddRef.current = { key, at: now }

      const existing = lines.find((l) => l.key === key)
      const current = existing?.qty ?? 0
      if (current >= max) return { ok: false, reason: 'stock-limit' }
      const nextQty = Math.min(max, current + qty)

      setLines((prev) => {
        const found = prev.find((l) => l.key === key)
        if (found) return prev.map((l) => (l.key === key ? { ...l, qty: nextQty } : l))
        return [...prev, { key, productId, colorId, size, qty: nextQty }]
      })
      setLastAddedKey(key)
      openPanel('cart')
      trackAddToCart({ productId, colorId, size, qty: nextQty - current, unitPrice: product.price })
      return { ok: true, key, qty: nextQty }
    },
    [lines, openPanel],
  )

  const setQty = useCallback(
    (key: string, qty: number) => {
      const max = maxQty(key)
      setLines((prev) => {
        if (qty <= 0) return prev.filter((l) => l.key !== key)
        return prev.map((l) => (l.key === key ? { ...l, qty: Math.min(max, Math.floor(qty)) } : l))
      })
    },
    [maxQty],
  )

  const increment = useCallback(
    (key: string) => {
      const max = maxQty(key)
      setLines((prev) => prev.map((l) => (l.key === key ? { ...l, qty: Math.min(max, l.qty + 1) } : l)))
    },
    [maxQty],
  )

  const decrement = useCallback((key: string) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, qty: Math.max(1, l.qty - 1) } : l)))
  }, [])

  const removeLine = useCallback((key: string) => setLines((prev) => prev.filter((l) => l.key !== key)), [])
  // Sipariş verildiğinde (clear) kupon da düşer.
  const clear = useCallback(() => {
    setLines([])
    setCoupon(null)
  }, [])

  const subtotalRef = useRef(0)
  const applyCoupon = useCallback(async (code: string) => {
    const result = await validateCouponApi(code.trim(), subtotalRef.current)
    if (result.ok) setCoupon(result.coupon)
    return result
  }, [])
  const removeCoupon = useCallback(() => setCoupon(null), [])

  const repriceLines = useCallback((updates: { productId: string; unitPrice: number }[]) => {
    for (const u of updates) applyKnownPrice(u.productId, u.unitPrice)
    setPriceVersion((v) => v + 1)
  }, [])

  const totals = useMemo(
    () => computeTotals({ lines, memberDiscountEligible: discountEligible, coupon }),
    // priceVersion: katalog fiyatları yerinde değiştiğinde yeniden hesap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lines, discountEligible, coupon, priceVersion],
  )
  useEffect(() => {
    subtotalRef.current = totals.subtotal
  }, [totals.subtotal])

  const value = useMemo<CartContextValue>(
    () => ({ lines, totals, coupon, applyCoupon, removeCoupon, repriceLines, addLine, setQty, increment, decrement, removeLine, clear, maxQty, lastAddedKey }),
    [lines, totals, coupon, applyCoupon, removeCoupon, repriceLines, addLine, setQty, increment, decrement, removeLine, clear, maxQty, lastAddedKey],
  )
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart, CartProvider içinde kullanılmalı')
  return ctx
}
