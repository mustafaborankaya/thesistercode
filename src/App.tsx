import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/layout/Layout'

/** Yönetici paneli mağaza düzeninin dışında, ayrı bir kabukla ve yalnızca gerektiğinde yüklenir. */
const AdminApp = lazy(() => import('./admin/AdminApp').then((m) => ({ default: m.AdminApp })))
import { AccountPage } from './pages/AccountPage'
import { CartPage } from './pages/CartPage'
import { CheckoutPage } from './pages/CheckoutPage'
import { CheckoutResultPage } from './pages/CheckoutResultPage'
import { CollectionPage } from './pages/CollectionPage'
import { FavoritesPage } from './pages/FavoritesPage'
import { HomePage } from './pages/HomePage'
import { InfoPage } from './pages/InfoPage'
import { LoginPage } from './pages/LoginPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { PasswordResetPage } from './pages/PasswordResetPage'
import { ProductPage } from './pages/ProductPage'
import { RegisterPage } from './pages/RegisterPage'
import { SearchPage } from './pages/SearchPage'
import { VerifyEmailPage } from './pages/VerifyEmailPage'

export function App() {
  return (
    <Routes>
      {/* Eski panel yolu → /admin */}
      <Route path="/yonetim/*" element={<Navigate to="/admin" replace />} />
      <Route
        path="/admin/*"
        element={
          <Suspense fallback={null}>
            <AdminApp />
          </Suspense>
        }
      />
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/koleksiyon" element={<CollectionPage />} />
        <Route path="/koleksiyon/:categoryId" element={<CollectionPage />} />
        <Route path="/urun/:slug" element={<ProductPage />} />
        <Route path="/sepet" element={<CartPage />} />
        <Route path="/odeme" element={<CheckoutPage />} />
        <Route path="/odeme/sonuc/:orderId" element={<CheckoutResultPage />} />
        <Route path="/giris" element={<LoginPage />} />
        <Route path="/kayit" element={<RegisterPage />} />
        <Route path="/sifre-sifirla" element={<PasswordResetPage />} />
        <Route path="/hesap/dogrula" element={<VerifyEmailPage />} />
        <Route path="/hesap" element={<AccountPage />} />
        <Route path="/favoriler" element={<FavoritesPage />} />
        <Route path="/arama" element={<SearchPage />} />
        <Route path="/bilgi/:slug" element={<InfoPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
