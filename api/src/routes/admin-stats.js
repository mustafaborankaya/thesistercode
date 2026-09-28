/** Yönetici: gösterge paneli istatistikleri. `?includeNew=1|0` — verilmezse ödeme sağlayıcısı yokken 1. */
import { Router } from 'express'
import { requireAdmin } from '../auth.js'
import { getStats } from '../services/stats.js'
import * as paymentService from '../services/payments/service.js'
import { paymentsEnabled } from '../services/payments/index.js'

const router = Router()
router.use(requireAdmin)

router.get('/', async (req, res, next) => {
  try {
    if (paymentsEnabled()) await paymentService.maybeSweep()
    const q = req.query.includeNew
    const includeNew = q === '1' || q === 'true' ? true : q === '0' || q === 'false' ? false : !paymentsEnabled()
    const stats = await getStats({ includeNew })
    stats.recentOrders = await paymentService.attachPayments(stats.recentOrders)
    res.json(stats)
  } catch (err) {
    next(err)
  }
})

export default router
