import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { siteSettings } from '../../config/settings'
import { categories } from '../../data/catalog'
import { S, locale, pathForLocale } from '../../i18n'
import { useAccount } from '../../state/AccountContext'
import { useFavorites } from '../../state/FavoritesContext'
import { usePanels } from '../../state/PanelContext'
import { Drawer } from '../ui/Drawer'
import { Icon } from '../ui/Icon'
import styles from './MobileMenu.module.css'

/**
 * Site menüsü (masaüstü + mobil): header'daki 3 çizgi ikonuyla soldan kayan tam yükseklikli panel.
 * Kategoriler dokunarak açılır/kapanır; koleksiyonlar, üretim, hesap, favoriler, destek ve TR|EN kolay erişilir.
 * Escape, dış perde ve kapatma butonu kapatır; odak Drawer içinde tutulur ve kapanınca açan kontrole döner.
 */
export function MobileMenu() {
  const { isOpen, closePanel, openPanel } = usePanels()
  const { isLoggedIn, account, discountEligible } = useAccount()
  const { count } = useFavorites()
  const [shopOpen, setShopOpen] = useState(true)
  const close = () => closePanel('menu')
  const campaign = siteSettings.memberDiscount

  return (
    <Drawer open={isOpen('menu')} onClose={close} title={S.common.menu} side="left" closeLabel={S.header.closeMenu}>
      <nav aria-label={S.common.menu}>
        <ul className={styles.list}>
          <li>
            <button type="button" className={styles.item} aria-expanded={shopOpen} aria-controls="site-menu-shop-list" onClick={() => setShopOpen((v) => !v)}>
              <span>{S.header.shop}</span>
              <Icon name={shopOpen ? 'minus' : 'plus'} size={16} />
            </button>
            <ul id="site-menu-shop-list" className={styles.sub} hidden={!shopOpen}>
              <li>
                <NavLink to="/koleksiyon" end className={({ isActive }) => [styles.subLink, isActive ? styles.subLinkActive : ''].join(' ').trim()} onClick={close}>
                  {S.header.allProducts}
                </NavLink>
              </li>
              {categories
                .filter((c) => c.id !== 'tum-urunler')
                .map((c) => (
                  <li key={c.id}>
                    <NavLink
                      to={`/koleksiyon/${c.id}`}
                      className={({ isActive }) => [styles.subLink, isActive ? styles.subLinkActive : ''].join(' ').trim()}
                      onClick={close}
                    >
                      {c.label}
                    </NavLink>
                  </li>
                ))}
            </ul>
          </li>
          <li>
            <Link to="/koleksiyon" className={styles.item} onClick={close}>
              <span>{S.header.collections}</span>
              <Icon name="chevron-right" size={16} />
            </Link>
          </li>
          <li>
            <Link to="/#uretim" className={styles.item} onClick={close}>
              <span>{S.header.production}</span>
              <Icon name="chevron-right" size={16} />
            </Link>
          </li>
        </ul>

        <div className={styles.group}>
          <div className={styles.groupTitle}>{S.header.account}</div>
          <ul className={styles.list}>
            <li>
              <Link to={isLoggedIn ? '/hesap' : '/giris'} className={styles.item} onClick={close}>
                <span>{isLoggedIn && account ? account.name : S.header.account}</span>
                <Icon name="user" size={18} />
              </Link>
            </li>
            <li>
              <Link to="/favoriler" className={styles.item} onClick={close}>
                <span>
                  {S.header.favorites}
                  {count > 0 ? <span className={styles.badge}> ({count})</span> : null}
                </span>
                <Icon name="heart" size={18} />
              </Link>
            </li>
            <li>
              <button
                type="button"
                className={styles.item}
                onClick={() => {
                  closePanel('menu')
                  openPanel('support')
                }}
              >
                <span>{S.header.support}</span>
                <Icon name="whatsapp" size={18} />
              </button>
            </li>
          </ul>
        </div>

        <div className={styles.meta}>
          <div className={styles.lang} role="group" aria-label={S.locale.switchLabel}>
            <a href={pathForLocale('tr')} aria-current={locale === 'tr' ? 'true' : undefined} lang="tr" hrefLang="tr">
              {S.locale.tr}
            </a>
            <span aria-hidden="true">|</span>
            <a href={pathForLocale('en')} aria-current={locale === 'en' ? 'true' : undefined} lang="en" hrefLang="en">
              {S.locale.en}
            </a>
          </div>
          <span>{siteSettings.currency.symbol}</span>
        </div>

        {campaign.enabled && !isLoggedIn ? (
          <Link to="/kayit" className={styles.offer} onClick={close}>
            {S.account.topStripOffer} — <u>{S.account.topStripAction}</u>
          </Link>
        ) : campaign.enabled && discountEligible ? (
          <p className={styles.offer}>{S.account.topStripMember}</p>
        ) : null}
      </nav>
    </Drawer>
  )
}
