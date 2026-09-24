/**
 * Üyelik servisi sınırı.
 * `isApiMode()` true ise (açılışta API'ye ulaşıldı YA DA üretimdeyiz — bkz. src/data/remote.ts) gerçek
 * API kullanılır (`POST /account/register|login`, `GET /account/me`, `POST /account/logout`, çerez
 * `tsc_customer`). Yalnızca yerel geliştirmede API gerçekten kapalıyken demo sağlayıcıya düşülür:
 * hiçbir veri sunucuya gönderilmez, şifre saklanmaz ve loglanmaz. Üretimde asla sessiz yerel demo
 * moduna düşülmez (boot sırasında `remote` bir zaman aşımıyla null kalsa bile gerçek istek denenir).
 */
import { isApiMode } from '../data/remote'
import { locale } from '../i18n'
import { apiErrorMessage } from '../i18n/apiMessages'
import { api, ApiError } from './api'

export type AuthResult =
  | { ok: true }
  | { ok: false; error: 'invalid-email' | 'password-short' | 'not-found' | 'email-taken' | 'rate-limited' | 'unknown'; message?: string }

export interface AccountInfo {
  name: string
  email: string
  discountEligible: boolean
}

export interface AuthProvider {
  register(input: { name: string; email: string; password: string }): Promise<AuthResult>
  login(input: { email: string; password: string; knownAccount: boolean }): Promise<AuthResult>
  /** Sunucu oturumundaki güncel hesap bilgisini döner (API modu); demo modda kullanılmaz. */
  me(): Promise<AccountInfo | null>
  logout(): Promise<void>
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
export const MIN_PASSWORD = 8

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

const demoAuthProvider: AuthProvider = {
  async register({ email, password }) {
    await wait(500)
    if (!EMAIL_RE.test(email.trim())) return { ok: false, error: 'invalid-email' }
    if (password.length < MIN_PASSWORD) return { ok: false, error: 'password-short' }
    return { ok: true }
  },
  async login({ email, password, knownAccount }) {
    await wait(400)
    if (!EMAIL_RE.test(email.trim())) return { ok: false, error: 'invalid-email' }
    if (password.length < 1) return { ok: false, error: 'password-short' }
    // Demo: şifre doğrulanamaz (saklanmaz); yalnızca bu tarayıcıda oluşturulmuş hesaplar giriş yapabilir.
    if (!knownAccount) return { ok: false, error: 'not-found' }
    return { ok: true }
  },
  async me() {
    return null
  },
  async logout() {
    /* demo modda sunucu oturumu yok */
  },
}

/** API hatasını LoginPage/RegisterPage'in anladığı sınırlı hata birleşimine çevirir; mesaj EN/TR yerelleştirilir. */
function mapApiError(e: unknown): AuthResult {
  if (e instanceof ApiError) {
    const message = apiErrorMessage(e)
    if (e.status === 401) return { ok: false, error: 'not-found', message }
    if (e.status === 409) return { ok: false, error: 'email-taken', message }
    if (e.status === 429) return { ok: false, error: 'rate-limited', message }
    if (e.status === 400) {
      const lower = e.message.toLowerCase()
      if (lower.includes('parola')) return { ok: false, error: 'password-short', message }
      if (lower.includes('e-posta') || lower.includes('email')) return { ok: false, error: 'invalid-email', message }
      return { ok: false, error: 'unknown', message }
    }
  }
  return { ok: false, error: 'unknown' }
}

const apiAuthProvider: AuthProvider = {
  async register({ name, email, password }) {
    try {
      // `locale` e-posta dilini belirler (hoş geldin/doğrulama e-postası) — sunucu isteğe bağlı kabul eder.
      await api('/account/register', { method: 'POST', body: { name, email, password, locale } })
      return { ok: true }
    } catch (e) {
      return mapApiError(e)
    }
  },
  async login({ email, password }) {
    try {
      await api('/account/login', { method: 'POST', body: { email, password } })
      return { ok: true }
    } catch (e) {
      return mapApiError(e)
    }
  },
  async me() {
    try {
      const res = await api<{ customer: { id: number; email: string; name: string; discountEligible: boolean } }>('/account/me')
      return { name: res.customer.name, email: res.customer.email, discountEligible: res.customer.discountEligible }
    } catch {
      return null
    }
  },
  async logout() {
    try {
      await api('/account/logout', { method: 'POST' })
    } catch {
      /* sunucuya ulaşılamasa da yerel oturum kapanır */
    }
  },
}

export const authProvider: AuthProvider = isApiMode() ? apiAuthProvider : demoAuthProvider

/* ---------------- Parola sıfırlama / e-posta doğrulama ---------------- */
/** Yalnızca API modunda anlamlıdır; demo modda backend olmadığı için istek başarısız olur (ağ hatası olarak gösterilir). */

export type SimpleResult = { ok: true } | { ok: false; error: string; message: string }

/** `POST /account/password/forgot` — sunucu her zaman `{ ok: true }` döner (e-postanın var olup olmadığını sızdırmaz). */
export async function requestPasswordReset(email: string): Promise<SimpleResult> {
  try {
    await api('/account/password/forgot', { method: 'POST', body: { email, locale } })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.code : 'network', message: apiErrorMessage(e) }
  }
}

/** `POST /account/password/reset` — geçersiz/süresi dolmuş jeton 400 `invalid_token` döner. */
export async function resetPassword(token: string, password: string): Promise<SimpleResult> {
  try {
    await api('/account/password/reset', { method: 'POST', body: { token, password } })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.code : 'network', message: apiErrorMessage(e) }
  }
}

/** `POST /account/verify-email` — geçersiz/süresi dolmuş jeton 400 `invalid_token` döner. */
export async function verifyEmailToken(token: string): Promise<SimpleResult> {
  try {
    await api('/account/verify-email', { method: 'POST', body: { token } })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.code : 'network', message: apiErrorMessage(e) }
  }
}
