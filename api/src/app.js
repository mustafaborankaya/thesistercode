/**
 * Express uygulaması.
 * Passenger'ın `PassengerBaseURI /api` isteği uygulamaya `/api/...` ya da `/...` olarak iletmesi
 * ihtimaline karşı router HER İKİ önekte de bağlanır: app.use('/api', router); app.use('/', router).
 */
import express from 'express'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import { env } from './env.js'
import { pingDb } from './db.js'
import { errorHandler, notFoundHandler } from './errors.js'
import { originCheck } from './auth.js'

import publicRoutes from './routes/public.js'
import authRoutes from './routes/auth.js'
import accountRoutes from './routes/account.js'
import ordersRoutes from './routes/orders.js'
import adminProductsRoutes from './routes/admin-products.js'
import adminContentRoutes from './routes/admin-content.js'
import adminSettingsRoutes from './routes/admin-settings.js'
import adminUploadRoutes from './routes/admin-upload.js'
import adminOrdersRoutes from './routes/admin-orders.js'
import adminUsersRoutes from './routes/admin-users.js'
import adminDataRoutes from './routes/admin-data.js'

const PKG_VERSION = '1.0.0'

export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', 1)

  app.use(
    helmet({
      // API JSON yanıtları verir; CSP/CORP sıkılaştırmaları statik dosya sunmayan bir servis için
      // gereksiz kısıtlamalar getirmesin diye devre dışı bırakılır (public_html Apache tarafından sunuluyor).
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  )

  // Basit CORS: yalnızca CORS_ORIGIN'e izin verir, kimlik bilgili (cookie) isteklere izin verir.
  app.use((req, res, next) => {
    const origin = req.get('origin')
    if (origin && origin === env.CORS_ORIGIN) {
      res.setHeader('Access-Control-Allow-Origin', origin)
      res.setHeader('Vary', 'Origin')
      res.setHeader('Access-Control-Allow-Credentials', 'true')
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204)
    next()
  })

  app.use(express.json({ limit: '2mb' }))
  app.use(cookieParser())
  app.use(originCheck)

  const router = express.Router()

  router.get('/health', async (req, res) => {
    const db = await pingDb()
    res.json({ ok: true, db, version: PKG_VERSION })
  })

  router.use('/auth', authRoutes)
  router.use('/account', accountRoutes)
  router.use('/orders', ordersRoutes)
  router.use('/admin/products', adminProductsRoutes)
  router.use('/admin/orders', adminOrdersRoutes)
  router.use('/admin/users', adminUsersRoutes)
  router.use('/admin/settings', adminSettingsRoutes)
  router.use('/admin', adminContentRoutes) // /admin/content, /admin/brand-media
  router.use('/admin', adminUploadRoutes) // /admin/upload
  router.use('/admin', adminDataRoutes) // /admin/export, /admin/import
  router.use(publicRoutes) // /products, /products/:slug, /content, /settings

  app.use('/api', router)
  app.use('/', router)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}

export default createApp
