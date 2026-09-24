import { createRoot } from 'react-dom/client'
import { hydrateAdminData } from './admin/adminStore'
import './styles/base.css'

/**
 * Yönetici panelinden yüklenen görseller (IndexedDB) ve override'lar, katalog/ayar modülleri
 * değerlendirilmeden önce hazır olmalı; bu yüzden uygulama ağacı dinamik olarak yüklenir.
 */
hydrateAdminData()
  .catch(() => undefined)
  .then(() => import('./Root'))
  .then(({ Root }) => {
    createRoot(document.getElementById('root')!).render(<Root />)
  })
