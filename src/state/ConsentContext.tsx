import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { firstVisitPreview } from '../lib/preview'
import { readJSON, storageKeys, writeJSON } from '../lib/storage'
import { startAnalytics, startMarketing } from '../services/analytics'

export interface ConsentState {
  status: 'pending' | 'decided'
  necessary: true
  analytics: boolean
  marketing: boolean
  decidedAt: string | null
}

const defaultConsent: ConsentState = { status: 'pending', necessary: true, analytics: false, marketing: false, decidedAt: null }

interface ConsentContextValue {
  consent: ConsentState
  acceptAll: () => void
  necessaryOnly: () => void
  save: (prefs: { analytics: boolean; marketing: boolean }) => void
}

const ConsentContext = createContext<ConsentContextValue | null>(null)

export function ConsentProvider({ children }: { children: ReactNode }) {
  // Önizleme modunda kayıtlı tercih okunmaz; karar yalnızca bellekte tutulur.
  const [consent, setConsent] = useState<ConsentState>(() => (firstVisitPreview ? defaultConsent : readJSON<ConsentState>(storageKeys.consent, defaultConsent)))

  useEffect(() => {
    if (!firstVisitPreview) writeJSON(storageKeys.consent, consent)
    // İzin verilmeyen servisler başlatılmaz.
    if (consent.status === 'decided') {
      if (consent.analytics) startAnalytics()
      if (consent.marketing) startMarketing()
    }
  }, [consent])

  const save = useCallback((prefs: { analytics: boolean; marketing: boolean }) => {
    setConsent({ status: 'decided', necessary: true, analytics: prefs.analytics, marketing: prefs.marketing, decidedAt: new Date().toISOString() })
  }, [])
  const acceptAll = useCallback(() => save({ analytics: true, marketing: true }), [save])
  const necessaryOnly = useCallback(() => save({ analytics: false, marketing: false }), [save])

  const value = useMemo(() => ({ consent, acceptAll, necessaryOnly, save }), [consent, acceptAll, necessaryOnly, save])
  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>
}

export function useConsent(): ConsentContextValue {
  const ctx = useContext(ConsentContext)
  if (!ctx) throw new Error('useConsent, ConsentProvider içinde kullanılmalı')
  return ctx
}
