import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { readJSON, storageKeys, writeJSON } from '../lib/storage'
import { authProvider, type AuthResult } from '../services/auth'
import { CUSTOMER_CHANGED } from '../lib/customerStorage'

/** Demo hesap — şifre hiçbir zaman saklanmaz ve loglanmaz. */
export interface Account {
  name: string
  email: string
  createdAt: string
  /** Hesap oluşturmayla kazanılan %10 üyelik indirimi hakkı. */
  discountEligible: boolean
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
  register: (input: { name: string; email: string; password: string }) => Promise<AuthResult>
  login: (input: { email: string; password: string }) => Promise<AuthResult>
  logout: () => void
}

const AccountContext = createContext<AccountContextValue | null>(null)
const emptyStore: AccountStore = { current: null, known: [] }

export function AccountProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<AccountStore>(() => readJSON<AccountStore>(storageKeys.account, emptyStore))

  useEffect(() => {
    writeJSON(storageKeys.account, store)
    window.dispatchEvent(new Event(CUSTOMER_CHANGED))
  }, [store])

  const register = useCallback(async (input: { name: string; email: string; password: string }) => {
    const result = await authProvider.register(input)
    if (result.ok) {
      const account: Account = { name: input.name.trim(), email: input.email.trim().toLowerCase(), createdAt: new Date().toISOString(), discountEligible: true }
      setStore((s) => ({ current: account, known: [...s.known.filter((k) => k.email !== account.email), account] }))
    }
    return result
  }, [])

  const login = useCallback(
    async (input: { email: string; password: string }) => {
      const email = input.email.trim().toLowerCase()
      const known = store.known.find((k) => k.email === email)
      const result = await authProvider.login({ ...input, knownAccount: !!known })
      if (result.ok && known) setStore((s) => ({ ...s, current: known }))
      return result
    },
    [store.known],
  )

  const logout = useCallback(() => setStore((s) => ({ ...s, current: null })), [])

  const value = useMemo<AccountContextValue>(
    () => ({
      account: store.current,
      isLoggedIn: store.current != null,
      discountEligible: store.current?.discountEligible ?? false,
      register,
      login,
      logout,
    }),
    [store, register, login, logout],
  )
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
}

export function useAccount(): AccountContextValue {
  const ctx = useContext(AccountContext)
  if (!ctx) throw new Error('useAccount, AccountProvider içinde kullanılmalı')
  return ctx
}
