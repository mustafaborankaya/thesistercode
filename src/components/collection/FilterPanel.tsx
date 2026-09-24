import { useEffect, useState } from 'react'
import { allSizes, categories, colorOptions } from '../../data/catalog'
import type { CategoryId, CollectionFilters, SizeId } from '../../data/types'
import { useIsDesktop } from '../../hooks/useMediaQuery'
import { S } from '../../i18n'
import { emptyFilters } from '../../lib/catalog'
import { Button } from '../ui/Button'
import { Drawer } from '../ui/Drawer'
import styles from './CollectionView.module.css'

interface FilterPanelProps {
  open: boolean
  onClose: () => void
  /** Kategori filtresi yalnızca sanal görünümlerde (tüm ürünler / yeni gelenler) gösterilir. */
  categoryId: CategoryId
  /** URL'deki uygulanmış filtreler — panel her açılışta bunlardan taslak oluşturur. */
  filters: CollectionFilters
  onApply: (filters: CollectionFilters) => void
}

const realCategories = categories.filter((c) => !c.virtual)

/** Beden, renk, kategori ve fiyat filtreleri için taslak seçim paneli. Masaüstünde soldan, mobilde alttan açılır. */
export function FilterPanel({ open, onClose, categoryId, filters, onApply }: FilterPanelProps) {
  const isDesktop = useIsDesktop()
  const [draft, setDraft] = useState<CollectionFilters>(filters)

  // Panel her açıldığında taslağı URL'deki güncel filtrelerden yeniden kurar.
  useEffect(() => {
    if (!open) return
    setDraft(filters)
    // Bağımlılık dizisinde kasıtlı olarak yalnızca `open` var: taslak yalnızca panel açılışında
    // URL'deki güncel filtrelerden yeniden kurulmalı, filters her değiştiğinde değil.
  }, [open])

  const showCategoryFilter = categoryId === 'tum-urunler' || categoryId === 'yeni-gelenler'

  function toggleSize(size: SizeId) {
    setDraft((d) => ({ ...d, sizes: d.sizes.includes(size) ? d.sizes.filter((s) => s !== size) : [...d.sizes, size] }))
  }
  function toggleColor(colorId: string) {
    setDraft((d) => ({ ...d, colors: d.colors.includes(colorId) ? d.colors.filter((c) => c !== colorId) : [...d.colors, colorId] }))
  }
  function toggleCategory(id: CategoryId) {
    setDraft((d) => ({ ...d, categories: d.categories.includes(id) ? d.categories.filter((c) => c !== id) : [...d.categories, id] }))
  }

  function handleApply() {
    onApply({ ...draft, priceMin: null, priceMax: null })
  }
  function handleClear() {
    setDraft(emptyFilters)
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={S.collection.filters}
      side={isDesktop ? 'left' : 'bottom'}
      footer={
        <div className={styles.filterFooter}>
          <Button variant="secondary" onClick={handleClear}>
            {S.common.clear}
          </Button>
          <Button variant="primary" onClick={handleApply}>
            {S.common.apply}
          </Button>
        </div>
      }
    >
      <div className={styles.filterBody}>
        <fieldset className={styles.filterGroup}>
          <legend className={styles.filterLegend}>{S.collection.filterSize}</legend>
          <div className={styles.chipGroup}>
            {allSizes.map((size) => {
              const pressed = draft.sizes.includes(size)
              return (
                <button
                  key={size}
                  type="button"
                  className={[styles.toggleChip, pressed ? styles.toggleChipActive : ''].join(' ').trim()}
                  aria-pressed={pressed}
                  onClick={() => toggleSize(size)}
                >
                  {size}
                </button>
              )
            })}
          </div>
        </fieldset>

        <fieldset className={styles.filterGroup}>
          <legend className={styles.filterLegend}>{S.collection.filterColor}</legend>
          <div className={styles.chipGroup}>
            {colorOptions.map((color) => {
              const pressed = draft.colors.includes(color.id)
              return (
                <button
                  key={color.id}
                  type="button"
                  className={[styles.toggleChip, pressed ? styles.toggleChipActive : ''].join(' ').trim()}
                  aria-pressed={pressed}
                  onClick={() => toggleColor(color.id)}
                >
                  {color.label}
                </button>
              )
            })}
          </div>
        </fieldset>

        {showCategoryFilter ? (
          <fieldset className={styles.filterGroup}>
            <legend className={styles.filterLegend}>{S.collection.filterCategory}</legend>
            <div className={styles.chipGroup}>
              {realCategories.map((c) => {
                const pressed = draft.categories.includes(c.id)
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={[styles.toggleChip, pressed ? styles.toggleChipActive : ''].join(' ').trim()}
                    aria-pressed={pressed}
                    onClick={() => toggleCategory(c.id)}
                  >
                    {c.label}
                  </button>
                )
              })}
            </div>
          </fieldset>
        ) : null}
      </div>
    </Drawer>
  )
}
