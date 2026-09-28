import { useId, type ReactNode, type SelectHTMLAttributes } from 'react'
import { AS } from '../adminStrings'
import { AdminIcon } from './AdminIcon'
import { Btn } from './Button'
import s from './ui.module.css'

interface FilterBarProps {
  search?: { value: string; onChange: (v: string) => void; placeholder: string; label?: string }
  children?: ReactNode
  /** Filtre etkinse "Temizle" düğmesi gösterilir. */
  onClear?: () => void
  active?: boolean
  trailing?: ReactNode
}

/** Arama + seçim filtreleri satırı. */
export function FilterBar({ search, children, onClear, active, trailing }: FilterBarProps) {
  const id = useId()
  return (
    <div className={s.filterBar} role="search">
      {search ? (
        <div className={s.filterSearch}>
          <label htmlFor={id} className="sr-only">
            {search.label ?? AS.ui.search}
          </label>
          <AdminIcon name="search" size={18} />
          <input id={id} type="search" className={s.control} value={search.value} placeholder={search.placeholder} onChange={(e) => search.onChange(e.target.value)} />
        </div>
      ) : null}
      {children}
      {active && onClear ? (
        <Btn variant="ghost" icon="close" onClick={onClear}>
          {AS.ui.clearFilters}
        </Btn>
      ) : null}
      {trailing ? <div style={{ marginLeft: 'auto' }}>{trailing}</div> : null}
    </div>
  )
}

/** Filtre çubuğu için kompakt etiketli seçim. */
export function FilterSelect({ label, children, className, ...rest }: { label: string } & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId()
  return (
    <div className={[s.filterItem, className ?? ''].join(' ').trim()}>
      <label htmlFor={id} className={s.filterLabel}>
        {label}
      </label>
      <select id={id} className={s.control} {...rest}>
        {children}
      </select>
    </div>
  )
}

/** Filtre çubuğu için kompakt etiketli tarih. */
export function FilterDate({ label, value, onChange, max, min }: { label: string; value: string; onChange: (v: string) => void; max?: string; min?: string }) {
  const id = useId()
  return (
    <div className={s.filterItem}>
      <label htmlFor={id} className={s.filterLabel}>
        {label}
      </label>
      <input id={id} type="date" className={s.control} value={value} min={min} max={max} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}
