import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Product, SizeId } from '../../data/types'
import { S } from '../../i18n'
import { variantStock } from '../../lib/cart'
import { getCompleteLook } from '../../lib/recommendations'
import { useCart } from '../../state/CartContext'
import { Button } from '../ui/Button'
import { MediaSlot } from '../ui/MediaSlot'
import { Price } from '../ui/Price'
import styles from './CompleteLook.module.css'

interface CompleteLookProps {
  product: Product
}

/**
 * "Kombini Tamamla" — incelenen ürünle birlikte önerilen tamamlayıcı parçalar.
 * NOT: max=3 burada ve ProductPage'deki `getCompleteLook(product, 3)` çağrısıyla aynı olmalı;
 * ikisi ayrışırsa bir ürün hem burada hem "Benzer Ürünler"de görünebilir (bkz. ek prompt §1).
 */
export function CompleteLook({ product }: CompleteLookProps) {
  const items = getCompleteLook(product, 3)
  if (items.length === 0) return null

  return (
    <section className={styles.section}>
      <h2 className={styles.title}>{S.product.completeLook}</h2>
      <ul className={styles.list}>
        {items.map((item) => (
          <CompleteLookRow key={item.id} product={item} />
        ))}
      </ul>
    </section>
  )
}

type RowError = 'color-required' | 'size-required' | 'stock-limit' | 'sold-out' | null

const PENDING_MS = 600
const ADDED_VISIBLE_MS = 2000

function CompleteLookRow({ product }: { product: Product }) {
  const { addLine } = useCart()
  const hasMultipleColors = product.colors.length > 1
  const [colorId, setColorId] = useState<string | null>(hasMultipleColors ? null : (product.colors[0]?.id ?? null))
  const [size, setSize] = useState<SizeId | null>(null)
  const [error, setError] = useState<RowError>(null)
  const [pending, setPending] = useState(false)
  const [added, setAdded] = useState(false)
  const colorGroupRef = useRef<HTMLDivElement>(null)
  const sizeGroupRef = useRef<HTMLDivElement>(null)
  const pendingTimer = useRef<number | null>(null)
  const addedTimer = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (pendingTimer.current) window.clearTimeout(pendingTimer.current)
      if (addedTimer.current) window.clearTimeout(addedTimer.current)
    },
    [],
  )

  useEffect(() => {
    if (error === 'color-required') {
      colorGroupRef.current?.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus()
    } else if (error === 'size-required') {
      sizeGroupRef.current?.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus()
    }
  }, [error])

  const handleColorChange = useCallback(
    (id: string) => {
      setColorId(id)
      setError(null)
      // Renk değişince geçersiz kalan beden seçimini temizle.
      setSize((current) => (current && variantStock(product, id, current) <= 0 ? null : current))
    },
    [product],
  )

  const handleSizeChange = useCallback((s: SizeId) => {
    setSize(s)
    setError(null)
  }, [])

  const submit = useCallback(() => {
    if (hasMultipleColors && !colorId) {
      setError('color-required')
      return
    }
    if (!size) {
      setError('size-required')
      return
    }
    if (!colorId) {
      // Ürünün tanımlı rengi yoksa (beklenmeyen veri durumu) eklenemez.
      setError('sold-out')
      return
    }
    setError(null)
    setPending(true)
    const result = addLine(product.id, colorId, size)
    if (!result.ok) {
      if (result.reason === 'stock-limit') setError('stock-limit')
      else if (result.reason === 'sold-out' || result.reason === 'invalid') setError('sold-out')
      // 'duplicate-click' → sessizce yoksay.
    } else {
      setAdded(true)
      if (addedTimer.current) window.clearTimeout(addedTimer.current)
      addedTimer.current = window.setTimeout(() => setAdded(false), ADDED_VISIBLE_MS)
    }
    if (pendingTimer.current) window.clearTimeout(pendingTimer.current)
    pendingTimer.current = window.setTimeout(() => setPending(false), PENDING_MS)
  }, [hasMultipleColors, colorId, size, product.id, addLine])

  const to = `/urun/${product.slug}`
  const front = product.media[0]
  const singleColor = !hasMultipleColors ? product.colors[0] : undefined

  return (
    <li className={styles.row}>
      <Link to={to} className={styles.rowMedia} aria-label={product.name} tabIndex={-1}>
        <MediaSlot label={front.label} src={front.src} ratio="3 / 4" captionSize="sm" />
      </Link>
      <div className={styles.rowBody}>
        <Link to={to} className={styles.rowName}>
          {product.name}
        </Link>
        <Price amount={product.price} className={styles.rowPrice} />

        {singleColor ? (
          <p className={styles.colorLabel}>{singleColor.label}</p>
        ) : (
          <div ref={colorGroupRef} className={styles.colorRow} role="group" aria-label={S.product.color}>
            {product.colors.map((c) => {
              const active = c.id === colorId
              return (
                <button
                  key={c.id}
                  type="button"
                  className={[styles.chip, active ? styles.chipActive : ''].join(' ').trim()}
                  aria-pressed={active}
                  onClick={() => handleColorChange(c.id)}
                >
                  {c.label}
                </button>
              )
            })}
          </div>
        )}

        <div ref={sizeGroupRef} className={styles.sizeRow} role="group" aria-label={S.product.size}>
          {product.sizes.map((s) => {
            const soldOut = colorId ? variantStock(product, colorId, s) <= 0 : false
            const active = size === s
            return (
              <button
                key={s}
                type="button"
                className={[styles.chip, styles.sizeChip, active ? styles.chipActive : '', soldOut ? styles.chipSoldOut : ''].join(' ').trim()}
                aria-pressed={active}
                aria-disabled={soldOut || undefined}
                disabled={soldOut}
                onClick={() => handleSizeChange(s)}
              >
                {s}
                {soldOut ? <span className="sr-only"> — {S.product.soldOutSize(s)}</span> : null}
              </button>
            )
          })}
        </div>

        <Button
          variant="secondary"
          small
          onClick={submit}
          disabled={pending}
          aria-busy={pending}
          aria-label={S.product.addToCartFor(product.name)}
        >
          {S.product.addToCart}
        </Button>

        {error ? (
          <p role="alert" className={styles.rowError}>
            {error === 'color-required'
              ? S.product.colorRequired
              : error === 'size-required'
                ? S.product.sizeRequired
                : error === 'stock-limit'
                  ? S.product.stockLimit
                  : S.product.soldOut}
          </p>
        ) : added ? (
          <p aria-live="polite" className={styles.rowOk}>
            {S.product.added}
          </p>
        ) : null}
      </div>
    </li>
  )
}
