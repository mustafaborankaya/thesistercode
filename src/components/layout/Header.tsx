import { Link, NavLink } from 'react-router-dom'
import { siteSettings } from '../../config/settings'
import { brandMedia } from '../../data/media'
import { useIsDesktop } from '../../hooks/useMediaQuery'
import { S } from '../../i18n'
import { useAccount } from '../../state/AccountContext'
import { useCart } from '../../state/CartContext'
import { useFavorites } from '../../state/FavoritesContext'
import { usePanels } from '../../state/PanelContext'
import { IconButton } from '../ui/Button'
import { Icon } from '../ui/Icon'
import styles from './Header.module.css'

export type HeaderMode = 'overlay' | 'solid'

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
          {brand.name !== brand.shortName ? <span className={styles.wordmarkSub}>{brand.name.replace(brand.shortName, '').trim()}</span> : null}
        </>
      )}
    </Link>
  )
}

const navClass = ({ isActive }: { isActive: boolean }) => [styles.navLink, isActive ? styles.navLinkActive : ''].join(' ').trim()

/**
 * Site başlığı: solda 3 çizgi menü (masaüstü + mobil; soldan kayan menü paneli), ortada logo,
 * sağda Hesabım / Ara / Favoriler / Sepet. `mode="overlay"`: ana sayfa açılış görselinin üstünde
 * şeffaf zemin + beyaz yazı; `solid`: beyaz zemin, siyah yazı, alt çizgi (bkz. Layout → useHeaderMode).
 */
export function Header({ mode = 'solid' }: { mode?: HeaderMode }) {
  const isDesktop = useIsDesktop()
  const { totals } = useCart()
  const { count: favCount } = useFavorites()
  const { isLoggedIn } = useAccount()
  const { openPanel, togglePanel, isOpen } = usePanels()

  return (
    <header className={styles.header} data-header-mode={mode}>
      <div className={styles.bar}>
        <div className={styles.left}>
          <IconButton
            icon="menu"
            label={S.header.openMenu}
            className={styles.menuButton}
            onClick={() => openPanel('menu')}
            aria-expanded={isOpen('menu')}
            aria-haspopup="dialog"
            size={22}
          />
          {!isDesktop ? <IconButton icon="search" label={S.header.search} onClick={() => openPanel('search')} aria-expanded={isOpen('search')} aria-haspopup="dialog" /> : null}
        </div>
        <LogoSlot />
        {isDesktop ? (
          <nav className={styles.right} aria-label="Alışveriş araçları">
            <NavLink to={isLoggedIn ? '/hesap' : '/giris'} className={navClass}>
              {S.header.account}
            </NavLink>
            <button type="button" className={styles.navLink} onClick={() => openPanel('search')} aria-expanded={isOpen('search')} aria-haspopup="dialog">
              {S.header.search}
            </button>
            <NavLink to="/favoriler" className={navClass}>
              {S.header.favorites}
              {favCount > 0 ? <span className="sr-only"> ({favCount})</span> : null}
            </NavLink>
            <button type="button" className={styles.navLink} onClick={() => togglePanel('cart')} aria-expanded={isOpen('cart')} aria-controls="cart-drawer">
              {S.header.cartWithCount(totals.itemCount)}
            </button>
          </nav>
        ) : (
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
        )}
      </div>
    </header>
  )
}
