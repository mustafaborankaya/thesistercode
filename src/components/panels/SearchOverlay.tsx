import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { S } from '../../i18n'
import { searchProducts } from '../../lib/catalog'
import { usePanels } from '../../state/PanelContext'
import { ProductGrid } from '../product/ProductCard'
import { Button } from '../ui/Button'
import { Drawer } from '../ui/Drawer'
import { Icon } from '../ui/Icon'
import styles from './SearchOverlay.module.css'

const PREVIEW_LIMIT = 8

/** Üstten açılan hızlı arama paneli: yazarken anlık sonuç önizlemesi, Enter/"Tüm sonuçları gör" ile /arama sayfasına geçer. */
export function SearchOverlay() {
  const { isOpen, closePanel } = usePanels()
  const navigate = useNavigate()
  const open = isOpen('search')
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Drawer kendi odak tuzağını (kapatma butonuna) kurduktan hemen sonra odağı arama alanına taşı.
  useEffect(() => {
    if (!open) return
    const raf = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(raf)
  }, [open])

  // Panel her kapandığında bir sonraki açılış için sorguyu sıfırla.
  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  const trimmed = query.trim()
  const allResults = useMemo(() => (trimmed ? searchProducts(trimmed) : []), [trimmed])
  const preview = allResults.slice(0, PREVIEW_LIMIT)

  function goToResults(q: string) {
    closePanel('search')
    navigate(`/arama?q=${encodeURIComponent(q)}`)
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (trimmed) goToResults(trimmed)
  }

  return (
    <Drawer open={open} onClose={() => closePanel('search')} title={S.search.title} side="top" hideTitle>
      <form role="search" className={styles.form} onSubmit={handleSubmit}>
        <label htmlFor="search-overlay-input" className="sr-only">
          {S.search.label}
        </label>
        <div className={styles.inputRow}>
          <Icon name="search" size={18} />
          <input
            ref={inputRef}
            id="search-overlay-input"
            type="search"
            className={styles.input}
            placeholder={S.search.placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </form>

      {trimmed ? (
        <div>
          <p className={styles.count} aria-live="polite">
            {S.search.resultCount(allResults.length)}
          </p>
          {preview.length > 0 ? (
            <>
              <ProductGrid products={preview} className={styles.grid} />
              <div className={styles.seeAllRow}>
                <Button variant="secondary" onClick={() => goToResults(trimmed)}>
                  {S.search.seeAll}
                </Button>
              </div>
            </>
          ) : (
            <div className={styles.empty}>
              <p>{S.search.noResults}</p>
              <p className="text-soft">{S.search.noResultsHint}</p>
            </div>
          )}
        </div>
      ) : (
        <p className={[styles.hint, 'text-soft'].join(' ')}>{S.search.recentless}</p>
      )}
    </Drawer>
  )
}
