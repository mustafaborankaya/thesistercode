import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AdminLayout } from './AdminLayout'
import { AdminLogin } from './AdminLogin'
import { isAdminSession } from './adminStore'
import { isOwner, verifyAdminSession } from './adminAuth'
import { useApiMode } from './adminApi'
import { AS } from './adminStrings'
import { ContentPage } from './pages/ContentPage'
import { CouponsPage } from './pages/CouponsPage'
import { CustomersPage } from './pages/CustomersPage'
import { Dashboard } from './pages/Dashboard'
import { DataPage } from './pages/DataPage'
import { MediaPage } from './pages/MediaPage'
import { OrdersPage } from './pages/OrdersPage'
import { ProductEditPage } from './pages/ProductEditPage'
import { ProductsPage } from './pages/ProductsPage'
import { SettingsPage } from './pages/SettingsPage'
import { UsersPage } from './pages/UsersPage'
import { ToastProvider } from './ui/Toast'
import ui from './ui/ui.module.css'
import styles from './admin.module.css'

type SessionState = 'checking' | 'in' | 'out'

/** Giriş sayfasına gönderilirken hedef adres `state.from` ile taşınır; girişten sonra oraya dönülür. */
function RedirectToLogin() {
  const location = useLocation()
  return <Navigate to="/admin/giris" replace state={{ from: location.pathname + location.search }} />
}

function RedirectAfterLogin() {
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from
  return <Navigate to={from && from.startsWith('/admin') && !from.startsWith('/admin/giris') ? from : '/admin'} replace />
}

/**
 * Yönetici paneli kök bileşeni — mağaza `<Layout>` düzeninin dışında, `/admin/*` altında ayrı bir
 * kabukla render edilir (bkz. src/App.tsx). Oturum sunucuda doğrulanana kadar "Yükleniyor" gösterilir
 * (yeni sekmede açılan derin bağlantı Gösterge'ye düşmez); oturum yoksa girişe, girişten sonra hedefe.
 */
export function AdminApp() {
  const [session, setSession] = useState<SessionState>('checking')

  useEffect(() => {
    document.title = AS.documentTitle
    let cancelled = false
    verifyAdminSession(isAdminSession()).then((ok) => {
      if (!cancelled) setSession(ok ? 'in' : 'out')
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (session === 'checking') {
    return (
      <div className={[ui.theme, styles.loginShell].join(' ')} role="status" aria-live="polite">
        <span className={ui.row} style={{ color: 'var(--a-ink-soft)' }}>
          <span className={ui.spinner} aria-hidden="true" />
          {AS.ui.sessionChecking}
        </span>
      </div>
    )
  }

  if (session === 'out') {
    return (
      <ToastProvider>
        <Routes>
          <Route path="giris" element={<AdminLogin onLogin={() => setSession('in')} />} />
          <Route path="*" element={<RedirectToLogin />} />
        </Routes>
      </ToastProvider>
    )
  }

  const owner = isOwner()
  return (
    <ToastProvider>
      <Routes>
        <Route path="giris" element={<RedirectAfterLogin />} />
        <Route element={<AdminLayout onLogout={() => setSession('out')} />}>
          <Route index element={<Dashboard />} />
          <Route path="siparisler" element={<OrdersPage />} />
          <Route path="kuponlar" element={<CouponsPage />} />
          <Route path="musteriler" element={<CustomersPage />} />
          <Route path="urunler" element={<ProductsPage />} />
          <Route path="urunler/:id" element={<ProductEditPage />} />
          <Route path="icerik" element={<ContentPage />} />
          <Route path="gorseller" element={<MediaPage />} />
          <Route path="ayarlar" element={<SettingsPage />} />
          {useApiMode && owner ? <Route path="kullanicilar" element={<UsersPage />} /> : null}
          {owner ? <Route path="veri" element={<DataPage />} /> : null}
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>
      </Routes>
    </ToastProvider>
  )
}
