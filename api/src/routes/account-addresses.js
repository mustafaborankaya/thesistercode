/**
 * Müşteri adres defteri — `/account/addresses` (hepsi requireCustomer).
 * app.js'te `/account` router'ından ÖNCE bağlanır. Başka müşterinin adresi ya da var olmayan / biçimi
 * bozuk id → ayırt edilemez 404.
 */
import { Router } from 'express'
import { z } from 'zod'
import { requireCustomer } from '../auth.js'
import { parseBody, notFound } from '../errors.js'
import * as customersService from '../services/customers.js'

const router = Router()
router.use(requireCustomer)

const ADDRESS_ID_RE = /^\d+$/

// Kurallar routes/orders.js'teki `delivery` şemasıyla aynı (note hariç); telefon `contact.phone` kuralı.
const addressSchema = z.object({
  label: z.string().max(60).nullish(),
  firstName: z.string().min(1, 'Ad gerekli').max(100),
  lastName: z.string().min(1, 'Soyad gerekli').max(100),
  phone: z.string().min(5, 'Geçerli bir telefon numarası girin').max(32),
  address: z.string().min(1, 'Adres gerekli').max(2000),
  district: z.string().min(1, 'İlçe gerekli').max(100),
  city: z.string().min(1, 'Şehir gerekli').max(100),
  postalCode: z.string().min(1, 'Posta kodu gerekli').max(20),
  country: z.string().min(1).max(100).default('Türkiye'),
  isDefault: z.boolean().optional(),
})

function addressId(req) {
  const raw = req.params.id
  if (!ADDRESS_ID_RE.test(raw) || raw.length > 10) return null
  const id = Number(raw)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

const addressNotFound = () => notFound('Adres bulunamadı')

router.get('/', async (req, res, next) => {
  try {
    res.json({ addresses: await customersService.listAddresses(req.customer.id) })
  } catch (err) {
    next(err)
  }
})

router.post('/', async (req, res, next) => {
  try {
    const input = parseBody(addressSchema, req.body)
    const address = await customersService.createAddress(req.customer.id, input)
    res.status(201).json({ address })
  } catch (err) {
    next(err)
  }
})

router.put('/:id', async (req, res, next) => {
  try {
    const id = addressId(req)
    if (!id) return next(addressNotFound())
    const input = parseBody(addressSchema, req.body)
    const address = await customersService.updateAddress(req.customer.id, id, input)
    if (!address) return next(addressNotFound())
    res.json({ address })
  } catch (err) {
    next(err)
  }
})

router.delete('/:id', async (req, res, next) => {
  try {
    const id = addressId(req)
    if (!id) return next(addressNotFound())
    const ok = await customersService.deleteAddress(req.customer.id, id)
    if (!ok) return next(addressNotFound())
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

router.post('/:id/default', async (req, res, next) => {
  try {
    const id = addressId(req)
    if (!id) return next(addressNotFound())
    const address = await customersService.setDefaultAddress(req.customer.id, id)
    if (!address) return next(addressNotFound())
    res.json({ address })
  } catch (err) {
    next(err)
  }
})

export default router
