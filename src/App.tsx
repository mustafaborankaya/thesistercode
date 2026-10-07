import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { RouteSeo } from './seo/RouteSeo'

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

/**
 * Mağaza rotaları `RouteSeo` ile sarılır: sayfa başına başlık/açıklama/canonical/hreflang/og/JSON-LD
 * (bkz. src/seo/). Sayfa bileşenleri SEO'dan habersizdir; veri katalog/içerik modüllerinden okunur.
 */
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
        <Route path="/" element={<RouteSeo page="home"><HomePage /></RouteSeo>} />
        <Route path="/koleksiyon" element={<RouteSeo page="collection"><CollectionPage /></RouteSeo>} />
        <Route path="/koleksiyon/:categoryId" element={<RouteSeo page="collection"><CollectionPage /></RouteSeo>} />
        <Route path="/urun/:slug" element={<RouteSeo page="product"><ProductPage /></RouteSeo>} />
        <Route path="/sepet" element={<RouteSeo page="cart"><CartPage /></RouteSeo>} />
        <Route path="/odeme" element={<RouteSeo page="checkout"><CheckoutPage /></RouteSeo>} />
        <Route path="/odeme/sonuc/:orderId" element={<RouteSeo page="checkoutResult"><CheckoutResultPage /></RouteSeo>} />
        <Route path="/giris" element={<RouteSeo page="login"><LoginPage /></RouteSeo>} />
        <Route path="/kayit" element={<RouteSeo page="register"><RegisterPage /></RouteSeo>} />
        <Route path="/sifre-sifirla" element={<RouteSeo page="passwordReset"><PasswordResetPage /></RouteSeo>} />
        <Route path="/hesap/dogrula" element={<RouteSeo page="verifyEmail"><VerifyEmailPage /></RouteSeo>} />
        <Route path="/hesap" element={<RouteSeo page="account"><AccountPage /></RouteSeo>} />
        <Route path="/favoriler" element={<RouteSeo page="favorites"><FavoritesPage /></RouteSeo>} />
        <Route path="/arama" element={<RouteSeo page="search"><SearchPage /></RouteSeo>} />
        <Route path="/bilgi/:slug" element={<RouteSeo page="info"><InfoPage /></RouteSeo>} />
        <Route path="*" element={<RouteSeo page="notFound"><NotFoundPage /></RouteSeo>} />
      </Route>
    </Routes>
  )
}
