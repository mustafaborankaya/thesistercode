import { useEffect, useRef } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { siteSettings } from '../../config/settings'
import { categories } from '../../data/catalog'
import { brandContent } from '../../data/content'
import { brandMedia } from '../../data/media'
import { useIsDesktop } from '../../hooks/useMediaQuery'
import { S, locale, pathForLocale } from '../../i18n'
import { useAccount } from '../../state/AccountContext'
import { useCart } from '../../state/CartContext'
import { useFavorites } from '../../state/FavoritesContext'
import { usePanels } from '../../state/PanelContext'
import { IconButton } from '../ui/Button'
import { Icon } from '../ui/Icon'
import { MediaSlot } from '../ui/MediaSlot'
import styles from './Header.module.css'

/** Üst şerit: üye olmayan ziyaretçiye kolay bulunan "%10" erişimi; kısa demo notu. */
export function TopStrip() {
  const { isLoggedIn } = useAccount()
  const campaign = siteSettings.memberDiscount
  return (
    <div className={styles.topStrip} data-top-strip>
      {campaign.enabled && !isLoggedIn ? (
        <Link to="/kayit" className={styles.topOffer}>
          <span>{S.account.topStripOffer}</span>
          <span aria-hidden="true" className={styles.topSep}>
            —
          </span>
          <u>{S.account.topStripAction}</u>
        </Link>
      ) : (
        <span className={styles.topOffer}>{isLoggedIn ? S.account.topStripMember : S.common.brand}</span>
      )}
      <div className={styles.topRight}>
        <nav className={styles.langSwitch} aria-label={S.locale.switchLabel}>
          <a href={pathForLocale('tr')} aria-current={locale === 'tr' ? 'true' : undefined} lang="tr" hrefLang="tr">
            {S.locale.tr}
          </a>
          <span aria-hidden="true">|</span>
          <a href={pathForLocale('en')} aria-current={locale === 'en' ? 'true' : undefined} lang="en" hrefLang="en">
            {S.locale.en}
          </a>
        </nav>
        {siteSettings.demo.enabled ? (
          <span className={styles.topDemo} title={S.common.demoBar}>
            <span className={styles.topDemoLong}>{S.common.demoShort}</span>
            <span className={styles.topDemoShort}>{S.common.demoTiny}</span>
          </span>
        ) : null}
      </div>
    </div>
  )
}

/** Ortalanmış wordmark; logo dosyası (src/assets/media/logo.svg) sağlanınca onun yerini alır. */
export function LogoSlot() {
  const { brand } = siteSettings
  const logo = brandMedia.logo ?? brand.logoSrc
  return (
    <Link to="/" className={styles.logo} aria-label={`${brand.name} — ana sayfa`}>
      {logo ? (
        <img src={logo} alt={brand.name} className={styles.logoImg} />
      ) : (
        <>
          <span className={styles.wordmark} lang="en">
            {brand.shortName}
          </span>
          {brand.name !== brand.shortName ? <span className={styles.wordmarkSub}>{brand.name.replace(brand.shortName, "").trim()}</span> : null}
        </>
      )}
    </Link>
  )
}

function ShopMenu() {
  const { isOpen, togglePanel, closePanel, openPanel } = usePanels()
  const open = isOpen('shop-menu')
  const wrapRef = useRef<HTMLDivElement>(null)
  const closeTimer = useRef<number | null>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) closePanel('shop-menu')
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePanel('shop-menu')
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, closePanel])

  const cancelClose = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current)
  }
  const scheduleClose = () => {
    cancelClose()
    closeTimer.current = window.setTimeout(() => closePanel('shop-menu'), 180)
  }

  return (
    <div ref={wrapRef} className={styles.shopWrap} onMouseEnter={cancelClose} onMouseLeave={scheduleClose}>
      <button
        type="button"
        className={styles.navLink}
        aria-expanded={open}
        aria-controls="shop-menu-panel"
        onClick={() => togglePanel('shop-menu')}
        onMouseEnter={() => openPanel('shop-menu')}
      >
        {S.header.shop}
      </button>
      {open ? (
        <div id="shop-menu-panel" className={styles.shopPanel}>
          <div>
            <div className={styles.shopTitle}>{S.header.shopMenuTitle}</div>
            <ul className={styles.shopList}>
              {categories.map((c) => (
                <li key={c.id}>
                  <NavLink
                    to={`/koleksiyon/${c.id}`}
                    className={({ isActive }) => [styles.shopLink, isActive ? styles.shopLinkActive : ''].join(' ').trim()}
                    onClick={() => closePanel('shop-menu')}
                  >
                    {c.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className={styles.shopTitle}>{S.header.collections}</div>
            <ul className={styles.shopList}>
              <li>
                <Link to="/koleksiyon" className={styles.shopLink} onClick={() => closePanel('shop-menu')}>
                  {brandContent.collectionTitle.value ?? S.collection.title}
                </Link>
              </li>
              <li>
                <Link to="/#uretim" className={styles.shopLink} onClick={() => closePanel('shop-menu')}>
                  {S.header.production}
                </Link>
              </li>
            </ul>
          </div>
          <MediaSlot label={brandContent.collectionVisual.label} src={brandMedia.collection} ratio="4 / 3" className={styles.shopVisual} captionSize="sm" />
        </div>
      ) : null}
    </div>
  )
}

export function Header() {
  const isDesktop = useIsDesktop()
  const { totals } = useCart()
  const { count: favCount } = useFavorites()
  const { isLoggedIn } = useAccount()
  const { openPanel, togglePanel, isOpen } = usePanels()
  const location = useLocation()
  const productionActive = location.pathname === '/' && location.hash === '#uretim'

  return (
    <header className={styles.header}>
      <div className={styles.bar}>
        {isDesktop ? (
          <>
            <nav className={styles.left} aria-label="Ana gezinme">
              <ShopMenu />
              <NavLink to="/koleksiyon" className={({ isActive }) => [styles.navLink, isActive ? styles.navLinkActive : ''].join(' ').trim()}>
                {S.header.collections}
              </NavLink>
              <Link to="/#uretim" className={[styles.navLink, productionActive ? styles.navLinkActive : ''].join(' ').trim()}>
                {S.header.production}
              </Link>
            </nav>
            <LogoSlot />
            <nav className={styles.right} aria-label="Alışveriş araçları">
              <NavLink to={isLoggedIn ? '/hesap' : '/giris'} className={({ isActive }) => [styles.navLink, isActive ? styles.navLinkActive : ''].join(' ').trim()}>
                {S.header.account}
              </NavLink>
              <button type="button" className={styles.navLink} onClick={() => openPanel('search')} aria-expanded={isOpen('search')}>
                {S.header.search}
              </button>
              <NavLink to="/favoriler" className={({ isActive }) => [styles.navLink, isActive ? styles.navLinkActive : ''].join(' ').trim()}>
                {S.header.favorites}
                {favCount > 0 ? <span className="sr-only"> ({favCount})</span> : null}
              </NavLink>
              <button type="button" className={styles.navLink} onClick={() => togglePanel('cart')} aria-expanded={isOpen('cart')} aria-controls="cart-drawer">
                {S.header.cartWithCount(totals.itemCount)}
              </button>
            </nav>
          </>
        ) : (
          <>
            <div className={styles.left}>
              <IconButton icon="menu" label={S.header.openMenu} onClick={() => openPanel('menu')} aria-expanded={isOpen('menu')} />
              <IconButton icon="search" label={S.header.search} onClick={() => openPanel('search')} aria-expanded={isOpen('search')} />
            </div>
            <LogoSlot />
            <div className={styles.right}>
              <button
                type="button"
                className={[styles.navLink, styles.mobileCart].join(' ')}
                onClick={() => togglePanel('cart')}
                aria-expanded={isOpen('cart')}
                aria-controls="cart-drawer"
                aria-label={S.header.cartWithCount(totals.itemCount)}
              >
                <Icon name="bag" size={22} />
                {totals.itemCount > 0 ? (
                  <span className={[styles.count, styles.mobileCount].join(' ')} aria-hidden="true">
                    {totals.itemCount}
                  </span>
                ) : null}
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  )
}
