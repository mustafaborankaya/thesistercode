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
