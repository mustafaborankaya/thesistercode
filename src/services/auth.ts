/**
 * Üyelik servisi sınırı.
 * Demo sağlayıcı hiçbir veriyi sunucuya göndermez; şifre saklanmaz ve loglanmaz.
 * Gerçek üyelik servisi bağlanınca yalnızca `authProvider` ataması değişir.
 */

export type AuthResult = { ok: true } | { ok: false; error: 'invalid-email' | 'password-short' | 'not-found' | 'unknown' }

export interface AuthProvider {
  register(input: { name: string; email: string; password: string }): Promise<AuthResult>
  login(input: { email: string; password: string; knownAccount: boolean }): Promise<AuthResult>
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
}

export const authProvider: AuthProvider = demoAuthProvider
