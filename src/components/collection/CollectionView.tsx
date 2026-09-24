import { useEffect, useMemo, useRef } from 'react'
import { useLocation, useNavigationType, useSearchParams } from 'react-router-dom'
import { siteSettings } from '../../config/settings'
import { categories } from '../../data/catalog'
import { brandContent } from '../../data/content'
import type { CategoryId, CollectionFilters, SizeId, SortId } from '../../data/types'
import { S } from '../../i18n'
import { activeFilterCount, emptyFilters, getCollection } from '../../lib/catalog'
import { ProductGrid } from '../product/ProductCard'
import { Button } from '../ui/Button'
import { ActiveFilters } from './ActiveFilters'
import { CategoryStrip } from './CategoryStrip'
import styles from './CollectionView.module.css'
import {
  filtersFromSearchParams,
  readScrollPosition,
  saveScrollPosition,
  shownFromSearchParams,
  sortFromSearchParams,
  writeFiltersToParams,
  writeShownToParams,
  writeSortToParams,
} from './collectionState'
import { FilterPanel } from './FilterPanel'
import { ListingTools } from './ListingTools'
import { usePanels } from '../../state/PanelContext'

interface CollectionViewProps {
  categoryId?: CategoryId
}

/** Ana sayfa ve /koleksiyon/:categoryId tarafından paylaşılan koleksiyon görünümü: başlık, kategori şeridi,
 * listeleme araçları, etkin filtreler, ürün ızgarası ve filtre paneli. Durum URL search param'larında tutulur. */
export function CollectionView({ categoryId = 'tum-urunler' }: CollectionViewProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const navigationType = useNavigationType()
  const { isOpen, openPanel, closePanel } = usePanels()

  const filters = useMemo(() => filtersFromSearchParams(searchParams), [searchParams])
  const sort = useMemo(() => sortFromSearchParams(searchParams), [searchParams])
  const shown = useMemo(() => shownFromSearchParams(searchParams), [searchParams])

  const all = useMemo(() => getCollection(categoryId, filters, sort), [categoryId, filters, sort])
  const visible = all.slice(0, shown)
  const activeCount = activeFilterCount(filters)

  const categoryLabel = categoryId !== 'tum-urunler' ? categories.find((c) => c.id === categoryId)?.label ?? null : null

  /* ---- Kaydırma konumu ---- */

  useEffect(() => {
    window.history.scrollRestoration = 'manual'
  }, [])

  // Her zaman güncel konum bilgisini tutar; unmount cleanup'ı bunu okuyarak son bilinen anahtarı yazar.
  const locationRef = useRef({ pathname: location.pathname, search: location.search })
  useEffect(() => {
    locationRef.current = { pathname: location.pathname, search: location.search }
  })
  useEffect(() => {
    return () => {
      const { pathname, search } = locationRef.current
      saveScrollPosition(pathname + search, window.scrollY)
    }
  }, [])

  // Yalnızca mount'ta: geri gezinme (POP) ve anahtar eşleşiyorsa kaydedilmiş konuma dön.
  useEffect(() => {
    if (navigationType !== 'POP') return
    const key = location.pathname + location.search
    const y = readScrollPosition(key)
    if (y == null) return
    const raf = requestAnimationFrame(() => window.scrollTo(0, y))
    return () => cancelAnimationFrame(raf)
    // Bağımlılık dizisi kasıtlı olarak boş: bu yalnızca mount'ta bir kez çalışmalı.
  }, [])

  /* ---- URL güncellemeleri ---- */

  function updateFilters(next: CollectionFilters) {
    setSearchParams(writeFiltersToParams(searchParams, next), { replace: false })
  }
  function updateSort(next: SortId) {
    setSearchParams(writeSortToParams(searchParams, next), { replace: false })
  }
  function showMore() {
    setSearchParams(writeShownToParams(searchParams, shown + siteSettings.catalog.pageSize), { replace: true })
  }
  function clearAll() {
    updateFilters(emptyFilters)
  }
  function removeSize(size: SizeId) {
    updateFilters({ ...filters, sizes: filters.sizes.filter((s) => s !== size) })
  }
  function removeColor(colorId: string) {
    updateFilters({ ...filters, colors: filters.colors.filter((c) => c !== colorId) })
  }
  function removeCategory(id: CategoryId) {
    updateFilters({ ...filters, categories: filters.categories.filter((c) => c !== id) })
  }

  return (
    <section className={styles.wrap}>
      <header className={styles.head}>
        <h1 className={styles.heading}>{brandContent.collectionTitle.value ?? S.collection.title}</h1>
        {categoryLabel ? <p className={styles.categoryLabel}>{categoryLabel}</p> : null}
      </header>

      <CategoryStrip activeId={categoryId} />

      <ListingTools
        activeCount={activeCount}
        onOpenFilters={() => openPanel('filters')}
        sort={sort}
        onSortChange={updateSort}
        resultCount={all.length}
      />

      <ActiveFilters
        filters={filters}
        onRemoveSize={removeSize}
        onRemoveColor={removeColor}
        onRemoveCategory={removeCategory}
        onClearAll={clearAll}
      />

      {all.length === 0 ? (
        <div className={styles.emptyState}>
          <p>{S.collection.empty}</p>
          <p className="text-soft">{S.collection.emptyHint}</p>
          <Button variant="secondary" onClick={clearAll}>
            {S.common.clearAll}
          </Button>
        </div>
      ) : (
        <>
          <ProductGrid products={visible} />
          <div className={styles.footerRow}>
            {shown < all.length ? (
              <Button variant="secondary" onClick={showMore}>
                {S.common.showMore}
              </Button>
            ) : null}
            <p className={styles.showingOf}>{S.collection.showingOf(visible.length, all.length)}</p>
          </div>
        </>
      )}

      <FilterPanel
        open={isOpen('filters')}
        onClose={() => closePanel('filters')}
        categoryId={categoryId}
        filters={filters}
        onApply={(next) => {
          updateFilters(next)
          closePanel('filters')
        }}
      />
    </section>
  )
}
