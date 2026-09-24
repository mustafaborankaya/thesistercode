import { useEffect, type RefObject } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Panel açıkken odağı panel içinde tutar; açılışta ilk odaklanabilir öğeye (veya panele) odaklanır,
 * kapanışta odağı açan kontrole geri verir.
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean, initialFocus?: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    if (!active) return
    const container = ref.current
    if (!container) return
    const previouslyFocused = document.activeElement as HTMLElement | null

    const focusFirst = () => {
      const target = initialFocus?.current ?? container.querySelector<HTMLElement>(FOCUSABLE) ?? container
      target.focus({ preventScroll: true })
    }
    const raf = requestAnimationFrame(focusFirst)

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const items = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      )
      if (items.length === 0) {
        e.preventDefault()
        container.focus()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    container.addEventListener('keydown', onKeyDown)

    return () => {
      cancelAnimationFrame(raf)
      container.removeEventListener('keydown', onKeyDown)
      if (!previouslyFocused) return
      const restore = () => {
        if (document.contains(previouslyFocused)) previouslyFocused.focus({ preventScroll: true })
      }
      restore()
      // Açan kontrol geçici olarak devre dışıysa ("Sepete Ekle" bekleme durumu) kısa süre sonra yeniden dene.
      if (document.activeElement !== previouslyFocused) window.setTimeout(restore, 700)
    }
  }, [ref, active, initialFocus])
}
