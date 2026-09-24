import { useId, useState, type ReactNode } from 'react'
import { Icon } from './Icon'
import styles from './Accordion.module.css'

interface AccordionItemProps {
  title: ReactNode
  children: ReactNode
  defaultOpen?: boolean
  /** Kontrollü kullanım için. */
  open?: boolean
  onToggle?: (open: boolean) => void
  className?: string
}

/** Açılıp kapanabilen tek bölüm; ürün detayları ve mobil footer grupları için. */
export function AccordionItem({ title, children, defaultOpen = false, open, onToggle, className }: AccordionItemProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const isOpen = open ?? internalOpen
  const id = useId()
  const toggle = () => {
    const next = !isOpen
    if (open == null) setInternalOpen(next)
    onToggle?.(next)
  }
  return (
    <div className={[styles.item, className ?? ''].join(' ').trim()}>
      <h3>
        <button type="button" className={styles.trigger} aria-expanded={isOpen} aria-controls={`${id}-panel`} id={`${id}-trigger`} onClick={toggle}>
          <span>{title}</span>
          <Icon name={isOpen ? 'minus' : 'plus'} size={16} className={styles.icon} />
        </button>
      </h3>
      <div id={`${id}-panel`} role="region" aria-labelledby={`${id}-trigger`} hidden={!isOpen} className={styles.panel}>
        {children}
      </div>
    </div>
  )
}
