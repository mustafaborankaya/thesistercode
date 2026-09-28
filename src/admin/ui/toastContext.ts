import { createContext, useContext } from 'react'

export interface ToastApi {
  success: (message: string) => void
  error: (message: string) => void
  warning: (message: string) => void
  info: (message: string) => void
}

const noop = () => undefined
export const ToastContext = createContext<ToastApi>({ success: noop, error: noop, warning: noop, info: noop })

/** Başarı/hata bildirimi — sağ altta, kendiliğinden kapanır (hata daha uzun kalır), ekran okuyucuya duyurulur. */
export function useToast(): ToastApi {
  return useContext(ToastContext)
}
