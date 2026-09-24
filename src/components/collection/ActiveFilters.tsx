import { categories, colorOptions } from '../../data/catalog'
import type { CategoryId, CollectionFilters, SizeId } from '../../data/types'
import { S } from '../../i18n'
import { Icon } from '../ui/Icon'
import styles from './CollectionView.module.css'

interface ActiveFiltersProps {
  filters: CollectionFilters
  onRemoveSize: (size: SizeId) => void
  onRemoveColor: (colorId: string) => void
  onRemoveCategory: (categoryId: CategoryId) => void
  onClearAll: () => void
}

/** Etkin filtreleri tek tek kaldırılabilir çipler olarak gösterir; hiç filtre yoksa hiçbir şey render etmez. */
export function ActiveFilters({
  filters,
  onRemoveSize,
  onRemoveColor,
  onRemoveCategory,
  onClearAll,
}: ActiveFiltersProps) {
  const chips: { key: string; label: string; onRemove: () => void }[] = []

  for (const size of filters.sizes) {
    chips.push({ key: `size-${size}`, label: size, onRemove: () => onRemoveSize(size) })
  }
  for (const colorId of filters.colors) {
    const label = colorOptions.find((c) => c.id === colorId)?.label ?? colorId
    chips.push({ key: `color-${colorId}`, label, onRemove: () => onRemoveColor(colorId) })
  }
  for (const categoryId of filters.categories) {
    const label = categories.find((c) => c.id === categoryId)?.label ?? categoryId
    chips.push({ key: `category-${categoryId}`, label, onRemove: () => onRemoveCategory(categoryId) })
  }

  if (chips.length === 0) return null

  return (
    <div className={styles.activeFilters} aria-label={S.collection.activeFilters}>
      <ul className={styles.chipsList}>
        {chips.map((chip) => (
          <li key={chip.key}>
            <button
              type="button"
              className={styles.removableChip}
              onClick={chip.onRemove}
              aria-label={S.collection.removeFilter(chip.label)}
            >
              <span>{chip.label}</span>
              <Icon name="close" size={12} />
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className={styles.clearAllBtn} onClick={onClearAll}>
        {S.common.clearAll}
      </button>
    </div>
  )
}
