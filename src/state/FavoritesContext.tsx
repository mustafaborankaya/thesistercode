import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { productById } from '../data/catalog'
import { readJSON, storageKeys, writeJSON } from '../lib/storage'

interface FavoritesContextValue {
  ids: string[]
  has: (productId: string) => boolean
  toggle: (productId: string) => void
  remove: (productId: string) => void
  count: number
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null)

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<string[]>(() => readJSON<string[]>(storageKeys.favorites, []).filter((id) => productById[id]))

  useEffect(() => {
    writeJSON(storageKeys.favorites, ids)
  }, [ids])

  const has = useCallback((id: string) => ids.includes(id), [ids])
  const toggle = useCallback((id: string) => setIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id])), [])
  const remove = useCallback((id: string) => setIds((s) => s.filter((x) => x !== id)), [])

  const value = useMemo(() => ({ ids, has, toggle, remove, count: ids.length }), [ids, has, toggle, remove])
  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>
}

export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext)
  if (!ctx) throw new Error('useFavorites, FavoritesProvider içinde kullanılmalı')
  return ctx
}
