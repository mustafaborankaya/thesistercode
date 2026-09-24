import { useId, type RefObject } from 'react'
import type { Product, SizeId } from '../../data/types'
import { S } from '../../i18n'
import { usePanels } from '../../state/PanelContext'
import type { VariantError } from './useVariantSelection'
import styles from './VariantSelectors.module.css'

interface SizeSelectorProps {
  product: Product
  value: SizeId | null
  onChange: (size: SizeId) => void
  stockForSize: (size: SizeId) => number
  error: VariantError
  groupRef: RefObject<HTMLDivElement | null>
}

/** Beden seçimi — tükenen bedenler üstü çizili ve devre dışı; "Beden Rehberi" paneli açar. */
export function SizeSelector({ product, value, onChange, stockForSize, error, groupRef }: SizeSelectorProps) {
  const { openPanel } = usePanels()
  const errorId = useId()

  return (
    <fieldset className={styles.fieldset}>
      <div className={styles.legendRow}>
        <legend className={styles.legend}>{S.product.size}</legend>
        <button type="button" className={styles.sizeGuideLink} onClick={() => openPanel('size-guide')}>
          {S.product.sizeGuide}
        </button>
      </div>
      <div ref={groupRef} className={styles.sizeGrid} aria-describedby={error === 'size-required' ? errorId : undefined}>
        {product.sizes.map((s) => {
          const stock = stockForSize(s)
          const soldOut = stock <= 0
          const active = value === s
          return (
            <button
              key={s}
              type="button"
              className={[styles.sizeOption, active ? styles.optionActive : '', soldOut ? styles.sizeSoldOut : ''].join(' ').trim()}
              aria-pressed={active}
              aria-disabled={soldOut || undefined}
              disabled={soldOut}
              onClick={() => onChange(s)}
            >
              {s}
              {soldOut ? <span className="sr-only"> — {S.product.soldOutSize(s)}</span> : null}
            </button>
          )
        })}
      </div>
      <p className={styles.legendNote}>{S.product.soldOutLegend}</p>
      <p className="sr-only" aria-live="polite">
        {value ? S.product.sizeSelected(value) : ''}
      </p>
      {error === 'size-required' ? (
        <p id={errorId} role="alert" className={styles.error}>
          {S.product.sizeRequired}
        </p>
      ) : null}
    </fieldset>
  )
}
