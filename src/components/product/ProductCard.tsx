import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { siteSettings } from '../../config/settings'
import type { Product } from '../../data/types'
import { S } from '../../i18n'
import { useFavorites } from '../../state/FavoritesContext'
import { Icon } from '../ui/Icon'
import { MediaSlot } from '../ui/MediaSlot'
import { Price } from '../ui/Price'
import styles from './ProductCard.module.css'

interface ProductCardProps {
  product: Product
  /** Listeye geri dönüşte durumu korumak için bağlantı state'i. */
  linkState?: unknown
}

export function ProductCard({ product, linkState }: ProductCardProps) {
  const { has, toggle } = useFavorites()
  const fav = has(product.id)
  const front = product.media.find((m) => m.kind === 'front') ?? product.media[0]
  const back = product.media.find((m) => m.kind === 'back')
  const to = `/urun/${product.slug}`

  return (
    <article className={styles.card} data-product-id={product.id}>
      <Link to={to} state={linkState} className={styles.media} aria-label={product.name} tabIndex={-1}>
        <MediaSlot label={front.label} src={front.src} ratio={siteSettings.catalog.mediaRatio} captionSize="sm" />
        {back ? <MediaSlot label={back.label} src={back.src} ratio={siteSettings.catalog.mediaRatio} captionSize="sm" className={styles.back} /> : null}
        {product.isNew ? <span className={styles.badge}>{S.collection.newBadge}</span> : null}
      </Link>
      <button
        type="button"
        className={styles.fav}
        aria-pressed={fav}
        aria-label={`${fav ? S.collection.removeFromFavorites : S.collection.addToFavorites} — ${product.name}`}
        onClick={() => toggle(product.id)}
      >
        <Icon name={fav ? 'heart-filled' : 'heart'} size={18} />
      </button>
      <div className={styles.info}>
        <Link to={to} state={linkState} className={styles.name}>
          {product.name}
        </Link>
        <Price amount={product.price} className={styles.price} />
        {product.colorNote ? <span className={styles.note}>{product.colorNote}</span> : null}
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
}

export function ProductGrid({ products, linkState, empty, className }: ProductGridProps) {
  if (products.length === 0 && empty) return <>{empty}</>
  return (
    <ul className={[styles.grid, className ?? ''].join(' ').trim()}>
      {products.map((p) => (
        <li key={p.id}>
          <ProductCard product={p} linkState={linkState} />
        </li>
      ))}
    </ul>
  )
}
