import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AS } from '../adminStrings'
import { Btn } from './Button'
import { UnsavedContext, useSaveShortcut, useUnsavedChanges } from './unsaved'
import s from './ui.module.css'

/* ---------------- Kaydedilmemiş değişiklik takibi ---------------- */

/**
 * Panel kabuğu (AdminLayout) tarafından sağlanır. Uygulama `BrowserRouter` kullandığı için
 * `useBlocker` yok; kabuk, kirli durumda panel içi bağlantı tıklamalarını yakalayıp onay ister,
 * sekme kapatma/yenilemede `beforeunload` uyarısı verir.
 */
export function UnsavedProvider({ children }: { children: ReactNode }) {
  const dirtyIds = useRef(new Set<string>())
  const [any, setAny] = useState(false)
  const set = useCallback((id: string, dirty: boolean) => {
    if (dirty) dirtyIds.current.add(id)
    else dirtyIds.current.delete(id)
    setAny(dirtyIds.current.size > 0)
  }, [])
  useEffect(() => {
    if (!any) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [any])
  const value = useMemo(() => ({ set, any }), [set, any])
  return <UnsavedContext.Provider value={value}>{children}</UnsavedContext.Provider>
}

/* ---------------- Yapışkan kaydet çubuğu ---------------- */

interface StickySaveBarProps {
  dirty: boolean
  saving?: boolean
  onSave: () => void
  onDiscard: () => void
  /** Kaç alan değişti (bilgi amaçlı). */
  changes?: number
  saveLabel?: string
}

/**
 * Kaydedilmemiş değişiklik varken ekranın altında görünen çubuk: "Kaydet / Vazgeç". Cmd/Ctrl+S kaydeder;
 * sayfadan ayrılırken (panel içi bağlantı ya da sekme kapatma) uyarı verilir.
 */
export function StickySaveBar({ dirty, saving, onSave, onDiscard, changes, saveLabel }: StickySaveBarProps) {
  useUnsavedChanges(dirty)
  useSaveShortcut(() => {
    if (dirty && !saving) onSave()
  }, true)
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
  return (
    <>
      <div className={s.saveBarSpacer} aria-hidden="true" />
      {dirty || saving ? (
        <div className={s.saveBar}>
          <div className={s.saveBarInner} role="region" aria-label={AS.save.region}>
            <span className={s.saveBarText}>
              <span className={s.dotWarning} aria-hidden="true" />
              {changes ? AS.save.unsavedCount(changes) : AS.save.unsaved}
              <kbd>{isMac ? '⌘S' : 'Ctrl+S'}</kbd>
            </span>
            <span className={s.row}>
              <Btn variant="ghost" onClick={onDiscard} disabled={saving}>
                {AS.save.discard}
              </Btn>
              <Btn variant="primary" onClick={onSave} loading={saving}>
                {saveLabel ?? AS.save.save}
              </Btn>
            </span>
          </div>
        </div>
      ) : null}
    </>
  )
}
