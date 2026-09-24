import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { siteSettings } from '../../config/settings'
import { brandMedia } from '../../data/media'
import { S } from '../../i18n'
import { Icon } from '../ui/Icon'
import styles from './AuthLayout.module.css'

interface AuthLayoutProps {
  title: string
  lead: string
  children: ReactNode
  /** Form altındaki geçiş satırı ("Hesabınız yok mu? …"). */
  footer: ReactNode
}

/**
 * Giriş ve kayıt sayfalarının ortak kompozisyonu: ortalanmış 440px form sütunu, belirgin sekme geçişi,
 * %10 üyelik faydası. Giriş görseli (giris.jpg) sağlanınca masaüstünde sol yarıda fotoğraf gösterilir.
 */
export function AuthLayout({ title, lead, children, footer }: AuthLayoutProps) {
  const photo = brandMedia.auth
  const tab = (isActive: boolean) => [styles.tab, isActive ? styles.tabActive : ''].join(' ').trim()
  return (
    <div className={styles.page} data-photo={!!photo}>
      {photo ? (
        <div className={styles.visual} aria-hidden="true">
          <img src={photo} alt="" />
        </div>
      ) : null}
      <div className={styles.panel}>
        <div className={styles.inner}>
          <p className={styles.brand}>{siteSettings.brand.name}</p>
          <nav className={styles.tabs} aria-label={S.account.title}>
            <NavLink to="/giris" end className={({ isActive }) => tab(isActive)}>
              {S.account.authTabLogin}
            </NavLink>
            <NavLink to="/kayit" end className={({ isActive }) => tab(isActive)}>
              {S.account.authTabRegister}
            </NavLink>
          </nav>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.lead}>{lead}</p>
          {children}
          {siteSettings.memberDiscount.enabled ? (
            <div className={styles.benefit}>
              <Icon name="check" size={16} />
              <span>{S.account.authBenefit}</span>
            </div>
          ) : null}
          <p className={styles.switch}>{footer}</p>
        </div>
      </div>
    </div>
  )
}
