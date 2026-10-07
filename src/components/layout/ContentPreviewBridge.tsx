import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { setPreviewOverrides } from '../../data/content'
import { useConsent } from '../../state/ConsentContext'
import { usePanels, type PanelId } from '../../state/PanelContext'

/**
 * Yönetici paneli → mağaza iframe'i köprüsü (yalnızca `?onizleme=icerik` modunda, Layout içinde).
 *
 * Protokol (hepsi aynı origin; `event.origin === location.origin` dışındaki iletiler yok sayılır):
 * - mağaza → panel  `{ type: 'tsc-preview-ready' }`                       köprü kuruldu, taslak gönderilebilir
 * - panel → mağaza  `{ type: 'tsc-preview-set', fields, changed, showCookieBanner?, scrollTo? }`
 *                    fields: anahtar → taslak metin (null = boş); changed: taslak ≠ kayıtlı anahtarlar;
 *                    scrollTo: görünüme kaydırılacak alan anahtarı
 * - mağaza → panel  `{ type: 'tsc-preview-applied', found, missing }`     changed içinden bu sayfada bulunan/bulunmayanlar
 * - mağaza → panel  `{ type: 'tsc-preview-nav', path }`                   iframe içinde rota değişti
 *
 * Üst pencere yoksa (`window.parent === window`) hiçbir şey yapmaz.
 */

interface PreviewSetMessage {
  type: 'tsc-preview-set'
  fields?: Record<string, string | null>
  changed?: unknown
  showCookieBanner?: unknown
  scrollTo?: unknown
}

/** Bazı alanlar yalnızca bir panel/çekmece açıkken görünür: odaklanan alan bunlardansa o panel açılır. */
const PANEL_BY_KEY: Record<string, PanelId> = {
  'brand.popularSearches': 'search',
  'cookie.necessary': 'cookie-preferences',
  'cookie.analytics': 'cookie-preferences',
  'cookie.marketing': 'cookie-preferences',
}

const keysOf = (el: Element): string[] => (el.getAttribute('data-content-key') ?? '').split(/\s+/).filter(Boolean)

/** Önceki işaretleri temizler, `changed` ile kesişen elemanları işaretler, `scrollTo` alanını görünüme getirir. */
function applyMarks(changed: string[], scrollTo: string | null): { found: string[]; missing: string[] } {
  document.querySelectorAll('[data-preview-changed]').forEach((el) => el.removeAttribute('data-preview-changed'))
  const want = new Set(changed)
  const found = new Set<string>()
  let target: Element | null = null
  document.querySelectorAll('[data-content-key]').forEach((el) => {
    const keys = keysOf(el)
    const hit = keys.filter((k) => want.has(k))
    if (hit.length) {
      el.setAttribute('data-preview-changed', '')
      hit.forEach((k) => found.add(k))
    }
    if (scrollTo && !target && keys.includes(scrollTo)) target = el
  })
  if (target) (target as Element).scrollIntoView({ block: 'center', behavior: 'smooth' })
  return { found: [...found], missing: changed.filter((k) => !found.has(k)) }
}

export function ContentPreviewBridge() {
  const location = useLocation()
  const { setBannerPreview } = useConsent()
  const { open, openPanel, closePanel } = usePanels()
  const embedded = typeof window !== 'undefined' && window.parent !== window
  // Panel durumu mesaj dinleyicisinde taze okunsun (dinleyici bir kez kurulur).
  const panelRef = useRef({ open, openPanel, closePanel })
  useEffect(() => {
    panelRef.current = { open, openPanel, closePanel }
  }, [open, openPanel, closePanel])

  useEffect(() => {
    if (!embedded) return
    const origin = window.location.origin
    const timers: number[] = []
    const post = (msg: unknown) => window.parent.postMessage(msg, origin)

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== origin) return
      const data = event.data as PreviewSetMessage | null
      if (!data || typeof data !== 'object' || data.type !== 'tsc-preview-set') return

      setPreviewOverrides(data.fields && typeof data.fields === 'object' ? data.fields : {})
      setBannerPreview(data.showCookieBanner === true)
      const changed = Array.isArray(data.changed) ? data.changed.filter((k): k is string => typeof k === 'string') : []
      const scrollTo = typeof data.scrollTo === 'string' ? data.scrollTo : null

      // Yalnızca panel içinde görünen alan: ilgili paneli aç; başka alana geçildiyse o paneli kapat.
      const wanted = scrollTo ? (PANEL_BY_KEY[scrollTo] ?? null) : null
      const { open: current, openPanel: doOpen, closePanel: doClose } = panelRef.current
      if (wanted && current !== wanted) doOpen(wanted)
      else if (!wanted && scrollTo && (current === 'search' || current === 'cookie-preferences')) doClose(current)

      // İşaretleme, React taslağı çizdikten sonra (iki kare) + panel/çekmece animasyonu için bir kez daha.
      timers.forEach((t) => window.clearTimeout(t))
      timers.length = 0
      const run = () => post({ type: 'tsc-preview-applied', ...applyMarks(changed, scrollTo) })
      requestAnimationFrame(() => requestAnimationFrame(run))
      timers.push(window.setTimeout(run, 400))
    }

    window.addEventListener('message', onMessage)
    post({ type: 'tsc-preview-ready' })
    return () => {
      window.removeEventListener('message', onMessage)
      timers.forEach((t) => window.clearTimeout(t))
    }
  }, [embedded, setBannerPreview])

  useEffect(() => {
    if (!embedded) return
    window.parent.postMessage({ type: 'tsc-preview-nav', path: location.pathname + location.search + location.hash }, window.location.origin)
  }, [embedded, location.pathname, location.search, location.hash])

  return null
}
