import type { ColorOption } from '../../data/types'
import { S } from '../../i18n'
import styles from './VariantSelectors.module.css'

interface ColorSelectorProps {
  colors: ColorOption[]
  value: string
  onChange: (colorId: string) => void
}

/**
 * Renk seçimi — gerçek renk yok, yalnızca "Renk 1/2/3" metin etiketleri.
 * Tek renk seçeneğinde bile fieldset görünür kalır: bilgi sırasındaki "renk seçimi" adımı
 * kaybolmaz ve ekran okuyucu için "seçili renk" bildirimi her zaman yapılır.
 */
export function ColorSelector({ colors, value, onChange }: ColorSelectorProps) {
  const selected = colors.find((c) => c.id === value)
  const single = colors.length <= 1

  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>{S.product.color}</legend>
      <div className={styles.optionRow}>
        {colors.map((c) => {
          const active = c.id === value
          return (
            <button
              key={c.id}
              type="button"
              className={[styles.colorOption, active ? styles.optionActive : ''].join(' ').trim()}
              aria-pressed={active}
              disabled={single}
              aria-disabled={single || undefined}
              onClick={() => onChange(c.id)}
            >
              {c.label}
            </button>
          )
        })}
      </div>
      <p className="sr-only" aria-live="polite">
        {selected ? S.product.colorSelected(selected.label) : ''}
      </p>
    </fieldset>
  )
}
