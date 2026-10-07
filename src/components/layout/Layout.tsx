import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigationType } from 'react-router-dom'
import { usePreviewVersion } from '../../data/content'
import { brandMedia } from '../../data/media'
import { S } from '../../i18n'
import { contentPreview } from '../../lib/preview'
import { trackPageView } from '../../services/analytics'
import { usePanels } from '../../state/PanelContext'
import { CartDrawer } from '../cart/CartDrawer'
import { CookieBanner } from '../panels/CookieBanner'
import { CookiePreferences } from '../panels/CookiePreferences'
import { DiscountOffer } from '../panels/DiscountOffer'
import { SearchOverlay } from '../panels/SearchOverlay'
import { SupportButton, SupportPanel } from '../panels/SupportPanel'
import { ContentPreviewBridge } from './ContentPreviewBridge'
import { Footer } from './Footer'
import { Header, type HeaderMode } from './Header'
import { MobileMenu } from './MobileMenu'
import styles from './Layout.module.css'

/** Rota değişiminde: panelleri kapat, sayfa görüntülemesini ölç, PUSH gezinmede yukarı kaydır, hash varsa hedefe git. */
function RouteEffects() {
  const location = useLocation()
  const navType = useNavigationType()
  const { closePanel } = usePanels()
  const prevPath = useRef(location.pathname)
  // StrictMode'da efekt iki kez çalışır; aynı yol+sorgu için tek page_view gönderilir.
  const lastTracked = useRef<string | null>(null)

  useEffect(() => {
    closePanel()
  }, [location.pathname, location.search, closePanel])

  useEffect(() => {
    const key = location.pathname + location.search
    if (lastTracked.current === key) return
    lastTracked.current = key
    trackPageView(location.pathname)
  }, [location.pathname, location.search])

  useEffect(() => {
    if (location.hash) {
      const id = location.hash.slice(1)
      // Hedef bölüm sonraki çizimde hazır olsun.
      const raf = requestAnimationFrame(() => {
        const el = document.getElementById(id)
        if (el) {
          el.scrollIntoView({ block: 'start' })
          el.focus?.({ preventScroll: true })
        }
      })
      return () => cancelAnimationFrame(raf)
    }
    const isCollection = location.pathname === '/' || location.pathname.startsWith('/koleksiyon')
    if (navType === 'PUSH' || (navType === 'REPLACE' && prevPath.current !== location.pathname)) {
      window.scrollTo({ top: 0 })
    } else if (navType === 'POP' && !isCollection && prevPath.current !== location.pathname) {
      // Koleksiyon kendi kaydırma konumunu geri yükler (history.scrollRestoration = manual); diğer sayfalar üstten başlar.
      window.scrollTo({ top: 0 })
    }
    prevPath.current = location.pathname
  }, [location.pathname, location.hash, navType])

  return null
}

/** Header bu kaydırma eşiğini (px) geçince şeffaftan beyaza döner. */
const OVERLAY_SCROLL_LIMIT = 40

/**
 * Ana sayfada, açılış fotoğrafı varken ve sayfa en üstteyken header şeffaf (`overlay`) durur.
 * Kaydırma eşiği geçilince, menü/arama/sepet paneli açılınca ya da ana sayfa dışında `solid`.
 * (Teklif/çerez panelleri kasıtlı olarak sayılmaz — ana sayfada kendiliğinden açılabilirler.)
 */
function useHeaderMode(isHeroPage: boolean): HeaderMode {
  const { open } = usePanels()
  const [atTop, setAtTop] = useState(() => typeof window === 'undefined' || window.scrollY <= OVERLAY_SCROLL_LIMIT)

  useEffect(() => {
    if (!isHeroPage) return
    const onScroll = () => setAtTop(window.scrollY <= OVERLAY_SCROLL_LIMIT)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [isHeroPage])

  const panelForcesSolid = open === 'menu' || open === 'search' || open === 'cart'
  return isHeroPage && atTop && !panelForcesSolid ? 'overlay' : 'solid'
}

export function Layout() {
  const { pathname } = useLocation()
  const isHeroPage = pathname === '/' && !!(brandMedia.heroDesktop || brandMedia.heroMobile)
  const headerMode = useHeaderMode(isHeroPage)
  // Panel önizlemesinde taslak metin değişince kabuk (header/footer/paneller) yeniden çizilsin.
  usePreviewVersion()
  return (
    <>
      <a href="#main" className={styles.skip}>
        {S.common.skipToContent}
      </a>
      <RouteEffects />
      {contentPreview ? <ContentPreviewBridge /> : null}
      <Header mode={headerMode} />
      <main id="main" className={styles.main} tabIndex={-1} data-under-header={isHeroPage ? 'true' : undefined}>
        <Outlet />
      </main>
      <Footer />

      {/* Paneller header'ın katman bağlamı dışında, kök seviyede render edilir. */}
      <MobileMenu />
      <CartDrawer />
      <SearchOverlay />
      <SupportPanel />
      <SupportButton />
      <CookiePreferences />
      <CookieBanner />
      <DiscountOffer />
    </>
  )
}
