/** Yönetici: stok özeti — düşük stok / tükenen varyantlar (eşik: settings `inventory.lowStockThreshold`). */
import { Router } from 'express'
import * as productsService from '../services/products.js'
import { requireAdmin } from '../auth.js'

const router = Router()
router.use(requireAdmin)

router.get('/', async (req, res, next) => {
  try {
    res.json(await productsService.getInventorySummary())
  } catch (err) {
    next(err)
  }
})

export default router
