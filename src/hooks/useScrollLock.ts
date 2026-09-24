import { useEffect } from 'react'

let lockCount = 0

/** Bir panel/modal açıkken arka sayfayı sabitler; kaydırma çubuğu genişliğini telafi ederek zıplamayı önler. */
export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return
    const body = document.body
    const scrollbar = window.innerWidth - document.documentElement.clientWidth
    if (lockCount === 0) {
      body.classList.add('is-locked')
      if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`
    }
    lockCount += 1
    return () => {
      lockCount -= 1
      if (lockCount === 0) {
        body.classList.remove('is-locked')
        body.style.paddingRight = ''
      }
    }
  }, [active])
}
