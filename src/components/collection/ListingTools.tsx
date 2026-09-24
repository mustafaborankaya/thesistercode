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
}

/** Solda filtre butonu, ortada sonuç sayısı, sağda native sıralama seçimi. */
export function ListingTools({ activeCount, onOpenFilters, sort, onSortChange, resultCount }: ListingToolsProps) {
  return (
    <div className={styles.tools}>
      <button
        type="button"
        className={styles.filterBtn}
        onClick={onOpenFilters}
        aria-haspopup="dialog"
      >
        <Icon name="filter" size={16} />
        <span>
          {S.collection.filters}
          {activeCount > 0 ? ` (${activeCount})` : ''}
        </span>
      </button>

      <p className={styles.resultCount} aria-live="polite">
        {S.collection.resultCount(resultCount)}
      </p>

      <div className={styles.sortWrap}>
        <label htmlFor="collection-sort" className={styles.sortLabel}>
          {S.collection.sortLabel}
        </label>
        <select
          id="collection-sort"
          className={styles.sortSelect}
          value={sort}
          onChange={(e) => onSortChange(e.target.value as SortId)}
        >
          {(Object.entries(S.collection.sortOptions) as [SortId, string][]).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
