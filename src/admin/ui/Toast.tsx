import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { AS } from '../adminStrings'
import { AdminIcon } from './AdminIcon'
import { ToastContext, type ToastApi } from './toastContext'
import s from './ui.module.css'

type ToastTone = 'success' | 'error' | 'warning' | 'info'

interface ToastItem {
  id: number
  tone: ToastTone
  message: string
}


const DURATION: Record<ToastTone, number> = { success: 3500, info: 4000, warning: 6500, error: 7000 }
const ICON = { success: 'check', error: 'alert', warning: 'alert', info: 'info' } as const

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => setItems((list) => list.filter((t) => t.id !== id)), [])

  const push = useCallback(
    (tone: ToastTone, message: string) => {
      const id = nextId.current++
      setItems((list) => [...list.slice(-3), { id, tone, message }])
      window.setTimeout(() => dismiss(id), DURATION[tone])
    },
    [dismiss],
  )

  const api = useMemo<ToastApi>(
    () => ({
      success: (m) => push('success', m),
      error: (m) => push('error', m),
      warning: (m) => push('warning', m),
      info: (m) => push('info', m),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className={s.toastRegion} role="region" aria-label={AS.ui.notifications}>
        <div aria-live="polite" className={s.stackSm}>
          {items
            .filter((t) => t.tone !== 'error')
            .map((t) => (
              <ToastView key={t.id} item={t} onClose={() => dismiss(t.id)} />
            ))}
        </div>
        <div role="alert" className={s.stackSm}>
          {items
            .filter((t) => t.tone === 'error')
            .map((t) => (
              <ToastView key={t.id} item={t} onClose={() => dismiss(t.id)} />
            ))}
        </div>
      </div>
    </ToastContext.Provider>
  )
}

function ToastView({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const toneClass = item.tone === 'success' ? s.toastSuccess : item.tone === 'error' ? s.toastError : item.tone === 'warning' ? s.toastWarning : ''
  return (
    <div className={[s.toast, toneClass].join(' ')}>
      <AdminIcon name={ICON[item.tone]} size={18} />
      <span className={s.toastMsg}>{item.message}</span>
      <button type="button" className={s.toastClose} onClick={onClose} aria-label={AS.ui.close}>
        <AdminIcon name="close" size={16} />
      </button>
    </div>
  )
}
