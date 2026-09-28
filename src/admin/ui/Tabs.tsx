import { useRef, type KeyboardEvent } from 'react'
import s from './ui.module.css'

export interface TabDef<T extends string> {
  id: T
  label: string
  /** Sekmede kaydedilmemiş değişiklik/hata var → küçük nokta. */
  dot?: boolean
  dotLabel?: string
}

interface TabsProps<T extends string> {
  label: string
  tabs: TabDef<T>[]
  active: T
  onChange: (id: T) => void
  idPrefix: string
}

/** WAI-ARIA sekme listesi: ok tuşları / Home / End ile gezinme. Paneller `tabPanelProps` ile bağlanır. */
export function Tabs<T extends string>({ label, tabs, active, onChange, idPrefix }: TabsProps<T>) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})
  function onKey(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = -1
    if (e.key === 'ArrowRight') next = (index + 1) % tabs.length
    else if (e.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = tabs.length - 1
    if (next < 0) return
    e.preventDefault()
    const id = tabs[next].id
    onChange(id)
    refs.current[id]?.focus()
  }
  return (
    <div className={s.tabs} role="tablist" aria-label={label}>
      {tabs.map((t, i) => (
        <button
          key={t.id}
          ref={(el) => {
            refs.current[t.id] = el
          }}
          type="button"
          role="tab"
          id={`${idPrefix}-tab-${t.id}`}
          aria-controls={`${idPrefix}-panel-${t.id}`}
          aria-selected={t.id === active}
          tabIndex={t.id === active ? 0 : -1}
          className={s.tab}
          onClick={() => onChange(t.id)}
          onKeyDown={(e) => onKey(e, i)}
        >
          {t.label}
          {t.dot ? (
            <>
              <span className={s.tabDot} aria-hidden="true" />
              {t.dotLabel ? <span className="sr-only">{t.dotLabel}</span> : null}
            </>
          ) : null}
        </button>
      ))}
    </div>
  )
}

