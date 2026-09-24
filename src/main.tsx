import { createRoot } from 'react-dom/client'
import { hydrateAdminData } from './admin/adminStore'
import { loadRemoteData } from './data/remote'
import './styles/base.css'

/**
 * Yönetici panelinden yüklenen görseller (IndexedDB), localStorage override'ları VE backend API'den
 * gelen gerçek veri (ürün/içerik/ayar), katalog/ayar modülleri değerlendirilmeden önce hazır olmalı;
 * bu yüzden uygulama ağacı dinamik olarak yüklenir. `loadRemoteData` kendi içinde hataları yutar
 * (API yoksa `remote` null kalır) ama burada da `.catch` ile ekstra güvenlik sağlanır.
 */
Promise.all([hydrateAdminData().catch(() => undefined), loadRemoteData().catch(() => undefined)])
  .then(() => import('./Root'))
  .then(({ Root }) => {
    createRoot(document.getElementById('root')!).render(<Root />)
  })
