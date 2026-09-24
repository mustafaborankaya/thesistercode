import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { siteSettings } from '../../config/settings'
import { products } from '../../data/catalog'
import { brandContent } from '../../data/content'
import type { Product } from '../../data/types'
import { S } from '../../i18n'
import { searchProducts } from '../../lib/catalog'
import { usePanels } from '../../state/PanelContext'
import { Drawer } from '../ui/Drawer'
import { Icon } from '../ui/Icon'
import { MediaSlot } from '../ui/MediaSlot'
import { Price } from '../ui/Price'
import styles from './SearchOverlay.module.css'

const RESULT_LIMIT = 8
const FEATURED_COUNT = 4

/** Panelden yönetilen "Popüler aramalar" (virgülle ayrılmış); boşsa dil varsayılanı. */
function popularTerms(): string[] {
  const raw = brandContent.popularSearches.value ?? S.search.popularDefault
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 12)
}

function ResultRow({ product, onPick }: { product: Product; onPick: () => void }) {
  const front = product.media.find((m) => m.kind === 'front') ?? product.media[0]
  return (
    <li>
      <Link to={`/urun/${product.slug}`} className={styles.row} onClick={onPick}>
        <span className={styles.thumb}>{front ? <MediaSlot label={front.label} src={front.src} ratio={siteSettings.catalog.mediaRatio} captionSize="sm" alt="" /> : null}</span>
        <span className={styles.rowText}>
          <span className={styles.rowName}>{product.name}</span>
          <Price amount={product.price} className={styles.rowPrice} withDemoHint={false} />
        </span>
      </Link>
    </li>
  )
}

/**
 * Sağdan kayan arama paneli (sepet çekmecesiyle aynı desen; mobilde tam genişlik).
 * Sorgu boşken: popüler aramalar + "Sizin için" 4 ürün. Yazarken: eşleşen ürünler listesi,
 * sonuç sayısı ve "Tüm sonuçları gör" (/arama?q=…). Enter da sonuç sayfasına gider.
 */
export function SearchOverlay() {
  const { isOpen, closePanel } = usePanels()
  const navigate = useNavigate()
  const open = isOpen('search')
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const close = () => closePanel('search')

  // Drawer kendi odak tuzağını kurduktan hemen sonra odağı arama alanına taşı.
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
  const results = allResults.slice(0, RESULT_LIMIT)
  const terms = useMemo(() => popularTerms(), [])
  const featured = useMemo(() => [...products.filter((p) => p.isNew), ...products.filter((p) => !p.isNew)].slice(0, FEATURED_COUNT), [])

  function goToResults(q: string) {
    close()
    navigate(`/arama?q=${encodeURIComponent(q)}`)
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (trimmed) goToResults(trimmed)
  }

  function applyTerm(term: string) {
    setQuery(term)
    inputRef.current?.focus()
  }

  const popular = (
    <section className={styles.block} aria-labelledby="search-popular-title">
      <h3 id="search-popular-title" className={styles.blockTitle}>
        {S.search.popularTitle}
      </h3>
      <ul className={styles.terms}>
        {terms.map((t) => (
          <li key={t}>
            <button type="button" className={styles.term} onClick={() => applyTerm(t)}>
              {t}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )

  return (
    <Drawer open={open} onClose={close} title={S.search.title} side="right" closeLabel={S.search.closeSearch} className={styles.panel}>
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
            autoComplete="off"
            onChange={(e) => setQuery(e.target.value)}
          />
          {query ? (
            <button
              type="button"
              className={styles.clear}
              aria-label={S.search.clearQuery}
              onClick={() => {
                setQuery('')
                inputRef.current?.focus()
              }}
            >
              <Icon name="close" size={16} />
            </button>
          ) : null}
        </div>
      </form>

      {trimmed ? (
        <div>
          <p className={styles.count} aria-live="polite">
            {S.search.resultCount(allResults.length)}
          </p>
          {results.length > 0 ? (
            <>
              <ul className={styles.list}>
                {results.map((p) => (
                  <ResultRow key={p.id} product={p} onPick={close} />
                ))}
              </ul>
              <button type="button" className={styles.seeAll} onClick={() => goToResults(trimmed)}>
                {S.search.seeAll}
              </button>
            </>
          ) : (
            <>
              <p className={styles.empty}>{S.search.noResults}</p>
              {popular}
            </>
          )}
        </div>
      ) : (
        <>
          {popular}
          <section className={styles.block} aria-labelledby="search-featured-title">
            <h3 id="search-featured-title" className={styles.blockTitle}>
              {S.search.featuredTitle}
            </h3>
            <ul className={styles.list}>
              {featured.map((p) => (
                <ResultRow key={p.id} product={p} onPick={close} />
              ))}
            </ul>
          </section>
        </>
      )}
    </Drawer>
  )
}
