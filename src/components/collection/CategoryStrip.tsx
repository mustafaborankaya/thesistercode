import { Link } from 'react-router-dom'
import { categories } from '../../data/catalog'
import type { CategoryId } from '../../data/types'
import { S } from '../../i18n'
import styles from './CollectionView.module.css'

interface CategoryStripProps {
  /** Etkin kategori — ana sayfada 'tum-urunler' geçirilerek "Tüm Ürünler" de seçili gösterilir. */
  activeId: CategoryId
}

/** Yatay kaydırılabilir kategori şeridi. Mobilde overflow-x: auto ile kaydırılır, kaydırma çubuğu gizlenir. */
export function CategoryStrip({ activeId }: CategoryStripProps) {
  return (
    <nav aria-label={S.collection.categoryStripLabel} className={styles.stripWrap}>
      <ul className={styles.strip}>
        {categories.map((c) => {
          const active = c.id === activeId
          return (
            <li key={c.id}>
              <Link
                to={`/koleksiyon/${c.id}`}
                className={[styles.chip, active ? styles.chipActive : ''].join(' ').trim()}
                aria-current={active ? 'page' : undefined}
              >
                {c.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
