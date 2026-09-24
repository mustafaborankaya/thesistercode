import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { siteSettings } from '../../config/settings'
import type { MediaKind, Product, SizeId } from '../../data/types'
import { useReducedMotion } from '../../hooks/useMediaQuery'
import { S } from '../../i18n'
import { variantStock } from '../../lib/cart'
import { useCart } from '../../state/CartContext'
import { useFavorites } from '../../state/FavoritesContext'
import { Icon } from '../ui/Icon'
import { MediaSlot } from '../ui/MediaSlot'
import { Price } from '../ui/Price'
import styles from './ProductCard.module.css'

/** Kart carousel'inde gösterilen görünüşler (kumaş yakın çekimi yalnızca ürün sayfasında). */
const CARD_KINDS: MediaKind[] = ['front', 'back', 'model']

interface ProductCardProps {
  product: Product
  /** Listeye geri dönüşte durumu korumak için bağlantı state'i. */
  linkState?: unknown
}

/** Bir beden tüm renklerde tükendiyse (tek renkte: o renkte) true. */
function sizeSoldOut(product: Product, size: SizeId): boolean {
  return product.colors.every((c) => variantStock(product, c.id, size) <= 0)
}

/**
 * Liste kartı: çerçevesiz görsel carousel'i (dokunmatikte yatay kaydırma + snap, masaüstünde üzerine gelince
 * ince oklar, altta nokta göstergesi), hızlı beden şeridi (masaüstünde hover'da; her cihazda çanta ikonuyla
 * açılır). Bedene tıklanınca tek renkli üründe doğrudan sepete eklenir, çok renklide ürün sayfasına
 * `?beden=` ön seçimiyle gidilir. Görsele tıklama ürün sayfasını açar.
 */
export function ProductCard({ product, linkState }: ProductCardProps) {
  const { has, toggle } = useFavorites()
  const { addLine } = useCart()
  const navigate = useNavigate()
  const reducedMotion = useReducedMotion()
  const fav = has(product.id)
  const to = `/urun/${product.slug}`
  const stripId = useId()

  const ordered = CARD_KINDS.map((k) => product.media.find((m) => m.kind === k)).filter((m) => m != null)
  const slides = ordered.length > 0 ? ordered : product.media.slice(0, 1)
  const multi = slides.length > 1

  const cardRef = useRef<HTMLElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const bagRef = useRef<HTMLButtonElement>(null)
  const ticking = useRef(false)
  const [index, setIndex] = useState(0)
  const [stripOpen, setStripOpen] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  // Şerit açıkken: dışarı tıklama ve Escape kapatır (Escape odağı çanta düğmesine geri verir).
  useEffect(() => {
    if (!stripOpen) return
    const onPointer = (e: PointerEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) setStripOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setStripOpen(false)
        bagRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [stripOpen])

  useEffect(() => {
    if (!message) return
    const t = window.setTimeout(() => setMessage(null), 2600)
    return () => window.clearTimeout(t)
  }, [message])

  const onScroll = () => {
    if (ticking.current) return
    ticking.current = true
    requestAnimationFrame(() => {
      const el = trackRef.current
      if (el && el.clientWidth > 0) setIndex(Math.min(slides.length - 1, Math.max(0, Math.round(el.scrollLeft / el.clientWidth))))
      ticking.current = false
    })
  }

  const goTo = (i: number) => {
    const el = trackRef.current
    if (!el) return
    const next = Math.min(slides.length - 1, Math.max(0, i))
    el.scrollTo({ left: next * el.clientWidth, behavior: reducedMotion ? 'auto' : 'smooth' })
  }

  const pickSize = (size: SizeId) => {
    if (sizeSoldOut(product, size)) return
    if (product.colors.length > 1) {
      navigate(`${to}?beden=${encodeURIComponent(size)}`, { state: linkState })
      return
    }
    const colorId = product.colors[0]?.id
    if (!colorId) return
    const result = addLine(product.id, colorId, size)
    if (result.ok) {
      setStripOpen(false)
      setMessage(null)
    } else if (result.reason === 'stock-limit') setMessage(S.product.stockLimit)
    else if (result.reason !== 'duplicate-click') setMessage(S.product.soldOut)
  }

  return (
    <article ref={cardRef} className={styles.card} data-product-id={product.id} data-strip-open={stripOpen ? 'true' : undefined}>
      <div className={styles.mediaWrap}>
        <Link to={to} state={linkState} className={styles.media} aria-label={product.name} tabIndex={-1}>
          <div ref={trackRef} className={styles.track} onScroll={multi ? onScroll : undefined} data-card-track>
            {slides.map((m) => (
              <div key={m.kind} className={styles.slide}>
                <MediaSlot label={m.label} src={m.src} ratio={siteSettings.catalog.mediaRatio} captionSize="sm" />
              </div>
            ))}
          </div>
        </Link>

        {product.isNew ? <span className={styles.badge}>{S.collection.newBadge}</span> : null}

        <button
          type="button"
          className={styles.fav}
          data-active={fav ? 'true' : undefined}
          aria-pressed={fav}
          aria-label={`${fav ? S.collection.removeFromFavorites : S.collection.addToFavorites} — ${product.name}`}
          onClick={() => toggle(product.id)}
        >
          <Icon name={fav ? 'heart-filled' : 'heart'} size={16} />
        </button>

        {multi ? (
          <>
            <button type="button" className={[styles.arrow, styles.arrowPrev].join(' ')} tabIndex={-1} aria-hidden="true" disabled={index === 0} onClick={() => goTo(index - 1)}>
              <Icon name="chevron-left" size={18} />
            </button>
            <button type="button" className={[styles.arrow, styles.arrowNext].join(' ')} tabIndex={-1} aria-hidden="true" disabled={index === slides.length - 1} onClick={() => goTo(index + 1)}>
              <Icon name="chevron-right" size={18} />
            </button>
            <div className={styles.dots} aria-hidden="true">
              {slides.map((m, i) => (
                <span key={m.kind} className={[styles.dot, i === index ? styles.dotActive : ''].join(' ').trim()} />
              ))}
            </div>
          </>
        ) : null}

        <div id={stripId} className={styles.sizes} role="group" aria-label={`${S.collection.quickSizes} — ${product.name}`}>
          {product.sizes.map((size) => {
            const out = sizeSoldOut(product, size)
            return (
              <button
                key={size}
                type="button"
                className={styles.size}
                disabled={out}
                aria-label={out ? `${product.name}, ${S.product.soldOutSize(size)}` : product.colors.length > 1 ? S.collection.pickSize(product.name, size) : S.collection.addSize(product.name, size)}
                onClick={() => pickSize(size)}
              >
                {size}
              </button>
            )
          })}
        </div>
      </div>

      <div className={styles.infoRow}>
        <div className={styles.info}>
          <Link to={to} state={linkState} className={styles.name}>
            {product.name}
          </Link>
          <Price amount={product.price} className={styles.price} />
          {product.colorNote ? <span className={styles.note}>{product.colorNote}</span> : null}
          <span className={styles.message} role="status">
            {message}
          </span>
        </div>
        <button
          ref={bagRef}
          type="button"
          className={styles.bag}
          aria-expanded={stripOpen}
          aria-controls={stripId}
          aria-label={S.collection.quickAdd(product.name)}
          onClick={() => setStripOpen((v) => !v)}
        >
          <Icon name="bag" size={18} />
        </button>
      </div>
    </article>
  )
}

interface ProductGridProps {
  products: Product[]
  linkState?: unknown
  /** Boş durum içeriği. */
  empty?: ReactNode
  className?: string
  /** Kullanıcının seçtiği sütun sayısı (koleksiyon sayfası −/+); verilmezse kırılım varsayılanları. */
  columns?: number
}

export function ProductGrid({ products, linkState, empty, className, columns }: ProductGridProps) {
  if (products.length === 0 && empty) return <>{empty}</>
  return (
    <ul
      className={[styles.grid, columns ? styles.gridCols : '', className ?? ''].join(' ').trim()}
      style={columns ? ({ '--cols': columns } as CSSProperties) : undefined}
      data-cols={columns}
    >
      {products.map((p) => (
        <li key={p.id}>
          <ProductCard product={p} linkState={linkState} />
        </li>
      ))}
    </ul>
  )
}
