import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AdminLayout } from './AdminLayout'
import { AdminLogin } from './AdminLogin'
import { isAdminSession } from './adminStore'
import { verifyAdminSession } from './adminAuth'
import { AS } from './adminStrings'
import { Dashboard } from './pages/Dashboard'
import { ContentPage } from './pages/ContentPage'
import { DataPage } from './pages/DataPage'
import { OrdersPage } from './pages/OrdersPage'
import { ProductEditPage } from './pages/ProductEditPage'
import { ProductsPage } from './pages/ProductsPage'
import { SettingsPage } from './pages/SettingsPage'

/**
 * Yönetici paneli kök bileşeni — mağaza `<Layout>` düzeninin dışında, `/admin/*` altında ayrı bir
 * kabukla render edilir (bkz. src/App.tsx). Oturum yoksa tüm rotalar girişe yönlendirilir.
 */
export function AdminApp() {
  const [session, setSession] = useState(() => isAdminSession())

  useEffect(() => {
    document.title = AS.documentTitle
    // Sunucu oturumunu doğrula (çerez süresi dolduysa girişe düşer)
    verifyAdminSession(isAdminSession()).then((ok) => setSession(ok))
  }, [])

  if (!session) {
    return (
      <Routes>
        <Route path="giris" element={<AdminLogin onLogin={() => setSession(true)} />} />
        <Route path="*" element={<Navigate to="/admin/giris" replace />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route path="giris" element={<Navigate to="/admin" replace />} />
      <Route element={<AdminLayout onLogout={() => setSession(false)} />}>
        <Route index element={<Dashboard />} />
        <Route path="urunler" element={<ProductsPage />} />
        <Route path="urunler/:id" element={<ProductEditPage />} />
        <Route path="icerik" element={<ContentPage />} />
        <Route path="ayarlar" element={<SettingsPage />} />
        <Route path="siparisler" element={<OrdersPage />} />
        <Route path="veri" element={<DataPage />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>
    </Routes>
  )
}
