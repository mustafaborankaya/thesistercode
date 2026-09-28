import { useCallback, useEffect, useRef, useState } from 'react'

interface LoaderState<T> {
  key: string | null
  data?: T
  error?: unknown
}

/**
 * Basit veri yükleyici: `key` değişince (ör. filtre) ya da `reload()` ile yeniden yükler. Yeniden
 * yüklenirken son veri korunur (titreme olmaz). Efekt içinde senkron setState yapılmaz.
 */
export function useLoader<T>(loader: () => Promise<T>, key = '', enabled = true) {
  const loaderRef = useRef(loader)
  useEffect(() => {
    loaderRef.current = loader
  })
  const [token, setToken] = useState(0)
  const fullKey = `${key}#${token}`
  const [state, setState] = useState<LoaderState<T>>({ key: null })

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    loaderRef.current().then(
      (data) => {
        if (!cancelled) setState({ key: fullKey, data })
      },
      (error: unknown) => {
        if (!cancelled) setState((s) => ({ key: fullKey, data: s.data, error }))
      },
    )
    return () => {
      cancelled = true
    }
  }, [fullKey, enabled])

  const reload = useCallback(() => setToken((t) => t + 1), [])
  const setData = useCallback((fn: (prev: T | undefined) => T | undefined) => setState((s) => ({ ...s, data: fn(s.data) })), [])
  const settled = state.key === fullKey
  return {
    data: state.data,
    error: settled ? state.error : undefined,
    loading: enabled && !settled,
    /** İlk yükleme henüz bitmedi (hiç veri yok). */
    initial: enabled && state.key === null,
    reload,
    setData,
  }
}
