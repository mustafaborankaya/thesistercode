import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { siteSettings } from '../config/settings'
import { isApiMode } from '../data/remote'
import { readJSON, storageKeys, writeJSON } from '../lib/storage'
import { authProvider, type AccountInfo, type AuthResult } from '../services/auth'
import { CUSTOMER_CHANGED } from '../lib/customerStorage'

/** Demo hesap — şifre hiçbir zaman saklanmaz ve loglanmaz. */
export interface Account {
  name: string
  email: string
  createdAt: string
  /** Üyelik indirimi bir sonraki siparişte uygulanır mı (hesap açınca kazanılır; ilk siparişle kullanılır). */
  discountEligible: boolean
  /** İlk sipariş indirimi kullanıldı (aktif — iptal edilmemiş — siparişi var). Eski önbellekte olmayabilir. */
  discountUsed?: boolean
}

interface AccountStore {
  current: Account | null
  /** Bu tarayıcıda oluşturulmuş demo hesaplar (giriş denemesi için). */
  known: Account[]
}

interface AccountContextValue {
  account: Account | null
  isLoggedIn: boolean
  discountEligible: boolean
  discountUsed: boolean
  register: (input: { name: string; email: string; password: string }) => Promise<AuthResult>
  login: (input: { email: string; password: string }) => Promise<AuthResult>
  logout: () => void
  /**
   * Hesap bilgisini (özellikle indirim hakkını) tazeler. API modunda `GET /account/me` yeniden okunur;
   * yerel demo modda `orderPlaced` ile çağrılırsa ilk sipariş kuralı yerelde uygulanır.
   */
  refresh: (opts?: { orderPlaced?: boolean }) => Promise<void>
}

const AccountContext = createContext<AccountContextValue | null>(null)
const emptyStore: AccountStore = { current: null, known: [] }

function accountFromInfo(info: AccountInfo, createdAt: string): Account {
  return { name: info.name, email: info.email, createdAt, discountEligible: info.discountEligible, discountUsed: info.discountUsed }
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<AccountStore>(() => readJSON<AccountStore>(storageKeys.account, emptyStore))

  useEffect(() => {
    writeJSON(storageKeys.account, store)
    window.dispatchEvent(new Event(CUSTOMER_CHANGED))
  }, [store])

  // API modunda gerçek oturum kaynağı sunucu çerezidir (tsc_customer); sayfa açılışında `GET /account/me`
  // ile doğrulanır/tazelenir — yerel önbellek (localStorage) yalnızca AdminApp'teki gibi ilk an için
  // iyimser bir tahmindir (bkz. src/admin/AdminApp.tsx aynı desen).
  useEffect(() => {
    if (!isApiMode()) return
    // Oturum çerezi httpOnly olduğundan JS'ten okunamaz; yerel önbellekte bir oturum izi yoksa
    // `/account/me` hiç çağrılmaz — aksi hâlde her ziyaretçide her sayfada gereksiz bir 401 ve
    // konsol hatası oluşur. Giriş/kayıt sonrası önbellek dolar, çıkışta boşalır.
    if (!readJSON<AccountStore>(storageKeys.account, emptyStore).current) return
    let cancelled = false
    authProvider.me().then((info) => {
      if (cancelled) return
      setStore((s) => ({
        ...s,
        current: info ? accountFromInfo(info, s.current?.email === info.email ? s.current.createdAt : new Date().toISOString()) : null,
      }))
    })
    return () => {
      cancelled = true
    }
  }, [])

  const register = useCallback(async (input: { name: string; email: string; password: string }) => {
    const result = await authProvider.register(input)
    if (result.ok) {
      if (isApiMode()) {
        const info = await authProvider.me()
        if (info) setStore((s) => ({ ...s, current: accountFromInfo(info, new Date().toISOString()) }))
      } else {
        const account: Account = { name: input.name.trim(), email: input.email.trim().toLowerCase(), createdAt: new Date().toISOString(), discountEligible: true, discountUsed: false }
        setStore((s) => ({ current: account, known: [...s.known.filter((k) => k.email !== account.email), account] }))
      }
    }
    return result
  }, [])

  const login = useCallback(
    async (input: { email: string; password: string }) => {
      if (isApiMode()) {
        const result = await authProvider.login({ ...input, knownAccount: true })
        if (result.ok) {
          const info = await authProvider.me()
          if (info) setStore((s) => ({ ...s, current: accountFromInfo(info, new Date().toISOString()) }))
        }
        return result
      }
      const email = input.email.trim().toLowerCase()
      const known = store.known.find((k) => k.email === email)
      const result = await authProvider.login({ ...input, knownAccount: !!known })
      if (result.ok && known) setStore((s) => ({ ...s, current: known }))
      return result
    },
    [store.known],
  )

  const logout = useCallback(() => {
    setStore((s) => ({ ...s, current: null }))
    void authProvider.logout()
  }, [])

  const refresh = useCallback(async (opts?: { orderPlaced?: boolean }) => {
    if (isApiMode()) {
      const info = await authProvider.me()
      // Ağ hatasında (null) mevcut oturum bilgisi korunur; çıkış yalnızca açılış doğrulamasında yapılır.
      if (info) setStore((s) => (s.current ? { ...s, current: accountFromInfo(info, s.current.email === info.email ? s.current.createdAt : new Date().toISOString()) } : s))
      return
    }
    // Yerel demo: sunucu kuralının aynısı — sipariş verilince ilk sipariş indirimi kullanılmış olur.
    if (!opts?.orderPlaced || siteSettings.memberDiscount.firstOrderOnly === false) return
    setStore((s) => {
      if (!s.current) return s
      const current: Account = { ...s.current, discountEligible: false, discountUsed: true }
      return { current, known: s.known.map((k) => (k.email === current.email ? current : k)) }
    })
  }, [])

  const value = useMemo<AccountContextValue>(
    () => ({
      account: store.current,
      isLoggedIn: store.current != null,
      discountEligible: store.current?.discountEligible ?? false,
      discountUsed: store.current?.discountUsed ?? false,
      register,
      login,
      logout,
      refresh,
    }),
    [store, register, login, logout, refresh],
  )
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
}

export function useAccount(): AccountContextValue {
  const ctx = useContext(AccountContext)
  if (!ctx) throw new Error('useAccount, AccountProvider içinde kullanılmalı')
  return ctx
}
