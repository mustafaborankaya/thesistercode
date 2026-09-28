import { useId, useRef, type ReactNode } from 'react'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { useScrollLock } from '../../hooks/useScrollLock'
import { AS } from '../adminStrings'
import { Btn } from './Button'
import s from './ui.module.css'

interface ConfirmDialogProps {
  open: boolean
  title: ReactNode
  message?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** 'danger' → kırmızı onay düğmesi (silme, iptal, iade). */
  tone?: 'default' | 'danger'
  pending?: boolean
  onConfirm: () => void
  onCancel: () => void
  children?: ReactNode
}

/**
 * Onay penceresi (alertdialog). Odak açılışta "Vazgeç"te başlar — yıkıcı işlem Enter ile kazara onaylanmaz.
 * Esc ve perde tıklaması vazgeçer (işlem sürerken kapanmaz).
 */
export function ConfirmDialog({ open, title, message, confirmLabel, cancelLabel, tone = 'default', pending, onConfirm, onCancel, children }: ConfirmDialogProps) {
  const ref = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const id = useId()
  useScrollLock(open)
  useFocusTrap(ref, open, cancelRef)
  if (!open) return null
  const cancel = () => {
    if (!pending) onCancel()
  }
  return (
    <div className={s.dialogWrap}>
      <div className={s.scrim} onClick={cancel} aria-hidden="true" />
      <div
        ref={ref}
        className={s.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${id}-t`}
        aria-describedby={message ? `${id}-d` : undefined}
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation()
            cancel()
          }
        }}
      >
        <h2 id={`${id}-t`} className={s.dialogTitle}>
          {title}
        </h2>
        {message ? (
          <div id={`${id}-d`} className={s.dialogText}>
            {message}
          </div>
        ) : null}
        {children}
        <div className={s.dialogActions}>
          <Btn ref={cancelRef} variant="secondary" onClick={cancel} disabled={pending}>
            {cancelLabel ?? AS.ui.cancel}
          </Btn>
          <Btn variant={tone === 'danger' ? 'danger-solid' : 'primary'} onClick={onConfirm} loading={pending}>
            {confirmLabel ?? AS.ui.confirm}
          </Btn>
        </div>
      </div>
    </div>
  )
}
