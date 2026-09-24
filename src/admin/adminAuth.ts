/**
 * Yönetici oturumu — backend API (`/api/auth/*`, httpOnly çerez `tsc_admin`).
 * API'ye ulaşılamıyorsa yalnızca geliştirme ortamında `siteSettings.admin` ile yerel kontrol yapılır;
 * üretimde yerel geri dönüş yoktur.
 */
import { api, ApiError } from '../services/api'
import { setAdminSession } from './adminStore'

export interface AdminUser {
  id: number
  username: string
  role: 'owner' | 'editor'
}

export type AdminLoginResult = { ok: true; user: AdminUser | null; source: 'api' | 'local' } | { ok: false; message: string }

export async function loginAdmin(username: string, password: string): Promise<AdminLoginResult> {
  try {
    const res = await api<{ user: AdminUser }>('/auth/login', { method: 'POST', body: { username, password } })
    setAdminSession(true)
    return { ok: true, user: res.user, source: 'api' }
  } catch (e) {
    const err = e instanceof ApiError ? e : null
    // API yok/ulaşılamıyor → yalnızca geliştirme ortamında yerel kontrol
    if ((!err || err.status === 0 || err.status === 404 || err.status >= 500) && import.meta.env.DEV) {
      // Yerel geliştirme kimliği .env.local (VITE_DEV_ADMIN_USER / VITE_DEV_ADMIN_PASSWORD) ile verilir; derlemeye girmez.
      const devUser = (import.meta.env.VITE_DEV_ADMIN_USER as string | undefined) ?? 'admin'
      const devPass = import.meta.env.VITE_DEV_ADMIN_PASSWORD as string | undefined
      if (devPass && username.trim().toLowerCase() === devUser.toLowerCase() && password === devPass) {
        setAdminSession(true)
        return { ok: true, user: null, source: 'local' }
      }
      return { ok: false, message: 'Kullanıcı adı veya parola hatalı.' }
    }
    if (err && err.status === 401) return { ok: false, message: 'Kullanıcı adı veya parola hatalı.' }
    if (err && err.status === 429) return { ok: false, message: 'Çok fazla deneme; lütfen biraz bekleyin.' }
    return { ok: false, message: err?.message ?? 'Giriş yapılamadı.' }
  }
}

/** Sayfa açılışında sunucu oturumunu doğrular; API yoksa yerel oturum bayrağı (yalnızca DEV) geçerli sayılır. */
export async function verifyAdminSession(localFlag: boolean): Promise<boolean> {
  try {
    const res = await api<{ user: AdminUser | null }>('/auth/me')
    const ok = !!res.user
    setAdminSession(ok)
    return ok
  } catch (e) {
    const err = e instanceof ApiError ? e : null
    if (err && err.status === 401) {
      setAdminSession(false)
      return false
    }
    return import.meta.env.DEV ? localFlag : false
  }
}

export async function logoutAdmin(): Promise<void> {
  try {
    await api('/auth/logout', { method: 'POST' })
  } catch {
    /* sunucuya ulaşılamasa da yerel oturum kapanır */
  }
  setAdminSession(false)
}
