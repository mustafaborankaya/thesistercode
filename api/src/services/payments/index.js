/**
 * Ödeme sağlayıcısı seçimi — PAYMENT_PROVIDER (env):
 *   none   → çevrim içi ödeme yok; sipariş eskisi gibi 'new' oluşur (varsayılan)
 *   iyzico → iyzico Ödeme Formu (IYZICO_API_KEY / IYZICO_SECRET_KEY / IYZICO_BASE_URL)
 *   fake   → yerel uçtan uca test (üretimde env.js reddeder)
 */
import { env, isProd, siteUrl } from '../../env.js'
import { createIyzicoProvider } from './iyzico.js'
import { createFakeProvider } from './fake.js'

let cached = null

/** Etkin sağlayıcı ya da `null` (none). Tek örnek (singleton). */
export function getProvider() {
  if (env.PAYMENT_PROVIDER === 'none') return null
  if (cached) return cached
  if (env.PAYMENT_PROVIDER === 'iyzico') {
    cached = createIyzicoProvider({ apiKey: env.IYZICO_API_KEY, secretKey: env.IYZICO_SECRET_KEY, baseUrl: env.IYZICO_BASE_URL })
  } else if (env.PAYMENT_PROVIDER === 'fake' && !isProd) {
    cached = createFakeProvider({ publicApiBase: `${siteUrl}/api` })
  }
  return cached
}

/** Test için: sağlayıcıyı değiştir (ör. sahte SDK istemcili iyzico). */
export function setProviderForTests(provider) {
  cached = provider
}

export function paymentsEnabled() {
  return env.PAYMENT_PROVIDER !== 'none'
}

/** Mağazaya (public /settings) yansıtılan sağlayıcı adı. */
export function publicProviderName() {
  return env.PAYMENT_PROVIDER
}

export { setFakeOutcome } from './fake.js'
