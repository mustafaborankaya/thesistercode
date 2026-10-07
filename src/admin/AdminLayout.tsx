import { useRef, useState, type MouseEvent } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { localeBasename } from '../i18n'
import { useApiMode } from './adminApi'
import { currentAdmin, isOwner, logoutAdmin } from './adminAuth'
import { AS } from './adminStrings'
import { AdminIcon, type AdminIconName } from './ui/AdminIcon'
import { Btn } from './ui/Button'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { UnsavedProvider } from './ui/StickySaveBar'
import { useUnsavedState } from './ui/unsaved'
import ui from './ui/ui.module.css'
import styles from './AdminLayout.module.css'

interface NavItem {
  to: string
  label: string
  icon: AdminIconName
  end?: boolean
}

function navGroups(): { label: string | null; items: NavItem[] }[] {
  const owner = isOwner()
  return [
    {
      label: null,
      items: [
        { to: '/admin', label: AS.nav.dashboard, icon: 'dashboard', end: true },
        { to: '/admin/analitik', label: AS.nav.analytics, icon: 'chart' },
      ],
    },
    {
      label: AS.nav.groupSales,
      items: [
        { to: '/admin/siparisler', label: AS.nav.orders, icon: 'orders' },
        { to: '/admin/kuponlar', label: AS.nav.coupons, icon: 'coupons' },
        { to: '/admin/musteriler', label: AS.nav.customers, icon: 'customers' },
      ],
    },
    {
      label: AS.nav.groupCatalog,
      items: [
        { to: '/admin/urunler', label: AS.nav.products, icon: 'products' },
        { to: '/admin/icerik', label: AS.nav.content, icon: 'content' },
        { to: '/admin/gorseller', label: AS.nav.media, icon: 'images' },
      ],
    },
    {
      label: AS.nav.groupSystem,
      items: [
        { to: '/admin/ayarlar', label: AS.nav.settings, icon: 'settings' },
        // Kullanıcı yönetimi yalnızca API modunda ve sahip rolünde; Veri yalnızca sahipte (editör 403 alır).
        ...(useApiMode && owner ? [{ to: '/admin/kullanicilar', label: AS.nav.users, icon: 'users' as const }] : []),
        ...(owner ? [{ to: '/admin/veri', label: AS.nav.data, icon: 'data' as const }] : []),
      ],
    },
  ]
}

const COLLAPSE_KEY = 'tsc.admin.sidebarCollapsed'

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === '1'
  } catch {
    return false
  }
}

interface AdminLayoutProps {
  onLogout: () => void
}

/** Panel kabuğu: solda daraltılabilir ikonlu menü (mobilde çekmece), üstte eylem çubuğu, ortada içerik. */
export function AdminLayout(props: AdminLayoutProps) {
  return (
    <UnsavedProvider>
      <Shell {...props} />
    </UnsavedProvider>
  )
}

function Shell({ onLogout }: AdminLayoutProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const unsaved = useUnsavedState()
  const isMobile = useMediaQuery('(max-width: 1023px)')
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [pendingHref, setPendingHref] = useState<string | null>(null)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const sidebarRef = useRef<HTMLElement>(null)
  useFocusTrap(sidebarRef, isMobile && mobileOpen)

  // Rota değişince mobil çekmeceyi kapat (render sırasında önceki değerle karşılaştırma).
  const [prevPath, setPrevPath] = useState(location.pathname)
  if (prevPath !== location.pathname) {
    setPrevPath(location.pathname)
    if (mobileOpen) setMobileOpen(false)
  }

  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
      } catch {
        /* depolama kapalıysa yalnızca bu oturumda */
      }
      return next
    })
  }

  function doLogout() {
    setConfirmLogout(false)
    void logoutAdmin().finally(onLogout)
  }

  /** Kaydedilmemiş değişiklik varken panel içi bağlantılar onay ister (BrowserRouter → useBlocker yok). */
  function onClickCapture(e: MouseEvent) {
    if (!unsaved || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    const a = (e.target as HTMLElement).closest('a[href]') as HTMLAnchorElement | null
    if (!a || a.target === '_blank' || a.hasAttribute('download')) return
    const url = new URL(a.href, window.location.href)
    if (url.origin !== window.location.origin) return
    const base = localeBasename === '/' ? '' : localeBasename
    const path = (base && url.pathname.startsWith(base) ? url.pathname.slice(base.length) : url.pathname) + url.search + url.hash
    if (path === location.pathname + location.search + location.hash) return
    e.preventDefault()
    e.stopPropagation()
    setPendingHref(path)
  }

  const showCollapsed = collapsed && !isMobile
  const role = currentAdmin?.role
  const roleLabel = role === 'owner' ? AS.nav.roleOwner : role === 'editor' ? AS.nav.roleEditor : AS.nav.roleLocal

  return (
    <div
      className={[ui.theme, styles.shell, showCollapsed ? styles.collapsed : ''].join(' ')}
      style={{ ['--save-left' as string]: isMobile ? '0px' : showCollapsed ? 'var(--a-sidebar-collapsed)' : 'var(--a-sidebar)' }}
      onClickCapture={onClickCapture}
    >
      <a href="#admin-main" className={styles.skip}>
        {AS.skipToContent}
      </a>

      {isMobile && mobileOpen ? <div className={styles.scrim} onClick={() => setMobileOpen(false)} aria-hidden="true" /> : null}

      <aside
        ref={sidebarRef}
        className={[styles.sidebar, isMobile ? styles.sidebarMobile : '', isMobile && mobileOpen ? styles.sidebarOpen : ''].join(' ')}
        aria-label={AS.nav.ariaLabel}
        aria-hidden={isMobile && !mobileOpen ? true : undefined}
        inert={isMobile && !mobileOpen ? true : undefined}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && isMobile && mobileOpen) setMobileOpen(false)
        }}
      >
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            T
          </span>
          <span className={styles.brandText}>
            <span className={styles.brandName}>{AS.headerTitle}</span>
            <span className={styles.brandSub}>{AS.headerSub}</span>
          </span>
          {isMobile ? <Btn variant="ghost" size="sm" icon="close" iconOnly label={AS.nav.close} onClick={() => setMobileOpen(false)} className={styles.brandClose} /> : null}
        </div>
        <nav className={styles.nav}>
          {navGroups().map((group, gi) => (
            <div key={gi} className={styles.navGroup}>
              {group.label ? <div className={styles.navGroupLabel}>{group.label}</div> : null}
              <ul className={styles.navList}>
                {group.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) => [styles.navLink, isActive ? styles.navLinkActive : ''].join(' ').trim()}
                      title={showCollapsed ? item.label : undefined}
                      aria-label={showCollapsed ? item.label : undefined}
                    >
                      <AdminIcon name={item.icon} size={20} />
                      <span className={styles.navText}>{item.label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        {!isMobile ? (
          <button type="button" className={styles.collapseBtn} onClick={toggleCollapsed} aria-expanded={!collapsed} title={collapsed ? AS.nav.expand : AS.nav.collapse}>
            <AdminIcon name={collapsed ? 'expand' : 'collapse'} size={20} />
            <span className={styles.navText}>{collapsed ? AS.nav.expand : AS.nav.collapse}</span>
          </button>
        ) : null}
      </aside>

      <div className={styles.main}>
        <header className={styles.topbar}>
          {isMobile ? (
            <>
              <Btn variant="ghost" icon="menu" iconOnly label={AS.nav.open} onClick={() => setMobileOpen(true)} aria-expanded={mobileOpen} />
              <span className={styles.topBrand}>{AS.headerTitle}</span>
            </>
          ) : null}
          {useApiMode ? null : <span className={styles.demoBadge} title={AS.demoNotice}>{AS.demoBadge}</span>}
          <div className={styles.topActions}>
            <a className={[ui.btn, ui.btnGhost, styles.storeLink].join(' ')} href="/" target="_blank" rel="noopener noreferrer">
              <AdminIcon name="store" size={18} />
              <span className={styles.hideSm}>{AS.backToStore}</span>
              <span className="sr-only">(yeni sekmede açılır)</span>
            </a>
            <span className={styles.user}>
              <span className={styles.avatar} aria-hidden="true">
                <AdminIcon name="user" size={16} />
              </span>
              <span className={styles.userText}>
                <span className={styles.userName}>{currentAdmin?.username ?? 'admin'}</span>
                <span className={styles.userRole}>{roleLabel}</span>
              </span>
            </span>
            <Btn variant="ghost" icon="logout" onClick={() => (unsaved ? setConfirmLogout(true) : doLogout())} label={AS.logout} iconOnly={isMobile}>
              {AS.logout}
            </Btn>
          </div>
        </header>
        <main id="admin-main" className={styles.content} tabIndex={-1}>
          <div className={styles.container}>
            <Outlet />
          </div>
        </main>
      </div>

      <ConfirmDialog
        open={pendingHref != null}
        title={AS.ui.leaveTitle}
        message={AS.ui.leaveText}
        confirmLabel={AS.ui.leaveConfirm}
        cancelLabel={AS.ui.leaveCancel}
        tone="danger"
        onCancel={() => setPendingHref(null)}
        onConfirm={() => {
          const href = pendingHref
          setPendingHref(null)
          if (href) navigate(href)
        }}
      />
      <ConfirmDialog
        open={confirmLogout}
        title={AS.ui.leaveTitle}
        message={AS.ui.leaveText}
        confirmLabel={AS.logout}
        cancelLabel={AS.ui.leaveCancel}
        tone="danger"
        onCancel={() => setConfirmLogout(false)}
        onConfirm={doLogout}
      />
    </div>
  )
}
