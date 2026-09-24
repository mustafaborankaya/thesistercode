import { StrictMode } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { locale, localeBasename, localeMeta } from './i18n'
import { AccountProvider } from './state/AccountContext'
import { CartProvider } from './state/CartContext'
import { ConsentProvider } from './state/ConsentContext'
import { FavoritesProvider } from './state/FavoritesContext'
import { PanelProvider } from './state/PanelContext'

/** Sağlayıcı ağacı. main.tsx bu modülü yönetici verisi yüklendikten sonra dinamik olarak içe aktarır. */
export function Root() {
  document.documentElement.lang = localeMeta[locale].lang
  return (
    <StrictMode>
      <BrowserRouter basename={localeBasename}>
        <ConsentProvider>
          <PanelProvider>
            <AccountProvider>
              <FavoritesProvider>
                <CartProvider>
                  <App />
                </CartProvider>
              </FavoritesProvider>
            </AccountProvider>
          </PanelProvider>
        </ConsentProvider>
      </BrowserRouter>
    </StrictMode>
  )
}
