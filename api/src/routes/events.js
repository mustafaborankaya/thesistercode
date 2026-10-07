/**
 * Birinci taraf analitik olay toplama — `POST /events` (herkese açık; auth yok, originCheck'ten geçer).
 * Gövde `{ events: [...] }` (≤20). Yanıt her zaman 204; yalnızca geçersiz gövde 400. Bot UA'ları
 * (bot|crawler|spider|headless|lighthouse|curl|wget|python-requests) sessizce 204 ile atlanır.
 * IP ve ham User-Agent saklanmaz; `is_member` yalnızca geçerli müşteri çerezi varsa 1'dir.
 */
import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { optionalCustomer } from '../auth.js'
import { isBotUserAgent, normalizeBatch, insertEvents, maybePrune } from '../services/analytics.js'

const router = Router()

// Sayfa başına birkaç olay + 2 sn debounce ile normal gezinme dakikada birkaç isteği geçmez.
const eventsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'rate_limited', message: 'Çok fazla istek. Lütfen daha sonra tekrar deneyin.' } },
})

router.post('/', eventsLimiter, optionalCustomer, async (req, res, next) => {
  try {
    const ua = req.get('user-agent') || ''
    if (isBotUserAgent(ua)) return res.sendStatus(204)

    const rows = normalizeBatch(req.body, { ua, isMember: Boolean(req.customer) })
    if (rows.length) await insertEvents(rows)
    // Saklama süresini aşan satırlar her ~200 istekte bir silinir; yanıtı bekletmez.
    maybePrune()
    res.sendStatus(204)
  } catch (err) {
    next(err)
  }
})

export default router
