import { useEffect, useRef, useState, type RefObject } from 'react'

/**
 * Kapsayıcının genişliğini ResizeObserver ile ölçer — grafikler viewBox'ı gerçek piksel genişliğine
 * kurar, böylece yazı boyutları ölçeklenmez. İlk ölçüm observe anında gelir (efekt içinde senkron
 * setState yok). Genişlik 0 iken grafik çizilmez.
 */
export function useMeasure<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0
      setWidth((prev) => (Math.abs(prev - w) < 1 ? prev : Math.round(w)))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width]
}
