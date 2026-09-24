/**
 * Ortam değişkenleri — dotenv ile yükler ve zod ile doğrular.
 * NOT: Passenger bazı kurulumlarda server.js'i require() ile yükleyebilir; bu yüzden bu dosyada ve
 * import zincirinde top-level await KULLANILMAZ (Node 22 CJS-require-ESM için buna izin vermez).
 */
import { config as loadDotenv } from 'dotenv'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { z } from 'zod'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// api/.env — çalışma dizininden bağımsız, bu dosyanın konumuna göre çözülür.
loadDotenv({ path: path.join(__dirname, '..', '.env') })

const schema = z.object({
  // Üretimde .env her zaman NODE_ENV=production set eder; varsayılan yine de 'production'dır
  // (fail-safe: NODE_ENV yanlışlıkla tanımsız kalırsa çerez `secure` bayrağı gibi üretim
  // sıkılaştırmaları sessizce DEVRE DIŞI KALMAZ — "development"a değil güvenli tarafa düşer).
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  PORT: z.coerce.number().int().positive().default(3000),
  DB_HOST: z.string().min(1, 'DB_HOST gerekli'),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_NAME: z.string().min(1, 'DB_NAME gerekli'),
  DB_USER: z.string().min(1, 'DB_USER gerekli'),
  DB_PASSWORD: z.string().default(''),
  SESSION_SECRET: z.string().min(16, 'SESSION_SECRET en az 16 karakter olmalı'),
  ADMIN_USERNAME: z.string().min(1, 'ADMIN_USERNAME gerekli'),
  ADMIN_PASSWORD: z.string().min(8, 'ADMIN_PASSWORD en az 8 karakter olmalı'),
  UPLOAD_DIR: z.string().min(1, 'UPLOAD_DIR gerekli'),
  UPLOAD_PUBLIC_BASE: z.string().min(1).default('/uploads'),
  // Virgülle ayrılmış birden çok kaynağa izin verir (örn. "https://teshvikiye.com,https://www.teshvikiye.com").
  CORS_ORIGIN: z.string().min(1, 'CORS_ORIGIN gerekli'),
  /** E-postalardaki bağlantıların kökü (ör. https://teshvikiye.com); yoksa ilk CORS origin'i. */
  SITE_URL: z.string().url().optional(),

  /* ---- Çevrim içi ödeme (bkz. README "Ödeme (iyzico)") ---- */
  // none → mevcut davranış (sipariş 'new', tahsilat yok); iyzico → iyzico Ödeme Formu;
  // fake → yalnızca yerel uçtan uca test (üretimde REDDEDİLİR).
  PAYMENT_PROVIDER: z.enum(['none', 'iyzico', 'fake']).default('none'),
  IYZICO_API_KEY: z.string().optional(),
  IYZICO_SECRET_KEY: z.string().optional(),
  IYZICO_BASE_URL: z.string().url().default('https://sandbox-api.iyzipay.com'),
  // Virgülle ayrılmış taksit seçenekleri (iyzico: 1,2,3,6,9,12). Panel ayarı `payment.installments` doluysa o geçerlidir.
  PAYMENT_INSTALLMENTS: z
    .string()
    .default('1')
    .refine(
      (v) => v.split(',').every((s) => ['1', '2', '3', '6', '9', '12'].includes(s.trim())),
      'PAYMENT_INSTALLMENTS yalnızca 1,2,3,6,9,12 içerebilir',
    ),
}).superRefine((v, ctx) => {
  if (v.PAYMENT_PROVIDER === 'iyzico') {
    if (!v.IYZICO_API_KEY) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['IYZICO_API_KEY'], message: 'PAYMENT_PROVIDER=iyzico iken gerekli' })
    if (!v.IYZICO_SECRET_KEY) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['IYZICO_SECRET_KEY'], message: 'PAYMENT_PROVIDER=iyzico iken gerekli' })
  }
  if (v.PAYMENT_PROVIDER === 'fake' && v.NODE_ENV === 'production') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['PAYMENT_PROVIDER'], message: 'fake sağlayıcı üretimde kullanılamaz' })
  }
})

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
  // Parola/gizli değerler asla loglanmaz — yalnızca alan adları ve hata mesajları yazılır.
  console.error(`[env] Ortam değişkenleri eksik veya hatalı: ${issues}`)
  throw new Error(`Ortam değişkenleri eksik veya hatalı: ${issues}`)
}

export const env = parsed.data
export const isProd = env.NODE_ENV === 'production'

/** CORS_ORIGIN, virgülle ayrılmış birden çok izinli origin içerebilir (ör. apex + www). */
export const corsOrigins = env.CORS_ORIGIN.split(',')
  .map((s) => s.trim())
  .filter(Boolean)

/** Env'deki taksit seçenekleri (sıralı, tekil). */
export const envInstallments = [...new Set(env.PAYMENT_INSTALLMENTS.split(',').map((s) => Number(s.trim())))].sort((a, b) => a - b)

/** E-posta bağlantıları için site kökü (sondaki / atılır). */
export const siteUrl = (env.SITE_URL || corsOrigins[0] || 'https://teshvikiye.com').replace(/\/+$/, '')
