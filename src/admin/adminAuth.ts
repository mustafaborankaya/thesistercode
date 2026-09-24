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

/** Girişli yöneticinin bilgisi (rol dahil) — sayfa/panel bileşenleri owner-only işlemleri buna göre gizler. */
export let currentAdmin: AdminUser | null = null

export async function loginAdmin(username: string, password: string): Promise<AdminLoginResult> {
  try {
    // API `{ admin: {...} }` döner (`{ user }` değil) — bkz. api/src/routes/auth.js.
    const res = await api<{ admin: AdminUser }>('/auth/login', { method: 'POST', body: { username, password } })
    setAdminSession(true)
    currentAdmin = res.admin
    return { ok: true, user: res.admin, source: 'api' }
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
    const res = await api<{ admin: AdminUser }>('/auth/me')
    const ok = !!res.admin
    setAdminSession(ok)
    currentAdmin = ok ? res.admin : null
    return ok
  } catch (e) {
    const err = e instanceof ApiError ? e : null
    if (err && err.status === 401) {
      setAdminSession(false)
      currentAdmin = null
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
  currentAdmin = null
}
