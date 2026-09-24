import { useEffect, useRef } from 'react'
import { Outlet, useLocation, useNavigationType } from 'react-router-dom'
import { S } from '../../i18n'
import { usePanels } from '../../state/PanelContext'
import { CartDrawer } from '../cart/CartDrawer'
import { CookieBanner } from '../panels/CookieBanner'
import { CookiePreferences } from '../panels/CookiePreferences'
import { DiscountOffer } from '../panels/DiscountOffer'
import { SearchOverlay } from '../panels/SearchOverlay'
import { SupportButton, SupportPanel } from '../panels/SupportPanel'
import { Footer } from './Footer'
import { Header, TopStrip } from './Header'
import { MobileMenu } from './MobileMenu'
import styles from './Layout.module.css'

/** Rota değişiminde: panelleri kapat, PUSH gezinmede yukarı kaydır, hash varsa hedefe git. */
function RouteEffects() {
  const location = useLocation()
  const navType = useNavigationType()
  const { closePanel } = usePanels()
  const prevPath = useRef(location.pathname)

  useEffect(() => {
    closePanel()
  }, [location.pathname, location.search, closePanel])

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

export function Layout() {
  return (
    <>
      <a href="#main" className={styles.skip}>
        {S.common.skipToContent}
      </a>
      <RouteEffects />
      <TopStrip />
      <Header />
      <main id="main" className={styles.main} tabIndex={-1}>
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
