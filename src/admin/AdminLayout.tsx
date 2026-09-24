import { NavLink, Outlet } from 'react-router-dom'
import { logoutAdmin } from './adminAuth'
import { AS } from './adminStrings'
import styles from './AdminLayout.module.css'

const navItems: { to: string; label: string; end?: boolean }[] = [
  { to: '/admin', label: AS.nav.dashboard, end: true },
  { to: '/admin/urunler', label: AS.nav.products },
  { to: '/admin/icerik', label: AS.nav.content },
  { to: '/admin/ayarlar', label: AS.nav.settings },
  { to: '/admin/siparisler', label: AS.nav.orders },
  { to: '/admin/veri', label: AS.nav.data },
]

interface AdminLayoutProps {
  onLogout: () => void
}

/** Yönetici paneli kabuğu: üstte başlık/çıkış, solda dikey menü (mobilde üstte yatay). */
export function AdminLayout({ onLogout }: AdminLayoutProps) {
  function handleLogout() {
    void logoutAdmin().finally(onLogout)
  }

  return (
    <div className={styles.shell}>
      <a href="#admin-main" className={styles.skip}>
        {AS.skipToContent}
      </a>
      <header className={styles.topbar}>
        <div>
          <div className={styles.brand}>{AS.headerTitle}</div>
          <p className={styles.demoNotice}>{AS.demoNotice}</p>
        </div>
        <div className={styles.topActions}>
          <a className="link" href="/" target="_blank" rel="noopener noreferrer">
            {AS.backToStore}
          </a>
          <button type="button" className="link" onClick={handleLogout}>
            {AS.logout}
          </button>
        </div>
      </header>
      <div className={styles.body}>
        <nav className={styles.nav} aria-label={AS.nav.ariaLabel}>
          <ul className={styles.navList}>
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.end} className={({ isActive }) => [styles.navLink, isActive ? styles.navLinkActive : ''].join(' ').trim()}>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <main id="admin-main" className={styles.main} tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
