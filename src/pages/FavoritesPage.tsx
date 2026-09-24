import { ProductGrid } from '../components/product/ProductCard'
import { Button } from '../components/ui/Button'
import { productById } from '../data/catalog'
import { S } from '../i18n'
import { useFavorites } from '../state/FavoritesContext'
import styles from './Page.module.css'

export function FavoritesPage() {
  const { ids } = useFavorites()
  const products = ids.map((id) => productById[id]).filter((p) => p != null)

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>
        {S.favorites.title}
        {products.length > 0 ? <span className="text-soft"> — {S.favorites.count(products.length)}</span> : null}
      </h1>

      <ProductGrid
        products={products}
        empty={
          <div style={{ textAlign: 'center', padding: 'var(--sp-16) 0' }}>
            <p>{S.favorites.empty}</p>
            <p className="text-soft" style={{ marginBottom: 'var(--sp-6)' }}>
              {S.favorites.emptyHint}
            </p>
            <Button variant="secondary" to="/koleksiyon">
              {S.common.continueShopping}
            </Button>
          </div>
        }
      />
    </div>
  )
}
