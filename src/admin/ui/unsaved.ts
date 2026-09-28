import { createContext, useContext, useEffect, useId, useRef } from 'react'

export interface UnsavedApi {
  set: (id: string, dirty: boolean) => void
  /** Herhangi bir formda kaydedilmemiş değişiklik var mı? */
  any: boolean
}

export const UnsavedContext = createContext<UnsavedApi>({ set: () => undefined, any: false })

export function useUnsavedState(): boolean {
  return useContext(UnsavedContext).any
}

/** Bir formun kirli durumunu kabuğa bildirir (ayrılırken uyarı için). */
export function useUnsavedChanges(dirty: boolean): void {
  const id = useId()
  const { set } = useContext(UnsavedContext)
  useEffect(() => {
    set(id, dirty)
  }, [id, dirty, set])
  useEffect(() => () => set(id, false), [id, set])
}

/** Cmd/Ctrl+S → kaydet (tarayıcının "sayfayı kaydet" penceresi engellenir). */
export function useSaveShortcut(onSave: () => void, enabled: boolean): void {
  const ref = useRef(onSave)
  useEffect(() => {
    ref.current = onSave
  })
  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault()
        ref.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled])
}
