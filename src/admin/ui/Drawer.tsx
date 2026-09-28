import { useId, useRef, type ReactNode } from 'react'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { useScrollLock } from '../../hooks/useScrollLock'
import { AS } from '../adminStrings'
import { Btn } from './Button'
import s from './ui.module.css'

interface DrawerProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  subtitle?: ReactNode
  headerExtra?: ReactNode
  footer?: ReactNode
  children: ReactNode
  wide?: boolean
}

/**
 * Sağdan açılan detay paneli. Esc / perde / kapat düğmesiyle kapanır; açıkken odak panelde tutulur,
 * kapanınca açan öğeye döner; arka sayfa kaydırılmaz.
 */
export function Drawer({ open, onClose, title, subtitle, headerExtra, footer, children, wide }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const id = useId()
  useScrollLock(open)
  useFocusTrap(panelRef, open)
  if (!open) return null
  return (
    <div className={s.overlay}>
      <div className={s.scrim} onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        className={[s.drawer, wide ? s.drawerWide : ''].join(' ')}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-t`}
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation()
            onClose()
          }
        }}
      >
        <div className={s.drawerHead}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 id={`${id}-t`} className={s.drawerTitle}>
              {title}
            </h2>
            {subtitle ? <div className={s.drawerSub}>{subtitle}</div> : null}
          </div>
          {headerExtra}
          <Btn variant="ghost" size="sm" icon="close" iconOnly label={AS.ui.close} onClick={onClose} />
        </div>
        <div className={s.drawerBody}>{children}</div>
        {footer ? <div className={s.drawerFoot}>{footer}</div> : null}
      </div>
    </div>
  )
}
