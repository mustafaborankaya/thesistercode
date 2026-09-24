/**
 * Ürün detay sayfası varyant seçim mantığı.
 * Tek bir örneği ProductPage içinde oluşturulur ve bilgi sütunu ile MobileBuyBar arasında
 * paylaşılır — iki farklı "Sepete Ekle" tetikleyicisi aynı durumu görür.
 */
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { variantStock } from '../../lib/cart'
import type { Product, SizeId } from '../../data/types'
import { useCart } from '../../state/CartContext'

export type VariantError = 'size-required' | 'sold-out' | 'stock-limit' | null

interface UseVariantSelectionResult {
  colorId: string
  size: SizeId | null
  error: VariantError
  pending: boolean
  added: boolean
  /** Seçili beden stoğu ≤ 2 ise adet; aksi hâlde null. */
  lowStock: number | null
  stockForSize: (size: SizeId) => number
  setColor: (colorId: string) => void
  setSize: (size: SizeId) => void
  /** "Sepete Ekle" tetikleyicisi — hem bilgi sütunundaki buton hem MobileBuyBar bunu çağırır. */
  submit: () => void
  /** Beden butonlarını saran öğe — hata sonrası odak ve mobilde kaydırma hedefi için. */
  sizeGroupRef: RefObject<HTMLDivElement | null>
}

const ADDED_VISIBLE_MS = 2000
const PENDING_MS = 600

export function useVariantSelection(product: Product): UseVariantSelectionResult {
  const { addLine } = useCart()
  const [colorId, setColorIdState] = useState(product.colors[0]?.id ?? '')
  const [size, setSizeState] = useState<SizeId | null>(null)
  const [error, setError] = useState<VariantError>(null)
  const [pending, setPending] = useState(false)
  const [added, setAdded] = useState(false)
  const sizeGroupRef = useRef<HTMLDivElement>(null)
  const pendingTimer = useRef<number | null>(null)
  const addedTimer = useRef<number | null>(null)

  // Farklı bir ürüne geçilince seçimleri sıfırla.
  useEffect(() => {
    setColorIdState(product.colors[0]?.id ?? '')
    setSizeState(null)
    setError(null)
    setAdded(false)
    setPending(false)
  }, [product.id, product.colors])

  const stockForSize = useCallback((s: SizeId) => variantStock(product, colorId, s), [product, colorId])

  const setColor = useCallback((id: string) => {
    setColorIdState(id)
    setError(null)
  }, [])

  // Renk değişince seçili beden o renkte tükendiyse sıfırla.
  useEffect(() => {
    setSizeState((current) => (current && variantStock(product, colorId, current) <= 0 ? null : current))
  }, [colorId, product])

  const setSize = useCallback((s: SizeId) => {
    setSizeState(s)
    setError(null)
  }, [])

  // Beden zorunlu hatası çıkınca ilk seçilebilir beden butonuna odak.
  useEffect(() => {
    if (error === 'size-required') {
      sizeGroupRef.current?.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus()
    }
  }, [error])

  useEffect(
    () => () => {
      if (pendingTimer.current) window.clearTimeout(pendingTimer.current)
      if (addedTimer.current) window.clearTimeout(addedTimer.current)
    },
    [],
  )

  const submit = useCallback(() => {
    if (!size) {
      setError('size-required')
      return
    }
    setError(null)
    setPending(true)
    // CartContext.addLine başarılı olunca sepet panelini kendisi açar; burada tekrar açılmaz/kapatılmaz.
    const result = addLine(product.id, colorId, size)
    if (!result.ok) {
      if (result.reason === 'stock-limit') setError('stock-limit')
      else if (result.reason === 'sold-out' || result.reason === 'invalid') setError('sold-out')
      // 'duplicate-click' → sessizce yoksay (pending penceresi zaten hızlı çift tıklamayı engeller).
    } else {
      setAdded(true)
      if (addedTimer.current) window.clearTimeout(addedTimer.current)
      addedTimer.current = window.setTimeout(() => setAdded(false), ADDED_VISIBLE_MS)
    }
    if (pendingTimer.current) window.clearTimeout(pendingTimer.current)
    pendingTimer.current = window.setTimeout(() => setPending(false), PENDING_MS)
  }, [size, colorId, product.id, addLine])

  const currentStock = size ? stockForSize(size) : null
  const lowStock = currentStock != null && currentStock > 0 && currentStock <= 2 ? currentStock : null

  return { colorId, size, error, pending, added, lowStock, stockForSize, setColor, setSize, submit, sizeGroupRef }
}
