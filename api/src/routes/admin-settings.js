/** Yönetici: site ayarları (settings). */
import { Router } from 'express'
import { z } from 'zod'
import * as settingsService from '../services/settings.js'
import { requireAdmin } from '../auth.js'
import { parseBody, badRequest, zodMessage } from '../errors.js'

const router = Router()
router.use(requireAdmin)

// Ayar değerleri anahtar başına serbest biçimlidir (obje, sayı, string, null); yalnızca anahtar adı sınırlanır.
const settingsSchema = z.record(z.string().min(1).max(120), z.unknown())

/**
 * Bilinen anahtarlar için tip doğrulaması (bkz. src/config/settings.ts → defaultSettings).
 * Amaç: örn. "shipping.amount" alanına yanlışlıkla string gönderilip kargonun sessizce
 * "tanımsız" hale gelmesi gibi veri bozulmalarını PUT anında engellemek. `.partial()` kullanılan
 * obje alanlarında yalnızca gönderilen anahtarlar doğrulanır (kısmi güncellemeye izin verir).
 */
const KNOWN_SETTINGS_SCHEMAS = {
  'brand.name': z.string().min(1),
  'brand.shortName': z.string().min(1),
  memberDiscount: z
    .object({
      enabled: z.boolean(),
      percent: z.number().min(0).max(100),
      mode: z.enum(['automatic', 'code']),
      code: z.string().nullable(),
      minSubtotal: z.number().min(0).nullable(),
      usageLimit: z.number().int().min(0).nullable(),
      expiresAt: z.string().nullable(),
    })
    .partial(),
  'shipping.amount': z.number().min(0).nullable(),
  'support.whatsappNumber': z.string().nullable(),
  'support.email': z.string().email().nullable(),
  social: z
    .object({
      instagram: z.string().nullable(),
      tiktok: z.string().nullable(),
      pinterest: z.string().nullable(),
    })
    .partial(),
  'offerPanel.delayAfterConsentMs': z.number().int().min(0),
}

router.get('/', async (req, res, next) => {
  try {
    const settings = await settingsService.getSettings()
    res.json({ settings })
  } catch (err) {
    next(err)
  }
})

router.put('/', async (req, res, next) => {
  try {
    const patch = parseBody(settingsSchema, req.body)
    for (const [key, value] of Object.entries(patch)) {
      const knownSchema = KNOWN_SETTINGS_SCHEMAS[key]
      if (!knownSchema) continue
      const result = knownSchema.safeParse(value)
      if (!result.success) throw badRequest(`${key}: ${zodMessage(result.error)}`, 'validation_error')
    }
    const settings = await settingsService.updateSettings(patch)
    res.json({ settings })
  } catch (err) {
    next(err)
  }
})

export default router
