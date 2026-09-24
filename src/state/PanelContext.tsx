import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

/**
 * Ortak panel öncelik yöneticisi.
 * Aynı anda yalnızca bir büyük panel açık olur; yenisi açılınca öncekisi kapanır.
 * Çerez çubuğu bu kümeye dahil değildir (ConsentContext yönetir) ama teklif paneli
 * çerez kararı verilmeden ve başka panel açıkken gösterilmez.
 */
export type PanelId =
  | 'menu'
  | 'shop-menu'
  | 'search'
  | 'cart'
  | 'filters'
  | 'size-guide'
  | 'support'
  | 'offer'
  | 'cookie-preferences'
  | 'lightbox'
  | 'checkout-summary'

interface PanelContextValue {
  open: PanelId | null
  openPanel: (id: PanelId) => void
  closePanel: (id?: PanelId) => void
  togglePanel: (id: PanelId) => void
  isOpen: (id: PanelId) => boolean
}

const PanelContext = createContext<PanelContextValue | null>(null)

export function PanelProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<PanelId | null>(null)

  const openPanel = useCallback((id: PanelId) => setOpen(id), [])
  const closePanel = useCallback((id?: PanelId) => {
    setOpen((current) => (id == null || current === id ? null : current))
  }, [])
  const togglePanel = useCallback((id: PanelId) => setOpen((current) => (current === id ? null : id)), [])
  const isOpen = useCallback((id: PanelId) => open === id, [open])

  const value = useMemo(() => ({ open, openPanel, closePanel, togglePanel, isOpen }), [open, openPanel, closePanel, togglePanel, isOpen])
  return <PanelContext.Provider value={value}>{children}</PanelContext.Provider>
}

export function usePanels(): PanelContextValue {
  const ctx = useContext(PanelContext)
  if (!ctx) throw new Error('usePanels, PanelProvider içinde kullanılmalı')
  return ctx
}
