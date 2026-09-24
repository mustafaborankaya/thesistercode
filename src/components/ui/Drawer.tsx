import { useEffect, useId, useRef, type ReactNode } from 'react'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { useScrollLock } from '../../hooks/useScrollLock'
import { S } from '../../i18n'
import { IconButton } from './Button'
import styles from './Drawer.module.css'

export type DrawerSide = 'right' | 'left' | 'top' | 'bottom' | 'center'

interface DrawerProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  side?: DrawerSide
  children: ReactNode
  footer?: ReactNode
  /** Başlık satırına ek içerik (adet sayısı vb.). */
  headerExtra?: ReactNode
  /** Başlığı gizle ama erişilebilir bırak. */
  hideTitle?: boolean
  className?: string
  bodyClassName?: string
  /** Kapatma kontrolünün erişilebilir adı. */
  closeLabel?: string
  labelledBy?: string
}

/**
 * Kayan panel / modal.
 * - Escape, dış perde ve kapatma butonuyla kapanır.
 * - Açılınca odak panele geçer, kapanınca açan kontrole döner.
 * - Panel kendi içinde kaydırılır; arka sayfa sabitlenir.
 */
export function Drawer({ open, onClose, title, side = 'right', children, footer, headerExtra, hideTitle, className, bodyClassName, closeLabel, labelledBy }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const id = useId()
  useScrollLock(open)
  useFocusTrap(panelRef, open)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className={styles.root} data-drawer-side={side}>
      <div className={styles.scrim} onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        className={[styles.panel, styles[side], className ?? ''].join(' ').trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy ?? `${id}-title`}
        tabIndex={-1}
      >
        <div className={styles.header}>
          <h2 id={`${id}-title`} className={hideTitle ? 'sr-only' : styles.title}>
            {title}
          </h2>
          {headerExtra}
          <IconButton icon="close" label={closeLabel ?? S.common.close} onClick={onClose} />
        </div>
        <div className={[styles.body, bodyClassName ?? ''].join(' ').trim()}>{children}</div>
        {footer ? <div className={styles.footer}>{footer}</div> : null}
      </div>
    </div>
  )
}
