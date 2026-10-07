/** Yönetici: analitik özet raporu. `GET /admin/analytics?range=7d|30d|90d|12m` (varsayılan 30d). */
import { Router } from 'express'
import { requireAdmin } from '../auth.js'
import { badRequest } from '../errors.js'
import { ANALYTICS_RANGES, getOverview } from '../services/analytics.js'

const router = Router()
router.use(requireAdmin)

router.get('/', async (req, res, next) => {
  try {
    const range = req.query.range === undefined ? '30d' : String(req.query.range)
    if (!ANALYTICS_RANGES.includes(range)) {
      return next(badRequest(`Geçersiz aralık; izin verilenler: ${ANALYTICS_RANGES.join(', ')}`, 'validation_error'))
    }
    res.json(await getOverview({ range }))
  } catch (err) {
    next(err)
  }
})

export default router
