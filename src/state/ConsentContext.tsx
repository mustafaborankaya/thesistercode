import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { contentPreview, firstVisitPreview } from '../lib/preview'
import { readJSON, storageKeys, writeJSON } from '../lib/storage'
import { startAnalytics, startMarketing, stopAnalytics, trackConsent } from '../services/analytics'

export interface ConsentState {
  status: 'pending' | 'decided'
  necessary: true
  analytics: boolean
  marketing: boolean
  decidedAt: string | null
}

const defaultConsent: ConsentState = { status: 'pending', necessary: true, analytics: false, marketing: false, decidedAt: null }
/** İçerik önizlemesi: karar verilmiş, yalnızca gerekli çerezler — banner görünmez, teklif/ölçüm devreye girmez. */
const previewConsent: ConsentState = { status: 'decided', necessary: true, analytics: false, marketing: false, decidedAt: null }

interface ConsentContextValue {
  consent: ConsentState
  acceptAll: () => void
  necessaryOnly: () => void
  save: (prefs: { analytics: boolean; marketing: boolean }) => void
  /** Yalnızca içerik önizlemesinde: paneldeki çerez metni düzenlenirken banner'ı göster/gizle. Diğer modlarda etkisiz. */
  setBannerPreview: (show: boolean) => void
}

const ConsentContext = createContext<ConsentContextValue | null>(null)

export function ConsentProvider({ children }: { children: ReactNode }) {
  // Önizleme modlarında kayıtlı tercih okunmaz; karar yalnızca bellekte tutulur.
  const [consent, setConsent] = useState<ConsentState>(() => (contentPreview ? previewConsent : firstVisitPreview ? defaultConsent : readJSON<ConsentState>(storageKeys.consent, defaultConsent)))

  useEffect(() => {
    if (!firstVisitPreview && !contentPreview) writeJSON(storageKeys.consent, consent)
    // İzin verilmeyen servisler başlatılmaz.
    if (consent.status === 'decided') {
      if (consent.analytics) startAnalytics()
      else stopAnalytics()
      if (consent.marketing) startMarketing()
    }
  }, [consent])

  const save = useCallback((prefs: { analytics: boolean; marketing: boolean }) => {
    // Karar olayı (kimlikler gönderim anında, yeni onay durumuna göre eklenir); onay geri alındıysa kimlikler hemen silinir.
    trackConsent(prefs)
    if (!prefs.analytics) stopAnalytics()
    setConsent({ status: 'decided', necessary: true, analytics: prefs.analytics, marketing: prefs.marketing, decidedAt: new Date().toISOString() })
  }, [])
  const acceptAll = useCallback(() => save({ analytics: true, marketing: true }), [save])
  const necessaryOnly = useCallback(() => save({ analytics: false, marketing: false }), [save])
  const setBannerPreview = useCallback((show: boolean) => {
    if (!contentPreview) return
    setConsent((c) => (show ? (c.status === 'pending' ? c : defaultConsent) : c.status === 'decided' ? c : previewConsent))
  }, [])

  const value = useMemo(() => ({ consent, acceptAll, necessaryOnly, save, setBannerPreview }), [consent, acceptAll, necessaryOnly, save, setBannerPreview])
  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>
}

export function useConsent(): ConsentContextValue {
  const ctx = useContext(ConsentContext)
  if (!ctx) throw new Error('useConsent, ConsentProvider içinde kullanılmalı')
  return ctx
}
