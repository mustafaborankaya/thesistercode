import type { SortId } from '../../data/types'
import { S } from '../../i18n'
import { Icon } from '../ui/Icon'
import styles from './CollectionView.module.css'

interface ListingToolsProps {
  activeCount: number
  onOpenFilters: () => void
  sort: SortId
  onSortChange: (sort: SortId) => void
  resultCount: number
  columns: number
  canFewer: boolean
  canMore: boolean
  onFewer: () => void
  onMore: () => void
}

/** Solda yalnızca "Filtreler" metni; sağda ürün sayısı, çerçevesiz sıralama seçimi ve −/+ sütun düğmeleri. */
export function ListingTools({ activeCount, onOpenFilters, sort, onSortChange, resultCount, columns, canFewer, canMore, onFewer, onMore }: ListingToolsProps) {
  return (
    <div className={styles.tools}>
      <button type="button" className={styles.filterBtn} onClick={onOpenFilters} aria-haspopup="dialog">
        {S.collection.filters}
        {activeCount > 0 ? ` (${activeCount})` : ''}
      </button>

      <div className={styles.toolsRight}>
        <p className={styles.resultCount} aria-live="polite">
          {S.collection.resultCount(resultCount)}
        </p>
        <label htmlFor="collection-sort" className="sr-only">
          {S.collection.sortLabel}
        </label>
        <select id="collection-sort" className={styles.sortSelect} value={sort} onChange={(e) => onSortChange(e.target.value as SortId)}>
          {(Object.entries(S.collection.sortOptions) as [SortId, string][]).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
        <div className={styles.cols} role="group" aria-label={S.collection.columnsNow(columns)}>
          <button type="button" className={styles.colBtn} onClick={onFewer} disabled={!canFewer} aria-label={S.collection.columnsFewer}>
            <Icon name="minus" size={14} />
          </button>
          <button type="button" className={styles.colBtn} onClick={onMore} disabled={!canMore} aria-label={S.collection.columnsMore}>
            <Icon name="plus" size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
