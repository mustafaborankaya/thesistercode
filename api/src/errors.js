/** Uygulama genelinde kullanılan hata sınıfı ve merkezi hata işleyici. */

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message)
    this.status = status
    this.code = code
    /** İsteğe bağlı yapılandırılmış ayrıntı (örn. insufficient_stock → varyant listesi); varsa yanıta eklenir. */
    if (details !== undefined) this.details = details
  }
}

export const badRequest = (message = 'Geçersiz istek', code = 'bad_request') => new ApiError(400, code, message)
export const unauthorized = (message = 'Giriş gerekli', code = 'unauthorized') => new ApiError(401, code, message)
export const forbidden = (message = 'Bu işlem için yetkiniz yok', code = 'forbidden') => new ApiError(403, code, message)
export const notFound = (message = 'Kayıt bulunamadı', code = 'not_found') => new ApiError(404, code, message)
export const conflict = (message = 'Çakışma oluştu', code = 'conflict', details) => new ApiError(409, code, message, details)

/** zod SafeParseError'dan Türkçe, okunabilir tek bir hata mesajı üretir. */
export function zodMessage(error) {
  return error.issues.map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message)).join('; ')
}

/** req.body'yi zod şemasıyla doğrular; hata varsa ApiError fırlatır. */
export function parseBody(schema, body) {
  const parsed = schema.safeParse(body)
  if (!parsed.success) throw badRequest(zodMessage(parsed.error), 'validation_error')
  return parsed.data
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    const body = { code: err.code, message: err.message }
    if (err.details !== undefined) body.details = err.details
    return res.status(err.status).json({ error: body })
  }

  if (err?.name === 'MulterError') {
    const messages = {
      LIMIT_FILE_SIZE: 'Dosya çok büyük (en fazla 15 MB).',
      LIMIT_UNEXPECTED_FILE: 'Beklenmeyen dosya alanı.',
    }
    return res.status(400).json({ error: { code: 'upload_error', message: messages[err.code] || 'Dosya yüklenemedi.' } })
  }

  // express.json() gövde ayrıştırma hataları — istemci hatası, sunucu hatası değil.
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'invalid_json', message: 'İstek gövdesi geçerli JSON değil.' } })
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: { code: 'payload_too_large', message: 'İstek gövdesi çok büyük.' } })
  }

  if (err?.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: { code: 'conflict', message: 'Bu kayıt zaten mevcut.' } })
  }

  // Parola veya gizli alanları asla loglama; yalnızca hata mesajını ve yığın izini yaz.
  console.error('[api] beklenmeyen hata:', err?.message || err)
  if (err?.stack) console.error(err.stack)
  res.status(500).json({ error: { code: 'internal_error', message: 'Sunucu hatası oluştu. Lütfen tekrar deneyin.' } })
}

export function notFoundHandler(req, res, next) {
  next(notFound('Uç nokta bulunamadı'))
}
