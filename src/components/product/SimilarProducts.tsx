import type { Product } from '../../data/types'
import { S } from '../../i18n'
import { getSimilar } from '../../lib/recommendations'
import { ProductCard } from './ProductCard'
import styles from './SimilarProducts.module.css'

interface SimilarProductsProps {
  product: Product
  /** Genelde aynı ürünün "Kombini Tamamla" listesindeki id'ler — iki bölümde aynı ürün gösterilmez. */
  exclude?: string[]
}

/** "Benzer Ürünler" — bilgi sütununun altında iki sütunlu kompakt kartlar. */
export function SimilarProducts({ product, exclude = [] }: SimilarProductsProps) {
  const items = getSimilar(product, 4, exclude)
  if (items.length === 0) return null

  return (
    <section className={styles.section}>
      <h2 className={styles.title}>{S.product.similar}</h2>
      <ul className={styles.grid}>
        {items.map((item) => (
          <li key={item.id}>
            <ProductCard product={item} />
          </li>
        ))}
      </ul>
    </section>
  )
}
